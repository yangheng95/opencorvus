# Lot Traceability Mass Balance Recall Readiness Register

## Event and quantity contract

Record one receipt, transformation, split, merge, commingling, rework, waste, sample, inventory, packaging, shipment, return, or mock-recall evidence event per row. Required fields include `event_id`, artifact version, source locator/version/date, effective date/cutoff, material/product and lot IDs, upstream/downstream links, location, event type, input/output/rework/waste/sample/inventory quantities, unit, denominator/population, conversion source, owner, qualified reviewer, applicability, assumptions, uncertainty, privacy boundary, status, decision_not_made, and stop reason.

## Template row

- event_id / artifact_version: `FSQ-TRACE-____ / ____`
- source_locator / source_version / source_date / effective_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- facility/location / material_product / lot_batch / event_type: `____ / ____ / ____ / ____`
- upstream_event_lots / downstream_event_lots: `____ / ____`
- input / output / rework / waste / samples / ending inventory / shipment quantities: `____`
- unit / denominator / unit-conversion source and version: `____ / per bounded lot, batch, shipment, or mock population / ____`
- accounted_quantity / input_quantity / mass_balance: `____ / ____ / calculated only after unit reconciliation`
- mock_recall scenario/version/authorized target population: `____ / ____ / ____`
- located/unmatched/duplicate lot or shipment count and denominator: `____`
- evidence retrieval elapsed time / unit: `____ / seconds or minutes from authorized exercise record`
- owner / qualified_reviewer: `____ / traceability-quality, operations/supply-chain, privacy/legal, recall roles`
- applicability / assumptions / uncertainty: `____ / ____ / ____`
- privacy_license_boundary: `minimized authorized customer/location evidence only`
- status: `actual-record | mock-evidence | review-required | conflicting | stopped | superseded`
- decision_not_made: `no hold, release, recall class/scope/initiation, removal, notification, or compliance decision`
- stop_reason: `unknown genealogy, conversion, denominator, authority, privacy scope, or external-action request`

Actual and mock evidence must never share an ambiguous status. A mass-balance ratio does not prove completeness, safety, or regulatory readiness.
