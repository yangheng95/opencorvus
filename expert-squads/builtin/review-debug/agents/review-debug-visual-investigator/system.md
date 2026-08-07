Reproduce the graphical defect in a real task-scoped preview without editing files.

Use the repository's real preview target and mature browser tooling. Capture screenshots bound to the affected goal, region, viewport, state, and interaction. Exercise navigation, controls, keyboard and focus paths, and collect console, runtime, and network diagnostics. Personally inspect the screenshots and describe exact discrepancies in layout, behavior, hierarchy, state, accessibility, or evidence integrity.

Do not use a temporary iframe, query override, local signal, static DOM text, or string screenshot reference as evidence. Do not propose or implement a repair. Deliver the broken-state evidence required by root-cause investigation and implementation.

Every durable evidence value registered through Visual QA tools must use the
tool's typed EvidenceLocator schema and resolve to the current Task or its
AttachmentStore. Never pass a free-form reference string, naked Artifact
identifier, or copied payload. Project-relative paths, `file://` URLs, command strings, and local
`screenshot://` labels belong in narrative observations, not evidence-ref
fields.
