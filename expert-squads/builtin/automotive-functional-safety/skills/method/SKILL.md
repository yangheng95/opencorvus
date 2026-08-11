---
name: automotive-functional-safety-method
description: Evidence-first road-vehicle E/E functional-safety method for item definition, HARA trace, safety concepts and requirements, hardware/software failure analyses, verification, lifecycle, configuration, change and confirmation evidence. Use without ASIL assignment, engineering approval, qualification, release or compliance authority.
---

# Automotive Functional Safety Method

## Freeze the lifecycle baseline

Record vehicle platform and variant, item identity and version, intended functions and malfunctions, external systems and environment, operating context, lifecycle phase, applicable standard edition and authorized copy, organizational tailoring, OEM/supplier responsibility and interface agreement, configuration baseline, change/anomaly cutoff, requested decision and qualified reviewers. Separate series-development scope, legacy integration, reused component or Safety Element out of Context assumptions. Never infer that a work product applies to a variant merely because names resemble each other.

## Item definition and HARA evidence

Build the item boundary from functions, dependencies, driver or external interactions, operating modes and environmental assumptions. Identify each operational situation and operating mode under its source. Trace a malfunction to hazardous event, potentially affected people, supplied severity, exposure and controllability rationales, supplied Automotive Safety Integrity Level and safety goal. Preserve every classification exactly as approved evidence; the Skill may find missing rationale or inconsistency but cannot assign, confirm or downgrade ASIL. Distinguish malfunctioning-behavior hazards from nominal-performance limitations, cybersecurity threats, electric/chemical/mechanical hazards not caused by the E/E malfunction and fleet-operational events; route adjacent hazards to their owners.

## Concepts and requirement trace

Trace safety goal to functional safety requirement, functional safety concept, technical safety requirement and concept, system architecture, hardware and software safety requirements, interfaces, safe state or degraded mode, fault-tolerant time interval and verification/validation evidence as supplied. Each relationship is directional and versioned. Test requirement quality for stable identity, unambiguous behavior, condition, quantitative tolerance and unit where relevant, ASIL as supplied, allocation, verification method and acceptance criterion. Record missing backward or forward trace, conflicting allocation and interface assumption; do not create an architecture or requirement to fill the gap.

For distributed development, preserve responsibility, deliverable, assumption, dependency, change-notification and acceptance boundaries between OEM, Tier suppliers and component vendors. A supplier safety manual or interface agreement is evidence only for its stated version and usage constraints. Do not infer compliance from a certificate, capability level or component pedigree.

## Hardware/software analysis and verification

Inventory FMEA, FMEDA, Fault Tree Analysis, dependent-failure analysis, DFA or other safety analyses under the actual authorized method. Trace function/component/failure mode to local effect, end effect, safety mechanism, diagnostic or detection evidence, fault category, assumed failure rate and data source, dependent cause and requirement. Recalculate a supplied metric only when definitions, population, units, failure-rate source, diagnostic coverage, exclusions and tool version are available; show formula, numerator and denominator. Do not invent failure rates, diagnostic coverage, latent-fault exposure or metric target.

Trace each requirement to review, analysis, test or validation case; configuration of item, hardware, software, calibration, test environment, instrumentation, scenario, expected result, actual result, deviation and anomaly. Separate verification of a work product from vehicle-level safety validation. Passing sampled tests is not completeness. Record independence and reviewer competence evidence without deciding it is sufficient.

## Lifecycle assurance

Trace safety plan, safety manager and confirmation measure responsibilities, competence evidence, interface agreements, configuration and documentation management, change and impact analysis, anomaly/problem resolution, tool confidence or qualification claims, software-component qualification, hardware evaluation, proven-in-use claims and release evidence. For a change, link affected item/HARA/goal/requirement/architecture/analysis/test/manual/production/service artifacts and the approved impact disposition. For Safety Element out of Context use, trace assumptions of use to integration evidence and violations.

## Join the safety case

Use exactly the five assets. Every row contains stable ID, vehicle/item/variant and configuration, quantitative value with unit/basis where applicable, source URI/control ID, version, observation/effective and extraction dates, owner, reviewer, applicability, uncertainty, status, evidence pointer, decision-not-made and stop condition. Join claim to argument/evidence and counterevidence. A claim cannot inherit a green status from a downstream test when its upstream HARA or requirement baseline differs. Preserve gaps, contradictory ASIL labels and superseded evidence.

## Unknown and stop conditions

Stop when item/variant/boundary, operational context, standard edition/authorization, configuration, ASIL source, requirement identity, test configuration, failure-rate basis, supplier responsibility or confirmation authority is missing or conflicting. Stop if requested standard content is not authorized for use. Never copy protected standard text, estimate professional classifications, use an obsolete baseline as current, or convert absence into pass/fail.

## Authority and qualified review

This method cannot assign or decompose ASIL, approve HARA, safety goals, concepts, architecture, safe state, quantitative metrics, failure rates, diagnostic coverage, tools/components, verification sufficiency, confirmation measures, safety case, homologation or production release. It cannot operate or modify a vehicle, ECU, calibration, test bench or repository, and does not certify ISO or legal compliance. Route decisions to functional-safety manager and independent assessor plus OEM/supplier system, hardware, software, test, quality, configuration, manufacturing, service, cybersecurity, legal/regulatory and vehicle-release authorities.

Read `references/source-provenance.md`. This clean-room method uses public scope descriptions and agency research only; it does not reproduce protected ISO text or rejected Skill content.
