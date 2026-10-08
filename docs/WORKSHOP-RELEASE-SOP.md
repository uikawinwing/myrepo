# Creative Workshop Release SOP

Status: **active domain SOP**  
Purpose: define continuous Worker/Web delivery, two Cloudflare runtimes, deliberate ST Client SemVer and production incident rules.  
Related issues: **`uikawinwing/myrepo#46`**, `uikawinwing/myrepo#27`; each real release/incident has its own tracker.  
Last reviewed: **2026-10-08**

**Fundamental rule: Worker/Web ships continuously; SillyTavern Client is released by SemVer.** A Worker deployment does not have a user-facing version. A label such as “2.3.0” on an Issue does not make it part of a long-running staging feature bundle.

## 1. The two Worker environments

- **Production Worker:** currently approved live code, deployed from the **exact reviewed and merged Owner `upstream/main` SHA**.
- **Master Staging Worker:** disposable candidate test runtime. It runs **one independently accepted task/explicit dependency cluster** from an immutable SHA at a time, not a cumulative future version.
- Production and Master Staging have distinct Cloudflare accounts/bindings. Do not infer account/DB identities from Worker names.
- A historical Git branch `origin/staging` may still exist for preservation but is **not** a staging environment or feature integration baseline.
- A deployment log should record SHA, Worker identity, Cloudflare deployment/version ID, backup/rollback target and test evidence. These are internal operational identities, not Worker SemVer.

## 2. Canonical code and task flow

```text
refresh upstream/main + origin/documentation
→ new short-lived task branch/worktree from exact upstream/main SHA
→ implement one compatible Issue or declared dependency cluster
→ validate unit/integration tests, security, D1 read/write cost, schema and rollback
→ deploy exact task SHA to Master Staging through locked fail-closed helper
→ acceptance/smoke and record rollback target
→ Owner PR against upstream/main → review/CI → merge
→ exact merged Owner-main SHA to Production through production-locked helper
→ live smoke/observability and issue closeout
```

Work in parallel, but staging runtime and Production promotions must be serialized. Do **not** merge old `origin/staging` wholesale into Production, and do not forward-port a current fix into that frozen branch. Retain historical backup until explicit cleanup decision.

## 3. Worker/Web-only change

Applies to compatible route/backend work, web UI/CSS, copy, metadata, performance, bounded D1/R2 logic, review UI, and fixes not requiring a new imported ST Client.

- Confirm the existing currently supported ST Client can continue working.
- Gate changed API/security/data paths with tests, exact target binding, D1 cost and rollback review.
- Deploy via the candidate → Owner merge → Production path above.
- **Do not increment, create or require a client SemVer tag** just because Worker/Web changed.
- Keep `client.stable` and `client.staging` unchanged unless a separately approved client release task requires changes.

## 4. Production hotfix

A bug reported against live Workshop is a Production incident. First verify the latest supported ST Client tag from `config/workshop.json`; avoid reopening already fixed old-client bugs.

**Worker/Web-only production hotfix:**

```text
reproduce / isolate on live baseline
→ scoped branch from upstream/main exact SHA
→ tests and rollback gate
→ Owner PR and merge
→ locked deploy of merged main SHA
→ verify Production
→ no ST Client tag, no forward-port into old staging
```

**ST Client hotfix:**

- If users must import new ST code for the fix, prepare a patch release against the current stable client line, build and test the bundle, and create **a new immutable SemVer patch tag**.
- Deploy Worker changes only if this client fix needs a compatible server-side change; protect old clients until the release cutover rule is explicit.
- Refresh the stable client support baseline after release.
- A production-only incident is not a reason to merge old staging or tag all Worker-only work.

## 5. Planned ST Client release / breaking contract

SillyTavern client tags are intentional, not inferred from Worker commits.

- Use a scoped client task/release branch (example `release/2.3-client`) from the current approved code baseline.
- A breaking ST Bridge/install-state protocol change **must** have a documented compatibility/migration plan. Test old and new import clients against compatible server behavior; plan the cutover rather than silently shipping breaking code.
- Build/verify the client artifact and update fields in `config/workshop.json` deliberately, including relevant migration metadata.
- Publish an immutable SemVer tag for the actual imported client artifact, announce its required update/support policy, and update `client.stable`.
- Only ship Worker changes that are explicitly coupled to the client release as a dependency cluster. Independent compatible Worker/Web features continue to ship normally.

