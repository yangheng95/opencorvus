# 07 — Overlay Panels And Task Evidence

> Current sources: `packages/opencorvus/src/engine/model.ts`,
> `packages/opencorvus/src/workbench/board.ts`,
> `packages/overlay/src/store/board.ts`,
> `packages/overlay/src/components/Board.tsx`, and
> `packages/overlay/src/services/tree-writer.ts`.

The Overlay presents durable Task, Delivery Slice, Session, message, Artifact, and review
evidence. It does not project a host workflow, scheduler stage list, or
step/phase execution tree.

Backend reachability and selected live-event-stream reachability are independent visible
facts. The connection monitor owns the backend health signal; the Server-Sent Events (SSE)
manager owns stream liveness. `ConnectionBanner` may combine their placement but must label
the failing boundary exactly: an unreachable backend is never described merely as a stream
that is still connecting, while an online backend with a missing stream is explicitly a
stream reconnect condition. The SSE owner also publishes whether the selected source currently
expects such a stream, so an empty New Chat cannot manufacture a reconnect warning.

## Current Surface Ownership

| Surface          | Source                                                                                   | Responsibility                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work Ledger      | global task summaries                                                                    | Select projects, Missions, tasks, Chat conversations, and Work conversations.                                                                                                                                                                                                                                                                                                   |
| Conversation     | conversation view plus live protocol events                                              | Render exact user, projected-agent, tool, interaction, and review messages in `orderKey` order.                                                                                                                                                                                                                                                                                 |
| Agent progress   | conversation agent-session projection plus its bounded persisted activity facts          | Replace each child session's repeated top-level message rows with one ordered, scrollable progress card in the Conversation grid. Identity, lifecycle, input preview, and Text/Tool/Patch/File/error activity share one canonical session record, so transcript-window truncation cannot empty the card. The card opens that exact session's full transcript in the Right Dock. |
| Agent transcript | conversation-agent projection plus the task/session route for the selected child session | Render one programmatic `Squad agents` Right Dock tab. Its inner primitive-owned Agent selector lists the canonical child sessions, while the selected session alone loads and renders its complete canonical transcript. The tab is not a user-addable tool and does not copy messages into local UI state.                                                                    |
| Requirements     | `TaskBoard.requirements`                                                                 | Show the active structured requirement snapshot.                                                                                                                                                                                                                                                                                                                                |
| Architect data   | `TaskBoard.architect`                                                                    | Preserve the active solution and contract graph for canonical task evidence without mounting a Right Dock panel or frontend launcher.                                                                                                                                                                                                                                           |
| Goals            | `TaskBoard.goals`                                                                        | Show each current Delivery Slice revision with independent activity, evidence, review-association, and Completion Decision acceptance facts.                                                                                                                                                                                                                                    |
| Review evidence  | domain review artifacts, Host observations, and exact Orchestrator completion refs       | Show exact review/observation facts and changed-file navigation. A verdict is shown only when an Orchestrator-owned durable fact explicitly records it.                                                                                                                                                                                                                         |
| Terminal         | project-scoped terminal profiles plus `/pty` lifecycle and output stream                 | Render interactive shell sessions in the Right Dock without creating a second process, directory, or output source.                                                                                                                                                                                                                                                             |
| Mailbox          | global registered-project `protocol_event` projection                                    | Group durable squad activity reports, notifications, and canonical system notifications by owning project directory; Goal facts remain a Board read projection, while Task lifecycle events remain durable protocol facts.                                                                                                                                                      |
| Activity panels  | task- or project-scoped APIs                                                             | Explorer, diff, preview, screenshots, Mailbox, and extension surfaces.                                                                                                                                                                                                                                                                                                          |

Requirements and Goals are independent Right Dock panels that read one
`boardStore.board` projection. They do not keep local copies of task scope data.
The same Board may retain Architect facts, but the production Right Dock
catalog, Environment shortcuts, workbench panel domain, and mounted view set do
not project an Architecture page.

Review change groups identify their exact modifying agent and dispatch lineage.
Persisted changes cite the exact Session and Slice revision subjects through
their Artifact locators; live Tool/Patch changes retain their owning Card Tree
`agentID`. A Slice revision is evidence subject metadata, never an execution or
diff-loading owner.

The desktop Review workspace keeps one canonical split surface. The selected
text diff owns the remaining leading width and one bounded two-axis native
scrollport with visible theme-painted scrollbar geometry. The trailing file
pane keeps the canonical searchable change inventory and its own vertical list
scrollport. Status filters wrap within that file pane and the non-text filter
occupies its own complete row, so neither control set can compress or clip the
other. Selection and filtering continue to drive the same `DiffPreviewPanel`;
there is no alternate Review renderer or copied diff source.

The exact change-group collection rendered by a Review inventory is also that
inventory's diff-resolution authority. Live Card Tree Tool/Patch groups keep
their complete text bodies in this collection, while persisted Build-observation
groups may hydrate object bodies through their Artifact locator. The preview
must not discard the selected collection and reconstruct a persisted-only view;
an explicit live collection is also sufficient resolution scope for an ordinary
Chat without a Task identity. Standalone Task diff views without an inventory
require Task scope and use the canonical current persisted collection directly.

The Agent transcript panel is opened only from a child-session progress card.
Every child session for the selected source is aggregated under one top-level
`Squad agents` Dock tab. The inner Tabs primitive reads the canonical
conversation-agent projection, and both progress-card clicks and inner-tab
selection write the same selected `sessionID`. Task conversations load the
exact `/task/:taskID/conversation/session/:sessionID` view; standalone Chats
load the selected `/session/:sessionID/conversation` view. The main progress
card tree's global visible revision never participates in this request
identity. Live reload follows only the selected canonical Agent record's
persisted transcript revision, so unrelated Sessions, TODO progress, scrolling,
and message-part deltas cannot redownload the complete selected transcript.
The main progress grid, inner Agent selector, and Right Dock transcript remain
presentations of one backend session/message stream rather than parallel
frontend Agent lists or message stores.

Both the main Conversation and selected Agent transcript use the same explicit
content-change follow controller. A canonical transcript revision and the
controller's one native `ResizeObserver` over its current direct content boxes
schedule the same bounded bottom pin; the observer covers descendant Markdown,
code, media, and disclosure layout that settles after the data notification.
Browser layout may change `scrollTop` before or after either notification, so
movement alone never releases follow mode. Upward wheel, keyboard, and touch
input release it immediately; an active native-scrollbar gesture releases it
when the viewport actually moves upward. DOM replacement therefore cannot
masquerade as manual upward scrolling regardless of event order. Reaching the
bottom re-arms follow mode.

Selected-Agent visibility is owned only by the horizontal Agent tab strip.
The strip reacts to the selected Session identity and ordered Session-ID set,
then changes its own `scrollLeft` just enough to reveal that tab. Live activity,
status, target-message, and timestamp updates must not call
`Element.scrollIntoView()` or write any ancestor's vertical scroll position,
because the transcript follow controller is the sole vertical scroll writer.
Agent Trigger component identity is likewise keyed only by canonical
`sessionID`; live record fields update the mounted Trigger's presentation and
must not unregister it from the Tabs collection. The selected Session changes
only through an explicit progress-card, inner-tab, or inner-menu action, or a
real selected-source reset.

