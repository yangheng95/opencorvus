# OPC company profile, authority, and risk-control baseline

Artifact version: `2026.08.11.1`. This template freezes the company-level identity and authority boundary before any branch runs. It is operating evidence, not an entity-formation, licensing, tax, accounting, employment, privacy, insurance, financing, or legal determination.

## Required control fields

Record `artifact_id`, `artifact_version`, `profile_id`, `profile_version`, `schema_version`, `profile_digest`, company/trading name as supplied, business model, stage, `operating_state`, evidence cutoff, IANA time zone, tzdb version, locale, fiscal boundary, functional currency, transaction currencies, exchange-rate source/time, registration and tax jurisdictions as supplied, owner identity, approval identity reference, qualified reviewer identities, applicability, assumptions, uncertainty, privacy/license boundary, status, `decision_not_made`, `outcome_unknown`, and `stop_escalation`.

## Authority matrix

For each action class record stable `action_class_id`, description, preparation owner, approval owner, qualified external reviewer when needed, required evidence, approval-reference format, reversibility, external-effect class, maximum authorized scope as supplied, reconciliation source, and stop state. Cover at least public claims, price/discount, contract/signature, payment/refund, procurement, tax filing, data export/deletion, production deployment, permissions/secrets, bulk contact, and regulatory communication.

If the same owner prepares and approves, record `self_review`; never record independent review or separation of duties. Unknown authority remains `stopped`. A package profile never grants authority by itself.

## Systems and risk boundary

List each system of record with source ID, locator/import mechanism, version, retrieval date, freshness state, reconciliation key, data class, access/authorization reference, owner, reviewer, applicable business objects, and known gaps. Record secret aliases only, never secret values. Map material operating risks to source evidence, possible consequence, current control as supplied, control owner, verification evidence, uncertainty, professional decision required, and next review.

Stop for unknown entity/jurisdiction, absent approval owner, stale critical source, conflicting systems of record, plaintext credential, ambiguous external effect, missing reconciliation path, or a request to execute an action. `decision_not_made` states that no company formation, legal/tax/accounting treatment, risk acceptance, public claim, commercial commitment, external write, payment, filing, deployment, deletion, permission, or contact decision was made.
