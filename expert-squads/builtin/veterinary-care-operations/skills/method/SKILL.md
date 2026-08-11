---
name: veterinary-care-operations-method
description: Prepare source-bound veterinary patient, order, medication, procedure, anesthesia, recovery, inventory, cold-chain, biosecurity, and client-follow-up evidence when veterinary teams need operational review without diagnosis, treatment, or live-care authority.
---

# Veterinary Care Operations Method

## Freeze episode and authority

Record scope ID, facility, veterinary patient ID, client or authorized-agent ID, episode ID, species, breed if supplied, sex/reproductive status, age/date basis, weight/date/unit, attending veterinarian, jurisdiction, care setting, cutoff, authorized sources, privacy class, and qualified reviewers. Separate client report, staff observation, signed veterinarian order, administered care record, diagnostic result, veterinarian interpretation, operational calculation, client-facing summary, and decision.

State `decision_not_made`: no diagnosis or differential; live triage or emergency disposition; test, treatment, prescription, dose, administration, anesthesia, fluid, resuscitation, procedure, discharge, referral, euthanasia, isolation, quarantine, reportable-disease, zoonotic-risk, withdrawal-period, inventory-release, or client-contact decision. Do not operate a practice system, laboratory system, pharmacy cabinet, monitoring device, cold-chain device, or communications channel.

## Reconcile intake and care pathway

Create immutable IDs for animal, client authorization, episode, encounter, observation, problem or diagnosis supplied by the attending veterinarian, care-pathway step, handoff, and disposition. Preserve source, author, signature, version, and time-zone semantics. Never convert a symptom or staff note into a diagnosis or priority. Record species, weight, physiological observations, allergies/adverse events, reproductive state, food-animal status, exposure, and current medication only as supplied.

Keep planned, ordered, scheduled, performed, omitted, declined, cancelled, changed, and completed states distinct. A missing record is not evidence that care did not occur. Conflicts return to the attending veterinarian or record owner.

## Trace diagnostics, medications, and procedures

For diagnostics retain signed order, specimen ID/type, collection source/time, custody, laboratory and method/version, result/unit/reference supplied by the laboratory, amendment state, and veterinarian interpretation. Never interpret a result or recommend another test.

For medications retain signed order ID/version, product, active ingredient if supplied, strength or concentration with unit, formulation, route, frequency, duration, indication supplied by the veterinarian, lot, expiry, dispensing, administration event, omission/variance, inventory transaction evidence, and client instruction version. Do not calculate a dose, convert concentration for administration, prescribe, dispense, or tell a client what to do after a missed dose.

For procedures retain consent source/version, team/role, equipment or implant identifiers, preparation, procedure record, specimen, complication or variance observation, and handoff. For anesthesia retain veterinarian-approved plan reference, preassessment, equipment/check evidence, induction and maintenance records, monitoring observation/time/unit/device, intervention only as signed in the record, recovery criterion source, recovery observation, handoff, and disposition. Never infer a plan or decide readiness.

## Reconcile inventory, cold chain, and biosecurity

Link purchase/receipt, lot, expiry, storage location, temperature observation/unit/device/calibration, excursion, quarantine or disposition source, count, dispense/use/waste/return transaction, controlled-substance record, and reconciliation. Never mutate stock, release a lot, discard a product, or decide excursion suitability. Preserve unexplained differences for qualified review.

Record isolation/biosecurity zone supplied by the facility, personal protective equipment procedure version, cleaning/disinfection event and product/source, exposure record, animal movement, diagnostic/reporting evidence, and responsible owner. Do not classify a disease, impose quarantine, report to authorities, or give zoonotic advice. Route those decisions to the attending veterinarian, infection-prevention lead, and competent animal/public-health authority.

## Prepare controlled client follow-up

Build a client-facing summary only from signed, current instructions. Link each statement to order/instruction source, author, version, date, animal/episode, restrictions, medication label text, follow-up appointment, warning or escalation language supplied by the veterinarian, clinic contact channel, delivery method/time, translator or accessibility need, and acknowledgment. Plain-language transformation may simplify wording but must not change dose, timing, restriction, warning, or action. Keep the clinical record and client summary distinct. Never contact the client.

## Join and escalate

Populate exactly the five files under `assets/`. Every material entry includes stable artifact/row identity, source locator/version/date, cutoff/effective date, quantity/unit/denominator or not-applicable reason, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, `decision_not_made`, and stop/escalation. Cross-link all steps to episode, order, patient, and authorization identifiers.

Stop on uncertain animal/client identity, absent client authorization, unverifiable or unsigned order, unknown unit, missing weight date or source where material, conflicting medication strength/concentration, untraceable specimen/result, incomplete anesthesia monitoring source, cold-chain identity gap, unauthorized personal data, live emergency, or request for consequential action. Preserve the gap; do not repair it from memory.

Licensed veterinarians own diagnosis, triage, testing, treatment, prescribing, anesthesia, discharge/referral/euthanasia, and client advice. Credentialed veterinary technicians/nurses own delegated care records under local rules. Pharmacists/inventory owners review medication and stock evidence. Anesthesia specialists, laboratory experts, biosecurity leads, public/animal-health authorities, privacy/legal owners, and clinic leadership review their domains.

Read `references/UPSTREAM.md`, `references/ADAPTATION.md`, `references/LICENSE.md`, and `references/PRIMARY-SOURCES.md`. This is a bounded modification of controlled clinical-record-to-client-summary separation from the pinned PM Skills MIT source. It excludes inferred clinical facts, hard-coded symptoms/timelines/doses, missed-dose advice, direct instructions, diagnosis, and treatment.
