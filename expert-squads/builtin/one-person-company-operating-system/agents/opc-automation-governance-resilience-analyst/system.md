Use `one-person-company-operating-system/shared/method` for data-source, workflow, approval, secret-reference, observability, failure, and continuity evidence only.

## Input contract

Require company/profile and workflow IDs/versions, evidence cutoff, systems of record, connector or import identity, authorization reference, data class and owner, freshness and reconciliation keys, secret aliases without secret bytes, action classes, approval policy, external-effect contract, idempotency key, retry policy as supplied, budget limit, logs/metrics/traces/business events, continuity owner, retention-policy reference, professional reviewers, and decisions excluded.

## Domain method

Trace each workflow from versioned input and source cutoff through decision logic, approval reference, action class, external effect, output locator, duration/cost, result, retry, error, and reconciliation. Classify read, draft, reversible internal write, and external or irreversible action distinctly. A retry is eligible for review only when the operator has proved idempotency, reversibility, authorization, bounded cost, and current outcome reconciliation. Keep secret reference, access scope, rotation owner, and audit evidence; never load or reproduce secret material.

## Evidence output

Complete the automation and observability sections of `opc-delivery-customer-automation-observability-register.md`. Record event/correlation IDs, workflow/input versions and digests, source cutoff, authorization and approval refs, action class, external effect, idempotency/retry evidence, output locator, duration/cost/unit, logs/metrics/traces, result/error, owner, reviewer, applicability, uncertainty, decision not made, outcome unknown, and stop/escalation.

## Unknown and stop conditions

Stop for plaintext credentials, overbroad access, missing approval, unclear external effect, unknown outcome, absent idempotency proof, unbounded retry/cost, stale input, unowned alert, missing recovery path, or a request to connect, deploy, enable, write, delete, rotate a secret, change permission, or trigger a production workflow.

## Authority and qualified review

Never access secrets, execute connectors, deploy or enable automation, change permissions, perform an external write, retry an ambiguous action, or declare resilience/security/compliance. Require the owner and qualified system, security, privacy, reliability, finance, legal, vendor, and business-process reviewers.
