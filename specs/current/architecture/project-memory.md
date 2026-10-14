# Project memory architecture

Project memory has three explicitly scoped authorities:

1. Session `MEMORY.MD` is a read-only continuation checkpoint produced by successful compaction. Its completed compaction-summary assistant owns the append-only checkpoint Part; the source user Message is never marked or mutated.

   A successful checkpoint requires a normal `stop`, final visible text and a
   smaller provider-facing replacement. Output-limit or other incomplete
   summaries and nonshrinking summaries retain typed failure evidence and leave
   the previous valid memory readable. Memory reconstruction uses the same
   completion predicate as checkpoint publication and conversation projection.
   A queued control replaces history only through its own source input's turn.
   The first later accepted user input remains an exact `tail_start_id` boundary,
   including overflow, zero optional tail and repeated checkpoints. It cannot
   be absorbed into an older request's summary or lose its continuation identity.
   Skill and attachment references are historical locators, not current tool
   grants, desktop focus or permission authority.

   A long-lived assistant can continue appending Parts after a checkpoint.
   Its checkpoint `covered_parts` binds the exact captured Part payloads and
   assistant diagnostics, carrying coverage through subsequent checkpoints.
   Reconstruction replaces matching captured material and projects changed or
   appended material after the summary under the original Message identity.
   A running Tool's later outcome and a text Part's later streaming update are
   new material. Missing captured identities raise
   `CompactionCoverageIntegrityError`. The original records remain canonical;
   these bindings carry no copied payload or independent execution authority.
   Recompaction detection and Tool pruning use this same coverage. Unchanged
   covered diagnostics are replaced by the summary in model input, while new
   diagnostics remain readable and the evidence reader retains the full source.
   Task-root execution reads its deterministic assistant occurrence directly
   from persistence, preserving cumulative usage and semantic-step facts even
   when the model sees only a suffix. Copies remap coverage and Tool references
   together; a changed source stays changed after copying. Whole-Message
   checkpoints without partial coverage do not provide a recoverable historical
   Part boundary.

   Summary completion, checkpoint publication and compaction-control consumption
   are separate durable boundaries. A process interrupted before marker commit
   leaves the previous checkpoint authoritative; the recovered Session loop
   retries under the existing control lease. A committed, completed checkpoint
   can be reused while consuming the pending control. Automatic compaction then
   continues the normal user turn. Every freshly consumed automatic control
   publishes its exact durable summary to matching summary waiters, including
   those attached to an ordinary reply owner. Matching uses Session, result
   kind and control identity; publication does not terminate the reply owner.
   Reused checkpoints and cross-process joins resolve that same durable result.
   Interrupted assistants retain their persisted
   text and typed failure evidence. After acquiring the exclusive compaction
   control lease, its executor settles unfinished helper attempts for that exact
   source through the Session terminalizer, even across a later recovery input.
   The compactor then rereads history so those actual diagnostics reach its request.
   Live text deltas are transport events; the
   processor checkpoints accumulated Parts on its existing 200 ms cadence, so
   fragments not yet persisted can be lost on abrupt process exit. The physical
   crash checkers cover owned child-process exits and fresh Session reopening.
   The formal backend checker exercises Task and Mission owners in two Projects,
   both during compaction and after a completed checkpoint with later Tool
   evidence. Recovery preserves the original execution occurrence and exact
   source Parts, Tool requests and outcomes. Scripted streaming transport proves
   these mechanisms; it does not establish model quality or operating-system
   power-loss recovery.

   Ordinary model replay and the compaction transcript use the same attributed
   assistant diagnostics from canonical Message fields: Message/Session/parent
   identity, accepted input batch, timestamps, finish/summary state, main error,
   failure occurrence, convergence and observation evidence. The existing
   Provider redactor removes credential values from this read projection.
   Failed attempts retain their authored content and settled Tool call/result
   pairs; an error-only Message still contributes its actual diagnostics.
   These are metadata on the existing assistant, not a synthetic recovery
   Message. A failed summary remains ineligible as a MEMORY.MD checkpoint.
   Message diagnostics omitted from the request carry an optional preview plus an exact
   `message_id` / `field=diagnostics` reference in the same evidence reader.
   Pagination reconstructs the complete credential-redacted projection, with
   the same Unicode offset contract as Part fields. Message and Part locators
   are mutually exclusive; a missing, mismatched or out-of-scope locator
   returns `COMPACTION_EVIDENCE_INVALID`.

   The compaction transcript includes original authors and exact text/Tool Part
   and call identities. Text, Tool fields and redacted Message diagnostics use
   one request-budget-aware projection. A compiled minimum catalog records the
   complete selected history with original roles, Message/Part/call identities
   and exact omitted-field references. Only a chronological prefix of complete
   catalog Messages is inline when that index exceeds the request window;
   complete fields in that prefix expand in stable ascending additional estimated size,
   then optional bounded previews consume remaining space. System instructions,
   prepared Tool schemas and the final summarizer prompt share that same budget.
   Original chronology and identities remain unchanged. Incremental script counts
   include JSON escaping and use the shared Token estimator; final request checks
   still apply, including on later evidence-read steps. Required context that
   cannot fit produces a durable ContextOverflowError rather than a checkpoint.
   Token estimates do not guarantee fit under every model's exact tokenizer.
   The helper prompt carries `compaction_catalog_reference` with its real helper
   Message identity and the exact UTF-16 offset of the next unlisted Message.
   `ReadCompactionEvidence(message_id=helper, field=catalog)` pages that same bound
   catalog through the existing read-window fitting. Its content is one JSON
   array of minimal transcript projections; pages may split serialized records.
   Readers preserve unfinished fragments and exact IDs across pages/notes.
   Catalog ownership is assistant/compaction; the indexed original source role
   and author remain distinct. Catalog pages are projection data, not user
   authority. The ordinary Part readers recover the complete original fields.
   Catalogs are compiled once per attempt, not a new persistent content store;
   actual read and note Tool Parts retain their normal durable evidence.
   Paging bounds request size, not total work: existing helper step limits can
   still end a large scan with `CompactionContinuationMissingError`. Original
   history remains authoritative after such a failed attempt.
   Initial packing runs after the shared LLM entry has composed request language,
   plugin transformations, parameters and actual Tool declarations. This final
   envelope supplies the same input ceiling used by the ordinary request checks.
   Discretionary compactor space reserves a model-response allowance and a read
   exchange before expanding source fields. Each read is fitted to the remaining
   shared window, including parallel results and JSON projection overhead. The
   reader derives original contents and identities itself; fitting selects only
   a valid Unicode endpoint. Exhausted windows return
   `COMPACTION_EVIDENCE_WINDOW_FULL`; invalid endpoints return
   `COMPACTION_EVIDENCE_INVALID_WINDOW`.

   The helper may call `SaveCompactionNotes` with cumulative natural-language
   working notes. These are ordinary visible, processor-owned Tool input/result
   Parts. A successful note retains its complete call/result group and later
   evidence in subsequent request views, while earlier reads remain canonical
   and retrievable. Failed notes leave the prior working view intact. The note
   result derives `source_reads` from actual read result frames and earlier note
   receipts, merging ranges only for the same exact field/version/provenance.
   It preserves original source identity, role/author, UTF-16 ranges, reader call
   references and the first unread offset. This receipt proves delivery, not the
   truth or authority of the content or the model's interpretation. The model
   authors the notes; the host derives only factual read accounting. The note
   exchange, including its receipt, must fit its reserved budget. There is no
   additional durable memory store or host-selected Tool workflow. A restarted
   compaction reads the prior attempt's actual notes and failure as source facts;
   only a completed final summary can publish the Session checkpoint. Existing
   helper step limits and capacity failures remain explicit resource boundaries.

   `RetainCompactionUserText` lets the compactor select contiguous verbatim
   excerpts from original user text. A successful visible Tool result records
   exact source identities, role/author, Unicode-safe ranges and a fixed-source
   fingerprint in the existing canonical Tool request/outcome store. The host
   validates provenance and capacity, not the meaning of authorization. It
   cannot promote Tool quotations or assistant paraphrases to user instructions.
   Task-root participant input first follows the existing single-record delivery
   into its Orchestrator Session, preserving the real Message/Part identity,
   body, role and author. This applies to each accepted current root input, not
   only scheduler deliveries. Compaction can then select that actual source
   through its ordinary Session snapshot; it does not widen the reader to other
   Sessions or turn a root-message Tool quote into a user instruction.
   Only a completed, published checkpoint makes its selection effective. The
   latest successful selection at or before the active checkpoint applies until
   replaced; an explicit empty selection releases it. Failed helpers have no
   selection authority. Replay derives text from the original Part under its
   original user Message identity and chronology; already retained full inputs
   stay whole. Exact copy ancestry uses the same bound evidence resolver.
   Changed/missing sources produce typed integrity errors. No user Message is
   synthesized and no second permissions or content store exists.

   The helper preserves the actual selection call/result exchange across saved
   working notes and prices it within the existing working allowance. Checkpoint
   reduction includes newly replayed user excerpts, including sources brought
   back from an earlier checkpoint. Excerpt ranges are annotated only in the
   disposable compactor transcript; provider metadata and persistent Message
   formats remain unchanged. MEMORY.MD remains the literal completed assistant
   summary; retained user text is original-source replay, not assistant memory
   with elevated authority. Exact provenance does not prove the model selected
   enough quotation context or retained every instruction; real action tests
   measure that semantic boundary separately.

   A bounded retained-user field reference carries the exact original offset,
   limit and end with `scope=retained_user_excerpt`, derived from that same Tool
   receipt. The canonical reader still pages the full original field; a cursor
   beyond the referenced excerpt is not a demand to read every archived byte.
   Read receipts describe delivery, not semantic reading obligations. Newly
   arrived user fields take precedence over rechecking already retained history;
   an older source remains available for concrete gaps or contradictions.

   Omitted fields keep `ReadCompactionEvidence` references. The one reader resolves text, input,
   output, structured failure and provenance metadata from the Session snapshot
   bound when compaction dispatches, including original Parts referenced by older
   checkpoints. A later message or another Session is outside that read scope.
   Tool output uses its canonical full-output file when the persisted result
   declares truncation; a stored display preview is never treated as a complete
   inline result. The Task evidence reader uses the same output resolver.
   Returned chunks preserve original role/author and exact UTF-16 code-unit
   offsets; a chunk endpoint may extend one unit to complete a Unicode character.
   A reader page cursor is distinct from a cursor inside the original result.

   The summarizer reads omitted user requirements, records chronological user
   corrections with their source references, and treats quoted Tool instructions
   as evidence. The shared execution prompt consumes checkpoints as records of
   intervening messages: a preserved initial anchor does not supersede recorded
   later corrections, and genuinely new user instructions remain authoritative.
   This is prompt/data provenance, not a new host-owned authority snapshot or a
   message-role rewrite. Summary success still proves completion and reduction,
   not perfect semantic retention. The bound read map currently scales with the
   Session's stored text/Tool history; semantic and resource stress results are
   recorded separately from mechanical checkpoint validity.

   Full Tool-output bytes remain available while canonical Tool request,
   progress, outcome or Permission execution-result metadata references their
   path, even after seven days and across Session forks. The existing hourly
   cleanup reclaims only aged orphan files in its managed runtime layouts.
   A global reference snapshot may conservatively retain files, while every
   deletion batch rereads current references and unlinks under the same
   synchronous database writer reservation. Batches yield between groups of
   at most 64 entries. Path identity uses the shared filesystem comparison
   contract; no separate retention registry or reference counter is stored.
   External deletion or preexisting missing bytes still produce an explicit
   source-read failure; retention does not synthesize lost evidence.

   Session copies remap checkpoint anchors, retained-tail boundaries, assistant
   parents and accepted-input batches through one complete Message identity map.
   Missing copied dependencies produce an explicit integrity error. Independent
   side history includes inputs accepted by a completed reply even when those
   inputs were created after its assistant Message. The atomic copier writes
   complete user bundles before assistant bundles, preserving source creation
   times and canonical timeline order through the same persistence primitives.
   In an unbound independent side Session, an inherited worker descriptor is
   historical provenance; current Task or descriptor bindings still require the
   full execution-authority checks. Model-authored citation text is unchanged.

   Normal transcript forks are limited to standalone Session ancestry. A
   Task-bound root or worker returns `TaskBoundSessionForkError` (HTTP 409)
   before a target is published; ownership is checked again under the copy
   transaction. Copying history cannot manufacture the new child's dispatch,
   descriptor or Task occurrence. An explicit independent side-chat still uses
   the same copier and retains source locators as historical evidence. Actual
   Task execution continues through its canonical dispatch/runtime contracts.

   Copied Messages expose `copySources` as exact Part ancestry and Message
   diagnostics ancestry, including earlier copy generations. The latter stores
   original Message/Session/parent/accepted-input identities and a fixed binding
   to the canonical diagnostic fields, without copying their payload. Local
   Message and failure-occurrence owner references are rebound together, so a
   copied failed Message still satisfies its public schema. Diagnostic body,
   Tool trace and convergence Part references retain their historical meaning.
   The current diagnostic projection identifies `copiedFrom`; original-ID reads
   restore the exact source owner/parent/input identities and return the current
   copy identity separately. A copy is evidence, not a newly executed failure.
   The reader indexes those explicit historical identities
   against the copied Messages and Parts in its bound snapshot; it never queries the source
   Session or grants access to uncopied or later source material. A historical
   read reports both its requested source identity and the current copied Part.
   The existing canonical digest primitive binds each origin to its copy-time
   JSON payload and role/author. An edited/deleted copy returns
   `COMPACTION_EVIDENCE_STALE` for that origin, while its current ID reads current
   content; conflicting identities return `COMPACTION_EVIDENCE_INVALID`.
   The digest validates fixed evidence identity, not functional quality, and
   binds full-output metadata rather than externally mutable file contents.
   No second payload store or inferred mapping for older copies is maintained.
   Copies created before diagnostics ancestry was recorded can read their
   current Message IDs; unsupported historical aliases remain explicit errors.

   Deleting a source tree with a same-Project independent side-history reference
   uses the existing tombstone contract, retaining the original source files.
   Physical deletion rechecks that ownership after acquiring its admission
   fence and before moving files. A copy committed before the fence produces
   the existing typed unsettled/rollback result; a retry selects retention.
   There is no separate copy-evidence registry or replacement file path.
