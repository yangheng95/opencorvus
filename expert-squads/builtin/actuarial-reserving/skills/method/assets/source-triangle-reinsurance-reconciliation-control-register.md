# Source, Triangle and Reinsurance Reconciliation Control Register

## Governance header

- Register ID / entity / portfolio / coverage: `____`
- Valuation date / evidence cutoff and timezone / extraction date: `____ / ____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit and basis: `currency; gross/ceded/net; paid/incurred/case; nominal/discounted; ALAE/ULAE treatment`
- Applicability: `source ledger | analysis dataset | incremental triangle | cumulative triangle | reinsurance control`
- Uncertainty: `____`; status: `draft | open | qualified review required | reviewed`
- Decision not made by this asset: `data fitness approval, claim correctness, accounting acceptance, reserve selection, booking or actuarial opinion`
- Stop condition: `missing scope/basis/version/control total, broken lineage, confidential-data exposure or unexplained material difference`

## Reconciliation controls

| Control ID | Origin/development or population | Source object and controlled record | Target dataset/triangle/reinsurance object | Expected amount / unit / basis | Observed amount / unit / basis | Difference | Identity or transformation | Source version | Source/effective date | Extraction date | Owner  | Reviewer | Applicability | Uncertainty | Status | Evidence pointer | Decision not made | Stop condition |
| ---------- | -------------------------------- | ----------------------------------- | ------------------------------------------ | ------------------------------ | ------------------------------ | ---------- | -------------------------- | -------------- | --------------------- | --------------- | ------ | -------- | ------------- | ----------- | ------ | ---------------- | ----------------- | -------------- |
| REC-001    | `____`                           | `____`                              | `____`                                     | `____`                         | `____`                         | `____`     | `____`                     | `____`         | `____`                | `____`          | `____` | `____`   | `____`        | `____`      | `open` | `____`           | `____`            | `____`         |

## Data rule and exception trace

| Rule/exception ID | Inclusion, exclusion or transformation | Claim/status/reopen/large-loss/catastrophe/expense/currency/reinsurance treatment | Authorized specification and version | Population and amount affected | Control consequence | Resolver | Reviewer | Status |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------ | ------------------- | -------- | -------- | ------ |
| RULE-001          | `____`                                 | `____`                                                                            | `____`                               | `____`                         | `____`              | `____`   | `____`   | `open` |

Reconcile the source to analysis records, analysis records to incremental triangles, increments to cumulative triangles, and gross minus ceded to net when that is the authorized identity. Check diagonals, partial periods, valuation cutoff, duplicates, missing cells, negative transactions, reopenings, salvage/subrogation and expense classification. Record discrepancies instead of forcing balance. Keep personal claim details outside this register unless specifically authorized and minimized. A closed arithmetic control does not establish coverage, claim liability, financial-statement treatment or reserve adequacy.
