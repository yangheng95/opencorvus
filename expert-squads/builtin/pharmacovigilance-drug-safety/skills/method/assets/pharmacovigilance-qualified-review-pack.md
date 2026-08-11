# Pharmacovigilance Qualified Review Pack

## Controlled artifact header

- Artifact ID: `PV-JOIN-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[joined source inventory and branch artifact index]`
- Source ID / locator / version / date: `[branch IDs and exact locators]`
- Data-lock / effective date: `[reconciled dates or explicit conflict]`
- Responsible owner: `[PV review-pack owner]`
- Qualified reviewer: `[case processor/coder, safety physician, epidemiologist/statistician, QPPV, regulatory, privacy/legal, document control]`
- Jurisdiction / applicability: `[product/event/program/period and exclusions]`
- Unit / denominator: `[case records, reports, calculations, signals and documents kept separate]`
- Privacy and license constraints: `[classification, access and reuse terms]`
- Overall uncertainty / confidence: `[coverage and unresolved-conflict statement]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No medical, coding, causality, seriousness, expectedness, reportability, validated-signal, submission, label/RSI/risk-plan, compliance, or regulatory-action decision.`
- Stop condition / reason: `[missing branch, incompatible lock/scope, privacy or evidence blocker]`

## Branch join matrix

| Join row ID   | Branch | Artifact ID/version | Source lock and date | Scope/population | Value/count and unit/denominator | Key evidence and exact locator | Conflicts/unknowns         | Owner       | Qualified reviewer   | Applicability | Assumptions  | Uncertainty | Status         | Decision explicitly not made | Stop reason                            |
| ------------- | ------ | ------------------- | -------------------- | ---------------- | -------------------------------- | ------------------------------ | -------------------------- | ----------- | -------------------- | ------------- | ------------ | ----------- | -------------- | ---------------------------- | -------------------------------------- | --------------------- | ---------- |
| `PV-JOIN-001` | `[case | aggregate           | RSI/risk/signal]`    | `[ID/version]`   | `[inventory/lock]`               | `[scope]`                      | `[value/unit/denominator]` | `[locator]` | `[unresolved issue]` | `[owner]`     | `[reviewer]` | `[scope]`   | `[assumption]` | `[uncertainty]`              | `[complete/review/stopped/superseded]` | `[reserved decision]` | `[reason]` |

## Required reconciliation

Cross-check case versions and duplicate-candidate populations against aggregate cells without merging records. Confirm every PRR/ROR row is reproducible from a, b, c and d and carries limitations. Cross-link evidence to RSI and risk-plan versions effective at the relevant supplied date. Preserve separate meanings for cases, reports, patients, events, calculations, signals, actions and documents. Keep every disagreement visible.

## Qualified review routing and final state

List each pending question, exact evidence, accountable qualified role, privacy/license constraint, requested review, decision/status, decision explicitly not made, and stop condition. The final state describes pack completeness only. It cannot authorize a case/system change, medical conclusion, report/submission, external communication, or controlled-document action.
