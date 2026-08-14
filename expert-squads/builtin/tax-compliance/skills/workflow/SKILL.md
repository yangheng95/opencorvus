---
name: tax-compliance-workflow
description: Execute the binding tax compliance evidence chain with parallel accounting and tax analysis, independent review, and canonical reporting.
---

# Tax Compliance workflow

Use only `tax-compliance-assessment`. Every node runs exactly once. Accounting controls and tax obligations are the only parallel branch and both begin after the evidence dossier. The remediation analyst joins both branches. The fact checker directly verifies only the remediation analyst's single synthesized compliance plan. The report writer follows the audit.

Every worker enumerates the complete current Task Artifact catalog, completely reads exact chosen locators, and selects every semantic source. Domain outputs use `publish_tax_compliance_artifact`; do not duplicate them through generic `artifact_publish`. Dispatches carry intent and scope only.

The report writer reads all six predecessor types, writes, rereads, verifies, and commits `artifacts/tax-compliance/report.md`, obtains `merged` from `merge_back` when available, completely reads the final file from the exact immutable returned `primary_head`, passes that same value as `artifact_snapshot.source_commit`, publishes `tax-compliance/report` with the exact resource set, and publishes a `document@1` from those commit bytes. It performs no write or Git mutation after merge. When already operating in the primary project without `merge_back`, it omits `source_commit` and snapshots the reread file directly.
