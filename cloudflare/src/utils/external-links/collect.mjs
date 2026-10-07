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
 * Collect every external link a project exposes, with the sources it came from.
 *
 * One normalized URL is one identity, but it may be observed from several
 * places with different usage. Trust is decided per observation because the
 * policy is usage-sensitive: a `files.catbox.moe` URL proven to be CharInfo
 * MEDIA is trusted there, while the same URL sitting in the description is an
 * unknown-usage observation that still needs a human.
 *
 * `discordThreadUrl` is the one deliberate exception. Its dedicated validator
 * proves the exact normalized URL *is* the project's community target, so
 * observations of that same URL in description/precautions are covered by that
 * proof rather than re-litigated.
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
  const recordByUrl = new Map();

  const addRecord = (rawValue, { source, usage }) => {
    const value = trimTrailingUrlPunctuation(String(rawValue ?? '').trim());
    const url = normalizeExternalLinkUrl(value);
    if (!url) return;

    const href = url.href;
    const observation = {
      source,
      usage,
      ...classifyExternalLink(url, usage),
    };

    const existing = recordByUrl.get(href);
    if (existing) {
      if (!existing.observations.some(item => item.source === source && item.usage === usage)) {
        existing.observations.push(observation);
      }
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }

    const record = {
      url: href,
      hostname: url.hostname.toLowerCase(),
      kind: url.protocol === 'https:' ? 'https' : 'http',
      // Best-effort headline for simple consumers; review decisions use
      // `observations`, never this.
      source,
      sources: [source],
      usage,
      observations: [observation],
    };
    recordByUrl.set(href, record);
    records.push(record);
  };

  const addTextLinks = (text, source, usage, skipUrls) => {
    const value = String(text ?? '');
    HTTP_URL_PATTERN.lastIndex = 0;
    for (const match of value.matchAll(HTTP_URL_PATTERN)) {
      const candidate = trimTrailingUrlPunctuation(match[0]);
      if (skipUrls?.has(normalizeExternalLinkUrl(candidate)?.href)) continue;
      addRecord(candidate, { source, usage });
    }
  };

  addTextLinks(description, LINK_SOURCE.DESCRIPTION, LINK_USAGE.UNKNOWN);
  addTextLinks(precautions, LINK_SOURCE.PRECAUTIONS, LINK_USAGE.UNKNOWN);

  // The one authoritative identity. When the dedicated project field validator
  // accepts this exact normalized URL, that URL *is* the project's community
  // target, so every other observation of the very same URL is covered by that
  // proof instead of being re-litigated. It does not extend to any other URL,
  // nor to a field the validator rejected.
  const thread = normalizeProjectDiscordThreadUrl(discordThreadUrl, allowedGuildIds);
  if (thread.ok && thread.value) {
    const href = normalizeExternalLinkUrl(thread.value)?.href;
    const record = href ? recordByUrl.get(href) : null;
    if (record) {
      record.observations.push({
        source: LINK_SOURCE.DISCORD_THREAD,
        usage: LINK_USAGE.NAVIGATION,
        trust: LINK_TRUST.TRUSTED,
        reason: 'validated-project-thread',
        authoritative: true,
      });
      if (!record.sources.includes(LINK_SOURCE.DISCORD_THREAD)) {
        record.sources.push(LINK_SOURCE.DISCORD_THREAD);
      }
    } else if (href) {
      const record = {
        url: href,
        hostname: new URL(href).hostname.toLowerCase(),
        kind: 'https',
        source: LINK_SOURCE.DISCORD_THREAD,
        sources: [LINK_SOURCE.DISCORD_THREAD],
        usage: LINK_USAGE.NAVIGATION,
        observations: [{
          source: LINK_SOURCE.DISCORD_THREAD,
          usage: LINK_USAGE.NAVIGATION,
          trust: LINK_TRUST.TRUSTED,
          reason: 'validated-project-thread',
          authoritative: true,
        }],
      };
      recordByUrl.set(href, record);
      records.push(record);
    }
  }

  for (const entry of Array.isArray(worldbookEntries) ? worldbookEntries : []) {
    const content = String(entry?.content ?? entry?.text ?? '');
    const inspected = inspectCharInfoManagedV2Block(content, content.indexOf('profile.gallery.map'));
    if (inspected) {
      for (const candidate of inspected.mediaUrls) {
        addRecord(candidate, { source: LINK_SOURCE.CHARINFO_MEDIA, usage: LINK_USAGE.MEDIA });
      }
      // Scan the managed block region for links, but never re-add the profile
      // media itself: the block's own media usage is proven, and re-adding those
      // URLs as unknown prose is what put trusted media back into the review set
      // in #39. Text outside the block is scanned normally, because a link there
      // really is a separate unknown-usage sighting.
      const managed = content.slice(inspected.start, inspected.end);
      const outside = content.slice(0, inspected.start) + content.slice(inspected.end);
      const coveredMedia = new Set();
      for (const candidate of inspected.mediaUrls) {
        const normalized = normalizeExternalLinkUrl(candidate);
        if (normalized) coveredMedia.add(normalized.href);
      }
      addTextLinks(managed, LINK_SOURCE.WORLDBOOK, LINK_USAGE.UNKNOWN, coveredMedia);
      addTextLinks(outside, LINK_SOURCE.WORLDBOOK, LINK_USAGE.UNKNOWN);
      continue;
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

function recordObservations(record) {
  if (Array.isArray(record?.observations) && record.observations.length > 0) {
    return record.observations;
  }
  return [{ source: record?.source, usage: record?.usage, trust: record?.trust, reason: record?.reason }];
}

/**
 * The observations of one URL that still need a human decision.
 *
 * A URL needs review when *any* observation is unresolved. A trusted CharInfo
 * MEDIA sighting therefore does not launder an unknown-usage sighting of the
 * same URL in the description. The single exception is an authoritative
 * observation, which proves the URL's identity rather than one of its usages.
 */
function unresolvedObservations(record) {
  // A validated project identity proves which target this URL is, so it covers
  // every observation of the very same URL rather than only itself.
  if (recordObservations(record).some(observation => observation?.authoritative)) return [];
  return recordObservations(record).filter(observation => observation?.trust !== LINK_TRUST.TRUSTED);
}

/** Records that still need a human decision, in stable order. */
export function externalLinksNeedingReview(records) {
  return (Array.isArray(records) ? records : [])
    .filter(record => unresolvedObservations(record).length > 0)
    .map(record => {
      const pending = unresolvedObservations(record);
      const first = pending[0];
      return {
        ...record,
        source: first.source ?? record.source,
        usage: first.usage ?? record.usage,
        trust: first.trust,
        reason: first.reason,
        reviewSources: [...new Set(pending.map(item => item.source).filter(Boolean))],
      };
    })
    .sort(
      (a, b) =>
        String(a.source).localeCompare(String(b.source)) ||
        a.hostname.localeCompare(b.hostname) ||
        a.url.localeCompare(b.url),
    );
}

/** Trusted records, for the optional informational section. */
export function trustedExternalLinks(records) {
  return (Array.isArray(records) ? records : []).filter(
    record => unresolvedObservations(record).length === 0,
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
