# Runtime Skill Market Search and Exact Install

## Recall

### User request

- 检查是否存在由 Skill Market 提供的运行时 Skill 搜索和安装服务。
- 完整打通该链路，并更新当前 Skill Market。

### Acceptance criteria

1. OpenCorvus exposes one current Skill Market authority that can search specific Skills at runtime.
2. A search result has a stable market identity, repository source, popularity signal, canonical detail URL, and installed projection.
3. Detail inspection downloads the exact Skill bundle, validates its shape, reports content hash and risk, and does not install it.
4. Installation requires the selected identity and the inspected hash, publishes exactly one Skill atomically, records provenance, updates the global Skill catalog, and reports that activation is available from the next runtime turn.
5. Runtime primary Agents can search, inspect, and request installation through one Tool. Search/inspect are network reads; install is a separately authorized local mutation.
6. The Settings Skill surface uses the same server contract for operator search, review, confirmation, and install.
7. Project and global HTTP routes, generated Software Development Kit (SDK), bilingual docs, and current architecture describe the same contract.
8. Focused positive tests cover search, exact detail, hash-pinned install, installed projection, provenance, permission classification, and route contracts. User Interface (UI) acceptance uses a real page and manual screenshot review only.

### Hard constraints

- Keep one current implementation and one market fact source; do not restore the deleted configurable-registry branch, fallback registries, swallowed network failures, or whole-repository installation as the Market path.
- Keep all Large Language Model interactions streaming. Do not add Host routing that teaches the model a workflow; Tool description and ordinary permission authority own the interaction.
- A newly installed Skill is not injected into the already frozen Skill surface of the current turn. The result must state that it can be mounted on a later turn.
- Market content is external code. Inspection must expose provenance, content hash, files, trust, risk, and recommended policy before installation.
- Do not log credentials or bundle contents. Reject unsafe paths, duplicate paths, malformed bundles, hash mismatch, and identity mismatch.
- Do not add, modify, or run UI automation tests. UI evidence is a real page screenshot plus manual visual review.
- Preserve unrelated dirty-worktree changes. Task-owned changes must be independently reviewed, committed, merged with upstream, verified, and pushed without rebase or force push.

### Sources read

