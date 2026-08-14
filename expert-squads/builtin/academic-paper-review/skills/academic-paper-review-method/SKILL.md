---
name: academic-paper-review-method
description: Review an authorized academic manuscript through literature positioning, novelty, logic, methods and statistics, factual consistency, citation and hallucination checks, presentation quality, and an integrated evidence-traceable review.
---

# Academic paper review method

## Upstream provenance

This is a bounded OpenCorvus adaptation of K-Dense AI's individually MIT-licensed `peer-review` 2.1, `literature-review` 1.7, `scholar-evaluation` 2.1, and `scientific-visualization` 1.1 Skills, pinned to commit `7eb9c23c32ecf7f8c19cb45ded3150534ccefe6a`. See `references/upstream.md` and `references/upstream-license.txt`. It preserves rigorous review dimensions and human accountability while excluding upstream CLIs, cross-Skill calls, external services, automatic scoring, and field-specific approval authority.

## Intake and confidentiality

1. Record manuscript identity and version, review purpose, target venue and paper type, evidence cutoff, user authorization, venue AI policy, conflicts, competence limits, confidential-material boundary, and required specialist review.
2. Treat unpublished content as confidential. Do not upload manuscript text, supplements, review drafts, or non-public results to an external search, citation, plagiarism, image, or model service without explicit authorization and venue permission.
3. Separate manuscript evidence, public literature evidence, calculations, reviewer inference, and unresolved unknowns. Never claim to have run experiments, reproduced results, opened inaccessible supplements, or verified a source that was not inspected.

## Binding review workflow

1. Freeze the review charter and section/claim inventory before critique.
2. Map the relevant literature with reproducible queries, databases, dates, inclusion rules, and exact source identifiers in `assets/literature-search-protocol.md`. Do not equate search rank with importance.
3. Assess novelty only against inspected prior work. Separate new problem, method, evidence, theory, system, benchmark, and synthesis contributions; record overlap and uncertainty in `assets/novelty-prior-art-matrix.md`.
4. Audit argument logic in `assets/argument-logic-map.md`: premises, inferential steps, alternative explanations, causal language, scope, contradictions, and conclusion strength.
5. Audit methods, statistics, and facts in `assets/methods-fact-recalculation-register.md`: design fit, sampling, controls, leakage, assumptions, power, effect sizes, uncertainty, multiplicity, robustness, numerical reconciliation, ethics, and reproducibility.
6. Audit presentation: title and abstract fidelity, information architecture, terminology, tables, figures, captions, accessibility, uncertainty display, and whether the visual evidence supports the prose.
7. Audit citations and hallucination risk with `assets/claim-citation-hallucination-ledger.md`. Classify every material claim as supported, partially supported, unsupported, contradicted, unverifiable, citation mismatch, or suspected fabricated reference; never silently repair a citation.
8. Join branch findings into `assets/review-evidence-register.md`. Preserve disagreements, distinguish major from minor issues by impact, and provide actionable revisions without impersonating an editor or inventing an accept/reject decision.

## Evidence and severity rules

- Every major finding names the manuscript locator, exact claim or element, observed evidence, reasoning, impact, confidence, and a concrete correction or verification step.
- `Critical` means the central conclusion or research integrity cannot be evaluated safely; `major` means a material claim needs new analysis or substantial revision; `minor` means localized clarity, presentation, or documentation work. Severity is not a venue decision.
- Check numerical identities, denominators, units, sample counts, table/figure consistency, reported precision, and whether prose overstates statistical or practical significance.
- Hallucination review checks unverifiable references, mismatched author/title/year/identifier, claims not entailed by the cited source, invented results, and unsupported certainty. Absence from a bounded search is not proof of fabrication.
- Novelty is a literature-positioning judgment with explicit search limits, not a universal claim.

## Deliverable contract

The integrated review contains: scope and limitations; manuscript summary; contribution and novelty matrix; literature coverage; logic map; methods/statistics/fact audit; citation and hallucination ledger; presentation and figure review; strengths; prioritized findings; questions for authors; required specialist checks; and a revision plan. It must also list sources actually inspected, searches attempted, inaccessible evidence, unresolved disagreements, and reviewer confidence by dimension.
