# Conversation Agent-declared output summary repair

## Recall

| Item | Detail |
| --- | --- |
| User requirement | Replace the current unintuitive Artifact-first completion display with a summary whose visible outputs come from the Agent's own declared modified deliverables. The user explicitly corrected the earlier implementation for not doing this. |
| Acceptance criteria | A completed Task or Mission Turn first shows the exact files and structured results declared by the selected producer Artifact, identifies the producing Agent when available, and keeps exact Artifact inspection as secondary detail. The immutable completion decision still selects which Artifacts are delivered. Exact file rows open the existing immutable resource inspector. Tasks without resource-bearing outputs still show their selected structured results truthfully. |
| Hard constraints | Do not parse final-message prose, infer filenames from labels, add a second delivery declaration, copy Artifact bodies into messages, add a fallback renderer, or turn presentation into workflow state. Preserve unrelated dirty-worktree changes. Do not add, modify, or run UI automated tests. Validate UI only through an isolated real page and personally inspected screenshots. |
| Sources read | `AGENTS.md`; `specs/current/architecture/01-agents.md`; `15-agent-facts-and-turns.md`; `2026-08-02-conversation-turn-artifact-projection-repair.md`; `2026-08-06-conversation-artifact-interaction-and-file-review.md`; `artifact-catalog.ts`; `task-artifact.ts`; `engine/completion-decision.ts`; `conversation/turn-artifacts.ts`; `engine/model.ts`; `ConversationTurnArtifactSummary.tsx`; `ConversationArtifactInspector.tsx`; `CardParts.tsx`; localization and Conversation styles. |
| Whole-repository search | The selected Completion Decision locators are the current Conversation owner. Workers already declare immutable file resources through `artifact_snapshot` and attach them to typed or generic `artifact_publish` envelopes whose producer metadata is Host-derived. The current Turn projection drops those resource refs and producer identity, and the renderer therefore leads with catalog metadata. No existing Conversation summary projects producer-declared resources. |
| Independent agent feedback | None before implementation. Post-implementation review found and drove fixes for full resource identity, declaration-level deduplication loss, invalid envelope fallback, raw Core Artifact handling, and the duplicated typed-envelope kind rule. The fourth and final read-only review reported no unresolved task behavior, contract, test, or generated-closure finding. |

## Evidence and causal chain

1. `artifact_snapshot` is already the explicit Agent file-output declaration: it
   accepts exact project-relative files and returns one immutable resource-set
   locator.
2. `artifact_publish` expands that exact resource set into the canonical Engine
   Artifact envelope and persists Host-derived producer Session, message, Agent,
   Expert Squad, and package revision metadata.
3. `complete_task.deliverable_artifact_locators` correctly remains the terminal
   Orchestrator selection authority. It is not, however, a human-readable output
   summary.
4. `conversation/turn-artifacts.ts` currently resolves selected locators only to
   `ArtifactCatalogEntry`. That projection contains counts and media types but
   not the producer-declared resource paths.
5. `ConversationTurnArtifactSummary.tsx` consequently renders Artifact label,
   type, and resource count as the primary surface. The actual files/results and
   producer are hidden behind later inspector interaction.
6. The prior design explicitly rejected an additional preflight declaration,
   which was correct for authority but was incorrectly carried into the
   presentation decision. It should have reused the declaration already present
   in the selected Artifact envelope instead of replacing the requested summary
   with catalog metadata.

## Single-source repair

- Completion Decision locators remain the sole selection of user-delivered
  Artifacts and preserve their recorded order.
- For each selected exact locator, the server projects a compact output
  declaration from the same immutable source:
  - Engine Artifact: exact envelope producer and attached resource refs;
  - Task Artifact snapshot: exact manifest producer and declared files;
  - Task Artifact resource: exact manifest producer and the selected ref only.
- Every selected declaration is preserved in recorded order. The renderer
  merges only identical file rows by the resource's complete immutable locator
  and carries every contributing declaration/producer on that row; it never
  deletes a selected declaration from the transport projection.