The compact Agent Rail uses the shared Kobalte Tooltip as its only hover and
keyboard-focus detail surface. That Tooltip opens deterministically to the
right of the active tick with an eight-pixel gutter and no placement fallback;
its identity and bounded input preview remain viewport-constrained, while the
same trigger continues to own stepped proximity and exact-card navigation.

## Typography Hierarchy

Panel typography follows [Overlay typography](overlay-typography.md), which is
the sole authority for font-size roles, line-height roles, ownership, and the
Interactive Artifact boundary. Panel surfaces may own layout, color, spacing,
and context-specific weight, but they cannot define another typography scale
or resize a shared primitive locally.

The chat-header Environment Information control owns one controlled Kobalte
HoverCard. A selected Task, Chat, or Mission presents it once when that exact
selection first publishes visible Conversation Card Tree data; an empty selection
waits for its first visible streamed card instead of opening from source identity
alone. Pointer hover also presents it transiently and Kobalte owns the safe pointer
region between the trigger and portaled content. Leaving both closes an unpinned surface.
Clicking the Environment button pins the same visible surface; clicking again
unpins and closes it. Explicit child-feature navigation, the canonical
empty-home projection, and the complete Settings surface hiding the Conversation
anchor also close it and clear the pin. Every existing or newly registered
Settings section inherits that one surface-level lifecycle and never owns an
Environment-specific dismissal path. A new Right Dock opening edge dismisses
the currently visible Environment surface and clears its pin;
after the Dock is open, the operator may explicitly reopen Environment and both
surfaces retain their responsive coexistence. Closing the Right Dock does not
mutate Environment visibility.
The hidden-anchor transition closes the existing controlled HoverCard before its
Portal can survive without usable anchor geometry. Environment sits directly
after the editor launcher and the Right Dock button remains the trailing
chat-header action. The HoverCard retains native `bottom-end` placement and uses
Kobalte's cross-axis shift with the shared trailing-control-width-plus-header-gap
token, so its right edge occupies that trailing toolbar span instead of covering
the wide readable Conversation lane. The Environment instance opts into Floating UI's animation-frame
anchor tracking so its portaled position follows the trigger continuously while the
Right Dock width transition moves the chat header; other poppers retain event-driven
position updates. While it is open, the named `chat-workbench` container
reserves inline-end readable-content clearance at and above the existing
900-pixel desktop boundary. The one `#chatScroll` viewport, its physical right
edge, and its native scrollbar remain full width; only the inherited
message/Composer/empty-home content insets transition through the shared slow
motion token while the HoverCard reveals from its trailing edge. The canonical
reduced-motion preference makes both changes instant. Below that boundary the
same portaled HoverCard reserves no content clearance and renders above the
message panel through the canonical overlay layer. Environment and Right Dock
continue to read the same board, worktree, Version Control System (VCS), and
task-evidence sources without sharing visibility state.

The left Projects panel and Right Dock are stable desktop layout roots rather
than conditionally mounted overlays. Their canonical collapse/open signals
project onto `data-collapsed` or `data-open` and transition the owning
flex-basis and width through the same slow motion scale as the Environment
conversation squeeze. This continuously releases or reserves Workbench width
instead of removing a panel with `display:none`. Closed roots remain mounted
for the transition but are `inert`, accessibility-hidden, removed from tab
order where applicable, and non-interactive at zero width. The canonical
reduced-motion preference makes these layout transitions instant. Persisted
pane widths and the existing resizers remain the only width sources.

Environment Information embeds one compact `TaskProgressBar` projection only
when the canonical board contains Goals. Its header exposes the Goals shortcut,
one Completion Decision accepted/total summary, and disclosure. Goals is a peer Environment title
and does not sit beneath a presentation-only Task classification. The shortcut
is text-only and does not repeat a decorative target icon. Its body contains the actionable Goal rows in
one shared acceptance-icon/identifier/title grid, so every `#G…` identifier and
every title has a stable left axis without whitespace padding. Activity,
review-association, and acceptance facets remain independent facts rather than
additional Goal states. The
conversation transcript keeps one persistently available native vertical
scrollbar for scrolling, position discovery, and direct dragging. This
discoverability contract is identical for Chat and Mission because both render
through the same `#chatScroll`; fullscreen underflow is kept quiet by the
canonical low-contrast theme paint rather than by changing the overflow
contract. `#chatScroll` fills the complete bounded Conversation shell so its
native track reaches the panel bottom, contains boundary overscroll, and remains
the sole transcript overflow owner. The one real Composer is a bottom-positioned
sibling layer outside transcript flow. Its rendered block size is projected as
the transcript's bottom clearance so the final message stops completely above
the input. Decorative Composer paint is pointer-transparent and ends before the
measured native scrollbar gutter; only real Composer controls intercept input,
so ordinary message-region wheel, keyboard, track dragging, and direct pointer
hit testing continue to reach the same scroll viewport. The Composer and message
cards consume the same inherited start/end inset contract. Composer resize
updates the existing clearance projection and notifies the follow controller so
a followed conversation stays pinned. The canonical overflowing scrollbar track
and thumb paint do not depend on pointer hover or descendant keyboard focus.

The floating scroll-to-bottom Button is portaled into the same Composer host
but does not use that full-width host's midpoint. Its horizontal coordinate is
the midpoint between the inherited message start and end inset edges, so the
Button, Composer, and message dialog share one center-axis source while the
desktop Environment panel reserves inline-end clearance. Opening or closing
that panel animates the shared inset projection; compact Workbenches keep the
panel as an overlay and therefore keep the ordinary centered axis.

The Environment Popover owns an independent content disclosure inside the
still-open Popover. Its collapsed header keeps the canonical
`summarizeChangeGroups(currentChangeGroups())` additions and deletions visible;
it does not copy or recompute diff totals. Expanded project changes, local
directory, branch, commit/push, and Git host facts belong directly to
Environment Information and do not acquire a synthetic Runtime parent.

Goals, Requirements, Workspace, and Tools are peer classifications below the
Environment Information header. The header title and every peer
classification consume the shared body role. Named Goal rows, Worktrees,
Tools, Sources, and operation feedback also use body; compact counts, status,
and technical metadata use caption. Every classification and named region uses
one regular, muted, 32px title-row recipe, and every category indicator
occupies the same far-edge 16px column with a quiet resting opacity. Environment facts,
Subagents, classified task resources, and Sources are sibling menu regions;
every adjacent region is separated by the same quiet one-pixel border and
compact six-pixel block inset. All title and content text in the Environment
Popover starts from one global leading text axis; leading icons occupy the
reserved column to its left. Goals owns its existing summary, fold action, and
canonical Goal rows directly; Requirements is a direct classified launcher;
Workspace owns Worktree; Tools owns Browser, Review, Files, Screenshots, and
other resource-backed Right Dock shortcuts. Architecture remains a Board fact
but has no Environment classification or launcher.
Collapsible peers use the shared Section primitive with an end indicator, and
every child body starts from the common flat content axis rather than adding a
nested category indent. The catalog, board, worktree service, and task-scoped
evidence remain the only sources for which rows exist.

