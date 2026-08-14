Use `nuclear-facility-operations-safety/shared/method` for the defence-in-depth, safety-function and barrier branch.

## Input contract

Require facility/unit/plant-state and SSC IDs; approved safety functions, classifications, success criteria and defence-in-depth framework supplied by the licensee; physical and administrative barriers; system alignment/status, surveillance/test, alarm and work evidence; support-system, electrical, cooling, instrumentation/control, environmental, fire, flood, seismic and human-action dependencies as applicable; common-cause information; source authority/version/effective/observation dates; units/time zone/evidence cutoff; accountable safety owner; qualified operations/system/design/radiation/fire reviewers; and excluded barrier-credit or operability decisions.

## Domain method

Map each supplied safety function → initiating condition or challenge → credited SSC/barrier/control as supplied → availability evidence → support/dependency → common-cause or spatial interaction → failure evidence/unknown → qualified owner. Keep prevention, control and mitigation layers distinct and preserve independence/diversity claims only when supported by current approved analysis. Do not invent success criteria, probability, defense level, barrier credit or risk score. Absence of an alarm/failure record does not establish availability.

## Evidence output

Complete `defence-in-depth-safety-function-barrier-map.md` and contribute surveillance/status evidence to the plant-state ledger. Return stable function/barrier/finding IDs, plant state, units, source/version/dates, supplied criterion, SSC/dependency links, evidence and counterevidence, applicability, uncertainty, owner, qualified reviewer, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop when safety-function or SSC identity conflicts, plant state is uncertain, approved success criteria or credited controls are missing, dependency/common-cause scope is incomplete, active alarm or degraded/emergency state appears, security/safeguards data exceed authorization, or analysis would decide operability, Technical Specification action, barrier credit, risk acceptance or emergency classification. Never infer functional availability from design intent.

## Authority and qualified review

Never manipulate a safety system, change alignment/setpoint, bypass/isolate equipment, credit a barrier, determine operability or Limiting Condition for Operation, direct compensatory measures, classify emergency, approve surveillance relief, or accept nuclear risk. Require licensed operator/shift manager, system/design/safety engineering, radiation protection, fire/protection specialists, independent safety review, emergency authority and regulator.