- The Turn card leads with producer-declared files/results. Each resource opens
  the existing exact `task_artifact_resource` inspector. Exact selected Artifact
  records remain available as secondary delivery detail.
- A selected structured Artifact without declared files remains one structured
  output row; it is not presented as an empty file delivery.

## Implementation and acceptance plan

1. Extend the strict Turn transport schema with producer-declared output rows.
2. Resolve those rows from the exact selected locators in the existing server
   Turn projection and add positive non-UI coverage for Engine resources,
   direct snapshot/resource selection, producer identity, ordering, and
   deduplication.
3. Recompose the Turn summary hierarchy around Agent outputs and move raw
   Artifact records into secondary detail. Reuse the existing inspector.
4. Run focused tests, package typechecks, Overlay build, i18n, API/docs, and
   document checks without running UI tests.
5. Start an isolated real server/page, exercise the summary and inspector,
   capture screenshots, inspect them manually, correct the layout, and repeat.
6. Ask an uninvolved Agent for a read-only review of the complete diff and
   evidence. Resolve every valid finding and rerun affected checks.
7. Stage only this task's hunks/files, create a focused commit, inspect the full
   upstream-to-HEAD push set, and push only when every outgoing commit is in
   scope and reviewed.

## Progress

- [x] Reconstruct the missed requirement and current data flow.
- [x] Freeze the single-source repair boundary.
- [x] Implement server transport and renderer hierarchy.
- [x] Complete focused contract, generation, route, and build acceptance.
- [x] Complete real-page screenshot acceptance. An isolated current-source
  server on port 17901 used a consistent copy of the real runtime SQLite
  database, while a freshly built release Tauri host used an independent
  runtime and WebView profile. The native page restored completed Task
  `tsk_g019fecacd4b00000000000006FF5jedJaWBUo0`, rendered the primary
  `Agent 声明的输出` row as `0000/release-readiness.md` with producer
  `release-decision-builder`, and kept `查看交付记录（1）` secondary. Clicking
  that exact row expanded the immutable Markdown resource with its real
  `发布就绪评估`, `NOT READY`, summary, and evidence table. The two manually
  inspected captures are `artifact-native-agent-delivery.png` and
  `artifact-native-wide.png` under the Task visualization directory. The
  in-app-browser diagnostics remain useful counterevidence: localhost frontend
  ports 4329 and 5173 loaded, direct backend port 7878 was rejected with
  `ERR_BLOCKED_BY_CLIENT`, and browser-mode Overlay startup hit its Tauri-only
  event bridge. No offline or fixture page was used as acceptance evidence.
- [x] Complete final independent review with no unresolved findings.
- [ ] Commit and push after visual acceptance and repository divergence are
  resolved.

## Validation evidence

- `bun test packages/opencorvus/test/orchestrator/conversation-turn-declared-outputs.test.ts`:
  passed 3 tests and 9 assertions for producer identity, exact resource
  selection, preservation of declarations that share resources, legal
  resource-free typed envelopes, legal raw Core Artifact projection, and the
  explicit invalid-envelope error contract.
- `bun run typecheck`: passed across 8 packages before the final single-source
  refactor. The final rerun reached all task-owned packages but is currently
  blocked by a parallel Usage change in `packages/opencorvus/src/usage/index.ts`:
  `billing.status` now permits `unknown` while its local `Record` type permits
  only `priced | unpriced`. No task-owned type error was reported.
- `bun run build` in `packages/sdk/js`: passed and regenerated the OpenAPI and
  Software Development Kit closure containing `declaredOutputs`.
- `bun run api:routes-check`: passed 6 rules across 34 route files.
- `bun run build` in `packages/overlay`: passed after the final visible
  hierarchy and declaration aggregation changes, transforming 7,104 modules.
- `bun run tauri build --no-bundle` in `packages/overlay`: passed with isolated
  `CARGO_TARGET_DIR`; the native executable embedded the current production
  Overlay. Its WebView was then connected to the current-source server and the
  real copied Task database for the manual acceptance described above.
- `git diff --check`: passed.
- `bun run docs:check`: passed after the parallel Provider usage task generated
  its separately owned route documentation (330 operations across 25 groups).
