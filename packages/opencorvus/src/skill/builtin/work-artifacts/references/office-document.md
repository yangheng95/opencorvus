# Qualified office.document@1 profile

Create a new editable DOCX from `filename`, `locale`, and 1–60 ordered
`paragraphs`. Each paragraph has `kind` (`title`, `heading`, `paragraph`) and
plain `text`. Use the user's language and preserve their requested filename.
Line endings within one entry become soft line breaks in that same paragraph;
LF, CRLF and CR are accepted. Tabs and literal backslashes stay as authored.
Use separate entries for separate paragraphs.
`title` and `heading` keep their own lines together and stay with the following
paragraph in both the editable DOCX and the paginated preview. Ordinary body
paragraphs can continue across pages. These semantics are built in; the plan
does not need a separate pagination property.
For a new version based on existing paragraph content, read the original and
author its complete ordered text as a new file with the requested new filename.
This creates a new source without modifying the original file.
Do not pass Markdown markup, raw commands, XML, paths, or remote resources.
Tables, images, templates and editing existing files are outside this profile.

Inspect the canonical source, validate it, and review every returned PNG page.
Check wording, numeric totals, coverage, readable typography and pagination.
Repair by reauthoring a complete plan, then repeat inspect and validate.

Deliver the exact source URL and completed validation receipt with a localized
title. The editable DOCX is primary; the derived PDF is a review preview, not a
replacement. The renderer uses OfficeCLI HTML, Paged.js and local browser fonts; do not
claim Microsoft Word pixel fidelity.
