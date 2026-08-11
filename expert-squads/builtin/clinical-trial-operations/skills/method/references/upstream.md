# Upstream provenance and adaptation boundary

## Accepted bounded source

- Original repository: `anthropics/life-sciences`.
- Pinned commit: `e96556b637b56d6cc3a5ad33987009be9e60aa5c`.
- Exact source path: `clinical-trial-protocol-skill/SKILL.md`.
- Pinned source URL: `https://github.com/anthropics/life-sciences/blob/e96556b637b56d6cc3a5ad33987009be9e60aa5c/clinical-trial-protocol-skill/SKILL.md`.
- Pinned source bytes/SHA-256: `20426` / `e60ffb7aaebbd5e95f365082a10fe70541d0b8a0fe82a7b7ec2ba2821f2af4cf`.
- Exact license path: `clinical-trial-protocol-skill/LICENSE.txt`.
- Pinned license URL: `https://github.com/anthropics/life-sciences/blob/e96556b637b56d6cc3a5ad33987009be9e60aa5c/clinical-trial-protocol-skill/LICENSE.txt`.
- License: Apache License 2.0. The full license text is preserved in `upstream-license.txt`. The pinned package contained no NOTICE file when verified 2026-08-11.
- Pinned license bytes/SHA-256: `10254` / `7505b489cc8ad7f16ba08343184320f1583303cfacdb9121b9b756bc073df1ab`; the saved file is byte-identical.
- Verification: remote HEAD, exact paths, Skill content, package tree, and license were checked 2026-08-11. Reverify the fixed source only if changing the adaptation; separately verify every live jurisdiction, protocol, sponsor-plan, and reporting requirement from its current authoritative source.

## Bounded adaptation

Retained concepts are protocol/version discipline, staged evidence organization, official-source research, responsibility separation, traceable intermediate records, explicit unknowns, and mandatory biostatistical/clinical/regulatory/ethics/legal review. Modified files are identified by this provenance record and the OpenCorvus-specific Skill name and package structure.

Explicitly excluded are upstream host waypoint directories, clinical-trials MCP requirements, sequential confirmation UI, automatic resume state, FDA-only pathway decisions, submission-ready claims, direct protocol generation, treatment/intervention design, endpoint and sample-size recommendations, unsourced timing or numerical advice, and any implication of regulatory or ethics approval. None of those behaviors is callable from this package.

## Clean-room operational supplement

Site readiness, delegation/training, participant-flow denominators, visit/deviation facts, critical-to-quality monitoring, query and system reconciliation, safety routing, Trial Master File completeness, retention/handoff, and closeout dependencies were authored clean-room for OpenCorvus. Current method questions draw on:

- ICH E6(R3) Step 4 final guideline: `https://database.ich.org/sites/default/files/ICH_E6%28R3%29_Step4_FinalGuideline_2025_0106_ErrorCorrections_2025_1024.pdf`; final adopted 2025-01-06 with recorded 2025-10-24 corrections; reviewed 2026-08-11.
- U.S. Food and Drug Administration E6(R3) final guidance page: `https://www.fda.gov/regulatory-information/search-fda-guidance-documents/e6r3-good-clinical-practice-gcp`; reviewed 2026-08-11.
- FDA risk-based monitoring Questions and Answers: `https://www.fda.gov/regulatory-information/search-fda-guidance-documents/risk-based-approach-monitoring-clinical-investigations-questions-and-answers`; final April 2023; reviewed 2026-08-11.
- ClinicalTrials.gov Protocol Registration Data Element Definitions: `https://clinicaltrials.gov/policy/protocol-definitions`; reviewed 2026-08-11.

These sources do not make the Agent a sponsor, investigator, monitor, medical expert, ethics body, regulator, or legal authority. No universal deadline, threshold, eligibility rule, safety classification, or submission conclusion is encoded.
