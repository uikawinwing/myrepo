# Repository Agent Policy

> **Canonical location:** `origin/documentation:docs/AGENT-POLICY.md`  
> **Status:** active / normative  
> **Purpose:** repository-wide operating rules for agents and automated sessions  
> **Related issues:** `uikawinwing/myrepo#27`, `uikawinwing/myrepo#46`

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

- `origin` = `https://github.com/uikawinwing/myrepo.git` (fork, task branches, legacy preservation, documentation).
- `upstream` = `https://github.com/AkabaneSaki/myrepo.git` (Owner production code).

Canonical refs:

- **Worker/Web/Client code baseline:** refreshed `upstream/main` at a recorded full Git SHA.
- **Shared documentation source of truth:** `origin/documentation`.
- **Legacy historical integration ref:** `origin/staging` is frozen for new feature integration; it is **not** a development baseline, deployment source of truth, or future release container.
- **Historical staging backup:** `origin/backup/staging-pre-continuous-delivery-20261008` must be preserved until explicit retention/cleanup approval.

`origin/main` may be a fork mirror but is not the production baseline. Local branch names, workspace HEAD, and old worktree content do not override the explicit remote refs. Never infer the currently deployed code from a Git ref alone; verify Cloudflare deployment identity separately.

**Related migration:** `uikawinwing/myrepo#46`. The two Worker environments remain Production and Master Staging; a staging **runtime** does not imply a permanent staging **Git branch**.

## 3. Continuous Worker/Web delivery

**Worker/Web changes ship continuously; the SillyTavern Client is released by SemVer when a client artifact/release is actually required.** A feature number in an Issue is not a mandatory Worker integration train.

Normal independent task:

```text
refresh upstream/main and origin/documentation
→ resolve immutable upstream/main SHA
→ create one short-lived task branch/worktree from it
→ implement and test only the Issue or explicit dependency cluster
→ check compatibility, D1 cost/schema, security and rollback
→ candidate deployment to the Master Staging Worker from that exact task SHA
→ staging smoke / Master acceptance
→ Owner PR into upstream/main; review/CI; merge
→ deploy the exact approved merged Owner-main SHA to Production
→ verify live Worker identity, response and rollback path
→ close Issue when acceptance passes; clean task branch/worktree
```

- A Worker/Web-only, backwards-compatible change can ship independently with **no client tag**.
- If an ST bridge/install-state contract is breaking, use an explicit client release lane (for example `release/2.3-client`) and planned compatibility cutover; do not quietly push it as a Worker-only issue.
- A Production incident also starts from fresh `upstream/main`, uses a scoped hotfix branch, and goes through the same guarded exact-SHA production approval/deploy path. **Do not forward-port into old `origin/staging`.**
- Do not mix unrelated work, batch all future features into a pseudo-2.3.0 branch, or merge old staging wholesale.
- Cloudflare D1/R2 schema/data operations require their own proven safety gates; a Git merge does not authorize DB changes.

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

Before commit, PR, merge, push, tag, deployment, branch deletion, worktree cleanup or other repository mutation:

1. Check actual repository/worktree/branch/HEAD and staged, unstaged and untracked state.
2. Verify remote URLs and refresh the **relevant canonical ref** (`upstream/main` for code; `origin/documentation` for docs).
3. Record the full SHA of the source and target; never resolve to the current workspace HEAD implicitly.
4. Confirm unrelated user work will remain untouched, and stage only reviewed paths.
5. For runtime operations, verify **exact Cloudflare account + Worker + D1 + R2** bindings and deployment helper profile.
6. Check D1 cost/migration ledger, source cleanliness, compatibility, rollback, deployment lock and dry-run.
7. Never force-push protected/main refs, bypass managed Cotel Git safety refusals, or switch/deploy dirty worktrees.
8. Treat failed guardrails as blockers, not excuses for ad-hoc Git/Wrangler execution.

The legacy `origin/staging` is refreshed **only to inspect/preserve/retire historical work**, never to start normal code tasks. Documentation changes start from refreshed `origin/documentation` on a separate short-lived docs branch.

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

Compare task code to **`upstream/main`** and docs to **`origin/documentation`**. The old `origin/staging` is not a merge target.

For old staging retirement:

