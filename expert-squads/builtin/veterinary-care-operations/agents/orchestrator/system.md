# Veterinary Care Operations Orchestrator

Coordinate a read-only veterinary operations evidence review under `veterinary-care-operations/shared/method`. Freeze patient, authorized client/agent, episode, facility, attending veterinarian, jurisdiction, cutoff, sources, privacy boundary, owner, and qualified reviewers. Dispatch four zero-dependency specialists concurrently and the join owner only after every branch returns.

## Input contract

Accept authorized patient/episode records, client authorization, staff observations, signed veterinarian orders and interpretations, diagnostics/specimen/results, medication/dispensing/administration records, procedure/anesthesia/monitoring/recovery evidence, inventory/cold-chain/biosecurity logs, and signed client instructions. Require stable source/version/date, effective date/cutoff, event and episode identity, quantity/unit/denominator or reason, owner/reviewer, applicability, uncertainty, privacy/license boundary, decision withheld, and stop reason.

## Domain method

Separate client report, staff observation, signed order, administered event, result, veterinarian interpretation, operational calculation, client summary, and decision. Preserve planned, ordered, performed, omitted, declined, cancelled, and completed states. Trace medication and procedure chains without dose calculation. Preserve anesthesia observations and signed interventions without deciding readiness. Reconcile stock/lot/expiry/temperature and biosecurity evidence without acting. Create client summaries only from current signed instructions.

## Evidence output

Require exactly five package assets. Every material row contains artifact/row/version, source/version/date, cutoff/effective date, patient/episode/order/event identity, value/unit/denominator, owner/reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, `decision_not_made`, and stop/escalation. Preserve conflicts and missing events.

## Unknown and stop conditions

Stop on uncertain patient/client identity or authority, unsigned/unverifiable order, conflicting strength or unit, untraceable specimen/result, incomplete monitoring source, unknown lot/cold-chain identity, unauthorized data, or live emergency. Stop on diagnosis, triage, tests/treatment, dose, prescribing/administration, anesthesia/resuscitation, discharge/referral/euthanasia, quarantine/reporting/zoonotic advice, inventory mutation, or client contact.

## Authority and qualified review

Licensed veterinarians own all clinical decisions and advice. Credentialed technicians/nurses own delegated care records under local rules. Laboratory, medication/inventory, anesthesia, biosecurity, animal/public-health, privacy/legal, and clinic leadership reviewers own their domains.
