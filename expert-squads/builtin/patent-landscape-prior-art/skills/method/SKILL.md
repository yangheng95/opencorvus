---
name: patent-landscape-prior-art-method
description: Build reproducible patent-search, family, bibliography, element-to-passage, and descriptive landscape evidence when counsel or a professional searcher needs a bounded technical review.
---

# Patent Landscape and Prior Art Method

## Authorize and freeze the scope

1. Record authorization and confidentiality classification before receiving a disclosure. Minimize confidential content and preserve handling constraints. Prefer public sources when they meet the task.
2. Assign a scope ID and freeze disclosure/source version, technical domain, jurisdictions, languages, databases and versions, search date, fields and filters, classification editions, family rule, source access/license terms, owner, and named qualified reviewers.
3. Obtain the critical date from licensed patent counsel when chronology is in scope. Never derive a legal critical date. Keep critical, priority, filing, publication, grant, register-event, retrieval, and data-lock dates separate.
4. State the decision explicitly not made. This method never decides novelty, non-obviousness, patentability, validity, enforceability, infringement, freedom to operate, claim construction, legal status, design-around, filing or prosecution strategy.

## Decompose technical features neutrally

Assign stable feature IDs to authorized source passages. Separate structure, function, relationship, sequence, constraints, materials, parameters, inputs, outputs, and technical effects. Preserve verbatim source locator and version, then add a neutral technical paraphrase. Do not label a feature legally essential or rewrite a claim.

For each feature, build search concepts: synonyms, acronyms, spelling variants, historical terms, translations with provenance, broader and narrower terms, adjacent-domain vocabulary, units and parameter expressions, and possible Cooperative Patent Classification (CPC) or International Patent Classification (IPC) areas. Treat every classification as a search hypothesis until verified in an official classification source. Keep ambiguous interpretations side by side for counsel and a technical subject-matter expert.

## Log reproducible searches

Use authorized patent-office or licensed databases within their terms. Combine routes as appropriate: exact phrase and proximity, synonyms/translations, CPC/IPC, assignee/inventor variants, backward citations, forward citations, similar documents, and non-patent literature. Do not claim that any route is exhaustive.

For every query iteration record query ID, parent query, database and version, search date/time, literal query string, fields, filters, jurisdiction/language/date scope, classification edition, raw hit count, screened count, inclusion/exclusion reasons, and export/source locator. Preserve failed and low-yield queries because they define coverage. Never silently rewrite a query after reviewing results.

Search coverage is limited by database content, indexing delay and errors, family normalization, machine translation, vocabulary, field syntax, access, and review budget. Report these limitations. Absence from results is not proof of absence, white space, or patentability.

## Normalize families and chronology

A **patent family** is a grouping produced under a declared family definition, not an intrinsic legal conclusion. Name the source and rule every time the grouping is used.

Preserve every original publication/application/grant identifier and its source. Normalize formats only with a logged rule. Build family groups under one declared definition; if different databases provide different families, retain both and identify the rule. Never merge by similarity alone.

Record priority claims, filing, publication, grant and register-event dates separately with source locators. Document and family counts are different measures and must have distinct units and denominators. Assignee and inventor names may be normalized for descriptive aggregation only; retain original names and transformation provenance. A register event is a dated source fact, not a conclusion about current ownership, enforceability, expiration, abandonment, or legal status.

## Map elements to exact evidence

For each feature/document pair record publication identifier and version, paragraph/claim/page/figure/table locator, evidence type, concise bounded excerpt or paraphrase, technical rationale, translation status, and factual date relationship. An abstract, description, claim, drawing, example, and machine translation differ in evidentiary context; label them.

Keep a single-reference mapping to one document at a time. If reviewers request a collection of references, place it in a clearly separate multi-reference section. Never bridge a missing element with speculation or present a multi-reference collection as a novelty, obviousness, or invalidity analysis. Preserve contradictory passages and missing features.

## Produce bounded descriptive landscapes

Define inclusion/exclusion rules, database coverage, date and jurisdiction span, family rule, assignee normalization, classification edition, and denominators before counting. Report both document and family counts. Stratify classifications, assignees, inventors, dates or jurisdictions only within observed coverage. Describe concentration and change as observations; do not equate low counts with opportunity or high counts with legal risk.

Use coverage and sensitivity notes: which feature concepts, classifications, languages, databases and citation routes were searched; which were unavailable; how many records were screened and excluded; and what changes occurred under alternate authorized queries or family rules. Never score patentability, infringement or freedom-to-operate risk.

## Join and control the evidence pack

Cross-link feature IDs to queries, screened documents, family rows and exact passages. Reconcile formatting only; preserve conflicting dates, family definitions, translations and interpretations. Classify branches as complete, qualified-review-required, stopped or superseded. Complete means reproducible within the declared boundary, never exhaustive or legally sufficient.

Populate exactly the five templates under `assets/`. Every material row must include artifact or row ID, artifact version, source ID/locator/version/date, critical/data-lock/search date, value/count plus unit/denominator, responsible owner, qualified reviewer, jurisdiction/applicability, assumptions, uncertainty/coverage, privacy/license, status, decision explicitly not made, and stop condition/reason.

## Stop and escalate

Stop on absent disclosure authority, unclear confidentiality, missing critical date where chronology matters, prohibited database use, unverifiable source/version, lost query string, missing exact passage, unresolved family rule, unknown translation provenance, or material identifier/date conflict. Do not bypass access controls, scrape contrary to terms, contact inventors or patent offices, draft claims, file, prosecute, publish confidential material, or make any legal conclusion.

Route legal scope and conclusions to licensed patent counsel or agent; search adequacy to a professional patent searcher; technical interpretation to a subject-matter expert; translation to a qualified reviewer; confidential records and disclosure to privacy/records owners. State that every output is bounded technical research and not legal advice.

## Clean-room provenance

Read `references/SOURCES-AND-REJECTIONS.md`. This Skill was written clean-room from general concepts in official USPTO, WIPO, and EPO public navigation and search-method materials. No text was copied from rejected Agent Skills, and no rejected package is bundled or executed.
