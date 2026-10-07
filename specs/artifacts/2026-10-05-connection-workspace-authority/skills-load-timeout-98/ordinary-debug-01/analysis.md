# Ordinary DEBUG01 independent analysis — 98

## Recall / scope

Root executed the existing current checker; parent unified command joined exit0 and both owned occurrences are closed. This independent read-only analysis reads result.json, both occurrence result/launch/startup files, both complete phases.json and raw server.log, current checker/diagnostic source, and only safe existing95 launch/route/log metadata. No requests, service/process operations, Provider/auth/model contents, source/test or other evidence changes. This file does not replace passed/failed raw outputs or declare95 latency fixed.

## Actual requests and pool

Seven serial client200 accepts plus three restart client200 accepts and one real caller cancellation. All eleven backend mount requests settle200. No client timeout occurred in this run.

| Case | Exact requestID | client ms / outcome | backend ms |
| --- | --- | ---: | ---: |
| first-a |4d03b924-b584-4794-82e5-8e1f3a4516d1|384.241 /200|372|
| warm-a |896b67fb-d07b-45fe-a3ca-cee7dc754206|101.153 /200|96|
| first-b |827c241b-a67a-4e8d-bdc5-fefaf8b2d2fa|150.588 /200|147|
| parallel-a1 |17cfe3b5-090d-49d0-bb36-f4e66c6cf16c|146.703 /200|142|
| parallel-a2 |deb60656-af51-45e5-a4bb-3fa287e7ff65|216.289 /200|210|
| parallel-b |6c4d4d1c-68dd-4c3c-9a68-e5075f7d6c7a|260.959 /200|255|
| refresh-a |c01125c6-fe91-4918-8f82-11a97a79617e|118.734 /200|116|
| restart cancel-a |c912f588-2ba7-4583-80e6-738b84aeeccd|181.464 /caller-aborted|382|
| post-cancel-a |8065db1c-f66c-4feb-9fd4-9fdd3b6e09c9|170.225 /200|161|
| parallel-b |aef044da-328e-4ca1-868f-610c55def49e|206.314 /200|197|
| settled-a |826811c8-ea2a-4929-9294-495deefcd0d2|100.664 /200|96|

The cancellation exact ID agrees with result.cancelRequestID and backend completion; its200 is not a client accepted pool. Each accepted response keeps the complete validated Matrix in memory and publishes safe full-pool counts: scope=project/activeProfile=base,7 Skills, source_type builtin6/unknown1; ordinary source admission classifies6 builtin+1 canonical package-resource. Risk counts low6/medium1. There are6 actual actors: orchestrator/orchestrator, universal-build/build, base-developer/build, base-planner/delegated-worker, base-researcher/explore, base-tester/delegated-worker. Grants are7 each except universal-build6, total41 per matrix. These counts are this current fixture's output, not95 or prior Work Skill source equivalence.

## Non-overlapping wall stages and nested costs

First-a diagnostic request begins09:45:38.966Z and settles09:45:39.337Z (371ms, versus backend372ms). Matrix first stage starts149ms after diagnostic request start. Its sequential stage durations are config27ms, inventory44ms, projection138ms, registry2ms, assembly8ms (reported duration; assembly timestamp bounds7ms). Their reported219ms cannot explain the initial149ms and small interstage/serialization gaps; nested timers are not added again. Source request instrumentation covers downstream runtime/route work before matrix entry, so the149ms is a real pre-matrix gap, not proof of a specific initializer or native syscall cause.

Inside first inventory: catalog total43ms contains admission3/held36/release4, plus recovery0/revision1/config-reset1 and actual nested inventory/Skill initialization. Skill builtins7ms, config directories11ms, explicit scan1ms, inventory Skills23ms, inventory projection1ms. Config loads25ms and11ms occur in separate initializer contexts. Nested State read/initialize durations overlap their owning phases and must not be summed into total.

First projection138ms contains projection.package115ms, capabilities14ms, selectors5ms and projection.skills1ms partly parallel with package. Package phase encompasses canonical identity/discovery and runtime snapshot loading/materialization; there is no finer materialization phase proving all115ms is bytes extraction. It is the largest observed direct projection contributor, not a19-second hotspot.

Restart cancel request diagnostic381ms/backend382ms begins09:45:44.893Z. Matrix entry is170ms later; config35ms, inventory49ms, projection114ms, registry3ms, assembly8ms. Its catalog admission7/held41/release1, total49ms; builtins8ms, config directories15ms, two explicit scans1ms each; package92ms. The real181ms cancellation happens while backend continues, and complete balanced phase settlement follows.

Across the entire serial occurrence maximum catalog admission97ms, held92ms,total110ms; restart maxima admission17ms,held41ms,total49ms. Serial longest package phase144ms occurs in warm parallel-a2; longest overall request371ms. These are bounded observed values in this run, not locks proven always fair or cold processing permanently fixed.

## Initializers and causal attribution

Serial has560 diagnostic rows:280 started and280 completed. Grouping by exact spanID finds one start/one completion for every span. Restart has298 rows:149/149, equally paired. Raw server log matches actual server request IDs/results and diagnostic outcomes rather than merely checker status.

