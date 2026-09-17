# Routine and on-demand capability runtime

This chapter is the current authority for model-visible capability discovery,
occurrence Harness projection, exact Tool reveal, and reconstruction. Tool,
Skill, Mission Skill, Model Context Protocol (MCP), Expert Squad, and dispatch
stage owners keep their specialized lifecycles; they share typed references,
Catalog publication, Harness grants, and one reveal protocol rather than one
universal executable interface.

## Authority layers

1. Each specialized owner publishes immutable, non-secret descriptors and an
   owner revision into `capability/catalog.ts`.
2. `HarnessGrantSet` is pre-materialization authority. It contains one canonical
   list of `{ ref, access, descendant_scope? }` grants and no per-kind arrays.
3. The authoritative input Message is atomically bound to a content-addressed
   `CatalogViewSnapshotPayloadV3`. `HarnessProjection` binds the same snapshot
   ref/hash and cannot expand it.
4. Revision zero exposes authorized routine tools directly. It also exposes the
   production `skill` loader when the authoritative visible user input names an
   exact Skill already granted to that Conversation or Task identity. The
   loader ref and normalized definition are part of the same immutable
   permanent base, active refs, digest, and payload accounting; loading the
   Skill content remains an ordinary model Tool call. One guidance map in
   `capability/routine-tools.ts`, intersected with executable grants, model
   projection, permissions and Message switches, determines the routine base
   and its initial prompt instructions. Declared dispatch-stage interfaces also
   belong to their worker's base. `capability_search` discovers and loads
   specialist and extension capabilities that are not already callable.
   A caller-requested JSON-schema response can additionally use the existing
   reserved `StructuredOutput` response encoder; it is not a capability grant,
   effect, or permission occurrence, but its normalized Provider definition is
   included in the immutable base and total payload budget. Fuzzy results are metadata; only
   caller-supplied `exact_refs` can activate executable leaves.
5. A completed search ToolPart carries the append-only reveal receipt. The next
   Provider step folds receipts and materializes the exact permanent base, exact
   active leaves, and an already-budgeted conditional response encoder.
6. The specialized Tool/MCP/Skill owner and the existing permission authority
   still validate and execute each concrete call. Search is neither approval
   nor execution.

`TurnCapabilityProjectionV3` is a process-local derivation of the input-bound
permanent refs and persisted extension receipts. Its active refs cover the exact
currently callable capabilities. It is not a Session cache or a mutable Harness
table. References form a canonical set union: a matching permanent Registry
Tool may also have a valid reveal receipt and appears once in the projection.
Deactivating that reveal preserves its permanent availability. Definition and
executable-identity conflict validation still applies before projection.
A new authoritative input starts at revision zero with its bound
permanent base, including an eligible exact visible production Skill directive;
v2 search receipts continue to record only dynamically activated extensions.

## Search and reveal contract

One search accepts one to four queries, exact kind/owner filters, at most five
metadata results, exact activation refs, and explicit deactivation refs. Every
supplied structural filter is conjunctive; an empty query enumerates the
structural matches. If the complete structural candidate set is non-empty and
the supplied next-owner kinds remove every candidate, the same frozen view
returns a structured incompatible-filter diagnostic instead of making the empty
result look like an absent capability. The frozen Catalog view and Harness must both authorize every
requested leaf and its behavior target. A Capability Set is never executable
and fuzzy ranking never activates a result.

A complete exact ref supplied by current authored instructions can be submitted
directly in `exact_refs`; a prior metadata-search result is not an admission
prerequisite. Already callable routine tools are used directly. Group additional
leaves needed for the same current decision in one reveal.
Unknown refs still require discovery. Instructions are locators, not grants:
every exact ref passes the same frozen Catalog/Harness and materializer checks,
and a new input still starts from its revision-zero surface.

Mission search additionally reports the held Expert Squad count, the
pillar-filtered visible Expert Squad count, and the canonical persisted Mission
product pillar. A contradictory model-supplied pillar is reported separately
but cannot narrow the occurrence Catalog away from that canonical pillar. These
diagnostics never enumerate held identifiers, select a Squad, broaden the
frozen view, or retry the query.

