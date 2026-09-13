---
name: automationbench-api
description: Execute an AutomationBench business workflow through its official API-mode search, fetch, and base64 tools. Use only for a Task whose request explicitly says it is an AutomationBench trial.
---

# AutomationBench API mode

The Task is scored only from the final simulated business state. A narrative answer, repository edit, or report does not complete it.

AutomationBench initializes a seeded simulated business environment for every Task. It does not use or require real Airtable, Google, Salesforce, Slack, or other SaaS credentials. A typed 401/404 from one candidate service means that service or route is unavailable in this Task's simulated world; it is not a Host credential failure and does not prove the requested authority or records are absent from the other simulated services.

Use the project-local client with these exact commands:

```text
python3 automationbench_tool.py search "API-native keywords" --top-k 5
python3 automationbench_tool.py fetch GET "https://full.url/from/search" --params '{"key":"value"}'
python3 automationbench_tool.py fetch POST "https://full.url/from/search" --body '{"key":"value"}'
python3 automationbench_tool.py base64 "text that an endpoint explicitly requires encoded"
```

For independent operations, prefer one structured batch instead of multiple quoted shell commands:

```text
python3 automationbench_tool.py batch <<'JSON'
[
  {"command":"search","query":"service action record","top_k":5},
  {"command":"fetch","method":"GET","url":"https://full.url/from/search","params":{"key":"value"}}
]
JSON
```

`batch` accepts 1 through 20 independent `search`, read-only `fetch GET`, or `base64` operations and returns one ordered `results` array. `transport_status` and `transport_ok` describe only delivery through the local Unix bridge; the unchanged `body` is the official tool result and may contain a typed business/API error even when transport is HTTP 200. Inspect every body rather than treating transport success as operation success. A transport interruption marks the current operation `transport_outcome_unknown` and the untouched suffix `not_executed` without inventing a transport or official status. Never batch POST, PATCH, PUT, DELETE, or another mutation: execute each mutation as its own command so its receipt and outcome remain unambiguous. The bridge still executes and records every official operation separately. Keep dependent operations in later batches after the earlier result supplies their URL, identifier, or parameter.

The client path and invocation are already defined above. Do not run `ls`, `glob`, project `read`, or capability discovery merely to confirm that the client exists. Begin with the exact client command needed for endpoint discovery or execution.

`search` is an endpoint-contract directory: it tells you which URL, method, path parameters, query parameters, body fields, and response shape an API supports. It does not search the seeded business records. A zero-result `search` therefore proves only that the endpoint keywords did not match; it never proves that an email, spreadsheet, message, customer, ticket, or other business record is absent. Business existence and content are established only by calling a discovered list/get/search endpoint with `fetch`. `--top-k` accepts 1 through 20.

Use the original business request and fetched business records to decide what work is needed. Replace URL path placeholders with the exact record identifiers; query parameters belong in `--params` and request fields in `--body`. The client passes their JSON strings to the official tools. Inspect returned values and typed errors before deciding the next action.

Before the first mutation, write a compact working checklist from the original request with three columns: authoritative source, destination or action, and exact values that must survive the transfer (including every URL, identifier, date, audience, exclusion, and precedence rule). Mark each required fact found or still missing. Do not perform an irreversible mutation while a fact required by that mutation is still missing, unless an authoritative record or the original request explicitly establishes that the outcome may omit it. Independent work whose own prerequisites are complete may continue. Use this checklist to close discovery and to verify the final state. Do not replace an exact source value with a paraphrase or an invented value.

Start endpoint discovery with one focused search query that names the required services and actions together. Search again only for a capability that the first result omitted and the request or a fetched record actually requires. When the request names the authority, do not probe alternative products merely because they might contain similar information. When the authority is unnamed and a required fact remains missing, search once by the information shape and business terms (for example message, email, event, document, or record), then try the relevant returned read endpoints together and stop at the first matching authoritative record. A typed unavailable response closes only the route, resource, or capability whose absence it explicitly proves. Close an entire service only when the response explicitly establishes service-wide unavailability; unavailability does not waive a required business fact.

Route an unnamed source by the kind of record the business fact normally lives in. Recent operational instructions, approvals, links, exclusions, and warnings start with message or email search. Query communication stores with the concrete entity, event, account, or record names from the Task; operational messages may not repeat the request's abstract category label. If an abstract category query returns no matching record, make one concrete-entity query before declaring the source absent. Dates and schedules start with calendar or event records. Formal long-form policies start with document or file records. Destination identity and final state start with the destination service. This is a source-location order, not evidence authority: accept only a record whose identity and content match the request, and stop searching that fact after the first authoritative match.

Once a source-family query returns candidates whose subject, snippet, identity, or metadata matches the concrete Task entity, an original material constraint, an applicable shared policy, or an already discovered dependency, fetch only those matching candidates. Do not enumerate or fetch generic noise records to hunt for a better answer. Once a discovered list/get endpoint has returned the relevant records, do not search the endpoint directory again for that source family. For an unnamed advisory constraint that has no independent mutation field, one concrete-entity query plus one constraint-or-policy query bounds the attempted search when the relevant service is explicitly unavailable or both queries return no matching record. Record the exact checked scope and the constraint as unverifiable, then stop probing unrelated products or broad record inventories. This bounded attempt does not prove that the source is absent or waive a material fact; do not claim that the unknown constraint is satisfied.

Judge a record by its applicable content, identity, and recency rather than whether its title repeats an abstract request word such as “guidelines,” “policy,” or “instructions.” Once a current authoritative record supplies the ready-to-use content or constraints for the requested action, do not keep searching for a separately titled policy record unless the request explicitly names one. When the original request authorizes reasonable assumptions, a bounded absence of an unnamed advisory record may be reported as a limitation while the supported business action proceeds; never invent the missing rule or claim independent compliance evidence.

Each shell invocation creates a model round trip. Use the structured `batch` command for independent discovery and reads; do not concatenate multiple client commands with shell newlines. Perform the smallest mutation set after the authoritative records are complete, then batch only the exact changed-record and preservation reads needed to confirm the outcome. Never repeat broad endpoint discovery during final verification.

For independent verification, derive expectations from the original request and the same authoritative records, then compare those exact fields with the final destination. Use only query parameters declared by the discovered endpoint contract. Preserve the exact method, URL, and parameter shape of a read that already returned the relevant destination record; an empty result from a different or documented non-reflecting projection is conflicting evidence, not proof that a successful action disappeared. Verify the changed record and any material preservation constraint. Do not rediscover the whole API catalog, inspect unrelated services, or replay the mutation.

A successful response records an operation's result. Some simulated read endpoints expose seeded/query projections that do not reflect every recorded action. Keep the exact action receipt, the first positive readback contract, and any conflicting readback visible; neither the Skill nor a report declares the business goal satisfied. Resolve correctness from the actual request, relevant source records, supported API semantics, and the available observations. Never repeat a successful irreversible create. Correct an existing result only through a discovered, authorized correction or compensating operation that the interface defines for that state; never replay the original create as a repair. If no such operation exists, report the resulting discrepancy. An unknown outcome is not permission to repeat an irreversible action.

This Skill specifies the environment, tool transport, and efficient evidence loop. It does not prescribe case-specific answers, a planning graph, report artifacts, or a success verdict. Independent verification remains the selected Squad's responsibility.

The client intentionally exposes no world dump, assertions, expected answer, or scoring endpoint. Do not inspect its config or implementation as a substitute for using the official tools.
