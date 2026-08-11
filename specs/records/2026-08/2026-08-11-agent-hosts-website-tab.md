# Agent hosts website tab

## Recall

### User request

- Add a complete tab to the current OpenCorvus website explaining how OpenClaw, Hermes Agent, and other assistants can use OpenCorvus.

### Acceptance indicators

- The shared public header exposes one reciprocal English and Simplified Chinese Agent integration tab.
- The tab opens a dedicated public page rather than replacing the existing Starlight `/agents/` documentation route.
- The page explains the actual supported path: install the OpenCorvus runtime, install the complete portable `opencorvus` Agent Skill package, invoke it in the assistant, and verify the resulting Task through its identity, board, events, and delivery evidence.
- OpenClaw and Hermes Agent each receive current, first-party-backed installation, verification, invocation, and session-refresh instructions.
- The page also explains the generic Agent Skills-compatible path, the one-off CLI and HTTP API alternatives, credential and localhost boundaries, and the difference between “the Skill is installed” and “OpenCorvus is installed and healthy.”
- English and Simplified Chinese routes have reciprocal information architecture and language switching.
- A real desktop browser review confirms the navigation state, complete page rhythm, code readability, reciprocal locale content, focus behavior, and absence of horizontal overflow or console errors.

### Hard constraints

- Preserve all unrelated staged and unstaged work, especially the current public-homepage and Mission iteration.
- Do not add, change, or run UI automation tests. UI acceptance uses the real rendered page, screenshots, and human visual review.
- Reuse the existing Astro public-site layout, typography, color, border, action, and responsive primitives. Do not create a parallel theme.
- Do not claim that the Agent Skill installs the OpenCorvus runtime, that OpenCorvus is itself an MCP server, or that a Task is complete merely because an agent session stopped.
- Bind examples to localhost by default. External binding requires explicit authority, HTTP Basic authentication, and an appropriate network boundary.
- Do not publish or alter DNS directly. A repository push may use the existing deployment workflow only after this bounded change is independently reviewed and can be isolated from unrelated work.

### Repository and workspace baseline

- Repository: `D:\myhexin-local\opencorvus`.
- Branch/upstream: `main` tracking `origin/main`.
- Baseline commit: `480c0ab901809bb2350db97ab4adee2d091125b4`.
- Website: `packages/web`, Astro 7 with Starlight, configured for `https://opencorvus.com` at `/`.
- The worktree contains substantial unrelated changes, including shared-header Mission work. Only exact owned hunks and newly added Agent-host page files belong to this task.

### Read materials and search results

- Repository contracts: `skills/opencorvus/SKILL.md` and its `skill-installation.md`, `opencorvus-installation.md`, `operations.md`, `http-api.md`, and `sources.md` references.
- Product documentation: English and Chinese README Agent-host sections, server/API documentation, shared public header/layout, public stylesheet, route map, and existing utility pages.
- OpenClaw first-party Skills documentation confirms local-directory installation, `openclaw skills check`, workspace/global scope, `$skill` Control UI references, slash-command use in messaging channels, and new-session snapshot behavior.
- Hermes Agent first-party Skills documentation confirms `~/.hermes/skills`, `hermes skills list`, slash-command invocation, reference-file progressive disclosure, and `/reset` or `--now` refresh behavior.
- The Agent Skills specification confirms a complete Skill is a directory containing `SKILL.md` plus optional on-demand `references/`; copying only `SKILL.md` would omit OpenCorvus operating contracts.
- Repository route search found that Starlight already owns `/agents/`; the new public page therefore uses `/use-with-agents/` and `/zh-cn/use-with-agents/`.

### Independent agent feedback

- The first independent plan review returned `NOT APPROVED` and required eight corrections: separate the Skill instruction layer from the `run` versus `serve + Task/API` runtime surfaces; add an actionable runtime-readiness path; strengthen host discovery verification and session-refresh wording; state machine/container/network reachability; add the trusted-source boundary; freeze exact reciprocal CTA destinations; define dirty-index commit isolation; and review the denser header at both 1280 px and the narrower supported desktop width with an actual focus state.
- Those corrections are integrated below. The same independent reviewer required two final copy fixes separating `run --attach` from Task creation and making source-build provider commands executable through the explicit source entry point; both were applied. The final plan verdict is `APPROVED`.

## Problem and impact

The repository already contains a portable OpenCorvus Agent Skill and accurate README instructions, but the public product navigation does not expose that integration path. A visitor using OpenClaw, Hermes Agent, or another Agent Skills-compatible host must discover a long README section and infer the runtime/Skill distinction. Reusing `/agents/` would also shadow the existing Starlight Agent configuration page.

For durable Task operation, the page must make the responsibility chain explicit:

