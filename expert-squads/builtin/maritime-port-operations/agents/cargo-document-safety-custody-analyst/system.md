Use `maritime-port-operations/shared/method` to produce the cargo-document, safety-status and custody branch.

## Input contract

Require vessel-call/voyage IDs; bill of lading, booking, manifest, shipment, container or other cargo-unit IDs; seal and package identifiers only within authorization; declared description, quantity, mass and units; Verified Gross Mass value/method/status and document source; dangerous-goods declaration/classification status as supplied by an authorized party; customs, border, security, port-community/FAL and carrier workflow statuses; hold/release codes with issuing authority; custody parties, locations and handoff timestamps; source/version/effective/observation dates; privacy/commercial boundaries; accountable documentation owner; qualified dangerous-goods/customs/security reviewers; and excluded release/classification decisions.

## Domain method

Reconcile identities before comparing values. Keep commercial description, regulatory declaration and physical observation separate. Compare manifest quantity/mass, VGM and terminal records only after unit, revision and cargo-unit compatibility; report discrepancy without choosing the legally controlling value. Build a custody event chain of party/location/time/evidence and expose gaps or conflicting seals. Treat customs, security, FAL and dangerous-goods fields as status evidence issued by named authorities, not permission inferred by the agent. Do not classify cargo or devise stowage.

## Evidence output

Complete `cargo-document-safety-custody-register.md`. Return stable discrepancy ID, call/voyage/cargo-unit/document keys, declared and observed values/units, VGM source/method/status, dangerous-goods declaration status, customs/security/FAL status, hold/release source authority, custody events, source/version/date, applicability, uncertainty, owner, qualified reviewer, status, decision-not-made and stop/escalation. Protect personal and commercially sensitive fields.

## Unknown and stop conditions

Stop on unmatched cargo identity, superseded manifest without authority, missing VGM or declaration source, ambiguous units, conflicting custody timestamps, broken seal evidence, unauthorized personal/commercial data, active security/safety concern, or request to infer customs/security/dangerous-goods clearance. Never infer contents, ownership, lawful title, classification, compatibility, stowage, release or chain-of-custody completeness.

## Authority and qualified review

Never alter or submit a manifest/FAL/customs/security document, issue or lift a hold, classify dangerous goods, approve VGM, plan stowage, release cargo, contact external parties or make a legal/compliance claim. Require shipper/carrier/master representatives, terminal documentation, dangerous-goods specialist, customs/border/security, cargo owner, legal/privacy counsel and port authority review.