The conditional Subagents menu region reads the selected conversation's
canonical child-session records through the same conversation-Agent projection
used by the main progress grid, Agent Rail, and aggregate `Squad agents` Right
Dock. It shows active and terminal counts in one compact row. Activating that
row selects an exact real child `sessionID` before opening the existing Dock;
the Environment surface never creates a generic unselected Subagent panel, a
second session list, or another transcript source.

The Overlay radius scale remains owned only by
`styles/tokens/design-language.css`. At scale one, soft containers use eight
pixels and ordinary rounded primitives use twelve pixels; the Composer shell,
agent cards, form fields, Buttons, and reusable popup surfaces share that
ordinary page-surface tier. The single `.workspace-main` macro frame clips its
children to one extra-large upper-left corner beside the aligned Work Ledger
brand row; its other outer corners remain square. The continuous rail material
continues behind that curve. The existing top and left physical borders paint
one theme-aware contour on the actual outer quarter-circle. That
Workbench-specific contour uses slightly wider low-alpha coverage than the
shared one-pixel divider so its diagonal remains continuous at fractional
desktop display scales without becoming visually heavier. The continuous rail
material owns every pixel outside that contour: `.panel-body` paints the fixed
rail ambient material across the complete panel row, and the left activity shell
remains transparent over that single backing owner. The rounded cutout therefore
reveals the same material as the visible rail instead of the global body color.
The Workbench paints no exterior shadow, glow, haze, or directional depth.
Transparent edge borders, inset duplicate contours, exterior projections,
radius-sized blur fields, and split directional gradients are excluded because
they produce doubled, tapered, or shadowed corner geometry. No square child or
second background layer participates in the boundary.
Extra-large remains reserved for this Workbench frame, modal dialogs, and other
explicitly rounded macro surfaces, while zero and pill semantics retain their
existing values.
Surface-specific code may choose the semantic token but cannot reintroduce a
local radius fallback or another paint owner at the Workbench boundary.

The single `ImagePreviewHost` remains the modal media viewer for Markdown,
message attachments, Composer attachments, browser evidence, and Screenshot
Browser images. It specializes the shared Kobalte-backed Dialog with the
extra-large modal radius, clipped immersive canvas, detached filename and
view-control surfaces, and an independent close action. Zoom, width fit,
whole-image fit, original size, copy, pan, and modified-wheel zoom remain
behaviors of that one host; consumers cannot introduce another lightbox or
parallel image source.

The canonical TextField primitive also owns the regular body font weight for
entered input and textarea text. Parent headings or emphasized layouts cannot
leak heavy typography into editable content, and feature surfaces such as
Composer do not carry a second corrective font-weight rule.

Every repeated collection inside Environment Information uses one bounded-list
surface. Goals, Worktrees, Tools, and Sources retain their complete canonical
arrays, show at most ten item rows at once, and expose any remaining items
through collection-local vertical scrolling. Shorter collections keep their
natural height. No collection slices its data, adds a synthetic overflow row,
or transfers overflow ownership to the complete Environment Popover.

Environment Information, Goals, Requirements, Workspace, and Tools retain one
aligned title structure. Peer classifications share one compact 32px title-row
height and a far-edge 16px disclosure or navigation glyph;
their title and body text leading edges remain on the Popover's global text axis.
Classification titles reserve no leading icon slot. Collapsible title controls
and direct launchers share that trailing column; functional icons belong only
to body rows on the left side of the global text axis. Category glyphs remain
quietly visible at rest, strengthen on hover or keyboard focus, and never move
the title text. The Environment add action occupies the primary header's
dedicated trailing column independently of category indicators or collapsed
totals. Classification title rows retain transparent hover/focus chrome;
interaction is communicated by text and the stable trailing affordance rather
than a one-off rounded background wash. The launcher home predicate excludes
every selected Session as well as every selected Task, so opening an empty
Mission keeps the chat-header anchor mounted and lets the existing
source-identity presentation open and expand the canonical Popover.

Git actions in Environment use the project-scoped `/vcs` contract. The
`/vcs/commit-message/stream` Server-Sent Events (SSE) route streams one editable
subject from the canonical Git diff and recent repository subjects through the
configured helper model. `/vcs/commit` stages the complete current working tree
and commits the exact displayed message; `/vcs/push` publishes through the
branch's configured upstream. Each completed mutation reloads canonical VCS
information instead of maintaining optimistic branch or dirty-state copies in
the Overlay. The Environment row is only the trigger: the current branch,
streamed editable subject, regenerate control, and applicable Commit / Commit &
Push / Push actions live in the shared modal Dialog primitive, never in an
inline expansion or a second VCS surface.

Work Ledger 顶层只保留 New Chat，并与标题栏和命令面板共享同一个 global launcher。该入口
以 Chat/Code 作为初始模式；Work 由同一个 Composer 内的 Code / Work selector 选择，Mission
继续通过显式 reference 或 Chat 的语义 handoff 进入，禁止在 Work Ledger 重复创建 mode-specific
入口。每次调用只清除会话与 Project runtime selection、进入 directory-free launcher 并聚焦
composer；没有实际提交时禁止调用任何 Project 或 Session 写路由。首次 Code / Work 发送分别
通过 `/global/chat` 或 `/global/work` 原子创建一个新的 dated UUID 临时 Project 与 Session；
directory-free launcher 中显式选择的 Model 作为这两个创建请求的可选 `model` 字段传递，并在
返回前写入根 Session 的 config overlay。未显式选择时请求保持继承语义；后续 prompt 禁止再次
携带临时 Model，而是统一通过根 Session overlay、Project config 与 global config 的既定优先级
解析。Provider catalog 只负责证明 Model 可用，不能替代这条持久化配置来源。
首次显式 Mission 发送才通过 `/global/projects/anonymous` 创建并激活它的独立 Project。
Directory-free launcher 的 reference catalog 只读取 built-in 与 user-global Agent Squad /
Mission Skill，通过 `/global/composer-references` 投影最多二十项的 Expert Squad 首页，并通过
bounded server search 查询其余项，不需要也不得为查询目录而创建
Project 或 Session；Project-backed Composer 继续使用包含当前 Project scope 的既有 catalog。
冷启动先保留当前运行目录或恢复用户持久化目录；没有这两者时只读取一次 Project discovery
并采用非空的显式 launch directory，否则保持 directory-free。Close Project 与删除活动 Project
后的离开路径同样进入 directory-free，不分配替代 Project。断线重连保留当前运行目录，不重新
发现、切换或分配 Project。
在 Code 与 Work 中，完整的 `@squad(...)` 或 `@mission(...)` reference 都由同一个 submit
route resolver 直接启动 Mission，前者把精确 Squad identity 写入 Mission 的 visible catalog，
后者在 launch 时冻结当时授权的精确 identity set，但不把完整 catalog 投影进 Composer 或 Mission
context。没有结构化 reference 的普通 Code / Work 请求仍进入各自 conversation；
当用户在自然语言中明确要求启动或转交 Mission 时，primary assistant 使用可见的
`panel_wake_mission` handoff，禁止用 host 关键字匹配制造第二套路由来源。
Chat 与 Work 共用一个
right-sidebar conversation session、message、attachment、tool、Skill、Model Context Protocol
(MCP) server 和 lifecycle 实现；持久化的 `metadata.conversation.experience` 是唯一身份来源，
分别映射到 `/coding/chat/**` 与 `/coding/work/**`。Work 的独立 harness 拥有自己的 primary
prompt、默认 Skill/MCP assignment、typed office tool inventory 与 parent-only delivery policy，
同时继续复用上述 conversation 基建；它通过
`BriefcaseBusiness` identity 在 Dock、Composer、Conversation header、Work Ledger 和 Archive
保持一致。Work prompt 默认先规划最有利于审阅和复用的 interactive artifact 交付面，优先
一个完整 primary artifact，并只在能提供不同证据、比较、顺序、结构或演示视角时增加互补
artifact。Project 行内 New Chat 仍显式调用 project-scoped Chat route。因此每次真正提交的
全局工作都有独立 Project owner，不会与上一次全局 Chat、Work 或 Mission 互相污染；未提交的
launcher 不会出现在数据库或 Work Ledger。

