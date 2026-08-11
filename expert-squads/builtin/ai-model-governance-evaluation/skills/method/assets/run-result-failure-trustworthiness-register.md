# Run, Result, Failure and Trustworthiness Register

## Governance header

- Run register ID / protocol ID / configuration hash: `____ / ____ / ____`
- Evidence cutoff and timezone / run date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit of analysis: `one completed evaluation run and its preserved case-level denominator`
- Applicability: `validity | robustness | fairness | privacy | security | safety | explainability | oversight`
- Uncertainty: `____`; status: `draft | open | challenged | qualified review required | reviewed`
- Decision not made by this asset: `production promotion, risk acceptance, compliance, safety certification or individual decision`
- Stop condition: `configuration mismatch, missing raw results, failed cases removed, unknown denominator, unknown metric direction or unreproducible run`

## Run and aggregate results

| Run ID  | Protocol ID | Model/prompt/tool/dataset versions | Execution environment and seed | Slice  | Metric value / unit / direction | Numerator / denominator | Baseline / threshold | Interval or dispersion | Failed/error/abstain count | Source URI | Source version/date | Owner  | Reviewer | Applicability | Uncertainty | Status | Decision not made | Stop condition |
| ------- | ----------- | ---------------------------------- | ------------------------------ | ------ | ------------------------------- | ----------------------- | -------------------- | ---------------------- | -------------------------- | ---------- | ------------------- | ------ | -------- | ------------- | ----------- | ------ | ----------------- | -------------- |
| RUN-001 | `____`      | `____`                             | `____`                         | `____` | `____`                          | `____`                  | `____`               | `____`                 | `____`                     | `____`     | `____`              | `____` | `____`   | `____`        | `____`      | `open` | `____`            | `____`         |

## Case evidence and trustworthiness challenge

| Case / challenge ID | Run ID | Input/reference pointer | Output/trajectory pointer | Score and rationale | Error category | Perturbation or subgroup | Privacy/security/safety/fairness concern | Human-oversight observation | Reviewer disposition | Status |
| ------------------- | ------ | ----------------------- | ------------------------- | ------------------- | -------------- | ------------------------ | ---------------------------------------- | --------------------------- | -------------------- | ------ |
| CASE-001            | `____` | `____`                  | `____`                    | `____`              | `____`         | `____`                   | `____`                                   | `____`                      | `____`               | `open` |

Retain case-level evidence alongside aggregates and make exclusions, scorer failures, retries and abstentions visible. Compare like-for-like configurations; do not merge changed prompts, tools, datasets, sampling frames or metric definitions into one trend. Report subgroup denominators and uncertainty, calibration where relevant, repeated-run variation and robustness within a declared perturbation envelope. Treat a threshold pass as evidence for the bounded claim only, never as general trustworthiness. Independent reviewers should challenge leakage, selective reporting, judge bias, privacy leakage, adversarial behavior, unsafe failure modes and weak human intervention. This register cannot execute tests, infer missing results, suppress failures, approve deployment or certify safety/fairness/compliance.
