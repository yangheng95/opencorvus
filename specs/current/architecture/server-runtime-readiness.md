# Server runtime readiness

Managed SDK startup accepts only the occurrence-bound readiness receipt. On
timeout, abort, failed receipt or early exit, it settles the owned process and
drains its pipes before attaching the byte-bounded diagnostic tail to the
primary error. Output does not determine readiness. Failed credential-free
packaged first-run checks retain their isolated runtime and result path for
diagnosis; successful checks remove that owned temporary runtime.

The SDK observes the exact receipt file through one bounded-lifetime stat
watcher. Directory notifications are not readiness authority: an atomic
publisher's temporary-file event can arrive before the final rename, and
runtime event coalescing can omit that final notification. Observation stops
on the validated receipt, failure, or caller cancellation; each launch keeps
its own directory and occurrence identity. Startup deadlines remain unchanged.

The server runtime has two ordered recovery phases and one listener:

1. Bounded process-local integrity recovery observes the current physical process occurrence, settles orphaned supervised requests and isolated workspaces, reconciles Project deletion artifacts and maintenance fences, and initializes global automation scheduling.
2. The production listener is published and global Scheduler message polling is enabled. From this point the global health transport and delivery retry owner are ready and do not inherit model, Tool, or project-open latency.
3. Durable application recovery starts immediately and is represented by one owned Promise. It opens every affected Project concurrently under its normal Instance lease and reconciles started Task executions, pure Mission `closing` occurrences, pending Mission delete-retention intents, opened-Mission process wakes, and pending Scheduler deliveries. One held Project does not prevent sibling Project recovery or the global poller from progressing.

Initial serve and listener restoration use this exact order. A caller that requires application convergence before performing project work awaits the returned recovery Promise; the desktop server keeps the listener available while it runs and observes the same Promise for failure and shutdown settlement.

Before listener publication, process-local recovery queries the bounded current Workspace lifecycle frontier in SQLite and directly reads each Database/Project/Workspace-scoped durable journal; it does not enumerate permanent publication history. A frontier with a live or unknown physical process occurrence is preserved. A dead-or-reused owner may be replaced by the current process: an admission without an intent is settled because no Git effect can precede intent publication, a terminal public intent releases its frontier, and an open intent continues the same reducer. A public create or delete re-enters the exact Project identity and replays its frozen named-worktree or removal plan through the normal directory admission and Git writer lease. Recovery publishes a Workspace row only after registration, readiness and sandbox ownership are all proven, and retires the row only after directory, registry, exact branch and sandbox settlement. A Workspace child handed to an in-progress Project deletion remains attached to that Project deletion authority; its terminal frontier remains until Project cascade, generic recovery reports and retains it instead of manufacturing a replacement deletion fence, and the canonical Project deletion retry consumes the same child occurrence.

Project bootstrap may await a full Task-control scan because the scan must not outlive its Project lease. That local lifetime rule is compatible with global readiness: host recovery owns the Project lease and Promise, while the already-published listener continues serving health and unrelated control-plane traffic.

Within one Project, every Mission reconciliation request enters one long-lived bounded driver queue, whether it came from startup enumeration, the level-triggered heartbeat, a durable lease/liveness deadline, or a direct request. Discovery reads fixed cursor pages of four candidates. Four scans may run concurrently and four more may wait; excess hints are coalesced into the next level-triggered heartbeat instead of retaining more Promises or entries. Settled Mission candidates retain no per-candidate timer or driver history. Disposing the Project settles the finite waiting set and prevents rearming. Another Project owns another queue, and Scheduler delivery drains concurrently, so a held Project cannot cause cross-Project head-of-line blocking or postpone an already-ready delivery. Each Mission reducer still obtains its own durable lifecycle lease and exact Session Prompt ownership; the process-local queue limits physical work only and carries no recovery authority.

Mission startup and level-triggered recovery read current immutable facts rather than scanner progress. A pending `mission.retention.delete_requested` event takes priority and enters the same lifecycle-lease cleanup owner as the direct delete route; archived Sessions remain discoverable for this one intent, and `session.deleted` removes the candidate. A latest `closing` event otherwise resumes the exact persisted close provenance. An opened occurrence with interrupted assistant work either preserves a live durable Prompt owner or uses the deterministic real recovery Message keyed by that opened event, the exact dead owner generation, and the canonical interrupted-frontier digest. A later owner generation may therefore create another recovery occurrence inside the same still-open Mission without being absorbed by an older settled reply. The Message and exact dead-owner release are one write-ahead transaction, so owner loss before or after frontier terminalization remains recoverable from that same Message. Close uses the same strict Message/frontier reader and cannot commit `closed` until an actionable recovery ingress has one completed canonical reply and its exact interrupted frontier is terminal. Lease loss, caller cancellation, and one absolute recovery deadline share the signal used by terminalization, wake activation, completion waiting, and lease handback. A physical interruption remains actionable for the same Message; any other terminal assistant reply settles only that exact generation/frontier. No `mission_process_recovery` Session-control kind exists in current code.

