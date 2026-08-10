# Equity Research Agent Team

Equity Research reimplements the public research method demonstrated by FinRobot as a self-contained OpenCorvus package. It does not embed or invoke FinRobot. The original upstream methodological reference is AI4Finance Foundation's FinRobot at commit `01ed408326f1d4ec2460596dee10858faf0f69af`, licensed under Apache License 2.0. Its professional financial-analysis discipline is further grounded in Anthropic's Apache-2.0 Financial Services Skills at pinned commit `38652224c10610fa52eee2acee3ac712dcff01f2`, covering initiating coverage, discounted cash flow, comparable companies, thesis tracking, and model audit.

The package separates dated source collection, fundamental reasoning, valuation, thesis construction, independent fact checking, and report production. This preserves the useful Data → Concept → Thesis separation while making every handoff a durable OpenCorvus Artifact.

## Binding workflow

`equity-research-report` is the only workflow. The Orchestrator selects it visibly before dispatch and executes every node after its declared dependencies reach terminal success. Fundamentals and valuation are the sole parallel branches.

## Artifact contract

Projected workers publish one structured output each: `equity-research/research-charter`, `equity-research/source-dossier`, `equity-research/fundamental-analysis`, `equity-research/valuation-analysis`, `equity-research/investment-thesis`, `equity-research/audit`, and `equity-research/report`.

Workers discover predecessor evidence with `artifact_search`, completely read exact locators with `artifact_read`, and call `artifact_select` for every source that supports their output. Evidence bodies never travel through dispatch prose or visible messages. `artifact_publish` receives strict JSON text in `payload_json`; `resource_set` is `null` unless the worker first published files with `artifact_snapshot`.

Only `equity-report-writer` writes project files. It archives the canonical report at `artifacts/equity-research/report.md`, rereads it, snapshots it, publishes the structured report Artifact, and publishes a `document@1` interactive Artifact whose Markdown is exactly the reread file.

The package-local method Skill stores five dedicated assets: investment-research charter, source-normalization ledger, valuation-model checklist, thesis/catalyst/risk register, and independent investment-research audit. They are saved with exact upstream provenance and the full Apache-2.0 license rather than relying on a remote runtime.

## Scope and safety

The report is research, not personalized investment advice. Every price, multiple, period, and financial figure carries an as-of date and source. Missing evidence remains explicit; no role invents market data, fills unavailable values with estimates, or converts uncertainty into false precision.
