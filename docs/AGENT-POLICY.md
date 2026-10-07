# Repository Agent Policy

> **Canonical location:** `origin/documentation:docs/AGENT-POLICY.md`  
> **Status:** active / normative  
> **Purpose:** repository-wide operating rules for agents and automated sessions  
> **Related issue:** `uikawinwing/myrepo#27`

This is the single source of truth for repository operating policy. A copy found in any task worktree, old branch, chat handoff, archive, or generated context is not authoritative.

## 1. Bootstrap and canonical documentation

Shared project documentation lives on the dedicated remote branch:

`origin/documentation`

Ordinary code/task branches must not carry their own maintained `docs/` copy.

At the start of repository work that depends on policy, plans, audits, release procedure, or project documentation:

1. Verify `origin` and `upstream` URLs.
2. Refresh `origin/documentation`.
3. Read `origin/documentation:docs/INDEX.md`.
4. Read this policy.
5. Read only the additional canonical documents that the index says are relevant to the task.

Do not silently fall back to a stale local `docs/` copy.

Documentation changes are made on a short-lived branch/worktree based on refreshed `origin/documentation`, then integrated back into `origin/documentation`. Do not edit shared documentation on feature/fix/refactor/hotfix code branches.

## 2. Canonical Git topology

Remotes:

- `origin` = `https://github.com/uikawinwing/myrepo.git`
- `upstream` = `https://github.com/AkabaneSaki/myrepo.git`

Canonical refs:

- staging code source of truth: `origin/staging`
- production code source of truth: `upstream/main`
- shared documentation source of truth: `origin/documentation`

`origin/main` may exist as a fork mirror. It is not a task-development or production-decision baseline.

Local branches named `main` or `staging` are not authoritative and are not required to exist.

Never substitute the current workspace HEAD, a local mirror, or `mergedIntoWorkspaceHead` for an explicit canonical ref when deciding whether work is current, merged, deployable, or safe to delete.

## 3. Remote-canonical task workflow

The repository follows:

> **Remote canonical, task-branch local.**

Normal feature/fix/refactor/code work starts from refreshed `origin/staging`:

```text
refresh origin/staging
→ create short-lived task branch/worktree from exact origin/staging
→ implement
→ test/review
→ commit only intended files
→ push task branch
→ PR into origin/staging
→ merge
→ refresh origin/staging
→ verify integration
→ cleanup task branch/worktree
```

Do not start ordinary feature development from `upstream/main`.

Production hotfixes start from refreshed `upstream/main`:

```text
refresh upstream/main
→ create hotfix branch/worktree from exact upstream/main
→ implement and validate against production baseline
→ owner PR into upstream/main
→ merge
→ deploy exact approved production source
→ forward-port the logical fix into origin/staging
→ verify both canonical lines
→ cleanup
```

Do not reverse-merge the whole staging feature line into a production hotfix.

## 4. Primary workspace

The primary checkout may use a management-only branch such as `workspace/control`.

It is only for repository/worktree administration. It is not:

- an integration baseline;
- a staging or production branch;
- a feature-development branch;
- a deployment source;
- evidence that another branch is merged.

Do not accumulate product work on it.

## 5. Required preflight before mutation

Before commit, merge, rebase, push, tag, PR preparation, deployment, branch deletion, worktree cleanup, or other repository mutation:

1. Check repository/worktree/branch/HEAD/dirty state.
2. Verify actual remote URLs; do not trust names alone.
3. Refresh the canonical ref relevant to the operation.
4. Compare the task against that explicit canonical ref.
5. Identify unrelated tracked and untracked files.
6. Preserve unrelated user work.
7. Stage explicit reviewed paths only; never use `git add .`.
8. Never force-push `upstream/main` or `origin/main`.
9. Do not use raw Git to bypass a managed Git/Cotel safety refusal.
10. Treat a failed safety check as a blocker to diagnose, not a check to weaken.

For staging code work, refresh `origin/staging`.  
For production code work, refresh `upstream/main`.  
For documentation work, refresh `origin/documentation`.

## 6. Task branch and worktree lifecycle

Task branches are temporary. Typical prefixes include `feature/*`, `fix/*`, `hotfix/*`, `refactor/*`, `docs/*`, `release/*`, and `recovery/*`.

After integration:

1. Refresh the intended canonical target.
2. Verify the required commit or patch-equivalent work is present.
3. Verify the worktree is clean or intentionally preserved.
4. Remove the temporary worktree.
5. Delete the local task branch.
6. Delete the remote task branch when appropriate.

Do not delete a branch only because it is old. Preserve unique work first.

## 7. Merge and cleanup safety

Use the actual target:

- staging task → compare with `origin/staging`
- production task → compare with `upstream/main`
- docs task → compare with `origin/documentation`

If a branch contains uncertain unique work, preserve it before destructive cleanup.

If an old branch conflicts with current code, do not merge it wholesale just to simplify cleanup. Inspect and preserve only still-needed work.

Unrelated backups, dirty files, or user data are never collateral cleanup.

