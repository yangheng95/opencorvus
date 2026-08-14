# Transaction-monitoring alert and case evidence register

## Control contract

- Template ID: `AML-TM-TEMPLATE-001`
- Source/version/date/cutoff: current controlled regulation, policy, system, dataset, model and case locator.
- Quantity/unit/denominator: transaction count and amount/currency/basis, alert/case/test populations and rates with denominator.
- Owner/reviewer: named business/data owner and AMLCO/MLRO/BSA, model-risk, independent-test, privacy or counsel reviewer.
- Applicability: entity/institution, jurisdiction, as-of date, product/service/channel/geography and relationship/population period.
- Assumptions/uncertainty: data lineage, coverage, outcome-label maturity, false positive/negative, sampling and interpretation.
- Confidentiality/privacy/license: sensitive report and customer-data access class.
- Status and decision not made: no suspicion, report, filing, blocking, freezing, account exit, sanctions or law decision.
- Stop: unclear applicability, stale source, population mismatch, missing version, confidentiality risk or absent authority.

## Evidence rows

| population/source/control totals | transaction ID/amount/currency/basis | scenario/model/threshold version | eligible population | alert ID        | case ID       | indicator/context/inference | human disposition | source/version/date | quantity/unit/denominator | owner                    | qualified reviewer    | applicability | assumptions | uncertainty | confidentiality/license | status | decision-not-made | stop/escalation |
| -------------------------------- | ------------------------------------ | -------------------------------- | ------------------- | --------------- | ------------- | --------------------------- | ----------------- | ------------------- | ------------------------- | ------------------------ | --------------------- | ------------- | ----------- | ----------- | ----------------------- | ------ | ----------------- | --------------- |
| AML-TM-001                       | _controlled source required_         | _exact basis_                    | _named owner_       | _AML authority_ | _exact scope_ | _no inferred value_         | _state limits_    | _restricted_        | unresolved                | no professional decision | stop pending evidence |

## Completion and review

Use one row per requirement, control, relationship, transaction population, scenario/model version, alert, case, test or governance decision. Reconcile inputs, eligible populations, alerts, cases and dispositions. Keep indicators, observations, context, inference and human suspicion decisions distinct.

Cross-check the other assets for missing data lineage, stale CDD, unreviewed beneficial-owner evidence, orphan alerts, unexplained suppressions/overrides, backlog, unsupported labels and unverified remediation. Preserve contradictions and confidentiality boundaries.

The owner attests only to provenance and completeness. Qualified AML and legal authorities decide reportability, filing, sanctions, blocking, customer action and law. Never contact a party or change a production system.
