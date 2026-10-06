# Directory filter draft implementation freeze

## Recall and owned files

Read next-directory-artifact-implementation-plan.md Recall/Binding before editing. Own only new session/directory-filter.ts, Session index, Mission session, engine store and new test/session-directory-filter.test.ts. Save source before, actual after/diff, type logs and static investigations here. No checker/test/runtime/HTTP/Provider/credential/UI/Git or shared-index operation. Root alone runs actual backend tests, module checker and Windows HTTP. File-comparison source untouched.

## Current implementation

One sessionDirectoryFilterCondition uses existing Filesystem.resolve and Project.samePath. Within the caller's read transaction it selects distinct actual Session directory values, optionally constrained by the caller's genuine Project, filters lexical matches and binds saved values through installed inArray. Empty/omitted filter returns no extra condition; unmatched values yield the primitive's false SQL predicate. There is no copied SQL normalization, row rewrite, alias stat, cache or after-limit directory filter.

Session local/global and Mission local/global read callbacks now use Database.transaction for the catalogue plus final query. Only their old raw directory predicates are replaced; original scope/other conditions/order/cursor/limit and Session deletion handling remain. Global Task replaces raw joined-directory JavaScript equality with that same SQL condition; its existing status/title/deletion/projection/compound cursor/sort/slice remains unchanged. Project Task and exact owner equalities remain unchanged. Reviewed the three original-file diffs and new helper/test diffs against actual pre-edit copies.

## Compilation and test source boundary

`typecheck.json` extends the configured backend tsconfig, includes **all backend src plus the new test**, and explicitly includes the existing installed Bun types. node node_modules/typescript/bin/tsc --noEmit -p <this directory>/typecheck.json initializes no product runtime. Initial compilation passed before the added Mission pagination case; frozen compilation then caught an extra closing parenthesis at test line 149. Root specifically authorized that exact syntax correction; original typecheck-frozen.log remains. `typecheck-corrected.log` and final `typecheck-final.log` both exit **0**. No test execution or functional acceptance is claimed.

The new positive test source uses existing actual owned memoryProject, real Session/Mission creation, established Task/native-binding fixture and Server.App routes. It exercises Windows native/forward/case/trailing outputs with exact persisted IDs, local/global and sibling/Project scope, no-filter/empty-filter, Session/Task and Mission compound pagination, Task title/status and cross-platform InvalidDirectoryError/direct and actual route status/body. Two functional tests are Windows-only; they do not fake process.platform. Their Server.App calls are future checker source, **not performed HTTP by this child**. Fixture lifecycle includes real owned Git/native resources and must be executed by Root's existing isolated runner; no Provider/LLM call is authored.

## Topology evidence and corrected initial suspicion

static-edges.json is a conservative literal relative/@ graph including type imports and callback dynamic imports, 975 reachable modules. It initially suggested helper→Project→Git→supervisor→binding→store; that was not initialization-SCC proof. util/git imports ProcessSupervisor as a type, and concrete supervisor loads only at first physical spawn inside the process-facade callback. Read those actual definitions and preserved the corrected analysis in samePath-ownership-review.md.

Root's actual --index snapshot b19e703a1266 passed 1133 modules / 5788 runtime edges, zero SCC and 4 clean imports. That result belongs to Root. The current helper does not spawn Git/processes; original Project.samePath use is Root-qualified. Filesystem primitive ownership migration remains a read-only, **unimplemented and unnecessary** candidate; no additional production files or abstraction were changed. Public caller and same-semantic definition inventories are retained as evidence, not a test gate.

## Limits and handoff

Lexical equivalence follows the existing primitive; physical aliases, per-directory Windows case-sensitive settings and legacy directory migration are excluded. Distinct catalogue scan cost, matching bind-value count, SQL variable headroom and real query plan remain unmeasured; no performance improvement or universal identity fix is claimed. The same snapshot read protects catalogue/final-query consistency, but later DTO enrichment retains each domain's existing boundary.

Source/test frozen for Root. Root must run the actual explicit isolated DB/routes checker, qualify Windows HTTP/native-forward same-process IDs and scope/paging/error outcomes, then integrate architecture/indices/docs and final delivery. This child reports compiled preparation only.

## Root real failure and admitted fixture registration correction

Root's first actual mature checker failed 1 pass / 2 fail / 9 assertions; preserved complete original output as `root-real-store-routes-01.log`. fixture-project-identity-failure-review.md traces the incorrect same-Project premise: plain subdirectories with no local .git and no explicit sandbox registration legitimately discover separate Projects. memoryProject did Git-init and empty-commit its parent. Do not weaken no-filter scope or production discovery.

After Root's binding admission, changed **only the new test**: both Windows cases discover the actual parent Project and await mature Project.addSandbox physical admission for A/B **before any child Instance/records call**. Added positive current registry owner/sandbox-set outputs, actual A owner check and independent C registry/Session/root Project outputs. All original equality/local-no-filter/filter/paging expected outputs remain unchanged. No direct database identity mutation, actor override or production filter change.

Actual `test.fixture-before.txt`, `test.fixture-after.txt` and reviewed `test.fixture.diff` preserve this correction. Same complete source+new-test compilation `typecheck-fixture.log` exit **0**. No child test/runtime/HTTP/checker execution. Test is frozen again; Root must rerun the original mature checker and own its actual result. First failure remains evidence rather than being replaced by compilation success.
