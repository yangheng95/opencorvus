# Safety Case Intake, Version, Duplicate, and Quality Ledger

## Controlled artifact header

- Artifact ID: `PV-CASE-[unique-id]`
- Artifact version: `[semantic or controlled version]`
- Provenance record: `[source inventory ID and immutable locator]`
- Source ID / locator / version / date: `[system or document ID] / [record locator] / [version] / [retrieval or receipt date with timezone]`
- Data-lock or effective date: `[ISO 8601 date/time and timezone]`
- Responsible owner: `[authorized PV case-process owner]`
- Qualified reviewer: `[case processor, MedDRA coder, safety physician, privacy reviewer as applicable]`
- Jurisdiction / applicability: `[program, product, study or jurisdiction; exclusions]`
- Privacy and license constraints: `[classification, minimization rule, reuse terms]`
- Overall uncertainty / confidence: `[unknowns, conflict level, evidence quality; never medical confidence]`
- Status / decision state: `[draft | qualified-review-required | stopped | superseded]`
- Decision explicitly not made: `No case validity, duplicate merge, coding, seriousness, severity, causality, expectedness, reportability, clock, destination, or submission decision.`
- Stop condition / reason: `[none, or precise missing authorization/provenance/version/privacy fact]`

## Case-version rows

| Row ID     | Case ID             | Version / follow-up ID | Source ID and exact locator | Source version/date | Event/receipt/follow-up date semantics | Field and observed value                     | Unit            | Dictionary/version               | Provenance state                         | Responsible owner | Qualified reviewer | Applicability | Assumption     | Uncertainty     | Status    | Decision explicitly not made | Stop reason |
| ---------- | ------------------- | ---------------------- | --------------------------- | ------------------- | -------------------------------------- | -------------------------------------------- | --------------- | -------------------------------- | ---------------------------------------- | ----------------- | ------------------ | ------------- | -------------- | --------------- | --------- | ---------------------------- | ----------- |
| `PV-C-001` | `[pseudonymous ID]` | `[initial/follow-up]`  | `[locator]`                 | `[version/date]`    | `[type/timezone]`                      | `[verbatim or supplied field; no inference]` | `[unit or N/A]` | `[name/version or not supplied]` | `[supplied/derived/conflicting/missing]` | `[owner]`         | `[reviewer]`       | `[scope]`     | `[assumption]` | `[uncertainty]` | `[state]` | `[reserved human decision]`  | `[reason]`  |

## Potential-duplicate groups

| Group ID     | Candidate case/version IDs | Match factors and source locators   | Conflict factors        | Record count / unit / denominator             | Duplicate rule source/version/date | Owner     | Reviewer     | Applicability  | Uncertainty   | Status    | Decision explicitly not made                 | Stop reason |
| ------------ | -------------------------- | ----------------------------------- | ----------------------- | --------------------------------------------- | ---------------------------------- | --------- | ------------ | -------------- | ------------- | --------- | -------------------------------------------- | ----------- |
| `PV-DUP-001` | `[IDs; do not merge]`      | `[product/event/date/source facts]` | `[mismatches/unknowns]` | `[n records / records / screened population]` | `[authorized procedure]`           | `[owner]` | `[reviewer]` | `[population]` | `[ambiguity]` | `[state]` | `No duplicate adjudication or system merge.` | `[reason]`  |

## Review notes

Preserve every superseded value and the complete follow-up chain. Direct identifiers must not be copied unless explicitly authorized and necessary. AE is not ADR; seriousness is not severity; supplied coding is not medical assessment. Counts in this ledger are report or record counts, not exposed-patient denominators or incidence. Conflicts remain open for the named qualified reviewer; the artifact must never silently choose a source.