2. Project `MEMORY.MD` is a read-only Project context maintained exclusively by the fixed hidden `memory` helper agent.
3. Semantic memory (`note`, `episode`, `fact`, `lesson`, `profile`) is reusable main-agent-managed Project knowledge.

Both named documents use all caps. API and tool responses distinguish them with `scope=session` and `scope=project`; filename case is not a semantic discriminator.

## Pending user-input evidence

Trusted ingress supplies versioned Message-level provenance containing literal input frozen before host materialization. The canonical Session bundle transaction enqueues one host-owned `user_message` occurrence with the Task/conversation name, safe content/attachments, and up to two preceding visible transcript Messages. Direct-user Task creation and validated Question/Permission replies use the same pending contract. Runtime wakes, automatic resolutions, and internal service/tool calls do not.

Pending occurrence IDs are deterministic and replay must match the full canonical payload. Secrets, private-key blocks, inline payloads, and unsafe attachment references are redacted or omitted before persistence. `user_message` is an inbox, not a permanent archive: an accepted Organizer commit atomically consumes its exact ordered prefix. The Session transcript remains authoritative raw history.

## Dedicated Memory Organizer

The `memory` helper is separate from every main task agent, hidden, tool-free, and streaming-only. It receives only the current Project `MEMORY.MD` envelope plus a complete FIFO-prefix of sanitized pending evidence. It autonomously translates user wording into complete meaning, merges duplicates, applies corrections and superseding decisions, retains active goals/constraints/state, and compresses stale context. Host code never groups, scores, summarizes, selects document sections, or rewrites Organizer content.

