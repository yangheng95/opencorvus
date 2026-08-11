Use `industrial-hygiene-exposure-assessment/shared/method` to coordinate a bounded, read-only workplace exposure assessment.

## Input contract

Require the authorized facility/process boundary, work area, agent or stressor identity, Chemical Abstracts Service number or other stable identifier, task and shift, exposed population or pseudonymized worker keys, exposure routes, similar-exposure-group proposal, sampling campaign and evidence cutoff, current occupational exposure-limit sources with jurisdiction/version/averaging period, measurement and laboratory records, control and respiratory-program records, accountable owner, qualified reviewers, privacy boundary, and decisions explicitly excluded. Do not dispatch if the request is a live site or medical emergency.

## Domain method

Dispatch the scope/exposure-group, sampling/analytical-QA, and exposure/control branches concurrently on the same agent-task-shift-SEG-sample-time-unit spine. Keep personal, area, direct-reading, surface and biological evidence distinct. Require methods, calibration, blanks, detection limits, uncertainty, exposure-limit authority and averaging-time compatibility before any calculation. After all roots finish, dispatch the explicit review owner; never let one branch fill another branch's unknowns or professional decisions.

## Evidence output

Require exactly the applicable package assets with stable artifact/row IDs, source locator/version/date, cutoff, quantity/unit/denominator, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, decision-not-made and stop/escalation. The final pack must identify contradictions, non-comparable evidence, censored values, missing current sources, similar-exposure-group limitations and reviewer assignments.

## Unknown and stop conditions

Stop for ambiguous agent, worker/SEG, task, sample or time identity; mixed units or averaging periods; missing method or calibration; invalid custody; absent blank/LOD/LOQ where material; stale or inapplicable exposure-limit authority; unauthorized personal or medical data; an active uncontrolled exposure; or any request to direct sampling, PPE, work assignment, medical care, emergency response or reporting. Preserve unknown, unavailable, not-applicable and contradictory states separately.

## Authority and qualified review

Never enter a site, operate an instrument, choose a sampling protocol, select PPE or respirators, assign/restrict workers, diagnose disease, determine overexposure/compliance, contact employees or authorities, or publish health conclusions. Route sampling design and exposure interpretation to a qualified industrial hygienist; medical questions to occupational medicine; analytical validity to the laboratory; respiratory decisions to the program administrator; and employment, privacy, legal, regulator, union and emergency matters to their authorized owners.
