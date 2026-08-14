---
name: ai-model-governance-evaluation-method
description: Evidence-first AI governance and evaluation method for intended-use risk, accountability, model/data/prompt/tool provenance, claim-bound evaluation, robustness, fairness, privacy, security, human oversight, drift, change and incident review. Use without deployment, risk-acceptance, eligibility or compliance authority.
---

# AI Model Governance and Evaluation Method

## Freeze system and decision context

Identify the organization, AI system and use case, decision supported, intended users and affected groups, intended and prohibited uses, deployment environment, model and adapter, training/fine-tuning/evaluation data, prompt/system instruction, retrieval corpus, tools, guardrails, post-processing, human review and appeal paths. Record exact versions or immutable digests, data and evaluation cutoffs, jurisdiction and sector, lifecycle stage, change trigger, risk owner, model owner, independent validator and deployment authority. Separate the model from the sociotechnical system: a model metric cannot validate workflow, human or organizational controls it did not exercise.

## Governance and risk branch

Build the risk inventory before selecting metrics. Trace each use-case claim to affected parties, foreseeable misuse, severity/scope/duration and reversibility evidence, likelihood or exposure basis, uncertainty, control objective, owner, verification evidence and decision authority. Use NIST AI RMF Govern, Map, Measure and Manage as organizing functions, not certification labels. Cover validity/reliability, safety, security/resilience, accountability/transparency, explainability/interpretability, privacy and fairness with their actual applicability. Record legal or policy mappings as questions for counsel, never conclusions.

Document human oversight as a real control: who reviews what information, at which point, with what competence, time, authority to override, escalation path and evidence. A nominal human-in-the-loop is not effective if the interface, workload or incentives prevent meaningful review. High-impact uses require their qualified domain and legal authorities.

## Provenance and documentation branch

Trace model artifact to provider/source, architecture/family, version/digest, license and terms, training/fine-tuning claims, known limitations, supported input/output modalities, context and tool behavior, calibration or safety layers and change history. Trace each dataset to collection purpose, population, sampling, consent/legal basis as supplied, preprocessing, labels/annotators, quality review, exclusions, contamination checks, split method, access, retention and version. Trace prompts, retrieval indexes, tools, policies and post-processors because they change system behavior. Preserve provider claims as claims.

## Evaluation branch

For each decision claim, define evaluation question, target behavior, unit of analysis, population and slices, dataset provenance and independence, metric with direction and scale, baseline/comparator, threshold and threshold owner, repetitions, uncertainty method, stopping rule and failure handling. Prefer deterministic metrics when they directly measure the behavior. Use a minimal representative expected pass and expected failure to verify field mapping, scorer direction and result interpretation before scaling. Inspect row-level outputs and errors plus aggregates; a plausible mean can hide swapped labels or failed slices.

For human rubrics, define criteria, anchors, blinded sampling, adjudication and inter-rater evidence. For LLM-as-judge, version judge model, prompt, order/randomization and parser; test position, verbosity, self-preference and prompt-injection sensitivity against human anchors. Separate dataset-driven rows from task-driven agent trajectories. Record tool calls, intermediate evidence and policy violations when the claim concerns agent behavior.

Treat **test set contamination** as a named validity risk alongside benchmark contamination and test-set leakage. Keep development and decision sets independent; document deduplication, suspected or known exposure, and the consequent limit on every affected claim. Repeat stochastic runs and report sample size, central estimate, dispersion or interval and failure rate. For subgroups, disclose denominator and uncertainty; do not rank a small slice as safe or fair from a point estimate. Check calibration where scores drive decisions, robustness under allowed perturbations and distribution shift, red-team and misuse cases, privacy leakage and security boundaries, abstention/escalation and human-overrides. Evaluation demonstrates bounded evidence, not universal safety.

## Independent review branch

Challenge whether the tested system matches the proposed deployment, the dataset represents affected conditions, the metric measures the claim, thresholds were set before seeing results, exclusions hide failures, and judge or annotator evidence is reliable. Seek counterexamples across languages, accessibility, demographic or operational slices where authorized, rare/high-severity cases, long-tail inputs, tool failures, retrieval corruption, prompt injection and human handoffs. Record counterevidence and alternative explanations without performing offensive exploitation or collecting unauthorized sensitive attributes.

## Monitoring and join

Link approved claims to baseline/version, evaluation protocol/result, known limitation, residual risk owner, monitoring metric, alert threshold as supplied, review cadence, change triggers, incident/complaint/appeal evidence and rollback or escalation owner. A model, prompt, dataset, tool, policy or context change can invalidate evidence; record the impact analysis. Use exactly five assets. Every row includes stable ID, metric/value and unit/direction/basis, source/version/effective and extraction dates, owner/reviewer, applicability, uncertainty, status, evidence pointer, decision-not-made and stop condition.

## Unknown and stop conditions

Stop when system/use-case boundary, model/data/prompt/tool versions, affected population, dataset independence, metric definition/direction, threshold owner, sample size, evaluation failure handling, reviewer independence or deployment match is absent or conflicting. Do not manufacture demographic labels, consent, ground truth, confidence intervals, judge agreement or legal basis. Never launch an external job, send data to an API, reveal secrets or install a dependency under this method.

## Authority and qualified review

Keep evaluation evidence separate from **risk acceptance**: test results can bound a claim, expose limitations and inform a decision, while only the named accountable human authority may accept residual risk. This method cannot deploy, replace, fine-tune, retire or route a model; accept residual risk; certify NIST/ISO/EU or legal compliance; make protected-class, employment, credit, insurance, health, education, criminal-justice or other high-impact individual decisions; authorize safety-critical reliance; or approve public claims. Route decisions to model/system owner, independent validation, domain subject-matter experts, data governance, privacy, security, fairness/civil-rights, accessibility, human-factors, safety, legal/compliance and deployment authorities.

## Upstream adaptation boundary

This Skill retains from NVIDIA's Apache-2.0 `nemo-evaluator-plugin` only these general workflow principles: distinguish dataset-driven and task-driven evaluation; prefer the simplest deterministic metric that measures the behavior; validate a minimal expected pass and failure; inspect row-level and aggregate results; correct mappings/scorers before scaling. It excludes NeMo CLI/SDK/API, platform submissions, credentials, jobs, scripts, stored resources and vendor result retrieval. Governance, provenance, trustworthiness, monitoring, authority and asset schemas are modified/new OpenCorvus work. Read `references/upstream-adaptation.md`, `upstream-LICENSE` and `upstream-NOTICE`.
