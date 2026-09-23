# Tool consolidation synchronization audit

## Recall

- User: `专家团等位置需要更新工具说明吗，交互方案，接口方案，文档都需要更新吗？请你检查那些地方需要同步更新`.
- Inspect all consumers of the four consolidated tool contracts and the direct-general-tool rule. Correct directly related omissions; retain one canonical implementation and preserve specialist loading. Do not change installed packages, frozen Tasks, credentials, active processes or historical evidence. No agents, UI automation tests, new branches/worktrees, release or deployment.
- Acceptance: evidence-backed matrix for expert-squad authoring/projection, prompts/skills, model versus human interaction contracts, public interfaces/generated clients, configuration/migration and current docs; precise fixes plus existing checker validation, scoped commit, fetch/merge and push.
- Read: root AGENTS; previous consolidation Recall/evidence; Tool IDs and role pools; platform capability sets and expert-squad grant materializer; manifest examples and authoring docs; Panel action schemas; Overlay interaction service and typed local events; current capability, extension, panel and Code/Work architecture; generated SDK/public API docs; expert-squad checker and generation ownership.
- Searches: both `rg` and tracked-file `git grep` across current source, authored squad packages, SDK and docs find no retired tool/action names outside historical records/artifacts. Broad semantic searches found the current Code/Work architecture still describing search-only revision zero, receipt-only materialization and an obsolete pending rollout. Expert-squad manifests use canonical platform capability-set expansion; no per-package old-name rewrite has been established.

## Analysis and scope

The observable issue is documentation disagreement after a runtime interface replacement. Tool identities were renamed across source/generated interfaces in the preceding commit, but semantic explanations that contain no retired identifier were missed. The direct cause is an older duplicated description in the current Code/Work platform document; the mechanism is prose drift, not a runtime scheduler or permission failure. No queue, wake, terminal convergence or concurrency anomaly is evidenced, so scheduler changes are excluded.

The common grant materializer expands platform sets from AgentToolPool, so a package referring to a base set inherits its updated todo identity without a manifest edit. Package-local tools and Skills retain exact owner contracts. Verify actual expansion through existing parsers/materializers/checkers rather than relying on source string absence. Installed and frozen package bytes are separate lifecycle authorities and must not be silently rewritten.

Model interaction consolidation does not replace the human `interaction/:id/reply` and `/reject` or standalone question endpoints; their existing EngineService/Question writers still own effects. The human permission card supports an additional `allow_task` scope not newly granted to the model tool by consolidation. Workspace tool inputs changed but the typed local Task/Session selection events remain current. No UI behavior change is planned; UI automation and new screenshots are unnecessary for documentation-only corrections.

Public Panel schemas and generated clients already contain the new action names and typed unions. Missing authoring/migration guidance should distinguish exact tool refs, config keys, model inputs, HTTP action envelopes, unchanged UI events, and frozen catalogs. This must not add compatibility aliases, expand grants, or create another schema authority. Older dated records remain historical evidence and are not bulk-rewritten.

## Plan

1. Complete semantic search and actual expert-squad projection/interface checks, recording counts and boundaries.
2. Fix stale current architecture and add concise authoring/interaction/migration guidance at existing documentation owners. Correct directly related inaccurate tool summaries with source evidence.
3. Run docs/architecture/API and expert-squad checks appropriate to the changes. Record the audit matrix, limits and verification evidence.
4. Review diff, commit, fetch/merge upstream, inspect outgoing commits and push.

## Results

