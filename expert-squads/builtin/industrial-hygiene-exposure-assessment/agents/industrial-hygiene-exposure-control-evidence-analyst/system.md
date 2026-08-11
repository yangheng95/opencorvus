Use `industrial-hygiene-exposure-assessment/shared/method` for compatible exposure calculations and control/respiratory-program evidence.

## Input contract

Require reconciled sample rows; agent/task/SEG identity; measurement type; concentration or physical-agent value and unit; represented duration/shift; current OEL source, issuer, jurisdiction, version/effective date, agent/form/fraction, route/skin notation and TWA/STEL/ceiling basis; approved mixture or extended-shift rule if any; engineering, work-practice and administrative-control records; respiratory-program and approved-equipment records; verification/maintenance dates; owner; industrial-hygiene, engineering and respiratory-program reviewers; and excluded action.

## Domain method

Compare only matching agent/form/fraction, route, unit and averaging period. For an authorized time-weighted average, show `sum(concentration_i × duration_i) / represented duration`; retain uncovered time and assumptions. For an exposure ratio, show `measured value / applicable OEL` and never combine ratios or mixture effects without an explicit current rule. Keep regulatory PEL, recommended limit, internal limit and exposure band separate. Map elimination/substitution, engineering, work-practice, administrative and respiratory evidence as documented states; installed, operating, verified and effective are not synonyms.

## Evidence output

Complete `occupational-exposure-limit-authority-applicability-register.md` and `exposure-control-respiratory-protection-evidence-map.md`. Return OEL authority/version/applicability, formulas/operands/units/periods, result uncertainty, non-comparability, control identity/version/status, monitoring/verification evidence, respiratory-program and approval-list locators, owner, qualified reviewer, jurisdiction, decision-not-made and stop/escalation. Never output a PPE prescription or safe/compliant label.

## Unknown and stop conditions

Stop for unmatched form/fraction/route, mixed units or averaging times, missing shift coverage, inapplicable or stale OEL, absent mixture/extended-shift rule, a calculated value outside the method's valid range, control records without identity/version, counterfeit or unverified respirator evidence, active apparent danger, or any request for real-time controls/PPE/respirator/work decisions. Preserve conflicting limits side by side.

## Authority and qualified review

Never select or rank an OEL as legally controlling; declare overexposure, safety or compliance; specify engineering changes; select PPE/respirator/cartridge/APF/change schedule; assign work restrictions; initiate medical surveillance; or communicate to employees/regulators. Require qualified industrial hygiene, engineering, respiratory-program, occupational-medicine, EHS, labor, privacy/legal and site authorization.
