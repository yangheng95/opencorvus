---
name: mining-resource-operations-method
description: Evidence-first method for bounded mining operational reviews spanning geological quality assurance and quality control (QA/QC), resource assumptions, mine and grade-control reconciliation, metallurgical accounting, water-tailings dependencies, fleet-maintenance exposure, and critical-control verification. Use when preparing a multidisciplinary review pack without making Resource or Reserve, disclosure, operational, safety, environmental, legal, or investment decisions.
---

# Mining Resource Operations Method

## Freeze the evidence basis

Record the site, commodity, orebody or operating boundary, model and plan versions, reconciliation period, data cut-off time and timezone, accountable owner, intended decision, reporting code if relevant, units, coordinate reference system, moisture basis, density basis and every measurement reference point. Preserve source identifiers, versions, timestamps, responsible functions and transformation lineage. Never convert an unknown basis by assumption.

## Keep independent branches

1. Geological evidence applies quality assurance and quality control (QA/QC) to sampling representativeness, chain of custody, assay batches, standards/blanks/duplicates, survey, density, domaining, estimation inputs, validation and modifying-assumption provenance. Report exceptions; do not classify a Mineral Resource or Reserve.
2. Mining reconciliation aligns model, plan, grade-control, surveyed movement, stockpile opening/receipts/issues/closing and plant-feed records. Compare only like periods, units, dry/wet bases and spatial or measurement boundaries. Preserve both numerator and denominator behind each variance.
3. Processing evidence declares the accounting boundary and tests feed contained metal against product, tailings or other losses and inventory change. Calculate recovery only on the same mass, assay, period and reference-point basis. Keep water inflows, outflows and storage change explicit; link tailings dependencies without judging facility safety.
4. Fleet and control evidence separates availability from utilization, identifies downtime classification and maintenance backlog basis, and traces each material unwanted event to a named critical control, performance requirement, verification method, verifier, evidence date and exception owner.

## Join without false closure

Use the five assets as the canonical evidence tables. Assign a stable row ID, source/version/date, owner/reviewer, applicability, uncertainty and status. The join owner cross-links contradictions and dependencies, records unresolved differences and routes them to a named qualified reviewer. A missing, stale, incomparable or unauthorized input stays open; it must never become an implied zero, approval or compliant status.

## Stop and authority boundaries

Stop when units, time windows, dry/wet bases, density bases, coordinates, stockpile identities, accounting boundaries or measurement points are incompatible; when source lineage is absent; or when a task would require changing live operations. This method cannot classify or sign Resources or Reserves, select cut-off grades, approve economic extraction, publish technical disclosure, authorize mine plans, blasts, ground support, tailings changes, equipment dispatch, work clearance or environmental status, certify safety or compliance, provide legal advice, or recommend an investment. Route those decisions to the authorized Qualified Person or Competent Person and the appropriate site geology, survey, planning, metallurgy, metallurgical-accounting, geotechnical, Tailings Engineer of Record, health-safety-environment, maintenance, finance, legal and site-management functions.

See `references/source-provenance.md` for the clean-room source and exclusion record. Use the five files in `assets/` as governed output schemas.
