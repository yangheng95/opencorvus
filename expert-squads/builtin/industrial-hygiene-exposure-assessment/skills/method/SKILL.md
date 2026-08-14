---
name: industrial-hygiene-exposure-assessment-method
description: Prepare traceable workplace industrial-hygiene evidence across agents, tasks, similar exposure groups, sampling and analytical QA, occupational exposure-limit applicability, compatible exposure calculations, controls, respiratory-program records, uncertainty, and qualified review. Use for bounded exposure-assessment preparation; never use for live sampling, PPE or respirator selection, worker assignment, medical diagnosis, overexposure/compliance determination, reporting, or site action.
---

# Industrial Hygiene Exposure Assessment Method

## Freeze scope, identity and authority

1. Record facility, area, process, task/version, shift/time zone, evidence cutoff, accountable owner, privacy boundary, intended assessment question and excluded decisions.
2. Assign stable IDs to agent/stressor, CAS or other authority identity, mixture, physical form and particle-size fraction, source/release point, task, pseudonymized worker, similar exposure group (SEG), sample, instrument/pump, method, laboratory result, occupational exposure limit (OEL), control and evidence item.
3. Preserve source locator, issuer/authority, version/effective/observation date, value/unit/denominator, applicability/jurisdiction, assumptions, uncertainty/confidence, owner, qualified reviewer, privacy/license boundary, status, `decision_not_made` and `stop_or_escalation` for every material row.
4. Keep chemical, physical, biological and ergonomic stressors distinct. Do not convert dermal, surface, biological, area or direct-reading evidence into a personal airborne exposure without a current authorized method.

Use [the scope and SEG register](assets/industrial-hygiene-scope-agent-task-seg-register.md) as the identity spine.

## Build task-agent and SEG evidence

1. Trace process/source → agent/form/fraction → task → frequency/duration/shift → route → worker/SEG → control state → sample evidence.
2. Separate routine, intermittent, non-routine, maintenance, upset and emergency states. Keep historical and current configurations versioned.
3. Build an SEG only from supplied similarity evidence covering task, agent, process, duration/frequency, environment and controls. Record within-group variability, exclusions and counterexamples.
4. Treat job title, proximity or a single measurement as insufficient proof of similarity. Record representation as an explicit qualified-review question.
5. Minimize personal data. Use pseudonymized keys and route medical or individually identifiable records to the authorized privacy and occupational-health process.

## Reconcile sampling and analytical quality

1. Trace sample ID through field sheet, seal/custody, receipt, preparation, batch, raw result, reported result, amendment and final status.
2. Record sample type, medium, method/version, instrument or pump ID, calibration standard/traceability, pre/post flow, start/stop clocks, duration, volume, environmental conditions, handling and interferences.
3. Calculate sampled volume only from compatible flow and elapsed time; show operands, units and conversions. Do not invent a permitted calibration drift or sample-volume range.
4. Preserve field/media/reagent blanks, recovery, dilution and correction separately. Apply a correction only when the controlled method explicitly requires it.
5. Keep detected, estimated, below limit of detection (LOD), below limit of quantitation (LOQ), overloaded, invalid and not-analyzed states distinct. Never substitute zero for a non-detect or choose a censored-data rule without authority.

Capture the complete record in [the sampling and analytical ledger](assets/sampling-analytical-qa-exposure-ledger.csv).

## Establish OEL applicability

1. Record every candidate OEL with issuing body, source locator, version/effective date, jurisdiction, agent identity, form/fraction, route/skin notation, value/unit and TWA/STEL/ceiling or other averaging basis.
2. Keep regulatory permissible limits, recommended limits, internal limits and occupational exposure bands separate. Do not choose which is legally controlling.
3. Confirm the sample result matches agent/form/fraction, unit and represented averaging time before comparing. Preserve extended-shift, mixture or excursion treatment only from an explicit current rule.
4. If no OEL exists, record the absence. A qualified professional may use a current authorized exposure-banding process; the agent does not invent a band or protective range.
5. Complete [the OEL authority register](assets/occupational-exposure-limit-authority-applicability-register.md).

## Calculate compatible exposure evidence

1. For an authorized time-weighted calculation, use `TWA = sum(C_i × t_i) / represented duration`; list every concentration, duration and uncovered interval.
2. For a simple comparison, use `exposure ratio = compatible measured value / applicable OEL`. Do not add ratios for mixtures unless a current supplied rule authorizes the exact combination.
3. Keep raw value, corrected value, reported value and calculated value separate. State basis, significant figures, conversion source and uncertainty.
4. Do not infer SEG distribution, upper percentile, exceedance probability or trend from an inadequate or non-representative sample set. If a qualified plan supplies a statistical method, preserve its assumptions and censored-data treatment.
5. A ratio or statistic is evidence, not a safe/unsafe, health-effect, overexposure or compliance decision.

## Map controls and respiratory-program evidence

1. Map elimination/substitution, engineering, work-practice, administrative and respiratory evidence to the exact agent/task/SEG/configuration and date.
2. Keep control design, installation, operation, maintenance, verification and effectiveness as separate evidence states.
3. For respirators, record only supplied program, hazard evaluation, model/approval identifier, fit-test, medical-evaluation, training, maintenance and change-schedule evidence within privacy authority.
4. Never select a respirator, cartridge, assigned protection factor, service-life rule or PPE ensemble. Current approved-equipment listings and employer program decisions remain authoritative.
5. Complete [the control evidence map](assets/exposure-control-respiratory-protection-evidence-map.md).

## Join and preserve uncertainty

1. Require all branch artifacts and compatible agent/task/SEG/sample/time/unit keys. Hash or version each input.
2. Reconcile scope representation, sample QA, OEL applicability, calculations and controls. Create explicit contradictions instead of choosing a convenient record.
3. Label each final statement as source fact, observation, calculation, assumption, uncertainty, unknown or proposed evidence request.
4. Limit proposals to obtaining current sources, reconciling identities/units/versions, qualified review, or verifying an already authorized action.
5. Complete [the qualified review pack](assets/industrial-hygiene-exposure-assessment-qualified-review-pack.md). Never fill a professional approval, compliance, medical, employment or reporting decision.

## Stop and retain professional authority

Stop for ambiguous agent/task/worker/SEG/sample identity; custody or calibration gaps; stale/inapplicable method or OEL; mixed form/fraction/unit/averaging period; unsupported censored-data treatment; incomplete time coverage; unauthorized personal/medical evidence; apparent active danger or illness; or a request for live sampling, control, PPE, work, medical, emergency or reporting action.

Never enter a site, operate or calibrate instruments, choose a sampling plan, select PPE/respirators, assign/restrict workers, diagnose illness, determine causation/overexposure/compliance, file a report or contact employees/authorities. Require qualified industrial hygiene, occupational medicine, laboratory, metrology/QA, engineering, respiratory-program, EHS, privacy/legal, employment and employee-representative review.

## Sources and clean-room boundary

Read [the source and provenance record](references/sources.md). This method and all five assets are clean-room authored from primary-source method structure. The reviewed project-risk Skill is rejected in full; no upstream words, code, matrices, scores, schedules, templates or thresholds are retained.