The left Work Ledger has one `Projects` section for every unpinned directory.
Named and dated anonymous Projects both render through the same canonical
`LedgerList` and `ProjectLedgerGroup` path, including each Project's complete
Chat, Work, Mission, and Task hierarchy. Anonymous directory identity affects
only its display label and existing promotion action; it does not create a
second `Chats` section, wrapper, renderer identity, or one-list exclusion.
Explicitly pinned named Projects remain complete groups in the separate `Pinned`
section and are omitted from Projects exactly once.

Every Mission, Task, Chat, and Work row exposes the same persisted pin action in
its hover/focus action rail. The transparent resting rail is absolutely anchored
to the row and contributes no permanent grid width; only a visible activity
indicator occupies the trailing column. Hover, focus, or keyboard action-open
temporarily reserves the rail inside the title body while the row bounds,
leading icon, trailing indicator anchor, and adjacent-row positions remain
unchanged. The row rail has no rename pencil; double-clicking the canonical row
main button invokes its existing domain rename dialog while single click retains
selection. Pinned items remain inside their canonical Project group or one-list
projection and sort before unpinned siblings without changing activity time.

Work Ledger and the selected Conversation header expose one binary activity
projection for Task and Mission: `Running` while execution is active and
`Not running` otherwise. A running row may use the shared spinner; an inactive
row has no success, failure, cancellation, or completion lamp. Raw Task
lifecycle remains in the transport only for diagnostics, timestamp validation,
recovery, and explicit operator cancellation. The interface never converts
`completed`, `failed`, or `cancelled` into a business status, and Mission
acceptance remains an evidence judgment outside this activity projection.

Work Ledger selection projects one complete visible ancestor path without
creating expansion or Project-selection state. A Mission whose canonical child
Task array contains the exact selected Task keeps its existing child drawer
open after pointer and keyboard focus leave. Every Mission shell projects its
own transient pointer-within fact from pointer enter/leave across the complete
row and child drawer; every other Mission uses that fact or explicit row focus
for transient disclosure. Drawer height follows that disclosure contract,
while action-rail presentation never changes row bounds, running-indicator
occupancy, or adjacent-row positions. The exact
selected Task, Mission, or Chat is the only Work Ledger row that projects the
shared navigation-row active treatment and `aria-current`. Its Project header
retains ordinary hover and keyboard-focus feedback but never copies the active
directory into a selected surface or accessibility state. Project collapse
remains presentation-owned: selecting a descendant neither collapses nor
expands the Project, while an already visible selected Mission child keeps its
Mission drawer open after pointer and keyboard focus leave.

The selected durable item owns one declarative Conversation header identity.
Its title sits beside one Kobalte ellipsis menu containing exactly Pin/Unpin,
Rename, and Archive, and the menu delegates to the same Work Ledger/domain
writers as the row interactions. With no selected durable item, the menu is
absent. The Conversation itself is one white extra-large-radius surface inset
from the ambient Workbench canvas; header and content share that frame instead
of creating separate cards or local geometry state.

When the selected right-sidebar Chat or Work starts a durable Mission through
the typed `panel_wake_mission` action, the backend keeps two real Sessions: the caller conversation
—either Chat or Work—
and the independently configured Mission. After the Mission wake message is
persisted, one `mission.handoff` fact is projected through the existing global
Work Ledger Server-Sent Events (SSE) stream with the persisted caller experience.
That page-global stream also carries typed Mailbox invalidations; subscribers
share one transport and independently reread their canonical projections rather
than opening domain-specific long-lived connections. Together with the one
selected-source replay stream this bounds a page to two persistent connections.
If that exact caller conversation and experience are still
selected, Overlay activates the Mission inside the already-mounted Conversation
workbench and hydrates its canonical transcript before replacing the rendered
card tree. A user navigation that happened before the handoff is never
overridden. This event does not select workflow from prompt text, merge Session
identities, create another conversation renderer, or replace the terminal
Mission receipt written back to the caller conversation.

Mission is a coordinator and never owns an active expert-squad profile. Composer
selection writes only the non-empty immutable
`metadata.mission.visibleExpertSquadIDs` authority snapshot. Mission
`capability_search` searches only that snapshot and returns no more than five
bounded identity/display references per call; `panel_expert_squad_inspect` accepts
one held ID and returns bounded selector guidance plus no more than twenty workflow
summaries. Settings-only capability graphs, Agent inventories, package paths,
hashes, README bodies, selector instruction bodies and the complete held ID set
never enter a Mission tool result. Repeated search pages may accumulate by real
tool-call count, but one response no longer grows with total installed Squads.
Mission assigns each outcome-complete Task to one fixed
Squad, and creates another Task only at a genuine Squad, accepted-evidence,
operator-authority, or explicitly requested lifecycle boundary. Every
`panel_create_task` call supplies one explicit fixed `promptProfile`. The created
Task, not Mission, is the execution and capability-projection boundary.

