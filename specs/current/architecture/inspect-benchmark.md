# Inspect benchmark boundary

`packages/inspect-benchmark` is the sole Inspect integration. Inspect owns dataset
execution, concurrency, epochs, retries, logs, scoring and viewing. The registered
OpenCorvus solver delegates one sample occurrence to the public Task API. It does
not own Provider calls, scheduling, messages or Task terminal decisions.

Each solver attempt has a fresh request identity. `sample_epoch` creates a fresh
project occurrence even when Inspect restores an existing sample UUID. Observation
uses an inactivity window renewed by durable Task/Session execution facts and actual
conversation output. Poll success and observer timestamps do not renew it. Task
acceptance and terminal evidence retrieval have separate bounded stages. Failed
observations remain errors; accepted completion text is resolved only from the
`summary` input of the exact Completion Decision Tool invocation, bound to its
Session, Message, Tool Part and call identities. No final narration is required.
This is read through the canonical Session Part endpoint, not the display-only
conversation projection that defers large tool inputs. Observation hydrates the
latest unfinished assistant Message for each Session so persisted reasoning also
counts as progress; the observer does not publish that reasoning. Poll intervals
must be shorter than the inactivity window.

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

The official package owns world transitions and rubric semantics. Inspect keeps
ordered real tool events, sealed world state and the private Google Sheets row-write
tracking required by the pinned rubric. Scoring and offline re-scoring restore that
state and call the official rubric. Mutation replay is not used because upstream
record identifiers and timestamps are nondeterministic. Source-tree hashes and
agent self-reports do not establish correctness.
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
