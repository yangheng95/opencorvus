# Search-native capability runtime

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
   `CatalogViewSnapshotPayloadV2`. `HarnessProjection` binds the same snapshot
   ref/hash and cannot expand it.
4. `capability_search` is the only executable Harness Tool on revision zero.
   A caller-requested JSON-schema response can additionally use the existing
   reserved `StructuredOutput` response encoder; it is not a capability grant,
   effect, or permission occurrence, but its normalized Provider definition is
   included in the immutable base and total payload budget. Fuzzy results are metadata; only
   caller-supplied `exact_refs` can activate executable leaves.
5. A completed search ToolPart carries the append-only reveal receipt. The next
   Provider step folds receipts and materializes only `capability_search` plus
   the exact active leaves and an already-budgeted conditional response encoder.
6. The specialized Tool/MCP/Skill owner and the existing permission authority
   still validate and execute each concrete call. Search is neither approval
   nor execution.

`TurnCapabilityProjectionV2` is derived solely from persisted receipt Parts. It
is not a Session cache or a mutable Harness table. A new authoritative input
starts at revision zero.

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

- Revision zero's executable Harness contains only `capability_search`, at most
  4,000 normalized characters and 1,000 estimated tokens. The conditional
  response encoder remains outside the Harness but is counted in the immutable
  Provider base and total payload budget.
- One search activates at most five exact leaves.
- At most ten leaf refs remain active.
- The active Provider payload, including every permanent base definition, is at
  most 32,000 normalized characters and 8,000 estimated tokens.
- Any single leaf that cannot fit is rejected and must be split into canonical
  action leaves. `panel` is split into exact `panel_<action>` Tools; the old
  model-facing umbrella and the schema-enumerating `batch` Tool do not exist.

The positive budget contract normalizes every projectable built-in leaf for
the Provider ABI and measures `capability_search + that exact leaf`; measuring
the leaf alone cannot prove that it is revealable. A large discriminated input
may factor fields shared by every branch into one Provider-schema base, but the
factored projection must be derived from and delegate validation to the one
canonical domain schema. It cannot replace precise validation with an opaque
JSON object or create another persistence contract.

The reducer counts the real Provider-normalized search definition from revision
zero, so the permanent Tool cannot sit outside the compare-and-swap budget.

## Exact materialization owners

- Tool Registry initializes only requested Tool IDs.
- Runtime-projected and dispatch-stage Tools live behind one
  `RuntimeToolOwner.leaves` binding list. The runtime contract contains no Tool
  record, `projectedTools`, `stageTools`, or parallel projected/stage ID arrays.
  Each leaf contains immutable factory input; exact lookup constructs only that
  selected leaf and does not retain a cross-step Tool-object cache. Scheduler,
  shared context/codebase, and every stage output owner expose real per-leaf
  constructors over their occurrence-local shared collector; a lazy function
  that first constructs a complete Tool record is not an exact factory.
- Skill and Mission Skill loaders are absent at revision zero. Revealing one
  exact Skill mounts only that Skill; supporting files remain exact loader
  reads.
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

Every Provider step re-reads and hashes the input-bound Catalog before
materializing definitions. Persisted receipt definitions and exact materializer
digests must match on the next step. Permission continuation reconstructs the
same Worker Turn descriptor, package revision, Harness grants, and dispatch-stage
occurrence binding; it does not recreate a broad Tool table. When an effectful
stage Tool pauses beside active pure collectors, recovery validates the
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
