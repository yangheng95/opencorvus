# Laboratory Scope and Method Version Register

## Controlled artifact header

- Artifact ID: `LAB-SCOPE-[unique-id]`
- Artifact version: `[controlled version]`
- Provenance record: `[authorized document and record inventory]`
- Source ID / locator / version / date: `[scope or method source] / [exact locator] / [version] / [issue/retrieval date]`
- Data-lock / effective date: `[both dates with semantics]`
- Responsible owner: `[laboratory technical or quality owner]`
- Qualified reviewer: `[method SME, technical manager, quality manager, laboratory director/authorized signatory]`
- Jurisdiction / applicability: `[site/service/measurand/matrix/range/intended use and exclusions]`
- Value/count and unit/denominator: `[range and measurement unit; number of methods / registered methods]`
- Privacy and license constraints: `[record classification and reuse terms]`
- Uncertainty / confidence: `[scope gaps, version conflict, unverified applicability]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No method approval, fitness, decision-rule, result-release, clinical-interpretation, certification, accreditation, or conformity decision.`
- Stop condition / reason: `[missing scope/method/version/unit/authorization or precise blocker]`

## Scope and version rows

| Row ID      | Laboratory/site/service | Method ID/version | Measurand            | Matrix     | Intended use       | Range and unit       | Equipment/software version | Procedure/source locator/version/date | Effective period/data lock | Validation/verification/transfer/modification state as supplied | Owner     | Qualified reviewer | Applicability | Assumptions    | Uncertainty     | Privacy/license | Status    | Decision explicitly not made | Stop reason |
| ----------- | ----------------------- | ----------------- | -------------------- | ---------- | ------------------ | -------------------- | -------------------------- | ------------------------------------- | -------------------------- | --------------------------------------------------------------- | --------- | ------------------ | ------------- | -------------- | --------------- | --------------- | --------- | ---------------------------- | ----------- |
| `LAB-S-001` | `[scope]`               | `[ID/version]`    | `[quantity/analyte]` | `[matrix]` | `[authorized use]` | `[lower-upper unit]` | `[configuration]`          | `[exact source]`                      | `[dates]`                  | `[supplied state only]`                                         | `[owner]` | `[reviewer]`       | `[limits]`    | `[assumption]` | `[uncertainty]` | `[constraints]` | `[state]` | `[reserved decision]`        | `[reason]`  |

## Control notes

Keep validation and local verification distinct. A method version is not transferable across site, matrix, range, equipment, software, specimen type or intended use without qualified review. Preserve superseded versions and exact effective dates. Do not infer current authorization from a filename, successful run, certificate, or historic result.

## Reconciliation queue

Record scope/version conflicts, missing procedures, unit mismatches, unclear intended use, expired-looking records, and equipment configuration differences as review questions. For each, preserve provenance, source/date/version, assigned owner/reviewer, uncertainty, status, decision explicitly not made, and stop reason. This register never changes a controlled method or laboratory scope.
