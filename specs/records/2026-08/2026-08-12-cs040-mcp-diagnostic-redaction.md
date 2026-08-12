# CS-040 Local MCP Diagnostic Redaction

## Recall

### User requirement

- Fix `CS-040`: a local Model Context Protocol (MCP) subprocess must not copy credential-bearing stderr into durable logs or public MCP status responses.
- Investigate the complete local-process, log, status, route, Command Line Interface (CLI), and cleanup flow before implementation.
- Write this plan before code, obtain an independent read-only plan review from `/root/core_runtime_audit`, implement only after PASS, run focused non-User Interface (UI) positive verification, then obtain an independent read-only delivery review from `/root/surface_tooling_audit`.
- Do not touch the B02-owned Engine ownership, Task execution capsule binding, Worktree, server error, project/experimental route, transport-protocol, Software Development Kit (SDK)/generated, or shared index/README files. Do not publish or run UI automation.

### Acceptance indicators

1. A real isolated local MCP child that writes authorization, API-key, cookie, password/token, and sensitive environment values to stderr produces only the declared redacted structured diagnostics in the server log.
2. Local MCP startup failure returns the existing typed `status: "failed"` contract with a stable per-failure diagnostic identifier and no child stderr or raw startup exception detail.
3. The same diagnostic identifier correlates the public failure with the sanitized internal startup-failure record.
4. Credential text split across child-process stream chunks cannot bypass redaction; an over-limit unterminated line is represented by one explicit omission record rather than a raw prefix or suffix.
5. Normal local MCP startup/cleanup ownership is unchanged, and focused package typecheck plus the real-process test pass.

### Hard constraints

- One current diagnostic path; no raw-log fallback, dual public error field, compatibility reader, or separate route sanitizer.
- Do not store or log secrets, tokens, passwords, cookies, authorization headers, OAuth material, or complete sensitive environment values.
- Preserve streaming MCP transport behavior; the stderr diagnostic collector must not buffer an unbounded line.
- Public status keeps the existing `MCP.Status` shape because transport-protocol and generated SDK files are outside this batch. The existing `failed` discriminant is the typed public failure; its `error` string becomes a generic message containing only the diagnostic identifier.
- Positive tests assert the exact safe status/log contract. They do not make absence-only assertions and do not invoke UI automation.
- Existing unrelated dirty-worktree changes belong to other tasks and are not modified or staged.

### Materials read

- `AGENTS.md`.
- `specs/current/architecture/security-permission.md`, especially the prohibition on secrets in durable ledgers, OAuth diagnostics, and public unknown-error detail.
- `specs/current/architecture/06-provider.md` for credential and management-surface failure isolation.
- Continuous audit entry `CS-040` in `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md`.
- Local MCP creation, status, connection, cleanup, environment, and stderr paths in `packages/opencorvus/src/mcp/index.ts`.
- Public MCP routes in `packages/opencorvus/src/server/routes/mcp.ts`, CLI status/error projection in `packages/opencorvus/src/cli/cmd/mcp.ts`, log lifecycle in `packages/opencorvus/src/util/log.ts`, and test runtime/fixture helpers.

### Full-repository search result

- The vulnerable raw stderr producer is unique: `packages/opencorvus/src/mcp/index.ts` pipes local transport stderr, logs every raw chunk, retains the last 4,000 characters, logs it again on startup failure, and copies it into `MCP.Status.error`.
- `MCP.status()`, `MCP.projectStatus()`, add/configure/connect flows and `GET /mcp` consume the same in-memory `Status`; the CLI prints `status.error`. Sanitizing only a route or CLI would therefore leave parallel unsafe sources.
- Local subprocess environment is `Env.snapshot()` plus configured `mcp.environment`; an MCP may echo any inherited sensitive value. The current `credentialSafeErrorMessage` only knows the separate remote static credential and is not applicable to local stderr.
- Provider error redaction has useful label patterns but is Provider-owned and does not bind exact local MCP environment values or solve stream chunk boundaries. Reusing it directly would leave a second incomplete policy.
- `MCP.Status` is defined in `mcp/index.ts`; route and generated SDK contracts already expose its `failed.error` string. No schema expansion is necessary for a diagnostic identifier.
- No existing focused local-MCP diagnostic disclosure test was found. Existing real local process coverage in `process-authority-runtime.test.ts` demonstrates the available supervised subprocess fixture pattern.

### Root cause and why current abstractions do not cure it

