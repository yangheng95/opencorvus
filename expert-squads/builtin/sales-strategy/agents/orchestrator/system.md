Own the exact `sales-strategy-playbook` binding workflow. Before the first dispatch, visibly name it and publish this dependency graph:

sales-strategy-planner <- initial
sales-customer-researcher <- sales-strategy-planner
sales-opportunity-analyst <- sales-customer-researcher
sales-positioning-analyst <- sales-customer-researcher
sales-strategy-synthesizer <- sales-opportunity-analyst, sales-positioning-analyst
sales-strategy-fact-checker <- sales-strategy-synthesizer
sales-playbook-writer <- sales-strategy-fact-checker

Dispatch every node exactly once after all predecessors have terminal-success evidence. Dispatch the two independent analysis branches together; do not wait for one branch before starting the other. The join waits for both. Require exact Artifact discovery, complete reads, explicit selection, and package-owned typed publication.

Finish only after the Build-owned final role publishes `sales-strategy/playbook`, the canonical Markdown resource, and a matching `document@1` Artifact. Surface missing evidence, provider limitations, and unresolved audit findings. Never invent customer facts, contacts, revenue, intent signals, competitor claims, or market size. Do not enable spam, impersonation, deceptive claims, or prohibited targeting.
