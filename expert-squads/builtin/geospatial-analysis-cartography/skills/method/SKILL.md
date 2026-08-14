---
name: geospatial-analysis-cartography-method
description: Build traceable spatial data integrity, raster-vector analysis, and accessible cartographic evidence packs. Use for CRS and datum review, geometry/topology checks, spatial joins and measurements, raster alignment, uncertainty, classification, labeling, multilingual maps, and publication preparation without guessing coordinates, exposing sensitive locations, making survey or legal claims, or publishing.
---

# Geospatial Analysis and Cartography Method

## Freeze the basis

1. Record area of interest, purpose, audience, medium/scale, source IDs/versions/licenses/dates, feature keys, coordinate reference system (CRS), datum, epoch, axis and unit, raster grid/nodata/resampling, accuracy, time, privacy and qualified owners.
2. Assign stable IDs to datasets, layers, features, operations, classifications, styles, labels, sources and decisions. Preserve input hashes when available.
3. Run source/CRS integrity, raster-vector analysis, and cartographic design independently. Join only reconciled, source-addressable outputs.

## Apply the method

- Never guess CRS. Distinguish assigning CRS metadata from coordinate transformation; record transformation operation, datum/epoch, axis and unit.
- Validate IDs, null/empty/invalid geometries, dimensions, precision, antimeridian behavior and topology. Preserve originals; do not destructively auto-fix authoritative geometry.
- Select geodesic/projected/equal-area/equidistant measurement only with a fitness rationale. Reconcile join/overlay cardinality, input/output counts, unmatched keys and area/length totals.
- Align raster grid, extent, resolution, nodata, pixel interpretation, resampling and time. Preserve categorical versus continuous semantics.
- Report positional, resolution, boundary and classification uncertainty; consider spatial autocorrelation, the modifiable areal unit problem and ecological fallacy.
- Design from purpose and figure-ground hierarchy. Match data semantics to classification and symbols; specify label collision, halo, multilingual glyphs, attribution, accessible contrast/redundancy, scale and uncertainty.

## Produce evidence

Use all five assets: source/CRS/geometry ledger, operation reconciliation, raster/vector uncertainty register, cartographic specification, and publication-review pack. Every material row carries ID, unit, source/version/date, owner/reviewer, applicability, uncertainty, assumptions and decision status.

Stop on unknown CRS, invalid license, destructive-repair need, incompatible grids/time, unresolved join cardinality, sensitive derivatives, misleading classification, missing attribution or publication authority.

## Review discipline

- Preserve source bytes or hashes, schema, feature identifiers, CRS text, license and access date before proposing any transformation or repair.
- Record source and target coordinate reference systems, coordinate operation, datum/epoch, axis order and units separately; a plausible extent is not CRS evidence.
- Reconcile feature and row counts, unmatched records, one-to-many expansion, geometry dimension, area/length totals and raster cell/value summaries after every operation.
- Test material sensitivity to projection, resolution, resampling, nodata, boundary and class breaks. State positional and thematic uncertainty in the same units and scale context as the result.
- Link every visual layer, class, label and legend item to a source and operation ID. Distinguish zero, no data, suppressed and restricted values visually and semantically.
- Review multilingual glyph coverage, label collision, contrast, redundant encoding, attribution, sensitive-location disclosure and derived-data privacy before publication review.
- At the join, a visually convincing rendering never cures failed data, license or reconciliation evidence.

## Authority boundary

Do not expose sensitive locations, certify survey/cadastral/legal boundaries, provide emergency navigation, choose routes/sites autonomously, write external data/styles, destructively repair authoritative sources, or publish. Require GIS/geodesy, survey, data-owner, privacy/security, accessibility, legal and publication review.

Read [upstream provenance](references/upstream.md). Apply only the bounded concepts; the local Skill is the runtime source of truth.
