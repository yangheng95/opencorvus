# Manager physical installation issue scope93 — final preparation

## Recall

Root after89 delivered59b2ac8d authorizes only this independent read-only admission preparation. gpt-6.1-sol one level/no delegation. No source/test/SDK/manifest/lock/node_modules/checker/service/UI/Provider/credentials/Git/shared-plan/index changes. Read prior manager-cross-scope-installation-investigation-93, original89 source/error snapshots, current Manager all common publication/install/recovery paths, Registry issue producers/identity precedence, package Locations, Filesystem path owner primitives, public HTTP mutation wrappers, current04/05 and mature CAS/archive/recovery fixtures. Original93 dynamicProjectID/concrete input paths/full issue array remain UNKNOWN: next genuine checker must capture them, no retroactive JSON.

## Captured failure and root

Original89 malformed global same-id manifest{} followed by SDK-valid Project import failed in Manager.installationExistingPackage686–717. It calls discoverAvailableIdentities(view installations,reconcileEvolutionMutations false), then finds any issue with matching id before filtering actual existing identities by targetLocation.kind. A global invalid identity therefore blocks a clean Project target. This is the captured failure; no later Task error, model behavior or UI title determines root.89 fixture reordering qualified a preexisting valid Project read/default over later broken global and does not repair reverse-order installation.

04 explicitly bounds installation uniqueness to each physical scope, allows project/global same-id, retains Project reservations for effective selection and shares manifest-ID install locks. No installed-selection namespace schema migration or execution policy is involved. The defect is the missing target-path membership check on an already scoped install's issue lookup; effective discovery must remain shared/canonical.

## All production paths through the same owner

Manager.importDirectory1333→installSourceDirectory1319 loads the real importable source once, rejects builtin-ID collision, resolves declared installationScope through ExpertSquadPackageLocations.resolve and enters publishLoadedSourceDirectory1013. importArchive1337 uses existing temporary archive materialization, exact expected namespace/id/version/package-digest validation, same installation owner and cleanup. installPayloadPackage1788, releasePayloadPackages1415 and builtin-source updatePackage1804 use installPayloadPackageSource1391 and that same owner; website-source update uses fetchArchive→importArchive. No new network request is needed by this fix/test. validateDirectory only validates source and does not call installationExistingPackage.

RestorePackageRevisionWithReceipt1902 and promotePackageRevision1927 load actual immutable snapshots, reject identity/builtin collisions and call publishLoadedSourceDirectory directly with existing CAS/durable receipts. Evolution-mutation promotion230/restoration291 reaches these; committed recovery/journal functions do not independently choose existing-install issue scope. Public ExpertSquadRoutes install-payload887/update958/release1118/import-folder1182/import-file1217/exact archive1249 and evolution mutation wrappers feed that owner. Conversation-authoring34 and Multica-import1519 call importDirectory; all existing production callers are covered by the single helper change, not duplicated filters in HTTP/tools/workflows. Generated SDK/public mutation shapes stay unchanged.

Publisher first enters ExpertSquadInstallLock.run(loaded.id), reconciles its exact target replacement/evolution journals, then invokes installationExistingPackage and existing namespace uniqueness. This order, staging/target/symlink/path validation, actual digest comparison, before/after receipt, canonical replacement/CAS, cleanup and Registry invalidation are outside the patch and must remain unchanged. No gate teaches tool/workflow selection, and no Task/Mission/Session binding/occurrence/retry/terminal state is rewritten. Evolution durable outcomes keep their authorization/receipt owner; mutation retry/restart recovery stays the existing journal protocol, not a new scope fallback.

## Exact DiscoveryIssue provenance

Only Registry.discoveryIssue2164 constructs typed DiscoveryIssue rows, preserving bounded original Error.message. Schema172 has phase/location/optional namespace/id/message and intentionally no scope. Actual callers populate location as follows:

- location scan: the canonical Location.packagesRoot; no id.
- namespace scan/non-directory/direct-package/namespace readdir fault: canonical namespaceRoot; namespace present, no id.
- package non-directory: canonical packageRoot with directory-derived namespace/id.
- missing/malformed/identity mismatch manifest: canonical manifestPath under packageRoot, with directory-derived namespace/id.
- duplicate same-scope identities: each exact identity.root with its namespace/id.
- full declaration/catalog failure: identity.root with its namespace/id.

Location ownership therefore comes from the same canonical package Location owner used to produce every path, not phase/error text/active ID/namespace guesses. Identity installations already carry location.kind separately and remain filtered by that current kind. Root/namespace issues without id were not selected by the old id-specific predicate; this narrow patch must not silently introduce a new global scan-failure policy or remove them from catalogue diagnostics.

## Minimal one-expression source admission candidate

Only packages/opencorvus/src/expert-squad/manager.ts changes:

`identities.issues.find(issue => issue.id === input.id && Filesystem.contains(input.targetLocation.packagesRoot, issue.location))`

Keep the selected same-scope issue's exact existing thrown Error(message). No catch/filter-by-keyword, ignored-error deletion, new cache/status/discovery API/scope DTO or lock/CAS bypass. Opposite-scope issues remain in canonical discovery and effective selection diagnostics; they simply do not authorize rejecting this different physical install target.

