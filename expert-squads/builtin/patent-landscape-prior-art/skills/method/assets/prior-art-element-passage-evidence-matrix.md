# Prior Art Element and Passage Evidence Matrix

## Controlled artifact header

- Artifact ID: `PAT-EVID-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[feature/document/full-text inventory]`
- Source ID / locator / version / date: `[publication] / [paragraph/claim/page/figure/table] / [publication/full-text version] / [retrieval date]`
- Critical date / data-lock date: `[counsel-supplied critical date; evidence lock]`
- Responsible owner: `[technical evidence owner]`
- Qualified reviewer: `[licensed counsel/agent, technical SME, professional searcher, translation reviewer]`
- Jurisdiction / applicability: `[technical scope, publications, language and date boundary]`
- Privacy and license constraints: `[source quotation/reuse and confidential-feature terms]`
- Overall uncertainty / confidence: `[passage context, translation, missing element and coverage limits]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No anticipation, obviousness, novelty, patentability, invalidity, claim construction, infringement, FTO, legal-status, or design-around decision.`
- Stop condition / reason: `[missing exact passage/version/date/translation/authority]`

## Single-document evidence rows

| Evidence ID | Feature ID  | Publication ID/version | Exact paragraph/claim/page/figure/table locator | Evidence type                                  | Bounded excerpt or neutral paraphrase | Technical rationale        | Translation source/reviewer | Priority/filing/publication/critical-date facts kept separate | Family ID/rule | Value/count and unit/denominator                    | Owner     | Qualified reviewer | Applicability | Assumptions    | Uncertainty/conflict | Privacy/license | Status    | Decision explicitly not made | Stop reason |
| ----------- | ----------- | ---------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------------------- | -------------------------- | --------------------------- | ------------------------------------------------------------- | -------------- | --------------------------------------------------- | --------- | ------------------ | ------------- | -------------- | -------------------- | --------------- | --------- | ---------------------------- | ----------- |
| `PAT-E-001` | `[feature]` | `[document/version]`   | `[exact locator]`                               | `[abstract/description/claim/drawing/example]` | `[bounded evidence]`                  | `[technical mapping only]` | `[provenance]`              | `[factual dates]`                                             | `[ID/rule]`    | `[1 passage / mapped passages / reviewed passages]` | `[owner]` | `[reviewer]`       | `[scope]`     | `[assumption]` | `[uncertainty]`      | `[constraints]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Multi-reference collection — never a legal combination

| Collection ID | Feature IDs | Separate evidence IDs         | Collection purpose            | Coverage/count unit/denominator                    | Owner/reviewer | Uncertainty                     | Status    | Decision explicitly not made                                               | Stop reason |
| ------------- | ----------- | ----------------------------- | ----------------------------- | -------------------------------------------------- | -------------- | ------------------------------- | --------- | -------------------------------------------------------------------------- | ----------- |
| `PAT-COL-001` | `[IDs]`     | `[evidence IDs, no bridging]` | `[descriptive research only]` | `[n documents/families/passages with denominator]` | `[roles]`      | `[missing elements and limits]` | `[state]` | `No obviousness, combination, motivation, legal relevance, or conclusion.` | `[reason]`  |

Map only what an exact source supports. Do not bridge missing limitations, rely on an abstract as if it were full context, combine documents into a statutory theory, or infer that absence proves novelty. Route legal relevance to counsel and technical meaning to the SME.