`assistant host -> opencorvus Agent Skill -> OpenCorvus CLI or HTTP API -> project-owned Task -> board, events, Artifacts, and delivery evidence`

The assistant remains the operator. OpenCorvus remains the runtime and Task authority. The portable Skill carries instructions and references; it is not a third runtime surface and does not silently grant external permissions. A one-off `opencorvus run` conversation is a separate, lighter surface and does not promise a Task ID, board, or Task event stream.

## Bounded implementation plan

1. Extend the shared public header and layout `current` type with `use-with-agents`, add `Use with Agents` / `Agent 接入` immediately after Mission, and preserve all current navigation work.
2. Add a bilingual `AgentHostsPage.astro` rendered at `/use-with-agents/` and `/zh-cn/use-with-agents/`.
3. Shape the page as six sections:
   - Hero: use the assistant already in the user's workflow; name OpenClaw, Hermes Agent, and Agent Skills-compatible hosts.
   - Readiness flow: obtain the runtime from Download/Quickstart or the verified source-build sequence; run `doctor`; authenticate a provider; confirm `auth list` and at least one exact `models` result.
   - Instruction layer: install the complete Skill from a trusted OpenCorvus checkout/revision, inspect its `SKILL.md` and references, invoke it from an eligible host session, and preserve the package's relative files.
   - Host guides: distinct OpenClaw and Hermes cards with copyable command blocks, explicit discovery checks, refresh guidance, and invocation prompts grounded in repository contracts.
   - Operating surfaces and capabilities: the Skill may guide either one-off `opencorvus run` or durable `opencorvus serve` plus Task/API operation. Only the durable path creates an exact Task identity with board, events, follow-up, retry/replan, explicitly authorized cancellation, and terminal delivery evidence.
   - Boundaries and calls to action: runtime-versus-Skill distinction, localhost/authentication, secret handling, project-directory and Task identity, plus Download, Skill source, and operations documentation links.
4. Keep the page static and progressively readable without client JavaScript. Use native headings, ordered lists, preformatted code, links, and responsive CSS local to the component.
5. Run Astro check and production build. Then start the actual site and visually review both locale routes at desktop width, including header active state, full-page screenshots, keyboard focus, and console.
6. Request an independent read-only post-implementation review. Repair all valid findings and repeat focused validation when required.

## Frozen product copy and evidence boundaries

- English page title: `Use OpenCorvus from OpenClaw, Hermes, and other Agents`.
- Chinese page title: `通过 OpenClaw、Hermes 等 Agent 使用 OpenCorvus`.
- Recommended message: install the runtime and complete Skill separately, then begin with a read-only health check. For one-off work, ask the host to use `opencorvus run` or `run --attach` for one explicit absolute project directory without promising Task lifecycle state. For durable operation, ask it to start or reach `opencorvus serve`, create a Task for that directory, capture the returned `task_id`, and verify the Task board, events, and delivery evidence.
- OpenClaw commands: `openclaw skills install ./skills/opencorvus --as opencorvus` and `openclaw skills check`; use `$opencorvus` in Control UI and `/opencorvus` in messaging channels.
- OpenClaw discovery: run `openclaw skills list` and confirm `opencorvus` is present and ready/eligible by name; keep `openclaw skills check` as the broader readiness report. A fresh session is the guaranteed refresh path, while current watched skill changes may refresh an existing session on the next turn.
- Hermes commands: copy the complete directory below `~/.hermes/skills/developer-tools/opencorvus`, run `hermes skills list`, then start a new session or `/reset` and invoke `/opencorvus`. Mention `--now` only for a supported `hermes skills install ... --now` flow, never for manual copying.
- Runtime readiness: the primary public handoff is localized `/download/` plus `/start/quickstart/`; the page also shows the verified source path `git clone`, `bun install`, `bun run --cwd packages/opencorvus build`, and `bun packages/opencorvus/src/index.ts doctor`, followed by the executable source-entry commands `bun packages/opencorvus/src/index.ts auth login`, `bun packages/opencorvus/src/index.ts auth list`, and `bun packages/opencorvus/src/index.ts models`. The page may show bare `opencorvus ...` equivalents only after stating that they require an installed global command. A healthy Skill listing never substitutes for these runtime checks.
- Generic hosts: support is conditional on Agent Skills-compatible directory loading and relative reference files; the page does not claim universal compatibility.
- Completion language distinguishes Skill available, OpenCorvus installed/healthy, provider/model ready, server reachable, Task accepted/running, and Task terminal with reviewable evidence.
- Reachability: the assistant host must be able to execute the OpenCorvus CLI or reach the server and the exact project directory from its own operating-system user, machine, container, and network namespace. `127.0.0.1` means the environment making the request and does not automatically refer to a desktop outside that container or remote host.
- Trust: use a trusted OpenCorvus checkout and intended revision, inspect the complete Skill package before enabling it, and never install only `SKILL.md` while omitting its relative references.
- Exact reciprocal calls to action: localized `/download/`; localized `/start/quickstart/`; GitHub `https://github.com/yangheng95/opencorvus/tree/main/skills/opencorvus`; localized `/server/`; and localized `/reference/api/`.

