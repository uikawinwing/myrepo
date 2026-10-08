# Poem Workshop Documentation Index

> **Canonical branch:** `origin/documentation`  
> **Status:** active index  
> **Purpose:** tell humans and agents which shared document to read, why it exists, and which issue tracks its state  
> **Related issue:** `uikawinwing/myrepo#27`, `uikawinwing/myrepo#46`

Shared documentation is maintained only on the canonical documentation line. Ordinary code/task branches should not maintain their own `docs/` copy.

## How to use this index

1. Refresh `origin/documentation`.
2. Read this index from the refreshed ref.
3. Read only the documents relevant to the current task.
4. Treat `archive/` as history, never as current instructions.
5. When changing shared docs, branch from refreshed `origin/documentation` and merge back there. Code tasks instead start from immutable `upstream/main` and test one pinned SHA at a time on the Master Staging Worker; legacy `origin/staging` is frozen (#46).

## Active / normative documents

| Name | Purpose | Audience | When to read | Status | Related issue(s) |
| --- | --- | --- | --- | --- | --- |
| `AGENT-POLICY.md` | Normative continuous Worker delivery/Git/worktree/deployment/documentation rules | Agents and automated sessions | Every repository session that may mutate code/Git/docs/runtime | **Normative** | `uikawinwing/myrepo#27`, `uikawinwing/myrepo#46` |
| `GIT-WORKFLOW.md` | Human-readable candidate staging and exact-SHA continuous delivery workflow | Human maintainers | Git/branch/worktree/PR/release housekeeping | Active guide; non-normative when conflicting with Agent Policy | `uikawinwing/myrepo#27`, `uikawinwing/myrepo#46` |
| `WORKSHOP-RELEASE-SOP.md` | Creative Workshop continuous Worker/Web delivery vs Client SemVer model | Release owners and agents handling tags/deploys | Client SemVer release, candidate→production promotion, production hotfix | Active domain SOP | release-specific issue + `uikawinwing/myrepo#46` for delivery model |
| `EJS-COMPATIBILITY-STANDARD.md` | Current Upload Gate/Audit Center EJS + Regex compatibility/risk contract | Creators plus checker/audit maintainers | Checker, upload validation, audit-center changes | Active normative domain standard | `uikawinwing/myrepo#12`, `uikawinwing/myrepo#23`; historical `AkabaneSaki/myrepo#37` |

## Maintained audits / references

| Name | Purpose | Audience | Status | Related issue(s) |
| --- | --- | --- | --- | --- |
| `audits/workshop-architecture.md` | Stable architecture boundaries and “where to look first” maintenance map | New maintainers and agents orienting in the codebase | Maintained reference | none — standing architecture reference |
| `audits/config-hardcode.md` | Decide which values belong in shared config vs implementation code | Maintainers touching config or hardcoded constants | Maintained audit/reference | `uikawinwing/myrepo#23` for external-link policy cleanup; `uikawinwing/myrepo#27` for docs migration |

## Active plans

| Name | Purpose | Audience | Status | Related issue |
| --- | --- | --- | --- | --- |
| `plans/cover-image-delivery.md` | Replace wsrv-first cover delivery with a long-term public asset path | Maintainers planning cover/R2 infrastructure work | Active; revalidated 2026-10-07 | `uikawinwing/myrepo#28` |
| `plans/workshop-persistent-session.md` | Keep one Workshop iframe/session alive across close/reopen to avoid repeated initialization | Client-runtime maintainers | Design complete; not implemented; revalidated 2026-10-07 | `uikawinwing/myrepo#29` |

## Archived implementation / audit records

These are evidence only. Their branch/SHA/runtime statements describe the date recorded.

| Name | Purpose | Related issue(s) |
| --- | --- | --- |
| `archive/2026-10-ejs-checker-v2-implementation.md` | EJS Checker v2 implementation/differential/acceptance record | `uikawinwing/myrepo#12`; historical `AkabaneSaki/myrepo#37` |
| `archive/2026-09-05-creator-capability-audit.md` | Historical creator-capability audit | historical findings; see embedded issue references |
| `archive/2026-09-05-release-recovery.md` | 2.0.13 recovery/release record | historical owner PR #12; no dedicated current issue |
| `archive/2026-09-07-workshop-p0-p1-closeout.md` | P0/P1 closeout and production record | historical owner issues listed inside |
| `archive/2026-09-08-workshop-p2.md` | P2 historical snapshot | historical milestone/issues listed inside |
| `archive/2026-09-client-version-handshake.md` | 2.0.13 client-version handshake release record | historical owner PR #12 |
| `archive/ai-sessions/2026-09-09-documentation-cleanup-plan.md` | Old AI-session docs cleanup handoff | none — historical session record |
| `archive/ai-sessions/2026-09-10-mobile-diagnostics-handover.md` | Old mobile diagnostics handoff | none — historical session record |
| `archive/review-evidence/*` | One-time reviewer evidence captured for historical review | see file header/index entry; never current policy |

## Machine-readable/supporting artifacts

- `ejs-checker-v2-differential.json` — machine report paired with the archived Checker v2 implementation record. It is evidence, not policy.

## Maintenance rules

- Plans and reports must state related issue(s); use `none — <reason>` only when a tracker would add no value.
- Every active document must state purpose, status, audience, and when-to-read (or the index column that carries it); do not rely on a reader guessing who a document is for.
- When a plan is completed, cancelled, or superseded, update/close its issue and move the document to `archive/`.
- Do not write current branch/SHA/deployment state into maintained references unless the document is explicitly a dated historical record.
- Prefer links to the owning code/config/schema/test rather than copying fast-changing lists.
