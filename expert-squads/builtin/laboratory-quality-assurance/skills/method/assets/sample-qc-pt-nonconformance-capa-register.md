# Sample, QC, PT, Nonconformance, and CAPA Register

## Controlled artifact header

- Artifact ID: `LAB-QC-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[custody/run/QC/PT/nonconformance/CAPA inventory]`
- Source ID / locator / version / date: `[record/procedure/scheme] / [exact locator] / [version] / [date]`
- Data-lock / effective date: `[dates with timezone and semantics]`
- Responsible owner: `[sample/run/quality owner]`
- Qualified reviewer: `[method SME, quality/technical manager, PT reviewer, director/signatory]`
- Jurisdiction / applicability: `[site/method/matrix/run/scheme/period]`
- Privacy and license constraints: `[sample/result confidentiality and PT terms]`
- Overall uncertainty / confidence: `[custody gaps, baseline/rule limitations]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No sample disposition, rerun, invalidation, result release, control-limit, OOS/OOT/PT interpretation, root-cause, CAPA, closure, or external-notification decision.`
- Stop condition / reason: `[broken custody/unknown rule/version/unit/authorization]`

## Evidence rows

| Row ID      | Record type                                                             | Sample/batch/run/QC/PT/CAPA ID | Custody actor/date/time/location/condition | Method/equipment/version | Source locator/version/date | Observed value/unit | Target/limit/assigned value and source | Count/denominator          | Formula/rule/version      | Deviation/investigation/action evidence | Owner     | Qualified reviewer | Applicability | Assumptions    | Uncertainty     | Privacy/license | Status    | Decision explicitly not made | Stop reason |
| ----------- | ----------------------------------------------------------------------- | ------------------------------ | ------------------------------------------ | ------------------------ | --------------------------- | ------------------- | -------------------------------------- | -------------------------- | ------------------------- | --------------------------------------- | --------- | ------------------ | ------------- | -------------- | --------------- | --------------- | --------- | ---------------------------- | ----------- |
| `LAB-Q-001` | `[custody/blank/duplicate/spike/CRM/QC/PT/OOS/OOT/nonconformance/CAPA]` | `[ID]`                         | `[event evidence]`                         | `[version]`              | `[locator]`                 | `[value unit]`      | `[versioned authorized source]`        | `[n / defined population]` | `[procedure/scheme rule]` | `[facts only]`                          | `[owner]` | `[reviewer]`       | `[scope]`     | `[assumption]` | `[uncertainty]` | `[constraints]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Method controls

Reconstruct custody without filling gaps. Compare QC only to versioned limits from an authorized procedure and valid baseline. Preserve blanks, duplicates, spikes, certified reference materials, environment, run order and lot. Calculate `z` or `E_n` only from the PT scheme's assigned value, standard deviation or uncertainties and rule version; never apply generic thresholds. Trace nonconformance through containment, investigation, cause evidence, correction, CAPA, effectiveness evidence and owner decision without declaring closure.

## Stop and route

Stop on broken custody, unknown identity/method/unit/limit source/scheme version, mixed data locks, unauthorized result data, or missing investigation evidence. Do not rerun, discard, quarantine, release, invalidate, notify, modify LIMS, assign cause, or close an event. Route each item to named qualified owners.
