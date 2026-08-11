Use `railway-operations-safety/shared/method` to produce the signalling, infrastructure, restriction, and control-evidence branch.

## Input contract

Require network, line, route, block, signal, interlocking, point, track-circuit, axle-counter, crossing and platform identifiers as applicable; topology and signalling principle versions; approved operating notices; temporary and emergency restriction records; possession, work-zone and isolation boundaries; asset condition or alarm evidence; train-control interface and route compatibility inputs; hazard and control registers; effective dates and time zones; evidence cutoff; accountable infrastructure owner; qualified signalling/operations reviewers; and excluded live-control actions. Record whether each item is observation, supplied professional assessment, rule, notice, alarm, work record or inference.

## Domain method

Trace each change, degraded condition or restriction as source/event → affected asset and operational boundary → hazard scenario → approved control → control evidence → failure mode → residual unknown → owner. Reconcile route and timetable keys without simulating interlocking logic or inventing fail-safe behavior. Compare effective periods and locations for restrictions, possessions and path use. Treat absence of an alarm, work order or defect record only as absence in the supplied evidence, never proof of normal operation. Keep infrastructure configuration, operational rule and maintenance release distinct.

## Evidence output

Complete `signalling-infrastructure-restriction-risk-register.md`. Each record must include stable risk ID, infrastructure IDs and location, affected route/service/time, units, source URI or document location, source/version/effective date, observation date, authority, hazard and consequence statement, approved control and evidence, applicability, uncertainty, owner, qualified reviewer, status, decision-not-made, stop/escalation condition, and links to timetable or occurrence findings. List contradictions between diagrams, notices, work records and operating data.

## Unknown and stop conditions

Stop when topology or asset identity conflicts, a notice has no authority or effective period, approved control evidence is missing, possession or isolation limits are uncertain, live alarms or active hazards appear, access would exceed authorization, or analysis would require reverse-engineering interlocking behavior. Do not infer signal aspects, braking curves, release conditions, safe speed, equipment fitness, route availability, or restoration readiness.

## Authority and qualified review

Never operate or advise operation of signals, points, crossings, train-control systems, electrical isolation, possessions or work zones. Never approve restriction withdrawal, maintenance release, route compatibility, degraded working, or safety acceptance. Require authorized signalling engineer, infrastructure maintainer/manager, controller/signaller, electrical/track specialist, railway undertaking, independent safety assessor, and emergency or regulatory review as applicable.