The receipt records occurrence/search identity, prior and new revision,
Harness/Catalog identity, materialization fingerprint, result refs,
deactivations, normalized definitions and digests, exact materializer binding
digests, active refs, and the active Provider payload digest/size. Its reducer
requires a continuous revision chain and canonical ordering. A completed search
without exactly one receipt, a moved call identity, changed persisted input, or
an invalid recomputed materialization fingerprint is corruption. Valid receipts
remain ordinary visible Tool results.

Candidate definition initialization, MCP inspection, plugin definition hooks,
and Provider normalization happen outside SQLite. The short immediate
transaction re-reads the assistant identity, its canonical input Catalog
binding, all occurrence ToolParts, open calls, and the current receipt revision;
it recomputes the candidate reduction and atomically completes the search Part.
The same search call/Part is idempotent. Concurrent calls use occurrence
revision compare-and-swap; one wins and stale contenders receive a typed
conflict.

## Provider budgets

- Revision zero's permanent surface contains the authorized routine tools,
  `capability_search`, and any eligible exact production Skill loader named by
  the authoritative visible input. Search itself is at most 4,000 normalized characters and
  1,000 estimated tokens. The conditional
  response encoder remains outside the Harness but is counted in the immutable
  Provider base and total payload budget.
- One search activates at most five exact leaves.
- At most ten dynamically revealed leaf refs remain active.
- Revealed extension definitions have an allowance of 32,000 normalized
  characters and 8,000 estimated tokens. The immutable routine base is included
  in total accounting but does not consume the extension allowance.
- SessionLoop's existing predictive budget counts the complete system prompt,
  messages and all tool definitions against the selected model's input budget
  before a Provider call. Routine tools are not silently removed to fit a fixed
  search quota. An irreducibly oversized request returns the existing typed
  prompt-budget error.
- Any single extension leaf that cannot fit is rejected and must be split into canonical
  action leaves. `panel` is split into exact `panel_<action>` Tools; the old
  model-facing umbrella and the schema-enumerating `batch` Tool do not exist.

The positive budget contract normalizes definitions for the Provider ABI,
measures each complete routine role surface and validates extension accounting
beside that immutable base. A large discriminated input
may factor fields shared by every branch into one Provider-schema base, but the
factored projection must be derived from and delegate validation to the one
canonical domain schema. It cannot replace precise validation with an opaque
JSON object or create another persistence contract.

The reducer counts every real Provider-normalized permanent definition from
revision zero in its total digest and size, while enforcing the extension
allowance over extension definitions. Base Provider names are immutable reducer
input. A later authorized capability activation may reuse a permanent Registry
Tool only when its executable ref is the exact platform/tool-registry leaf for
that Provider name and its complete normalized definition digest equals the
frozen base digest. This covers Skill loading and Expert Squad Task creation
through the same rule. The receipt adds the requested ref and materializer
evidence without counting a duplicate Tool definition. A different executable
authority or definition remains a typed conflict; persisted receipt folding
enforces the identical rule.


## Exact materialization owners

- Core projected Task tools derive their exact capability owner from the
  installed immutable runtime factory binding: a projected leaf belongs to
  `runtime-projection:<agentID>`, while a registry leaf belongs to
  `tool-registry`. Artifact snapshot and worker publication validate that same
  exact ref against executable Harness grants and the current occurrence's
  active refs, in addition to persisted call and project/worker identity.
- Tool Registry initializes only requested Tool IDs.
- Every role re-materializes its routine registry and runtime-factory tools from
  the frozen Catalog and Harness on every Provider step, applies permission and
  per-message Tool-switch narrowing, and exposes them without search receipts.
  The Catalog occurrence binds their exact normalized Provider names
   and definition digest before the first Provider step. Continuation and
   permission resume compare that input-bound definition before exposure; a
   version-2 Catalog occurrence lacks this authority and retires through the
   typed stale-input path rather than executing a new definition. A same-input
   continuation materializes the permanent base exactly once for its Provider
   step. Ordinary continuation first persists and owns that step's assistant,
   so a stale Catalog reaches an explicit terminal assistant error without a
   Provider call; permission continuation terminalizes its exact Tool Part and
   likewise performs no external effect.
