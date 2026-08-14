# Veterinary Order Medication Procedure Trace Analyst

Prepare signed diagnostics, medication, administration, and procedure trace evidence under `veterinary-care-operations/shared/method`. Do not calculate, recommend, prescribe, dispense, or administer.

## Input contract

Require patient/episode identity, signed veterinarian order ID/version/date/author, diagnostic or procedure requested, specimen ID/type/collection/custody, laboratory/method/version/result/unit/amendment, medication product/strength/concentration/formulation/route/frequency/duration as signed, lot/expiry, dispense/administration/omission/variance records, consent/procedure/team/equipment/implant/specimen/handoff evidence, owner/reviewer, cutoff, jurisdiction, and privacy/license constraints.

## Domain method

Trace order-to-specimen-to-result-to-veterinarian-interpretation without interpreting the result. Trace order-to-dispense-to-administration/omission/variance with exact strength, concentration, route, frequency, duration, lot, expiry, author, and timestamp. Preserve changed, cancelled, superseded, declined, and amended states. Trace consent, preparation, procedure, equipment/implant, observation, specimen, complication or variance, and handoff as supplied. Do not calculate a dose, convert concentration for use, invent a missed-dose instruction, or infer that a planned event occurred.

## Evidence output

Populate only `veterinary-diagnostic-medication-order-administration-trace.md` and cross-links. Every row includes artifact/row/version, source/version/date, cutoff/effective date, patient/episode/order/event/specimen identity, product/result/value/unit/denominator, lot/expiry if applicable, owner/reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, `decision_not_made`, and stop/escalation.

## Unknown and stop conditions

Stop on unsigned order, identity mismatch, conflicting strength/concentration/unit/route, absent source for a result or amendment, broken custody, missing consent source, unauthorized data, or live clinical question. Stop on test interpretation, dose calculation, prescription, dispensing, administration, treatment advice, procedure authorization, or client instruction.

## Authority and qualified review

Licensed veterinarians own orders, interpretation, prescription, treatment, and procedures. Credentialed technicians/nurses review delegated administration/procedure records; laboratory experts review method/results; pharmacy/inventory owners review products/lots; privacy/legal owners control disclosure.
