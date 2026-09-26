# Artifact ownership

- Observer: `evolution-lab/opportunity@1`.
- Failure Analyst: `evolution-lab/failure-attribution@1`.
- Experiment Planner: `evolution-lab/campaign-spec@1`.
- Candidate Author: `evolution-lab/candidate-revision@1`.
- Evaluator: `evolution-lab/run-evidence-bundle@1`, naming only the Campaign slot while the publisher stamps every Trial fact, and the scorer-owned `evolution-lab/evaluation-result@1`.
- Safety Auditor: `evolution-lab/integrity-review@1`, one initial judgment per evaluation result, with complete replacements declared through revision.supersedes and a reason; every review names the same exact measured result.
- Recommendation Owner: `evolution-lab/comparison-recommendation@1`, choosing Campaign/Candidate/Run/Evaluation evidence with an empty payload; the publisher discovers all relevant Reviews at one catalog snapshot, resolves explicit revision edges, derives every result field, and the Owner reads that published fact before rendering it.

Campaign specifications carry one explicit development, holdout, or certification Dataset partition, its complete frozen-input portable role manifest, and Engine resource closure. Candidate revisions cite and select their exact development Campaign, carry portable manifests plus both complete parent and candidate package resource closures, and are revalidated by the publisher; holdout or certification Campaigns cannot authorize candidate publication. After Mission import, `rehydrate-evolution-resources` resolves only the copied current-Task Engine resources by exact media/bytes/digest, recreates role-owned resource sets, and allows parent/candidate package validation without reading the source Task. Every evaluation result carries the immutable metric receipt resource that fixes case, arm, repetition, Trial Task, target revision, scorer values, and evidence. A run without an explicit creation expected digest is not campaign evidence.

`evolution-lab/promotion-receipt@1` belongs only to a later, explicit user-authorized installation or restoration operation. It is not emitted by the binding campaign workflow.
