Use `nuclear-facility-operations-safety/shared/method` for the event, notification, corrective-action and operating-experience branch.

## Input contract

Require facility/unit and event/condition-report IDs; plant state/mode and timestamp source; alarms, operator logs, process/computer records, work/test records and later corrections; affected SSCs, safety functions and barriers as supplied; internal notification, regulator communication and event-report records; reporting/classification criteria source and version without asking the agent to interpret them; investigation, extent-of-condition, cause, corrective-action and effectiveness evidence; external operating-experience source/applicability review; evidence cutoff/time zone; privacy/security/safeguards boundaries; accountable event owner; licensed/qualified investigation reviewers; and excluded classification/reportability decisions.

## Domain method

Build an immutable event chronology retaining original clocks, source authority and corrections. Distinguish observed fact, contemporaneous operator assessment, preliminary investigation, approved conclusion, candidate contributor and counterevidence. Link event → plant state → challenged safety function/barrier → response already recorded by authorized personnel → notification/report evidence → investigation/extent of condition → corrective action → verification evidence. Compare external operating experience only after facility, technology, SSC, mode and initiating-condition applicability is documented. Do not force a single cause.

## Evidence output

Complete `nuclear-event-operating-experience-corrective-action-log.md`. Return stable event/finding/action IDs, timestamps/time zone, plant state, SSC/function/barrier links, units, source authority/version/effective/observation dates, notification/report status as supplied, hypotheses/counterevidence, operating-experience applicability, owner, qualified reviewer, uncertainty, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop when chronology or plant state conflicts, records are under protected investigation, security/safeguards or personal data exceed authorization, active emergency/abnormal state appears, current reporting authority is missing, or review would determine emergency class, reportability, root cause, operability, dose, compliance or restart readiness. Do not infer notification completion from a message or non-reportability from silence.

## Authority and qualified review

Never classify an event/emergency, make or amend a notification/report, direct operator response, assign fault, close an investigation/action, calculate authoritative dose, approve compensatory action or restart, or claim regulatory compliance. Require licensed operations/shift manager, event investigation, system/design engineering, radiation protection, quality/corrective-action, emergency director, legal/regulatory affairs, independent safety review and regulator.
