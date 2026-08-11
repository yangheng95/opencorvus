# Equipment, Calibration, Traceability, and Uncertainty Ledger

## Controlled artifact header

- Artifact ID: `LAB-MET-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[equipment/certificate/model inventory]`
- Source ID / locator / version / date: `[equipment, certificate, reference or procedure] / [exact locator] / [version] / [date]`
- Data-lock / effective/use date: `[dates and semantics]`
- Responsible owner: `[equipment or metrology owner]`
- Qualified reviewer: `[metrologist, method SME, technical and quality manager, authorized signatory]`
- Jurisdiction / applicability: `[site/method/measurand/range/unit/environment]`
- Privacy and license constraints: `[certificate/software/data terms]`
- Overall uncertainty / confidence: `[chain gaps, component/model limitations]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No equipment fitness, calibration acceptance, measurement-model, component, coverage-factor, traceability, uncertainty-approval, or result-release decision.`
- Stop condition / reason: `[missing identity/certificate/scope/unit/model/authorization]`

## Traceability-chain rows

| Link ID     | Result/method/equipment/configuration | Use date | Calibration/check/certificate/reference ID | Source locator/version/date | Quantity/value/unit/range | Validity interval | Stated uncertainty/unit | Chain parent       | Environmental applicability | Owner     | Qualified reviewer | Assumptions    | Uncertainty/gap | Privacy/license | Status    | Decision explicitly not made | Stop reason |
| ----------- | ------------------------------------- | -------- | ------------------------------------------ | --------------------------- | ------------------------- | ----------------- | ----------------------- | ------------------ | --------------------------- | --------- | ------------------ | -------------- | --------------- | --------------- | --------- | ---------------------------- | ----------- |
| `LAB-T-001` | `[identity]`                          | `[date]` | `[ID/type]`                                | `[exact source]`            | `[value unit range]`      | `[dates]`         | `[value unit]`          | `[preceding link]` | `[conditions]`              | `[owner]` | `[reviewer]`       | `[assumption]` | `[gap]`         | `[constraints]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Uncertainty-budget rows

| Component ID | Authorized model/version | Input estimate/unit | Type A or B | Source/version/date | Distribution/divisor as supplied | Standard uncertainty | Sensitivity coefficient | Covariance/correlation source | Contribution   | Combined standard uncertainty | Coverage factor/rationale supplied | Expanded uncertainty `U=k·u_c` | Owner/reviewer | Applicability | Decision/status | Decision explicitly not made | Stop reason |
| ------------ | ------------------------ | ------------------- | ----------- | ------------------- | -------------------------------- | -------------------- | ----------------------: | ----------------------------: | -------------- | ----------------------------: | ---------------------------------: | ------------------------------ | -------------: | ------------- | --------------- | ---------------------------- | ----------- |
| `LAB-U-001`  | `[model]`                | `[value unit]`      | `[A/B]`     | `[locator]`         | `[authorized specification]`     | `[value unit]`       |         `[coefficient]` |                    `[source]` | `[value unit]` |                `[value unit]` |                `[k and rationale]` | `[value unit]`                 |      `[roles]` | `[scope]`     | `[state]`       | `[reserved decision]`        | `[reason]`  |

Metrological traceability belongs to a measurement result and needs a documented chain whose links contribute uncertainty. An equipment label alone is insufficient. Do not choose a model, distribution, correlation, divisor or `k`, declare traceability, adjust equipment, or update operational status.
