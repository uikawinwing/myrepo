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
// How much a usage tells us about what a URL actually does. A proven usage beats
// a guessed one, so it must never be downgraded by a later, vaguer sighting.
const USAGE_SPECIFICITY = {
  [LINK_USAGE.UNKNOWN]: 0,
  [LINK_USAGE.RESOURCE]: 1,
  [LINK_USAGE.NETWORK]: 1,
  [LINK_USAGE.MEDIA]: 2,
  [LINK_USAGE.NAVIGATION]: 2,
};

// A positive trust decision must never be undone by a later sighting that could
// not classify the URL as well.
const TRUST_RANK = {
  [LINK_TRUST.UNKNOWN]: 0,
  [LINK_TRUST.UNTRUSTED]: 1,
  [LINK_TRUST.TRUSTED]: 2,
};

export function collectProjectExternalLinks({
  description = '',
  precautions = '',
  discordThreadUrl = null,
  allowedGuildIds = [],
  worldbookEntries = [],
  regexEntries = [],
} = {}) {
  const records = [];
  const recordByUrl = new Map();

  /**
   * Merge every sighting of one normalized URL into a single record.
   *
   * The same URL can appear in several places, e.g. as the validated project
   * thread and again inside the description. Those are one link, not two, so the
   * record keeps the strongest usage and trust seen and lists every source it
   * came from instead of storing contradictory duplicates.
   */
  const addRecord = (rawValue, { source, usage, authoritative = false }) => {
    const value = trimTrailingUrlPunctuation(String(rawValue ?? '').trim());
    const url = normalizeExternalLinkUrl(value);
    if (!url) return;

    const href = url.href;
    const existing = recordByUrl.get(href);

    if (!existing) {
      const classification = authoritative
        ? { trust: LINK_TRUST.TRUSTED, reason: 'validated-project-thread' }
        : classifyExternalLink(url, usage);
      const record = {
        url: href,
        hostname: url.hostname.toLowerCase(),
        source,
        sources: [source],
        kind: url.protocol === 'https:' ? 'https' : 'http',
        usage: authoritative ? LINK_USAGE.NAVIGATION : usage,
        ...classification,
      };
      recordByUrl.set(href, record);
      records.push(record);
      return;
    }

    if (!existing.sources.includes(source)) existing.sources.push(source);

    if (authoritative) {
      // Proven by the dedicated project field validator: this exact normalized
      // URL is a validated community link, so no other sighting may weaken it.
      existing.usage = LINK_USAGE.NAVIGATION;
      existing.trust = LINK_TRUST.TRUSTED;
      existing.reason = 'validated-project-thread';
      existing.source = LINK_SOURCE.DISCORD_THREAD;
      return;
    }

    const classification = classifyExternalLink(url, usage);
    const moreSpecificUsage =
      (USAGE_SPECIFICITY[usage] ?? 0) > (USAGE_SPECIFICITY[existing.usage] ?? 0);
    const strongerTrust = (TRUST_RANK[classification.trust] ?? 0) > (TRUST_RANK[existing.trust] ?? 0);

    if (moreSpecificUsage || strongerTrust) {
      existing.usage = usage;
      Object.assign(existing, classification);
    }
  };

  const addTextLinks = (text, source, usage) => {
    const value = String(text ?? '');
    HTTP_URL_PATTERN.lastIndex = 0;
    for (const match of value.matchAll(HTTP_URL_PATTERN)) {
      addRecord(match[0], { source, usage });
    }
  };

  addTextLinks(description, LINK_SOURCE.DESCRIPTION, LINK_USAGE.UNKNOWN);
  addTextLinks(precautions, LINK_SOURCE.PRECAUTIONS, LINK_USAGE.UNKNOWN);

  const thread = normalizeProjectDiscordThreadUrl(discordThreadUrl, allowedGuildIds);
  if (thread.ok && thread.value) {
    addRecord(thread.value, {
      source: LINK_SOURCE.DISCORD_THREAD,
      usage: LINK_USAGE.NAVIGATION,
      authoritative: true,
    });
  }

  for (const entry of Array.isArray(worldbookEntries) ? worldbookEntries : []) {
    const content = String(entry?.content ?? entry?.text ?? '');
    const inspected = inspectCharInfoManagedV2Block(content, content.indexOf('profile.gallery.map'));
    if (inspected) {
      for (const candidate of inspected.mediaUrls) {
        addRecord(candidate, { source: LINK_SOURCE.CHARINFO_MEDIA, usage: LINK_USAGE.MEDIA });
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

/** Every source a record was seen in, so a merged record stays explainable. */
function recordSources(record) {
  return Array.isArray(record?.sources) && record.sources.length > 0
    ? record.sources
    : [record?.source].filter(Boolean);
}

/** Records that still need a human decision, in stable order. */
export function externalLinksNeedingReview(records) {
  return (Array.isArray(records) ? records : [])
    .filter(record => record.trust !== LINK_TRUST.TRUSTED)
    .sort(
      (a, b) =>
        recordSources(a)[0].localeCompare(recordSources(b)[0]) ||
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
    for (const source of recordSources(record)) {
      if (!link.sources.includes(source)) link.sources.push(source);
    }
  }

  return Array.from(byHostname.values())
    .map(group => ({
      ...group,
      links: group.links.sort((a, b) => a.url.localeCompare(b.url)),
    }))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
}