The local MCP transport treats an untrusted child diagnostic stream as already public-safe. One `data` listener sends raw chunks directly to the logger, accumulates a raw tail, sends that tail to another log record, and promotes it into the public status. Log serialization only makes values serializable; it has no credential policy. Remote static-credential replacement knows one exact secret and does not cover inherited environment values, arbitrary headers/cookies, or local streaming. Applying a regex independently to each `data` chunk would still leak a key/value split across chunks.

## Design

### Single diagnostic authority

Add `packages/opencorvus/src/mcp/local-process-diagnostics.ts` as the sole local-MCP child-diagnostic policy. It will provide:

- a pure text sanitizer that redacts common authorization, bearer, cookie, API-key, password, secret, token, OAuth/code/state, access/private key and credential assignments;
- exact replacement of sensitive environment values selected by sensitive environment-key semantics, including raw and URI-encoded forms;
- a bounded streaming line collector that retains an incomplete line only up to a fixed byte/character limit, emits sanitized complete lines, and converts an oversized unterminated line into one explicit omission diagnostic after its newline/end boundary;
- a bounded sanitized tail for the startup-failure record; raw text never leaves the collector.

The collector receives an `onDiagnostic(safeLine)` callback owned by `mcp/index.ts`. It has no logger dependency and does not become a general repository redactor without proven cross-domain equivalence.

### Local MCP flow

For every local transport:

1. Construct the child environment exactly once.
2. Construct one diagnostic collector from that same environment.
3. Feed stderr chunks into the collector. Log only structured sanitized line records, never interpolated/raw chunks.
4. On startup failure, finish the pending line, generate one `crypto.randomUUID()` diagnostic ID, and log one structured failure containing the ID, sanitized startup exception, sanitized bounded stderr detail, MCP key and working directory. Do not log the full command/arguments because arguments can themselves contain credentials.
5. Publish `{ status: "failed", error: "Local MCP startup failed (diagnostic ID: <uuid>)" }`.
6. Sanitize a cleanup exception through the same collector before attaching it to `McpCreateCleanupError`; preserve the generic public status.

On successful startup the collector remains attached to the live transport and continues emitting only sanitized complete diagnostic lines. An incomplete final line may be omitted rather than creating an unsafe raw fallback.

### Public and internal contracts

- Public: existing `MCP.Status` schema and all routes/CLI/SDK consumers remain unchanged structurally. `failed.error` is a controlled correlation message, not child-controlled text.
- Internal: structured log records use stable messages (`local mcp stderr`, `local mcp startup failed`) and fields (`key`, `diagnostic`, `diagnosticID`, `error`, `stderr`, `cwd`). Every diagnostic-bearing field is sanitized before `Log` sees it.
- No route, server-error, transport-protocol, or SDK changes.

### Tests

Add one focused non-UI test under `packages/opencorvus/test/mcp/` using the real supervised local process path. The fixture child writes representative sensitive diagnostics, including a configured environment secret split across writes, then terminates before MCP initialization.

The positive assertions are:

- the returned exact status has the `failed` discriminant and a UUID diagnostic identifier;
- the structured stderr records equal the declared redacted diagnostics;
- the structured startup-failure record carries the same identifier, a sanitized error field, and the declared bounded sanitized stderr summary;
- an oversized line yields the declared omission record;
- disposal/cleanup completes through the real Instance lifecycle.

The test reads the real isolated test log after `Log.flush()`. It does not mock the logger or process transport and does not call public deployment, registry, or UI paths.

### Verification

1. Focused real-process test via the repository test runner.
2. `packages/opencorvus` typecheck.
3. Exact diff and forbidden-path audit.
4. Independent read-only delivery review by `/root/surface_tooling_audit`; fix valid findings and rerun verification until PASS.

### Impact exclusions

- Remote MCP OAuth/static credentials, Provider diagnostics, generic server error responses, transport-protocol, generated OpenAPI/SDK, and UI rendering are unchanged.
- No durable data migration, compatibility reader, new configuration, or fallback is required.
- Shared `specs/README.md` and monthly indexes are deliberately not modified because the parent assigned this batch an isolated spec and explicitly forbade shared indexes.

## Independent review

- Implementation-before independent feedback: none (parallel agent slots were occupied; the initially named reviewer had an explicit CS-040 exclusion, and the parent cancelled the extra plan-review prerequisite).
- Delivery review: `/root/surface_tooling_audit` final re-review PASS with no unresolved finding.
- First delivery review: blocked. It reproduced a short exact environment value corrupting a credential label before label redaction, and identified missing UTF-8 split and sanitized startup-error assertions. The implementation now protects labelled credential spans before exact-value replacement, and the focused tests cover both contracts. The reviewer re-ran the adversarial cases, verified bounded streaming, startup/listTools/cleanup projections and the forbidden-path boundary, and returned PASS.
