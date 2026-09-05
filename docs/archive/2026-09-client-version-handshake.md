# Creative Workshop Client Version Handshake — 2.0.13 Archive

Status: **implemented, merged, tagged, deployed**

This document is a historical decision/release record. It is not an active implementation plan.

## Release record

```text
Owner main: 3e1587976ef7af7400daf1478c2e9bb031d5a6af
PR: #12
Owner tag: 2.0.13
Production Worker: poemofdestinycreativeworkshop
Production Worker Version ID: 6acb0595-8fbf-4b13-8c66-e0305b1e18e6
Production profile: akabane-prod
```

The feature was implemented on the integration line as `38fc08a` and reached owner main through PR #12.

## Why it exists

Before 2.0.13, the Workshop page could show an update reminder but did not know which Creative Workshop script version was actually loaded inside SillyTavern.

The existing bridge handshake only proved that the bridge was connected.

2.0.13 added a client self-version to the existing handshake, allowing the Workshop page to compare:

1. **client self-version** — the Creative Workshop JS bundle currently loaded in SillyTavern;
2. **advertised release version** — the stable release the page wants users to use.

These are intentionally separate from project/content versions.

## Shipped behavior

Expected policy:

| Client | Advertised release | Reminder |
| --- | --- | --- |
| legacy client with successful handshake but no version | 2.0.13 | show |
| 2.0.12 | 2.0.13 | show |
| 2.0.13 | 2.0.13 | hide |
| 2.0.14 | 2.0.13 | hide |
| 2.0.13 | 2.1.0 | show |
| malformed resolved client version | 2.0.13 | show |
| handshake unresolved / standalone page | 2.0.13 | hide until reliable client identity exists |

Important compatibility decision: old 2.0.12 already answers the bridge handshake but does not include `clientVersion`. A successful handshake with a missing version is therefore classified as legacy/outdated, allowing 2.0.12 users to receive the 2.0.13 reminder without modifying or retagging 2.0.12.

## Architecture decision

The version travels through the existing bridge handshake. No new HTTP endpoint, D1 field, or polling loop was added for this feature.

The client self-version has one dedicated source in the Creative Workshop client bundle and is included in `bridge:handshake:ok`.

The browser Workshop state records whether version resolution has completed and stores the resolved client version when available.

The update notice is rendered conditionally based on numeric `X.Y.Z` comparison rather than string comparison.

Fail-safe behavior:

- resolved missing/invalid client version -> treat as legacy and show reminder;
- invalid advertised release configuration -> hide reminder and warn, rather than telling every user to update;
- unresolved bridge -> hide reminder to avoid warning flash;
- newer client than advertised release -> do not tell user to downgrade.

## Version policy after 2.0.13

Use immutable release tags.

For a future stable release such as `2.0.14`:

1. bump the Creative Workshop client self-version;
2. build and validate;
3. merge the intended release through the normal staging/owner flow;
4. create the immutable owner tag on the final merged owner-main commit;
5. update the advertised release version/import to the same tag;
6. deploy the exact owner-main release commit;
7. verify old client -> reminder, current/newer client -> no reminder.

Never move or rewrite an already published release tag simply to change CDN-served bytes.

## What this feature does not solve

The handshake does not replace cache/versioning policy for project content or jsDelivr/browser cache invalidation.

It only answers: **which Creative Workshop client script actually loaded?**

If stale bytes load and identify themselves as an older client, the reminder can correctly detect that situation, but stale-cache prevention remains a separate concern.

## Validation at release

Release verification covered the relevant root build, browser-script/home smoke behavior, TypeScript, Creative Workshop syntax, and production Worker dry-run before deployment.

The full pre-implementation planning notes that used to live in `.ai-bridge/client-version-update-reminder-plan.md` were retired after the feature shipped; Git history and this archive record are the intended long-term references.
