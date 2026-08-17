# Mission message origin projection repair

## Recall

- User request: explain and then repair why the backend on port 7878 cannot render any messages for Session `ses_-zUXRNAlzzzB6k6Sno8T`.
- Acceptance indicators: the real persisted Mission operator message projects `originSource=mission.operator`; the canonical conversation view assigns that message stage `user`; scheduler and automation wakes retain their own non-human source and remain Mission-owned; hydrate and live/synchronous message projection use the same origin contract; focused positive tests pass.
- Hard constraints: diagnose storage, hydrate, live projection, card ownership, retry/automation wakes, and related public contracts before editing; fix the shared root cause without a frontend fallback or parallel source; do not create, modify, or run User Interface (UI) automation tests; preserve unrelated dirty-worktree changes; commit and push only this delivery after independent read-only review.
- Read materials: the user-provided `opencorvus.debug.v2` bundle; the live `GET /session/:id/message` and `GET /session/:id/conversation` responses from port 7878; `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-14-session-message-projection-e2e.md`; transport message-origin contract and tests; Session wake persistence; Mission wake/dispatch routes; scheduler wait wake; standalone transcript hydration; persisted/live message bridge; conversation view and Overlay tree writer.
- Repository search: all Mission operator entry points write `wake_reason.source=mission.operator`; scheduler messages and automations write their own `wake_reason.source`; right-sidebar projection writes top-level `extra.source=right-sidebar-conversation` while retaining an independent wake reason; standalone hydrate, synchronous response, and live event paths converge on `originSourceFromMessageExtra`, but Task conversation hydrate had one direct `extra.source` read that required convergence; no product source or focused backend test in the intended change set had pre-existing local modifications. `packages/opencorvus/src/server/routes/orchestrator.ts`, `specs/README.md`, and this month's README already contain unrelated local additions and must be extended without overwriting them.
- Independent agent feedback: none before implementation; the mandatory post-verification independent read-only review remains pending.

## Analysis

### Observable phenomenon

The debug bundle captured 33 persisted root Session Messages and 32 visible-tree Messages, but the Overlay card tree contained one top-level `agent` card and zero `message` cards. A current read from port 7878 likewise returned the complete transcript and `view.messages`, excluding persistence loss and route unavailability.

### Direct trigger

Every message in the selected Mission Session arrived with `channel=mission`. That is valid for Mission assistant and delegated-control messages. The initial operator-authored user Message also arrived with `originSource=""`, so the shared display projector treated it as delegated Mission context rather than direct human input. Timeline regrouping then joined adjacent same-stage rows into one Mission Agent segment.

The later `MessageAbortedError`, scheduler notifications, and automation wait wakes exposed the same projection but did not create it. The raw/tree count difference at capture time came from the incomplete zero-Part assistant row and non-atomic collection, not lost persisted data.

### Data/control-flow root cause

`SessionWake.wakeWithReceipt` persists wake provenance only at `info.extra.wake_reason.source`. Mission operator input correctly stores `mission.operator`; scheduler notification and automation input correctly store their respective sources. However, the single message bridge helper `originSourceFromMessageExtra` reads only `info.extra.source`. Hydrate (`enrichStandaloneSessionTranscript`), live Session Server-Sent Events, synchronous persisted Session responses, Part-first recovery, and conversation view all therefore lose wake provenance in the same place.

The transport contract already defines `channel=mission + role=user + source=mission.operator` as a direct human message and assigns display stage `user`. Changing Mission channels to `main`, teaching the Overlay about `wake_reason`, or stamping another duplicate source during writes would create an incorrect or parallel contract. The bridge must normalize the two existing source-bearing shapes at their shared read boundary: top-level prompt/surface `source` remains display-authoritative when present, while `wake_reason.source` supplies the display origin when no top-level source exists. These are distinct facts and may legitimately differ on a right-sidebar Session wake.

### Why the old paths did not cure it

