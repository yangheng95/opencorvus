# Reference Safety Information Version Trace

## Controlled artifact header

- Artifact ID: `PV-RSI-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[document-control inventory ID]`
- Source ID / locator / version / date: `[RSI or controlled document ID] / [exact section locator] / [version] / [issue date]`
- Effective date / data-lock date: `[both dates, not conflated]`
- Responsible owner: `[document-control or regulatory owner]`
- Qualified reviewer: `[safety physician, QPPV, regulatory and document-control reviewers]`
- Jurisdiction / applicability: `[product, population, region/program and exclusions]`
- Unit: `[document versions or N/A; state explicitly]`
- Privacy and license constraints: `[controlled-document classification and reuse limits]`
- Uncertainty / confidence: `[missing versions, ambiguous effective period, unresolved source conflict]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No expectedness, reportability, compliance, label/RSI wording, effective-date, risk-plan, submission, or regulatory decision.`
- Stop condition / reason: `[precise missing version/effective date/jurisdiction/authorization]`

## Version and applicability trace

| Trace row ID | Document ID/version | Source locator/version/date | Effective start/end  | Data lock | Jurisdiction/product/population applicability | Supersedes / superseded by | Referenced signal/evidence/action IDs | Value/count and unit/denominator                    | Owner     | Qualified reviewer | Assumptions    | Uncertainty     | Privacy/license | Status    | Decision explicitly not made | Stop reason |
| ------------ | ------------------- | --------------------------- | -------------------- | --------- | --------------------------------------------- | -------------------------- | ------------------------------------- | --------------------------------------------------- | --------- | ------------------ | -------------- | --------------- | --------------- | --------- | ---------------------------- | ----------- |
| `PV-RSI-001` | `[ID/version]`      | `[locator/version/date]`    | `[authorized dates]` | `[date]`  | `[scope]`                                     | `[version links]`          | `[IDs only]`                          | `[1 version / document versions / inventory count]` | `[owner]` | `[reviewer]`       | `[assumption]` | `[uncertainty]` | `[constraints]` | `[state]` | `[reserved human decision]`  | `[reason]`  |

## Reconciliation controls

Do not replace older versions. Trace which version was supplied as effective for each jurisdiction and relevant period, and preserve the source of that assertion. Link signal or case evidence only by stable IDs; never decide expectedness from text. If labels, company core data sheets, investigator brochures, or other reference documents differ, record each controlled identity and route the conflict to qualified owners.

## Review queue

Record unresolved version gaps, inconsistent effective dates, missing document-control approvals, jurisdiction conflicts, or unclear source locators with responsible owner, qualified reviewer, evidence requested, status, decision explicitly not made, and stop reason. This trace is not authorization to edit, approve, publish, submit, or use a controlled document operationally.