- `packages/opencorvus/src/skill/manager.ts`: fixed five-entry directory catalog, whole-source URL/Git installation, provenance manifest, global catalog invalidation, and atomic Skill-directory replacement primitive.
- `packages/opencorvus/src/skill/discovery.ts`: remote index snapshots and content-addressed cache contract.
- `packages/opencorvus/src/tool/skill.ts`, `capability-search.ts`, `capability-catalog.ts`: current-turn mounted Skill search and the absence of uninstalled Market discovery.
- `packages/opencorvus/src/agent/tool-pool-data.ts`, `tool/global-tools.ts`, `tool/tool-id-catalog.ts`: runtime Tool grants and inventory authority.
- `packages/opencorvus/src/permission/invocation.ts`: permission effect classification and invocation scope.
- `packages/opencorvus/src/server/routes/skill.ts`, `global.ts`: project/global Skill routes.
- `packages/overlay/src/components/settings/SkillMarketPanel.tsx`, `packages/overlay/src/services/extensions.ts`: current installed-resource UI and direct-source install path.
- `specs/current/architecture/04-extensions.md`: current fixed-catalog architecture.
- `specs/records/2026-08/2026-08-13-cs027-delete-unconfigurable-skill-registries.md`: why the prior unconfigurable remote-registry branch was removed.
- [skills.sh API documentation](https://skills.sh/docs/api): authenticated versioned search/detail/audit API and stable Skill identity shape.
- [Vercel Labs skills CLI](https://github.com/vercel-labs/skills): current public CLI implementation using `https://skills.sh/api/search` and exact bundle download through `https://skills.sh/api/download/{owner}/{repo}/{slug}`.
- [Agent Skills specification](https://agentskills.io/specification): portable Skill directory and `SKILL.md` contract.
- [OpenAI Skill installer](https://github.com/openai/skills/blob/main/skills/.system/skill-installer/SKILL.md): exact repository/path installation and restart-after-install precedent.

### Whole-repository search evidence

- `SkillManager.market()` is consumed only by `/skill/market`, `/global/skill/market`, generated SDK declarations, docs, and the focused built-in-market test.
- `SkillManager.install()` is the shared direct path/URL/Git importer. It is not a specific-Market candidate installer.
- The runtime `skill` Tool searches only already mounted Skill metadata/content and deliberately freezes its surface at turn start.
- `capability_search` projects installed/unbound Skills but has no remote Market provider.
- No existing Tool, route, or Overlay service calls a remote Market search/detail/install contract.

### Independent agent feedback

- First read-only review found six valid issues: collision-prone Market target slugs and missing manifest ownership checks; accidental build-worker Tool projection; unsafe absolute bundle paths being rewritten rather than rejected; upstream failures returning anonymous HTTP 500 instead of the documented HTTP 502 contract; stale installable UI detail after a failed request; and a TOCTOU test that changed only the supplied hash rather than the downloaded content.
- Corrections use canonical lowercase identity segments in a collision-free `provider/owner/repository/skill` target tree, validate exact manifest ownership before replacement/removal, project `skill_market` only to primary coding/chat/work/mission roles, reject non-portable paths before normalization, publish `SkillMarketUpstreamError` as HTTP 502 on both route families, clear stale UI search/detail state before requests, and make the second download return different bytes.
- Focused coverage now also proves legacy-slug collision identities coexist, canonical casing, target ownership mismatch errors, POSIX/UNC/reserved/trailing-dot path rejection, project/global HTTP 502 bodies, and first-versus-current digest reporting. A second independent read-only review is pending.
- Second review confirmed those six corrections and found two remaining Windows/upstream boundaries: identity directory segments still accepted device names and trailing-dot aliases, and a path-safe bundle with malformed `SKILL.md` frontmatter still escaped the upstream-error boundary as HTTP 500.
- Identity validation now applies the same portable directory-name rules before deriving any target, including device-name and trailing-dot rejection. Market inspection wraps external Skill parsing, single-root, and semantic validation failures into the same public `SkillMarketUpstreamError` HTTP 502 contract; focused tests cover invalid identity components and malformed `SKILL.md` through both route families.
- Third read-only review reported no unresolved findings. It confirmed caller identity errors remain HTTP 400, external semantic bundle failures are HTTP 502, the upstream wrapper ends before local hash/ownership/conflict/config mutation, primary-only Tool projection remains exact, and every earlier correction plus generated closure remains intact.

## Problem analysis

### Observable behavior

The Settings label and HTTP operation call the fixed directory list a “market”, but OpenCorvus cannot search for a named external Skill, inspect the exact bytes that would be installed, or install one candidate. Runtime Agents can only find Skills already mounted in the current turn.

### Direct trigger

`SkillManager.market()` returns five hard-coded navigation entries. The only mutation accepts an arbitrary path, remote index URL, or Git repository and imports the whole source. Neither surface carries a stable candidate identity or inspected content hash.

### Data and control-flow root cause

There is no shared Market client or candidate bundle contract between runtime Tools, HTTP routes, the Overlay, and installation storage. Consequently, discovery ends at a homepage/repository URL and the existing generic source importer cannot guarantee that a user-reviewed Skill is the exact Skill installed.

### Why the old path did not solve it

The deleted remote-registry code read an unconfigurable schema field, swallowed failures, and had no consumer. The surviving built-in list was intentionally honest but only navigational. Reintroducing registries or silently falling back among directories would recreate multiple authorities without completing exact installation.

### Impact surface

- Definitions and storage: Market schemas, exact bundle validation, provenance manifest, installed classification, removal, and catalog invalidation.
- Runtime: global Tool inventory, primary-Agent grants, dynamic permission effect and scope, and next-turn activation boundary.
- Public contracts: project/global routes, OpenAPI route check, generated SDK, and bilingual documentation.
- UI: Skill Settings search/results/detail/confirmation/install and installed list refresh.
- Tests: focused server/manager/permission/Tool contracts. Existing UI automation is out of scope and must not be run.
- Delivery: current architecture, monthly/root indexes, documentation check, independent review, commit, upstream merge, and push.

## Decision

### One Market authority

The current Market authority is `skills.sh`. OpenCorvus uses the public endpoints exercised by the current official `skills` CLI:

- `GET https://skills.sh/api/search?q=<query>&limit=<limit>`
- `GET https://skills.sh/api/download/<owner>/<repository>/<slug>`

The versioned `/api/v1` service currently requires Vercel OpenID Connect (OIDC) authentication, which is unsuitable as a mandatory desktop runtime credential. OpenCorvus therefore treats the public CLI contract as an explicit external dependency and returns visible typed failures when it is unavailable or malformed. There is no registry fallback.

### Candidate and bundle flow

1. Search validates a query of at least two characters and returns stable `{source}/{slug}` identities.
2. Inspect validates the identity, downloads the exact bundle, checks file paths and uniqueness, requires one valid `SKILL.md`, recomputes the bundle digest, and reports metadata, files, risk, trust, upstream hash, and OpenCorvus digest.
3. Install repeats the download under the market-source mutation lock and requires `expected_hash` to equal the newly inspected digest. It atomically publishes exactly one directory under the managed Skill root, writes provenance, adds that directory to global config, applies the selected policy, and invalidates catalog state.
4. Search and installed inventory project installation by the exact Market identity recorded in provenance, not merely by Skill display name.

### Runtime Tool and permission boundary

One primary-Agent Tool, `skill_market`, owns actions `search`, `inspect`, and `install`.

- `search` and `inspect`: `network_read`, scoped to the skills.sh origin and candidate/query.
- `install`: `write_local`, scoped to the exact candidate identity and expected hash. In ask mode it therefore requires an explicit user permission decision; full-access mode remains the existing explicit blanket grant.
- Successful installation reports the installed path/name/hash and says the Skill becomes eligible for mounting on a subsequent turn. It does not mutate the current turn's frozen Skill Tool.

### Operator UI

The Skill Settings page adds a Market section above installed resources. Search shows source and install count. Selecting a result loads exact detail and risk. Install uses a native confirmation containing identity, source, digest, risk, and policy, then calls the same global install route and refreshes installed resources. The existing direct path/URL/Git form remains an explicitly separate advanced source-import path.

## Verification plan

1. Run focused Bun tests for Market client/manager, Tool permission classification, runtime Tool exposure, route contracts, and existing Skill install/removal behavior.
2. Regenerate SDK/routes/docs, then run SDK import, route, docs, OpenCorvus typecheck, Overlay typecheck, i18n, CSS-token, and build checks relevant to touched code.
3. Start the real development server on an isolated port, exercise live search/detail/install against an isolated config root, and verify provenance plus next-request installed inventory without touching user credentials.
4. Open the real `/ui` page, inspect the Skill Settings Market flow, capture screenshots, and manually verify desktop layout and interaction states. Do not run UI automation.
5. Ask an uninvolved read-only agent to inspect the complete diff, tests, evidence, docs, and regression risks. Resolve every valid finding and repeat review after fixes.
6. Recheck `git status --short`, stage only task-owned paths/hunks, commit, fetch/merge upstream, inspect `upstream..HEAD`, rerun affected verification if the merge changes the closure, and push.

## Delivery record

- Implementation: one `skills.sh` Market client, stable candidate identity, exact bundle inspection, SHA-256-pinned atomic installation, provenance/inventory/removal, primary-Agent `skill_market` Tool, permission classification/scope, project/global HTTP routes, Settings flow, bilingual documentation, and current-architecture update are implemented.
- Focused verification: `packages/opencorvus` and `packages/overlay` typechecks pass; eight focused Market/Tool/permission tests pass with twenty-seven expectations; route inventory, regenerated OpenAPI/JavaScript SDK/API references, generated API documentation, SDK import, i18n, and whitespace checks pass. Overlay production build passed after the final detail-order change. The unrelated CSS-token checker still reports four pre-existing missing variables in `composer.css` and `settings.css`; neither file is touched by this task.
- Real runtime acceptance: live `skills.sh` search and detail returned `anthropics/skills/pdf`, twelve files, high script risk, and OpenCorvus digest `7c96a2fd5ed6490df5282564198dba6a93ca5f576457908214cb2599e47a3da5`. A separate temporary OpenCorvus home then downloaded and installed that exact digest with `deny` policy, projected it as `managed_market` with the same identity/hash and `available: next_turn`, and removed the managed Skill through the Market removal path. No user Skill/config directory or credential was used.
- Manual UI acceptance: the real `/ui/` Settings > Skill Library page on isolated port `42177` searched the live Market, reviewed the same exact bundle, displayed repository/hash/files/high risk/default deny policy, and kept the inspected detail before the ten-result list. Desktop screenshots were manually reviewed; browser warnings/errors were empty. The external install button was deliberately not clicked because the independent temporary runtime acceptance already covered the mutation without touching the operator profile.
- Independent review: three read-only rounds completed. Round one found six defects; round two confirmed their fixes and found two remaining Windows/upstream-validation defects; round three confirmed all eight corrections with no unresolved findings.
- Commit and push: performed after the independent review; the containing commit and push evidence are reported in the final handoff.
