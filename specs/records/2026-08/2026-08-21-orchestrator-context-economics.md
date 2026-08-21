# Orchestrator context economics

## Recall

### User request

The user observed that the cost problem in the AutomationBench Base batch is not a context-window
limit but the same information being carried, restated, and rediscovered across dozens of model
calls by Orchestrator, Developer, and Tester. They supplied a batch-level measurement (106.5M
tokens, 80.25M cache read, 25.72M fresh input, 1,991 model calls, 91% of tokens in three Agents)
and a seven-part proposal: three-layer context, per-role projections, structured incremental
handoff, smaller Tool schema surface, a fetch-once shared source ledger, topology by task
complexity, and observability instead of hard token gates. They then asked for a complete plan.

### Acceptance criteria

- Verify the supplied measurements independently before planning on them.
- Produce a phased plan with per-phase exit criteria, ordering rationale, risks and targets.
- Keep strict scoring safe: no optimisation may buy a token metric by losing the exact dates,
  URLs, amounts and recipients strict assertions depend on.
- Each phase must be separately implementable and separately measurable.

### Hard constraints

- Benchmark work stays on the bench branch; only product fixes are cherry-picked to the release
  branch.
- Summaries navigate, Artifacts are authority.
- No hard token ceiling as a gate — truncation buys the metric by losing strict accuracy.
- The Orchestrator must keep reading live Task state per Provider step; a child mutates the
  database while `dispatch_agent` awaits it.
- Plans live under `specs/records/YYYY-MM/**` (AGENTS.MD §5); `specs/README.md` and the directory
  README are updated in the same change.

### Materials read

`session/loop.ts` (`processTurn`, `resolveTools`, system composition, `dynamicContextText`
injection), `orchestrator/agent.ts` (`resolveRuntimeSystem`, `buildSystemParts`, runtime-contract
installation), `orchestrator/dispatch-agent-tool.ts` (attached and detached settlement paths),
`provider/transform.ts` (`applyCaching`), `script/benchmark/external-agent/run-automationbench.ts`
(`SNAPSHOT_TABLES`, `databaseSnapshot`, `redactSnapshot`), and the twenty sealed run directories
under the evidence root (`result.json`, `provider-usage-ledger.json`,
`runtime-database-snapshot.json`, `opencorvus-transcript.json`).

### Independent agent feedback

A review of the first draft was obtained and is incorporated here. It confirmed the root-cause
diagnosis, the "relocate rather than freeze" correction, the priority inversion toward the
Orchestrator, and the call-count arithmetic correction. It rejected four things, all of which are
fixed in this version:

1. The draft claimed the Orchestrator's cache read "only takes two values, nothing else appears".
   That is arithmetically false and the omitted row was printed in the author's own measurement
   output. Corrected in §2, and the claim downgraded from decisive to strongly supporting.
2. The plateau proves a fixed early divergence point; it does not prove that point is exactly the
   boundary after `instructions`. Alternative explanations are now listed, and Phase 0 must
   measure rather than assume. Cache read is a property of the whole common prefix and cannot be
   decomposed into per-block hit counts.
3. The draft named the defect in the existing tail-injection point but did not define a legal
   replacement. Transport design is now an explicit gated deliverable (Phase 1.0) with its
   obligations enumerated, and the claim "no information is removed, therefore strict risk is
   minimal" is withdrawn: position and role change how a model reads a fact.
4. The draft would have added `message` and `part` to a snapshot that runs `SELECT *`. Phase 0 now
   specifies a field-level evidence projection instead.

It also required that the strict/partial floor come from a clean post-fix baseline rather than
this invalid batch, that −67% be stated as an upper bound, that cached tokens not be described as
free, and that metric definitions move from Phase 5 to Phase 0. All are applied.

### Repository search

`grep` for `resolveRuntimeSystem`, `buildSystemParts`, `applyCaching`, `dynamicContextText`,
`SNAPSHOT_TABLES`, `controlPromptProjection`, and `WorkerTurnDescriptor` across
`packages/opencorvus/src`. No existing plan covers prompt-block economics; `docs/` contains older
plan documents but AGENTS.MD §5 forbids adding to that parallel tree.

## 1. Baseline

Twenty-run Base batch: 106,524,648 tokens, of which 80,247,552 (75.3%) cache read and 25,717,925
(24.1%) fresh input; 1,991 model calls, 99.5 per case. Independently recomputed from the sealed
`result.json` files; every figure the user supplied reproduced exactly.

