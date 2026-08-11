# Outcome, attribution, incrementality, and experiment matrix

## Reusable evidence contract markers

- artifact_id: stable artifact or row identity
- source_id_locator: exact authoritative source locator
- source_version_date: immutable source version and applicable date
- qualified_reviewer: named discipline reviewer with decision authority
- units_and_denominator: value, unit, currency, population and denominator or not-applicable rationale
- assumptions_uncertainty: authorized assumptions, unknowns, confidence and reason
- decision_not_made: explicit professional decisions this artifact does not make
- outcome_unknown: unresolved outcome stated without inference
- stop_escalation: exact hold point, reason, escalation owner and required review

## Mandatory provenance envelope

Every record includes artifact_id or row_id; exact source locator, producer, version and date; extraction method; cutoff/effective period and time zone; owner and named qualified reviewer; campaign, property, geography and jurisdiction applicability; value, currency, unit and denominator; transformation logic; operator-approved assumptions; uncertainty/confidence with reason; privacy, consent, confidentiality and license state; decision status; decision_not_made; outcome_unknown; and explicit stop/escalation. Unknown is never converted to zero or a default.

- artifact_id: AMBS-EXP-001
- owner: outcome attribution and experiment analyst
- qualified_reviewer: experiment owner, measurement scientist, privacy/legal reviewer, and claim owner
- decision_not_made: no causal certification, experiment launch/stop, campaign optimization, spend decision, or claim approval
- outcome_unknown: causal effect and business relevance remain unknown pending qualified review

Record protocol_id, hypothesis or estimand, objective, unit of analysis, eligibility, assignment method, treatment/control, exposure, outcome event and metric contract, analysis populations, pre-period, observation and attribution windows, exclusions, missing-data plan, model, multiplicity and repeated-look rules, and operator decision rules. Pin protocol, dataset, code/query, result and source-lineage versions. Separate attribution models, observational association and experimental incrementality.

For every result preserve population flow, assignment counts, sample-ratio checks, balance evidence, numerator/denominator, effect scale, uncertainty interval, missingness, attrition, interference, contamination, seasonality, concurrent activity, identity loss, post-treatment filtering, deviations, sensitivity evidence and counterevidence. Keep intention-to-treat and other prespecified populations separate. Do not create a causal conclusion when assumptions fail.

Stop when protocol or assignment is missing, datasets move, privacy or unblinding authority is absent, outcome lineage is incomplete, or the method would require an invented threshold/window/model. Reviewers determine validity, interpretation and claim use.
