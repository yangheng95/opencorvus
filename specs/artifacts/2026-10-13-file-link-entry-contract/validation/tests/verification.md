# File link entry contract verification

This child modified exactly three authorized test files: the new `packages/opencorvus/test/file-link-entry-contract.test.ts`, and the terminal-link expectations in `file-mutation-root-contract.test.ts` / `file-ignore-coordinate-contract.test.ts`. No production, specification, shared index, Git index, commit or push was changed by this child.

The old terminal move receipt now expects `type: file`. The ignore test title and terminal receipt now require the same entry-based directory hint as listing, producing `ignored: false` for the directory-only terminal rule. The three test HTTP handlers also gained `async` to correctly flatten `Instance.provide`'s inferred nested Promise for Bun's fetch signature. This repairs a genuine explicit-test type-check error without changing the request path or weakening an assertion.

## Actual execution

The parent explicitly confirmed the production implementation before test execution. No new functional test was run against unmodified product source, and no old-state baseline is claimed here. All validation commands prepended the actual Bun 1.4.0 directory:

`D:\myhexin-local\opencorvus\.tmp-product-iteration\sse-compression-305\bun140\bun-windows-x64`

From `packages/opencorvus`:

`bun run test test/file-link-entry-contract.test.ts test/file-mutation-root-contract.test.ts test/file-ignore-coordinate-contract.test.ts`

The normal repository isolated runner completed physically with exit 0. `functional-first.log` is the original stdout/stderr captured using Tee-Object; `functional-first.exit` is the independently captured native exit code.

| File | Passed tests | Assertions | Runner duration | Exit |
| --- | ---: | ---: | ---: | ---: |
| file-link-entry-contract.test.ts | 20 | 245 | 67.39 s | 0 |
| file-mutation-root-contract.test.ts | 18 | 294 | 122.06 s | 0 |
| file-ignore-coordinate-contract.test.ts | 13 | 79 | 32.02 s | 0 |
| Total | 51 | 618 | | 0 |

The new file logged 99 actual TCP requests over 21 actual API Project identities: 69 responses 200, seven expected 400 authority errors, 21 expected 404 content/missing-entry errors, and two expected 409 destination conflicts. `new-test-http-summary.json` was extracted from the original `[link entry HTTP]` log lines, not created from expected counts. Successful responses in the minimal FileRoutes harness do not add a request ID header; real error response IDs are retained verbatim.

Coverage includes absolute file/dir links and junctions; successful relative moves whose new target is missing or points to different exact content; already-broken in-scope file/dir/junction copy, move and delete; complete directory trees containing relative normal and broken links; independent root-link copy with retained physical root and marker; current healthy external-source policy, broken external declarations and relocated external declarations; dangling-destination conflicts; old-source retry errors; concurrent independent Projects' metadata, rules and real Bus notifications; and child-scope operations returning exact parent-worktree entries.

Assertions consume actual FileRoutes over TCP, filesystem lstat device/inode, original readlink text and complete UTF-8/CRLF bytes. Public File.Edited observations await the actual durable Bus callbacks with a bounded timeout; they do not assume HTTP acceptance means asynchronous notification delivery has already finished. No mock replaces these file operations, metadata reads, transport responses or notifications.

## Type and format checks

The package tsconfig excludes tests. `tsconfig.tests.json` is a scratch-only extension that adds these exact three test files to the product source type check.

`node --max-old-space-size=8192 packages/opencorvus/node_modules/typescript/bin/tsc --noEmit --project .tmp-codex-file-link-contract-tests-01a133/tsconfig.tests.json`

Initial `test-types.log` / `.exit` preserve exit 2 and the exact three TS2322 nested-Promise errors. After the precise async-handler fix, the same command returned 0 (`test-types-repaired.exit`); `test-types-repaired.log` is explicitly zero bytes because the successful compiler produced no stdout/stderr. No product configuration was modified.

`format-check.log` / `.exit` preserve the formatting failure after adding an actual evidence log line. The local Prettier write repaired formatting only (`format-repaired.log` / `.exit`), then the same three-file check passed (`format-check-repaired.log` / `.exit`). This formatting occurred after the new functional file completed and made no semantic change. Scoped `git diff --check` passed (`diff-check-final.log` / `.exit`). No routine functional run was repeated.

## Limits

Actual host validation was Windows with Bun 1.4.0. POSIX/macOS, unknown ACL/EACCES/EIO failures, ELOOP, concurrent external unlink/replacement, cross-volume rename, network/UNC volumes, hardlinks and special devices remain untested here. Directory-link navigation is intentionally outside the current binary entry-type UI contract. These tests do not establish browser/editor interaction, pixel/visual correctness or full CLI-server end-to-end acceptance; those remain the parent's separate real desktop work. No UI automation, provider request, credential use or operation on existing user processes occurred.

Original before copies and the empty pre-existing test diff are retained in this evidence directory. All failures and all actual outputs remain available; nothing was replaced by a hand-authored success log.