Before Project deletion manifests are reconciled, listener preparation reconciles every active standalone Session-deletion manifest. Each exact Session member is fenced by the shared control-lease table while its runtime-process occurrence is live, including the interval after database deletion commits and before physical cleanup settles; startup and peer retries preserve that owner. Only an exact dead-or-reused physical process observation permits a successor to supersede the fence. A retained complete Session tree with no operation-bound delete facts restores its exact quarantined conversation roots and retires the abandoned occurrence. An absent exact tree with all expected operation-bound `session.deleted` facts removes the quarantines and records the completed cleanup receipt. Mixed membership, mixed delete facts, path drift, or a database-instance mismatch is reported and retained for explicit repair; startup never guesses a direction from timestamps, lease age, or directory absence.

Scheduler wake recovery follows the same occurrence rule. Its SQL reader returns a bounded page of active candidates in stable inbox order, with each row carrying the opened event that preceded its immutable envelope. Closed occurrences are removed in SQL before the limit, and admission reasserts the exact opened event before any Session effect. Completed-error replies remain retryable inside that active occurrence but become terminal closure evidence after its closing boundary; they never enter a later reopen. Pending Project discovery and recipient drain read only inboxes without terminal receipts plus exact active wake candidates rather than projecting full scheduler history. Wake recovery, Mission recipients, and Task recipients are interleaved into one work-conserving frontier. Fixed SQL cursor pages bound discovery, while the global `execution_capacity.scheduler_message` value bounds active Project and recipient effects without owning their FIFO, retry, lease, or settlement facts.

Application recovery failure never becomes a false success. The Promise rejects and the server logs the failure; global durable polling still starts so unrelated and later-retryable deliveries are not disabled. Shutdown/restart starts process-execution settlement before joining that Promise: settlement closes admission and requests cancellation from the Session/Task owners that may be holding recovery, then Instance disposal and the recovery join converge. Reversing that order deadlocks restart behind the very Provider or Tool Turn that only settlement can cancel. An already-reported recovery rejection never skips process-owned prompt and handoff cleanup. Callers such as ACP that require completed recovery stop their newly created listener before propagating failure. Foundational recovery or listener-bind failure remains pre-ready and settles process-owned execution before returning the error.

Wake settlement classifies the exact rejected abort reason carried by its runtime reservation, or a typed execution cancellation, as expected cancellation at info severity. An unrelated error remains a failure; matching shutdown text is not cancellation authority. This logging classification never changes the durable wake receipt or retry policy.

Multiple backends may share one SQLite database. Physical process occurrences, Project maintenance fences, Task activation leases, idempotent recovery facts, and SQLite transactions coordinate ownership; listener readiness neither acquires nor recreates a database-path-wide host lock.

A required current-process identity query preserves its platform-reader cause in
`RuntimeProcessIdentityError`; POSIX command output is bounded to4096bytes. A
failed query of another owner's identity still yields unknown-live when that
process is alive, and never grants takeover on the strength of a failed query.

File logging uses one asynchronous Pino destination per process generation. The
existing lifecycle mutex serializes initialization, flush and close; cached
loggers resolve the current generation. A completed file flush joins writes
already in flight through the file destination's callback before readers or
support-bundle export rely on its bytes. Optional stderr fan-out is diagnostic
output, not the authority for file completion. With no open file destination
there is no file flush obligation. Log records remain asynchronous; the one-byte
minimum buffer threshold enables the library's drain-and-sync completion
contract without delaying a nonempty JSON record for batching.

## CLI run completion and error transport

`run` owns one submitted input Message identity. It opens the project event stream and
observes `server.connected` before submitting that Message. Only `idle` or `terminal`
for that exact Session and input Message settles the event reader; an intermediate
`step_finish`, a peer occurrence, or a heartbeat cannot complete the command. Normal
standalone replies settle idle; Task/Mission lifecycle reducers remain unchanged.
The reader cancels its owned connection before releasing its stream lock. The command
also joins its HTTP request, so full output and reply failures precede process exit.
Local bootstrap settles its own runtime; attached execution releases only client resources.

`--format json` emits one JSONL error on input, configuration, HTTP, stream or Provider
failure and exits 1; a successful run exits 0. Named errors retain their names/data,
HTTP errors include their operation and status code, and an allocated Session ID stays
on the envelope. A Session-only error event is not authority for another input's outcome;
the exact request/reply and matching lifecycle supply that outcome. Text mode renders
the same diagnostic. The existing run inactivity setting defaults to 300000 ms (0
explicitly disables it), bounds silent initialization and remains active until both
request and stream settle. Real current-Session message/part/tool progress renews it;
server heartbeats and other Sessions do not. The permission hydration request shares
the command's cancellation signal. Explicit agent IDs are validated without loading a
client-side Instance; configured agent availability and permissions remain server-owned.

Configuration mutation admission uses one ownership order shared with Skill readers
and recovery: durable Skill catalog owner, Skill reference owner, conversation
reference owner, Config generation writer, then config-file writer. Both Skill
reference primitives first enter the existing recovery-capable catalog owner. A
projection can therefore finish its Config read before a concurrent writer excludes
readers, and a published-but-unconfigured replacement can re-enter a global Config
write under the same catalog owner. Project initialization, global/project config
updates and Task/Mission/Session capability reads share this boundary. Reference
admission now waits for catalog recovery as well as its process-local lock; it does
not create a second catalog or skip pending replacement settlement.
