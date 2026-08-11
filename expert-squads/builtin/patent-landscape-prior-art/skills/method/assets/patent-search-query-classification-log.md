# Patent Search Query and Classification Log

## Controlled artifact header

- Artifact ID: `PAT-QUERY-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[database session/export inventory]`
- Source ID / locator / version / date: `[database] / [saved search/export locator] / [interface/index/classification version] / [search date/time]`
- Critical date / data-lock date: `[counsel-supplied critical date; search lock]`
- Responsible owner: `[professional search owner]`
- Qualified reviewer: `[professional searcher, counsel/agent, technical SME, translation reviewer]`
- Jurisdiction / applicability: `[databases, jurisdictions, languages, fields, date scope]`
- Privacy and license constraints: `[database terms, export and confidential-query constraints]`
- Overall uncertainty / confidence: `[index, language, syntax, coverage and budget limitations]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No exhaustive-search, novelty, non-obviousness, patentability, validity, infringement, FTO, white-space, legal-status, or strategy decision.`
- Stop condition / reason: `[missing access terms/query/source version/critical-date responsibility/authorization]`

## Query iteration rows

| Query ID / parent ID   | Feature/concept IDs | Database and version | Search date/time | Literal query string       | Fields/filters     | Jurisdiction/language/date scope | CPC/IPC edition and codes | Assignee/inventor/citation/NPL route | Raw hits / unit / denominator   | Screened count | Included/excluded counts and reasons | Saved search/export locator | Owner     | Qualified reviewer | Applicability | Assumptions    | Uncertainty/coverage | Privacy/license | Status    | Decision explicitly not made | Stop reason |
| ---------------------- | ------------------- | -------------------- | ---------------- | -------------------------- | ------------------ | -------------------------------- | ------------------------- | ------------------------------------ | ------------------------------- | -------------: | -----------------------------------: | --------------------------- | --------- | ------------------ | ------------- | -------------- | -------------------- | --------------- | --------- | ---------------------------- | ----------- |
| `PAT-Q-001 / [parent]` | `[IDs]`             | `[database/version]` | `[timestamp]`    | `[exact unmodified query]` | `[fields/filters]` | `[scope]`                        | `[edition/codes]`         | `[route]`                            | `[n documents / returned hits]` |          `[n]` |         `[counts and coded reasons]` | `[locator]`                 | `[owner]` | `[reviewer]`       | `[scope]`     | `[assumption]` | `[limitations]`      | `[constraints]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Coverage controls

Preserve successful, failed and low-yield queries and their lineage. Record keyword, synonym, translation, classification, assignee/inventor, backward/forward citation, similar-document and non-patent literature routes as separate iterations. Never silently rewrite a query or omit exclusions. Coverage is limited by database contents, indexing, syntax, language, family normalization, access and review budget; absence from results is not absence of prior art or proof of white space.

## Stop and route

Stop rather than bypass access controls or database terms. Route syntax and coverage to a professional searcher, chronology/legal relevance to counsel, technical vocabulary to the SME, and translation to a qualified language reviewer. No log row authorizes scraping, office contact, filing, or a legal conclusion.
