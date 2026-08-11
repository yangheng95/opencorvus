# Meteorological Station and Sensor Metadata Register

Use one immutable row per effective station/site/sensor configuration. This register establishes measurement provenance; it does not certify an instrument, correct an observation, or authorize operational use.

## Record contract

| Field                                         | Required content                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| artifact_id / row_id                          | Stable register ID and immutable configuration-row ID                                                                                      |
| source_locator / source_version / source_date | Catalog, certificate, station history, or operator record; edition/revision and publication date                                           |
| cutoff_or_effective_date                      | Evidence cutoff plus configuration effective-from/effective-to interval                                                                    |
| station_platform_id                           | Official station/platform identifier, network, producing organization, and site-version ID                                                 |
| location                                      | Latitude/longitude in degrees, elevation in metres, datum, site description, and documented relocation history                             |
| sensor_identity                               | Instrument/sensor ID, manufacturer/model/serial where supplied, parameter, unit, reporting resolution, and sampling/averaging interval     |
| exposure_and_vertical_context                 | Height/depth with unit, siting/exposure description, shielding or housing, and applicable owner procedure version                          |
| calibration_maintenance                       | Event IDs, date, source, traceability statement, adjustment status, and next owner-controlled review if supplied                           |
| owner / qualified_reviewer                    | Metadata custodian and qualified meteorological/instrument reviewer                                                                        |
| applicability / jurisdiction                  | Network, geography, parameter, period, and official/operator context to which the row applies                                              |
| assumptions / uncertainty                     | Unresolved site history, coordinate precision, missing calibration lineage, representativeness, and confidence                             |
| privacy_license                               | Access, personal/location sensitivity, redistribution, and upstream license constraints                                                    |
| status / decision_not_made                    | draft, source-confirmed, superseded, stopped; no certification, sensor adjustment, publication, forecast, warning, or operational decision |
| outcome_unknown / stop_escalation             | Unknown configuration outcome and exact missing evidence or qualified-review escalation                                                    |

## Controlled example

`artifact_id=MSM-REGISTER-001`; `row_id=MSM-CONFIG-0001`; `source_locator=operator station-history URI`; `source_version=rev supplied by owner`; `source_date=YYYY-MM-DD`; `cutoff_or_effective_date=cutoff YYYY-MM-DD / effective interval pending`; `station_platform_id=network and station ID pending verification`; `location=value in degrees/metres with datum pending`; `sensor_identity=parameter/model/serial/unit pending`; `exposure_and_vertical_context=height in m and procedure version pending`; `calibration_maintenance=source event IDs pending`; `owner=station metadata custodian`; `qualified_reviewer=instrument specialist`; `applicability=specified network/site/period only`; `assumptions=none accepted without evidence`; `uncertainty=site-version continuity unresolved`; `privacy_license=operator-controlled`; `status=stopped`; `decision_not_made=no certification, adjustment, forecast, warning, or operational action`; `outcome_unknown=true`; `stop_escalation=obtain authoritative station history and calibration evidence`.
