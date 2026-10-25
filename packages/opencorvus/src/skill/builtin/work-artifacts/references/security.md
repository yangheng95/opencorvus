# Work Artifact security boundary

- Qualified profiles create new PPTX, DOCX and XLSX files. Reject editing an
  uploaded file, a macro-enabled file, or an existing template.
- The typed Harness accepts canonical project attachments, not local filesystem
  paths. Do not run an underlying runtime through Bash. For a requested local
  copy, use ordinary `write` with the exact delivered `attachmentUrl`; its normal
  filesystem authority and create-only attachment contract apply.
- Do not install or invoke an underlying runtime or renderer through Bash.
  The Harness owns OfficeCLI and the existing Browser Runtime for DOCX/XLSX
  HTML-derived previews, with fresh isolated pages and blocked network requests.
- Do not embed OLE, ActiveX, macros, executables, external package
  relationships, remote images, scripts, video, audio, or arbitrary XML.
- Treat links and citations as displayed text unless a qualified typed schema
  explicitly supports safe hyperlinks.
- Stop on corrupt packages, unsafe ZIP entries, external relationships,
  macro/OLE content, failed validation, missing renders, or receipt mismatch.
- The current adapter restricts inputs and isolates configuration/cache, but it
  is not an operating-system network sandbox. Do not claim stronger isolation.