| Agent | total | share | **fresh input** | cache read | **cache hit** | calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| base-developer | 35,885,248 | 33.7% | 2,411,857 | 33,299,968 | **93.2%** | 602 |
| **orchestrator** | 35,642,890 | 33.5% | **19,557,179** | 15,980,800 | **45.0%** | 635 |
| base-tester | 25,597,977 | 24.0% | 2,167,556 | 23,284,736 | **91.5%** | 442 |
| base-researcher | 4,938,049 | 4.6% | 757,399 | 4,127,232 | 84.5% | 149 |
| base-planner | 4,434,536 | 4.2% | 806,891 | 3,554,816 | 81.5% | 143 |

The Orchestrator carries **76.0% of all fresh input**. Developer and Tester together carry 17.8%,
and 93% and 91% of what they carry is served from cache.

The premise "three Agents repeatedly carry the same information" holds by volume. By *uncached*
cost it does not: the workers' repetition is heavily discounted, and the concentration is in one
Agent. Cached tokens are not free — they are billed at a reduced rate, occupy the context window,
consume transfer and latency, still participate in attention, and revert to fresh input whenever
the cache expires or the prefix changes. Phase 5 therefore reports fresh, cached, output, priced
cost, latency and context-window occupancy separately rather than collapsing them.

## 2. Mechanism

Per-call distribution over the Orchestrator's 635 calls:

| cache read | calls |
| ---: | ---: |
| 22,016 | 426 |
| 36,352 | 178 |
| 21,888 | 6 |
| 0 | 25 |

That is all 635 calls and it reconciles to the 15,980,800 total. Note 21,888 = 22,016 − 128, one
cache increment below the main plateau, which is consistent with 128-token quantisation rather
than a distinct prompt shape.

Context median 56,091, p90 73,978, max 92,013. Fresh input median 35,339, p90 52,771, max 79,928.

The cached amount **does not grow with the conversation.** It sits on a fixed plateau regardless
of turn length, so every tool result and every earlier step in the same turn is re-paid in full on
every subsequent call. This is the load-bearing observation, and it is a statement about *where*
the prefix stops, not about how much information is carried.

`orchestrator/agent.ts` installs `system: resolveRuntimeSystem` on the runtime contract;
`session/loop.ts` calls `await runtimeContract.system()` on **every Provider step**, re-rendering
live Task state through `buildSystemParts(requireTask(taskID), …)`. The composed array is
`[environment, skills, instructions, runtimeSystem, …]`, and system precedes all conversation
messages, so any change inside `runtimeSystem` places the divergence point ahead of the entire
conversation.

Workers do not have this problem: their prompt comes from a `WorkerTurnDescriptor` frozen at
dispatch, so their prefix is stable and their history caches — hence 93%.

**What is proven and what is not.** The plateau proves the divergence point is fixed and early.
It does not prove the boundary is exactly after `instructions`. Other candidates that would
produce the same signature: a differing Skill projection, an instruction or profile revision, a
changed tool surface, the message prompt projection, or a provider request-shape variant. The two
plateaus differ by 14,336 tokens, which is unexplained. Phase 0 resolves this by measurement.

Turn accounting: **110 Orchestrator turns produced 635 Provider calls, 5.8 steps per turn.**

## 3. Why the obvious fix is wrong

Freezing the system prompt for a turn is unsafe. `orchestrator/agent.ts` records why: *"A wake can
span multiple model turns while dispatch_agent waits for a child, so the contract resolves
DB-backed task context per turn."* The child mutates the database while the Orchestrator waits.

The correct move is **relocation, not freezing**: keep the live render exactly as fresh, and move
it from ahead of the conversation to behind it.

`session/loop.ts` records that live session-state blocks sat on `system` until 2026-04 and were
relocated to the last user message for precisely this reason. The Orchestrator's
`buildSystemParts` never received that treatment. But that injection point is itself defective for
this purpose: it scans backwards for the last **user** message, and inside a tool loop assistant
and tool messages follow it, so it is not the tail.

## 4. Phases

### Phase 0 — safe observation, metric definitions, and a clean baseline

Nothing below may be judged by cache-ratio inference.

**0.1 Prompt-block attribution.** Per Provider call, record: block order; each block's byte and
token size; each block's content hash; the tool-schema hash and size; and the offset and identity
of the *first block that differs from the previous call*. Report the provider's own
cache-read / cache-write / fresh usage alongside. Do not attempt to attribute cache read to
individual blocks — a cache hit is a property of the whole common prefix, and any per-block
split would be fabricated.

