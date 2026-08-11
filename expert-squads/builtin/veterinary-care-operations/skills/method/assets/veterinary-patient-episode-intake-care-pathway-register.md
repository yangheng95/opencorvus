# Veterinary patient episode intake care pathway register

## Controlled metadata

- artifact_id: VCO-PATIENT-PATHWAY
- artifact_version: 2026.08.11.1
- source_locator_version_date: required for identity, authorization, observation, veterinarian entry, pathway, handoff, and disposition
- cutoff_effective_date: required; preserve original timestamp and time zone
- quantity_unit_denominator: retain weight and every observation in source unit; state denominator or not-applicable reason
- owner: veterinary records and episode owner
- qualified_reviewer: attending licensed veterinarian and credentialed technician/nurse as applicable
- applicability_jurisdiction: facility, care setting, species, animal, client authority, episode, and jurisdiction
- assumptions_uncertainty: identity, authority, transcription, timing, missing-event, and source limitations
- privacy_license_boundary: authorized patient/client data only; record reuse license and access class
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no diagnosis, triage, testing, treatment, discharge, referral, euthanasia, isolation, quarantine, or reporting decision
- stop_escalation: identity/authority conflict, unsigned veterinarian source, unknown unit/time, unauthorized data, or live emergency

## Patient and authority

| row_id      | patient_id | species  | breed/sex/reproductive_state | age_basis     | weight/date/unit/source | client_or_agent_id | authority_source/version | facility/episode | owner/reviewer | uncertainty | status |
| ----------- | ---------- | -------- | ---------------------------- | ------------- | ----------------------- | ------------------ | ------------------------ | ---------------- | -------------- | ----------- | ------ |
| VCO-PAT-001 | required   | required | supplied only                | supplied only | required when material  | required           | required                 | required         | required       | required    | draft  |

## Intake and pathway

| row_id       | event_time/time_zone | source_type                                        | author/source/version | observation_or_supplied_assessment | pathway_state                                                  | handoff/ack | disposition_source       | decision_not_made      | stop_escalation          |
| ------------ | -------------------- | -------------------------------------------------- | --------------------- | ---------------------------------- | -------------------------------------------------------------- | ----------- | ------------------------ | ---------------------- | ------------------------ |
| VCO-PATH-001 | required             | client report/staff observation/veterinarian entry | required              | exact supplied content             | planned/ordered/performed/omitted/declined/cancelled/completed | supplied    | veterinarian source only | all clinical decisions | escalate conflict or gap |

Never turn a report or observation into a diagnosis, priority, or disposition. Absence of a record is not proof that an event did not occur. Preserve amended and superseded states and cross-link exact sources.
