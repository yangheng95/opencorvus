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

`search` is an endpoint-contract directory: it tells you which URL, method, path parameters, query parameters, body fields, and response shape an API supports. It does not search the seeded business records. A zero-result `search` therefore proves only that the endpoint keywords did not match; it never proves that an email, spreadsheet, message, customer, ticket, or other business record is absent. Business existence and content are established only by calling a discovered list/get/search endpoint with `fetch`. `--top-k` accepts 1 through 20.

Method:

1. Read the benchmark request exactly. Do not ask clarifying questions.
2. Search for every endpoint contract you need using API-native operation and object terms. If the request already supplies a stable record identifier, use it directly in the discovered endpoint rather than searching for that identifier as endpoint text.
3. When the request delegates to a current process, policy, approved backlog, template, or recent history without naming its service, do one bounded authority discovery before mutation. Freeze candidates from request-named sources plus one `api_search` using the concrete target/action nouns together with `policy rules configuration spreadsheet file document email message inbox thread channel history list get search` (top 10). For a selected storage candidate whose record identifier is still missing, discover its file/list/search endpoint contract once, then call that endpoint once with `fetch` to resolve identity; do not search business identifiers through `api_search`. Read each frozen candidate at most once and do not repeat synonymous endpoint searches. Close the discovery loop when one unique source satisfies the delegated authority or the frozen candidates are exhausted. That closure ends discovery, not the Task: continue every safe effect whose target and exact value are already established by the request or a read authority. Keep only genuinely authority-dependent unknown effects unresolved; never fabricate their rule, value, identity, or routing.
4. Read the records and policy sources required to resolve identity, recency, routing, or exclusions before each authority-dependent mutation. When a dynamic authority decides actions for multiple business records, build a compact row per record with its qualifying rule/template, exclusions, exact action or notification, values/routing, preservation guard, and final readback. An unresolved authority-dependent row does not erase independent rows or request-defined effects whose exact values are already known.
5. Call only URLs returned by search and supply `params` and `body` as JSON strings. Replace every `{pathParameter}` placeholder in the returned URL with its exact identifier. Query parameters belong in `--params`; they do not substitute a path placeholder.
6. Inspect every tool response. Correct typed 4xx errors by using the declared endpoint contract; never compensate by writing unrelated records and never report a simulated app's missing connection as benchmark infrastructure failure.
7. Perform exactly the requested mutations and required notifications. Do not shotgun writes or messages.
8. Re-read the changed records when the API exposes a read endpoint. If a nominally successful write leaves the target value unchanged, first re-check the endpoint field name, path identity, range, body shape, and response contract; do not infer that the simulated platform lacks the capability merely because your attempted representation was ignored. Then stop. The benchmark host scores the world after the Task reaches a terminal decision.

The client intentionally exposes no world dump, assertions, expected answer, or scoring endpoint. Do not inspect its config or implementation as a substitute for using the official tools.
