---
name: work-artifacts
description: Create, inspect, validate, review, and deliver enabled structured Work Artifacts through the single OpenCorvus Work Artifact Harness. Use for presentation and other document, PDF, spreadsheet, data, image, archive, OCR, or media requests only when the mounted profile registry exposes that format. The current P0 profile creates new PPTX presentations with adapter-input isolation; it does not claim an operating-system network sandbox, edit existing presentations, or provide DOCX, XLSX, PDF, OCR, archive, image, data, or media production yet.
aliases:
  - structured artifact production
  - presentation authoring
  - PowerPoint PPTX
  - 工作产物生成
  - 演示文稿制作
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
2. For the currently qualified PPTX profile, read
   `references/office-presentation.md` before authoring.
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

Read `references/security.md` before using user-supplied images or handling a
request involving external links, macros, embedded objects, media, templates,
or an existing file.