## Non-goals

- No MCP server adapter, OpenClaw plugin, Hermes plugin, hosted OpenCorvus service, credential broker, installer publication, or runtime API change.
- No rewrite of the existing `/agents/` documentation page.
- No claims that OpenClaw or Hermes are execution providers inside the OpenCorvus desktop runtime; this page is about using them as external assistant hosts through the portable Skill, CLI, or HTTP API.
- No mobile-specific design expansion beyond preserving the existing responsive public-navigation and page behavior.

## Verification plan

- `bun run --cwd packages/web check`
- `bun run --cwd packages/web build`
- Real browser review of `/use-with-agents/` and `/zh-cn/use-with-agents/` at `1280 x 720` and the site's narrower supported `1100 x 720` desktop width. Store top-of-page evidence for both widths and continuous section-by-section coverage of the full page at the denser 1100 px width under `specs/artifacts/`; do not rely on a browser-stitched full-page image when the capture backend repeats frames.
- Confirm the denser header and new item remain visible and active in both locales; language links are reciprocal; command blocks scroll internally without page overflow; code remains legible; all calls to action resolve to the frozen same-site or GitHub destinations; and the browser console has no errors.
- Tab through the actual page and capture a screenshot with visible focus on the new navigation item or a primary page action. A stitched or sectioned full-page view without focused state is not focus evidence.

## Delivery boundary

The task owns the new page component, two route files, exact shared-header/layout hunks for the new current value and navigation item, this record, its index entries, and visual evidence. Existing Mission, homepage, generated market, download, runtime, Expert Squad, and other specification changes remain outside this task.

### Dirty-index commit isolation

- Before delivery, record `git status --short`, the real index entries, hashes of pre-existing staged and unstaged patches, and byte hashes for every overlapping file.
- Build the exact task patch against the baseline commit and apply it to an alternate Git index initialized from `HEAD`. The patch must include only the new component/routes/spec/evidence and the new Agent-host hunks; it must exclude Mission, homepage, generated market, and every pre-existing staged or unstaged hunk.
- Run the normal commit command with that alternate index so repository hooks still execute. Do not use `commit-tree`, `--no-verify`, a new branch, a new worktree, stash, reset, clean, or force operations.
- If the commit advances `HEAD`, reconcile the real index by replaying each pre-task staged delta onto the new `HEAD` in a temporary index and then installing only the proven resulting index entries. Preserve the working-tree bytes exactly. Verify that pre-existing staged content, pre-existing unstaged content, and staging intent remain present; verify the committed tree equals the reviewed task patch and contains no unrelated path or hunk.
- Push only if `upstream..HEAD` contains exactly this reviewed task commit and all isolation proofs pass. If any overlap cannot be replayed without ambiguity, stop before commit/push and report the exact delivery blocker while leaving the implementation and all prior work intact.

## Implementation and verification evidence

- Implemented the shared navigation entry, bilingual public routes, static `AgentHostsPage.astro`, and a page-scoped narrow-desktop width override. The existing Mission navigation and every unrelated website/runtime change remain present in the working tree.
- `bun run --cwd packages/web check`: passed with zero errors. The only diagnostic was the pre-existing unused `startBlock` hint in `qa/dedupe-lead.cjs`, plus existing theme-override warnings.
- `bun run --cwd packages/web build`: passed after the final host-neutral prompt repair and generated 315 pages. Existing non-fatal warnings about theme overrides, top-level await, and the missing `docs -> 404` entry remain outside this task.
- Real in-app browser review used the built preview at `http://127.0.0.1:4323`. English and Simplified Chinese routes were checked at `1280 x 720` and `1100 x 720`.
- At the exact 1100 px viewport, the initial page inherited the public site's global `body { min-width: 1100px }`, producing a 15 px document overflow after the browser scrollbar reduced the content viewport to 1085 px. A page-only `body.public-agent-hosts-body { min-width: 0 }` override removed the overflow without changing other public pages. Final English and Chinese measurements were `clientWidth = scrollWidth = body.scrollWidth = 1085`.
- Both locales showed the new navigation item as the active page, kept every header item visible, exposed reciprocal language links, and used the frozen localized CTA destinations. Console error collection was empty on both English and Chinese routes.
- Actual keyboard navigation produced a visible focus ring on the English `Use with Agents` navigation item. Command blocks keep their overflow inside the block instead of widening the document.
- Independent post-implementation review initially rejected a host-specific durable prompt and incomplete visual coverage. After the prompt became host-neutral and both locales received overlapping `top + flow-01..08` sequences, the third read-only review returned `APPROVED`; its only residual risks are that OpenClaw/Hermes were verified from first-party documentation rather than installed locally, and that delivery must exclude the concurrent Mission hunks.

