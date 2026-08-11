# Payments Fraud Risk Review Pack

Complete this explicit join only after the transaction/authentication, merchant-monitoring and dispute-evidence roots produce independently traceable artifacts. It is not a production fraud decision, merchant/account action, AML report, dispute submission or funds instruction.

Canonical fields: `record_id`, `object_ids`, `amount_currency_unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Join provenance

- `review_pack_id`, rail/processor/acquirer/network/jurisdiction, cutoff/time zone and privacy/PCI/security boundary.
- Event-provenance artifact path/version/digest.
- Transaction/authentication/signal artifact path/version/digest.
- Merchant cohort artifact path/version/digest.
- Dispute evidence artifact path/version/digest.
- Source/schema/rule/model versions/effective and observation dates.
- Accountable owner and fraud, merchant/acquiring, network, dispute, model-validation, AML/BSA, finance/payment, cybersecurity, privacy/legal and consumer-protection reviewers.
- Applicability, exclusions, uncertainty and status.
- Decision not made: no payment approval/decline/block/reversal, rule/model change, account/merchant restriction, fraud/KYC/KYB/AML/SAR/sanctions decision, dispute adjudication, refund, funds movement, contact or compliance claim.
- Stop/escalation: missing branch/current rule, identity/currency/time conflict, immature labels, unauthorized data or active harm.

## Branch completeness

| Branch                     | Artifact/version/digest | IDs/currency/time reconcile | Denominators/labels/rules current | Unknowns retained | Owner/reviewer | Status |
| -------------------------- | ----------------------- | --------------------------- | --------------------------------- | ----------------- | -------------- | ------ |
| Transaction/authentication | unknown                 | no                          | unknown                           | yes               | unassigned     | draft  |
| Merchant monitoring        | unknown                 | no                          | unknown                           | yes               | unassigned     | draft  |
| Dispute evidence           | unknown                 | no                          | unknown                           | yes               | unassigned     | draft  |

For each joined finding, cite linked `PEP/TAF/MAC/DCE` IDs, sources/versions, raw counts/denominators/amounts/currencies, label maturity, evidence/counterevidence, applicability, uncertainty, owner, reviewer and status. Preserve contradictions. Allow only source request, identity/currency reconciliation, re-baseline, independent model/control review, monitoring or verification of an authorized action. Record human decisions separately; the agent never makes them.