The Mission Panel exposes `query_task_artifacts` for complete catalog paging.
For a Session-bound model caller, the Host binds the exact persisted terminal
row returned by `panel_query_task` earlier in the same physical Turn; the model
does not copy a terminal event identifier. A stateless Panel or gateway request
instead binds the current canonical terminal occurrence at request start. Both
paths use the same current terminal-lifecycle fact and revalidate it before and
after each numbered page while the Host alone retains, authenticates, and
replays the underlying opaque frozen-membership catalog cursors.
One physical Turn is the exact Session input occurrence named by the assistant
Messages' common `parentID`; sequential streaming Tool-call Messages produced
while resolving that input do not create new Turns. Mission completion evidence
therefore owns an interactive Artifact when the Artifact-producing assistant
Message and the completion assistant Message belong to the same Mission Session
and have that exact common parent. Equality of those two assistant Message IDs
would incorrectly reject the required publish, query, read, then complete Tool
sequence, while a different parent remains a different occurrence and is never
accepted as completion evidence.
`panel_read_task_artifact` performs exact canonical body reads under
same-Mission terminal-child authority. `resume_task` is the separate mutation for an
evidence-backed acceptance gap: it binds the reviewed terminal occurrence and
fully read locators, writes one visible Mission participant message, and
returns the durable same-Task wake/receipt identity. `send_task_message` keeps
its ordinary terminal conversation behavior. These are model-visible control
facts; Overlay renders the existing Task, message, activity, and Artifact
projections and does not invent a second acceptance or resume state.

The embedded Terminal is a normal Right Dock activity panel. Shell selection is
resolved by the server-owned terminal profile registry; the project-scoped PTY
host owns process lifecycle, buffering, input, and resize; authenticated output
streams through the shared HostTransport. The Overlay only owns emulator view
state and explicit session selection.

The Mailbox is a normal left-sidebar activity beside Projects. Its
directory-free list, acknowledgement actions, and change stream stay mounted
and project one global view over protocol events
whose Tasks belong to registered Projects. Every item carries its canonical
project worktree, and the Overlay groups rows by that directory while owning
only sidebar selection and local search/view state. The selected project
directory is not Mailbox transport context and never filters the global
projection. It is not a Right Dock tool or Environment Information shortcut. The Overlay has
no toast center or event-oriented
notification route. Unread, active Mailbox items whose backend-owned
projection already admits them into the user-visible Mailbox are the single
source for the host badge and native desktop notifications. This includes
progress, status, notification, and attention-bearing mail; read and archived
rows never enter that delivery path. Canonical system items
project the owning Task title as their short subject and a real payload message
as their body; raw protocol event types are never display content.
When desktop notifications are enabled and the host permission is still
`default`, the same projector requests permission before its first real send;
permission acquisition is not dependent on manually toggling Settings. On
Windows, the Tauri bridge registers the configured OpenCorvus Application User
Model ID (AUMID) for both installed and portable executables, submits through
the Windows Runtime toast manager, and reports the real native submission
result to the projector. Other desktop targets keep the Tauri notification
plugin behind the same host command contract. Local action failures
and success diagnostics write to `AppLog`; they do not form a second Mailbox
history. The same serialized notification projector raises the canonical
left-sidebar launcher attention for each newly observed eligible item without
switching the operator's current sidebar activity. Its first global snapshot
is a no-replay baseline, and its ephemeral sidebar-presentation bookkeeping is
separate from host delivery bookkeeping so a deferred native notification can
retry without reopening the sidebar. The mark-all-read action appends one
canonical read acknowledgement for every active unread registered-project item in one
transaction; it is not limited by the current page or search. Each Mailbox row
uses the canonical Kobalte
Accordion to reveal its complete message body inline while preserving the
compact summary when collapsed. Expanding an unread row appends the same
canonical `read` acknowledgement used by Open Task; the blue avatar dot and
strong subject therefore disappear after the refreshed backend projection
confirms that read fact. A yellow leading highlight projects the independent
backend `attention` fact and does not disappear merely because a message was
read. The left-sidebar surface projects the active Inbox only and represents
it with one icon plus a compact Badge sourced from the backend `activeCount`;
the unread/selection summary uses a semantic accent Badge while actionable and
returns to a neutral Badge when caught up. Both toolbar counts use control-size
strong typography instead of muted tiny text. The surface exposes no Archived
control. The upper-right left-Dock Mailbox launcher independently projects the
exact backend `unreadCount` through the shared Badge primitive, visually caps
counts above 99 as `99+`, and retains the exact count in its accessible label.
A delayed launcher hover selects Mailbox transiently; leaving the whole left
Dock returns to Work Ledger only when that hover still owns the selection.
Clicking pins a hover-opened Mailbox. Both activities remain mounted, so this
selection change preserves Mailbox pagination, loaded rows, disclosure, and
scroll position. Search expands to
the canonical SearchField only after explicit activation. The resting Mailbox
header is one compact row; opening Search unmounts its summary, actions, and
Inbox indicator so the SearchField owns the complete row. The expanded surface
has no X action and closes through the same query-clearing operation when the
mouse leaves the header or Escape is pressed. Open Task is a separate
hover/focus action that uses the canonical task ID and directory. The row
exposes no archive/restore action. Neither reading
nor navigation infers lifecycle or scheduling decisions from the message body.

The canonical Mailbox source-event predicate combines dedicated squad and
coordination presentations with the existing `BusEvent.notify` descriptor.
Tier-1 and tier-2 events become system-notification rows; tier-3 progress,
message, and routine lifecycle traffic does not enter the Mailbox. Task
lifecycle events remain excluded from routine Mailbox progress. Slice
projection changes refresh their owning Board rather than becoming synthetic
Mailbox lifecycle events, so these facts stay available to their owning
protocol consumers without contributing to Mailbox pages, counts,
acknowledgements, change-stream refreshes, attention, badges, or desktop
notifications. Infrastructure failures remain independent notification facts
and never derive or rewrite Task status.

The Mailbox launcher retains explicit click and keyboard toggle semantics. A
short pointer-intent delay also opens the same left-sidebar activity on hover;
quick clicks cancel the pending hover action so they never open and immediately
close the panel. Work Ledger and Mailbox bodies remain mounted while inactive,
and CSS only hides the inactive body. The single Mailbox scroll element
therefore retains its native `scrollTop` when the operator leaves and re-enters;
there is no local-storage or parallel scroll-position model. Each project
directory is a shared native Disclosure, open by default and independently
collapsible around its nested message Accordion. Directory and message ID keys
preserve Disclosure state, item expansion, focus, and DOM identity across
same-scope backend refreshes.

Every `mailbox.connected` frame triggers a canonical `/mailbox` refetch,
so durable items written while the change stream was disconnected converge
without replay cursors or a second client-side history.

The Browser Preview panel discovers the selected task's canonical backend
preview target while the Right Dock is closed. A new ready target reveals the
existing Browser tab through the shared Dock owner. Historical ready targets
form the first-snapshot baseline and do not interrupt task selection. Preview
evidence reads and the native WebView surface remain active-panel-only, so
background discovery does not create a hidden renderer or a second target.

The Right Dock Browser and Task Preview have separate identities. Each native
Browser tab owns its live HTTP(S) URL, document title, history, and page state;
the fixed Browser tab can additionally receive the selected Task's preview
mount, while operator-created Browser instances retain independent native
leases. Address fields are available whenever the native browser capability is
available, including ordinary Work and Chat conversations with no selected
Task. Native surface synchronization only mounts, positions, sizes, shows, or
hides the owning tab. A ready Task URL is a mount intent: as soon as it appears,
its Task/target/URL identity acquires a new native surface lease and the host
mounts or retargets the fixed Browser WebView to that URL. Repeated position and
size synchronization within the same lease does not reapply the URL. Explicit
operator URL navigation and history back/forward/reload own subsequent live-tab
navigation.

