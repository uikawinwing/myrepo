import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeDetailModalRenderScript } from '../src/pages/home/render/detail-modal.ts';

// P2: the canonical external-link source enum must never reach the page.
// The mapping lives in the presentation layer only; the enum stays English and
// no logic may depend on the Chinese labels.

const script = readFileSync(new URL('../src/pages/home/render/detail-modal.ts', import.meta.url), 'utf8');

// Every enum value the collector can emit must have a user-readable label.
const expectedLabels = {
  description: '简介',
  precautions: '注意事项',
  discordThreadUrl: 'Discord 讨论帖',
  worldbook: '世界书',
  regex: '正则',
  charInfoMedia: '角色立绘',
  ejs: 'EJS',
};

for (const [source, label] of Object.entries(expectedLabels)) {
  assert.ok(
    script.includes(`'  ${source}: "${label}",'`),
    `missing label for ${source} -> ${label}`,
  );
}
assert.ok(script.includes('function externalLinkSourceLabel('), 'label resolver missing');
assert.ok(script.includes('externalLinkSourceLabel(entry)'), 'labels are not applied to sources');

let count = Object.keys(expectedLabels).length + 2;

// An unmapped source must degrade to a readable phrase, never to a raw enum.
const rendered = Array.isArray(homeDetailModalRenderScript)
  ? homeDetailModalRenderScript.join('\n')
  : String(homeDetailModalRenderScript);
assert.ok(rendered.includes('EXTERNAL_LINK_SOURCE_LABELS'), 'label table missing at runtime');
assert.ok(rendered.includes('|| "项目内容"'), 'unmapped sources must fall back to a readable label');
count++;

// The enum must not be renamed: the mapping is presentation-only. Compare
// against the enum the policy module actually exports.
const policy = readFileSync(new URL('../src/utils/external-links/policy.mjs', import.meta.url), 'utf8');
const enumBlock = policy.slice(policy.indexOf('export const LINK_SOURCE'));
for (const source of Object.keys(expectedLabels)) {
  assert.ok(
    enumBlock.includes(`: '${source}'`),
    `enum value '${source}' is missing or renamed in LINK_SOURCE`,
  );
}
count += Object.keys(expectedLabels).length;

// The render site prints whatever is in `item.sources`, so the guarantee comes
// from labels being inserted upstream. Assert no internal enum reaches it
// directly, i.e. the source list is never populated from a raw record value.
const renderSite = rendered.slice(rendered.indexOf('external-link-sources'));
assert.ok(
  !renderSite.includes('record?.source') && !renderSite.includes('observation.source'),
  'the render site must not read a raw source value',
);
assert.ok(rendered.includes('externalLinkSourceLabel(entry)'), 'labels must be applied before rendering');
count++;

console.log(`external-link source labels: ${count} assertions passed`);