## 8. Git state and runtime state are separate

Use precise terms:

- `origin/staging` = Git staging integration line
- staging Worker = Cloudflare test runtime
- staging site = user-facing site backed by the staging Worker
- `upstream/main` = production Git source
- production Worker = production Cloudflare runtime

Do not say only “staging is updated/ready”. Report Git and runtime states separately.

## 9. Staging runtime invariant

The normal staging Worker must run code already integrated into `origin/staging`.

Normal order:

```text
task branch
→ test/review
→ PR/merge into origin/staging
→ refresh origin/staging
→ record exact SHA
→ deploy exact SHA to staging Worker
→ verify staging site
→ Master acceptance
```

Do not deploy an ordinary task branch directly to the normal staging Worker. Use a separately named preview/temporary Worker for isolated pre-integration experiments.

## 10. Deployment contract

Use the existing fail-closed deployment helper:

- engine: `.cotel/local/one-click-deploy/deploy-worker.ps1`
- profiles: `.cotel/local/one-click-deploy/profiles/*.json`
- compatibility shortcuts under `.cotel/local/`

The helper resolves an allowed remote branch/tag to an exact commit, temporarily switches to that exact source, deploys, and restores the previous checkout.

Local branches named `main` or `staging` are not required for deployment.

Rules:

1. Use the existing helper before considering another deployment path.
2. Prefer profile/source-selector changes over duplicate scripts.
3. Extend the generic helper once if a reusable capability is genuinely missing.
4. Never fall back to ad-hoc `wrangler deploy` because a helper check failed.
5. A failed helper check is a stop signal.
6. Deploy only from a worktree satisfying the helper cleanliness policy.
7. `workspace/control` is not a deployment workspace.

## 11. Infrastructure boundary

Git hosting and runtime infrastructure are separate.

The user fork does not imply ownership of production Cloudflare, Discord/OAuth, D1, KV, R2, secrets, or bindings.

Never infer runtime ownership from Git remote ownership. A Git push is not a deployment.

## 12. Release/version policy

For Creative Workshop release/version semantics, read:

`origin/documentation:docs/WORKSHOP-RELEASE-SOP.md`

Do not duplicate live version numbers in policy prose. Read current values from `config/workshop.json`.

## 13. EJS / Regex checker policy

For checker compatibility and audit rules, read:

`origin/documentation:docs/EJS-COMPATIBILITY-STANDARD.md`

Do not infer current checker behavior from archived implementation reports.

## 14. Cloudflare scope

For work under `cloudflare/` that depends on Cloudflare Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, Workers AI, or Agents SDK behavior/limits:

- retrieve current official Cloudflare documentation before relying on platform APIs, limits, or quotas;
- use the relevant product's current `/platform/limits/` documentation for limits/quotas;
- run `wrangler types` after changing bindings;
- real staging/production deployment still follows the repository deployment-helper contract above; vendor-level `wrangler deploy` is not an alternate project deployment path.

This scoped rule replaces the need for a separate nested `cloudflare/AGENTS.md`.

## 15. User-facing UX language

Treat Workshop users, creators, and admins as non-technical users.

Use plain everyday Chinese. Prefer concrete actions over implementation nouns. Avoid exposing schema/database/internal IDs/registry/fingerprint terminology unless genuinely necessary. Optional inputs must be visibly optional. Errors should tell the user what to do next.

When reviewing a form, first ask whether the field should exist at all; automate or hide unnecessary implementation choices instead of merely renaming them.

## 16. Documentation lifecycle and issue tracking

`docs/INDEX.md` is the documentation catalogue.

Every active plan, audit/report, and implementation record must state:

- status;
- purpose;
- last reviewed/date when relevant;
- related GitHub issue(s), or explicitly `none` with a reason.

Plans without an issue should normally receive one before implementation begins.

Lifecycle:

- current normative/reference material → active docs
- unfinished approved work → `docs/plans/`
- maintained analysis/reference → `docs/audits/`
- completed/superseded implementation reports and historical handoffs → `docs/archive/`

Archive is historical evidence, not current project truth.

## 17. Changing repository policy or shared docs

Shared docs changes must be based on fresh `origin/documentation`.

Do not update a stale docs snapshot carried by a code branch.

After merge, future sessions refresh `origin/documentation` and read the new canonical version.

The root `AGENTS.md` bootstrap should remain tiny and change rarely.

## 18. Session closeout

Before declaring repository work complete, report the relevant state explicitly:

- task branch/worktree;
- commit SHA(s);
- push destination;
- exact canonical ref after integration;
- staging/production deployment state when applicable;
- temporary branches/worktrees that remain and why;
- unrelated local changes intentionally left untouched;
- blockers/follow-up work.

Do not report Git integration and runtime deployment as the same event.

## 19. Default principle

Prefer the smallest safe operation that preserves intended work.

Fix blockers/correctness/safety first. Do not expand scope merely because unrelated cleanup is possible.

When uncertain: inspect, preserve unique work, use the explicit canonical ref, avoid destructive shortcuts, and report the blocker clearly.
