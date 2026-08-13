---
name: office-delivery-method
description: Produce a new evidence-backed editable PPTX through one bounded plan, parallel source validation and delivery construction, and the qualified Work Artifact lifecycle. Do not use for DOCX, XLSX, PDF, existing-presentation editing, or multi-format packs until those profiles are qualified.
---

# Office Delivery Method

Build an office deliverable from one Planner-owned source and format contract while keeping source validation and delivery construction independently accountable.

## Establish the delivery contract

Record the audience, decision or action supported, required formats, editable-source requirement, canonical export, language, accessibility needs, source-of-truth inputs, deadline, and acceptance criteria. Mark unavailable inputs and unsupported output formats before work begins.

## Allocate independent worker branches

### Source and data branch

- Inventory every input and its authority, date, owner, and usable range.
- Normalize claims, calculations, citations, terminology, and missing values into a content model.
- Keep observed values, formulas, assumptions, and narrative interpretation distinguishable.
- Define update-sensitive values that require refresh before delivery.

### Delivery Builder branch

- Read original sources named by the plan; do not wait for a future analyst report.
- Map the audience journey and information hierarchy without rewriting source facts.
- Define page, slide, or sheet structure; navigation; table and chart semantics; density; and accessibility.
- Specify how editable sources and canonical exports remain synchronized.
- Define render checks for each requested format.
- For a new PPTX, load the platform `work-artifacts` Skill and use only its typed author, inspect, validate, render-review, and deliver lifecycle.
- Treat only the host-returned validation receipt and fresh delivery revalidation as canonical. Never manufacture substitute receipt or validation files.
- After delivery, publish one discoverable `office-delivery/final_pptx_delivery` Artifact with `artifact_publish`, using the exact host-returned attachment, receipt, render, interactive, source-evidence, chart-editability, and lifecycle values. If delivery is already valid and only publication is missing, publish those existing values without regenerating the presentation.

## Build from the bounded plan

Build directly from the Planner contract and original sources. Resolve every content slot to traceable evidence and every presentation choice to the format allocation. Preserve formulas as formulas where supported. Keep links, citations, chart source ranges, and cross-references traceable. For the currently qualified new-PPTX profile, the typed Work Artifact Harness owns authoring and canonical delivery; do not bypass it with a shell, Python, LibreOffice, or direct OfficeCLI. Other office formats remain explicitly unsupported until their own qualified profile exists.

## Review the actual deliverables

1. Open and render every applicable page, slide, and populated sheet region.
2. Check calculations, data ranges, citations, links, cross-references, overflow, clipping, hierarchy, contrast, and pagination.
3. Keep different units off the same raw-value chart axis. Use separate plots, a justified labelled secondary axis, or a clearly declared normalized comparison; keep provenance as text rather than a dummy category or series. Repair any comparison whose scale makes a meaningful series illegible.
4. Exercise navigation and interactive controls that exist in the delivered format.
5. Distinguish format-valid, content-verified, and visually accepted results.
6. Report each requested format as verified, blocked, or unverified with evidence. Never use a successful file parse as a visual acceptance claim.

## Authorship

This Skill is a clean-room OpenCorvus method written from the package requirements. It does not copy or adapt third-party office Skill text whose per-Skill licensing could not be established.