A product milestone might choose to deliver multiple accepted features and a new Client tag together. That is a **conscious release decision**, not a perpetual branch collecting all work labelled with that version.

## 6. Version source of truth and support

All actual client version values are read from `config/workshop.json`:

- `client.stable`: latest released supported production ST Client.
- `client.staging`: a client development target, **only when an intentional client release line is active**; not a Worker feature accumulation branch.
- `client.publicPath` / `client.stagingPublicPath`: import bundle paths.
- `client.migrations`: explicit import/client migration metadata.

For normal user support:

1. Check the user's imported ST Client tag.
2. If older than `client.stable`, ask them to update and reproduce first.
3. Investigate as a production bug only if it persists on the supported tag and current Production runtime.
4. Older immutable tags remain for history/rollback; they are not the normal supported baseline.
5. Do not invent a generic `minimumSupportedVersion` field or infer one from a one-off migration `beforeVersion`.

## 7. Deployment gates (all Worker changes)

Before staging or Production deployment:

- Resolve a **full 40-character immutable Git SHA** and verify allowed source/ancestry and clean checkout.
- Verify exact account, Worker script, D1/R2 bindings and trusted machine profile (production and Master Staging are distinct).
- Use the versioned `scripts/deployment/` helper through the installed `.cotel/local/one-click-deploy/` entry point, not direct ad-hoc Wrangler.
- Check active deployment rollback ID, CI/tests, D1 cost gate, pending migrations, schema compatibility, dry-run and any issue-specific security gates.
- For Production specifically, prove the candidate is the **approved merged Owner-main SHA**, not a fork task SHA.
- Perform live HTTP/functional checks after deploy and report actual Worker identity/version/deployment separately from Git state.
- Stop on any failed guardrail. Destructive DB changes and security/approval contract changes are separately gated; do not rely on a Web-only pilot to authorize them.

## 8. Legacy staging preservation

Migration tracker: `uikawinwing/myrepo#46`.

- Historical `origin/staging` changes were audited against newer Production: already shipped, superseded by safer implementation, optional UX, or test-only tooling.
- Do not replay old checker, reviewer token, external-link collector or old migration code into Production.
- Preserve non-shipped unique test tooling and optional UX in the explicit backup/issue map; they are not blockers to adopting continuous delivery.
- The protected historical backup is `origin/backup/staging-pre-continuous-delivery-20261008`. Physical remote branch deletion is a separate retention decision, not an automatic step.
- After policy/docs publication and verified new candidate flow, mark old `origin/staging` **retired / no new writes** even if retained as an inert remote ref. Future code starts from Owner main.

## 9. Release checklists

**Compatible Worker/Web-only release**

```text
[ ] task base = fresh exact Owner main SHA
[ ] targeted tests / compatibility / DB cost / rollback pass
[ ] exact candidate accepted on Master Staging
[ ] Owner PR reviewed and merged
[ ] exact merged Owner-main SHA deployed to Production
[ ] live behavior and deployment binding verified
[ ] no new ST tag
[ ] issue closed and temporary worktrees/branches cleaned safely
```

**ST Client release**

```text
[ ] explicit client change/release scope and compatibility plan
[ ] stable client baseline verified from config/workshop.json
[ ] client artifact built and tested
[ ] bridge/install-state migration and Worker dependencies verified
[ ] reviewed Owner integration and exact-SHA Worker deployment if required
[ ] immutable SemVer client tag published
[ ] config stable/version fields updated and support notice issued
[ ] rollback plan and historical tags preserved
```

**Production urgent incident**

```text
[ ] reproduce on current supported production client + Worker
[ ] scoped change based on exact Owner main
[ ] security/data/DB gates, tests and rollback verified
[ ] merge Owner PR / deploy exact merged source
[ ] live incident behavior rechecked
[ ] tag only if ST Client import actually changed
[ ] no forward-port into frozen old staging
```

## 10. Status reporting

```text
Production ST client: <client.stable from config>
Client release target: <only if a release task exists>
Master Staging candidate: <full code SHA> / <Worker deployment ID>
Production source: <merged Owner-main SHA> / <Worker deployment ID>
D1/R2 bindings: <target identities validated or unchanged>
Canonical policy: <origin/documentation SHA>
Legacy origin/staging: frozen/preserved/retired (never a Worker version)
```

Never say simply “Workshop version updated” without distinguishing ST Client tag, Git commit and Worker deployment.