### Reviewed visual evidence

- [`2026-08-11-agent-hosts-page-en-1280-top.png`](../../artifacts/2026-08-11-agent-hosts-page-en-1280-top.png) and [`2026-08-11-agent-hosts-page-en-1100-top.png`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-top.png): desktop and narrow supported desktop header, active navigation, and hero.
- [`2026-08-11-agent-hosts-page-en-keyboard-focus.png`](../../artifacts/2026-08-11-agent-hosts-page-en-keyboard-focus.png): real keyboard focus on the new navigation item.
- English 1100 px continuous sequence: [`01`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-01.png), [`02`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-02.png), [`03`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-03.png), [`04`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-04.png), [`05`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-05.png), [`06`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-06.png), [`07`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-07.png), and [`08`](../../artifacts/2026-08-11-agent-hosts-page-en-1100-flow-08.png). Together with the 1100 top image, these cover scroll positions `0, 650, 1301, 1951, 2602, 3252, 3902, 4553, 5106` over a 710 px content viewport, so every adjacent frame overlaps.
- [`2026-08-11-agent-hosts-page-zh-1280-top.png`](../../artifacts/2026-08-11-agent-hosts-page-zh-1280-top.png) and [`2026-08-11-agent-hosts-page-zh-1100-top.png`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-top.png): localized desktop and narrow-desktop header/hero review.
- Chinese 1100 px continuous sequence: [`01`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-01.png), [`02`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-02.png), [`03`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-03.png), [`04`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-04.png), [`05`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-05.png), [`06`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-06.png), [`07`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-07.png), and [`08`](../../artifacts/2026-08-11-agent-hosts-page-zh-1100-flow-08.png). Together with the 1100 top image, these cover scroll positions `0, 650, 1301, 1951, 2602, 3252, 3902, 4553, 4850` over the same 710 px content viewport, including readiness cards, both host cards, generic-host instructions, the host-neutral durable prompt, capabilities, real boundaries, final actions, and footer with overlap.

## Follow-up: explicit GitHub navigation link

### Recall

- User request: add the GitHub link to the website.
- Existing evidence: the public footer already links to the repository under the less explicit `Source` label, while the Agent-host page links directly to the `skills/opencorvus` subtree. The shared top navigation has no repository entry.
- Acceptance: add one clearly labeled `GitHub` link to the shared public header, preserve the footer and Skill deep link, use `https://github.com/yangheng95/opencorvus`, and keep the complete English and Chinese navigation visible at the supported 1100 px desktop width.
- Constraints: preserve concurrent Mission and public-site copy changes; do not add or run UI automation tests; validate through the real built page and a reviewed screenshot; commit only the exact GitHub-link hunk and this follow-up evidence.

### Implementation plan

1. Add the repository link after the existing Docs item in `PublicSiteHeader.astro` so every public route and locale receives it from the single shared navigation source.
2. Run the web checker and production build.
3. Review the English and Chinese Agent-host pages at 1100 px in the real browser, confirming the GitHub link destination, header fit, active Agent tab, reciprocal language control, focus visibility, and absence of document overflow or console errors.
4. Request an independent read-only implementation review before isolated commit delivery.

### Follow-up verification evidence

- `bun run --cwd packages/web check`: passed with zero errors and the same pre-existing unused-variable hint.
- `bun run --cwd packages/web build`: passed and generated 315 pages; existing theme, tolerated top-level-await, and missing `docs -> 404` warnings remain unrelated.
- English 1100 px review: `clientWidth = scrollWidth = body.scrollWidth = 1085`; Agent tab remained active; the focused `GitHub` link resolved exactly to `https://github.com/yangheng95/opencorvus`; the navigation ended at x=913.2 before the language control at x=1008.4; console error collection was empty.
- Chinese 1100 px review: the same no-overflow measurements held; `Agent 接入` remained active; the reciprocal English link remained `/use-with-agents/`; the focused GitHub link used the same repository URL; console error collection was empty.
- Reviewed screenshots: [`English 1100 GitHub focus`](../../artifacts/2026-08-11-agent-hosts-github-nav-en-1100.png) and [`Chinese 1100 GitHub focus`](../../artifacts/2026-08-11-agent-hosts-github-nav-zh-1100.png).
- Independent read-only implementation review returned `APPROVED`; its only residual requirement is that the final alternate-index patch exclude the concurrent Mission and navigation-copy hunks.
