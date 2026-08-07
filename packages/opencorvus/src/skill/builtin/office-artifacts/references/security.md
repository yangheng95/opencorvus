# Office Artifact Harness security boundary

- The enabled production tool creates a new PPTX. Reject requests that require
  editing an uploaded PPTX, POTX, macro-enabled file, or existing template.
- Do not request local filesystem paths from the user.
- Picture inputs must be canonical attachments in the current project.
- Do not embed OLE objects, ActiveX, macros, executable files, external package
  relationships, remote images, scripts, video, audio, or arbitrary XML.
- Treat links and citations as displayed content unless the typed schema
  explicitly supports a safe hyperlink.
- Keep images within the tool's MIME and byte limits.
- Never use Bash to bypass a rejected property, unsupported element, missing
  packaged runtime, failed validation, or cleanup error.
- If validation reports a corrupt package, external relationship, unsafe ZIP
  entry, macro/OLE content, or missing rendered slide, stop and report the
  exact failure. Do not deliver that candidate.
