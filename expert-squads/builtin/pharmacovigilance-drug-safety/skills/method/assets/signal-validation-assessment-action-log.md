# Signal Validation, Assessment, and Action Log

## Controlled artifact header

- Artifact ID: `PV-SIG-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[signal-governance inventory ID]`
- Source ID / locator / version / date: `[signal record or procedure] / [exact locator] / [version] / [retrieval date]`
- Data-lock / effective date: `[dates with semantics]`
- Responsible owner: `[signal process owner]`
- Qualified reviewer: `[safety physician, epidemiologist/statistician, QPPV/signal committee, regulatory owner]`
- Jurisdiction / applicability: `[product/event/database/program/period]`
- Unit: `[signals, actions, documents, or N/A; state denominator]`
- Privacy and license constraints: `[classification and disclosure limits]`
- Uncertainty / confidence: `[evidence gaps and methodological limits]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No signal validation, confirmation, prioritization, medical assessment, recommendation, action, closure, compliance, submission, or communication decision.`
- Stop condition / reason: `[missing stage definition/evidence/owner/version/authorization]`

## Stage and action rows

| Row ID       | Signal ID | Stage name and governing procedure/version                                                                               | Source locator/version/date | Evidence added / linked IDs | Stage date and data lock | Value/count and unit/denominator          | Evidence creator | Review owner | Decision owner               | Action owner     | Due-date source       | Completion evidence   | Applicability | Assumptions    | Uncertainty     | Status    | Decision explicitly not made | Stop reason |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------- | --------------------------- | ------------------------ | ----------------------------------------- | ---------------- | ------------ | ---------------------------- | ---------------- | --------------------- | --------------------- | ------------- | -------------- | --------------- | --------- | ---------------------------- | ----------- |
| `PV-SIG-001` | `[ID]`    | `[detection/validation/confirmation/analysis-prioritization/assessment/recommendation/action only if procedure uses it]` | `[locator/version/date]`    | `[artifact IDs]`            | `[date/lock]`            | `[n items / items / reviewed population]` | `[owner]`        | `[reviewer]` | `[qualified decision owner]` | `[action owner]` | `[controlled source]` | `[locator or absent]` | `[scope]`     | `[assumption]` | `[uncertainty]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Governance rules

The stage vocabulary is a trace framework, never evidence that a stage is complete. Preserve decisions and their source as records made by named qualified owners. Do not infer approval from attendance, a due date from memory, closure from missing activity, or compliance from a completed field. Cross-link aggregate calculations, case-population definitions, RSI/risk-plan versions, meeting records, and action evidence without altering them.

## Escalation queue

List unresolved evidence, contradictory decisions, unclear ownership, due-date provenance gaps, missing completion evidence, and stopped items. Assign an owner and qualified reviewer but do not contact regulators, reporters, patients, or external parties; do not update a signal system, label, RSI, risk plan, report, or submission.