- Mission routes correctly persisted `wake_reason.source`; they did not feed the field the bridge actually read.
- The August 14 persisted Session projection repair unified synchronous and live bridge use, but both paths shared the same incomplete origin extractor.
- The transport contract had the correct `mission.operator` display rule, but it never received that stored value.
- Frontend regrouping behaved consistently with its inputs; changing grouping would only mask broken participant provenance.

### Impact and exclusions

- Affected: standalone Mission hydrate/history, Mission live message/Part events, synchronous persisted Session projection, cached/DB Part-first recovery, conversation view stage, and resulting Overlay card grouping.
- Preserved: Task-root `main` projection, delegated worker prompts with no direct-human source, right-sidebar `extra.source`, scheduler/automation source identities, Message storage schema, Session kind, public route shape, and UI rendering code.
- No queue, concurrency, retry, restart recovery, Task/Mission terminal convergence, or multi-project isolation fault was found: all reads return the same complete persisted Messages, and the contradiction is deterministic origin projection at one shared pure boundary.

## Plan

1. Extend the canonical message-extra origin projector to accept top-level `source` and nested `wake_reason.source`, with deterministic top-level display-source precedence, and route Task hydrate through that same projector.
2. Add focused positive backend contract coverage proving Mission operator, scheduler, and automation origins project to their explicit stages through the real standalone transcript/conversation view path; prove synchronous/live bridge parity for the operator Message, the legitimate right-sidebar dual-field shape, and Task conversation hydrate.
3. Run only the focused non-UI tests, package typecheck, documentation check, and diff whitespace check.
4. Obtain an independent read-only review of analysis, complete diff, tests, and evidence; address every valid finding and repeat review if code changes.
5. Update this record with results, commit only task files, merge the configured upstream without rebase, inspect the complete outgoing commit set, rerun necessary checks, and push.

## Results

- `originSourceFromMessageExtra` now projects the existing direct `extra.source` and wake-owned `extra.wake_reason.source` shapes through one function. Top-level source remains authoritative when both legitimate facts exist; wake source supplies the origin otherwise. Task conversation hydrate now calls the same projector instead of maintaining a second direct read. No writer, Overlay component, storage schema, or compatibility reader was added.
- The new backend route tests persist a real Mission Session with operator, assistant, scheduler-event, and scheduler-automation Messages, call the production `GET /session/:id/conversation` hydrate route, and prove exact origins plus stages `user`, `mission`, `mission`, `mission`. They also prove synchronous persisted-message and live event enrichment produce the same Mission operator origin, channel, participant Agent Identifier (ID), and owning Session Agent ID; a real right-sidebar prompt overlay retains its handoff wake reason while projecting `right-sidebar-conversation`; and the production Task child-transcript route hydrates nested automation provenance as `scheduler.automation`.
- Initial focused checks passed before review: the first Mission projection test `1/1`; the combined Mission projection, conversation projector, Tool fact projection, and Session conversation history tests `4/4` with `22` assertions; OpenCorvus package `typecheck`; root `docs:check` (`332` operations, `25` groups); and `git diff --check`. After addressing review findings, the expanded Mission/right-sidebar/Task production-path test passes `3/3` with `7` assertions; the complete related suite passes `6/6` with `26` assertions, followed by passing package `typecheck`, root `docs:check`, and `git diff --check`. No UI automation test was created, changed, or run.
- The currently running user-owned process on port 7878 was inspected read-only and was not restarted. It will continue serving its loaded pre-fix code until the operator restarts or replaces that process; the isolated production-route test exercises the repaired source without touching the user's process.
- The first independent read-only review found three valid delivery issues: legal right-sidebar dual-field wake input was rejected, Task hydrate bypassed the shared origin projector, and the ignored spec required explicit staging. The first two are repaired with positive production-path coverage; the spec is force-added by exact path. The second independent read-only review found no unresolved implementation, test, or spec issue and explicitly confirmed the source precedence, shared-path convergence, and production-route coverage.