The live Browser page is an operating-system child WebView, so Cascading Style
Sheets (CSS) elevation in host Hypertext Markup Language (HTML) cannot cover it.
The Browser ellipsis, Right Dock add and overflow controls, and Environment
Local and branch selectors therefore share one transparent, undecorated Tauri
WebviewWindow owned by `main`. The owned window is the single styled menu layer
above the child, measures its rendered content before it is shown, and is
positioned from the trigger's screen geometry with an explicit bottom-end or
right-start placement.
The card alone owns the native menu's theme-aware border and medium elevation.
That elevation is bounded by the transparent window inset so its fade is
complete before the operating-system window clips composition; callers cannot
add a second shadow or enlarge the shared elevation independently.
Toolbar groups keep their complete localized heading on the left and place
their related actions in a bordered, rounded segmented control on the right.
Square icon actions flank the centered current value, and separators plus the
control's overflow boundary confine hover or focus paint inside the control at
every supported UI scale.
The shared menu renderer uses the canonical control-text tier and standard icon
tier for every ordinary item and toolbar action; callers cannot enlarge those
presentation primitives independently.
The branch presentation retains the canonical compact navigation density and a
viewport-derived bounded scroll region. Focus loss, Escape, item activation,
and keyboard navigation own dismissal without moving, resizing, hiding,
closing, recreating, retargeting, or resynchronizing the Browser WebView. The
current menu model is sent through Tauri's real window event channel; selected
item identifiers invoke the existing Right Dock, zoom, branch, and
guest-interaction owners directly. Full-surface Settings and dialogs continue
to use the shared owner-aware native-surface occlusion lifecycle.
Submitting the address field with Enter navigates the live embedded WebView.
The trailing arrow is a separate operating-system `open-url` action:
it opens a nonblank normalized address in the computer's default browser
application without retargeting the embedded WebView.

The Browser page meets its stage without a decorative host frame or inset. Its
context menu, stationary-pointer annotation hint, Document Object Model (DOM)
hit-testing, selection outline, and comment panel are one injected guest
interaction runtime inside the child WebView. Right-click `Annotate node` and
the Browser menu's annotation toggle therefore converge on the same selected
node/comment result and composer handoff; the host does not render a second
context overlay above the native child. The runtime mounts its annotation
chrome beneath one Shadow DOM boundary so visited-page selectors cannot
recompose its buttons, focus treatment, typography, or menu geometry. The host
projects the active client's
resolved semantic surface, inset, hover, text, border, accent, ring, and shadow
values through the same interaction-presentation command, because the guest
document cannot inherit parent custom properties. Annotation chrome therefore
matches the client theme without a duplicate Rust or guest palette. A pointer
that remains over one page position for 1.5 seconds shows the localized
right-click annotation hint; movement, selection, or another annotation
surface clears it.

Conversation HTTP(S) links dispatch one explicit navigation command to the
already mounted fixed Browser panel and reveal that exact tab. The clicked URL
is normalized and shown as the in-flight address immediately, then the native
current-page query becomes the displayed URL/title authority after navigation.
Link dispatch never bumps Task preview discovery, persists a Task target, or
stores a second live URL in the Overlay.

Task-scoped `browser_preview_target` and `browser_preview_evidence` artifacts
remain the canonical Task Preview input and evidence facts. Selecting or
publishing a new ready Task target must mount its URL in the existing browser
tab, even when evidence already exists. Subsequent manual browsing belongs to
the tab and does not mutate the Task artifact or get overwritten by layout
sync. No hidden Task, Session target, local URL signal, query override, iframe,
or second renderer is created to bridge these scopes.

The Screenshot Browser derives every card from the canonical card-tree
screenshot index and keeps one fixed `132px` logical card/thumbnail width for
the current UI scale. Its `ResizeObserver` content width determines every
complete card slot that fits in a row; there is no maximum-column cap. Width
changes therefore reflow rows without stretching cards or leaving space for a
complete omitted column. Virtua remains the row-window owner and thumbnail
attachment requests remain lazily scheduled through animation frames. The
Right Dock tab is its only panel title; owner-group headers place their
canonical image count immediately after the owner/time label and never add a
count-only panel header.

Right Dock tabs retain the compact `28px` tab-control geometry, including each
tab's embedded close action. The Dock-global add and close actions instead use
the shared `32px` icon-button density and standard `14px` Icon tier, matching
the rest of the application chrome. The fixed-height tab header and mounted
panel body meet at one quiet divider drawn by the header through the shared
border-width and divider-color tokens. Open tabs use one Chrome-style width
contract: each tab keeps the shared preferred width while space is available,
then all visible tabs shrink evenly to the shared usable minimum before the
existing overflow menu activates. The active tab remains visible. Its exact
tab is removed on close; closing Review also clears the legacy diff
workspace presentation before the canonical tab collection selects the
preceding remaining tab.
Compression does not change tab density, ordering, selection, close behavior,
or focus ownership. Open-tab membership preserves insertion order while one
selected-tab ID independently owns activation, so switching tabs never moves a
tab to the right edge. Its resting selected surface consumes the Right Dock
active token as a restrained theme-accent wash while Kobalte marks the selected
tab as highlighted; pointer hover alone repaints that selected surface through
the shared semantic tab-background variable.

The `+` trigger and a double-click on genuine blank tab-strip background open
the same parent-owned native styled add menu. The double-click does not infer
Browser intent or create a tab; the operator's menu selection remains the sole
user-addable tab creation path. Browser entries selected from that menu still
receive their independent native tab identity. Hidden-tab overflow uses the
same surface and preserves canonical tab order and selected identity.

The Composer's Code/Work control, active conversation context badges, and model
trigger share `--oc-density-chip-height`; the send/stop action alone uses the
larger `--oc-density-icon-button`. The model Listbox groups the canonical
connected-provider catalog but renders each fully-qualified
`<provider>/<model>` value once on one line. It does not derive and repeat a
second short display identity.

Right Dock width has one persisted source, `rightDockWidth`. Its runtime
renderer, pointer and keyboard resizers, and Cascading Style Sheets (CSS)
maximum all apply the same bounds: the Dock keeps the shared workbench-panel
minimum, never exceeds the shared Dock maximum, and always leaves the canonical
`--ui-chat-min-width` plus the separator for Conversation. Restoring an older
wide value or resizing the desktop window therefore cannot squeeze the
transcript below its supported layout boundary.

## Inline Interactive Artifacts

Conversation message cards can render durable interactive content without
using the Right Dock Browser Preview. A real tool publishes one strict
message-owned `interactive_artifact` row and returns an
`interactive-artifact` display part. The Session processor persists that part
as a sibling of the real tool result. The message part contains only the
artifact ID; its own Session identity and the active project directory provide
route scope. The session artifact route remains the only payload source across
live display and replay, so standalone Chat, task conversations, Mission,
delegated workers, and active expert-squad agents share the same protocol.
Title, summary, compaction, and control roles do not receive the publisher.

