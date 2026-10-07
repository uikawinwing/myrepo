// #23 matrix test: one external-link policy, exercised across every source the
// product collects from, and across the trust decisions the Audit Center makes.
//
// The point of this file is that the SAME url is classified identically no
// matter whether it arrived via description, precautions, a validated Discord
// thread, a worldbook entry, a regex entry, or CharInfo media constants.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeProjectCodeV2 } from '../src/utils/ejs-checker/index.mjs';
import {
  collectProjectExternalLinks,
  externalLinksNeedingReview,
  groupExternalLinksByHostname,
  trustedExternalLinks,
} from '../src/utils/external-links/collect.mjs';
import {
  LINK_SOURCE,
  LINK_TRUST,
  LINK_USAGE,
  classifyDynamicMediaCandidates,
  inspectExternalLink,
  normalizeProjectDiscordThreadUrl,
} from '../src/utils/external-links/policy.mjs';
import { inspectCharInfoManagedV2Block, trustedAssetHosts } from '../src/utils/ejs-checker/policy-config.mjs';

const workshopConfig = JSON.parse(
  readFileSync(new URL('../../config/workshop.json', import.meta.url), 'utf8'),
);
const ALLOWED_GUILDS = workshopConfig.projectCommunity?.discordGuildIds ?? [];
const [ALLOWED_GUILD] = ALLOWED_GUILDS;
const OTHER_GUILD = '1200000000000000000';

let count = 0;
const check = (source, type = 'worldbook') =>
  analyzeProjectCodeV2([
    {
      fileName: 'matrix.json',
      type,
      text: JSON.stringify(
        type === 'regex'
          ? { id: 's', scriptName: 'media', findRegex: 'x', replaceString: source }
          : { entries: { 1: { uid: 1, comment: 'media', content: source } } },
      ),
    },
  ]);
const ejs = source => check(`@@private\n<% { ${source} } %>`);
const rules = report => report.findings.map(finding => finding.ruleId);
const mediaAh2 = report =>
  report.findings.filter(finding => finding.ruleId === 'AH2' && finding.riskEvidence?.usage === 'media');

// ---------------------------------------------------------------- policy unit

// Normalization rejects anything that is not a plain credential-free http(s) URL.
for (const value of [
  'javascript:alert(1)',
  'data:text/html,<h1>x</h1>',
  'ftp://example.com/a.png',
  'https://user:pass@example.com/a.png',
  '',
  null,
  undefined,
]) {
  assert.equal(inspectExternalLink(value, LINK_USAGE.MEDIA).trust, LINK_TRUST.UNKNOWN, String(value));
  count++;
}

// Classification is usage-sensitive: a trusted media host is only trusted as media.
assert.equal(inspectExternalLink('https://files.catbox.moe/a.png', LINK_USAGE.MEDIA).trust, LINK_TRUST.TRUSTED);
assert.equal(inspectExternalLink('https://files.catbox.moe/a.png', LINK_USAGE.NAVIGATION).trust, LINK_TRUST.UNTRUSTED);
count += 2;

// Rejected shapes that must never be trusted.
for (const value of [
  'http://files.catbox.moe/a.png',        // insecure
  'https://sub.files.catbox.moe/a.png',   // subdomain is not the host
  'https://files.catbox.moe.evil.org/a.png', // suffix attack
  'https://files.catbox.moe/a.js',        // not a media extension
  'https://files.catbox.moe/',            // no media path
]) {
  assert.notEqual(inspectExternalLink(value, LINK_USAGE.MEDIA).trust, LINK_TRUST.TRUSTED, value);
  count++;
}
assert.deepEqual([...trustedAssetHosts], ['files.catbox.moe', 'i.ibb.co']);
count++;

// Dynamic candidate sets: all-trusted suppresses, anything else keeps the warning.
assert.equal(classifyDynamicMediaCandidates(['https://files.catbox.moe/a.png', 'https://i.ibb.co/b.webp']).trust, LINK_TRUST.TRUSTED);
assert.notEqual(classifyDynamicMediaCandidates(['https://files.catbox.moe/a.png', 'https://evil.example/b.png']).trust, LINK_TRUST.TRUSTED);
assert.equal(classifyDynamicMediaCandidates([]).trust, LINK_TRUST.UNKNOWN);
count += 3;

