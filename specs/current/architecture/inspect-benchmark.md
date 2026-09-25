# Inspect benchmark boundary

`packages/inspect-benchmark` is the sole Inspect integration. Inspect owns dataset
execution, concurrency, epochs, retries, logs, scoring and viewing. The registered
OpenCorvus solver delegates one sample occurrence to the public Task API. It does
not own Provider calls, scheduling, messages or Task terminal decisions.

Each solver attempt has a fresh request identity. `sample_epoch` creates a fresh
project occurrence even when Inspect restores an existing sample UUID. Observation
uses an inactivity window renewed by durable Task/Session execution facts and the
Task live event cursor. Poll success and observer timestamps do not renew it. Task
acceptance and terminal evidence retrieval have separate bounded stages. Failed
observations remain errors; accepted completion text is resolved only from the
`summary` input of the exact Completion Decision Tool invocation, bound to its
Session, Message, Tool Part and call identities. No final narration is required.
This is read through the canonical Session Part endpoint, not the display-only
conversation projection that defers large tool inputs. Observation reads the
existing `(liveEpoch, lastLiveSequence)` from the Task Session conversation endpoint,
using the root Session in the status topology. This Task-wide cursor includes
unpersisted reasoning, text and Tool deltas from descendant Sessions, while display
transport omits reasoning bodies. Heartbeats and other Tasks do not advance it.
Epoch changes and terminal-boundary sequence resets are valid observations; polling
resumes the returned cursor. Poll intervals must be shorter than the inactivity window.

AutomationBench is an optional stateful benchmark integration pinned to an official
source revision. Its manifest freezes domain/task/example identity and order.
Every sample has a new official world, project configuration, loopback Model
Context Protocol service and canonical `automationbench` expert-squad installation.
The service exposes the official search/fetch/encoding business tools. Scoring is
host-owned and has no agent-facing endpoint. Squad prompts and capability
projections define executor/verifier responsibilities; the host introduces no
workflow state machine.
The project config uses `.opencorvus/opencorvus.jsonc`, admitted by the same
ConfigPaths authority as normal Tasks. The solver freezes package bytes before
sample execution instead of re-reading mutable source files for each occurrence.
The visible Task request starts with harness-authored context carrying the exact
effective business clock, then retains the original prompt sections verbatim.
An official `initial_state.meta.current_time` remains authoritative. When the
sample omits it, Inspect fixes one UTC timestamp before constructing the Sample
and uses that value in the request, the initial world and rubric replay. A
paired run passes the same `unspecified_clock` to both occurrences; the original
official prompt and seed remain unchanged. This simulated clock controls
relative-date business calculations; it does not replace real host time,
Provider time or inactivity observation. A malformed supplied timestamp is an
input error. Logs record `case_context_policy=official-world-clock-v2` and
each sample's effective clock. Old v1 results retain their original evidence.
Native task declarations use registered Inspect solver factories:
`automationbench_task_solver` for official Task/Mission samples and
`business_repair_solver` for explicit development inputs. Their logged parameters
are the real input/package paths and configuration; the official factory receives
the task's already-resolved clock instead of consulting wall time again. Both
delegate to the single HTTP/lifecycle solver. Constructor checks alone do not
verify plan/log registration; model-free Inspect evaluations exercise that boundary.

The official package owns world transitions and rubric semantics. Inspect keeps
ordered real tool events, sealed world state and the private Google Sheets row-write
tracking required by the pinned rubric. Scoring and offline re-scoring restore that
state and call the official rubric. Mutation replay is not used because upstream
record identifiers and timestamps are nondeterministic. Source-tree hashes and
agent self-reports do not establish correctness.
The single `automationbench/api_session.py` owns simulated API calls, ordered
events, sealing and raw state serialization. `OfficialWorld` adds official case
initialization and grading; it inherits that same API implementation. Both rubric
restoration and development restoration use the complete serialized world,
explicit connected-service list, effective clock and Sheets write tracking.
Expanded snapshot fields are never reinterpreted as seeded service grants.
Incomplete or non-round-tripping state is an integrity error, not a new initial
world filled with defaults.
The installed official rubric must retain its strict assertion mode, recorded as
`official-strict-assertions-v1`. A disabled policy is rejected; assertion errors
remain infrastructure failures rather than becoming business scores.

Cleanup closes only the sample-owned MCP service and preserves evidence/project
files. Observation failure does not silently cancel the product Task. Completed
and naturally failed Task lifecycles have official business scores; cancellation
and infrastructure failures are unscored. Services and credentials are operator-owned.

The local harness is co-located with the OpenCorvus service and explicitly records
`comparable=false`: project/world separation is not an operating-system security
boundary. `automationbench_local_check` validates actual local MCP, official APIs,
rubrics and snapshot restoration with known inputs. It does not establish model or
expert-squad capability.

Development business-repair inputs use the explicit
`operator-derived-business-repair` envelope in `automationbench/development.py`.
It includes author/reference/description provenance, a new business request and
complete raw state. Its sample setup freezes both input and squad files and uses
the same `environment.py` project/MCP scope as official samples. The visible
request declares seeded records and the state's business clock; it does not claim
that an earlier participant belongs to the current Task. Source provenance is
input attribution, not Host-issued producer authority.

Development events start with the new API occurrence. Output is recorded under
`development_*` metadata with `assessment=not_evaluated`; a closed environment is
not business acceptance. Official case/manifest/scorer identity remains separate.
`opencorvus_business_repair` composes that setup with the existing Mission solver
for one explicitly provided fixture. It has no scorer: real native outcomes and
business evidence remain available for a separately preregistered external review.
`sample_settings` is the single configuration/loopback/source-location validator
shared with official tasks. A task declaration does not start a model or authorize
a run. Fixed initial state alone does not fix the later executor/verifier inputs
or establish causal improvement.
