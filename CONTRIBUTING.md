# Contributing to OpenCorvus

We want to make it easy for you to contribute to OpenCorvus. Here are the most common type of changes that get merged:

- Bug fixes
- Additional LSPs / Formatters
- Improvements to LLM performance
- Support for new providers
- Fixes for environment-specific quirks
- Missing standard behavior
- Documentation improvements

However, any UI or core product feature must go through a design review with the core team before implementation.

If you are unsure if a PR would be accepted, feel free to ask a maintainer or look for issues with any of the following labels:

- [`help wanted`](https://github.com/yangheng95/opencorvus/issues?q=is%3Aissue%20state%3Aopen%20label%3Ahelp-wanted)
- [`good first issue`](https://github.com/yangheng95/opencorvus/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
- [`bug`](https://github.com/yangheng95/opencorvus/issues?q=is%3Aissue%20state%3Aopen%20label%3Abug)
- [`perf`](https://github.com/yangheng95/opencorvus/issues?q=is%3Aopen%20is%3Aissue%20label%3A%22perf%22)

> [!NOTE]
> PRs that ignore these guardrails will likely be closed.

Want to take on an issue? Leave a comment and a maintainer may assign it to you unless it is something we are already working on.

## Adding New Providers

New providers shouldn't require many if ANY code changes, but if you want to add support for a new provider first make a PR to:
https://github.com/yangheng95/models.dev

## Developing OpenCorvus

- Requirements: Bun 1.3.14 or newer
- Install dependencies from the repo root:

  ```bash
  bun install
  ```

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

Replace `<platform>` with your platform (e.g., `darwin-arm64`, `linux-x64`).

- Core pieces:
  - `packages/opencorvus`: Core business logic, server, agents, tools, LSP
  - `packages/sdk`: JavaScript SDK (`@opencorvus-ai/sdk`)
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

To start the OpenCorvus headless API server:

```bash
bun --cwd packages/opencorvus ./src/index.ts serve
```

This starts the headless server on port 7878 by default. You can specify a different port:

```bash
bun --cwd packages/opencorvus ./src/index.ts serve --port 8080
```

> [!NOTE]
> If you make changes to the API or SDK (e.g. `packages/opencorvus/src/server/server.ts`), run `./script/generate.ts` to regenerate the SDK and related files.

Please follow the repository's Biome, TypeScript, EditorConfig, and existing package conventions.

### Setting up a Debugger

Bun debugging is currently rough around the edges. We hope this guide helps you get set up and avoid some pain points.

The most reliable way to debug OpenCorvus is to run it manually in a terminal via `bun run --inspect=<url> dev ...` and attach
your debugger via that URL. Other methods can result in breakpoints being mapped incorrectly, at least in VSCode (YMMV).

To debug the server:

```bash
bun run --inspect=ws://localhost:6499/ --cwd packages/opencorvus ./src/index.ts serve --port 7878
```

Other tips and tricks:

- You might want to use `--inspect-wait` or `--inspect-brk` instead of `--inspect`, depending on your workflow
- Specifying `--inspect=ws://localhost:6499/` on every invocation can be tiresome, you may want to `export BUN_OPTIONS=--inspect=ws://localhost:6499/` instead

#### VSCode Setup

If you use VSCode, you can use our example configurations [.vscode/settings.example.json](.vscode/settings.example.json) and [.vscode/launch.example.json](.vscode/launch.example.json).

Some debug methods that can be problematic:

- Debug configurations with `"request": "launch"` can have breakpoints incorrectly mapped and thus unusable
- The same problem arises when running OpenCorvus in the VSCode `JavaScript Debug Terminal`

With that said, you may want to try these methods, as they might work for you.

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