// ---------------------------------------------------------------- Discord

// The project field validator is the authority on the guild rule.
const threadUrl = `https://discord.com/channels/${ALLOWED_GUILD}/${ALLOWED_GUILD}1`;
assert.equal(normalizeProjectDiscordThreadUrl(threadUrl, ALLOWED_GUILDS).ok, true);
assert.equal(normalizeProjectDiscordThreadUrl(threadUrl, [OTHER_GUILD]).ok, false, 'wrong guild must be rejected');
assert.equal(normalizeProjectDiscordThreadUrl(`https://discord.com/channels/${OTHER_GUILD}/${OTHER_GUILD}1`, ALLOWED_GUILDS).ok, false);
assert.equal(normalizeProjectDiscordThreadUrl('https://discord.gg/abc123', ALLOWED_GUILDS).ok, false, 'invite link');
assert.equal(normalizeProjectDiscordThreadUrl(`https://discord.com/channels/${ALLOWED_GUILD}/${ALLOWED_GUILD}1/9`, ALLOWED_GUILDS).ok, false, 'message link');
assert.equal(normalizeProjectDiscordThreadUrl(`http://discord.com/channels/${ALLOWED_GUILD}/${ALLOWED_GUILD}1`, ALLOWED_GUILDS).ok, false, 'http');
assert.equal(normalizeProjectDiscordThreadUrl(`https://example.com/channels/${ALLOWED_GUILD}/${ALLOWED_GUILD}1`, ALLOWED_GUILDS).ok, false, 'other host');
count += 7;

// A configured thread is a trusted community link, so the auditor is not told to
// go confirm an unknown generic link.
const threadInEjs = ejs(`const link = "${threadUrl}";`);
assert.equal(rules(threadInEjs).includes('U2'), false, JSON.stringify(threadInEjs.findings));
assert.equal(mediaAh2(threadInEjs).length, 0);
count += 2;

// An invite or a message link inside content is still an ordinary unverified link.
assert.ok(rules(ejs('const link = "https://discord.gg/abc123";')).includes('U2'));
assert.ok(rules(ejs(`const link = "https://discord.com/channels/${ALLOWED_GUILD}/${ALLOWED_GUILD}1/42";`)).includes('U2'));
count += 2;

// ---------------------------------------------------------------- matrix across sources

const TRUSTED_PNG = 'https://files.catbox.moe/album/portrait.png';
const TRUSTED_WEBP = 'https://i.ibb.co/album/cover.webp';
const UNTRUSTED = 'https://unknown-host.example/asset.png';

const collectorCases = [
  {
    label: 'description',
    input: { description: `see ${TRUSTED_PNG} and ${UNTRUSTED}` },
    expect: { [LINK_SOURCE.DESCRIPTION]: [TRUSTED_PNG, UNTRUSTED] },
  },
  {
    label: 'precautions',
    input: { precautions: `backup at ${TRUSTED_WEBP}` },
    expect: { [LINK_SOURCE.PRECAUTIONS]: [TRUSTED_WEBP] },
  },
  {
    label: 'discord thread field',
    input: { discordThreadUrl: threadUrl, allowedGuildIds: ALLOWED_GUILDS },
    expect: { [LINK_SOURCE.DISCORD_THREAD]: [threadUrl] },
  },
  {
    label: 'worldbook',
    input: { worldbookEntries: [{ content: `asset ${UNTRUSTED}` }] },
    expect: { [LINK_SOURCE.WORLDBOOK]: [UNTRUSTED] },
  },
  {
    label: 'regex',
    input: { regexEntries: [{ replaceString: `image ${TRUSTED_PNG}` }] },
    expect: { [LINK_SOURCE.REGEX]: [TRUSTED_PNG] },
  },
];

