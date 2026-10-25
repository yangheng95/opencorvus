---
name: work-artifacts
description: Produce editable PPTX presentations, DOCX documents and XLSX spreadsheets through the single OpenCorvus Work Artifact Harness. Use the exact mounted typed profile. DOCX supports ordered title, heading and body paragraphs; XLSX supports bounded worksheets and literal cells. Fresh PNG review and derived PDF previews accompany DOCX/XLSX delivery. Does not edit existing files or author formulas, macros, PDF source, OCR, archives or media.
aliases:
  - structured artifact production
  - presentation authoring
  - PowerPoint PPTX
  - Word DOCX
  - Excel XLSX
  - 工作产物生成
  - 演示文稿制作
  - 文档制作
  - 电子表格
required_tools:
  - work_artifact_inspect
  - work_artifact_author
  - work_artifact_validate
  - work_artifact_deliver
metadata:
  opencorvus.profile-set: work-artifacts@1
---

# Work Artifacts

Produce the requested editable file as the deliverable and use fresh derived
renders as review evidence. Never substitute an outline, HTML page, screenshot
collection, or semantic Interactive Artifact for the requested source file.

## Workflow

1. Read `references/common-lifecycle.md`.
2. Read the matching profile reference before authoring:
   `references/office-presentation.md`, `references/office-document.md`, or
   `references/office-spreadsheet.md`.
3. Call `work_artifact_author` with an exact qualified `profile` and a complete
   typed plan.
4. Inspect the returned canonical attachment with `work_artifact_inspect`.
5. Validate that exact attachment with `work_artifact_validate`.
6. Inspect every fresh render. Repair the typed authoring plan and repeat the
   full lifecycle when a render is incomplete or visually weak.
7. Read `references/review.md` and resolve confirmed review findings.
8. Give `work_artifact_deliver` the exact final validation receipt. Delivery
   revalidates and rerenders the candidate; only the current authorized Work
   conversation or Expert Squad delivery owner publishes it.

When the user requests a project file path, save the exact delivered source with
the ordinary `write` tool using `attachmentUrl` and `filePath`. This preserves the
binary bytes; it does not invoke an Office runtime or replace the canonical source.

Read `references/security.md` before using user-supplied images or handling a
request involving external links, macros, embedded objects, media, templates,
or an existing file.
