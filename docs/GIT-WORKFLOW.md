# Git / Release SOP

This repository uses a fork-first development workflow. Git repository ownership and production runtime infrastructure are separate concerns.

## 1. Canonical topology

| Purpose | Repository | Remote |
| --- | --- | --- |
| User development fork | `https://github.com/uikawinwing/myrepo.git` | `origin` |
| Owner / canonical repository | `https://github.com/AkabaneSaki/myrepo.git` | `upstream` |

Branch meaning:

- `upstream/main` = canonical owner / production source branch.
- `origin/main` = synchronized mirror of `upstream/main`.
- `origin/main` is not a task-development branch.
- Temporary work happens on `fix/*`, `feature/*`, `hotfix-*`, or another short-lived branch in the user fork.

Never infer repository ownership from a remote name. Verify URLs before the first remote operation of every session.

## 2. Runtime / infrastructure boundary

The user fork is a Git code fork only.

It does **not** mean the fork owns or uses the owner's:

- Discord bot,
- Discord OAuth application/configuration,
- Cloudflare Worker,
- D1 database,
- KV/R2 resources,
- production secrets,
- production bindings.

Production Cloudflare and Discord configuration is a separate environment and must be verified independently before deployment or permission changes.

Important consequences:

- Pushing code to `origin` does not deploy production.
- A GitHub fork does not inherit production secrets or Cloudflare/Discord ownership.
- Do not copy, infer, or substitute owner production credentials from the user fork.
- Before production deployment, verify the exact Cloudflare account/profile, Worker, D1/resources, and relevant Discord/OAuth environment.

## 3. Start-of-session preflight

Before commit, merge, push, tag, PR preparation, deploy, or branch cleanup:

```powershell
git status -sb
git branch --show-current
git remote -v
git fetch upstream main:refs/remotes/upstream/main
git branch -vv
```

Confirm all of the following:

1. current branch,
2. dirty/clean working tree,
3. `origin` = `uikawinwing/myrepo`,
4. `upstream` = `AkabaneSaki/myrepo`,
5. `upstream/main` has been freshly updated,
6. exact files that belong to the current task.

Do not rely on `FETCH_HEAD` alone as proof that `upstream/main` is current.

If any item is unclear, stop before publishing or deploying.

## 4. Keep the fork main synchronized

The fork `main` should mirror owner `main`.

Normal sync direction:

```text
upstream/main
    ↓
origin/main
```

Do not develop features directly on `origin/main`.

If the fork main is behind and has no intentional unique work, update it from refreshed `upstream/main` using a normal fast-forward-safe workflow. Never force-push either main branch just to make history look clean.

## 5. Normal feature / fix workflow

```text
refresh upstream/main
→ sync origin/main if needed
→ create task branch from upstream/main
→ implement
→ test + review
→ stage explicit files only
→ commit
→ push task branch to origin (user fork)
→ PR: uikawinwing:<task-branch> → AkabaneSaki:main
→ owner merges PR
→ sync origin/main again
→ delete task branch locally and from origin
```

Recommended temporary names:

- `fix/<short-name>-YYYYMMDD`
- `feature/<short-name>-YYYYMMDD`
- `hotfix-<short-name>-YYYYMMDD`
- `release-<area>-YYYYMMDD`

Do not normally create task branches directly in the owner repository.

## 6. Production hotfix workflow

Normal production order is:

```text
1. Refresh upstream/main
2. Create hotfix branch from upstream/main
3. Implement
4. Test
5. Review
6. Commit exact hotfix files
7. Push hotfix branch to origin
8. PR origin hotfix branch → upstream/main
9. Merge PR into owner main
10. Deploy the exact merged owner-main commit
11. Verify production
12. Re-sync origin/main
13. Delete hotfix branch locally and from origin
```

A successful Cloudflare deploy does **not** mean GitHub is synchronized.

A successful PR merge does **not** mean production has been deployed.

Both states must be reported separately.

### Emergency exception

Do not deploy a dirty working tree unless the user explicitly asks for an emergency exception.

If an emergency deploy happens before the normal PR flow finishes, the task is not complete until the exact deployed code is:

- committed,
- pushed to the user fork,
- reconciled through a PR or equivalent owner-main integration,
- verified against production.

## 7. Safe commits in a dirty workspace

Use explicit paths:

```powershell
git add path/to/file1 path/to/file2
git diff --cached
git commit -m "..."
```

Do not use:

```powershell
git add .
```

unless the entire working tree has intentionally been reviewed as one task.

Unrelated local edits must remain unstaged and untouched.

## 8. Old branch cleanup SOP

Classify every old branch against refreshed `upstream/main`.

### A. Required changes already in `upstream/main`

Safe to delete after verification.

### B. Still-needed unique work, cleanly integratable

Move only the needed commits into a clean task branch based on refreshed `upstream/main`, push that branch to the user fork, and use the normal PR flow.

### C. Conflicts with current owner main

Do not merge the whole old branch just to clean it up.

Inspect unique commits and cherry-pick/recreate only still-needed work onto a clean branch based on `upstream/main`.

### D. Obsolete test/recovery branch

Record that its unique work is obsolete, then delete it.

For uncertain branches, preserve dirty work first and test from refreshed `upstream/main` on a disposable audit branch:

```powershell
git merge --no-commit --no-ff <branch-or-sha>
```

Then abort immediately:

```powershell
git merge --abort
```

Restore the original working state afterward.

## 9. Branch lifetime policy

Long-lived:

- owner `main`,
- fork `main`,
- `staging` only if it is actively used as a real staging environment.

Temporary and expected to be deleted:

- `fix/*`,
- `feature/*`,
- `hotfix-*`,
- `release-*`,
- `cw-test-*`,
- `cw-staging-*`,
- `recovery-*`.

Temporary branches are workspaces, not archives.

## 10. Push / PR safety

Before any push:

1. verify remote URL,
2. verify exact source commit/branch,
3. verify destination branch,
4. verify no unrelated files are included,
5. never force-push `origin/main` or `upstream/main`.

Normal publishing target for task branches is the **user fork (`origin`)**.

Normal integration target is a PR into **owner `main` (`upstream/main`)**.

If a push is rejected as non-fast-forward, do not guess who changed the branch. First inspect local tip, remote tip, and ancestry. Do not attribute the change to another person/session without evidence.

## 11. Cloudflare / Discord production checklist

Before production deploy:

- exact code commit is known,
- owner `main` contains the intended change unless explicitly using an emergency exception,
- tests are green,
- production Cloudflare account/profile is verified,
- Worker name and bindings are verified,
- D1 migration order is correct,
- production Discord/OAuth environment is verified when relevant,
- no assumption is made that the user fork carries production secrets/configuration.

After deploy:

- verify Worker deployment success,
- verify critical endpoint/UI behavior,
- record Worker/version information when useful,
- record the exact Git commit deployed,
- confirm owner `main` contains that commit,
- sync fork `main` afterward.

## 12. End-of-session report

Every Git/release task ends with:

```text
Current local branch:
Commit SHA(s):
Pushed to user fork:
PR / owner integration status:
Owner main contains change: yes/no
Production deployed: yes/no
Production environment verified: yes/no/not-applicable
Fork main synchronized: yes/no
Remaining temporary branches:
Remaining unrelated local changes:
```

If owner `main` does not contain a production change, or if the deployed code does not map to a known commit, state that explicitly. The task is not fully reconciled.

## 13. Default principle

Use the user fork for development and the owner repository for reviewed integration.

Treat Git state and runtime infrastructure state as separate systems that must both be verified explicitly.
