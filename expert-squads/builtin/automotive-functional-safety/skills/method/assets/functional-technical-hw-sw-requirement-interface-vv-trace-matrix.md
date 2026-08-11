# Functional, Technical, HW/SW Requirement, Interface and V&V Trace Matrix

## Governance header

- Trace ID / item / variant / configuration baseline: `____`
- Requirement repository and architecture source/version/date: `____`
- Verification/validation plan source/version/date: `____`
- Evidence cutoff and extraction date: `____`
- Owner / reviewer / independent assessor: `____ / ____ / ____`
- Applicability: `functional | technical | system | hardware | software | interface`
- Units/tolerance basis: `____`; uncertainty/status: `____ / ____`
- Decision not made: `requirement authorship/approval, allocation, architecture, decomposition, verification sufficiency`
- Stop condition: `missing stable ID/baseline/allocation/criterion/configuration/authority`

| Trace row ID | Hazard/safety-goal/upstream requirement ID | Requirement ID/type and text pointer | ASIL as supplied | condition/value/tolerance/unit | allocated element/interface | downstream requirement/design ID | verification method/case/configuration | expected criterion / actual result | anomaly ID | Source/version/date | Owner/reviewer | Applicability | Uncertainty | Status | Evidence pointer | Decision not made | Stop condition |
| ------------ | ------------------------------------------ | ------------------------------------ | ---------------- | ------------------------------ | --------------------------- | -------------------------------- | -------------------------------------- | ---------------------------------- | ---------- | ------------------- | -------------- | ------------- | ----------- | ------ | ---------------- | ----------------- | -------------- |
| REQ-001      | `____`                                     | `____`                               | `____`           | `____`                         | `____`                      | `____`                           | `____`                                 | `____ / ____`                      | `____`     | `____`              | `____ / ____`  | `____`        | `____`      | `open` | `____`           | `____`            | `____`         |

## Coverage summary

| Coverage ID | population definition | traced count | total count | formula                   | exclusions and source | baseline | reviewer | status |
| ----------- | --------------------- | ------------ | ----------- | ------------------------- | --------------------- | -------- | -------- | ------ |
| COV-001     | `____`                | `____`       | `____`      | traced / total = `____ %` | `____`                | `____`   | `____`   | `open` |

Coverage is meaningful only with a declared population and compatible baseline. Do not create missing requirements, infer satisfaction from matching names, or treat a passed test as proof of complete architecture or safety validation. Concepts, allocations and sufficiency require functional-safety manager, architecture, HW/SW, integration/test, supplier and independent-assessment decisions.
