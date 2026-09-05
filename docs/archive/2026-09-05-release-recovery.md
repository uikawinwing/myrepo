# Creative Workshop 2.0.13 Release Recovery — Archive

Status: **completed**  
Date: 2026-09-05

This is a historical recovery/cleanup record, not an active handover.

## Final production release state

```text
Owner repo: AkabaneSaki/myrepo
Owner main: 3e1587976ef7af7400daf1478c2e9bb031d5a6af
PR: #12
Immutable tag: 2.0.13
Production Worker: poemofdestinycreativeworkshop
Production Worker Version ID: 6acb0595-8fbf-4b13-8c66-e0305b1e18e6
Wrangler profile: akabane-prod
```

Fork `origin/main` and the then-current `origin/staging` were synchronized to the owner release after PR #12.

## Release contents preserved

The reconciled 2.0.13 release line included, among other Workshop changes:

- canonical `latestApprovedAt` publish/display/sort semantics;
- rejected-project one-time reminder;
- admin `expectedRevision` review protection wiring;
- authenticated pending/review cover preview;
- mobile Workshop exit positioning fixes from the old release line;
- OAuth wildcard-token hardening so JWT/user data is not delivered via `postMessage(..., '*')`;
- Creative Workshop client self-version handshake and conditional update reminder;
- migration/index work associated with the release.

AutoDialogueBeautifier was intentionally not changed by the Creative Workshop 2.0.13 release integration.

## Recovery/integration path

The old dirty release work was reconciled through a clean integration line rather than force-merging the dirty worktree:

```text
historical release work
→ clean integration worktree/branch
→ preserve only still-needed patches
→ PR #12
→ owner main 3e15879
→ immutable tag 2.0.13
→ production deploy from exact owner-main commit
```

Important integration commits included:

```text
98e0c20  OAuth wildcard-token hardening
38fc08a  client version 2.0.13 handshake
```

GitHub Actions also produced generated-bundle normalization commits during the integration process.

## Old branch cleanup conclusions

Several old local/fork branches were audited as already contained, patch-equivalent, or functionally obsolete and were deleted/marked for deletion rather than merged wholesale.

Examples from the recovery audit included old upload-modal/test/recovery/frontend branches and `cw-test-transfer-20260903-1250`, whose unique test commit was functionally superseded by later code.

A key safety lesson from the cleanup:

- never merge an old branch just to make it disappear;
- refresh owner main first;
- inspect unique commits/patch equivalence;
- cherry-pick/recreate only still-needed work;
- preserve unrelated dirty user edits before branch/worktree cleanup.

## Primary dirty worktree caveat

`C:\Project\myrepo-git` remained on historical branch `release-cw-20260904` with unrelated/local dirty work after the release was reconciled elsewhere. It was intentionally not reset or deleted.

The temporary integration worktree `C:\Project\myrepo-integration-20260905` later continued as a safe staging/integration workspace. It is not intended to become a permanent second project directory and should be removed once unique untracked artifacts are migrated and the primary worktree is safely returned to a current branch.

Before final cleanup, the old primary worktree also contained an uncommitted `cloudflare/package.json` helper diff adding `deploy:prod-profile`, `check:prod-profile`, and a pnpm `allowScripts` block. These were operational/release-environment helpers rather than Creative Workshop runtime behavior. They were intentionally not carried forward into the staging source tree because the current SOP already requires explicit verified production-profile commands and the staging package manifest does not need those historical local helpers.

The old `src/CreativeWorkshop/index.ts` dirty diff contained two different things: a genuine prior mobile close-button placement intent and unfinished `mobileExitArmed` timer/state code. The positioning intent was preserved in `docs/plans/workshop-persistent-session.md` as historical UX evidence; the unfinished arm-state code was treated as dead experimental state and intentionally not carried forward.

## Workflow decision established afterward

The project moved to an explicit staging acceptance gate:

```text
task branch
→ origin/staging
→ staging Worker
→ Master acceptance
→ owner PR / owner main
→ production Worker
```

Git branch state and Cloudflare runtime state must be reported separately.

The detailed current SOP lives in `AGENTS.md` and `docs/GIT-WORKFLOW.md` on the current staging line; this archive should not be used as live workflow instructions.
