---
name: digital-accessibility-assurance-method
description: Digital accessibility inventory, WCAG criterion mapping, semantic, keyboard, assistive-technology, visual, media, cognitive, manual and remediation evidence assurance without conformance or legal authority. Use for Select for web/app/document accessibility scope, WCAG mapping, semantics, keyboard/focus, forms, assistive technology, contrast/reflow, media alternatives, motion, cognitive usability, manual testing or remediation trace. Do not select for automatic production mutation, disability inference, legal advice or conformance certification.
---

# Digital Accessibility Assurance Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not silently change production code/content, run unauthorized scans, create accounts, collect disability data or expose personal information.
- Do not certify WCAG/Section 508/legal conformance, approve an exception, claim an automated scan is complete, or replace testing with disabled users.
- Accessibility lead, disabled-user research owner, design/content/engineering, product/release and legal/policy owners retain decisions.

## Freeze the review baseline

Before analysis, freeze:

- product, route/screen/document, user journey, build/commit, content locale and viewport/device matrix
- WCAG edition/level or other policy source as supplied, technology/platform and assistive-technology/browser versions
- test accounts/data/privacy, automated tool/rule-set versions, manual protocol and evidence cutoff
- accessibility lead, disabled-user research owner, design/content/engineering, legal/policy and release authorities

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Inventory complete user journeys and component/content states before sampling. Bind each observation to route/screen/document, build, locale, state, viewport/input modality and evidence locator.
2. Map findings to the exact criterion/version and technique/failure source as a review hypothesis, not an automatic conformance verdict. Automated tools provide observations only and cannot establish full conformance.
3. Test programmatic semantics, name/role/value/state, structure, language, forms/errors/status messages, keyboard order, visible focus, traps, pointer alternatives and assistive-technology output with reproducible steps.
4. Review contrast, color dependence, zoom/reflow, spacing, orientation, target size, motion, timing, flashing, audio/video alternatives, captions/transcripts and cognitive consistency using controlled versions and measured evidence.
5. Trace remediation from finding to design/content/code change, build, retest method and result. Preserve regressions, partial fixes, third-party constraints, exceptions as supplied and disabled-user feedback separately.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Accessibility Scope Inventory Analyst

Freezes journeys, states, builds, locales, technology, standards/policy sources and test matrix.

- route/screen/document inventory
- journey and state coverage
- build/locale/device/input matrix
- criterion/policy source and test authority

Reconcile:

- scope covers critical paths
- build and content versions resolve
- sampling gaps are explicit

Stop when:

- unbounded production scan
- test authorization absent
- personal data exposure

### Accessibility Semantics Keyboard Assistive Analyst

Produces semantic, keyboard, focus, form, status and assistive-technology evidence.

- structure and accessible names
- role/value/state and forms/errors
- keyboard order/focus/traps
- screen-reader and platform accessibility output

Reconcile:

- steps reproducible on named versions
- DOM/AX observation and user effect separated
- automated/manual evidence distinguished

Stop when:

- test environment unstable
- assistive version missing
- production mutation requested

### Accessibility Visual Media Cognitive Analyst

Measures contrast, reflow, visual presentation, motion, timing, media alternatives and cognitive consistency evidence.

- contrast/color/spacing
- zoom/reflow/orientation/target
- motion/flashing/timing
- captions/transcripts/audio description and consistency

Reconcile:

- measurements include method/unit
- content/state versions explicit
- criterion applicability remains review question

Stop when:

- measurement basis missing
- media source unavailable
- health/disability inference requested

### Accessibility Manual User Remediation Verification Analyst

Traces manual protocols, disabled-user evidence as authorized, remediation versions, retests, regressions and exceptions.

- manual task protocol
- authorized user-research evidence
- finding-to-change trace
- retest/regression/third-party/exception status

Reconcile:

- privacy/consent boundary clear
- fix build differs from finding build
- retest reproduces original path

Stop when:

- consent/privacy absent
- fix not deployed to test environment
- exception/conformance approval requested

### Digital Accessibility Assurance Review Owner

Joins scope, semantic/keyboard, visual/media and manual/remediation evidence into a qualified accessibility review pack.

- scope and criterion coverage
- automated/manual/user evidence separation
- remediation and regression trace
- conformance/exception decision queue

Reconcile:

- all findings map to build/state/evidence
- coverage gaps remain visible
- conformance/legal decisions remain decision_not_made

Stop when:

- critical journey untested
- evidence versions conflict
- authorized accessibility owner absent

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/accessibility-scope-journey-build-test-matrix.md`: Freeze accessible-product scope and test coverage. Required domain fields: product_route_document, journey_task, state, build_commit_content_version, locale, viewport_device_input, AT_browser_version, criterion_policy_source.
- `assets/semantic-keyboard-assistive-evidence-ledger.md`: Preserve structure, form, focus and assistive evidence. Required domain fields: finding_id, element_component, criterion_hypothesis, name_role_value_state, keyboard_steps_focus, AT_output, tool_protocol_version, user_effect_hypothesis, evidence_locator.
- `assets/visual-reflow-media-cognitive-evidence-register.md`: Record measured visual/media/cognitive observations. Required domain fields: finding_id, content_state, contrast_or_dimension_value_unit, zoom_reflow_orientation, motion_timing_flashing, caption_transcript_audio_description, consistency_error_prevention, method_version.
- `assets/accessibility-remediation-retest-regression-register.md`: Trace finding through controlled remediation and verification. Required domain fields: finding_id, owner, design_content_code_change, change_commit_build, retest_protocol, retest_result, regression_scope, third_party_constraint, exception_as_supplied.
- `assets/digital-accessibility-qualified-review-pack.md`: Present coverage, evidence, remediation and reserved conformance decisions. Required domain fields: scope_baseline, criterion_coverage, automated_manual_user_evidence, critical_journey_gaps, remediation_status, exception_questions, decision_not_made, accessibility_owner.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Bounded MIT adaptation of criterion mapping, automated/manual separation, keyboard/semantics/visual checks, reproducible evidence and remediation verification from alirezarezvani/claude-skills@aa8d778811a557a2c28ccadda4cf3d0bd028a4cc engineering-team/a11y-audit/skills/a11y-audit/SKILL.md. Autonomous codebase mutation, fixed severity scoring, production changes, UI automation, conformance and legal conclusions are excluded. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
