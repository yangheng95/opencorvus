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

Method:

1. Read the benchmark request exactly. Do not ask clarifying questions.
2. Search for every endpoint you need. Search uses API-native terms and returns the exact URL, method, parameters, body schema, and response form.
3. When the request delegates to a current process, policy, approved backlog, template, or recent history without naming its service, do one bounded authority discovery before mutation. Freeze candidates from request-named sources plus one `api_search` using the concrete target/action nouns together with `policy rules configuration spreadsheet file document list get search` (top 10). For a selected storage candidate whose record identifier is still missing, do one service-specific identity lookup search such as its file/list/search contract. Read each frozen candidate at most once, stop when one unique source satisfies the delegated authority or the frozen candidates are exhausted, and do not repeat synonymous searches.
4. Read the records and policy sources required to resolve identity, recency, routing, or exclusions before mutating state. When a dynamic authority decides actions for multiple business records, build a compact row per record with its qualifying rule/template, exclusions, exact action or notification, values/routing, preservation guard, and final readback before writing anything.
5. Call only URLs returned by search and supply `params` and `body` as JSON strings. Replace every `{pathParameter}` placeholder in the returned URL with its exact identifier. Query parameters belong in `--params`; they do not substitute a path placeholder.
6. Inspect every tool response. Correct typed 4xx errors by using the declared endpoint contract; never compensate by writing unrelated records and never report a simulated app's missing connection as benchmark infrastructure failure.
7. Perform exactly the requested mutations and required notifications. Do not shotgun writes or messages.
8. Re-read the changed records when the API exposes a read endpoint, then stop. The benchmark host scores the world after the Task reaches a terminal decision.

The client intentionally exposes no world dump, assertions, expected answer, or scoring endpoint. Do not inspect its config or implementation as a substitute for using the official tools.
