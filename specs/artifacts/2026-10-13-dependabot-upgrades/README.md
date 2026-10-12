# Dependabot upgrade evidence

Manual desktop review at http://127.0.0.1:19633/ui/ using an isolated runtime. The file was created through the real global Chat/project APIs and read, edited and saved through the actual CodeMirror workbench. No UI automation tests or DOM assertions were used.

- [Editor after save](editor-after-save.jpg): CodeMirror 6.43.13 and Geist 5.3.0, 1280×720, project-owned Markdown file.
- [Refreshed editor after save](editor-6.43.14-after-save.jpg): final CodeMirror 6.43.14, 1280×720. Rebuilt the actual Overlay, restarted only the owned isolated dev service, opened the real project file, typed through the editor, saved and visually reviewed the result.
- [Timeline after fit](timeline-after-fit.jpg): vis-timeline 8.5.4, 1280×720. A manual user request reached a controlled local streaming Provider and the production artifact tool. Point/range items, zoom and Fit all were visually reviewed. This proves the local production path, not an authenticated external model or native OS notification.
- [Selected backend test results](selected-tests.txt): original runner output retained by file, 23 executions / 200 tests / zero failures. Command: `bun run --cwd packages/opencorvus test` with the explicitly listed backend paths in the record; no full UI test suite.
- [Runtime transport results](runtime-contract.txt): final `bun run --cwd packages/opencorvus test test/dependabot-runtime-contract.test.ts`, six tests / 30 assertions / zero failures. Covers production Provider loaders, the Gateway Fireworks helper and the official ACP byte-stream connection.

[Plan and full verification record](../../records/2026-10/2026-10-13-dependabot-upgrades.md).