The helper streams one complete replacement envelope. The host validates only base revision, exact covered occurrence prefix, nonempty safe Markdown, and the effective document token ceiling (hard maximum 10,000). One transaction increments revision, replaces the protected `project_context` envelope, and deletes exactly the covered pending rows. Stale or invalid candidates consume nothing.

The oldest pending FIFO occurrence is the Organizer's only model-provenance owner. Its Task-bound root Session, or its owning root Session when no Task exists, supplies one fenced effective configuration snapshot and its canonical top-level `model`; that same snapshot supplies Provider settings and Organizer budgets for the attempt. The hidden `memory` helper has no independent `agent.memory.model` field. Organization request events carry only Project identity, so automatic dispatch, the manual HTTP action, the `memory.project_organize` Tool, retry, coalescing, and restart recovery cannot select different models for the same pending head. A missing owner, root Session, or canonical `model` is an explicit unavailable settlement and never falls back to Provider history, registry order, environment, or caller identity.

Each pending transaction also publishes a durable organization request. One durable subscriber serializes/coalesces runs and survives scheduling and acknowledgement gaps. Project prompt injection is all-or-nothing: it injects the complete committed document when it fits the configured prompt budget, otherwise omits it and leaves a `memory.project_read` pointer. The former host-ranked semantic-memory auto-injection path is not parallel authority.

