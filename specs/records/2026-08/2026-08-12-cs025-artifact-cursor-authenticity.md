# CS-025 — Artifact Catalog cursor authenticity

## Recall

- User request: keep repairing the admitted code-smell backlog directly and in parallel without moving defects between subsystems.
- Finding: Artifact Catalog pagination serialized server-owned snapshot totals, provider state, membership digests, frozen revision bounds, and position into a client bearer protected only by `SHA-256(payload)`. A caller could edit those facts and recompute the checksum.
- Acceptance: a cursor issued by the current server runtime remains compact and completes the same frozen multi-page search; a caller that edits any payload field and recomputes the old public digest is rejected; cursor authority/filter checks remain exact.
- Hard constraints: one current protocol only; no compatibility decoder, database/config secret, fallback, UI work, or UI automation. Preserve unrelated dirty-worktree changes.
- Read/search scope: `artifact-catalog/index.ts` cursor types/encoder/decoder/search consumers; plugin cursor size/public opaque contract; focused cursor test; repository audit `CS-025`; existing HMAC usage and database identity primitives.
- Independent agent feedback before implementation: none for this isolated batch; the repository audit already supplied an independent definition/caller/consumer trace.

## Root cause and design

The cursor is an opaque, process-issued capability carrying a frozen pagination snapshot. A corruption digest is not an authenticity boundary because its algorithm and full input are public. The single replacement protocol uses a process-random 256-bit Hash-based Message Authentication Code (HMAC) key and HMAC-SHA-256 over the canonical compact payload. Verification uses constant-time comparison before any server-owned cursor facts are trusted.

The key is intentionally runtime-scoped. No second durable secret/config authority is introduced; a restart invalidates outstanding short-lived interactive search cursors, and callers start a new search. The wire version is replaced in place and the unkeyed digest decoder is deleted.

## Positive verification

- Publish a real 50-entry catalog, traverse both pages, publish a later entry, and prove the original cursor still returns exactly the frozen 50 entries within the transport byte bound.
- Decode a valid cursor only inside the focused test, change a server-owned total, recompute the previous public SHA-256 checksum, and prove production search rejects it as an authenticity failure.
- Prove an unchanged cursor remains accepted, authority/filter mismatch errors remain exact, typecheck passes, and the task-owned diff is clean.

## Impact

The plugin, SDK, and HTTP shapes remain an opaque string and require no generated contract change. Only server runtime cursor issuance/verification and the focused non-UI contract test change.

## Current verification

- Real 50-entry two-page ToolHost traversal, frozen membership after a later publication, both page byte bounds, modified-total plus recomputed old public SHA-256 rejection, exact authority/filter mismatch, and malformed cursor contracts pass in `1` focused test / `19` assertions.
- Task-owned diff check passes. Package typecheck is currently blocked by concurrent non-owned storage/Memory worktree edits and reports no CS-025-owned file diagnostic.
- Independent review found only that the second ToolHost page lacked its own byte-bound assertion. That assertion was added; the reviewer independently reran the final `1` test / `19` assertions and exact diff check, then issued PASS with no remaining finding.
