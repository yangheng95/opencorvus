# Deep Research Agent Team

Deep Research reimplements the public research method demonstrated by Stanford Open Virtual Assistant Lab's STORM at commit `fb951af7744dab086e34962e9bc6fe878e145f83`, licensed under the MIT License. It does not embed or invoke STORM.

The package preserves STORM's useful separation of multi-perspective knowledge curation, outline generation, cited article generation, and article polish. OpenCorvus adds explicit owners, immutable evidence handoffs, and an independent citation review before publication.

## Binding workflow

`multi-perspective-report` is the sole workflow. All six nodes execute in declared order and publish `deep-research/research-charter`, `deep-research/source-dossier`, `deep-research/outline`, `deep-research/draft`, `deep-research/citation-review`, and `deep-research/report`.

Workers use `artifact_search`, exact complete `artifact_read`, and `artifact_select`; dispatch messages carry scope only. `artifact_publish` receives strict JSON text and uses `resource_set: null` unless the worker first snapshots an exact file.

Only `deep-research-report-writer` writes project files. It archives `artifacts/deep-research/report.md`, rereads it, snapshots it, publishes the structured report Artifact, and publishes a `document@1` interactive Artifact with identical Markdown.

## Quality boundary

Research distinguishes source fact, author inference, disputed claims, and open uncertainty. Primary and authoritative sources are preferred. Citation count is never a substitute for entailment, source quality, coverage, perspective diversity, or coherent synthesis.
