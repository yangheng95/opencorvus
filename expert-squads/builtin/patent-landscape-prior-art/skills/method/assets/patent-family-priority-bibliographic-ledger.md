# Patent Family, Priority, and Bibliographic Ledger

## Controlled artifact header

- Artifact ID: `PAT-FAM-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[publication/register/family-source inventory]`
- Source ID / locator / version / date: `[database/register] / [record locator] / [version] / [retrieval date]`
- Critical date / data-lock date: `[counsel-supplied critical date; retrieval lock]`
- Responsible owner: `[bibliographic research owner]`
- Qualified reviewer: `[professional searcher, licensed counsel/agent, records reviewer]`
- Jurisdiction / applicability: `[family rule, offices, document types, period]`
- Privacy and license constraints: `[source/export terms]`
- Overall uncertainty / confidence: `[family-rule conflicts, incomplete register coverage, name normalization]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No priority entitlement, ownership, legal status, enforceability, expiration, abandonment, validity, infringement, FTO, or patentability decision.`
- Stop condition / reason: `[missing identifier/source/date/family rule/access authority]`

## Document and family rows

| Row ID      | Original publication/application/grant ID | Normalized ID and rule/version  | Document type/jurisdiction | Title     | Inventor names original/normalized | Applicant/assignee original/normalized and provenance | Family ID and declared family rule | Priority claims and sources   | Filing date | Publication date | Grant date      | Register event/date/source/retrieval time | Document count/unit/denominator        | Family count/unit/denominator                 | Owner     | Qualified reviewer | Applicability | Assumptions    | Uncertainty      | Privacy/license | Status    | Decision explicitly not made | Stop reason |
| ----------- | ----------------------------------------- | ------------------------------- | -------------------------- | --------- | ---------------------------------- | ----------------------------------------------------- | ---------------------------------- | ----------------------------- | ----------- | ---------------- | --------------- | ----------------------------------------- | -------------------------------------- | --------------------------------------------- | --------- | ------------------ | ------------- | -------------- | ---------------- | --------------- | --------- | ---------------------------- | ----------- |
| `PAT-B-001` | `[identifier exactly as source]`          | `[normalized with logged rule]` | `[type/office]`            | `[title]` | `[names and mapping]`              | `[names/history mapping]`                             | `[ID/rule]`                        | `[claims with exact locator]` | `[date]`    | `[date]`         | `[date or N/A]` | `[factual event only]`                    | `[1 / documents / screened documents]` | `[1 / families / declared-family population]` | `[owner]` | `[reviewer]`       | `[scope]`     | `[assumption]` | `[conflict/gap]` | `[constraints]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Normalization controls

Retain every original identifier and name. Apply only logged formatting and name-normalization rules. Family membership requires the declared source and family definition; conflicting database families remain separate alternatives. Priority, filing, publication, grant, register-event, retrieval and critical dates are never collapsed. A register event is a sourced factual record, not a conclusion about live legal status or ownership.

## Review queue

Record conflicting priority claims, missing publications, ambiguous continuities, family-rule differences, name-history uncertainty and register gaps with source/version/date, unit/denominator, owner, qualified reviewer, applicability, uncertainty, status, decision explicitly not made, and stop reason. Counsel owns all legal interpretations.
