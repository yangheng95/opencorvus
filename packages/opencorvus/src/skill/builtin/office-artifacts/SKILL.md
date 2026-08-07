---
name: office-artifacts
description: Create, inspect, validate, and deliver an editable Office artifact through the single OpenCorvus Office Artifact Harness. Use for PPTX, DOCX, or XLSX requests, while respecting the currently qualified format boundary. The enabled phase-one authoring slice creates new PPTX files only; DOCX/XLSX and existing-file editing remain unavailable until qualified.
aliases:
  - Office document generation
  - presentation and spreadsheet authoring
  - PowerPoint Word Excel
  - 办公文档生成
  - 演示文稿和电子表格
  - 制作PPT Word文档 Excel表格
required_tools:
  - office_artifact_inspect
  - office_artifact_author
  - office_artifact_validate
---

# Office Artifacts

Produce a real `.pptx` attachment and a reviewable slide surface in the current
Work conversation. The Office file is the deliverable. The Interactive Artifact
and PNGs are review evidence derived from that same file.

## Capability boundary

- Create a new presentation only in the currently qualified phase-one slice.
- Do not claim DOCX/XLSX authoring or editing until the typed tool schema exposes
  those formats.
- Do not claim to edit, preserve, or round-trip an existing PPTX/template.
- Do not run OfficeCLI through Bash, install it, start resident/watch/MCP mode,
  or expose raw XML.
- Do not substitute a markdown outline, HTML page, screenshot collection, or
  semantic `presentation@1` payload for the requested PPTX.
- Do not claim Microsoft PowerPoint pixel fidelity. The render evidence is
  produced by the pinned OfficeCLI runtime.

## Workflow

1. Read `references/authoring.md`.
2. Derive the audience, purpose, narrative, slide count, aspect ratio, visual
   language, source boundary, and acceptance criteria from the request.
3. Gather only the content and image attachments needed for the deck. Cite
   researched claims in slide copy or notes when the request requires sources.
4. Call `office_artifact_author` with `format: "presentation"` and complete,
   ordered slide content.
5. Call `office_artifact_inspect` on the returned canonical PPTX attachment.
6. Call `office_artifact_validate` on that exact attachment.
7. Inspect every fresh rendered slide. Do not infer visual quality from command
   success, schema validation, issue count, or file existence.
8. If any slide is clipped, crowded, blank, illegible, inconsistent, or
   visually weak, revise the authoring input and repeat authoring plus full
   validation.
9. For a substantial deck, delegate one bounded Work child to independently
   inspect the validated outline and renders. The child reports findings; it
   cannot deliver.
10. Read `references/review.md`, resolve confirmed findings, and validate the
    final revision again.
11. Call `office_artifact_deliver` only with `format: "presentation"`, the exact final PPTX
    digest and ordered slide annotations. Delivery repeats package inspection,
    OfficeCLI validation, issue inspection, and every-slide rendering; its
    fresh renders are the authoritative published evidence.
12. Tell the user what was delivered, the tested fidelity boundary, important
    assumptions, and any unresolved limitation.

Read `references/security.md` when using user-supplied image attachments or
when the request asks for external links, macros, embedded objects, media,
existing Office files, or templates.