**0.2 Evidence projection, not table dumps.** `databaseSnapshot` runs `SELECT *` per table, and
`redactSnapshot`'s comment states the premise that these tables carry identities and counters
rather than credentials. Adding `message` and `part` wholesale would falsify that premise, duplicate
transcript text into a second sealed copy, inflate the snapshot, widen credential and tool-output
exposure, and create two sources of truth. Instead add a dedicated projection exporting only
identity, role, tool name, status, timestamps, relationship IDs, content length and content hash —
never bodies. Audit `engine_task_root_ingress`, `engine_task_root_ingress_policy` and
`engine_control_activation_lease` field by field on the same basis rather than `SELECT *`.

**0.3 Metric definitions and thresholds.** Define now, not in Phase 5: fresh input per case,
duplicated-input ratio, cache-read ÷ fresh-input, reads of the same Artifact per Agent, model
calls per case, time-to-first-business-write as a fraction of run length, last-write-to-terminal
verification time, repeat planning or verification per obligation. Phase 5 only makes them
standing.

**0.4 Clean baseline.** Re-run the frozen cases after the `decision_ambiguous` repair and seal a
batch that is actually eligible. Every later phase is a paired A/B against that baseline, one
variable at a time, same cases, model, profile and benchmark revision.

Exit: fresh input attributable to a named prompt block and a named first-divergence point for any
sealed run; an eligible baseline batch.

### Phase 1 — stratify the Orchestrator prompt

**1.0 Transport contract (gate).** This is the open design problem and must be settled before any
implementation. A request-only runtime-context transport must be defined that:

- does not break assistant tool-call / tool-result adjacency;
- does not impersonate a user or a tool;
- does not lower the authority of genuine system instructions;
- never enters the persisted transcript;
- does not carry the previous step's stale snapshot into the next step;
- keeps identical semantics on the OpenAI and Anthropic request shapes.

Candidates and their known problems, none yet cleared:

| Candidate | Problem |
| --- | --- |
| Synthetic trailing user message | Fabricates a participant turn; Anthropic already encodes tool results as user messages, so adjacency and consecutive-user-message handling must be proven |
| Trailing system message | Anthropic's system is a top-level parameter, not a tail message; it stays in the prefix |
| Append to the last tool result | Pollutes a tool's real return semantics; OpenAI `tool` messages carry string content only |
| Persisted tail context message | The next step drags the previous snapshot into history and re-breaks the prefix |

One partial design was explored and does **not** close: letting each tool result carry the state
delta it caused. It fits the attached dispatch path, but `dispatch-agent-tool.ts` settles a
*detached* dispatch through a new ingress rather than a return value, so state can change
mid-turn with no tool result to carry it. Any accepted transport must state how it covers that
path.

Note that `dynamicContextText` already performs request-only injection by mutating the projected
model-message array rather than persisted messages, so request-only injection has precedent; only
the position is unsolved.

**1.1 Split.** `buildSystemParts` returns turn-stable parts (instructions, capability projection,
runtime directory, wake identity, dispatch-agent table, Skill surface) and step-volatile parts
(Artifact index, occurrence table, decision log, Delivery Slice state, ingress notice). Stable
stays in `system`, resolved once per turn; volatile moves to the transport chosen in 1.0.

**Estimated effect.** If the Orchestrator's per-call fresh input fell to worker levels (~4k against
a comparable ~56k context), 635 calls at a 35.3k median would drop by roughly 17M tokens — batch
fresh input from 25.7M to about 8.5M, −67%. **That is a theoretical upper bound, not a forecast.**
It assumes the Orchestrator can reach a worker-shaped profile, which it may not: its tool surface,
instructions and live-state volume differ, and the step-volatile block is still paid every step.
The realistic range depends on that block's measured size — 2k, 8k and 20k give materially
different answers. Phase 0 measures it; the range is stated then.

The claim that relocation carries minimal strict risk because no information is removed is
withdrawn. Position and role change how a model weighs a fact, so 1.1 needs its own paired A/B on
strict and partial, not just on tokens.

Exit: Orchestrator cache-hit ratio above 85% with cache read that grows with turn length; strict
and partial not below the Phase 0.4 baseline.

### Phase 2 — role-scoped Tool and context projection

Placed after Phase 1 because tool schemas sit in the prefix: once the prefix caches, schema size
stops dominating fresh input for mid-turn calls and its remaining effect concentrates in
turn-opening calls. That is an approximation valid only while the cache is warm and the tool
surface is stable — it is not a claim that schema size stops mattering, and it does not cover
context-window occupancy or attention effects. The capability-projection layer already exists
(`built_in_tool_ids`, `projected_tool_ids`, runtime-template tool switches), so this configures an
existing seam.

Exit: measured turn-opening prompt size down; strict and partial unchanged.

### Phase 3 — obligation and evidence ledgers, locator handoff

