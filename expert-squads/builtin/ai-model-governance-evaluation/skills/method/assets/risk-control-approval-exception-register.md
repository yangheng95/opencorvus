# Risk, Control, Approval and Exception Register

## Governance header

- Register ID / system-use-case ID / decision context: `____`
- Evidence cutoff and timezone / assessment date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit of analysis: `one risk scenario linked to one control claim and accountable authority`
- Applicability: `validity | safety | fairness | privacy | security | transparency | accountability | resilience`
- Uncertainty: `____`; status: `draft | open | challenged | qualified review required | reviewed`
- Decision not made by this asset: `risk acceptance, deployment authorization, regulatory classification, compliance or exception approval`
- Stop condition: `missing harm scenario, affected group, control owner, evidence, residual uncertainty, expiry or approval authority`

## Risk-to-control trace

| Risk ID  | Hazard or misuse scenario | Cause / event / harm / affected group | Likelihood and impact basis with scale | Existing control and control type | Control owner                    | Verification evidence | Residual uncertainty | Source URI | Version | Source date | Reviewer | Applicability | Status | Decision not made | Stop condition |
| -------- | ------------------------- | ------------------------------------- | -------------------------------------- | --------------------------------- | -------------------------------- | --------------------- | -------------------- | ---------- | ------- | ----------- | -------- | ------------- | ------ | ----------------- | -------------- |
| RISK-001 | `____`                    | `____`                                | `____`                                 | `____`                            | `prevent/detect/respond/recover` | `____`                | `____`               | `____`     | `____`  | `____`      | `____`   | `____`        | `open` | `____`            | `____`         |

## Approval and exception evidence

| Record ID | Type                        | Scope and conditions | Requestor | Accountable approver | Evidence considered | Residual risk or limitation | Start / expiry date | Monitoring trigger | Revocation/escalation path | Status | Evidence pointer |
| --------- | --------------------------- | -------------------- | --------- | -------------------- | ------------------- | --------------------------- | ------------------- | ------------------ | -------------------------- | ------ | ---------------- |
| GOV-001   | `review/approval/exception` | `____`               | `____`    | `____`               | `____`              | `____`                      | `____`              | `____`             | `____`                     | `open` | `____`           |

Describe risk as a falsifiable scenario, not a color or adjective. Preserve the scale, assessor, date, evidence and uncertainty behind likelihood and impact; never compare unlike scales silently. Separate control existence, implementation, operating effectiveness and coverage. An exception requires explicit scope, compensating control, authority, expiry and revocation criteria; an undocumented silence is not approval. This register can expose unsupported control and governance claims but cannot accept risk, waive policy, determine legality, authorize production use or decide outcomes for people. Escalate high-impact, safety-critical, rights-affecting, security-sensitive and materially uncertain cases to the named qualified authorities.
