# Evaluation Protocol, Dataset, Slice and Metric Register

## Governance header

- Protocol ID / claim / decision supported: `____ / ____ / ____`
- Evidence cutoff and timezone / protocol date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit of analysis: `case, task trajectory, response, person, event or other explicitly defined denominator`
- Applicability: `offline validation | pre-release comparison | post-release monitoring | incident reproduction`
- Uncertainty: `____`; status: `draft | open | qualified review required | approved by named authority`
- Decision not made by this asset: `deployment, production promotion, risk acceptance, certification or universal model quality`
- Stop condition: `missing claim, population, dataset lineage, split independence, metric direction, threshold owner or failure treatment`

## Claim-to-measurement protocol

| Protocol ID | Claim / behavior | Model-prompt-tool configuration | Dataset ID/version/split | Population and slice | Sampling frame | Metric/formula/direction/unit | Baseline | Threshold and owner | Repetitions/seed | Uncertainty method | Source URI | Source version/date | Owner  | Reviewer | Status | Decision not made | Stop condition |
| ----------- | ---------------- | ------------------------------- | ------------------------ | -------------------- | -------------- | ----------------------------- | -------- | ------------------- | ---------------- | ------------------ | ---------- | ------------------- | ------ | -------- | ------ | ----------------- | -------------- |
| EVAL-001    | `____`           | `____`                          | `____`                   | `____`               | `____`         | `____`                        | `____`   | `____`              | `____`           | `____`             | `____`     | `____`              | `____` | `____`   | `open` | `____`            | `____`         |

## Scorer and validity controls

| Control ID | Scoring type                    | Reference/ground-truth provenance | Expected pass case | Expected fail case | Human rubric and adjudication or judge version/prompt/parser | Leakage/contamination check | Failure/abstention policy | Applicability | Uncertainty | Status |
| ---------- | ------------------------------- | --------------------------------- | ------------------ | ------------------ | ------------------------------------------------------------ | --------------------------- | ------------------------- | ------------- | ----------- | ------ |
| SC-001     | `deterministic/human/LLM/other` | `____`                            | `____`             | `____`             | `____`                                                       | `____`                      | `____`                    | `____`        | `____`      | `open` |

Map each decision claim to observable behavior before selecting a metric. Validate metric direction, parsing and mapping with one representative expected pass and one expected failure before scale. Preserve dataset construction, consent/licensing constraints, deduplication, contamination checks, split independence, slice denominators, missingness and deployment-match limits. Human scoring needs anchored rubrics, blinding where practicable, sampling, agreement and adjudication; Large Language Model judges need model/prompt/version/order/parser and bias/injection checks. This worksheet designs evidence; it does not run jobs, create ground truth, choose an acceptable threshold, approve use of a dataset or authorize deployment.
