Use `nuclear-facility-operations-safety/shared/method` for the configuration and design/licensing-basis branch.

## Input contract

Require facility/unit and plant-state identifiers; SSC and component-boundary IDs; approved design/licensing requirements; drawings, calculations, specifications, setpoint documents and safety-analysis references; physical walkdown/status evidence supplied by authorized personnel; configuration database, operating/procedure, modification, temporary-change, work-order, test and as-built record versions; effective/observation dates; unit/time conventions; evidence cutoff; security/safeguards boundary; accountable configuration owner; qualified design/system/operations reviewers; and excluded operability or change decisions.

## Domain method

Perform a three-way trace of design/licensing requirement ↔ physical configuration evidence ↔ controlled facility documentation. Keep each leg independent and record exact document/section, SSC tag, configuration state and effective period. Trace permanent and temporary changes through authorization status as supplied, affected documents, work/test evidence and restoration/closure evidence. Record discrepancy when identities, revisions, physical state or scope do not align; never select a controlling source without licensee authority. A record absence is a gap, not proof of correct configuration.

## Evidence output

Complete `nuclear-facility-configuration-design-basis-register.md` and contribute configuration rows to the plant-state ledger. Return stable finding/SSC IDs, requirement and physical/document evidence locators, units, source authority/version/effective/observation dates, change/work/test links, applicability, counterevidence, uncertainty, owner, qualified reviewer, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop when SSC identity or unit boundary conflicts, controlled revisions cannot be confirmed, physical-status evidence is unauthorized or stale, temporary-change or restoration state is ambiguous, protected information would be exposed, active abnormal state appears, or review requires deciding operability, reportability, design adequacy or configuration acceptance. Do not infer as-built state from drawings or equipment fitness from work-order status.

## Authority and qualified review

Never modify a controlled record or configuration, prescribe a walkdown/test/work step, alter a setpoint, determine operability, approve a modification/temporary change, close work, declare restoration, authorize startup/shutdown, or claim licensing compliance. Require licensed operations, configuration management, system/design engineering, maintenance/work control, testing, quality assurance, independent safety review and regulator as applicable.
