---
name: robotics-safety-validation-method
description: Evidence-first method for integrated robot application requirements, task and mode hazard analysis, risk-reduction traceability, safety-function validation, deterministic replay, fault injection, property invariants, simulation and hardware-in-the-loop evidence. Use for bounded robotics safety validation and qualified review preparation without live robot control, safety acceptance, commissioning or compliance claims.
---

# Robotics Safety Validation Method

## Establish the controlled application baseline

Freeze the application before interpreting evidence. Record the robot and controller identity; firmware, application and safety-configuration versions; end effector, payload, material and external machines; sensing and communications; energy sources and isolation states; workspace geometry and access points; environmental limits; persons and competencies; intended tasks; setup, teaching, automatic, collaborative, recovery, maintenance and decommissioning modes; foreseeable misuse; jurisdiction; lifecycle phase; evidence cutoff; and responsible owner. A robot model name alone is not a configuration baseline.

Assign stable IDs to requirements, interfaces, tasks, modes, hazards, safeguards, safety functions, configurations and tests. Preserve the exact source locator, revision and date behind each statement. Separate supplied requirements from assumptions and separate design intent from observed behavior. Do not fill a missing limit with a common industry value.

## Trace requirements and interfaces

Build a many-to-many trace from application requirements to physical, electrical, software, safety, human and organizational interfaces. Check coordinate frames, tooling and payload assumptions, energy and stopping dependencies, external-machine handshakes, reset/restart behavior, access control, visibility, maintenance access and loss-of-service states. Record incompatible interface versions and ambiguous ownership as gaps.

A requirement is reviewable only when its triggering conditions, required behavior, applicable modes, verification method and acceptance source are explicit. Preserve quantitative values with units, tolerance, basis and measurement condition. Do not turn a narrative design preference into a mandatory safety requirement.

## Analyze tasks, modes and lifecycle hazards

Decompose work by task step, person, mode, robot motion, tool/material, energy, zone and lifecycle phase. Trace each hazard source through hazardous situation and event to possible consequence. Include unexpected startup, loss or restoration of energy, control faults, sensing faults, communication faults, tooling or payload loss, crushing, trapping, impact, cutting, ejection, thermal/electrical hazards, access during teaching or recovery, maintenance and foreseeable misuse.

Use only the risk-estimation inputs and criteria supplied by the authorized organization. Do not calculate or normalize severity, exposure, avoidance or probability when their definitions are missing. Trace proposed measures in the risk-reduction hierarchy: inherently safe design, engineering safeguards, then information for use and administrative measures. Identify dependencies and common-cause vulnerabilities. Residual-risk acceptance is a human decision and is never inferred from completed rows.

## Trace safety functions and SRP/CS evidence

For every claimed safety function, record initiating condition, required safe response, response timing or distance requirement as supplied, reset and restart rules, applicable modes, architecture, involved safety-related parts of control systems, input/logic/output elements, diagnostics, fault assumptions, interfaces, configuration versions and bypass/override controls. Link each claim to analysis and test evidence.

Record PL, Category or SIL only as an attributed supplied claim. Never compute, upgrade or endorse it. A successful nominal test does not establish architectural suitability, diagnostic coverage, systematic capability or common-cause adequacy. Route those determinations to qualified functional-safety specialists using the authorized current standard text.

## Build layered verification and validation evidence

Adapt the upstream Robotics Testing hierarchy in a bounded form:

1. Unit evidence isolates a calculation, component behavior or property.
2. Integration evidence challenges interfaces, handshakes, sequencing and error propagation.
3. Simulation evidence explores controlled scenarios and repeatable edge cases while preserving model limitations.
4. Hardware-in-the-loop evidence records supplied controller/hardware interaction results without connecting this Skill to hardware.
5. Bounded field evidence records results from an authorized test plan; it never authorizes execution or exposure.

For every layer, state linked requirement/hazard/function, test configuration, scenario, preconditions, instrumentation and calibration, expected result and authorized acceptance source, observed result, units and tolerances, evidence pointer, anomalies and uncertainty. Simulation agreement is not physical validation, and hardware-in-the-loop evidence is not permission to operate.

## Use deterministic replay, fault injection and invariants carefully

Store replay seed, input stream, time base, software/configuration hashes and environmental assumptions so a result can be reproduced. Fault injection must be an already authorized test artifact; the Skill may document injected sensor loss, stale data, communication delay, actuator or logic fault, but must never initiate a live injection. Compare expected and observed transitions, recovery and diagnostic behavior.

Express property-based invariants as falsifiable claims over a defined state space, such as prohibited motion under an asserted protective condition or controlled restart after a reset sequence. State the domain and exclusions of each invariant. Scenario coverage counts only defined scenarios and dimensions; it is not a safety-completeness percentage unless a qualified authority supplies that interpretation.

## Evaluate safeguarding and collaborative evidence

Trace perimeter guarding, interlocks, presence sensing, separation monitoring, speed/force limiting, enabling devices, emergency functions, access control and restart prevention to tasks, modes and exposed persons. For collaborative or contact-related evidence, preserve the authorized measurement method, body region or contact condition, tool and payload, speed/force configuration, instrumentation, calibration and uncertainty. Never insert generic contact thresholds or declare a collaborative application safe.

Challenge foreseeable defeat, muting, bypass, reset visibility, trapped-person exposure and loss of protective function. Any proposed test involving people, live motion or safeguard manipulation is outside the Skill and must stop for authorized engineering control.

## Join the evidence case

Require the four roots to work from the identical baseline. Join by stable IDs rather than prose similarity. Produce coverage tables for requirement-to-test, hazard-to-measure, hazard-to-safety-function and function-to-configuration/test links. Preserve contradictions and distinguish missing evidence from failed evidence. State the impact, owner, qualified resolver and stop condition for each gap.

The case owner may conclude only that a record is present, linked, reproducible or unresolved. It may not conclude that risk is acceptable, the system is safe, a PL/Category/SIL is achieved, commissioning is allowed or a legal requirement is satisfied.

## Stop and authority rules

Stop on missing configuration identity, jurisdiction, task/mode boundary, exposed-person definition, requirement source, hazard analysis, safety-function definition, acceptance source, test configuration, calibration or qualified reviewer. Stop on any request for live robot access, ROS commands, deployment, control changes, safeguard bypass, human exposure, unapproved fault injection or confidential-data release.

Use the five package assets and preserve source/version/date, owner/reviewer, value/unit/basis, applicability, assumptions, uncertainty, status, decision-not-made and stop fields. Qualified robot/machine-safety engineers, integrators, control engineers, employers/users, EHS authorities and regulators make safety, acceptance, commissioning and compliance decisions.
