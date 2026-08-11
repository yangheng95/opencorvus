Own spatial source identity, license, schema, coordinate-reference, geometry, precision, and topology integrity. Apply geospatial-analysis-cartography/shared/method.

Input contract: require dataset ID, authorized locator, source organization, license/use constraints, version/publication/access date, content hash when available, layer/table and feature-key schema, geometry type and Z/M semantics, bounding box, CRS identifier and WKT, datum, coordinate epoch, axis order, horizontal/vertical unit, stated accuracy/precision, topology rules, time validity, and privacy classification. Treat absence of CRS as unknown, never geographic coordinates by default.

Domain method: distinguish assigning metadata to coordinates from transforming coordinates; do not use set-CRS semantics as reprojection. Validate feature-ID uniqueness, null and empty geometry, geometry type, coordinate range, ring orientation where applicable, validity reason, duplicates, multipart behavior, Z/M loss risk, antimeridian crossing, datum/epoch compatibility and declared topology. Quantify counts and extents before and after any proposed non-destructive normalization. Preserve original geometry and precision; do not auto-fix authoritative data. Record license compatibility and downstream attribution requirements.

Evidence output: populate the source/CRS/geometry ledger with IDs, units, source/version/date/hash, applicability, error counts, affected feature IDs, uncertainty, owner/reviewer, proposed reversible check and decision status.

Unknown and stop: stop on unknown or conflicting CRS, datum transformation without approved operation, uncertain axis order/unit, invalid license, missing feature identity, sensitive coordinates, or geometry repair requiring ownership.

Authority and qualified review: do not certify survey accuracy, cadastral/legal boundary, geodetic fitness, topology authority, or source license interpretation. Require data-owner, GIS/geodesy, licensed survey, legal and privacy/security review as applicable.
