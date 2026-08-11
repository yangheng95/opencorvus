# Waste Stream and Generation Process Identity Register

Use one immutable row per process version, material/waste stream, point of generation, and effective interval. This register identifies evidence; it does not declare a material a solid or hazardous waste, assign a code, or authorize handling.

## Required row contract

| Field                                         | Required evidence                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| artifact_id / row_id                          | Stable register and immutable process-stream row IDs                                                                                             |
| generator_site_identity                       | Legal entity, physical site, supplied EPA/state/site identifiers, and jurisdiction                                                               |
| process_identity                              | Process ID/name, version, area/equipment, inputs/outputs, operating range, point of generation, owner, effective interval                        |
| stream_identity                               | Stable stream ID, source description, physical state, variability, batch/event/container linkage where supplied                                  |
| source_locator / source_version / source_date | Exact process record, specification, safety document, interview/attestation, observation, permit, or procedure reference                         |
| cutoff_or_effective_date                      | Evidence cutoff and effective-from/effective-to date                                                                                             |
| value_unit_denominator                        | Generation quantity/value only when source-supported, with unit, time/batch denominator, and conversion source                                   |
| owner / qualified_reviewer                    | Process owner and qualified environmental/chemical reviewer                                                                                      |
| applicability_jurisdiction                    | Exact physical site, process version, stream, period, and federal/state/local/operator context                                                   |
| assumptions / uncertainty_confidence          | Variability, unknown inputs, representativeness, identity gaps, confidence basis                                                                 |
| privacy_license                               | Access classification, personal/confidential information handling, reuse/license limits                                                          |
| status / decision_not_made                    | draft, source-confirmed, superseded, stopped; no waste determination/code/category, legal conclusion, handling, shipment, treatment, or disposal |
| outcome_unknown / stop_escalation             | True until identity and qualified evidence reconcile; missing evidence and named escalation                                                      |

## Controlled row template

`artifact_id=WSGP-REGISTER-001`; `row_id=WSGP-ROW-0001`; `generator_site_identity=legal entity/site/jurisdiction pending`; `process_identity=process and version pending`; `stream_identity=stream/process event and physical state pending`; `source_locator=authoritative owner record URI`; `source_version/source_date=pending`; `cutoff_or_effective_date=YYYY-MM-DD`; `value_unit_denominator=not calculated`; `owner=process owner`; `qualified_reviewer=qualified environmental professional/chemist`; `applicability_jurisdiction=declared site/process/period only`; `assumptions=none accepted for absent identity`; `uncertainty_confidence=process variability and lineage unresolved`; `privacy_license=operator-controlled`; `status=stopped`; `decision_not_made=no classification, code, category, handling, shipment, treatment, or disposal`; `outcome_unknown=true`; `stop_escalation=obtain authoritative process and material identity without approaching or manipulating material`.
