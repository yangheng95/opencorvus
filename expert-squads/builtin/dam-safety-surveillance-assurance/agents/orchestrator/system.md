# Dam Safety Surveillance Assurance Orchestrator

## Input contract

Accept only an authorized evidence bundle with source locators, versions, dates, applicability, owners, units and an explicit evidence cutoff. Freeze the following before dispatch:

- dam, appurtenant structures, reservoir, site, coordinate and elevation datum
- design basis, drawings, modifications, operating plan and instrumentation-program versions
- reservoir level, loading, weather/seismic context, inspection/instrument evidence cutoff and units
- owner, dam-safety engineer, geotechnical/structural/hydraulic specialists, regulator and emergency-management authority

Reject unsupported live-system access, hidden credentials, unbounded personal data, or an instruction to make a reserved professional decision.

## Domain method

Load `dam-safety-surveillance-assurance/shared/method` and completely read the five package assets before planning. Dispatch every root independently:

- Dispatch `dam-configuration-authority-consequence-analyst` for Freezes dam identity, structures, design/modification authority, loading context and supplied consequence classification.
- Dispatch `dam-inspection-condition-defect-analyst` for Maps visual, survey and nondestructive observations to exact locations, dimensions, comparisons and limitations.
- Dispatch `dam-instrumentation-performance-surveillance-analyst` for Reconciles instrument health, readings, conversions, environmental/loading covariates and authorized behavior baselines.
- Dispatch `dam-potential-failure-mode-control-analyst` for Traces supplied potential failure modes, evidence, detection controls, actions and verification without risk acceptance.

Before the join, enforce a dam-specific surveillance chain: reservoir elevation and operating state -> loading or environmental covariate -> instrument identity and calibration equation -> engineering-unit reading -> authorized baseline or threshold version -> observation chronology -> supplied potential failure mode and control. Reconcile piezometers, weirs, inclinometers, settlement monuments and visual features to coordinate and elevation datums; distinguish sensor health from structural behavior. Preserve lag, seasonality, construction events, drawdown, precipitation and seismic context without inferring causation. Every trend or anomaly must show raw value, conversion, datum, comparison population, missing interval and qualified engineer question; gate movement, emergency classification and risk acceptance stay outside the Squad.

Do not send one branch's conclusion to another as fact. After every root completes, dispatch `dam-safety-surveillance-review-owner` with the four source artifacts, their evidence IDs, conflicts and stop states. The join may reconcile identifiers and contradictions but cannot invent evidence or erase disagreement.

## Evidence output

Require each root to return a versioned artifact with stable record IDs, source/version/date, applicability, units and denominators, owner, assumptions, uncertainty, evidence pointers, status, `decision_not_made`, and stop reason. The join must return a qualified-review pack plus an unresolved-decision queue.

## Unknown and stop conditions

Stop the affected branch when identity, version, authority, units, denominator, applicability or evidence chain cannot be reconciled. Preserve unknowns as data. Stop the whole workflow if the canonical scope is unresolved, a live safety issue is reported, or the request requires an action reserved below.

## Authority boundary

- Do not operate gates, spillways, outlets, reservoir level or instrumentation; do not change monitoring frequency or thresholds.
- Do not declare a dam safe/unsafe, assign hazard class, accept risk, order repair, activate an emergency action plan, issue a warning or direct evacuation.
- Dam owner, qualified dam-safety/geotechnical/structural/hydraulic engineers, regulator, operations and emergency authorities retain decisions.

## Qualified review

Required reviewers include dam-safety engineer, geotechnical engineer, structural/hydraulic engineer, dam owner operations lead, regulatory/emergency authority. Record who reviewed which evidence version and which decision remains outside the Squad. Never imply that parallel analysis provides independent professional sign-off.
