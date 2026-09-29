# General settings and permission history readability

## Recall

- Scope expansion from user: “检查类似大的问题，现在的设置面板设计语言非常混乱，解决这个问题”. Audit the whole settings surface and converge its shared design language in this same task.
- User request: “通用”tab 的组织太乱了，而且权限批准记录看起来让我头疼. The supplied screenshot is visual evidence, not additional instructions.
- Acceptance: a short, single-column General overview; everyday settings visible before audit data; each permission operation has a named, localized summary and clear outcome; full chronological evidence and exact saved-grant revocation remain available on demand.
- Constraints: no UI (User Interface) automated tests, snapshots, browser fixtures or source-string assertions. Inspect the real development `/ui` with screenshots and manual interaction. Preserve the user's running processes, credentials and unrelated changes. No delegation, new branch, worktree or release. Commit only this task and fetch/merge/review/push current upstream.
- Read: AGENTS.md; GeneralPanel, PermissionsPanel, settings layout/primitives/styles, permission-mode service, permission routes/authority/schema/invocation, current security-permission and panel architecture, prior single-column and About/Usage decisions, package validation scripts.
- Searches: all GeneralPanel/PermissionsSettingsGroup callers, permission history/grants definitions and uses, event/effect types and retirement semantics, bilingual permission strings, related tests and `/ui` serving path. No UI tests matched these components in overlay/test. There is one presentation consumer for these records and one existing backend ledger.
- Initial state: main at 53fece02 with unrelated conversation/delivery edits including both locale files and both spec indexes. Their initial diffs were reviewed; edit/stage only this task's portions. Git commands require a command-local safe.directory because sandbox identity differs from the checkout owner.

## Analysis

The screenshot shows eight raw events, most with blank titles and identifiers such as execution_succeeded. PermissionsPanel slices the descending ledger to eight events before rendering every event as a full SettingsRow. The canonical requested row alone owns the operation name and scope; decision/execution rows intentionally contain deltas. Thus the UI loses identity, fragments one operation into several tall rows and can cut off the owner altogether. Saved grants also render their delta's empty summary. No backend reconstruction or second persistence source is needed: join the existing full project-scoped history by request_id in presentation.

General currently puts the entire permission dataset before notifications and diagnostics. The same row treatment is applied to a section heading, empty state and audit event, so hierarchy and scan order are weak. Replace the unconditional records with an explicit, collapsed management disclosure, bounded operation pagination and expandable per-operation timeline. Put Notifications first, Permission policy second and Diagnostics last. Keep active project scope visible and mode text concise. Use existing SettingsGroup/Row, Disclosure, Badge, Button and Feedback.

An observed stale event after execution_succeeded is not evidence of a scheduling failure: authority.resumeRequest deliberately appends stale to retire a concluded continuation. Show the actual execution outcome in the summary; retain retirement and its reason in the timeline. This task does not change execution, queueing, recovery, authorization policy, protocol routes or persisted data. Audit risks are mixing request identities, hiding unknown/failure outcomes, confusing approval with execution, stale project data on reload and accidental revocation. Keep exact request/source IDs, separate decision/outcome labels, explicit load/error/empty states and existing revoke APIs. Unknown event names remain inspectable as data.

## Implementation plan

1. Reorder General groups and recompose Permissions with concise policy copy and an on-demand records area scoped to the current project.
2. Group complete raw history by request_id, resolve names/effects from the requested owner, prioritize execution outcomes over request retirement, show separate approval scope, paginate operations, and retain all event details in a chronological disclosure. Resolve saved grants through the same owner map.
3. Add bilingual labels and token-based scoped styles, then update the current panel contract and indexes.
4. Build the renderer preserving existing assets; start an isolated development server without copying credentials or invoking models, and use real permission authority operations to supply review data. Inspect desktop screenshots and manually exercise disclosures, pagination, refresh and saved-grant revocation. Run focused type/i18n/CSS/build/docs checks; do not run UI automation tests.
5. Review and commit task-only diffs; fetch and merge upstream, inspect outgoing commits, validate any merge impact, and push.