Locations.location resolves configRoot using Filesystem.resolve and appends canonical expert-squads; project root comes from existing ProjectRuntimePaths, global from Global.Path.config. Filesystem.contains462 already handles normalized absolute path, separator-root membership, Windows case and extended-prefix normalization, equality and different drive roots through relative path semantics. This is the same primitive used by Manager.assertInside718/assertInsideLocation722/source-runtime exclusion/staging/target/archive validation; do not copy startsWith logic or call normalizePath/realpath on only one side. Issue locations are already canonical owner paths, including nonexistent manifest paths: additional realpath failure fallback would create another interpretation and is unnecessary. Real filesystem alias/symlink replacement still uses existing target/source guards; this patch is ownership filtering, not a new authorization/sandbox escape claim.

If two configured roots physically alias, path membership describes that real shared target and keeps its issue rather than treating it as harmless opposite-scope data. Native alias/interprocess mutation matrices are unqualified; no ad hoc relaxed branch is proposed.

## Positive new baseline and after contracts

Root next admits only new test/manager-installation-scope.test.ts and the one source expression. Reuse memoryProject and SDK writeExpertSquadPackage→actual Manager.importDirectory, production Registry/Location and cold Server.App import-folder. No synthetic messages, rawSQL, Provider, browser fixture or module mock. Preserve before/after input/output JSON and original baseline failure before source mutation. Collect actual ProjectID/worktree, target scope/root, source definition/directory, full current issues, public status/error/receipt, real installed declaration and package bytes. Those facts belong to the new run, never attached as original93 provenance.

1. Damaged canonical global same-id + clean Project target: expect actual import-folder200 installed receipt with Project scope/id/namespace, correct actual declaration/README. Preserve damaged global exact{} bytes and diagnostics as positive retained data. Original source must fail this success expectation; do not call its Error a desired regression contract.
2. Damaged canonical Project same-id + clean global target: expect global physical install200/receipt.projectDirectory null and real global declaration. This does NOT imply effective global eligibility in the damaged Project: canonical Project reservation still wins and effective identity remains null/unavailable. A second clean Project sees the global winner. Record both project-specific metadata/current issues rather than declare a catalogue fallback.
3. Same target-scope malformed identity: import remains explicit public ExpertSquadPackageError400 with the same actual canonical issue message and retained target bytes. Same-scope two valid cross-namespace declarations are invalid identity input: explicit duplicate issue/400 persists, no Manager pretend-success. Distinguish source declaration legality from installed identity legality.
4. SDK-valid external builtin-ID source still fails existing builtin collision before publication with exact ExpertSquadPackageError400/message. No builtin/active config override is allowed.
5. Ordinary CAS/regeneration controls remain actual replaced/unchanged receipts and named stale-digest conflict, not absence assertions. Existing expert-squad-manager-cas.test.ts covers installed/unchanged/replaced/restored, competing writers (one real receipt/one typed conflict), project+global physical receipts and rollback; exact archive test verifies canonical bound identity/digest/public bytes; recovery-resilience retains corrupt/mismatched journal content and project open. Those nonUI files were inspected for positive output/error cores; no .not core identified in selected files. A fabricated expected digest used as stale-protocol input is not acceptance of fake resource identity. Do not run unrelated broad suite or change old source to satisfy outdated assertions.

Use existing packages/opencorvus `bun run script/run-tests.ts test/manager-installation-scope.test.ts` for baseline/after; after owner source freeze add only directly relevant manager-CAS/archive/recovery checks as explicitly admitted. Full backend+newtest explicit compiler input follows existing isolated qualification. No new runner. Capture baseline each direction independently or execute all request records before assertions so first error cannot hide the second direction; after must actually reach every positive/error case. No arbitrary time limit or unsafe huge input stress beyond mature runner ownership.

## Public errors, recovery and isolation limits

packageRoute339 passes Auth read errors, existing ExpertSquadPackageError/EvolutionHistoryAuthorityError/mutation-conflict types intact and wraps ordinary errors with original cause into ExpertSquadPackageError400. Query/source validation and exact NotFound policies remain their current contracts. No model-validation bypass is introduced; install identity routes already use their admitted Project boundary. ConfigCandidateValidationError/Session model/binding errors and installed default selection remain untouched.05's config generation and API authority retire old projections independently; package installation does not write prompt_profile.active.

Same-scope validation is preserved under shared manifest-ID cross-process lock; opposite Project roots are not enumerated by this install's discovery. MultiProject isolation requires actual twoProject output, not title/path inference. Directory/archive/payload/update/restore share the common expression, but only explicitly executed modes are runtime-qualified; archive/evolution restart/cleanup/cancellation/interprocess fault injection and nativeUI are unknown until separately tested. No scheduler anomaly is being downgraded into this local bug: captured93 is a direct pre-publication Manager error, with no executing Task/Mission/Session occurrence in the failing call. Original dynamic input/issue records UNKNOWN remains explicit; no repair currently implemented or tested by this report.

