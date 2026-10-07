// One project external-link collector.
//
// Project Detail, the Audit Center and the EJS/Regex checker all consume the
// records produced here, so they cannot drift into deciding independently which
// fields to look at or how to classify a link.

import {
  LINK_SOURCE,
  LINK_TRUST,
  LINK_USAGE,
  classifyExternalLink,
  normalizeExternalLinkUrl,
  normalizeProjectDiscordThreadUrl,
  trimTrailingUrlPunctuation,
} from './policy.mjs';
import { inspectCharInfoManagedV2Block } from '../ejs-checker/policy-config.mjs';

const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`，。；：！？、（）【】《》“”‘’]+/giu;

/**
 * Collect every external link a project exposes, with the source it came from.
 *
 * `discordThreadUrl` is validated with the shared project policy, so a thread
 * URL the project field already accepts is reported as a trusted community
 * link instead of an unknown generic external link.
 */
export function collectProjectExternalLinks({
  description = '',
  precautions = '',
  discordThreadUrl = null,
  allowedGuildIds = [],
  worldbookEntries = [],
  regexEntries = [],
} = {}) {
  const records = [];
  const seen = new Map();
  // Longest-prefix-wins usage per URL. A URL proven to be media anywhere in the
  // project must not be re-added as an unknown link from another source, which
  // would put a trusted CharInfo asset straight back into the review set.
  const usageByUrl = new Map();

  const addRecord = (rawValue, source, usage) => {
    const value = trimTrailingUrlPunctuation(String(rawValue ?? '').trim());
    const url = normalizeExternalLinkUrl(value);
    if (!url) return;

    const key = `${source}|${url.href}`;
    if (seen.has(key)) return;
    seen.set(key, true);

    const previous = usageByUrl.get(url.href);
    if (previous === LINK_USAGE.UNKNOWN && usage !== LINK_USAGE.UNKNOWN) {
      // Upgrading a previously unknown usage: reclassify the existing record
      // rather than storing a second, contradictory one.
      usageByUrl.set(url.href, usage);
      for (const record of records) {
        if (record.url === url.href) {
          record.usage = usage;
          Object.assign(record, classifyExternalLink(url, usage));
        }
      }
      return;
    }
    if (previous !== undefined) return;
    usageByUrl.set(url.href, usage);

    records.push({
      url: url.href,
      hostname: url.hostname.toLowerCase(),
      source,
      kind: url.protocol === 'https:' ? 'https' : 'http',
      usage,
      ...classifyExternalLink(url, usage),
    });
  };

  const addTextLinks = (text, source, usage) => {
    const value = String(text ?? '');
    HTTP_URL_PATTERN.lastIndex = 0;
    for (const match of value.matchAll(HTTP_URL_PATTERN)) {
      addRecord(match[0], source, usage);
    }
  };

  addTextLinks(description, LINK_SOURCE.DESCRIPTION, LINK_USAGE.UNKNOWN);
  addTextLinks(precautions, LINK_SOURCE.PRECAUTIONS, LINK_USAGE.UNKNOWN);

  const thread = normalizeProjectDiscordThreadUrl(discordThreadUrl, allowedGuildIds);
  if (thread.ok && thread.value) {
    const url = normalizeExternalLinkUrl(thread.value);
    if (url) {
      const key = `${LINK_SOURCE.DISCORD_THREAD}|${url.href}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        usageByUrl.set(url.href, LINK_USAGE.NAVIGATION);
        records.push({
          url: url.href,
          hostname: url.hostname.toLowerCase(),
          source: LINK_SOURCE.DISCORD_THREAD,
          kind: 'https',
          usage: LINK_USAGE.NAVIGATION,
          trust: LINK_TRUST.TRUSTED,
          reason: thread.reason,
        });
      }
    }
  }

  for (const entry of Array.isArray(worldbookEntries) ? worldbookEntries : []) {
    const content = String(entry?.content ?? entry?.text ?? '');
    const inspected = inspectCharInfoManagedV2Block(content, content.indexOf('profile.gallery.map'));
    if (inspected) {
      for (const candidate of inspected.mediaUrls) {
        addRecord(candidate, LINK_SOURCE.CHARINFO_MEDIA, LINK_USAGE.MEDIA);
      }
    }
    addTextLinks(content, LINK_SOURCE.WORLDBOOK, LINK_USAGE.UNKNOWN);
  }

  for (const entry of Array.isArray(regexEntries) ? regexEntries : []) {
    const replacement = String(entry?.replaceString ?? entry?.replace_string ?? '');
    addTextLinks(replacement, LINK_SOURCE.REGEX, LINK_USAGE.UNKNOWN);
  }

  return records;
}

/** Records that still need a human decision, in stable order. */
export function externalLinksNeedingReview(records) {
  return (Array.isArray(records) ? records : [])
    .filter(record => record.trust !== LINK_TRUST.TRUSTED)
    .sort(
      (a, b) =>
        a.source.localeCompare(b.source) ||
        a.hostname.localeCompare(b.hostname) ||
        a.url.localeCompare(b.url),
    );
}

/** Trusted records, for the optional informational section. */
export function trustedExternalLinks(records) {
  return (Array.isArray(records) ? records : []).filter(
    record => record.trust === LINK_TRUST.TRUSTED,
  );
}

/**
 * Group records by hostname for the existing Project Detail panel.
 *
 * Kept as a pure view over the collected records so the panel keeps its current
 * markup while consuming the shared model.
 */
export function groupExternalLinksByHostname(records) {
  const byHostname = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    let group = byHostname.get(record.hostname);
    if (!group) {
      group = { hostname: record.hostname, links: [] };
      byHostname.set(record.hostname, group);
    }
    if (!group.links.some(link => link.url === record.url)) {
      group.links.push({ url: record.url, hostname: record.hostname, sources: [] });
    }
    const link = group.links.find(item => item.url === record.url);
    if (!link.sources.includes(record.source)) link.sources.push(record.source);
  }

  return Array.from(byHostname.values())
    .map(group => ({
      ...group,
      links: group.links.sort((a, b) => a.url.localeCompare(b.url)),
    }))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
}
