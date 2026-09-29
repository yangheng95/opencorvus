# File editor syntax highlighting

## Recall

- User: 「给现在的文件编辑加上语法高亮的功能」. Deliver highlighting in the existing file editor, with actual visual acceptance; keep ordinary edit/save/navigation behavior.
- Side conversation: no delegation, no worktree/branch, preserve unrelated side-chat changes. This request authorizes only this feature and its verification. Do not operate existing user windows/processes.
- Read `CodeEditor.tsx`, `code-editor-theme.ts`, `FileEditorPane.tsx`, all shared CodeEditor/grammar callers (Code, Diff, Notebook, FilePreview artifacts), file-workbench service, overlay dependencies/build configuration, `07-panel.md`, server `/ui` serving and runtime isolation configuration.
- Search: one manual eight-language extension map owns editor syntax selection; DiffArtifact imports that map directly, other artifacts use CodeEditor. Theme already owns token colors in all palettes. `test/code-editor-reveal.test.ts` includes UI highlighting/style assertions and negative reveal assertions; remove this touched UI test, do not run or replace it with UI automation. File-workbench tests are service contracts and outside implementation scope.
- Upstream: [CodeMirror language registry source](https://github.com/codemirror/language-data/blob/main/src/language-data.ts), [LanguageDescription API](https://codemirror.net/docs/ref/#language.LanguageDescription), [Markdown fenced-language support](https://github.com/codemirror/lang-markdown). Use the maintained registry and dynamic imports, not handcrafted token regexes or a second editor.

## Analysis

- Observable gap: eight mapped language families have grammar support; YAML, TOML, Shell, Go, Rust, SQL, C/C++, Java and filename-based formats fall through to an empty extension. Existing Markdown initializes without fenced-language support. The current theme already colors semantic tags, so adding more colors alone cannot fix unparsed files.
- Data/control flow: FileEditorPane loads the exact project-scoped file, owns draft/save revisions, and passes path/value to CodeEditor. CodeEditor mounts once and reconfigures its language compartment when the path changes. Asynchronous language loading must bind to the current view/path and ignore disposed or superseded resolutions; failure must remain visible while the draft stays editable. DiffArtifact uses the same mapping and must migrate atomically with it.
- Root cause: hardcoded small grammar map and eager grammar imports, not the save API or persisted file encoding. No backend/schema/provider change is required. Reuse the existing theme tokens and incrementally parsing editor.
- Impact: overlay dependency/lockfile, shared grammar resolver, CodeEditor lifecycle, DiffArtifact, relevant documentation. No Task/Mission scheduling, credentials, native desktop controls, provider requests or unrelated UI changes are needed.
- Risks: lazy chunks can fail, older file loads can finish late, changing grammar must preserve undo/cursor/draft, unknown text files must stay editable. The default JS/CSS/Markdown/Python behavior and citation reveal must remain functional.

## Plan before implementation

1. Replace the local grammar map with one shared CodeMirror language-data registry, retaining existing extensions and adding filename-based languages. Markdown uses that same registry for fenced blocks. Grammars load only when requested.
2. Bind language loading to the mounted editor/path with cleanup protection. Reconfigure only the language compartment; preserve document, selection and history. Show language/load failure in a compact editor status strip and retry through an explicit action; plain text is an intentional mode for unrecognized files.
3. Update DiffArtifact to the same asynchronous grammar owner and existing theme; remove the obsolete UI assertion test encountered above. No UI automated test is added or run.
4. Build the production overlay, launch a task-owned isolated development server with a fresh runtime and sample project, and inspect its real `/ui` page. Manually inspect highlighted source/config/Markdown in light and dark themes, edit/save and reopen a file, switch languages and check plain text. Keep screenshots and a written observation record.
5. Run typecheck, build and docs/architecture checks, inspect task-only diff, commit, fetch/merge/audit outgoing commits and push current upstream. Preserve all unrelated workspace modifications.

## Evidence

- Plan recorded before source/dependency modifications.
- Production build, overlay typecheck, i18n and CSS token checks passed. Real `/ui` showed highlighted YAML and accepted edits/undo/save. During later Rust selection the language load failed: the page referenced `CodeEditor-BsItsToI.js`, but a concurrent build replaced the shared output with `CodeEditor-BzHz_ni5.js`. This is an acceptance-asset lifetime conflict. Freeze a task-owned copy of the completed UI directory via the existing `Server.listen({ overlayUiSource })` contract and restart only the verified task-owned listener before continuing. No user process or application is replaced.
- The fixed asset directory passed actual visual acceptance: Rust in light/dark themes; Markdown with a TypeScript fence; YAML with a saved/reopened Chinese comment; Shell; uppercase `.TS`; plain text. Editing and undo were manually exercised. Original temporary file content was also read back from disk after saving. [Screenshots and observations](../../artifacts/2026-09-30-file-editor-highlighting/README.md).
- Commands passed: `bun run --cwd packages/overlay build` (production Vite build plus renderer surface checker), overlay `typecheck`, `check:i18n` (2 locales / 1,970 keys), and `check:css-tokens`. No UI automation was added or run. The touched UI assertion test was removed under the repository's UI test policy.
- Scope limits: the main file editor is visually verified; embedded diff/notebook surfaces were migrated to the shared language contract but not separately exercised in a conversation. Recognition follows the upstream language registry; unrecognized formats intentionally remain editable plain text.
- `docs:check` and `check:architecture-index` passed after adding the record and screenshot index. The task-created Chrome tab was closed and the isolated server was stopped after checking its exact process command line. Other user/parallel applications remained running.
