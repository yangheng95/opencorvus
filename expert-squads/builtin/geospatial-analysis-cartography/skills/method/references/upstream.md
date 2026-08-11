# Upstream provenance and bounded adaptation

## Spatial integrity and analysis

- Repository: https://github.com/K-Dense-AI/scientific-agent-skills
- Pinned commit: d661d27ef4ddad5b9287bdd84887ace27e2320b8
- Exact paths: skills/geopandas/SKILL.md and skills/geomaster/SKILL.md
- Pinned URLs: https://github.com/K-Dense-AI/scientific-agent-skills/blob/d661d27ef4ddad5b9287bdd84887ace27e2320b8/skills/geopandas/SKILL.md and https://github.com/K-Dense-AI/scientific-agent-skills/blob/d661d27ef4ddad5b9287bdd84887ace27e2320b8/skills/geomaster/SKILL.md
- License: MIT; complete notice saved in kdense-license.txt.
- Adapted: input identity, schema/CRS/geometry checks, never guessing CRS, assigning versus transforming CRS, units, precision, antimeridian, joins/overlays, output reconciliation, raster/vector provenance.

## Cartography

- Repository: https://github.com/maplibre/maplibre-agent-skills
- Pinned commit: efacb28bae72f0b01f838179776af8b71c99a065
- Exact path: skills/maplibre-cartography/SKILL.md
- Pinned URL: https://github.com/maplibre/maplibre-agent-skills/blob/efacb28bae72f0b01f838179776af8b71c99a065/skills/maplibre-cartography/SKILL.md
- License: MIT; complete notice saved in maplibre-license.txt.
- Adapted: figure-ground, hierarchy, label priority/halo/collision, typography/script coverage, layer ordering, attribution and accessibility.

## Exclusions and primary cross-checks

Excluded: package installation, broad tool grants, Earth Engine/Planetary Computer/cloud/API/database access, secrets, automatic data acquisition, external writes, CRS guessing, destructive fixes, generic machine learning, runtime style mutation, Mapbox/vendor services, and treating example sizes/colors as universal rules.

Primary cross-checks: OGC Standards, https://www.ogc.org/standards/ ; EPSG Guidance Notes, https://epsg.org/guidance-notes.html ; MapLibre GL JS documentation, https://maplibre.org/maplibre-gl-js/docs/ .