Structured `completed/remaining obligations`, `evidence locators`, `mutation receipts`,
`known unknowns`, `requested next action`; continuations carry deltas since the last checkpoint.
A content-addressed source ledger so a record is fetched once and later Agents receive a locator.

The justification is correctness, not cost: it is the discipline that stops a Tester inheriting the
Developer's account of its own work. Its token effect lands mostly on already-cached worker
context, so it must not be sold as the cost fix.

Hard constraint: summaries navigate, Artifacts are authority. Precise dates, URLs, amounts and
recipients must never exist only in a summary — that is the failure mode behind the seven cases
with partial ≥75% and strict 0.

### Phase 4 — topology by task shape

Default `Orchestrator → Executor → Independent Verifier`; add Planner and Researcher only for
external-rule discovery, multi-source conflict, or genuine decomposition. Base declares exactly one
workflow (`planner-parallel-delivery`, four nodes) and the Orchestrator overlay pins it, so no
legal degraded path exists today.

Scope: a second declared workflow, selector guidance, `requiredWorkflowStructures` in
`check-builtin-expert-squad-topology.ts`, README and selector text, a version bump, and a
`market:data` regeneration.

Call-count arithmetic: Planner and Researcher are 292 of 1,991 calls (14.7%), so removing them
lands near 85 per case, not 40–50. The Orchestrator alone is 31.75 per case (5.5 turns × 5.8
steps). Reaching 40–50 requires reducing turns or steps per turn — separate work, to be planned
once Phase 1 has changed the step economics.

### Phase 5 — make the Phase 0 metrics standing

Record the 0.3 metrics on every run and gate on ratios, never on a hard token ceiling.

## 5. Ordering

Cost, execution efficiency and handoff correctness are three axes and a single total order hides
that:

- context cost: Phase 0 → 1 → 2
- execution efficiency: Phase 4
- handoff correctness: Phase 3

Default sequence: **Phase 0 → Phase 1 → Phase 4 → Phase 2 → Phase 3 → Phase 5.** Phase 0 is
unconditional. Phase 1 leads the cost axis because it addresses the 76% of fresh input where the
cost is. Phase 4 precedes 2 and 3 because its wins are independent of the caching work.

**This order is conditional on where strict failures come from.** If the clean Phase 0.4 baseline
shows strict losses concentrated in handoff — a Tester scoped from a Developer report, a missed
obligation, a self-certified mutation — then Phase 3 outranks Phase 4 on quality grounds, and
token yield is the wrong sort key. Decide that after 0.4, not now.

## 6. Risks

- **Frozen-prefix regression.** An earlier failure had an Agent repeating one Tool call because its
  payload was constant between steps. Phase 1 differs — the tail keeps changing as tool results
  append — but this is the failure mode to watch, and `context-diagnostics` payload sizes are the
  first check if looping reappears.
- **Volatile-block duplication.** If the relocated render restates what the preceding tool result
  already carried, Phase 1 trades prefix cost for tail cost. Phase 0.1 attribution decides this.
- **Provider dependence.** The baseline model `openai/gpt-5.6-luna` uses automatic prefix caching,
  while `applyCaching` places explicit Anthropic breakpoints at system[0], system[last],
  messages[-2] and messages[-1]. Phase 1 should help both, but these numbers are OpenAI-shaped and
  must be re-measured per provider.
- **Baseline validity.** All twenty runs are `invalid_bug` (43 `decision_ambiguous` Host faults
  plus one detached-worker fault). They are sound evidence for prompt economics and unsound as a
  correctness floor. There is no evidence the fault inflated cost: faulted runs averaged 29.5
  Orchestrator calls against 38.4 for clean ones, confounded by case difficulty.

## 7. Targets

Cost targets are measured against the Phase 0.4 clean baseline; the numbers below are this batch's
figures and are placeholders for shape, not the acceptance floor. **Strict and partial acceptance
must come from the clean baseline — this batch cannot serve as a correctness floor.**

| Metric | This batch | Target | Owning phase |
| --- | ---: | ---: | --- |
| fresh input per case | 1,285,896 | range set after Phase 0; ≤ 550,000 is the upper-bound case | 1 |
| Orchestrator cache hit | 45.0% | ≥ 85% | 1 |
| model calls per case | 99.5 | 60–70 (40–50 needs step reduction) | 4 |
| first business write, share of run | 47% | ≤ 25% | 4 |
| Tester total tokens | 25,597,977 | ≤ 12,800,000 (cached tokens; report cost separately) | 2, 3 |
| strict / partial | 3/20, 54.0% (invalid) | not below the Phase 0.4 clean baseline | all |
