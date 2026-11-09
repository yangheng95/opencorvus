# Contributing to OpenCorvus

We welcome contributions that help people complete and inspect real work with OpenCorvus. Useful contributions include:

- Bug fixes
- Additional LSPs / Formatters
- Improvements to LLM performance
- Support for new providers
- Fixes for environment-specific quirks
- Missing standard behavior
- Documentation improvements

However, any UI or core product feature must go through a design review with the core team before implementation.

If you are unsure if a PR would be accepted, feel free to ask a maintainer or look for issues with any of the following labels:

- [`help wanted`](https://github.com/yangheng95/opencorvus/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22help%20wanted%22)
- [`good first issue`](https://github.com/yangheng95/opencorvus/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
- [`bug`](https://github.com/yangheng95/opencorvus/issues?q=is%3Aissue%20state%3Aopen%20label%3Abug)

> [!NOTE]
> PRs that ignore these guardrails will likely be closed.

Want to take on an issue? Leave a comment and a maintainer may assign it to you unless it is something we are already working on.

## Your first contribution

Read [AGENTS.md](./AGENTS.md) for repository constraints and the [current architecture index](./specs/current/architecture/README.md) for the subsystem you plan to change. Search existing issues and the code before proposing a fix. A label search may be empty; it is not a promise that a task is available.

Choose one bounded result and describe its acceptance in an issue before implementation:

| Contribution             | Useful starting scope                                                                                            | Evidence to bring                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Documentation correction | One command or explanation in `packages/web/src/content/docs/`, including its `zh-cn/` counterpart when affected | Page URL, actual command/output or current source contract, corrected wording; inspect the real page for layout changes |
| Reproduction report      | One failure in your own disposable project                                                                       | Version, operating system, exact steps, expected and observed results, minimal redacted evidence                        |
| Focused code fix         | One confirmed defect in an agreed issue                                                                          | Root cause, affected callers, a focused positive contract test and relevant real-path verification                      |

You can contribute a reproducible report without writing code or buying model credits. Do not submit unrelated formatting changes or generated assets from other work. Feature scope still needs the design review described below.

中文入口：先阅读 [AGENTS.md](./AGENTS.md)，选择一个可验收的小范围问题，再通过[现有问题表单](https://github.com/yangheng95/opencorvus/issues/new/choose)说明现象、复现步骤和预期结果。欢迎中文报告、文档纠错和复现证据；无需先实现完整功能。文档修改请检查受影响的中英文页面，提交时写清验证结果与未验证部分。

## Adding New Providers

First check the [provider configuration guide](./packages/web/src/content/docs/providers.mdx). A service that works through an existing compatible adapter may only need configuration. For a new integration or model-catalog change, describe the missing capability in an issue and consult the [provider architecture](./specs/current/architecture/06-provider.md) before choosing where to implement it. Configuration, catalog metadata and runtime adapters have different responsibilities.

## Developing OpenCorvus

- Requirements: Bun 1.3.14 or newer and [Rust through rustup](https://rust-lang.org/tools/install/) for source runtime builds
- Install dependencies from the repo root:

  ```bash
  bun install
  ```

The development and core test commands build the native project index from its
locked dependencies. When invoking the source entry point directly, prepare the
index first with `bun run --cwd packages/opencorvus prepare:project-index`.

### Windows runtime tests and binary builds

Install [Rust through rustup](https://rust-lang.org/tools/install/) and the Visual Studio C++ build tools requested by its installer. Open a terminal where `rustup`, `cargo`, and `rustc` are available. OpenCorvus uses a native Windows process supervisor: the runtime test runner builds it when the matching helper is missing, and Windows binary builds compile it with Cargo.

From the repository root, check the installed tools and prepare the test helper:

```powershell
rustup show active-toolchain
cargo --version
rustc --version
bun packages/opencorvus/script/prepare-test-process-supervisor.ts
```

The last command prints the helper's executable path. It can reuse an existing helper for the current native source, so success is not evidence of a complete binary build. If Rust reports a missing linker, finish installing the C++ build tools before retrying. Documentation-only checks do not require this native build.

Runtime tests can also invoke tools such as `git`, `rg` (ripgrep), and Python. Check the requirements of your selected test and the [test workflow](./.github/workflows/test.yml); its Windows job uses Python 3.13 and installs ripgrep. The Windows ripgrep installer in `script/` uses GitHub Actions environment paths and is intended for that workflow.

### Running against a different directory

Run the source CLI entrypoint and pass the project directory explicitly:

```bash
bun --cwd packages/opencorvus ./src/index.ts serve --project-dir /absolute/path/to/repo
```

To run OpenCorvus against this repository root:

```bash
bun --cwd packages/opencorvus ./src/index.ts serve --project-dir ../..
```

### Building a local binary

To compile a standalone executable:

```bash
bun run --cwd packages/opencorvus build --single
```

Then run it with:

```bash
./packages/opencorvus/dist/opencorvus-<platform>/opencorvus
```

Replace `<platform>` with the directory produced by the build (e.g., `darwin-arm64`, `linux-x64`). On Windows the executable is `opencorvus.exe`. This build can regenerate bundled artifacts; review the resulting diff before committing.

- Core pieces:
  - `packages/opencorvus`: Core business logic, server, agents, tools, and MCP
  - `packages/sdk/js`: JavaScript Software Development Kit (SDK, `@opencorvus-ai/sdk`)
  - `packages/overlay`: Application workbench
  - `packages/web`: Public website and bilingual documentation
  - `packages/channel-runtime`: Channel runtime adapters (Slack, Telegram, Discord, Feishu, WhatsApp, Google Chat, Microsoft Teams, LINE, Matrix, Mattermost, Signal, WeCom, DingTalk)
  - `packages/plugin`: Plugin system (`@opencorvus-ai/plugin`)

### Understanding bun dev vs opencorvus

During development, the source entrypoint is the local equivalent of the built `opencorvus` command:

```bash
# Development (from project root)
bun --cwd packages/opencorvus ./src/index.ts serve
bun --cwd packages/opencorvus ./src/index.ts --help

# Production
opencorvus serve
opencorvus --help
```

### Running the API Server

To start the OpenCorvus Application Programming Interface (API) server and served workbench:

```bash
bun --cwd packages/opencorvus ./src/index.ts serve
```

The default port is 7878 unless server configuration overrides it. Open the `/ui/` URL printed by the server to use the workbench. You can specify a different port:

```bash
bun --cwd packages/opencorvus ./src/index.ts serve --port 8080
```

> [!NOTE]
> If you change the public API or SDK, run `bun run script/generate.ts` from the root to regenerate the SDK and related artifacts. Inspect its complete diff: the shared pipeline also generates bundled expert-squad and Skill artifacts.

Please follow the repository's Biome, TypeScript, EditorConfig, and existing package conventions.

### Setting up a Debugger

Run the source entrypoint with Bun's `--inspect` option and attach using the debugger URL it prints. See the [official Bun debugging guide](https://bun.sh/docs/runtime/debugger) for supported debugger setup and pause options.

```bash
bun --inspect --cwd packages/opencorvus ./src/index.ts serve --port 8080
```

### Validate the change you made

Run commands from the repository root unless a package working directory is specified:

- Documentation: `bun run docs:check` checks generated API documentation; it does not validate every prose example or page layout. Exercise changed examples and inspect affected real pages separately.
- TypeScript: `bun run typecheck` runs workspace type checks.
- API contracts: `bun run api:routes-check`; regenerate affected artifacts as described above.
- Runtime logic: use the package runner with explicit relevant files: `bun run --cwd packages/opencorvus test test/path/to/relevant.test.ts`. Replace that example path with an existing focused non-UI test. The runner supplies isolated test state; the root test command is intentionally disabled.

Follow AGENTS.md for positive behavior/error-contract assertions and independent review. For UI changes, use actual page interaction, screenshots and manual visual review; do not add or run automated UI tests. Use the development server's `/ui/` for application acceptance. Record the commands, observed outputs and any unverified boundaries in your pull request. A schema check or mock result alone does not establish successful model execution or end-to-end delivery.

## Pull Request Expectations

### Issue First Policy

**All PRs must reference an existing issue.** Before opening a PR, open an issue describing the bug or feature. This helps maintainers triage and prevents duplicate work. PRs without a linked issue may be closed without review.

- Use `Fixes #123` or `Closes #123` in your PR description to link the issue
- For small fixes, a brief issue is fine - just enough context for maintainers to understand the problem

### General Requirements

- Keep pull requests small and focused
- Explain the issue and why your change fixes it
- Before adding new functionality, ensure it doesn't already exist elsewhere in the codebase

### UI Changes

If your PR includes UI changes, please include screenshots or videos showing the before and after. This helps maintainers review faster and gives you quicker feedback.

### Logic Changes

For non-UI changes (bug fixes, new features, refactors), explain **how you verified it works**:

- What did you test?
- How can a reviewer reproduce/confirm the fix?

### No AI-Generated Walls of Text

Long, AI-generated PR descriptions and issues are not acceptable and may be ignored. Respect the maintainers' time:

- Write short, focused descriptions
- Explain what changed and why in your own words
- If you can't explain it briefly, your PR might be too large

### PR Titles

PR titles should follow conventional commit standards:

- `feat:` new feature or functionality
- `fix:` bug fix
- `docs:` documentation or README changes
- `chore:` maintenance tasks, dependency updates, etc.
- `refactor:` code refactoring without changing behavior
- `test:` adding or updating tests

You can optionally include a scope to indicate which package is affected:

- `feat(opencorvus):` feature in the opencorvus core package
- `fix(sdk):` bug fix in the SDK package
- `chore(channel-runtime):` maintenance in the channel runtime package

Examples:

- `docs: update contributing guidelines`
- `fix: resolve crash on startup`
- `feat: add desktop automation support`
- `feat(opencorvus): add new tool for file search`
- `fix(channel-runtime): resolve Slack adapter timeout`
- `chore: bump dependency versions`

### Style Preferences

These are not strictly enforced, they are just general guidelines:

- **Functions:** Keep logic within a single function unless breaking it out adds clear reuse or composition benefits.
- **Destructuring:** Do not do unnecessary destructuring of variables.
- **Control flow:** Avoid `else` statements.
- **Error handling:** Prefer `.catch(...)` instead of `try`/`catch` when possible.
- **Types:** Reach for precise types and avoid `any`.
- **Variables:** Stick to immutable patterns and avoid `let`.
- **Naming:** Choose concise single-word identifiers when they remain descriptive.
- **Runtime APIs:** Use Bun helpers such as `Bun.file()` when they fit the use case.

## Feature Requests

For net-new functionality, start with a design conversation. Open an issue describing the problem, your proposed approach (optional), and why it belongs in OpenCorvus. The core team will help decide whether it should move forward; please wait for that approval instead of opening a feature PR directly.

## Issues and community standards

Use the repository's structured forms for bug reports, feature requests, documentation issues, and usage questions. Good reports identify the affected version and surface, describe an observable outcome, and include only the evidence required to reproduce or understand the request.

Remove credentials, personal data, private prompts, proprietary source code, and unrelated logs before posting. Report vulnerabilities privately according to [SECURITY.md](./SECURITY.md).

All participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). Maintainers may close duplicate, unsupported, or incomplete reports, but contributors are welcome to correct and reopen a report with the missing evidence.
