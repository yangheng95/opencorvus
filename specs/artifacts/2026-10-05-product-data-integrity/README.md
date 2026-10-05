# Product data integrity evidence — 2026-10-05

Actual owned development-page interactions and sanitized persistence evidence for the [continuous iteration record](../../records/2026-10/2026-10-05-product-data-integrity.md).

The first batch is qualified with actual desktop interactions, screenshots inspected by the responsible agents and root, real HTTP/persistence checks and exact streaming Sol execution. No UI automated test is run or added. Later defect baselines below remain open work.

| Evidence | Observed behavior / boundary |
| --- | --- |
| 01–04, file-external-before.json, file-overwrite-before.json | Before: saving overwrote a newer external file; renaming silently discarded local input. |
| file-ui-01–06, file-ui-disk-facts.json | After: Ctrl+S conflict retains authored input and external disk content; Save-and-leave feedback is visible; Cancel retains input; explicit reload reads disk; a subsequent shortcut save writes the exact edited content. |
| 10–14, file-mutation-after.json | After: Rename asks before the disk operation; Cancel keeps the old path/input; Save writes before renaming; explicit Discard then Move shows the saved authoritative content at the new path. Final deletion was not performed through the UI; deletion/partial-success behavior has focused positive service qualification, not a visual deletion claim. |
| 08–09, automation-race-*.json, automation-wrong-target-before.json | Before: held actual GET while A was selected, then B edit, caused a PATCH to A. The passthrough proxy generated no business response. |
| 15–18, automation-A-to-B-*.json, automation-empty-selection-*.json | After: actual held GETs 453 and 480 are cancelled by deliberate selection; saved PATCHs target B, preserving its recurrence/project and A. The empty-selection case keeps the same definition count. A deleted target returns explicit feedback and retains the form. C was paused before firing; no worker qualification is inferred from UI configuration. |
| automation-target-db-*.json, automation-target-http-probe.json | Before: persisted new physical revision membership differed from public target reads. |
| target-revision-*-after.json | After: 29 actual HTTP requests, 20 immutable revisions, ordered membership and full backend restart agree; no execution was admitted. |
| automation-project-target-real-01.result.json / .review.json | Independent actual Provider qualification: paired auth/models, six exact gpt-6.1-sol streaming requests, public A→B and [A,B]→[B] manual runs, actual frozen Fire/Run revision, B Session/project directory, completed read result and final reply. Copied credentials/catalog and owned runner were cleaned. Due/retry/restart are separately qualified executor contracts. |
| 05–07, navigation-target-before.json | Open next-batch defect: switching Mission commits B before the dirty decision, and Cancel still leaves B. |
| file-ui-07–08, file-ui-browser-reload-*.json | Open next-batch defect: actual dirty reload has no leave dialog, and reopening shows old disk content; no Stay behavior has yet passed. |
| automation-definition-peer-conflict-*.json, automation-stale-edit-*.json | Open next-batch defects: two real HTTP processes produce paused revision competition labelled RunningConflict with zero Run/Attempt/Lease; an old complete form overwrites a peer's newer prompt. |
| windows-restart-before.json | Open next-batch defect: replacement reaches listening, then its exact native supervisor kills it after old owner exits. Actual target/helper/request identities and physical settlement are retained. |

All runtimes/pages/files are agent-owned. No canonical credential content is included. Screenshots use the browser's unchanged desktop viewport. The continuous goal remains active after this batch.
