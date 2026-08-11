# Satellite Mission Operations

This package runs three evidence-only branches in parallel: spacecraft telemetry/health/state reconstruction, mission-planning and ground-contact resource analysis, and telecommand-procedure/anomaly readiness. `satellite-mission-operations-review-owner` joins their versioned artifacts without concealing source, time-correlation, configuration, or authority conflicts.

Use it to prepare reproducible records from authorized mission data. It never connects to spacecraft or ground systems; creates, approves, schedules, transmits, or verifies a live command; changes spacecraft mode, configuration, orbit, attitude, payload, or ground resources; books a contact; emits an operational alert; or makes maneuver, conjunction, spectrum, flight-safety, or emergency decisions. Those responsibilities remain with the flight director, spacecraft operations team, subsystem engineers, flight-dynamics team, ground/network operators, payload planners, space-safety staff, and spectrum/regulatory authorities.

The unique package Skill is `satellite-mission-operations/shared/method`. It is clean-room authored from public primary-source concepts. Rejected Agent Skill candidates, exact commits, licenses, and exclusions are recorded under `skills/method/references/`; protected standards are referenced but not copied.
