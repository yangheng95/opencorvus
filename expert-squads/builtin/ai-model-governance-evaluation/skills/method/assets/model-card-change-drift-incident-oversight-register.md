# Model Card, Change, Drift, Incident and Oversight Register

## Governance header

- Documentation ID / system-use-case ID / release or review gate: `____`
- Evidence cutoff and timezone / review date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit of analysis: `one controlled model-system release and one declared monitoring period`
- Applicability: `model card | change assessment | production monitoring | incident | retirement`
- Uncertainty: `____`; status: `draft | open | qualified review required | reviewed`
- Decision not made by this asset: `release approval, risk acceptance, incident closure, legal notification, compliance or decommission authorization`
- Stop condition: `unknown release configuration, undocumented material change, missing baseline/threshold/owner, unresolved incident or absent authority`

## Documentation and lifecycle evidence

| Record ID | Type                                        | Release/configuration | Intended use and limitation | Change or event | Impacted claim/control/evaluation | Monitoring signal/value/unit/window | Baseline/threshold/owner | Action/escalation trigger | Source URI | Version | Source/effective date | Owner  | Reviewer | Applicability | Uncertainty | Status | Decision not made | Stop condition |
| --------- | ------------------------------------------- | --------------------- | --------------------------- | --------------- | --------------------------------- | ----------------------------------- | ------------------------ | ------------------------- | ---------- | ------- | --------------------- | ------ | -------- | ------------- | ----------- | ------ | ----------------- | -------------- |
| LIFE-001  | `model-card/change/monitor/incident/retire` | `____`                | `____`                      | `____`          | `____`                            | `____`                              | `____`                   | `____`                    | `____`     | `____`  | `____`                | `____` | `____`   | `____`        | `____`      | `open` | `____`            | `____`         |

## Accountable decision log

| Decision ID | Question | Options considered | Evidence IDs | Unresolved risk/uncertainty | Accountable authority | Reviewers | Decision and conditions | Effective/expiry date | Re-evaluation trigger | Status |
| ----------- | -------- | ------------------ | ------------ | --------------------------- | --------------------- | --------- | ----------------------- | --------------------- | --------------------- | ------ |
| DEC-001     | `____`   | `____`             | `____`       | `____`                      | `____`                | `____`    | `____`                  | `____`                | `____`                | `open` |

Maintain model and system documentation at the configuration level: model, weights/provider, prompts, policies, tools, retrieval sources, guardrails, dependencies and runtime constraints. Classify changes by the claims, populations, controls and evaluations they can invalidate; version-only comparisons are insufficient. Define monitoring signal, denominator, window, baseline, threshold, owner, latency and action before interpreting drift. Preserve incident time, detection, affected scope, containment evidence, causal uncertainty, corrective action and re-evaluation trigger. This template supplies traceability only: it cannot approve a release, close an incident, determine notification obligations, accept risk, make consequential decisions or retire a service without qualified accountable review.
