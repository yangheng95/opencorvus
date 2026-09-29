# File editor manual visual acceptance

The actual OpenCorvus server served the production UI at `http://127.0.0.1:8957/ui/`
with a task-owned temporary project/runtime and an isolated copy of the built assets.
All browser actions used an independent Chrome tab. These are manually inspected
screenshots, not screenshot baselines or automated UI assertions.

- [Rust, light theme](rust-light.png): comments, keywords, types, literals and macros are readable.
- [Rust, dark theme](rust-dark.png): the same source uses the existing dark theme palette.
- [Markdown with TypeScript fence](markdown-dark.png): heading/emphasis and the nested typed source are highlighted together.
- [Saved YAML reopened](yaml-saved.png): keys, strings and comments are highlighted; the Chinese comment entered through the editor survives save, file switching and server/page restart. Save returns to its clean state.

Also inspected live: Shell keywords/variables/strings, uppercase `.TS` recognition,
plain text after switching away from a code file, and undo restoring the prior text.
The primary file editor is the visual acceptance target. Embedded diff/notebook
surfaces share the resolver but were not separately exercised in a transcript here.

The first shared-output run encountered a real missing lazy chunk after another
build replaced the shared asset directory. The editor displayed its explicit
highlighting failure and retry control while preserving the loaded text. Binding
the isolated complete asset directory resolved it; Rust then loaded correctly.
No model, credentials or existing user application was used.
