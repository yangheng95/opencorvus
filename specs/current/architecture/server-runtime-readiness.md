# Server runtime readiness

The server runtime has two ordered recovery phases and one listener:

1. Bounded process-local integrity recovery observes the current physical process occurrence, settles orphaned supervised requests and isolated workspaces, reconciles Project deletion artifacts and maintenance fences, and initializes global automation scheduling.
2. The production listener is published and global Scheduler message polling is enabled. From this point the global health transport and delivery retry owner are ready and do not inherit model, Tool, or project-open latency.
3. Durable application recovery starts immediately and is represented by one owned Promise. It opens every affected Project concurrently under its normal Instance lease and reconciles started Task executions, Mission process wakes, and pending Scheduler deliveries. One held Project does not prevent sibling Project recovery or the global poller from progressing.

Initial serve and listener restoration use this exact order. A caller that requires application convergence before performing project work awaits the returned recovery Promise; the desktop server keeps the listener available while it runs and observes the same Promise for failure and shutdown settlement.

Project bootstrap may await a full Task-control scan because the scan must not outlive its Project lease. That local lifetime rule is compatible with global readiness: host recovery owns the Project lease and Promise, while the already-published listener continues serving health and unrelated control-plane traffic.

Application recovery failure never becomes a false success. The Promise rejects and the server logs the failure; global durable polling still starts so unrelated and later-retryable deliveries are not disabled. Shutdown/restart starts process-execution settlement before joining that Promise: settlement closes admission and requests cancellation from the Session/Task owners that may be holding recovery, then Instance disposal and the recovery join converge. Reversing that order deadlocks restart behind the very Provider or Tool Turn that only settlement can cancel. An already-reported recovery rejection never skips process-owned prompt and handoff cleanup. Callers such as ACP that require completed recovery stop their newly created listener before propagating failure. Foundational recovery or listener-bind failure remains pre-ready and settles process-owned execution before returning the error.

Multiple backends may share one SQLite database. Physical process occurrences, Project maintenance fences, Task activation leases, idempotent recovery facts, and SQLite transactions coordinate ownership; listener readiness neither acquires nor recreates a database-path-wide host lock.
