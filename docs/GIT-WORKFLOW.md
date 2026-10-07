# Git / Staging / Release Workflow

> **Status:** active human-facing guide  
> **Purpose:** explain the repository's remote-canonical Git/worktree/PR flow in practical terms  
> **Related issue:** `uikawinwing/myrepo#27`  
> **Normative policy:** `origin/documentation:docs/AGENT-POLICY.md`

If this guide conflicts with the canonical Agent Policy, the Agent Policy wins.

## 1. Canonical refs

| Purpose | Canonical ref |
| --- | --- |
| Staging code/integration | `origin/staging` |
| Production code | `upstream/main` |
| Shared documentation | `origin/documentation` |

`origin/main` may be a fork mirror. It is not the production source of truth.

Long-lived local `main` / `staging` mirrors are not required.

The primary checkout may sit on `workspace/control`, which is only a management branch. It is not an integration baseline.

## 2. Remote-canonical rule

Before starting a task, refresh the canonical ref you actually need.

Do not assume a local branch is current merely because it is named `main` or `staging`.

Do not use the primary workspace HEAD as proof that a task is merged.

### Normal code task

Normal feature/fix/refactor work starts from:

`origin/staging`

```text
fetch/refresh origin/staging
→ create short-lived task branch/worktree from exact origin/staging
→ implement
→ test/review
→ commit intended files
→ push task branch to origin
→ PR → origin/staging
→ merge
→ refresh origin/staging
→ verify commit/patch is present
→ remove task worktree/branch
```

### Production hotfix

Production-only urgent fixes start from:

`upstream/main`

```text
fetch/refresh upstream/main
→ create hotfix branch/worktree from exact upstream/main
→ implement/test against production baseline
→ owner PR → upstream/main
→ merge
→ deploy exact approved owner-main source
→ forward-port logical fix → origin/staging
→ verify both canonical refs
→ cleanup
```

Do not merge the whole staging feature line back into production merely to carry one hotfix.

## 3. Documentation workflow

Shared docs do not live on ordinary code/task branches.

Canonical docs:

`origin/documentation:docs/`

To read docs:

```text
refresh origin/documentation
→ read docs/INDEX.md from that ref
→ read only the relevant canonical docs
```

To change docs:

```text
refresh origin/documentation
→ create temporary docs task branch/worktree
→ edit docs
→ review
→ PR/merge → origin/documentation
→ cleanup
```

Do not update a stale `docs/` snapshot from a feature/hotfix/refactor branch.

Plans/reports must identify their related GitHub issue(s), or explicitly say why no issue exists.

## 4. Issue tracker split

Use the fork tracker for staging/future work:

`uikawinwing/myrepo`

Typical use:

- future features
- staging UX/enhancements
- experiments
- staging technical debt
- documentation/repository hygiene
- active plans before production

Use the owner tracker for production incidents:

`AkabaneSaki/myrepo`

Typical use:

- production bugs/regressions
- production hotfixes
- production security/privacy/performance incidents
- production release blockers

If work moves from an old owner planning issue into the fork, link the replacement and close the old planning issue when appropriate.

## 5. Git and runtime terminology

These are different states:

- `origin/staging` = Git integration branch
- staging Worker = Cloudflare test runtime
- staging site = test site backed by that Worker
- `upstream/main` = production Git source
- production Worker = live runtime

Do not report only “staging updated” or “staging ready”.

Prefer:

```text
Git:
origin/staging = <sha>

Runtime:
staging Worker deployed Git SHA = <sha>
Worker version = <id>

Production:
unchanged
```

## 6. Staging deployment order

Normal staging order:

```text
task branch
→ tests/review
→ PR/merge into origin/staging
→ refresh origin/staging
→ record exact SHA
→ deployment helper
→ staging Worker
→ staging-site verification
→ Master acceptance
```

Do not deploy an ordinary task branch directly to the normal staging Worker.

If isolated runtime testing is necessary before integration, use a separately named preview/temporary Worker.

## 7. Deployment helper

Use the repository's existing fail-closed helper:

`.cotel/local/one-click-deploy/deploy-worker.ps1`

Target/source policy lives in profiles under:

`.cotel/local/one-click-deploy/profiles/`

The helper:

1. verifies remotes/cleanliness/policy;
2. fetches the selected remote source;
3. resolves an exact commit;
4. temporarily detaches to that commit;
5. deploys;
6. restores the prior checkout.

Therefore local branches named `main` or `staging` are not required.

A helper failure is a blocker to fix, not permission to run ad-hoc `wrangler deploy`.

## 8. Release/version semantics

This document does not duplicate the product release decision tree.

Read the canonical release SOP:

`origin/documentation:docs/WORKSHOP-RELEASE-SOP.md`

In short:

- Worker/runtime changes do not have their own SemVer line.
- Client SemVer belongs to the SillyTavern client artifact.
- Production hotfixes start from exact production source.
- Logical hotfixes are forward-ported into staging.
- Planned staging feature releases follow the planned client release line.

Current live version values come from `config/workshop.json`, not documentation prose.

## 9. Cleanup

Before deleting a task branch/worktree, compare it against the correct canonical target:

- staging task → `origin/staging`
- production task → `upstream/main`
- docs task → `origin/documentation`

A branch is safe to remove only when required work is:

- present as ancestry;
- patch-equivalent;
- intentionally obsolete;
- or preserved elsewhere.

Do not use `mergedIntoWorkspaceHead` alone when the workspace HEAD is `workspace/control` or another unrelated branch.

Do not delete unrelated backups or dirty files while cleaning Git worktrees.

## 10. Session closeout

For work that changed repository/runtime state, report:

- task branch/worktree;
- created commit SHA(s);
- push destination;
- exact canonical ref after integration;
- runtime deployment SHA/version if deployed;
- whether owner main contains the change;
- remaining temporary branches/worktrees and why;
- unrelated local changes intentionally left untouched;
- blockers/follow-up work.

Git merge and runtime deployment are separate events.
