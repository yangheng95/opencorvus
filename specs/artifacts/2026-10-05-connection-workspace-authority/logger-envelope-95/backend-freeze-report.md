# Backend95 implementation freeze

## Recall and scope

Read Root production admission in logger-envelope-plan-95.md after closed native preimage and93/94 checkpoint. Owned only util/log, util/log-support-bundle, three admitted diagnostic scripts, five existing consumer tests, pure cold-start contract and new log-envelope.test.ts. Implementation-before contains exact file snapshots. Root owns docs/private archive/native/UI/build/Git; other Sol owns Overlay parser. No long diagnostic script, external service, Provider request, real credential, UI automation or Git mutation was performed.

## Current single contract

Pino nestedKey=data serializes original subject attributes, preserving its real error serializers. prepareRecord separates explicit service plus one captured SessionObservability snapshot from other caller tags/extra. One dispatch performs root.child(trusted bindings)[level](subject attributes,message), for immediate records and prepared pending records alike. Removed arbitrary child-binding cache/old merge path. Clone/tag/timer/level/flush/generation use that same producer; data may be absent for a true no-subject record. Caller request session identity is data, ambient execution identity is envelope, with no fallback/secondary clock/throw for ordinary reserved fields.

Support ZIP formatter accepts only canonical string time, preserves current nested data and original non-string historical time/timestamp/ts as diagnostic fields. Raw bytes remain exact. Three scripts read actual Pino subject paths/request IDs/phase/HTTP/receipt/duration/refusal/provision fields through data; array-index request/cancel references were explicitly updated. Domain observation output fields and independent CLI/bridge/worker/durable event protocols remain unchanged.

Existing consumers migrate their actual Pino fields. MCP diagnostics now validates parsed current envelope/data with Zod rather than hiding nested types behind a cast. Removed two touched absence-core assertions: Log.file empty after close and empty valid-unmatched Session filter output. All remaining actual logger reuse, real directory isolation/pagination/errors and redaction/current output assertions remain. No existing production validation was weakened.

## Verification and failures

First replay of the identical original four cases after producer change passed4/12 with canonical runner before modifying that test. Original failing baseline and fixture/summary corrections stay immutable. Added one reader-only historical malformed-time fixture afterward: real ZIP retains exact raw and original values, first/last event timestamp explicitly null and formatted chronology timestamp-unavailable. This is not a newly produced canonical log or real historical occurrence.

First seven-file consumer run passed31 cases (six Bun files22 cases/134 expect assertions plus nine node:test contract cases). Explicit full source/test/script types then found two unknown-data property accesses in the existing log-lifecycle projection. Preserved types-first.log and fixed actual object-property narrowing, without casts or config relaxation. No producer change followed.

Final canonical command from packages/opencorvus:
`bun script/run-tests.ts test/log-envelope.test.ts test/log-lifecycle.test.ts test/skill-read-diagnostics.test.ts test/session-directory-filter.test.ts test/mcp/local-process-diagnostics.test.ts test/server/cors-response-headers.test.ts script/skill-mount-cold-start-contract.test.ts`

All seven file commands exited0: new envelope5/17; lifecycle6/15; skill diagnostics4/29; Windows Session filter3/59; local MCP diagnostics2/5; CORS3/14; pure cold contract9 cases. Total32 cases;139 Bun expect assertions, plus node:assert contracts not counted by Bun's expect counter. Full relevant raw output inspected for checker failures; deliberate public500/local MCP failure/state rejection logs are positive fixtures, not ignored product errors.

`node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p .tmp-product-iteration/logger-envelope-95-types.json` final exit0. Exact config includes all backend source, all six Bun files, pure script contract and all three modified diagnostic scripts, using current package config/existing builtin exclusion/sql declarations.

`node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p packages/opencorvus/tsconfig.json` configured backend exit0. Exact configs and raw first/final logs are archived; original .tmp files remain. backend-final.diff covers all tracked owned edits; log-envelope.final.test.ts is the full new file.

## Limits and handoff

Source/tests frozen. No new external native run/real UI acceptance is claimed; Root must verify genuine Session creation, current LogViewer structured/raw data/time, support download and exact service closure. The standalone HTTP/restart/cold-start diagnostic scripts were migrated and typechecked but not launched. Their pure observation contract was exercised, not their full physical workflow. Pending test proves actual same-process initialization capture/reinit, not every concurrent process or I/O failure. Current redaction remains its previous real sanitizer; no comprehensive arbitrary-object recursive security claim is added. Original noncanonical historical log timestamp remains unknown and never borrowed from subject lifecycle values.

No docs/index/build/Git operations were taken by this child. Other concurrent error mapper/builtin/Overlay changes are not in the owned diff and were left intact. Root will integrate final checks/docs/build/manual evidence and normal delivery.
