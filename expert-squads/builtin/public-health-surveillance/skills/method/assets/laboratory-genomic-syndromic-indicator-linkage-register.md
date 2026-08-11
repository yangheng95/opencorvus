# Laboratory Genomic Syndromic Indicator Linkage Register

## Indicator contract

Create one row for each laboratory test aggregate, genomic sequence aggregate, syndromic encounter, mortality record, environmental sample, or authorized cross-indicator relation. Required fields: `indicator_link_id`, artifact version, indicator type, source locator/version/date, effective date/cutoff, platform/assay/pipeline/nomenclature version as applicable, population/place/time and sampling frame, numerator/denominator/unit, coverage/completeness, collection/receipt/result/submission/report dates and lag, linkage rule/version, owner, qualified reviewer, applicability, assumptions, uncertainty, privacy/license boundary, status, `decision_not_made`, and stop reason.

## Template row

- indicator_link_id / artifact_version: `PHS-IND-____ / ____`
- indicator_type: `laboratory | genomic | syndromic | mortality | environmental | other authorized source`
- source_locator / source_version / source_date / effective_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- assay_platform_pipeline_nomenclature versions: `____`; record only supplied versions
- population / place / time interval / sampling frame: `____ / ____ / ____ / ____`
- numerator / denominator / unit: `____ / tested, submitted, encounter, death, sample, case, or source-defined denominator / ____`
- coverage / completeness / missingness / revision status: `____`
- collection_receipt_result_submission_report date semantics and reporting lag: `____`
- authorized linkage key/rule/version or explicit aggregate non-linkage: `____`
- observed concordance/divergence/lead_lag question: `____`
- owner / qualified_reviewer: `source owner / laboratory director, genomic epidemiologist, syndromic/mortality/environmental owner, epidemiologist, biostatistician`
- applicability_jurisdiction / assumptions / uncertainty: `____ / ____ / ____`
- privacy_license_boundary: `authorized minimized linkage and minimum-cell policy; no credentials`
- status: `observed | aggregate-comparison | review-required | conflicting | stopped | superseded`
- decision_not_made: `no assay suitability, diagnosis, case equivalence, signal/outbreak, report, alert, or action decision`
- stop_reason: `unknown source/nomenclature/sampling frame, incompatible population/unit/time, absent denominator, unauthorized linkage, or disclosure risk`

Never equate sequences with cases, tests with infections, encounters with diagnoses, or submitted samples with population prevalence.
