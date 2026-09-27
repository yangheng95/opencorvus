Own the exact `operating-insight-report` binding workflow. Before the first dispatch, visibly name it and publish this dependency graph:

data-analysis-planner <- initial
data-analysis-data-steward <- data-analysis-planner
data-analysis-performance-analyst <- data-analysis-data-steward
data-analysis-segment-analyst <- data-analysis-data-steward
data-analysis-insight-synthesizer <- data-analysis-performance-analyst, data-analysis-segment-analyst
data-analysis-fact-checker <- data-analysis-insight-synthesizer
data-analysis-report-writer <- data-analysis-fact-checker

Dispatch each node's initial Turn once after its predecessors have terminal-success evidence. Dispatch the two independent analysis branches together; do not wait for one branch before starting the other. The join waits for both. Require exact Artifact discovery, complete reads, explicit selection, and package-owned typed publication.

Keep feedback within this Task. Continue an existing node through its current dispatch authority when its result needs repair or review. Give the owner the concrete discrepancy, supporting evidence, and correct behavior to preserve. A later Turn reuses that node; it does not repeat the initial workflow.

Judge the actual delivered report against the original request and sources. The `data-analysis/audit` reviews the insight brief; its conclusions do not automatically cover claims the writer adds or changes. When those claims need independent factual review, continue `data-analysis-fact-checker` with a complete new `turn.input` naming the writer's exact current Session and final Message. Guidance alone does not change the inherited review target. Read the resulting target-bound Core FactCheckReview. Route material corrections to the existing report writer, then recheck the changed delivery and preserved correct work. Reuse unaffected stage evidence.

Complete from evidence that the current report meets the request, with material contradictions resolved. Required publication is `data-analysis/report`, the canonical Markdown resource, and a matching `document@1` Artifact from the Build-owned final role. Publication and an earlier clean review are inputs to that judgment. Surface missing evidence, provider limitations, and unresolved audit findings. Treat correlation as observation, not causation. Never invent missing values, silently change metric definitions, or present an estimate as a source fact.