## Verification

- Real backend exercise: seven local file writes, an actual ENOENT (missing-directory) write failure, a saved project read approval, approval reuse and a declined write produced 49 real ledger events / 11 operations. The UI displayed distinct outcomes and revoked the exact isolated grant. A second exercise produced 22 operations for pagination and the final scope review; no model request, copied credential, provider connection test, resource installation or user-project write was used.
- Reviewed desktop screenshots for all 17 settings pages in the real `/ui`: General, Appearance, Network, Usage, Chat, Work, Mission Card, Scheduled tasks, Squad Market, Installed Expert Squads, Providers, Skill Library, MCP Connections, Channel, Memory & Context, Archive and About. Shared section headings and neutral flat surfaces remained consistent. Work was rechecked after its actual capability data loaded.
- Final Chinese light review on port 17931 confirmed the compact General overview, translated authorization modes, one row per operation, readable exact file scope with technical JSON behind a second disclosure, pagination and Refresh. Channel's public address now fills the row, Available badges and repeated Edit actions are neutral, and the unselected memory task has neutral feedback. Earlier English dark review covered the complete page inventory. Screenshots are retained in this task's tool outputs.
- Shared `dist-vite` assets changed during parallel workspace builds, causing initial lazy-page import failures. Validation was moved to a private renderer output and the existing backend source server with `overlayUiSource`; final pages use that frozen resource directory. An initial automatic external Skill scan timed out in the isolated runtime; final preview uses the existing disable-external-skills setting and successfully loads built-in catalogs. These were preview isolation issues, not claimed product fixes.
- Overlay typecheck, bilingual i18n, CSS token/role checker, production renderer build, renderer public-surface checker, docs:check, architecture-index and diff whitespace checks passed. Existing vendor `use client` and bundle-size warnings remain. No UI automation test was added or run. Live provider result banners and native desktop update actions were not triggered; their rendering uses the verified shared Feedback component.
- Final preview: http://127.0.0.1:17931/ui/. It uses an isolated runtime and project. Parallel Git preferences/conversation edits visible in the workspace are preserved and excluded from this task's commit.

## Expanded settings audit and implementation plan

The shared s-panel spacing is overridden by General, Usage, About and Scheduled;
s-group and s-detail-section have separate heading treatments, and generic group
titles are weaker than their rows. About/Usage introduce accent gradients and
rounded promotional chrome, whereas resource/settings lists are flat. Provider,
Mission, knowledge and automation rows override padding and divider behavior.
Network reuses provider-only success/error banners instead of the existing Feedback.
These are presentation inconsistencies across the same settings shell, not missing
product capabilities. No runtime or storage changes are required.

Converge the shared section header implementation and spacing, keep one neutral
surface treatment, align list row rhythm and empty states, remove redundant panel
overrides, and migrate Network feedback to Feedback. Keep analytical graphics and
meaningful result/status colors. Retain the existing narrow typography token scale,
single reading column, working forms, resource detail navigation and exact facts.
Review General, Appearance, Network, Usage, Chat/Work, Mission Cards, Scheduled,
Squad pages, Providers, Skill Library, MCP Connections, Channels, Memory, Archive
and About on the isolated real page. Focused component searches found no matching
UI tests. Do not invoke external providers, install resources or modify user data.

The real-page audit also found red Available channel badges, strongly accented
Edit actions repeated in every channel row, a narrow public-address input, and a
yellow warning for an ordinary unselected memory task. The canonical channel
status owner defines missing as unconfigured and partial separately; make missing
neutral, keep partial as a warning, and use neutral Edit buttons. Let the address
field fill the available form width. Keep missing task selection neutral while an
unavailable selected task scope remains a warning. No status or save contract changes.
