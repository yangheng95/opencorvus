# Architecture Debt P0.1 Remediation

## Recall

### User request

The user requested a repeated whole-repository architecture scan after the first P0 repair, then authorized continuing repairs in the existing isolated worktree.

### Acceptance indicators

- Close every regression introduced or left reachable by commit `6d7341c` in the permission, public-error, metric-query, frontmatter, OAuth-log, and direct credential-output surfaces.
- Keep one current contract for each touched capability and remove bypasses in the same batch.
- Add focused positive tests for the repaired runtime decisions and public outputs.
- Run focused tests, package typechecks, documentation checks, and an independent read-only review until no unresolved finding remains.
- Commit and push only this batch from `codex/architecture-debt-p0-remediation`.

### Hard constraints

- Product changes are limited to the P0.1 surfaces named below. Cross-project authorization, cross-process credential storage, and broader lifecycle authority are separate follow-up batches because they require new persistent contracts.
- No fallback, compatibility path, double read, shadow result set, or second error classifier may remain.
- All Large Language Model calls remain streaming.
- Tests assert positive current decisions, response schemas, evaluation results, and redacted diagnostic summaries.
- No User Interface automation is added or run.

### Sources read and repository search

- `AGENTS.md` and `specs/records/2026-08/2026-08-09-architecture-debt-remediation-plan.md`.
- `specs/current/architecture/security-permission.md`.
- Permission request, pending reply, and approval paths in `packages/opencorvus/src/permission/next.ts`.
- Named error mapping, OpenAPI named 500 responses, and streaming commit-message errors under `packages/opencorvus/src/server/**`.
- Metric schemas, store reads, query/aggregator evaluation, and runtime tests under `packages/plugin/src/metric-evaluation.ts` and `packages/opencorvus/src/metrics/**`.
- Gray Matter engine resolution plus `js-yaml` v4 parse/stringify APIs.
- MCP OAuth flow ownership, callback registration, logging, and CLI debug output.
- Whole-repository searches for equivalent permission evaluators, raw exception responses, metric-result dependencies, frontmatter codecs, OAuth state logging, and credential output.

### Independent agent evidence before implementation

Read-only rescan agents found and the main agent verified:

- `always` reply propagation evaluates only persisted approvals and bypasses the pending request's current rules;
- all named 500 errors are currently rewritten to `UnknownError`, including explicitly documented corruption errors;
- same-iteration query/aggregator evaluation depends on unordered database rows and can read a prior execution's result;
- frontmatter stringify calls Gray Matter's removed `yaml.safeDump` path;
- CLI MCP debug prints an access-token prefix;
- the commit-message Server-Sent Events error branch exposes raw exception messages;
- the OAuth logger contract lacks the correlation identifier required by the original plan.

The first independent post-implementation review found four issues: OAuth error callbacks validated state too late, a second CLI branch exposed the client id, helper-only tests did not exercise the repaired control flows, and this ignored spec was not yet tracked. The implementation now validates callback ownership first, routes every client-id diagnostic through presence-only output, and exercises the production Permission/OAuth/SSE/CLI paths. The second review found that a valid-state callback without code/error still left its owner pending, the spec had not yet been staged, and database-level out-of-order metric execution was not proven. The malformed callback now immediately rejects its owner, the runtime metric test inserts dependent-before-source rows, and this spec is explicitly force-added. The third review found that a callback could reject before the browser-open probe attached an await handler. Callback registration now immediately converts fulfillment/rejection into a typed settlement that is consumed after browser startup. The fourth independent review reproduced both fast callback paths, reran all focused acceptance, and reported zero unresolved findings.

## Root-cause model

The first P0 batch fixed the most visible call sites but left parallel decision paths: pending permission propagation bypassed the new evaluator, public errors were classified by status instead of error identity, metric dependencies read the durable history instead of the current occurrence, stringify used another YAML engine, and streaming/CLI diagnostics bypassed the server/log redaction contract.

## Current contracts

1. A pending permission request retains the current ruleset used when it was admitted. Direct evaluation and `always` propagation use the same request evaluator. A current `ask` or `deny` decision remains authoritative over persisted approvals.
2. `NamedError.Unknown` and unclassified exceptions use the generic public 500 response. Other typed `NamedError` instances retain their declared public identity even when their status is 500.
3. Same-iteration metric dependencies are evaluated deterministically from the current execution occurrence. Durable metric history is read only for another iteration. Dependency cycles settle as typed unavailable results and never fall back to an earlier occurrence.
4. Frontmatter parse and stringify use one explicit js-yaml v4 engine.
5. CLI credential diagnostics expose presence and expiry metadata, never credential bytes or prefixes.
6. A caught streaming server failure logs the private exception with a request id and emits only the generic public message.
7. Each OAuth flow owns a random correlation id independent of OAuth state. Start, callback, and callback validation logs use that id without exposing state, code, tokens, or pending-state values.

## Deletion boundaries

- Delete persisted-approval-only pending auto-resolution.
- Delete status-based blanket rewriting of typed 500 errors.
- Delete same-iteration metric reads from durable history.
- Delete Gray Matter's default YAML stringify engine from the runtime path.
- Delete token-prefix output.
- Delete raw streaming exception output.
- Delete OAuth log records without a correlation identity for flow and callback events.

## Focused verification

- Permission tests execute two real pending requests and assert that `always` cannot auto-resolve a second current-`ask` request.
- Error tests assert generic unknown 500 and preserved typed 500 schemas.
- Metric runtime tests assert a dependency registered out of row order reads the current occurrence and cycles produce typed unavailable results.
- Frontmatter tests assert parse/stringify round-trip output.
- Credential diagnostic tests assert both stored and discovered client credential summaries.
- Stream-error tests execute the production catch helper and assert the generic public event, request id, and private diagnostic input.
- OAuth tests execute the production callback handler and assert invalid provider-error callbacks are rejected before a valid correlated flow is consumed.

## Verification-discovered follow-up

`test/engine-interaction-recovery.test.ts` exposes a pre-existing ownership conflict outside this batch: Permission and Question state disposers publish terminal events through a Bus that is being disposed concurrently, while the recovery checker expects durable pending interactions to remain owned by the next runtime's reconciler. A disposal-order-only change makes the opposite contract observable and was therefore rejected. The lifecycle owner and durable terminal-event contract require a separate remediation batch before changing State or Bus disposal.
