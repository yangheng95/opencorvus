# Independent UI runtime plan

## Recall

- User extended the continuous-goal task with comprehensive UI/UX coverage. The parent agent owns implementation, manual browser interaction, screenshots, indexes and Git delivery. This independent agent audits the owner/API contracts and provides the private development runtime. No UI automation, production edits, additional worktrees or delegation are authorized here.
- Baseline: `c641a01b9410d91d41aa2b0e48b0dac0767cd087`, authorized worktree `C:/Users/hengu/.codex/worktrees/continuous-goal-mode/opencorvus`; start status was clean. The separate user working directory is out of scope.
- Read: `AGENTS.md`, `continuous-goal.md`, previous repeated-recovery Recall, `benchmark-debug-template/SKILL.md`, current goal routes/schema/store, generated SDK, overlay API/selection/event services, existing real-provider audit and isolated runtime/startup primitives.
- Searches confirm that goal HTTP/SDK exists while overlay currently consumes goal mutation events as noops. Task owner ID is the Task ID; Chat/Mission owner ID is the primary canonical Session ID. A Mission draft is not an opened owner. Pausing a goal stops future admissions, not accepted physical work. Detailed audit findings will be reported separately.

## Frozen run contract

- Exact source and actual model: `openai/gpt-6.1-sol` / `gpt-6.1-sol`; model and small_model use this exact pair. All model requests stream.
- Total real Provider request ceiling: **96**, including the single preflight interaction and all subsequent manual Chat/Task/Mission UI acceptance. Every owned server generation receives only the remaining cumulative allowance. No hidden refill or failed-run overwrite.
- Environment: fresh `bootstrapIsolatedTestRuntime("runner")` home/database and a new private Git project. Pair the already authorized `C:/Users/hengu/AppData/Local/opencorvus/data/auth.json` with its sibling `models.json`; never print their contents. Copy inside cleanup protection. Assert catalog projection before the preflight, and check actual request model/stream through the existing `RealProviderAudit` preload.
- Preflight input: `Reply with OK.` through the formal public `/global/chat/start` route. It creates only its genuine visible preflight chat; it creates no continuous goal or Task/Mission acceptance data.
- Inactivity: **180,000 ms of real pending model activity**, based on stream-reader progress and persisted preflight Message/Part changes; human review idle time is not execution inactivity. Runtime already supplies `activity.session_llm_idle_ms=180000` for model execution. HTTP and cleanup boundaries are **30,000 ms**.
- Build current overlay with its declared `build` script. Launch formal `src/index.ts serve` in development source mode, serving its built assets at `/ui`; no independent Vite server. Record the startup occurrence, matching PID, selected URL and `/ui` response metadata. The formal server freezes its UI source, so a requested rebuild refresh uses a new owned process, retaining private DB/project and the cumulative request count.
- Control: the harness alone owns every `Bun.Subprocess` handle. A local artifact control file requests `restart` or `finish`; it never targets arbitrary PIDs or user processes. Record every owned process exit and final port reachability; remove only the two exact copied credential/model files on final shutdown. Preserve database and diagnostic evidence.
- The harness performs no UI actions, assertions, screenshots or goal creation. Parent performs actual manual desktop UI interaction and visual review. Build/typecheck/backend health alone are not UI acceptance.

## Acceptance and current state

Preparation passes only with paired copy, exact projected model, one successful persisted streamed preflight response, actual request audit and a live private `/ui` startup receipt. Later manual UI acceptance remains the parent's responsibility.

### Runtime 1 checker failure and correction

The overlay build passed. Runtime 1 projected the exact model and received the genuine Chat reply with its exact assistant stream settled `eof`. Its concurrent Memory request was still reading. The harness incorrectly asserted every audit reader had already settled at the first persisted Chat completion, then stopped its own server. This was a checker sampling error, not a Provider or production recovery defect. Evidence: `runtime-1/failure.json`, `generation-1-provider.json`, and `settlement.json`. PID 86708 exited, port 7878 became unreachable, both credential/model copies were removed; two real requests remain charged to the frozen ceiling.

Correction: bind the preflight to the real Chat assistant ID and its terminal source reader; keep observing pending auxiliary requests before handing the server to manual review. A fresh runtime 2 has **94 remaining requests from the original 96**, reads the previous closed result for cumulative accounting, and retains runtime 1 unchanged. No goal, Task or Mission was created by the harness.
