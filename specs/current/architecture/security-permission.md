# Security and Permission Boundaries

## Current authority

1. Operator authorization has exactly two modes: `full_access` (shown as **Full access**, the default) and `ask` (shown as **Ask me**). The effective mode is persisted per Session at its first permission-bearing invocation, so a config reload cannot silently change an active Session's authority.
2. Tool installation, agent assignment, Skill enablement, per-message switches, and Session Tool projection are capability controls. They use `CapabilityRules` (`allow | deny`) and are not operator authorization.
3. Every executable built-in, plugin, Skill, Model Context Protocol (MCP), MCP App, Browser, Computer, projected, scheduled, or external provider crosses `withTaskToolInvocation`, which delegates to `PermissionAuthority.authorizeAndExecute` before the physical effect.
4. `Ask me` pauses concrete write, process, network, external-effect, credential-release, or destructive invocations. Ordinary canonical reads inside the exact project and host-owned observation/control-plane operations do not prompt. Reads outside the project become permission-bearing.
5. `Full access` bypasses OpenCorvus authorization prompts for every Tool and MCP invocation, but it does not bypass identity, authentication, canonical-path, stale-runtime, Task ownership, or data-integrity checks.
6. Host-native non-effectful stage Tools use the explicit `internal` provider kind. They still cross the shared persisted Tool invocation wrapper and receive exact project/Session/Message/call/part/Tool authority, but `PermissionAuthority` returns no permission descriptor and therefore never turns an internal collector/read operation into an operator authorization request. Effectful materialized stage Tools retain their projected provider binding and ordinary permission classification.

## Exact scope and decisions

The invocation descriptor binds provider kind and identity, provider/config digest, Tool identity, effect class, redacted normalized arguments, an exact argument hash, and a scope-schema version. Any material change produces a new fingerprint and therefore a new request.

`Ask me` can offer:

- `allow_once`: the exact invocation;
- `allow_task`: the exact typed scope within the owning Task;
- `allow_project`: the exact typed scope within the project, only for canonical built-in local reads and a normalized built-in `webfetch` endpoint;
- `deny`: the exact request.

Destructive, credential-release, and general external-effect operations cannot receive project-wide grants. Revocation appends a ledger fact and prevents later grant use. Project deletion appends an `expired` fact for every still-active project-wide grant inside the same fenced database transaction that deletes the Project row. A same-path Project occurrence may reuse durable Project identity, but it cannot inherit reusable authorization across that explicit deletion boundary.

## Durable ledger and recovery

`permission_policy` freezes the Session mode and revision. `permission_ledger` is the append-only single source of truth for requests, decisions, grant creation/use/revocation, Full-access admission, execution starts, terminal outcomes, and unknown outcomes. Unique decision, execution-start, and outcome slots enforce compare-and-set settlement and at-most-once execution admission.

The canonical `requested` row is the only owner of the complete Project, Session, Message, Tool-call, provider, scope, and fingerprint identity; later rows are deltas keyed by `request_id`. The entire ledger chain outlives mutable Project and Session retention, so `permission_ledger.project_id` is not a cascading foreign key. Project-scoped history and grant readers select through the canonical owner in Structured Query Language (SQL) before reconstructing a request. Historical child residue whose owner was deleted by an older schema remains preserved and unassigned: it cannot authorize work or poison another Project's reads, and no fabricated owner or destructive cleanup is permitted. Startup atomically replaces only the normalized historical cascading schema, repeats the complete shape check after acquiring the write lock, and copies every declared value plus the exact SQLite `rowid` unchanged so the ledger's runtime order remains stable.

The ledger stores redacted scope plus hashes; it must not store tokens, cookies, passwords, authorization headers, OAuth secrets, secret environment values, or complete sensitive content.

Pending requests survive process release and project restart. A later client can settle the same durable request. A started attempt without a terminal result becomes `outcome_unknown`; the same attempt is not blindly replayed. Engine interaction rows are presentation projections that reference the ledger request rather than a second approval authority.

## Transport contract

The Overlay, Application Client Protocol (ACP), command-line interface, channel runtime, protocol mirror, server routes, and generated Software Development Kit share the same request identity and decisions. Presentation adapters may translate labels, but they cannot invent approval scopes or settle outside the canonical reply/revoke APIs.

## Adjacent security boundaries

- Large Language Model telemetry may record operational metadata; prompt, message, response, and Tool content capture remains disabled without a separate opt-in contract.
- OAuth diagnostics may record server/host/correlation metadata but never authorization URLs, state, code, token values, or pending-state lists.
- Public unknown HTTP errors use a generic body and a request identifier; full diagnostics remain server-side.
- Query metric evaluators remain typed named projections rather than arbitrary Structured Query Language (SQL).
