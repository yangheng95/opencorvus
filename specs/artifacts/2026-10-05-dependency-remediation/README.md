# Dependency remediation evidence

- [Exact open Dependabot alerts](dependency-github-alerts-before.json): seven repository alerts read through the configured GitHub CLI; package, dependency relationship, affected range and official advisory facts. No credential contents were read or captured.
- [Actual Bun audit baseline](dependency-audit-before.json): exit code 1, original stderr and all 39 advisory entries across 12 packages (18 high, 17 moderate, 4 low). This is a retained failure, not a passing acceptance report.
- [Official advisory details](dependency-advisory-details.json): each npm advisory's description, affected/fixed ranges and references read from GitHub's advisory API. A null first patched version remains unresolved rather than an invented upgrade target.

These are read-only dependency/advisory observations from 2026-10-05. They prove reported version exposure, not successful exploitation or a remediated runtime. Installed source, manifest/lock graphs, official registry metadata and upstream tarball inspection underpin the [qualified plan](../../records/2026-10/2026-10-05-dependency-remediation.md). No package install, dependency/lock edit, Provider request or UI test was performed for this baseline. Future outputs must retain this baseline and separately record exact after versions, tests and remaining advisories.


## Stage 1 implementation evidence

- [Exact lock delta](stage1-lock-delta.json): only the ten selected package versions changed; existing patches remain intact.
- [Installation attempts](stage1-install-attempts.json): preserves the first native EBUSY failure and successful retry after owned process settlement.
- [Before relinking](stage1-resolution-before-relink.json), [partial failed relink](stage1-resolution-after-failed-force.json), [final actual importer resolution](stage1-resolution-final.json): actual runtime links, separate from lock version facts. The initial Axios probe used a package root without an export; subsequent probes use the actual Bing engine subpath.
- [Final audit](stage1-audit-after.json): exit1 remains with two high unpatched advisories; no ignore applied.
- [Focused positive checks](stage1-focused-tests.log):15 tests/21 assertions, real local network/serialization/pattern contracts, no UI automation.
- [Backend types](stage1-backend-typecheck.log): current source typecheck result, including concurrently owned source changes.
- [Drizzle beta20 read-only patch assessment](drizzle-beta20-patch-review.json): upstream context inspection only, not an installed ORM repair.

- [Actual final-graph Sol04 result](automation-project-target-real-04.result.json) and [independent immutable database/process/cleanup review](automation-project-target-real-04.review.json): two manual retarget cases, six exact streaming200 requests, actual B file/answer identity, terminal process and paired credential-copy removal. Original result preserved unchanged.

- [Structural integration checks](stage1-integration-checks.json): package/module/SDK/architecture passes and explicit parallel restart API docs generation failure.

- [Published beta12-to-beta20 runtime source delta](drizzle-beta20-upstream-runtime-delta.json): read-only semantic review inventory of the adapter, SQL compiler and SQLite dialect; it is not patch application or runtime acceptance.

- [Prepared beta12 existing-file baseline](stage2-beta12-existing-db-baseline.json): independently checked Sol04 physical DB/WAL state, quiescent raw file-set preservation and exact SQLite schema/revision/Project/Session/Tool facts. No new model execution or exported/rebuilt database. Beta20 domain reopen/update remains pending.

## Stage 2 implementation and qualification

- [Patch transplant](stage2-patch-transplant.json), [complete lock delta](stage2-lock-delta.json) and [actual ORM resolution](stage2-orm-resolution.json): four-file/12-hunk lifecycle adaptation on official beta20, only ORM package version changed, normal/frozen install exit0. [Other patched consumers](stage1-resolution-stage2-frozen.json) retain all ten Stage1 versions.
- [Original-file conditional update](stage2-existing-db-after.json) and [fresh-process reopen](stage2-existing-db-after.json.reopen.json), with [apply log](stage2-existing-db-apply.log) and [verify log](stage2-existing-db-verify.log): canonical validation and real domain read/write, exact six prior revisions/Run/Session/Read history, explicitly paused revision4 selecting target-default model. No Provider or new execution claim.
- [Initial native contracts](stage2-native-contract.log) and [initial shared-owner contracts](stage2-shared-contracts.log):16/110 and38/283 passed before the separately observed TypeScript boundary repair.
- [Original explicit type failure](stage2-explicit-typecheck.log) and [original backend type failure](stage2-backend-typecheck.log): upstream synchronous conditional-return contract identified the two generic wrappers. [Intermediate fixture type failure](stage2-explicit-typecheck-after-owner-adapter.log) records the test's always-throw never inference.
- [Final owner/native/shared contracts](stage2-owner-adapter-contracts.log):60 tests/419 assertions passed. [Final explicit types](stage2-explicit-typecheck-final.log) and [final backend types](stage2-backend-typecheck-after-owner-adapter.log) both exit0; empty explicit output means the command succeeded without diagnostics.
- [Actual remaining audit](stage2-audit-after.json) and [unaltered raw output](stage2-audit-after.log): exit1, two high unpatched findings retained. Rust/platform work and root's new-graph Sol05 qualification remain separate.
- [New-graph real Sol05 result](automation-project-target-real-05.result.json), [independent SQLite review](automation-project-target-real-05.review.json) and [physical/copy cleanup](automation-project-target-real-05.physical-cleanup.json): six exact streamed200 requests, two real retarget/Read/stop-reply runs, immutable revision3/Fire/Run/Session target-B agreement, original raw data read independently. Owned PID5056 absent and paired copies removed. [Actual log](automation-project-target-real-05.log) remains unchanged.
- [Renderer-02 standby review](renderer-02-standby-review.json): read-only actual Message/artifact, exact-input idle Protocol event, consumed wake control and physically live retained Prompt owner. Establishes the new checker lifetime mismatch; this run remains diagnostic/manual evidence, not corrected-checker acceptance. No auth/models contents are included.

- interactive-renderers-real-01/02/03.result.json: retained runner boundary failures/diagnostic retirement, never final acceptance.
- interactive-renderers-real-04.result.json: corrected actual-message/backend/exact-model qualification; six streamed200 requests; manual review separate.
- renderer-04-diagram-after.jpg /renderer-04-timeline-selected-after.jpg: root personally reviewed final gB asset's actual Diagram and Timeline plus selected event/fit controls.
- renderer-04-timeline-inline-after.jpg: actual inline Timeline after returning from its work surface; filename corrected to its real contents.
- renderer-04-physical-cleanup.json /renderer-final-explicit-types.log: actual owned process exit, paired-copy removal and checker type integration.
- Renderer02 images and actual messages are diagnostic/manual history; its long-lived standby was explicitly retired and is not a corrected-runner pass.

Root completed final docs:check and full local Windows Overlay/backend/Tauri compilation. The structural check's earlier missing generated API detail is historical; generated docs now pass345ops/25groups. Remaining advisories and Stage2/Rust/platform qualifications remain open in the linked record.
