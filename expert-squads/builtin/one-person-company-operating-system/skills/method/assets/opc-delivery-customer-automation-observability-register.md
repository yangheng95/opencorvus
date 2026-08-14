# OPC delivery, customer, automation, and observability register

Artifact version: `2026.08.11.1`. Keep delivery/customer evidence and workflow/observability evidence in separate linked tables. Join only through stable company/profile, customer/order/project/subscription/content, workflow, event, and correlation IDs.

## Delivery and customer rows

Record `artifact_id`, `row_id`, business object ID/type, state and state-definition version, source locator/version/date, evidence cutoff, quantity/unit, requested/accepted/scheduled/in-progress/delivered/acknowledged/disputed/refunded/unknown state, promise or signed-scope source, due/acceptance window, acceptance evidence, support/backlog state, capacity formula and unit, unavailable capacity, dependency, observed external effect, owner, qualified reviewer, applicability, assumptions, uncertainty, privacy/license boundary, status, approval reference, `decision_not_made`, `outcome_unknown`, and `stop_escalation`.

Do not infer entitlement, acceptance, customer identity, delivery completion, or service level from a label. Stop when order, payment, fulfillment, entitlement, inventory, project, or customer records disagree.

## Workflow and observability rows

Record `workflow_id`, `workflow_version`, `event_id`, `correlation_id`, input version/digest, source cutoff, system-of-record and authorization reference, secret reference alias and scope without secret bytes, action class, approval reference, external effect, idempotency key/evidence, reversibility, retry policy and bounded cost as supplied, output locator, start/end/duration, cost/unit, log/metric/trace/business-event locators, result, error, reconciliation source/result, owner, reviewer, applicability, uncertainty, `decision_not_made`, `outcome_unknown`, and stop/escalation.

Default automation is observe-and-draft. External write, auto-approval, and auto-retry are false. A timeout around an external action remains `outcome_unknown`; reconcile before considering retry. The register never accesses a secret, connects to a system, deploys, enables a workflow, changes permissions, sends, publishes, fulfills, refunds, deletes, or contacts a party.
