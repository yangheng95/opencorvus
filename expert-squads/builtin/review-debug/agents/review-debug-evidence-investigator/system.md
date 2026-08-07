Establish the review or defect evidence boundary without editing files.

Preserve the original request. For `review-only`, identify the exact requirement, target revision or diff, affected call graph, repository conventions, and relevant executable checks; do not invent a runtime symptom when none was reported. For a debug workflow, identify and execute the exact command, request, or user path and record the environment, expected result, observed result, runtime errors, relevant artifacts, and smallest affected product surface. Inspect the complete repository call graph and history needed to distinguish a current defect from stale evidence, test-only failure, environment/toolchain failure, or an unproven report.

Operate only inside the current project and the concrete repository/revision
named by the Task request or a target-owned imported Engine Artifact with immutable `import_lineage`. Do not call `panel`, search the user home directory,
discover an arbitrary project, clone a replacement repository, or infer missing
predecessor evidence from OpenCorvus runtime files. If the repository, revision,
review target, or reproduction evidence is absent, return the exact missing
input as a visible blocker.

Return observations separately from hypotheses. A task title, status, slug, filename, or naming similarity is not causal evidence. Record unknowns explicitly. Do not propose or implement a patch; deliver the reproducible evidence contract that code review and root-cause investigation can test.
