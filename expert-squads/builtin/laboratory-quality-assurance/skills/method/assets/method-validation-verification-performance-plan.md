# Method Validation or Verification Performance Plan

## Controlled artifact header

- Artifact ID: `LAB-METHOD-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[protocol/raw-data/calculation inventory]`
- Source ID / locator / version / date: `[protocol or study] / [raw-data locator] / [version] / [study/retrieval date]`
- Data-lock / effective date: `[date and timezone]`
- Responsible owner: `[method study owner]`
- Qualified reviewer: `[method SME, statistician where applicable, technical and quality managers]`
- Jurisdiction / applicability: `[site/method/measurand/matrix/range/intended use]`
- Privacy and license constraints: `[sample/result classification and software/data terms]`
- Overall uncertainty / confidence: `[design, replicate, model, missingness and transfer limitations]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No acceptance-criterion selection, method fitness, equivalence, validation/verification approval, clinical interpretation, or result-release decision.`
- Stop condition / reason: `[missing protocol/criteria/raw data/version/unit/authorization]`

## Performance rows

| Characteristic row ID | Activity type                                     | Method/version | Measurand/matrix/range | Intended use | Protocol/source/version/date | Raw-data locator       | Replicates/denominator       | Observed value and unit | Formula/software/version | Owner-supplied criterion and source | Comparison only                       | Deviations/exclusions | Owner     | Qualified reviewer | Applicability | Assumptions    | Uncertainty     | Status    | Decision explicitly not made | Stop reason |
| --------------------- | ------------------------------------------------- | -------------- | ---------------------- | ------------ | ---------------------------- | ---------------------- | ---------------------------- | ----------------------- | ------------------------ | ----------------------------------- | ------------------------------------- | --------------------- | --------- | ------------------ | ------------- | -------------- | --------------- | --------- | ---------------------------- | ----------- |
| `LAB-M-001`           | `[validation/verification/transfer/modification]` | `[ID/version]` | `[scope]`              | `[use]`      | `[protocol locator]`         | `[immutable raw data]` | `[n replicates / planned n]` | `[value unit]`          | `[calculation identity]` | `[criterion; never invented]`       | `[observed comparison, not approval]` | `[deviation]`         | `[owner]` | `[reviewer]`       | `[scope]`     | `[assumption]` | `[uncertainty]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Characteristics and safeguards

Include only protocol-authorized precision, bias/trueness, recovery, selectivity/specificity, linearity/calibration model, reportable range, detection/quantification capability, carryover, stability, or robustness. Preserve run/operator/instrument/lot/level structure, missingness, transformations, outlier-rule source, rounding, and units. Never invent universal thresholds, remove data, choose a model, or extrapolate to an unstudied matrix or range.

## Review queue

List every unmet or ambiguous criterion, deviation, missing raw observation, model uncertainty, unit conflict, or scope question with exact provenance, owner, qualified reviewer, applicability, uncertainty, status, decision not made, and stop reason. A comparison result cannot be presented as an approved method decision.
