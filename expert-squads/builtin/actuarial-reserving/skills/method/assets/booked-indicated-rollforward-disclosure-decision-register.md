# Booked, Indicated, Roll-forward, Disclosure and Decision Register

## Governance header

- Register ID / entity / portfolio / current and prior valuation dates: `____`
- Evidence cutoff and timezone / extraction date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit and basis: `currency; gross/ceded/net; nominal/discounted; booked/indicated; loss/ALAE/ULAE`
- Applicability: `roll-forward | booked-indicated bridge | governance | disclosure | unresolved decision`
- Uncertainty: `____`; status: `draft | open | qualified review required | reviewed/approved by named authority`
- Decision not made by this asset: `booked reserve, journal posting, actuarial opinion, filing, disclosure approval, accounting/legal/tax conclusion`
- Stop condition: `scope/basis mismatch, non-closing equation, unsupported material movement, missing authority or disclosure beyond evidence`

## Roll-forward and bridge

| Movement ID | Type                                                                                                | Prior amount / unit / basis | Addition | Subtraction | Current amount / unit / basis | Equation check/residual | Booked or indicated | Source URI or controlled record | Version | Source/effective date | Owner  | Reviewer | Applicability | Uncertainty | Status | Evidence pointer | Decision not made | Stop condition |
| ----------- | --------------------------------------------------------------------------------------------------- | --------------------------- | -------- | ----------- | ----------------------------- | ----------------------- | ------------------- | ------------------------------- | ------- | --------------------- | ------ | -------- | ------------- | ----------- | ------ | ---------------- | ----------------- | -------------- |
| MOVE-001    | `paid/runoff/new-origin/prior-development/data/method/assumption/mix/reinsurance/fx/discount/other` | `____`                      | `____`   | `____`      | `____`                        | `____`                  | `____`              | `____`                          | `____`  | `____`                | `____` | `____`   | `____`        | `____`      | `open` | `____`           | `____`            | `____`         |

## Disclosure and accountable decision trace

| Record ID | Statement or decision question | Scope/basis/date | Supporting and contradictory evidence IDs | Limitation/uncertainty | Accountable authority | Qualified reviewers | Decision/conditions if authorized | Effective/expiry/re-review trigger | Status |
| --------- | ------------------------------ | ---------------- | ----------------------------------------- | ---------------------- | --------------------- | ------------------- | --------------------------------- | ---------------------------------- | ------ |
| DEC-001   | `____`                         | `____`           | `____`                                    | `____`                 | `____`                | `____`              | `____`                            | `____`                             | `open` |

Close the prior-to-current identity while preserving each supported movement and every residual. Separate booked from indicated and trace, but never recommend, the difference. Link disclosures to the exact valuation scope, date, accounting basis, measure and supporting evidence, including adverse findings and uncertainty. Record model/workpaper versions, access/change control, reproducibility, review and approval evidence. This register does not post journals, determine accounting or regulatory treatment, approve wording, issue an actuarial opinion or authorize a reserve.
