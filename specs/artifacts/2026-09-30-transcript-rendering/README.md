# Transcript visual review

Reviewed on 2026-09-30 in an isolated in-app browser, desktop 1440 × 960,
against the actual development server `http://127.0.0.1:7884/ui/`.
Runtime: `.tmp/transcript-review-20260930/runtime`; project and manual message
records are confined to that temporary directory. No model requests or
Provider credentials were used. The user's running application was not changed.

## Captures and observations

- [Sources collapsed](sources-collapsed.jpg): three exact citations behind one
  compact default-closed disclosure; Tool names use auxiliary typography.
- [Empty Tool result](empty-tool-result.jpg): expanded `inspect_project` presents
  “No arguments” and “Completed · no output returned”, instead of an empty body.
- [Sources and Tool details](sources-and-tool-details.jpg): expanded file, web
  and document citations; chronological Tool results; an empty shell output
  retains its command and outcome.
- [Tool input](tool-input-expanded.jpg): arguments can be expanded/read/copied;
  raw trace typography is smaller than prose. A file source opened README.md in
  the existing File dock, preserving its requested line range.
- [Long document](long-document-progress.jpg): despite this capture's original
  filename, it shows the completed document's beginning, not a timed intermediate
  frame. The actual document is 197,271 characters / 900 sections / 2,708 parsed
  top-level blocks. A later manual scroll reached section 900, the explicit final
  heading, table and highlighted TypeScript code. The lexer preserved the link
  defined after the full document. DOM reads supplemented, rather than replaced,
  screenshot review.
- [Document end](long-document-end.jpg): actual manual scroll at section 900,
  final heading, table and highlighted code, after closing unrelated popovers.
- [Switch during updates](switch-during-updates.jpg): manual interaction changed
  from a message receiving updates to the Tool/source conversation. Its displayed
  body matched the new selection. The isolated Part route accepted 130 sequential
  append updates to 171,007 characters; at the interaction observation the page
  showed update 93 and 190 rendered blocks and accepted the switch immediately.

The persisted samples exercise the real Session/Part projection, API, worker
asset, Markdown renderer and browser UI. They are manual presentation records,
not Provider end-to-end evidence or an automated UI test. No frame-time or
universal worst-case responsiveness claim is inferred from screenshots. A very
large indivisible Markdown token still has one DOM insertion; parsing and code
highlighting are off-thread, and ordinary top-level blocks mount across frames.
Native Tauri worker/CSP behavior was not exercised on the installed client;
its current policy already permits same-origin module workers.
