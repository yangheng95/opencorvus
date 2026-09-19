# Missing global configuration defaults break Work creation

## Recall

- User reported a Send failed / POST global/work HTTP 500 screenshot after the Overlay package delivery. Fix the cause and verify the resulting build.
- Acceptance: absent/blank global configuration materializes canonical schema defaults; global Work and Chat creation return real owned sessions; explicit settings survive; project-layer precedence remains intact; focused tests, isolated real server check, rebuilt Overlay, independent review and scoped commit/push.
- Constraints: do not modify user configuration, credentials or existing projects; do not restart or stop the active Overlay without authorization. No UI automation tests. No new configuration source or local fallback.
- Read: config.ts source snapshots/cache/load pipeline/writers; global-chat-service.ts; global routes; chat session creation; implicit project creation; configuration and task-control architecture; global Chat tests and test isolation preload.
- Searches: getGlobal/global consumers include global Chat/Work creation, global Task preflight, provider/config routes and global skills. Direct prompt-profile consumers require materialized Info. Global source loaders deliberately return sparse empty objects for absent/blank files, whereas project loadState seeds Info.parse({}).
- Independent feedback: none before implementation; read-only review after first verification.

## Evidence and cause

The active sidecar's read-only /log endpoint returned two concrete failing POST /global/work requests (17eec7b8-034f-4e3d-9c8c-ee58e4907ef6 and a22d6bbe-76bf-4816-a7f8-f2027775e128). Both throw TypeError at GlobalConversationService.preflight: input.configSnapshot.prompt_profile.active. The user's canonical config directory is empty. The exception occurs before Project/Session allocation or any model request, so scheduler/queue/terminal recovery anomalies are not implicated by this incident.

loadSourceSnapshot returns {} cast to output Info for missing/whitespace content. loadStableGlobalState publishes that sparse file layer directly as effective global Info, violating PromptProfileConfigSchema's default active=base. A nonempty parsed file materializes defaults; project loadState separately seeds schema defaults and masked the same absence. Prior package checks covered versions/document artifacts, not first-run global conversation creation; existing global Chat tests write explicit config before testing.

Source readers must remain sparse: parsing absent project/global file layers would overwrite remote or global configured defaults during layering. Materialization belongs at effective-global read boundaries, using existing Info.parse, not optional chaining/defaults in conversation callers. The global atomic mutation callback was audited and already receives parsed defaults because its existing writer provisions and parses the canonical empty-object file. Its regression test passes without implementation changes. Stable source revisions and existing generation owners are unchanged.

## Plan

1. Add focused positive tests for absent, blank, empty-object and explicit global settings via both public read APIs and the atomic writer callback; reproduce the failure first.
2. Materialize schema defaults at effective-global publication only; retain the existing verified atomic writer. Document that contract in the existing architecture.
3. Run focused configuration tests, real isolated HTTP Work/Chat creation without provider execution, and relevant checks. Rebuild Overlay with the repaired backend and verify artifact metadata.
4. Independent read-only review; address valid findings, commit/push. Ask for exact user-process replacement authorization only if replacing the running installed application is needed.

## Verification

- Focused regression baseline: after aligning the test with ConfigPaths.CANONICAL_FILE_NAME, 4 of 6 cases failed with missing effective defaults (absent, empty, whitespace and a source revision changing to whitespace); empty-object and first atomic write already passed. No production change was needed for atomic writes.
- Fix is confined to global-state publication: Info.parse(await loadSourceSnapshot(snapshot)). Both global read APIs share this state. Source readers remain sparse and project layering is unchanged.
- bun test ./test/config-global-defaults.test.ts ./test/config-peer-convergence.test.ts: 13 passed, 0 failed, including cross-process revision/generation settlement. docs:check passed (339 operations, 25 groups).
- Started an isolated source server on 127.0.0.1:17879 with OPENCORVUS_HOME=.scratch/global-work-defaults-check, no copied config or credentials. POST /global/work returned 201, Session ses_-zUUhuNx2zzk8yfQ6erY / Project prj_hl0mkJ883B1LdIF2IXOA. POST /global/chat returned 201, Session ses_-zUUhuNKYzz0aJrtOBfy / Project prj_h0dBPiQurQSQ68hfGv8t. Both canonical Session metadata values contain configOverlay.prompt_profile.active=base, and separate owned directories under the isolated runtime. No model invocation was requested. This proves actual creation rather than a simulated API result.
- Independent read-only review by review_global_defaults passed for code, tests and final artifacts. The reviewer independently confirmed all three artifact sizes and SHA-256 hashes plus Overlay/NSIS version metadata.
- Independent code/test review found no valid defects; clarified architecture wording to apply sparse file-layer behavior specifically to missing/blank sources. Full typecheck passed (8/8 packages, 7 cached).
- Fresh compiled embedded backend served on 127.0.0.1:17880 with a second new credential-free runtime at .scratch/global-work-defaults-compiled-check. POST /global/work returned 201 with Session ses_-zUUht8RTzzW75tCd6Ac / Project prj_hpQLhaw6DEA5FWh82n1C; POST /global/chat returned 201 with Session ses_-zUUht7rWzzsvtp9tpGN / Project prj_hVAnnCeYzCcQ2vqvRk0q. Both returned active=base in their persisted creation metadata and separate carrying project directories. Source and compiled check processes were stopped afterward; the user's installed processes were untouched.
- package:local --skip-linux completed successfully; Rust release finished in 2m55s and both MSI/NSIS bundles completed. Rebuilt Overlay ProductVersion=0.0.64-beta. The same-version repair package supersedes the previous local artifact; this is not an official Release publication. Desktop visual and remote model-response acceptance were not performed.

| Artifact under packages/overlay/src-tauri/target/release | Bytes | SHA-256 |
| --- | ---: | --- |
| opencorvus-overlay.exe | 202377216 | adfcd536505971cb39306073819ea9e8070426ad943fd68f3a615433f7a520e3 |
| bundle/msi/OpenCorvus_0.0.64-beta_x64_en-US.msi | 192925696 | 1b21b8fffabbc8fcfde2b0491e4c81961905906823cb99fcc96fc6d4b4415585 |
| bundle/nsis/OpenCorvus_0.0.64-beta_x64-setup.exe | 191606707 | b49a1684fc3cd5a12725de7934649d9151837c53d55c80c2a4510af5eaebdc59 |
