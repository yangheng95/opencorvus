# UTF-8 service freeze report

## Recall and scope

Implemented exact Root Binding in next-directory-artifact-implementation-plan.md. Owned only conversation-artifact.ts, diff.ts and existing conversation-artifact-compound-authority.test.ts/immutable-diff-evidence.test.ts. No UI, shared indices, runtime, HTTP, Provider, credentials, Git or delegation operated. Root owns caller integration and real route/UI/download qualification.

## Current contract

Conversation loader accepts optional authority?: ApiAuthority in the existing input. Supplied original token is asserted at entry and return; omitted token captures once. One native fatal ignoreBOM:true decoder persists per logical text load, streams every text chunk and flushes once at final actual byteEnd, preserving literal U+FEFF and final byte integrity. Diff's existing single streamed decoder per side now also uses ignoreBOM:true. Range/ETag/progress/byte/error/empty/whole binary contracts remain. Transport fixtures now return canonical handler status200 (previous206 preserved in before).

Positive tests cover initial BOM and actual second chunk start at65536, route-style shorter65535 Unicode chunk, separately deliberate service split bytes, exact reencoded bytes, native TypeError for invalid/truncated final UTF8, supplied token success and precise retired revision, current discontinuous range error, immutable side BOM+cross256KiB Unicode, and immutable invalidUTF8. Existing current HTTP/late response/directory/ABA/empty/binary assertions remain. Service transports qualify local contracts only; backend route already avoids code-point splits, so deliberate split-byte fixture is not claimed as actual route behavior.

## Actual verification

Initial-tests.log retains 16pass/3fail/40assert before production fixes (BOM, split bytes, supplied token retirement). First explicittypes check failed: optional input authority declaration was missed by newline-specific edit, and Bun test.each rest arguments included callback done in types. Both exact owned errors corrected; explicit-types-01.log retained unchanged. Final-tests.log:21pass/0fail/51assert. Formal wholeOverlay tsconfig typecheck exit0; explicit-types-final.log includes ALL source and both changed tests with unchanged current config, exit0. No extra strict flag or exclusion/relaxation. Exact saved configuration explicit-types.tsconfig.json. Prettier used on only four owned files, logs retained. Before/after complete texts and unified final.diff.txt are saved here.

Commands from repository root: bun test packages/overlay/test/conversation-artifact-compound-authority.test.ts packages/overlay/test/immutable-diff-evidence.test.ts; node node_modules/typescript/bin/tsc --noEmit -p packages/overlay/tsconfig.json; node node_modules/typescript/bin/tsc --noEmit -p specs/artifacts/2026-10-05-connection-workspace-authority/artifact-utf8-service-implementation/explicit-types.tsconfig.json.

Source/tests now FROZEN for Root review. Real caller continuation/source retirement, real Hono/TCP range, downloaded bytes and actual UI qualification remain Root-owned/unperformed by this child. No source checksum acceptance or new reader/cache/fallback was introduced.
