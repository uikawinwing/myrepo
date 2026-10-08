# Git / Candidate Staging / Release Workflow

> **Status:** active human-facing guide  
> **Purpose:** practical, low-maintenance Worker/Web continuous delivery and client release workflow  
> **Related issues:** `uikawinwing/myrepo#27`, `uikawinwing/myrepo#46`  
> **Normative policy:** `origin/documentation:docs/AGENT-POLICY.md`  
> **Last reviewed:** 2026-10-08

If this guide conflicts with canonical Agent Policy, the Agent Policy wins.

## 1. What is canonical?

| Purpose | Source |
| --- | --- |
| Code baseline for **all new tasks**, including features/hotfixes | `upstream/main` (`AkabaneSaki/myrepo`) |
| Shared documentation | `origin/documentation` (`uikawinwing/myrepo`) |
| Task work | short-lived `origin/<task-branch>` from exact `upstream/main` |
| Master Staging | **Cloudflare test Worker**, one pinned candidate SHA at a time |
| Production | **Cloudflare live Worker**, from approved merged Owner-main SHA |
| Historical old staging branch | `origin/staging` — frozen, not a source or merge destination |
| Old staging preservation | `origin/backup/staging-pre-continuous-delivery-20261008` |

`origin/main`, local `main`, local `staging`, and workspace HEAD are not substitutes for refreshed `upstream/main`.

## 2. One Issue → one candidate → Production

```text
read origin/documentation:docs/INDEX.md + AGENT-POLICY.md
→ refresh upstream/main and record immutable 40-char Git SHA
→ create sibling task worktree/branch at that baseline
→ implement the smallest Issue/dependency-cluster change
→ run project tests, checker/audit guards, cost/schema/security/compatibility checks
→ lock and CheckOnly exact candidate SHA for Master Staging
→ deploy to Master Staging (not the historical staging branch)
→ smoke test, confirm Master acceptance, preserve rollback target
→ open Owner PR to upstream/main, review and pass CI
→ merge into Owner main
→ deploy **exact merged Owner-main SHA** to Production with guarded helper
→ verify live Worker/account/bindings/version and user behavior
→ close Issue, remove clean disposable task worktree/branch as appropriate
```

Parallel code tasks are fine. Shared staging deployments and Production promotion are serialized; one candidate must not overwrite another team's active acceptance test.

For a production incident, apply the **same Owner-main baseline, scoped PR, guarded exact-SHA deploy path**. Do not forward-port hotfixes to `origin/staging`.

## 3. Worker/Web versus ST Client

- Worker/Web-only changes with backwards-compatible APIs may ship independently; **no client SemVer tag**.
- ST Client source/bundle changes that users need to import receive an intentional **immutable SemVer tag**.
- Breaking ST Bridge/install-state changes need a deliberate client release lane (e.g. `release/2.3-client`) plus compatibility and migration review; do not silently bundle them into an unrelated Worker change.
- `config/workshop.json` holds current client version data. Do not infer current tags from Issue titles or maintain a Worker version line.

Read `docs/WORKSHOP-RELEASE-SOP.md` for support rules and release checklist.

## 4. Documentation and policy

The sole shared docs source is `origin/documentation:docs/`. To change it:

```text
refresh origin/documentation
→ create short-lived docs branch from that ref
→ modify INDEX and only affected canonical documents
→ review consistency, link to the owning Issue
→ PR/merge back into origin/documentation
→ verify canonical content, retire docs task branch
```

Do not edit canonical docs on an ordinary Worker/Web feature branch. Root `AGENTS.md` stays a **thin pointer** to canonical docs, not a second copy of policy. The fork issue tracker tracks plans/features; Owner issue tracker tracks actual Production bugs and blocker fixes.

## 5. Deployment boundaries

Tracked helper source: `scripts/deployment/` (see Owner PR #102).  
Machine-installed helper/profile: `.cotel/local/one-click-deploy/` (credentials and account-specific bindings must stay local).

Before deployment:

1. Verify Git source branch and **full pinned SHA**, target Worker/account/D1/R2, clean worktree and allowed source ancestry.
2. Confirm the installed helper and tracked source agree; installed profiles retain their reviewed permissions.
3. Use `CheckOnly`, Wrangler dry-run, D1 cost gate and migration ledger (for the actual target database).
4. Record previous Cloudflare deployment/version for rollback.
5. Deploy and verify resulting live Worker identity/bindings/HTTP behavior; restore source checkout and release locks.

Master Staging is **Johnjohnson67076 / poemofdestinycreativeworkshop-master-staging**. Never confuse it with obsolete Owner `poemofdestinycreativeworkshop-staging`.

A `CheckOnly` result is not proof of deployment. Git SHA and Cloudflare deployment/version IDs are different facts. Do not bypass failures with raw `wrangler deploy`, branch switches or profile changes.

## 6. Legacy `origin/staging` retirement

Migration issue: `uikawinwing/myrepo#46`.

- Completed and superseded Worker features in old staging must **not** be re-merged into Production just to simplify cleanup.
- Identify and preserve test-only tools and optional non-essential UX separately (with issue or retained historical backup).
- Preserve `origin/backup/staging-pre-continuous-delivery-20261008`; leave existing remote historical `origin/staging` frozen until explicit retention/deletion decision.
- Never reset, force-push, merge whole old staging, re-run a migration, delete active worktrees or destroy unreviewed user work.
- **Retired as a development baseline** does not mean **physically deleted**. A branch may remain as inert evidence without blocking completion of #46.

## 7. Safe cleanup

Check target `upstream/main` for code or `origin/documentation` for docs. Inspect actual dirty/clean state; verify required work is shipped, patch-equivalent, obsolete with explicit decision, or preserved elsewhere before removing a branch/worktree.

Keep unique or dirty unrelated worktrees intact. Only request managed Git cleanup for reviewed, clean task branches and verify expected refs/SHAs again immediately before branch deletion.

## 8. Release and incident reporting

Report independently:

```text
Code: task branch / exact baseline and merged Owner-main SHA
Staging: Master Worker identity / candidate SHA / deployment ID / tested or unchanged
Production: Worker identity / exact merged SHA / deployment ID / tested or unchanged
Client: latest released SemVer tag if changed, otherwise unchanged
Docs: canonical origin/documentation SHA
Cleanup: remaining preserved branches/backups and specific blockers
```

The stage of a Git PR is never evidence that a Worker is deployed. The age of a runtime deployment is not evidence of newer code.

## 9. Default choice

Prefer one small, compatible and reversible issue over a rolling feature train, redundant helper, new infrastructure, or unbounded DB reads. If a contract or migration is genuinely breaking, document its gate and isolate the release instead of silently weakening protections.
