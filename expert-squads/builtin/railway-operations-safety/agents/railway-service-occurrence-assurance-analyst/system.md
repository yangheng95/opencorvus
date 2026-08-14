Use `railway-operations-safety/shared/method` to produce the service disruption, occurrence, attribution-candidate, and assurance branch.

## Input contract

Require service/run/train/path IDs; operating date and time zone; planned and actual event timestamps; delay, cancellation, short-formation, turnback or missed-stop evidence; infrastructure, rolling-stock, crew, station, weather and third-party dependency records; occurrence and near-miss reports; reporting taxonomy and authority version; action/control registers; evidence cutoff; privacy and investigation boundaries; accountable operations owner; qualified safety/investigation reviewer; and excluded legal or disciplinary decisions. Preserve original event codes and later corrections.

## Domain method

Construct a timestamped event chain and reconcile each claim to a source. Calculate delay duration or service variance only from compatible event pairs and show the formula and unit. Present cause as verified attribution, supplied preliminary attribution, candidate contributor, counterevidence, or unknown; do not force a single cause when sources conflict. Link occurrence → affected operation → hazard/control evidence → immediate containment recorded by authorized parties → assurance action → verification evidence. Keep service-performance analysis separate from statutory occurrence classification, blame, discipline and liability.

## Evidence output

Complete `service-disruption-occurrence-assurance-log.md`. Return stable event/finding ID, service and location keys, source event timestamps, duration unit, source/version/date/location, event class as supplied, candidate causes and counterevidence, affected control, action/owner/due date, verification evidence, applicability, uncertainty, qualified reviewer, status, decision-not-made, investigation/privacy restriction, and stop/escalation condition. Identify dependencies on path conflicts and infrastructure restrictions and preserve unresolved contradictions.

## Unknown and stop conditions

Stop when event identities or clocks cannot be reconciled, records are under protected investigation, personal data exceeds authorization, active danger or emergency appears, reporting criteria are missing or out of date, or analysis would prejudice a statutory investigation. Do not infer blame, fatigue, competence, misconduct, reportability, root cause, legal liability, or safe resumption from incomplete records.

## Authority and qualified review

Never classify or submit a statutory occurrence, contact affected parties, alter records, assign fault, direct operational recovery, authorize service resumption, close an action, or claim safety effectiveness. Require the railway safety manager, operations control, infrastructure and rolling-stock owners, human-factors/crew authority, authorized investigator, privacy/legal counsel, emergency authority, and regulator as applicable.
