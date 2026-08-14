# Uncertainty, Scenario, Discount and Reinsurance Register

## Governance header

- Register ID / entity / portfolio / valuation date: `____`
- Evidence cutoff and timezone / extraction date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit and basis: `currency/ratio/percentile; gross/ceded/net; nominal/discounted; paid/incurred`
- Applicability: `data | parameter | process | model | operational uncertainty; sensitivity | scenario | Mack/bootstrap evidence`
- Uncertainty: `____`; status: `draft | open | challenged | qualified review required | reviewed`
- Decision not made by this asset: `range/percentile selection, diversification, risk acceptance, reserve estimate, booking, solvency or opinion`
- Stop condition: `unknown probability meaning, missing assumptions/input/version, invalid aggregation, failed run suppression or reinsurance/discount mismatch`

## Scenario and uncertainty evidence

| Scenario/test ID | Uncertainty type                           | Base configuration/value/unit/basis | Changed assumption and supplied rationale | Alternate result/value/unit/basis | Difference | Probability meaning or expressly none | Reinsurance/discount treatment | Source URI or controlled record | Version | Source/effective date | Owner  | Reviewer | Applicability | Uncertainty | Status | Evidence pointer | Decision not made | Stop condition |
| ---------------- | ------------------------------------------ | ----------------------------------- | ----------------------------------------- | --------------------------------- | ---------- | ------------------------------------- | ------------------------------ | ------------------------------- | ------- | --------------------- | ------ | -------- | ------------- | ----------- | ------ | ---------------- | ----------------- | -------------- |
| UNC-001          | `data/parameter/process/model/operational` | `____`                              | `____`                                    | `____`                            | `____`     | `____`                                | `____`                         | `____`                          | `____`  | `____`                | `____` | `____`   | `____`        | `____`      | `open` | `____`           | `____`            | `____`         |

## Probabilistic-method controls when supplied

| Control ID | Method/implementation version | Assumptions checked | Residual/input definition | Zero/negative/tail treatment | Simulations/seed/reproducibility | Dependence/sparsity/structural-change limitation | Aggregation/correlation basis | Reviewer | Status |
| ---------- | ----------------------------- | ------------------- | ------------------------- | ---------------------------- | -------------------------------- | ------------------------------------------------ | ----------------------------- | -------- | ------ |
| PROB-001   | `____`                        | `____`              | `____`                    | `____`                       | `____`                           | `____`                                           | `____`                        | `____`   | `open` |

Keep sensitivity, deterministic scenario, selected range, percentile and confidence interval distinct. Mack or bootstrap outputs require documented inputs, assumptions, implementation and reproducibility and remain bounded by dependence, sparse data, tail and structural-change limitations. Reconcile gross, ceded and net and describe collectability or contract uncertainty without deciding recoverability. Discounted results require rate/source, cash-flow timing and unwind basis. This register cannot turn a sensitivity into probability, infer diversification, select a range, accept risk or determine reserve adequacy.
