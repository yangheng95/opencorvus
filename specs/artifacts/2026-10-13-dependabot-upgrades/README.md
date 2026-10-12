# Dependabot upgrade evidence

Manual desktop review at http://127.0.0.1:19633/ui/ using an isolated runtime. The file was created through the real global Chat/project APIs and read, edited and saved through the actual CodeMirror workbench. No UI automation tests or DOM assertions were used.

- [Editor after save](editor-after-save.jpg): CodeMirror 6.43.13 and Geist 5.3.0, 1280×720, project-owned Markdown file.
- [Refreshed editor after save](editor-6.43.14-after-save.jpg): final CodeMirror 6.43.14, 1280×720. Rebuilt the actual Overlay, restarted only the owned isolated dev service, opened the real project file, typed through the editor, saved and visually reviewed the result.
- [Timeline after fit](timeline-after-fit.jpg): vis-timeline 8.5.4, 1280×720. A manual user request reached a controlled local streaming Provider and the production artifact tool. Point/range items, zoom and Fit all were visually reviewed. This proves the local production path, not an authenticated external model or native OS notification.
- [Selected backend test results](selected-tests.txt): original runner output retained by file, 23 executions / 200 tests / zero failures. Command: `bun run --cwd packages/opencorvus test` with the explicitly listed backend paths in the record; no full UI test suite.
- [Runtime transport results](runtime-contract.txt): final `bun run --cwd packages/opencorvus test test/dependabot-runtime-contract.test.ts`, six tests / 30 assertions / zero failures. Covers production Provider loaders, the Gateway Fireworks helper and the official ACP byte-stream connection.
- [Formal pre-push results](pre-push.txt): final dependency commit 3897754c8 passed the repository hooks and was pushed to main.
- [Remote verify](remote-verify.txt) and [remote service tests](remote-service.txt): actual completed GitHub job log excerpts from [38300113046](https://github.com/yangheng95/opencorvus/actions/runs/38300113046). Cross-platform full unit results are separate and were still running at capture time.

[Plan and full verification record](../../records/2026-10/2026-10-13-dependabot-upgrades.md).

## Complete SDK recovery verification

[Full CI 38312512597](https://github.com/yangheng95/opencorvus/actions/runs/38312512597) succeeded at commit `dced22e425cc9ae81866778daac370b5e1efc715`. This was `workflow_dispatch` on `codex/dependabot-upgrades` with empty `test_files`, not a selected or documentation-only run. Verify, dependency audit, service tests and the final CI passed job all succeeded.

| Full unit job | File completion evidence |
| --- | --- |
| [Linux 115022897599](https://github.com/yangheng95/opencorvus/actions/runs/38312512597/job/115022897599) | 592 DONE records, all exit 0 |
| [macOS 115022897467](https://github.com/yangheng95/opencorvus/actions/runs/38312512597/job/115022897467) | 592 DONE records, all exit 0 |
| [Windows 115022897420](https://github.com/yangheng95/opencorvus/actions/runs/38312512597/job/115022897420) | 592 DONE records, all exit 0 |

The earlier full run 38302496808 failed on the same five files on all three platforms. Commit `3b0562c97` fixes SDK response-error cause classification, current model completion ordering in recovery/dispatch fixtures, open-map schema serialization and the real Mission tool-definition budget. Local final focused verification passed six files / 51 tests; shared recovery verification passed eight files / 59 tests, with the LLM activity file present in both groups. Those local groups are separate from the successful full CI above. Subsequent validation-record changes are Markdown only and do not change this tested implementation.

Main integration retained the intervening source/editor deliveries. Eleven focused backend files passed all 76 tests after integration, including the updated source/search contracts and Provider/recovery checks. Eight typecheck tasks, documentation and architecture-index checks passed. The task's ten implementation/test files and dependency graph have no changes from the full CI's tested revision. Local main fast-forwarded from `a7575c5fc` to `e1dc4ea01`; the staged and unstaged patches saved immediately before and after synchronization were identical. The earlier parallel edits were preserved in their own commit, not mixed into the Dependabot fix.