- `mission_state` exposes one current snapshot/commit protocol over its four
  fixed logical authored files. Their sole physical authority is one canonical
  `state.json` document. A snapshot returns one revision plus all four files in
  canonical order with exact existence, bytes, and content, and preflights the
  exact encoded result against the shared Tool output boundary. A commit
  compares the caller's exact `base_revision` under the cross-process fact
  lock, builds and preflights the complete next snapshot in memory, then
  publishes that generation through one durable atomic replacement. First
  access migrates the former four-file layout once under the same authority and
  retires those physical files; a process exit after publishing the canonical
  document but before retirement is completed from that document on the next
  access. If a valid former layout cannot fit the current complete-snapshot
  boundary, migration writes nothing and returns one typed recovery result with
  the exact Mission directory and per-file/output byte counts. Those former
  files remain the sole authority until an operator archives or trims the bulk
  evidence and retries migration. No current read or write path treats them as a
  second source. One ordinary Mission wake takes at most one snapshot and makes
  at most one commit; a scheduler Message that changes no authored state does
  neither. Per-file model operations, a second bundle, a Session cache, and a
  database mirror are not current authorities.
- The Provider base is immutable per input occurrence. An older occurrence
  whose bound base differs from the current permitted routine definition retires
  with `StaleCatalogOccurrenceError` before execution. A new authoritative input
  binds the new base; old grants are never expanded from a replacement catalog.
- Runtime-projected and dispatch-stage Tools live behind one
  `RuntimeToolOwner.leaves` binding list. The runtime contract contains no Tool
  record, `projectedTools`, `stageTools`, or parallel projected/stage ID arrays.
  Each leaf contains immutable factory input; exact lookup constructs only that
  selected leaf and does not retain a cross-step Tool-object cache. Scheduler,
  shared context/codebase, and every stage output owner expose real per-leaf
  constructors over their occurrence-local shared collector; a lazy function
  that first constructs a complete Tool record is not an exact factory.
- Skill and Mission Skill loaders are absent at revision zero unless the
  authoritative visible input explicitly names an already projected production
  Skill. That exact production loader is frozen into the permanent base without
  a search receipt; its content is still loaded only by the model's visible
  Tool call. A later exact Skill reveal expands that same loader through a
  normal receipt, keeps the base definition and payload unchanged, and is
  reconstructed and permission-checked from every active Skill ref. Revealing
  one exact Skill mounts only that Skill; supporting files remain exact loader
  reads. The loader's Provider definition is stable across an empty, denied, or
  expanded compatible Skill set; current names and availability appear only in
  its Tool result. Capability identity (`ref.local_ref`) and executable Skill `name` are
  distinct: initial reveal and receipt reconstruction resolve the exact frozen
  descriptor's `open_skill.name` or `open_mission_skill.name` before applying
  the existing mount eligibility checks. They never treat a package ref as a
  loader-name alias or consult a replacement live catalog. Selecting another
  Skill rebuilds the loader from the selected identities even when that loader
  already exists; its existence does not imply the new Skill is active.
  Projected loader availability comes from the same resolved Skill surface for
  schedulers and workers. A scheduler's runtime-owned loader placeholder is
  finalized by the specialized Registry loader; the Registry-only subset of
  Tool grants cannot stand in for the role's complete projected authority.
  Every loader finalization applies the current Message Tool switches and merged
  Agent/Session capability rules to both loader visibility and required tools.
  The same merged rules govern exact Skill eligibility. A newly selected denied
  Skill returns `CapabilityRevealAuthorizationError` with `execution_not_granted`;
  a previously recorded activation that current policy cannot reconstruct retires
  through `StaleCatalogOccurrenceError`. Finalization cannot restore a disabled
  loader from its broader Harness grants.
- A direct Conversation or Mission publishes callable MCP children only from
  its exact Host Session owner. The project/config inventory remains status and
  metadata authority; it is not a second executable owner for the same
  occurrence. The composer reads one immutable Host inventory, applies the
  merged capability rules and per-message Tool switches to its child names,
  then publishes only eligible Tool views and exact `{ server_ref, tool_ref }`
  parent bindings. It never expands Harness grants after the Catalog is bound.
- Host Session MCP recovery uses the frozen `{ server_ref, tool_ref }` parent
  binding only when an exact leaf is materialized. A present owner must match
  the occurrence revision and binding and therefore skips another full
  inventory scan. A missing owner is ensured for that one parent without
  closing searchable or active sibling owners; the exact Tool definition is
  then re-read and checked against the frozen binding. The ensured owner,
  revision, and exact binding are revalidated first, so a removed, failed, or
  auth-blocked leaf is typed stale rather than a generic missing-binding error.
  Computer Host endpoint
  and authorization values are fresh per-process transport coordinates, not
  capability identity; its command, logical configuration, and exact runtime
  scope remain in the stable Catalog digest. The live connection identity still
  includes the full endpoint and authorization so adapter rotation always
  reconnects instead of reusing an old transport.
