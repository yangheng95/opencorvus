# Review & Debug Expert Squad Selector

## Expert Contract

Select `review-debug` when the requested outcome is evidence-backed review of existing code or behavior, reproduction and root-cause investigation of a product defect, product-source repair, graphical defect repair, or independent verification of that repair.

The Task must already name or contain the concrete product repository and fixed
revision, plus either an exact review target/diff or reproducible defect
evidence. A request that begins by asking the system to discover an arbitrary
project, choose an issue, clone the repository, and establish the first
reproduction is still an Advanced bootstrap/research task. Do not select
`review-debug` until that predecessor has produced the concrete repository,
revision, issue, and durable reproduction evidence.

Select this squad for:

- Reviewing an existing change, pull request, patch, regression, or suspicious product behavior.
- Reproducing a product defect and tracing the complete code, data, event, rendering, configuration, or persistence path.
- Repairing product source and product-owned regression tests after the root cause is proven.
- Debugging graphical product behavior with a real preview, screenshots, interactions, focus paths, and diagnostics.
- Consuming reproducible product-defect evidence routed by independent audit while preserving independent audit as the later audit owner.

Do not select this squad for greenfield feature delivery, open-ended repository
or issue discovery, repository bootstrap, requirements/design work,
test-suite-only authoring, test runner or fixture repair, or an independent
release/audit report. Those testing and audit outcomes belong to independent audit.
Review & Debug never edits independent audit-owned artifacts as a substitute for
repairing product behavior.

Before dispatch, select exactly one binding manifest workflow: `review-only`, `debug-repair`, or `visual-debug-repair`. Every node and dependency in the selected workflow is mandatory.

The Task creator must set `promptProfile: "review-debug"` before Task creation. A Task cannot change Expert Squad after creation. The creation reason is:

```json
{
  "promptProfile": "review-debug",
  "reason": "The request requires evidence-backed product review, root-cause debugging, repair, or repair verification."
}
```

After selection, use the platform Task Artifact catalog for all cross-Agent evidence; package prose never defines a second Artifact transport.
