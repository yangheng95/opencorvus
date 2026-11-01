# Shared native runtime

Both candidates receive the same public files and this runtime declaration. Use native Windows processes owned by this task. No Docker, WSL, UI automation, user-window/process manipulation, or delegation to other agents. Do not read other run roots, private graders, references, old candidates, expert answers, credentials or the host repository. The dependency paths below are the sole external filesystem exceptions.

- Python: `C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`, Python3.12.14. Installed generic libraries include openpyxl3.1.5, NumPy2.3.5, pandas3.0.1 and Pillow12.3.0.
- Node: `C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`, Node24.22.1.
- Shared JavaScript modules: `C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`, including `@oai/artifact-tool`2.8.106. You may create an owned local module-directory junction or use an explicit import resolved within this generic dependency directory.
- Artifact Tool public documentation: `C:/Users/hengu/.codex/plugins/cache/openai-primary-runtime/spreadsheets/26.1026.10807/skills/spreadsheets/artifact_tool_docs/`. Read only its public documentation for API use. Its workbook import/recalculation/export/render APIs are the declared shared file consumer; Microsoft Excel native application behavior is not certified.

Any additional generic dependencies, caches, temporary outputs and configuration must be kept under your own `submission/`. Mature tools are welcome; no particular language or optimizer complexity earns credit. Generic library documentation may be consulted and attributed; instance answers and external answer services may not be imported.

Only `submission/` is writable. The public files are immutable. No remote Git operations, publishing, external messages or credential access. Preserve your source, actual scripts/commands, original outputs and failures. Complete child processes naturally before ending; do not leave detached production work.

There is no minimum task duration or total agent token/time cutoff. Complete useful work efficiently; do not sleep, deliberately slow computation, repeat experiments or pad outputs to consume time. No completed model comparison by itself establishes a heavy-task or effective-hour qualification.