## Capacity and availability

When the document cannot incorporate pending meaning within the configured ceiling, the system persists `capacity_reached` and emits a durable user-facing attention event asking the user to organize/review memory. Oversized evidence and model-context incompatibility use the same visible, reconnect-safe notice contract.

FIFO applies only to the pending inbox when the Organizer has independently resolved the same closed missing-model configuration as unavailable on two consecutive serialized attempts and pending count exceeds the configured availability limit. A database-persisted exclusive lease carries a fencing token, expiry, current availability generation, and Project revision into both semantic commit and deletion transactions. A competing runtime cannot overwrite an unexpired lease; expiry permits crash recovery, while configuration changes immediately increment the generation and revoke the lease before another organization request is published. Known failed attempts release only their own lease. The first unavailable attempt only records a visible notice and deletes nothing. FIFO never edits Project `MEMORY.MD` and is never semantic organization. Provider request, authentication, transport, timeout, output, parse, capacity, and evidence-size failures are not closed-unavailable deletion authority.

The one per-Project background driver coalesces a request that arrives during an
active Organizer attempt into the same scheduled slot. When a configuration
change revokes that attempt, the persisted envelope moves to `retry_wait`; the
old model output cannot commit, and the scheduled slot consumes the already
queued request with the new availability generation before it is released. A
stale attempt cannot erase that redrive, leave an `organizing` shadow without a
lease, or discard pending evidence.

The unavailable proof is bound to the exact FIFO-head occurrence, its canonical Task/Session owner, the closed reason, and the configured model. One proof may remove at most that head after the second matching attempt; it cannot delete or advance the retry count for later evidence owned by another Task or Session.

The protected notice is available in Project reads and through the Project-memory Server-Sent Events stream. Overlay startup/project switching hydrates it and renders an actionable banner until the user acknowledges it or an Organizer commit clears it.

Generic semantic-memory search, full-text search, write, update, and delete exclude both protected `user_message` and `project_context` kinds. Project `MEMORY.MD` is exposed through `memory.project_read` and `GET /experimental/project-memory`.
