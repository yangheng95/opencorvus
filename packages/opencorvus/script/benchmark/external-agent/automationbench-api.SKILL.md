---
name: automationbench-api
description: Execute an AutomationBench business workflow through its official API-mode search, fetch, and base64 tools. Use only for a Task whose request explicitly says it is an AutomationBench trial.
---

# AutomationBench API mode

The Task is scored only from the final simulated business state. A narrative answer, repository edit, or report does not complete it.

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
3. Read the records and policy sources required to resolve identity, recency, routing, or exclusions before mutating state.
4. Call only URLs returned by search and supply `params` and `body` as JSON strings. Replace every `{pathParameter}` placeholder in the returned URL with its exact identifier. Query parameters belong in `--params`; they do not substitute a path placeholder.
5. Inspect every tool response. Correct typed 4xx errors by using the declared endpoint contract; never compensate by writing unrelated records.
6. Perform exactly the requested mutations and required notifications. Do not shotgun writes or messages.
7. Re-read the changed records when the API exposes a read endpoint, then stop. The benchmark host scores the world after the Task reaches a terminal decision.

The client intentionally exposes no world dump, assertions, expected answer, or scoring endpoint. Do not inspect its config or implementation as a substitute for using the official tools.
