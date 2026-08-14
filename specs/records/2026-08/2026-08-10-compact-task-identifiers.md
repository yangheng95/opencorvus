# Compact Task identifiers

## Recall

| Item | Record |
| --- | --- |
| User request | Shorten newly generated Task identifiers to the necessary number of characters in product code, rather than merely abbreviating them in status narration. |
| Acceptance | A new Task identifier keeps the canonical `tsk_` prefix, remains time-sortable and collision-resistant, is materially shorter than the current 43-character value, continues to work as the exact database/API/filesystem authority, and exposes its creation timestamp through the existing identifier helper. |
| Hard constraints | Preserve stored identifiers exactly; do not rewrite existing Tasks; do not shorten route parameters, database keys, copy values, or diagnostic authority; keep one generator as the source of truth; add a focused positive non-UI test; preserve unrelated dirty-worktree changes. |
| Read architecture and code | `packages/opencorvus/src/id/id.ts`; Task creation call sites in `memory/task-plan.ts`, `scheduler/task-queue-service.ts`, and `task-api/index.ts`; `specs/current/architecture/task-control-plane.md`. |
| Repository search | Task ordering has a dedicated persisted `orderKey`; Task runtime directories derive an eight-character key by hashing the full Task ID; no production caller applies `Identifier.timestamp` specifically to a Task today; existing Task IDs are accepted by the already-canonical schema. |
| Independent agent feedback | None. This isolated side conversation explicitly prohibits sub-agent interaction, so implementation cannot claim the repository-mandated independent review. |

## Problem and root cause

The visible 43-character value is the real persisted Task identifier, not only a
rendering choice. `Identifier.create` currently gives every identifier family the
same expanded body: one direction marker, two 48-bit fields rendered as 12 hex
characters each, and fourteen Base62 random characters. That size is useful for
high-volume message and event families but exceeds the Task identity requirement.

The direct trigger is `Identifier.ascending("task")` at every Task creation
boundary. The underlying cause is that the generator has no Task-specific compact
encoding even though Task creation is lower-volume, Task chronological ordering is
already represented by `orderKey`, and runtime paths hash the exact identifier.
Changing only a UI label would leave the long value in API receipts, logs, copied
references, and assistant-visible tool output, so it would not satisfy the request.

## Design

New Tasks use one compact sortable body:

`tsk_` + direction marker + 9 Base62 timestamp characters + 2 Base62 logical
sequence characters + 8 Base62 random characters.

This produces a fixed 24-character identifier. Nine Base62 characters cover the
complete existing 48-bit timestamp domain. The two-character sequence gives 3,844
ordered identities per logical millisecond. Exhausting that complete Task-local
window raises an explicit generation error instead of encoding a later timestamp
that did not own the creation request. Eight random Base62 characters provide more
than 47 bits of cross-process collision entropy. A Task-local clock prevents
unrelated high-volume message generation from consuming the compact Task sequence
space.

The existing canonical Task schema already accepts both stored and newly generated
identifiers, so no second parser, migration, fallback, or rewrite is introduced.
`Identifier.timestamp` reads the new fixed Task body and continues to read the
existing expanded body. All database, API, file, and diagnostic consumers still
receive the complete exact ID.

## Verification

- Focused positive test generates the complete compact sequence window at one
  timestamp and proves fixed length, uniqueness, lexical creation order, canonical
  schema acceptance, and exact timestamp recovery.
- Run the focused test and the OpenCorvus package typecheck.
- Independent review remains an explicit delivery blocker in this side conversation;
  do not commit or push from this thread without that required review.

Current local evidence:

- `bun test --timeout 120000 packages/opencorvus/test/compact-task-identifier.test.ts`: 2 passed, 0 failed, 7 expectations.
- `bun run --cwd packages/opencorvus typecheck`: passed.
- `bun run docs:check`: passed with 329 operations across 25 groups.
- Direct generation produced canonical 24-character ID `tsk_g00VRuIAo800p5dMTdou` and recovered timestamp `1786374695836`.
