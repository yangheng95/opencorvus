# Cargo Document, Safety-status and Custody Register

Use this register to reconcile cargo identity and document/status evidence without changing a record or making a legal, safety, customs, security or release decision. One `CDS-###` record describes one cargo-unit comparison, discrepancy, workflow status or custody handoff.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Mandatory fields

- **record_id and keys:** vessel call, voyage, booking, bill of lading, manifest, shipment, cargo unit/container, seal and package IDs within authorization.
- **description / quantity / mass / units:** retain commercial declaration, regulatory declaration and physical observation as separate values.
- **VGM evidence:** Verified Gross Mass value/unit, method/status as supplied, responsible party, document locator, issue time and revision. Do not approve it.
- **dangerous-goods evidence:** declaration/classification status as issued, source authority/version/time and missing information. Do not classify or determine compatibility/stowage.
- **workflow status:** FAL, carrier, port-community, customs, border, security, hold/release code, issuing authority and timestamp. An empty field or cargo movement is not proof of release.
- **custody event:** from-party, to-party, location, timestamp/time zone, evidence, seal state and discrepancy. Do not infer title or lawful possession.
- **source_location / source_authority / version / effective_date / observation_date:** exact locator and chronology.
- **owner / qualified_reviewer:** documentation owner plus dangerous-goods, customs/security, carrier/master or legal/privacy review as applicable.
- **applicability / uncertainty / status:** cargo, call, jurisdiction, document revision, identity/unit gap, privacy/commercial boundary and current workflow state.
- **decision_not_made:** no VGM acceptance, dangerous-goods classification, stowage, hold/release, customs/security clearance, title or compliance decision.
- **stop_or_escalation:** unmatched identity, superseded document, missing authority, broken-seal evidence, active safety/security concern or unauthorized data and named recipient.

## CDS-001 — Baseline pending

- Call/voyage/document/cargo-unit keys: unknown
- Description/quantity/mass/units: unknown
- VGM source/method/status: unknown
- Dangerous-goods declaration/classification status: unknown
- FAL/customs/security/carrier workflow status: unknown
- Custody events and seal evidence: unknown
- Source/authority/version/effective/observation dates: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty: not assessable
- Status: draft
- Decision not made: no cargo, document, classification, custody, clearance or release decision
- Stop or escalation: authorized documentation and public-authority owners must establish identities and current statuses

Preserve later corrections as versioned events; do not overwrite the prior manifest or custody chronology. Protect personal and commercially sensitive data. Link to `VCB-###` and `TYG-###` only with stable call, operation, cargo-unit and event keys.