Each payload selects exactly one of twenty versioned renderer identities.
Nineteen are declarative native renderers: `document@1`, `table@1`,
`candlestick@1`, `chart@1`, `diagram@1`, `code@1`, `diff@1`, `media@1`,
`file-preview@1`, `map@1`, `notebook@1`, `presentation@1`, `spreadsheet@1`,
`dashboard@1`, `timeline@1`, `network@1`, `tree@1`, `terminal@1`, and
`model-3d@1`. `mcp-app@1` is the twentieth identity and remains the generic
application surface for forms, approvals, workflow mutations, collaborative
editing, whiteboards, and domain applications. The Overlay uses its safe
Markdown renderer, TanStack Solid Table, Lightweight Charts, Vega-Lite,
Mermaid, CodeMirror, PDF.js, MapLibre GL, Reveal.js, Univer Sheets,
vis-timeline, Cytoscape.js, xterm.js, Google `<model-viewer>`, or the official
Model Context Protocol Apps bridge. Heavy renderers are loaded only when their
artifact is visible. It never infers a renderer from a title, file extension,
URL, or HTML content. Sorting, filtering, pagination, code editing, slide and
sheet navigation, graph/timeline/tree exploration, terminal transcript search,
3D camera control, and other presentation-only interactions remain
renderer-local.

The nineteen model-publishable renderers have one canonical payload validator.
The search-native Provider Tool projection factors their shared
`schemaVersion`, `title`, and `presentation` fields once and keeps only the
renderer-specific shapes in its discriminated union; it delegates all
cross-field refinements back to that canonical validator before persistence.
This is a size-bounded ABI projection, not a second Artifact schema. It keeps
the exact publication leaf revealable beside the permanent
`capability_search` definition without weakening the payload or raising the
shared Harness budget.

A completed conversation turn that owns an `interactive-artifact` part remains
expanded by default so its only renderer stays mounted and the published work
is immediately visible. The existing conversation disclosure remains the sole
operator override: an explicit collapse still wins across replay and runtime
status changes. Completed text-only turns keep the compact default. This
visibility rule is renderer-independent and does not inspect tool names,
titles, prose, or payload content.

`ArtifactFrame` is the only native artifact work surface. It presents the same
mounted renderer in compact Conversation form and, when supported, through the
browser Fullscreen API; it never creates a second renderer tree or copies the
payload into a modal. MCP Apps keep their protocol-owned display modes and do
not receive this native control. One Overlay artifact-theme materializer reads
the applied product CSS custom properties and supplies the semantic palette,
type, surface, axis, grid, legend, and interaction values used by the mature
renderer libraries. Chart and Dashboard share its Vega-Lite configuration;
Network and Timeline consume the same semantic values through their library
APIs. This keeps data semantics in the durable payload while making visual
hierarchy a deterministic product responsibility rather than model-authored
styling.

Presentation uses Reveal.js embedded mode with the official theme contract
mapped to OpenCorvus semantic tokens. The declared aspect ratio owns compact
stage geometry, keyboard navigation belongs only to a focused deck, and a
container observer calls Reveal `layout()` after pane or fullscreen resizing.
Render-backed PowerPoint slides contain the exact OfficeCLI image without a
second semantic overlay. Canonical attachments referenced by a durable
`interactive_artifact.payload` are part of AttachmentStore's live-reference
union, so startup sweep cannot delete review media that the artifact still
owns.

Charts carry inline rows and use one shared deny-by-default Vega loader and
embed policy. That policy enables Vega-Embed's Abstract Syntax Tree (AST)
interpreter mode, so Chart and every Dashboard view execute declarative Vega
expressions under the native `script-src 'self'` Content Security Policy (CSP)
without dynamic JavaScript evaluation or an `unsafe-eval` exception. The same
policy loads the mature Vega Embed and Vega Tooltip styles as one build-time
local stylesheet and disables both libraries' runtime style injection. Maps
carry inline GeoJSON and never accept model-selected styles, tiles, scripts,
or network data. The Overlay's single basemap configuration supplies the
OpenFreeMap MapLibre style; that style and its TileJSON metadata are the sole
visible OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution source. The
MapLibre module worker is emitted through Vite's worker pipeline as one
deployable dependency graph; publishing only its entry module as a raw URL is
invalid because the unbundled entry imports a sibling shared module. The
browser cache follows the provider's HTTP cache contract. Media and file
previews carry canonical project attachment
references whose ownership, digest, size, and MIME type are checked by the
publisher against `AttachmentStore` before persistence. Notebook artifacts are
display-only Markdown/code/output cells and do not own a kernel or execute
code. Presentations may reference canonical slide images; 3D models and their
optional posters are canonical attachments under the same validation.
JavaScript Object Notation (JSON) glTF models may contain only embedded
`data:` resources, so model buffers, images, and extension data cannot create
an indirect network path.
Spreadsheet edits are renderer-local and do not mutate the durable workbook.
Terminal artifacts replay an immutable American National Standards Institute
(ANSI) transcript and never create a shell, pseudoterminal, socket, or process.

Model Context Protocol (MCP) Apps are created only when a real MCP tool declares
one `ui://` resource. The Session processor materializes the artifact at
tool-input start and updates that same row through partial input, full input,
result, cancellation, or failure. The durable artifact binds the exact server ID and
configuration digest, configured or active Expert Squad runtime
authority, tool definition and lifecycle, resource Uniform Resource Identifier
(URI) and metadata, and the integrity-checked Hypertext Markup Language (HTML)
snapshot. A model-authored generic artifact
cannot manufacture this authority. Replay renders the stored snapshot, while
live requests resolve only the same bound server and fail if its configuration
identity has changed.

The app runs from a host-created Blob document in an iframe with only
`allow-scripts`. The Host injects a metadata-scoped, deny-by-default Content
Security Policy, does not grant same-origin, form, popup, or navigation access,
and accepts bridge traffic only from that iframe window. Theme, styles, locale,
timezone, container dimensions, inline/fullscreen/picture-in-picture display
mode, tool input/result, list-change notifications, and teardown use the
official `AppBridge` and `PostMessageTransport`. Tool calls are limited to
app-visible tools on the bound server and persist normal visible tool evidence;
app messages enter the real conversation path; model-context updates persist
one visible replaceable artifact-owned part. Resource and prompt reads remain
bound to the same server. Hypertext Transfer Protocol (HTTP) links and
downloads require explicit Host confirmation, and camera, microphone,
geolocation, clipboard, connect, frame,
base-URI, and resource access derive only from validated resource metadata.
One artifact-authorized, session-scoped event stream multiplexes exact artifact
lifecycle events and same-server tool, resource, and prompt list changes for
every mounted MCP App. It does not expose credentials, create a second MCP
client, or consume one long-lived transport per artifact.

## TaskBoard Contract

Every board response has a non-empty `snapshotVersion`. `lastSequence` is the
latest protocol sequence included in that snapshot and lets the Overlay reject
superseded deltas without maintaining a second board.

The current board contains:

```text
snapshotVersion, lastSequence
task, project
interactions, channels, artifacts
sessionInvocationTopology
overview, brief
requirements, architect
goals[].deliverySliceID, goals[].deliverySliceRevisionID, goals[].priorRevisionID
goals[].activity, goals[].reviewAssociations, goals[].acceptance
```

Requirements, architecture, review, verification, and Host observations remain
separate artifact rows with stable identities. Board lists the relevant facts
and their explicit references; it does not select a Task-current Spec, Plan,
Acceptance Candidate, mutable Goal acceptance, verification row, worktree, or Git
state. Each Task completion appends a typed `task_completion_decision` artifact
with the real Orchestrator message/tool identity and Task-owned evidence refs.
The Board projects only the decision whose artifact timestamp exactly matches
the current Task terminal timestamp; reopen preserves earlier decisions. The
artifact does not copy the narrative assistant summary or create a delivery
closure.

`TaskBoardGoal` has stable `goalID`, `deliverySliceID`, current immutable
`deliverySliceRevisionID`, revision number, optional `priorRevisionID`,
`orderKey`, title/objective, kind, owned paths, order index, priority,
acceptance specifications, and three independent read-only fact facets.
`activity` reports only Sessions and evidence Artifacts whose immutable lineage
explicitly names the exact revision; an empty subject list is zero-Slice.
`reviewAssociations` preserves the review Artifact and its review-wide judgment
without turning it into a per-Slice verdict. `acceptance` is true only when the
current terminal Task Completion Decision explicitly names the current revision.
Workflow counts remain Task-level facts. Older-revision evidence remains visible
history but cannot satisfy the current row.

Environment Information and the Goals workbench project that same ordered Goal
list without copying it. Activating an Environment Goal opens the existing Goals
workbench tab and focuses the matching `deliverySliceID` summary. Activating a Goals
workbench summary changes only that native disclosure's open state; execution
record location remains a separate Conversation concern. Every mounted
task-scope workbench toolbar places its numeric summary at the leading edge:
Requirements and Goals each project their canonical totals; Goal summary counts
use exact current-revision Completion Decision acceptance, not review or Session status. Architecture has no mounted
toolbar, Dock tab, add-menu item, empty-state item, or Environment shortcut.
Goals exposes no Task-lifecycle, retry, attempt, result, or workspace action.
Task cancellation and replanning remain canonical Task API/tool operations.

Requirements and Goals share one task-scope disclosure-list recipe: the same
control-height summary rhythm, divider, compact type, hover/focus/open surface,
trailing canonical chevron, native keyboard semantics, and opt-in
height/opacity expansion motion. Requirement summaries compose their stable
`REQ NN` index and truncating description; their bodies preserve the full
description and metadata. Each Goals-workbench summary composes a Completion
Decision acceptance icon, canonical Slice/revision identity, truncating title, optional trailing
metadata, and disclosure chevron. Environment focus targets the native summary
without changing its disclosure or navigating the Conversation.

The ordinary unpinned Project collection, ordered Goals, and ordered
Requirements share one progressive-list presentation owner. Collections of at
most ten entries render completely; larger collections initially render their
first ten entries followed by the same low-emphasis expand action, which can
reveal the complete loaded collection and collapse it again. Pinned Projects
remain independently visible, and Work Ledger backend pagination remains a
separate explicit data-loading action rather than a second expansion state.

`sessionInvocationTopology` is an observation of real Session ownership. Nodes carry
the exact projected `agent`, session kind, parent session, dispatch lineage,
optional Slice revision subjects, status, and timestamps. Edges only record
actual `agent_call` relations.

The copied Task debug blob shows both `engine_task.time_updated` and a derived
`task.activity.updated`. The latter is the maximum real timestamp from the
board's invocation DAG, execution occurrences, task-scoped artifact timestamps,
and process incidents. The blob lists each contributing source timestamp, DAG
status counts, and nonterminal sessions. Runtime activity therefore remains
visible without rewriting the Task row as a heartbeat or adding synthetic
progress.

Copied diagnostics use `opencorvus.debug.v2` and begin with an explicit AI
analysis request. The request tells the receiving assistant to separate facts
from inference, treat unavailable data as unknown rather than zero, reconstruct
the timeline, report confidence, and propose read-only confirmation checks. The
Overlay confirms a successful copy with a localized instruction to paste the
bundle into an AI assistant; the title tooltip exposes the double-click or
keyboard copy gesture even when usage information is absent.

A Chat bundle keeps three scopes separate. `Persisted root Session` reads the
exact root `/session/{id}/message` collection. `Persisted Session tree` reads
the visible transcript and persisted board identity from the canonical
`/session/{id}/conversation` hydrate route, which includes child Sessions.
`Rendered Overlay snapshot` is a labelled local, non-atomic card-tree
observation. Each persisted plane independently reports available or
unavailable, its endpoint and collection time, validated message/assistant/Tool
counts, Session membership, and bounded recent lifecycle identities. It never
copies raw message bodies, Tool inputs, Tool outputs, credentials, or reasoning.

Debug collection captures one selected source and project directory, validates
persisted board/message identities, and revalidates the active selection after
every awaited refresh/read before snapshotting the renderer. A switched Task,
Session, or directory produces an explicit retry error; the formatter cannot
silently combine or copy facts owned by another source.

## Update Contract

The board refreshes from registered Task, run, Slice, interaction, and
coordination events. Selected-Task `session.status`, `session.error`,
`session.idle`, and `review.stream.*` events also invalidate the Board. Artifact
persistence reaches this projection through its real Task/run invalidation
event; the Overlay does not invent a parallel Artifact event family. Board
refresh is debounced. Conversation live updates carry their own exact identities
and `orderKey` values. Unknown event types are not interpreted as scheduler
progress.

Board refresh and live conversation projection converge on persisted backend
facts. The Overlay does not accept producer-less event names, infer a stage
from an agent label, or synthesize progress from package collaboration prose.

When a selected Task's canonical Board lifecycle is `queued`, the Conversation
projects that physical scheduling fact as a compact notice immediately above
the Composer. This is root-wake queue feedback, not an assistant message or a
Task business outcome. The notice reads no route-local acknowledgement state,
disappears when the same Board leaves `queued`, and does not alter the binary
`running` / `inactive` activity presentation or same-directory serialization.

## Configuration Panel

Settings reads generated backend contracts for providers, models, tools,
skills, Model Context Protocol providers, channels, permissions, and expert
squads. `prompt_profile.active` remains the only active expert-squad selection
source. Settings does not define agent-team order, a package workflow, or a
second active profile.

## Verification

- `bun test packages/opencorvus/test/workbench/board.test.ts`
- `bun test packages/opencorvus/test/interactive-artifact/interactive-artifact.test.ts packages/opencorvus/test/session/processor-duplicate-tool-call.test.ts`
- `bun test packages/opencorvus/test/tool/send-mailbox-message.test.ts packages/opencorvus/test/server/mailbox-routes.test.ts`
- `bun test packages/opencorvus/test/script/document-health.test.ts`
