# Network, cloud and identity timeline correlation matrix

## Control contract

- Template ID: `DFI-CORR-TEMPLATE-001`
- Source/version/date: immutable locator, source/image/log or document version, acquisition/effective date and evidence cutoff.
- Quantity/unit/basis: record count, bytes, time precision, offset, duration or other values with unit and denominator.
- Owner and qualified reviewer: named evidence owner plus authorized DFIR examiner and counsel/privacy reviewer as applicable.
- Applicability: matter, jurisdiction, incident, system/tenant/account/device, evidence scope and time window.
- Assumptions and uncertainty: clock, retention, acquisition, parser, correlation, completeness and interpretation limits.
- Privacy/license/privilege boundary: classification and access controls; privilege only as supplied by counsel.
- Status: draft, evidence-present, contradicted, unresolved or qualified-review-complete.
- Decision not made: no live collection, compromise/malware determination, attribution, admissibility, notification, containment or remediation.
- Stop/escalation: missing authority, custody, identity, time basis, tool validation, access permission or qualified reviewer.

## Evidence rows

| event ID     | original/normalized time and offset | network/log/cloud/identity source | principal/device/IP/session/service | evidence IDs  | correlation rule/version | support/contradiction | clock/retention gap | hypothesis ID | source/version/date      | owner                 | qualified reviewer | applicability | assumptions | uncertainty/confidence | privacy/license boundary | status | decision-not-made | stop/escalation |
| ------------ | ----------------------------------- | --------------------------------- | ----------------------------------- | ------------- | ------------------------ | --------------------- | ------------------- | ------------- | ------------------------ | --------------------- | ------------------ | ------------- | ----------- | ---------------------- | ------------------------ | ------ | ----------------- | --------------- |
| DFI-CORR-001 | _authorized evidence required_      | _named owner_                     | _named DFIR/counsel reviewer_       | _exact scope_ | _no inference_           | _state limits_        | _classification_    | unresolved    | no professional decision | stop pending evidence |

## Completion and review

Use one row per independently reviewable authority item, evidence object, observation, event or hypothesis. Preserve original and derived values separately. Link all analytic statements to stable evidence IDs, acquisition/custody records and tool versions. Do not paste restricted content when an approved locator is sufficient.

Cross-check the five assets for orphan evidence, missing hashes or immutable IDs, unsupported parser results, time-zone mismatches, gaps in network/cloud retention, contradictions and hypotheses without alternatives. Record impact, authorized next evidence, owner and stop. Table completeness never authorizes live access or proves an incident conclusion.

The owner may attest only to provenance and record completeness. Qualified examiners and counsel decide collection, interpretation, disclosure and response. Never reveal credentials, execute artifacts, connect to systems, alter evidence or contact an outside party.
