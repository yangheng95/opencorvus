---
name: review-debug-workflow
description: Review and repair existing product behavior through reproducible evidence, a proven causal chain, root repair, regression coverage, and independent verification.
---

# Review & Debug Workflow

Start from evidence, not a guessed patch. Preserve the original report and obtain the exact reproduction, expected behavior, runtime/tool output, affected files and call graph. Separate observation from inference.

Review and root-cause investigation are independent read-only responsibilities. A valid causal chain is observable symptom → direct trigger → product data/control/rendering path → underlying design or implementation fault → explanation of why earlier paths did not cure it. Names and status labels are clues only.

Only `review-debug-repair-implementer` mutates product source. The repair replaces the faulty authority, deletes the superseded path, and adds regression coverage for the original defect. Do not add fallbacks, compatibility branches, host gates, keyword routers, or parallel sources.

The final reviewer reruns the original reproduction and focused checks against the final diff. Graphical scope also requires fresh post-repair browser screenshots and interactions; pre-repair screenshots cannot prove the repair.

independent audit is downstream audit ownership. Route repaired-product and regression evidence to a separate fixed-profile independent audit Task only when an independent test or release judgment is requested.