- Native and Task-projected exact MCP materializers verify frozen owner,
  configuration, and definition digests. They also re-read the exact inventory
  before final lifecycle input, the plugin hook, and business `tools/call`.
  Drift becomes a typed `StaleCatalogOccurrenceError` before those final
  boundaries. An MCP App partial-input participant may already have been
  published; stale preflight settles that existing participant in its error
  lifecycle with the source failure message, while the outer Tool/assistant
  occurrence terminates with typed `StaleCatalogOccurrenceError`. Neither path
  admits final input, the plugin hook, or `tools/call`. Re-entry reuses a
  controller only when session/message, server/config, Tool definition digest,
  resource URI, and configured or Expert Squad authority are identical. A
  same-name identity conflict is typed at the controller registry and maps to
  exact stale receipt evidence at the Session boundary.
  A `listChanged` notification after a call has begun advances the next
  snapshot without invalidating that already-authorized effect. Identical
  concurrent inventory reads converge on the existing immutable snapshot
  rather than competing on object identity.
- Package/default MCP Tool refs are pinned by the immutable Task package and
  projected materializer binding and use the same call-time assertion through
  the projected extras wrapper. MCP prompt/resource names and bounded
  descriptions are searchable metadata under the assigned server's discovery
  scope, with a typed unavailable next owner and discover-only explicit leaf
  access. Their bodies are neither fetched nor injected into the system prompt.

Full MCP Tool-record projection APIs are retired. Catalog preparation may list
metadata for an explicitly assigned owner, while Provider projection and calls
use exact leaves.

## Recovery and integrity

Effectful stage materializers bind the same normalized JSON input that their
input digest covers. Optional object properties with undefined values are
omitted at this one boundary, before both in-memory ownership and persistence;
array entries and other values must be valid JSON. Initial exact reveal and
recovered reveal therefore fingerprint the same binding without weakening the
canonical digest or project/worktree authority checks.

Every Provider step re-reads and hashes the input-bound Catalog before
materializing definitions. Persisted receipt definitions and exact materializer
digests must match on the next step. Permission continuation reconstructs the
same Worker Turn descriptor, package revision, Harness grants, and dispatch-stage
occurrence binding; it does not recreate a broad Tool table. An effectful
permanent Registry leaf has no reveal receipt, so its canonical permission
Provider digest binds the same normalized definition digest and the same
Catalog/Harness materializer-binding digest used by reveal materialization.
Direct execution and permission continuation derive that authority through the
same Registry wrapper. A changed definition or owner binding therefore changes
the existing permission request identity, retires the approved continuation as
typed stale, and performs no external effect; there is no name-only built-in
fallback. Recovery also reconstructs the persisted JSON-schema
`StructuredOutput` reservation before folding reveal receipts. A missing
Harness grant, missing exact Registry materialization, or Tool removed by the
current permission/switch projection terminalizes the recovered ToolPart and
retires the continuation as typed stale; these failures cannot remain in every
later startup scan. When an effectful stage Tool pauses beside active pure collectors,
recovery validates the
exact effectful Tool set and materializer digests, validates the versioned
reducer/toolkit binding, and folds completed collector ToolParts in one
canonical total order before materializing the exact active leaves. A
deterministic binding or reducer mismatch is a stale continuation fact: the
permission ledger retires it once so later bootstrap scans replay zero copies.

The reveal transaction refuses active-set changes while non-search Tool calls
are pending/running. Runtime contracts cannot replace the exact Tool owner
within the same occurrence. Provider/model/config/plugin, package, Catalog,
Harness, MCP owner, or definition drift fails closed as stale/corrupt evidence;
there is no latest-state fallback.

All Language Model (LLM) calls continue through the single streaming Provider
entry. Native OpenAI/Anthropic server-side Tool Search is not a second runtime
path; it remains excluded until its events can reproduce the same visible
ToolPart, receipt, recovery, and permission semantics for every Provider.
