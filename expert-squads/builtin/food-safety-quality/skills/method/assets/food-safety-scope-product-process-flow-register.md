# Food Safety Scope Product Process Flow Register

## Record contract

Create immutable rows for facility, product/formulation, intended consumer/use, ingredient and allergen versions, packaging/storage/shelf life, process step, rework/waste path, outsourced step, and flow verification. Required fields: `row_id`, `artifact_version`, `facility_site`, `product_family_id`, `source_locator`, `source_version`, `source_date`, `effective_date`, `data_cutoff`, `quantity`, `unit`, `denominator`, `owner`, `qualified_reviewer`, `applicability`, `assumptions`, `uncertainty`, `privacy_license_boundary`, `status`, `decision_not_made`, and `stop_reason`.

## Template row

- row_id / artifact_version: `FSQ-SCOPE-____ / ____`
- facility_site / line / product_family / formulation_version: `____ / ____ / ____ / ____`
- intended consumers and use / packaging / storage / shelf-life source: `____ / ____ / ____ / ____`
- ingredient_specification and allergen source versions: `____ / ____`
- process_flow_id_version / step_id / previous_next links: `____ / ____ / ____`
- rework, waste, hold, outsourced, transfer, and delay path evidence: `____`
- on_site_flow_verification locator/version/date: `____ / ____ / ____`
- source_locator / source_version / source_date / effective_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- quantity / unit / denominator: `____ / kg|g|L|count|time or source-defined / per batch, lot, hour, or declared population`
- owner / qualified_reviewer: `____ / HACCP or food-safety owner plus process and allergen reviewers`
- applicability / assumptions / uncertainty: `product, process, site, jurisdiction / ____ / ____`
- privacy_license_boundary: `authorized business and food-system evidence; protected content by locator only`
- status: `draft | verified-record | review-required | conflicting | superseded | stopped`
- decision_not_made: `no safety, hazard significance, control, critical limit, process-change, or disposition decision`
- stop_reason: `unknown product/process/allergen/rework path, version, unit, authority, or applicability`

Never overwrite a superseded process or formulation. A diagram without the recorded on-site verification remains review-required. The human food-safety team controls scope acceptance.