for (const testCase of collectorCases) {
  const records = collectProjectExternalLinks({ allowedGuildIds: ALLOWED_GUILDS, ...testCase.input });
  for (const [source, expectedUrls] of Object.entries(testCase.expect)) {
    const actual = records.filter(record => record.source === source).map(record => record.url);
    assert.deepEqual(actual, expectedUrls, `${testCase.label}: ${JSON.stringify(records)}`);
  }
  count += Object.keys(testCase.expect).length;
}

// Trusted links stay out of the review set; untrusted ones stay in.
const mixedRecords = collectProjectExternalLinks({
  description: `intro ${TRUSTED_PNG} plus ${UNTRUSTED}`,
  precautions: `note ${TRUSTED_WEBP}`,
  discordThreadUrl: threadUrl,
  allowedGuildIds: ALLOWED_GUILDS,
  regexEntries: [{ replaceString: `more ${UNTRUSTED}` }],
});
// Trust is scoped to what we can actually prove. A trusted media host reached
// through prose has unknown usage, so it is NOT auto-trusted: only proven media
// usage and the validated Discord thread clear the review set.
const reviewUrls = externalLinksNeedingReview(mixedRecords).map(record => record.url);
assert.ok(reviewUrls.includes(UNTRUSTED));
assert.ok(reviewUrls.includes(TRUSTED_PNG), 'prose usage is unknown, so a media host is not auto-trusted');
assert.ok(reviewUrls.includes(TRUSTED_WEBP));
assert.equal(reviewUrls.includes(threadUrl), false, 'a validated thread is a trusted community link');
assert.deepEqual(trustedExternalLinks(mixedRecords).map(record => record.source), [LINK_SOURCE.DISCORD_THREAD]);
count += 5;

// The wrong-guild thread must not be reported as trusted.
const badGuild = collectProjectExternalLinks({
  discordThreadUrl: `https://discord.com/channels/${OTHER_GUILD}/${OTHER_GUILD}1`,
  allowedGuildIds: ALLOWED_GUILDS,
});
assert.equal(badGuild.length, 0, JSON.stringify(badGuild));
count++;

// Grouping is a pure view over the same records, so the detail panel cannot drift.
const grouped = groupExternalLinksByHostname(mixedRecords);
assert.ok(grouped.length > 0);
assert.ok(grouped.some(group => group.hostname === 'files.catbox.moe'));
count += 2;

// ---------------------------------------------------------------- CharInfo media

function charInfoBlock(mediaUrls) {
  const profile = {
    characterName: 'Test',
    avatarUrl: 'https://files.catbox.moe/avatar.png',
    coverUrl: 'https://i.ibb.co/demo/cover.webp',
    raceColor: '#A9DBC3',
    tierColor: '#B7D9E8',
    entranceQuote: '',
    gallery: [{ title: '主立绘', sources: mediaUrls }],
  };
  return [
    '<%# char-info-ejs-builder:start:v2 %>',
    '<%_',
    '{',
    '  const profile = ' + JSON.stringify(profile, null, 2) + ';',
    '  const npcName = profile.characterName;',
    '  const statusGalleryExtensions = [".png", ".jpg", ".jpeg", ".webp", ".avif"];',
    '  const statusGalleryImages = profile.gallery.flatMap(image => {',
    '    const candidates = [...image.sources, ...(image.thumbnail ? [image.thumbnail] : [])];',
    '    const url = candidates.find(value => {',
    '      try {',
    '        const pathname = new URL(value).pathname.toLowerCase();',
    '        return statusGalleryExtensions.some(extension => pathname.endsWith(extension));',
    '      } catch { return false; }',
    '    }) ?? "";',
    '    return url ? [{ title: image.title, url }] : [];',
    '  });',
    '  setLocalVar(`char_info.profiles[${JSON.stringify(npcName)}]`, {',
    '    schema_version: 2,',
    '    ...(profile.coverUrl ? { cover_url: profile.coverUrl } : {}),',
    '    gallery: profile.gallery.map(image => ({ title: image.title, sources: image.sources, ...(image.thumbnail ? { thumbnail: image.thumbnail } : {}) })),',
    '  });',
    '  if (profile.avatarUrl) {',
    '    setLocalVar(`status.externalAvatars.partners[${JSON.stringify(npcName)}].url`, profile.avatarUrl);',
    '  }',
    '  setLocalVar(`status.externalGalleries.partners[${JSON.stringify(npcName)}].images`, statusGalleryImages);',
    '}',
    '_%>',
    '<%# char-info-ejs-builder:end:v2 %>',
  ].join('\n');
}