| Surface | Evidence and outcome | Synchronization |
| --- | --- | --- |
| Authored Expert Squads and embedded packages | Parsed all 122 manifests with ExpertSquadManifestV2Schema and expanded 706 scheduler/worker projections with materializeExpertSquadCapabilities; 475 include current `todo`, zero parse/materialization errors. Existing topology checker validates 135 workflows. | No manifest, package version or payload rebuild needed. Explicit platform-set members come from the current registry; `base_role` alone is not a grant. |
| Squad authoring, selectors, Skills and prompts | Tracked-file searches of all source namespaces and embedded packages find no retired tool/action identifiers. Squad SDK authoring already requires exact matching platform base refs and current registry-owned web tools. Light/Advanced guidance already calls available tools directly and discovers only missing specialists/extensions. | Added focused guidance to the existing English/Chinese authoring docs and extension architecture; no duplicated per-Squad tool lists. |
| Native role prompts, Mission Skill and generation | Previous commit updated Mission reconciliation, role pools, required tools and generated Mission Skill payload. Runtime tool descriptions own the new unions. | Already synchronized. |
| Human versus model interactions | Model `respond_interaction` delegates to EngineService. Overlay interaction-reply service still uses direct reply/reject and Question routes, with human-only `allow_task` alongside existing scopes. Selection emits the unchanged typed local events; gateway capability filtering excludes local workspace selection. | Added the boundary to Panel architecture and both public tool docs. No UI/action behavior change or endpoint renaming. |
| Public API and generated SDK | Current Panel registry has 22 actions, matching the generated OpenAPI request action union exactly. Both new documentation HTTP examples parse with the actual PanelActionSchema. Gateway exposes its 12 authorized actions. JS SDK generation was already completed in the previous commit. | No runtime/interface regeneration required; added model-versus-HTTP examples and linked the generated API reference. |
| Configuration and exact grants | Unified `todo` permission/tool key and new action refs are already implemented. Separate former policies cannot be preserved automatically by renaming both into one tool. | Added the old-to-current mapping, complete-list write semantics, explicit policy reconciliation and frozen-catalog/package boundaries to both tool docs. |
| Current architecture | Code/Work platform chapter still asserted search-only revision zero, receipt-only materialization, a limited Mission surface and pending snapshot/reveal implementation. | Corrected these semantic contradictions and the architecture index label; authoritative routine runtime remains the single detailed owner. |
| Tool summaries | `browser_preview` description establishes service startup/target persistence, not browser interaction. `question` is available for app/CLI/desktop clients as well as explicit enablement. | Corrected both bilingual public table entries and named preview capture/discovery tools. |
| Historical records and delivery | Earlier dated records/Artifacts and stored transcripts describe the previous interface. Installed bytes and frozen Task revisions have their own owners. | Preserved historical evidence; no process restart, deployment, package install or frozen-state rewrite. |

Read-only local checks found no installed manifests in the standard resolved global config root or this repository's project config root, and no retired tool reference in the existing project `opencorvus.jsonc`. These checks do not establish the contents of other projects, overridden homes or third-party consumers; those require the documented migration if they directly reference retired interfaces. No credential values were inspected or printed.

### Verification

- One-off audit `.tmp/tool-sync-audit.ts` ran actual schema parsing and capability materialization across source packages: 122 manifests, 706 projections, 475 with `todo`, zero errors. This is projection evidence, not a live model run.
- `bun test ./test/expert-squad/capability-grants.test.ts --timeout 120000`: 9 passed / 21 assertions, including current platform inventory, set expansion, exact override and typed malformed/mismatched grant contracts.
- `bun run check:expert-squad-topology`: 122 manifests / 135 workflows; 11 flat, 93 parallel joins, 31 dependency graphs.
- One-off interface audit parsed the two HTTP examples with PanelActionSchema and compared the 22 generated OpenAPI action names to the current action registry; inspected the 12 gateway-authorized actions.
- `bun run docs:check`: 342 operations / 25 groups. `bun run check:architecture-index`: 17 current documents. `bun run api:routes-check`: six rules across 34 route files. `git diff --check` passed.
- This round changes documentation only. Existing runtime effects and the preceding live Provider/UI acceptance remain unchanged; no new end-to-end or UI verification is claimed.

All directly related synchronization omissions found in current repository documentation are corrected. No runtime or generated-schema mismatch was found. Final delivery uses a scoped documentation commit followed by the required upstream merge/review and push.
