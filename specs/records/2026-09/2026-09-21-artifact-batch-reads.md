# Batched Artifact queries, searches and reads

## Recall

- User asks to replace repetitive Artifact operations with batches and identify suitable operations; screenshot shows repeated `panel_query_task_artifacts` and single `panel_read_task_artifact` calls. User selected: “先改查询、搜索、读取（推荐）”. Work remains on main in the existing `opencorvus-release-0.0.54` checkout.
- Previous task is independently delivered as `8b182bc3`, pushed with all hooks. Preserve parallel RPM/release record edits.
- Acceptance: one model tool call can query multiple catalogs/search conditions and read multiple exact references; enforce a shared output bound and return explicit continuations. Current Task/Mission lineage, terminal occurrence, immutable version, byte coverage, permission-result ownership and read-reference acceptance must remain provable for every item, including after restart. No UI changes, write batching, hidden/synthetic messages or parallel fact stores.
- Read: plugin artifact-catalog/producer schemas; artifact-catalog tool and Orchestrator AI tool constructors; Panel capability/action schemas and handlers; artifact-read-facts/provenance-facts including indexed completion reduction; Session/permission outcome tables; current architecture 07-panel and task-control-plane; Mission prompt; affected backend Artifact/Panel tests.
- Whole-repository searches cover four tool names, reference schemas/minting, tool-result consumers, description/prompt occurrences, and scalar reference expression indexes. Existing `panel_query_task` already batches 50 Task IDs and `panel_read_task_message` batches eight messages; exact Artifact filters already accept value arrays.
- Independent agent feedback: read-only review found full-query continuation duplication could exceed the output bound, and media lacked a cumulative bound. Both are fixed with compact indexed query continuations and a 32 MiB encoded attachment budget; final independent review reports no unresolved findings.

## Analysis

Observed repeated calls have a concrete contract cause: Mission is instructed to enumerate every numbered catalog page, Panel initially requests only 16 entries, and both Panel and worker/Orchestrator read tools accept one reference. Search filters can already express OR lists for exact labels/types, but independent query expressions need separate calls. Screenshot alone does not prove identical requests; implementation targets these confirmed constraints.

Affected public model surfaces are `panel_query_task_artifacts`, `panel_read_task_artifact`, `artifact_search` and `artifact_read`. Lower-level canonical catalog/read APIs remain scalar primitives; batch tool handlers use them, not a second implementation. Tool IDs remain unchanged, with one current array-based request contract even for a one-item batch. Atomic catalog/read fact schemas and reference strings remain unchanged. Catalog/read evidence is extracted uniformly from current typed atoms inside visible result containers; a scalar immutable historical atom is the same fact schema, not an alternate execution protocol.

The risky path is durable proof consumption: current code assumes one read per Tool Part, and Mission completion looks up only a top-level reference. A batch must resolve every supplied reference from its actual immutable result, join each to its exact submitted item and terminal occurrence, and include only supplied chunks in coverage. Use one Session-indexed batch query of request/outcome facts and current typed fact traversal; no schema reset, copied evidence table, hidden per-item Tool Message or per-Task history scan. Existing scalar expression indexes are part of the persisted storage schema and are not changed by this transport task.

Other risks: output and attachment expansion; pagination changing membership when batch size changes; partial failure accidentally acquiring acceptance authority; starvation of later reads; outdated prompts continuing single-item calls; changing UI contracts unnecessarily. Normal single canonical APIs remain intact for non-model consumers. Batches validate identities first, bound each request and total serialized output, and fail explicitly on invalid authority. Pagination remains derived from the same catalog snapshot contract; unfinished work returns supplied continuations, not a model-reconstructed locator.

## Plan

1. Add shared model batch schemas with at most eight queries/reads and existing byte/output limits. Keep current immutable per-item request/receipt atoms.
2. Route worker/Orchestrator and Panel arrays through existing canonical implementations; return visible result arrays and exact next-query/read arrays. Consolidate numbered Panel paging within an output budget, and use existing maximum catalog limit instead of the arbitrary 16-item start.
3. Make all read-reference/acceptance/provenance consumers resolve multiple atoms per real Tool Part with exact input/output binding and one Session-scoped database pass. Remove superseded single-item model execution paths.
4. Update tool descriptions, Mission prompt and current architecture; regenerate contracts when required. Add positive batch/continuation/error-authority tests and real runtime checker evidence. No UI automation.
5. Independent read-only review, fix all valid findings, revalidate, commit separately, merge upstream and push.

## Suitable batching boundaries

- Implement now: multiple Task catalogs, multiple independent Artifact searches, exact text/metadata/media reads with bounded continuations.
- Already batched: Task status queries; decision-named participant messages; exact filter value lists.
- Keep outside this change: publish/update/delete/import and semantic selection/acceptance mutations, which need their own atomicity, ownership and failure contracts. Dependent discovery then reads remain separate calls because references must come from real prior results.

## Implementation and validation

The four model tools now use arrays of 1–8 items. Search results return indexed cursor/page patches (`next_queries`) and unchanged deferred item indexes (`pending_queries`); callers merge only cursor/page fields into the original query. Read results return complete `next_reads` requests. Shared budgets are 40 KiB structured output, 24 KiB text chunks and 32 MiB encoded attachment URLs. Panel numbered pages retain fixed membership regardless of batch size.

Read evidence resolves exact submitted version-2 atoms from inline or deferred immutable Tool outcomes. A completion lookup filters one Session-scoped joined query by all supplied references, then validates exact input/window and terminal bindings. Removed the superseded direct-locator version-1 read-fact branch and its obsolete test; no database migration or compatibility execution path was introduced.

Focused positive tests cover batch ordering, long search conditions, continuations, cumulative media limits, exact evidence selection from multi-item receipts, deferred results, stale terminal authority and real Orchestrator adapters. SDK contracts are regenerated from production OpenAPI. `packages/opencorvus/script/artifact-batch-check.ts` runs an actual Mission loop against an isolated local streaming Provider: one two-query call followed by one two-Artifact read and a persisted final reply. Task/artifact seeding establishes the input dataset; this checker does not claim Task-generation quality or commercial-model acceptance. Initial successful runtime evidence: `C:/Users/hengu/AppData/Local/Temp/opencorvus-test-run-XZ7eP4/runner-18272-qNcink/{transcript,provider-requests}.json`.

Final validation: 29 focused backend tests passed (7 batch, 3 provider-reference, 1 read-fact, 7 terminal-authority and 11 requirements adapter tests); backend typecheck passed; SDK generation/build and root `bun run docs:check` passed. Final real runtime checker: run `bun run script/artifact-batch-check.ts` from `packages/opencorvus`; PASS with evidence in `C:/Users/hengu/AppData/Local/Temp/opencorvus-test-run-TB8uHE/runner-35920-Cwbp5i`. Independent read-only reviewer reran all seven batch tests, checked the complete implementation and real transcript, and reported no unresolved findings. No UI source or UI automation was changed; generated API reference pages describe the public contract.
