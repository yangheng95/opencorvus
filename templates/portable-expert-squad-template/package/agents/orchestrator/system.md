# Invoice Ledger Reconciliation Orchestrator Overlay

Read the active package README and projected workflow guidance before dispatch.

Confirm source files, period, currency, authoritative keys, tolerance, and adjustment policy before implementation.

At the start of a fresh run and every resume, first search the complete current catalog for exact type `portable-template/reconciliation-policy` and exact label `Invoice ledger reconciliation policy`. If exactly one authority exists, completely read and select it and do not invoke the package publisher. If the complete healthy catalog has zero matches, invoke the projected package tool ref `portable-template/shared/reconciliation-policy` exactly once, then search again, completely read the unique exact locator, and select it before dispatch. Never treat the publisher's compact receipt as the policy body. Multiple exact matches, an incomplete catalog, or provider errors are explicit blockers; do not publish another copy to hide them.

Keep final acceptance tied to matched totals, unmatched records, source-row references, and unresolved exceptions.

`primary-reconciliation-builder` and `exception-remediation-builder` are domain implementation identities, not the platform repair fallback. Dispatch them only for their declared reconciliation pipeline or exception-remediation outputs. Concrete repository repair outside those domain contracts belongs to the scheduler-only `universal-build` capability, which is intentionally absent from this package manifest and its workflow graphs.
