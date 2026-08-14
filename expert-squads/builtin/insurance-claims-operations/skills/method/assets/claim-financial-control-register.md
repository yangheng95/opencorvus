# Claim Financial and Control Register

> Reconcile recorded data only. Do not set reserves, approve settlements or payments, certify controls, or initiate investigations.

## Register control

| Register version | Claim ID | Process / transaction domain | Period and cutoff | Currency / valuation date | Transaction-code definition source/version | Approval-matrix source/version | Responsible owner | Uncertainty |
| ---------------- | -------- | ---------------------------- | ----------------- | ------------------------- | ------------------------------------------ | ------------------------------ | ----------------- | ----------- |
|                  |          |                              |                   |                           |                                            |                                |                   |             |

## Reserve and payment roll-forward

| Reconciliation ID | Balance type | Opening amount | Increases | Decreases | Payments / recoveries per supplied sign rule | Computed closing | Reported closing | Variance | Currency / period | Transaction IDs | Source/version | Definition uncertainty | Finance / adjuster review owner |
| ----------------- | ------------ | -------------- | --------- | --------- | -------------------------------------------- | ---------------- | ---------------- | -------- | ----------------- | --------------- | -------------- | ---------------------- | ------------------------------- |
|                   |              |                |           |           |                                              |                  |                  |          |                   |                 |                |                        |                                 |

Use only the operator-supplied roll-forward formula and sign convention. Record `variance = reported closing - computed closing`; leave the computation blocked when transaction semantics are absent.

## Handoff and control evidence

| Control / handoff ID | Stage or transaction | Received time / completed time / time zone | Queue duration and unit | Preparer | Reviewer | Approver | Required evidence | Observed evidence source/version | Exception / privacy class | Uncertainty | Responsible control owner |
| -------------------- | -------------------- | ------------------------------------------ | ----------------------- | -------- | -------- | -------- | ----------------- | -------------------------------- | ------------------------- | ----------- | ------------------------- |
|                      |                      |                                            |                         |          |          |          |                   |                                  |                           |             |                           |

## Recorded indicator and escalation queue

| Indicator ID | Operator-supplied indicator definition/version | Source observation IDs | Applicable domain | Observation date | No-person-label statement | Privacy / privilege boundary | Uncertainty | Authorized specialist owner | Approval before next action | Status |
| ------------ | ---------------------------------------------- | ---------------------- | ----------------- | ---------------- | ------------------------- | ---------------------------- | ----------- | --------------------------- | --------------------------- | ------ |
|              |                                                |                        |                   |                  |                           |                              |             |                             |                             |        |