Serial17 state initializers: config9,inventory4,Skill4. First-a owns4 (config2/inventory1/Skill1); first-b owns3 and refresh-a owns3. The remaining7 have null HTTP identity. They are **not startup**: they complete09:45:40.311–.648Z, after the serial matrix and actual public Project/current starts09:45:39.989/.378Z. They comprise config5/Skill1/inventory1 and are associated in time with those later bootstrap/boundary reads; source only instruments /skill/mounts HTTP context. Thus `httpUnattributedInitializations=7` is accurate, “7 startup initializers” is false. No before-first mount initializer contamination is shown by these7.

Restart has7 initializers (config3/inventory2/Skill2), all HTTP-attributed. State read dispositions are serial17creator/36cached-settled and restart7creator/25cached-settled; no join-pending was observed. Warm A+A+B concurrency is real, but this data does not qualify simultaneous cold callers joining a pending initializer. Refresh/restart/abort subsequent output is correct for the current ordinary set; no leakage/deadlock/recovery loop is established here.

## Ownership, boundary and closure

Parent43944/win32:639269631318405744; serial source50212/win32:639269631346965376 and helper33780/win32:639269631346481192, occurrence675949c8-7b63-409f-ab74-d2b53d91a3b3. Restart source36924/win32:639269631409168985 and helper7784/win32:639269631408647951, occurrence04dafe5b-f53b-4115-9fd5-cdde9354bd8a. Both public shutdowns200, terminal exited0, source/helper observed dead_or_reused, final port free. Project/current after the matrix verifies ProjectA/B worktree equals exact owned directory. Root separately joined the whole checker; these reported physical facts are not a new child process inspection by this analysis.

Ordinary root is retained, not automatically deleted. Auth/models metadata both present=false in both occurrences; expected canonical model-catalog producer is a label, observedProvision=false, so no model catalogue or Provider projection is qualified. No process/DB recovery was triggered by this analysis.

## Comparison with95 and next missing facts

95 real request a8fc530d... took19439ms, client timed out around15.5s, warm235ms.95 had no DEBUG phase rows, so its slow stage cannot be assigned from this384ms run. Current ordinary uses explicit CONFIG_CONTENT={}, fresh empty non-Git ProjectA/B, no retained Task/Chat history and existing NodeProcess/native helper deployment with DEBUG.95 actual launch-arguments/native-host-ready binds live-sol-cli-owned --owned-host, source serve/--project-dir18042/INFO and its own Host/Target occurrences; the earlier tool-detail-ui-launch is historical reference, not actual95 launch provenance. Same binary/root implementation or7pool is insufficient to prove full configuration/environment/Task parameters match.

No models.dev provisioning log was observed in the original95 owned dev.log either, but that alone does not establish catalog file contents/presence before cleanup. Do not read/copy original auth/models or manufacture a named model to make reproduction match.95 route metadata contains actual new ordinary Chat and Project, but does not expose all config/default/Skill source facts. Its UI initial reconciliation also runs MCP/config concurrently after Task/meta restoration; the standalone checker makes only mount calls and minimal health/metadata before first-a.95 earlier public Project/Chat reads and host/backend warm ordering are different from this checker. Those differences need actual safe facts, not guessed actor/model causality.

Next minimum Root preparation should record: exact95 launcher source/argument+environment-key/value-presence contract for owned HOME/XDG/config-content/config-dir/disablecompat and cwd/helper ownership; safe effective config projection (model field present/empty/named provider+model only, prompt_profile.active, skill_policy count, configured paths/URL category counts and ownership—not values, credentials or descriptions); actual first mount query scope/sessionID/expertSquadID/refresh; whether any actual Task binding/Session override exists, using public IDs/revision/kind rather than name; ordering of startup/boundary/Chat/catalog/config/MCP loads and actual same-run competing publication owner. Reading configuration files wholesale or adding Provider preflight is not necessary to establish these facts and is not authorized here.

A strict reproduction should then use the same one existing launcher/checker and declared source set, enabling existing DEBUG before first relevant work, preserving15s timeout/60s exact backend convergence and current physical shutdown. Root must separately admit any missing parameterization to reproduce UI reconciliation concurrency; no second runner/Skill owner or synthetic delay is justified. If a named model field is truly necessary, record its validated configuration authority separately; do not turn its availability validation into a model request or add credentials. Neither a formal Task nor LLM generation is required merely to reproduce a project-scope mount unless actual query/lineage proves that context.

Current result is a genuine fast ordinary baseline with balanced phases and correct local matrix/closure. It narrows the next investigation by showing this explicit empty/default source set does not reproduce95, and leaves95 slow-phase/root cause and strict same-input reproduction unmet. No timeout increase, optimization, fallback or product fix is justified from pass alone.

## Raw diagnostic coherence

A complete semantic comparison of each raw server.log diagnostic row against the corresponding phases.json row used spanID, phase, status, duration and HTTP requestID: serial560 raw/560 parsed rows and restart298 raw/298 parsed rows, with zero differing tuples. This confirms those saved phase inputs match the actual diagnostic records; it does not add source-equivalence, cold-join or95 acceptance qualification.