const TRUSTED_GALLERY = 'https://i.ibb.co/YTpkjhVt/file-00000000e0bc81fda16e63b1a9c1ba24.png';
const trustedBlock = charInfoBlock([TRUSTED_GALLERY]);

// A trusted CharInfo media block produces no yellow audit signal at all.
const trustedReport = check(trustedBlock);
assert.equal(mediaAh2(trustedReport).length, 0, JSON.stringify(trustedReport.findings));
assert.equal(rules(trustedReport).some(rule => ['U2', 'U3', 'U4', 'U5'].includes(rule)), false, JSON.stringify(trustedReport.findings));
count += 2;

// The collector sees the same trusted media through the shared policy.
const charInfoRecords = collectProjectExternalLinks({
  worldbookEntries: [{ content: trustedBlock }],
});
const charInfoMediaRecords = charInfoRecords.filter(record => record.source === LINK_SOURCE.CHARINFO_MEDIA);
assert.ok(charInfoMediaRecords.length > 0, JSON.stringify(charInfoRecords));
assert.ok(charInfoMediaRecords.every(record => record.trust === LINK_TRUST.TRUSTED));
count++;

// A mixed gallery keeps the warning.
const mixedBlock = charInfoBlock([TRUSTED_GALLERY, 'https://untrusted.example/portrait.png']);
const mixedReport = check(mixedBlock);
assert.ok(mediaAh2(mixedReport).length > 0, JSON.stringify(mixedReport.findings));
count++;

// A trusted-only candidate set no longer raises AH2, in and out of CharInfo.
for (const source of [
  'const fallback="https://files.catbox.moe/fallback.png"; const profile={avatarUrl:runtimeTarget};',
  'const one="https://files.catbox.moe/a.png"; const two="https://i.ibb.co/b.webp"; const profile={avatarUrl:runtimeTarget};',
  'const urls = {one:"https://files.catbox.moe/a.png",two:"https://files.catbox.moe/b.png"}; image.src = urls[mood];',
]) {
  const report = ejs(source);
  assert.equal(mediaAh2(report).length, 0, `${source} -> ${JSON.stringify(report.findings)}`);
  assert.equal(report.audit, 'green', `${source} -> ${JSON.stringify(report.findings)}`);
  count++;
}

// Undeterminable target keeps AH2.
assert.equal(mediaAh2(ejs('const profile={avatarUrl:runtimeTarget};')).length, 1);
assert.equal(mediaAh2(ejs('const img=document.createElement("img"); img.src=runtimeTarget;')).length, 1);
count += 2;

// Code injected into a trusted block must not inherit the block's trust.
const injected = trustedBlock.replace(
  '\n}\n_%>',
  '\n  const injectedImage = document.createElement("img");\n  injectedImage.src = runtimeTarget;\n}\n_%>',
);
const injectedReport = check(injected);
assert.ok(
  injectedReport.findings.some(
    finding =>
      finding.ruleId === 'AH2' &&
      finding.riskEvidence?.usage === 'media' &&
      String(finding.riskEvidence?.expression || '').includes('runtimeTarget'),
  ),
  JSON.stringify(injectedReport.findings),
);
count++;

// ---------------------------------------------------------------- severity matrix

const severityCases = [
  ['https://random-host.example/page', 'U2'],
  ['http://random-host.example/page', 'U3'],
  ['https://203.0.113.9/page', 'U4'],
];
for (const [url, expected] of severityCases) {
  assert.ok(rules(ejs(`const x = "${url}";`)).includes(expected), url);
  count++;
}

// A trusted media host is not a free pass when the user is navigated to it.
const navigated = ejs('window.open("https://files.catbox.moe/a.png");');
assert.ok(rules(navigated).includes('U2'), JSON.stringify(navigated.findings));
count++;

console.log(`external-link policy matrix: ${count} assertions passed`);
