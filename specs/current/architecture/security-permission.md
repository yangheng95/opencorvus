# Security, Permission, and Metric-Evaluator Boundaries

## Recall

- User request: the repository was largely AI-authored and likely contains unprofessional architecture abstractions. The user requested multiple-agent investigation, a high-quality solution, review, then repair in an isolated worktree.
- Acceptance indicators: P0 security and permission defects from the remediation plan are fixed on a branch-local worktree; current architecture authority exists under `specs/current/architecture/**`; focused tests cover the repaired behavior; an independent read-only review finds no unresolved issues.
- Hard constraints: do not preserve fallback or compatibility paths; do not use host workflow gates to teach LLM flow; all LLM calls remain streaming; messages and logs must not synthesize or leak hidden sensitive content; no UI automation applies to this backend-only batch.
- Read materials: `specs/records/2026-08/2026-08-09-architecture-debt-remediation-plan.md`, `packages/opencorvus/src/permission/next.ts`, `packages/opencorvus/src/session/llm.ts`, `packages/opencorvus/src/mcp/**`, `packages/opencorvus/src/server/error-handler.ts`, `packages/opencorvus/src/metrics/**`, `packages/plugin/src/metric-evaluation.ts`, and the Evolution Lab scorer contract artifacts.
- Whole-repository search results: security-sensitive findings were located in permission approval merging, LLM telemetry options, MCP OAuth logging, server unknown-error responses, and raw SQL metric query evaluators. No earlier `specs/current/architecture/**` authority existed in the isolated worktree before this repair.
- Independent agent feedback: the prior remediation plan review required adding current architecture authority before implementation; no implementation review has run yet for this repair branch.

## Authority

1. Current request rules are the highest permission authority. Persistent user approvals are lower-priority grants and cannot override a current `deny` or `ask` rule.
2. LLM telemetry may record operational metadata by default. Prompt, message, response, and tool content capture is disabled unless a future explicit product contract introduces a separate opt-in authority.
3. OAuth logs may record flow phase, MCP server identity, authorization host, callback path, booleans, error code strings, and pending counts. Logs must not record full authorization URLs, OAuth `state`, authorization `code`, token values, or lists of pending states.
4. Public unknown HTTP errors return a stable `UnknownError` body with a generic message. The request identifier is exposed through `x-opencorvus-request-id` and logged server-side with the full diagnostic.
5. Query metric evaluators are typed named projections, not arbitrary SQL. They may emit a constant measurement or read a declared column from an existing metric result for a relative iteration.

## Non-Goals

- This document does not define every server route or metric kind.
- This batch does not rewrite historical dated records.
- This batch does not alter UI behavior or UI validation.