- Maintain a per-work preservation map: already shipped/superseded; independently preserved for future work; intentionally obsolete.
- Preserve unique test-only helpers or optional UX as backup/explicit task, not by blindly porting old implementation.
- Verify any necessary D1 migration is **actually applied on the correct bound database**; never rerun it based only on migration files.
- Keep the verified historical backup and do not reset, force-push or delete the legacy remote branch until recovery and retention decisions are explicit.
- Do not remove another agent's active/dirty worktrees, temporary branches, or user data as collateral cleanup.

A completed migration Issue can close when the old ref is clearly retired/frozen and preserved, documentation and tooling are current, and the production candidate path is verified. Permanent physical deletion of a preserved ref is **not** required to close the Issue.

## 8. Git state and runtime state are separate

- `upstream/main` = production code source and baseline for **all new tasks**.
- `origin/documentation` = authoritative policy/documentation.
- `origin/staging` = frozen historical branch, **not** today's staging runtime.
- **Master Staging Worker** = isolated Cloudflare test runtime for **one exact task SHA / dependency cluster at a time**.
- Production Worker = live Cloudflare runtime, deployed only after Owner merge and protected preflight.

Report Git source SHA, Cloudflare account/Worker/bindings, deployment/version ID, validation and rollback separately. Never claim the staging runtime contains all future Issue branches or that a newer deployment timestamp implies a newer code baseline.

## 9. Master Staging runtime invariant

Master Staging is a **serial, disposable candidate runtime**, not a Git integration branch.

```text
one accepted candidate task SHA (based on upstream/main)
→ locked deploy-helper CheckOnly / cost + DB + target identity gates
→ candidate deployment
→ HTTP/functional/security smoke and Master acceptance
→ Owner PR / merge
→ exact approved Owner-main production deployment
```

- Parallel coding is allowed; **shared Master Staging deployments and Production promotions are serialized**.
- Record the previous Cloudflare deployment/version as the rollback target before changing a Worker.
- Confirm Master Staging **Johnjohnson67076 / poemofdestinycreativeworkshop-master-staging** identity via actual binding/profile checks; never substitute the obsolete AkabaneSaki `-staging` Worker.
- No generic feature deployment to Production from a task branch.
- A shared staging environment may briefly test a non-merged candidate; it must not be mistaken for a permanent source line or accumulate unrelated features.
- Changing a database or relaxing reviewer permissions is not authorized by passing a Web-only pilot.

## 10. Deployment contract

**Versioned generic helper source** is tracked in `scripts/deployment/` (Owner PR #102). Its authorized machine-installed entry point and target profiles live under `.cotel/local/one-click-deploy/`; do not commit machine credentials or infer that a source merge has installed a profile.

All Worker deployments go through the existing **fail-closed, lock-aware helper**:

1. Identify the exact intended account/Worker/D1/R2 and permitted remote task branch or Owner main.
2. Pin a **full 40-character immutable source SHA**, verify branch resolution, allowed ancestry and clean checkout.
3. Run `CheckOnly`, CI/tests, D1 cost gate, migration ledger check and Wrangler dry-run; confirm rollback target.
4. For Master Staging, use only the explicitly authorized candidate target/profile.
5. For Production, require the exact **merged Owner-main SHA**, approved target and deployment safety checks.
6. After deploy, inspect actual Cloudflare version/bindings, expected public behavior and preserved previous deployment.
7. Restore original checkout and release locks; separately clean task branches/worktrees after verification.

Never bypass a failed guardrail with ad-hoc `wrangler deploy` or swap credential/profile to make a check pass. Source code in `scripts/deployment/` and installed helper/profile **must be checked for drift** before use. Historical `origin/staging` must not remain the default allowed candidate source.

## 11. Infrastructure boundary

Git hosting and runtime infrastructure are separate.

The user fork does not imply ownership of production Cloudflare, Discord/OAuth, D1, KV, R2, secrets, or bindings.

Never infer runtime ownership from Git remote ownership. A Git push is not a deployment.

## 12. Release/version policy

Creative Workshop release semantics live in `origin/documentation:docs/WORKSHOP-RELEASE-SOP.md`:

- Worker/Web: continuous, exact-SHA deployed, **no Worker SemVer** and no forced ST tag.
- ST Client: intentional SemVer releases; breaking Bridge/install-state changes use an explicit release lane and compatibility checks.
- Latest client support baseline is read from `config/workshop.json`; do not invent literal live version numbers in policy.

Related Issue: `uikawinwing/myrepo#46`.

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
