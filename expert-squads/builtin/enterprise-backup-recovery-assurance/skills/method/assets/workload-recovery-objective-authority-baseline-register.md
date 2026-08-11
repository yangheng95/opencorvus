# Workload Recovery Objective and Authority Baseline

## Purpose and applicability

Freeze workloads, data, dependencies, protection scope and human-owned recovery objectives. Use this asset only inside the package's declared professional scope and frozen evidence cutoff. It prepares evidence for qualified human review; it is not an operational record, approval, filing, instruction, certification or professional conclusion.

## Evidence control contract

Every material row records: stable artifact and row identity; source locator, controlled source version and source date; observation cutoff and effective date; measured or attributed value; unit, sign convention, numerator and denominator where applicable; accountable owner; qualified reviewer and reviewer capacity; organization, system, jurisdiction, population and period applicability; declared assumptions; uncertainty and confidence as attributed; privacy, confidentiality and licence boundary; status; `decision_not_made`; `outcome_unknown` whenever an external effect is ambiguous; and a stop or escalation reason. Preserve original and normalized values separately and identify every transformation or matching rule and version.

Unknown values remain explicitly unknown. Do not use zero, empty text or a convenient prior value as a substitute. Preserve conflicting sources and counterevidence. A complete row may still be unsuitable for decision if authority, population identity, effective date, unit, denominator, configuration or qualified reviewer is absent.

## Domain fields

Record workload_id, business_service_id, data_set_id, dependency_id/type/order, application/database/configuration/key_or_certificate references, protection_method, scope_inclusion, source_population, service_tier_as_supplied, RTO_value/unit/source, RPO_value/unit/source, classification and authorized_restore_environment.

## Reconciliation method

Keep backup, replication, archive, export and reconstruction distinct. Recovery Time Objective and Recovery Point Objective are attributed inputs, never selected by this asset. Record uncovered dependencies.

Reconcile population totals before interpreting exceptions. State included, excluded, duplicate, missing, unmatched and unknown counts with a declared denominator. Keep source observation, normalized value, derived measure, analyst hypothesis and attributed human decision separate. Link every finding back to exact evidence IDs and forward to the named reviewer.

## Stop and authority boundary

Stop on missing authority, ambiguous evidence identity, incompatible source versions or dates, unauthorized sensitive data, credentials, live-only access, unsupported conclusions or ambiguous external outcomes. Do not perform external actions, mutate systems of record, bypass controls, contact affected parties or claim independent assurance. Name the evidence needed, its owner and the qualified human who must decide.
