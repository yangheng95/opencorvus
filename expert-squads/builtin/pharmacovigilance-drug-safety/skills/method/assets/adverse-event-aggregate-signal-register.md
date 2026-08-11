# Adverse Event Aggregate Signal Register

## Controlled artifact header

- Artifact ID: `PV-AGG-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[extract inventory and calculation-workbook locator]`
- Source ID / locator / version / date: `[database or dataset] / [immutable locator] / [extract and dictionary versions] / [retrieval date]`
- Data-lock date: `[ISO 8601]`
- Responsible owner: `[signal analytics owner]`
- Qualified reviewer: `[epidemiologist/biostatistician plus safety physician or signal governance]`
- Jurisdiction / applicability: `[database, product/event, population, strata and exclusions]`
- Privacy and license constraints: `[aggregate-use and disclosure limits]`
- Overall uncertainty / confidence: `[coverage, bias and small-count limitations]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No incidence, causality, clinical-risk, validated-signal, prioritization, label, RSI, risk-plan, reporting, or regulatory-action decision.`
- Stop condition / reason: `[missing cells/definitions/data lock/authorization or other precise reason]`

## Calculation rows

| Calculation ID | Product/event/comparator definitions | Stream and dictionary/version     | Source/version/date      |     a |     b |     c |     d | Cell unit and denominator      | Formula/version             |       PRR |       ROR | CI/correction if protocol-supplied | Stratum     | Owner     | Reviewer     | Applicability | Assumptions    | Uncertainty and bias                                                                                                                      | Status    | Decision explicitly not made | Stop reason |
| -------------- | ------------------------------------ | --------------------------------- | ------------------------ | ----: | ----: | ----: | ----: | ------------------------------ | --------------------------- | --------: | --------: | ---------------------------------- | ----------- | --------- | ------------ | ------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------- | ----------- |
| `PV-AGG-001`   | `[frozen definitions]`               | `[spontaneous/other; dictionary]` | `[locator/version/date]` | `[a]` | `[b]` | `[c]` | `[d]` | `[reports / included reports]` | `[PRR/ROR formula version]` | `[value]` | `[value]` | `[method or not authorized]`       | `[stratum]` | `[owner]` | `[reviewer]` | `[scope]`     | `[assumption]` | `[small counts, duplicates, missingness, stimulated reporting, indication, notoriety, co-medication, multiple testing, competition bias]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Reproducibility and limitations

Preserve the 2-by-2 cells and exact formulas. `PRR=(a/(a+b))/(c/(c+d))`; `ROR=(a*d)/(b*c)` only when cell meanings and protocol allow. Record rounding and any authorized continuity correction instead of selecting one. Separate spontaneous, solicited, study, literature, or registry streams. Spontaneous reports do not provide a reliable exposure denominator, so this register must not present incidence or risk. A numerical association is a screening observation requiring qualified review, not a signal declaration or medical conclusion.

## Sensitivity and review queue

List every authorized alternate deduplication rule, stratum, comparator, term grouping, or date window as a separate calculation ID with its own source/version/date and denominator. Record unresolved discrepancies, requested evidence, assigned owner, reviewer due date source, uncertainty, status, decision not made, and stop reason. Do not send, submit, or update any safety system from this artifact.
