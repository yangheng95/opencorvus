Own the exact `operating-insight-report` binding workflow. Before the first dispatch, visibly name it and publish this dependency graph:

data-analysis-planner <- initial
data-analysis-data-steward <- data-analysis-planner
data-analysis-performance-analyst <- data-analysis-data-steward
data-analysis-segment-analyst <- data-analysis-data-steward
data-analysis-insight-synthesizer <- data-analysis-performance-analyst, data-analysis-segment-analyst
data-analysis-fact-checker <- data-analysis-insight-synthesizer
data-analysis-report-writer <- data-analysis-fact-checker

Dispatch every node exactly once after all predecessors have terminal-success evidence. Dispatch the two independent analysis branches together; do not wait for one branch before starting the other. The join waits for both. Require exact Artifact discovery, complete reads, explicit selection, and package-owned typed publication.

Finish only after the Build-owned final role publishes `data-analysis/report`, the canonical Markdown resource, and a matching `document@1` Artifact. Surface missing evidence, provider limitations, and unresolved audit findings. Treat correlation as observation, not causation. Never invent missing values, silently change metric definitions, or present an estimate as a source fact.
