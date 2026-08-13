# CS-035 — Saved-auth and remote-config read authority

## Recall

- User requirement: continue the long-running code-smell remediation directly, use parallel independent agents where useful, repair root causes rather than symptoms, and merge the remote branch before the eventual push.
- Acceptance target: a missing `auth.json` remains a valid empty credential registry; unreadable I/O, malformed JSON, and schema-invalid credentials retain distinct typed outcomes through `Config.get()` and the public config route; valid well-known credentials still merge the real remote configuration.
- Hard constraints: one current authority, no `{}` fallback, no legacy dual contract, no credential/path/token disclosure, no User Interface automation, focused positive production-path tests, independent read-only delivery review, exact task-owned commit, then fetch/merge upstream before push.
- Read sources: repository `AGENTS.md`; the `CS-035` ledger entry in `2026-08-12-repository-code-smell-continuous-audit.md`; `specs/current/architecture/06-provider.md`; `src/auth/index.ts`; `src/config/config.ts`; server error handling and Config/Provider routes; generated OpenAPI/JavaScript SDK contracts; current focused tests.
- Repository search: `Auth.all()` is the saved-credential read authority. `Config.loadState()` is the only caller that erases its failure. Project Provider listing deliberately catches a Config/Auth failure and reports a structured `auth.read` issue; global config does not enumerate saved auth. No existing positive test crosses corrupt saved auth through Config and the HTTP error mapper.
- Independent-agent feedback: backend/infrastructure independently reproduced the missing-versus-corrupt collapse and proposed a typed `AuthReadError`, removal of the Config fallback, safe HTTP mapping, and real missing/corrupt/well-known verification. Its initial suggestion that project Provider listing remains partially successful is confirmed by the route's explicit catch and issue projection. The independent plan reviewer found that centralized 503 mapping also affects public Auth mutation and Provider operations that call `Auth.get/set/remove`; their OpenAPI responses must use the same strict safe schema rather than only documenting Config GET/PATCH or reusing the Worktree-only generic 503 response.

## Problem depth and impact

### Observable behavior and direct trigger

`Auth.all()` treats only `ENOENT` as an empty registry. It throws for other filesystem failures, malformed JSON, and a credential that does not satisfy the discriminated schema. `Config.loadState()` catches every one of those failures and substitutes `{}`. Consequently the normal Config response looks complete while every credential-declared `.well-known/opencorvus` organization layer has silently disappeared.

### Control and data root cause

The saved-auth reader already owns the missing-versus-failed distinction, but it exposes an unstructured `Error` whose message contains internal path/parser detail. Config then creates a second authority by converting all failures into the same legal empty value before precedence merging. Once cached by `Config.state`, downstream consumers cannot reconstruct whether there were no credentials or the authority was unobservable.

### Why the old paths do not cure it

- Logging cannot repair the successful Config value already returned and cached.
- Provider catalog issues are a resource-specific partial-success contract; they do not make the Config response truthful.
- Returning local Config plus an issue only at the HTTP route would create a route-only state that internal `Config.get()` consumers cannot observe.
- A new envelope alongside the current `Config.Info` return would introduce dual Config contracts throughout Session, Channel, Overlay, and SDK call sites.

### Contract decision

The current architecture text calls well-known config optional and says saved-auth failure must not block local config. That policy is the source of the accepted false-success defect when a user has declared remote organization authority. This remediation replaces it: missing auth is optional absence; declared-but-unobservable or corrupt auth is a typed Config failure. Project Provider listing may continue its existing explicit partial-success projection because its response already has `issues`; direct Config consumers do not synthesize a complete local snapshot.

### Affected and excluded surfaces

- Changed: saved-auth error type/data, Config loading, centralized HTTP status projection, Config GET/PATCH OpenAPI responses, current Provider architecture contract, generated SDK/OpenAPI artifacts.
- Preserved: `Auth` credential file format, Config precedence and successful `Config.Info` shape, Provider catalog's existing `issues` contract, global Config loading, Auth mutation semantics, stored data.
- Excluded: remote well-known network/HTTP failures beyond this saved-auth observation boundary, Provider load-issue redesign, UI presentation changes, credential migration.

## Implementation plan

1. Replace the ad-hoc `Auth.ReadError` with one `NamedError` carrying strict public-safe data: operation, reason (`io`, `malformed_json`, `invalid_credential`), and constant message. Preserve the original exception only as an internal cause; do not serialize path, key, parser input, or token.
2. Keep `ENOENT -> {}` in `Auth.all()` and classify JSON syntax separately from other I/O. Remove the Config catch/fallback entirely so the same typed failure reaches every `Config.get()` consumer and is never cached as success.
3. Map `AuthReadError` to HTTP 503 and declare one strict safe response schema on Config GET/PATCH, Auth PUT/DELETE, and the Provider project/global operations whose production paths call `Auth.get/set/remove`. Preserve Provider list's existing explicit issue projection and do not reuse the Worktree-specific generic 503 schema.
4. Update the Provider architecture text and regenerate the OpenAPI/JavaScript SDK artifacts from the source route.
5. Add a focused non-UI production-path test covering missing, valid well-known merge, malformed JSON, invalid credential, filesystem I/O failure, exact safe HTTP 503, and project Provider partial-success issue behavior. Assert complete positive response/error objects rather than source absence.
6. Run focused tests, package typecheck, API route generation/checks, SDK import/type checks, documentation checks, and exact diff checks. Obtain an independent read-only review and repair every valid finding before committing.

## Delivery state

- Implementation: complete. Saved-auth observation is the single missing-versus-failed authority; Config no longer synthesizes an empty registry; direct public consumers share the strict safe `AuthReadError` 503 contract while Provider catalog keeps its explicit `auth.read` partial-success result.
- Verification: focused production-path test `7/7` with `15` assertions; OpenCorvus and generated JavaScript SDK typechecks pass; API route inventory, SDK import check, generated API documentation check, and exact diff check pass.
- Independent delivery review: PASS after three read-only rounds. The first review found a non-record top-level saved-auth false-empty result plus missing Provider removal and Expert Squad uninstall error propagation; the second required real global-remove and uninstall preservation coverage. The reviewer independently reran the final focused test at `7/7`, `15` assertions and found no remaining actionable issue.
- Commit/push: pending; upstream must be fetched and merged before push.
