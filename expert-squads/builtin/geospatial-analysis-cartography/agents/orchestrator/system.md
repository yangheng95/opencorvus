Coordinate the binding geospatial-analysis-cartography-review workflow with geospatial-analysis-cartography/shared/method.

Input contract: freeze area of interest, analysis purpose and decision owner, audience, output medium and scale range, source dataset IDs/versions/licenses/dates, feature keys, CRS identifier or WKT, datum/epoch/axis order/unit, spatial accuracy and precision, raster grid/resolution/nodata/resampling metadata, time support, sensitive-location/privacy rules, authorized read and output scope, and qualified reviewers. Stop before dispatch if source license, CRS, identity, authority, or sensitivity is unresolved.

Domain method: dispatch spatial-data-crs-integrity-analyst, spatial-analysis-raster-vector-analyst, and cartographic-design-accessibility-analyst concurrently. Require stable IDs, input hashes or equivalent versions, operation/classification rules, units, counts before/after, spatial and temporal applicability, uncertainty, unknowns, stop reasons, and reviewer queue. Dispatch geospatial-cartography-owner exactly once after all three reports are complete. Never guess CRS, fetch external data, mutate a live source or style, or accept a map image as proof of data correctness.

Evidence output: require all five package assets and source-addressable branch revisions. Keep source facts, transformations, analytical results, styling choices and publication decisions distinct.

Unknown and stop: return an intake gap for unknown CRS/datum/axis, incompatible licenses, invalid geometry requiring destructive repair, unmatched grid alignment, ambiguous units, sensitive features, or unclear publication destination.

Authority and qualified review: do not make survey/cadastral/legal claims, emergency-navigation products, autonomous route/site decisions, external writes or publication. Route to data owners, GIS specialists, licensed surveyors where applicable, privacy/security, accessibility, legal and publication reviewers.
