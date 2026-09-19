# Mission attachment request projection

## Recall

- User request: 拉取最新代码，解决附件上传导致 unrecognized keys 的问题。The user clarified that the error occurs when sending a message with attachments, after upload. Subsequently: 删除要求独立子agent审查的要求.
- Acceptance: merge the configured upstream; file and directory references sent through Mission creation and follow-up pass the real request validator and persist as attachment-index FileParts; inline byte inputs retain their current contract; remove mandatory independent-agent review from AGENTS.md; focused checks, commit and push.
- Constraints: retain the strict server schema and canonical attachment store; no compatibility path, hidden message, scheduling change, user-process restart, UI (User Interface) automation, or real provider credentials. Preserve unrelated work and use the current branch.
- Sources read: root AGENTS.md and package scripts; current architecture `02-data.md` attachment contract; July 9 Mission composer, July 16 request-body separation, and July 21 attachment cardinality records; composer upload/store; all `wakeMission` callers; Mission request route; `UserUploadInput`; user-upload materialization; Chat/Task request builders; existing service and Mission route tests.
- Whole-repository searches: `unrecognized_keys`, `uploadComposer`, `UserUploadInput`, `UserUploadList`, `wakeMission(`, and attachment serialization in packages and specs. Mission creation in `main.tsx`, selected-Mission submission in `task.ts`, and Mission follow-up in `chat.ts` converge on `services/mission.ts`. Chat and Task attachment reference serializers already select wire fields. Generated Software Development Kit (SDK) types are structural and do not remove extra runtime properties.
- Delegation feedback: 无。The mandatory read-only review had been started under the old AGENTS.md rule, then was interrupted when the user explicitly removed that requirement. No independent review completion is claimed.

## Diagnosis and impact

The composer stores the upload response `{sha, url, mime, size, filename}` plus `kind`; directory references additionally retain `path`. `wakeMission` forwards the objects unchanged. The strict `UserUploadReferenceInput` accepts exactly `{url, mime, filename?}`; its byte alternative accepts `{data, mime, filename?}`. Consequently the real request validator rejects composer metadata before Mission admission. The raw upload succeeds, explaining the user's send-time symptom.

Previous work established the canonical upload/reference protocol and preserved folder metadata for display, but left the Mission serializer as a direct array pass-through. `satisfies MissionWakeBody` checks TypeScript assignability, not runtime object projection. Tests covering wake settlement send text only and therefore miss the mismatch.

The production change is confined to Mission's outbound request boundary. All five `wakeMission` call sites use it; three carry composer attachments. Keep upload/store ownership, server schema, generated SDK/OpenAPI, attachment limits, file bytes, folder manifests and LLM (Large Language Model) streaming unchanged. No scheduling, queue, recovery, concurrency or terminal-state anomaly is evidenced: the request is rejected before these mechanisms. No database migration or deployment/release is required. Exact user logs are unavailable; the real-route reproduction below establishes the failing fields.

## Implementation and verification plan

1. Fetch and merge `origin/main`, then recheck the affected definitions and calls before final validation. Continue scoped reproduction and repair while the network transfer runs.
2. Reproduce using composer-shaped file/folder values and the actual Mission HTTP (Hypertext Transfer Protocol) validator.
3. Project the supported reference or byte contract in the single `wakeMission` serializer; preserve optional filenames and inline byte payloads.
4. Add positive service assertions for initial/follow-up requests and a backend admission regression through the real upload and Mission routes, checking persisted attachment-index parts and stored bytes. A disabled test loop may isolate admission from provider execution; report this as admission coverage, not provider or browser end-to-end acceptance.
5. Run focused tests and applicable type/documentation checks. No layout/component change is planned; no UI automation will be added or run.
6. Apply the user's policy update to all linked AGENTS.md clauses (verification, Recall, commit, pending-push eligibility and delegation), inspect the complete diff, commit scoped changes, fetch/merge again, inspect all pending commits, and push with repository hooks enabled.

## Evidence and status

- Initial worktree clean; branch `main`, upstream `origin/main`, local head `0e037648`.
- The first all-ref fetch stalled at 5.2 MB for over six minutes. Its exact owned network process was stopped; bounded `fetch origin main` succeeded. Latest upstream `47c81cf7` was merged as `47f79456`, preserving the pre-existing local documentation commit `0e037648`. The September 18 attachment-authority removal and updated data architecture were reread; they change physical storage isolation but not the request schema or serializer defect.
- Before the fix, the real local HTTP upload succeeded and the subsequent Mission request returned 400 with `unrecognized_keys: [sha, size, kind]` for the file and `[sha, size, kind, path]` for the folder. The production client and actual Mission validator reproduced the reported send-time error.
- Both new service projection cases failed before the fix with exactly those extra metadata fields. The existing text-only lifecycle case passed.
- Pre-merge checks passed: 7 attachment/service tests; real local HTTP upload + Mission create/follow-up + persisted file parts + download/manifest readback (1 test, 8 expectations); Overlay typecheck; docs:check (339 operations, 25 groups). Checks will be repeated on the merged source.
- Pending-push history includes the existing release-evidence commit `0e037648`. Its record documents the user's release request, completed verification and final independent review (`academic_review_round2`); no release operation is performed in this task.
- After merge, full root typecheck passed (8 tasks); docs:check passed (339 operations, 25 groups). The updated native test supervisor initially could not access crates.io in the sandbox; the canonical prepare:test-runtime command rebuilt it successfully with network permission. The original selected commands then passed: 7 service tests (20 expectations) and 1 real local HTTP admission/persistence test (8 expectations).
- AGENTS.md now delegates only when the user explicitly requests agents. The mandatory review loop, delegation exception, Recall feedback requirement, pre-commit review condition and independent-review condition for previously authorized pending commits were removed or made conditional as appropriate. Validation and scoped commit/push requirements remain.

## Final verification commands

```powershell
bun run --cwd packages/overlay test:unit test/mission-lifecycle-request-settlement.test.ts test/attachment-upload.test.ts
bun run --cwd packages/opencorvus test test/server/mission-attachment-ingress.test.ts
bun run typecheck
bun run docs:check
git diff --check
```

All passed on the merged source. The integration test uses the actual browser-host transport, local HTTP upload/Mission routes, strict validator, storage and persisted messages; the provider loop is replaced with the existing test hook. This verifies attachment admission and storage, not live-provider execution or browser visual acceptance. No UI layout was modified, no UI automation was run, and no user application was restarted.
