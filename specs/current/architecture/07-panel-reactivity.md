# 07-panel-reactivity — Overlay Reactive Projection

> Current sources: `packages/overlay/src/store/card-tree.ts`,
> `packages/overlay/src/store/messages.ts`,
> `packages/overlay/src/services/tree-writer.ts`,
> `packages/overlay/src/services/event-policy.ts`,
> `packages/overlay/src/services/events.ts`,
> `packages/overlay/src/components/Conversation.tsx`, and
> `packages/opencorvus/src/conversation/view.ts`.

## Single Writer

`tree-writer.ts` is the only service that creates or mutates store-backed
conversation cards. `cardTreeStore` is the renderer source. `messages.ts`
retains message content and hydration indexes; it is not a second rendered
tree.

Hydration and live Server-Sent Events converge on the same writer. A payload
that lacks canonical identity or an `orderKey` fails before store mutation.
The shared event-ownership policy routes only message/tree events into that
writer. Board-only control-plane events such as `artifact.persisted` invalidate
the Board without entering the message tree; hydration replay and the live Task
stream use the same ownership decision, while events with no declared owner
still fail explicitly.
Standalone session hydration also carries the current `Question` pending
snapshot for the selected session tree. The backend stamps each request with
the same interaction `orderKey` used by the live `question.asked` bridge, and
the writer seeds its single standalone-question projection after reset. A
question emitted before stream attachment or reconnect therefore renders from
the authoritative pending state instead of depending on an unreplayable event.
The session event route subscribes before rereading that same pending store,
closing the hydrate-to-stream race; reconnect reopens the current session
stream without clearing the hydrated tree, and its connection snapshot restores
requests missed while the transport was down.
Task-owned questions remain sourced only from `board.interactions`.

## Session Stream Cutover

The public Session Server-Sent Events (SSE) route subscribes before reading the
bounded canonical Message/Part tail. Protocol events received during that read
are buffered. The route first emits the typed `session.connected` envelope,
whose required payload contains the exact Session ID and projected connection
snapshot, then emits the pending interaction snapshots, and finally releases
the buffered live events in arrival order. A live update to an identity already
present in the snapshot is therefore applied after the older snapshot value;
stable IDs provide overlap identity, while transport order provides freshness.

The transcript snapshot is additive and bounded. It repairs creation events
missed before stream attachment or during disconnection and supplies the
history cursor for the returned tail. It is not a deletion manifest and does
not claim to refresh mutations older than that tail.

Message lifecycle events have one live bridge. The bridge publishes to the
Task aggregate when durable Engine Task lineage exists and otherwise to the
Session aggregate; the older Session mirror does not independently reproduce
Message events. A Session stream uses its request Project database to resolve
the event Session's durable ancestor chain. Dynamic children are admitted only
when that canonical chain contains the selected Session and has the exact
selected Project ID. Event payload claims such as `parentSessionID` are not
admission authority, and global subscriptions cannot cross Project boundaries.

`SessionConnectedEvent`, `SessionConversationConnectionSnapshot`, and
`SessionStreamEvent` are the production Zod schemas and the generated
OpenAPI/Software Development Kit contract for this handshake.

## Canonical Identity

Materialized conversation turns use:

```text
<stage>:session:<sessionID>:message:<messageID>
```

The card carries the exact projected `agentID` for agent turns. `stage` and
`channel` describe the runtime template/display lane and never replace the
dynamic identity. User messages remain user cards even when they belong to a
projected worker session.

Other stable identities are:

- `integrity:session:<sessionID>` for a live integrity review stream;
- `interaction-card:<messageID>` for a pending interaction.

Goals are Task-scope Delivery Slice evidence, not conversation or execution
containers. An agent message remains an ordinary message card; its dispatch
lineage may cite exact Slice revisions as subjects.

Each Goal row projects independent read-only facets over its current Slice
revision: exact Session/evidence associations, review-scope associations, and
acceptance from the current Task completion decision. Selected-Task
`session.status`, `session.error`, `session.idle`, and `review.stream.*` events
invalidate the Board alongside Task, run, Slice, interaction, and coordination
events. Artifact persistence is observed through its real Task/run event rather
than an invented Artifact event family. Refresh is debounced. Goal rows do not
move through a lifecycle: Task owns business lifecycle, Session owns physical
activity, review verdict remains review-wide evidence, and only a matching
Completion Decision supplies Goal acceptance.

## Ordering And Placement

Backend `orderKey` is the only cross-family timeline axis. Current domains are
task, control, message, part, protocol, session, board goal, and interaction.
No frontend insertion sequence or agent-name order may replace it.

The writer canonicalizes every message's parts by part `orderKey` before
rebuilding an adjacent message segment. The part renderer may wrap only
contiguous Tool and Patch parts in an Activity disclosure; it must render those
runs in place and may not hoist narrative or boundaries across them by splitting
a whole card into type buckets. Reasoning parts remain runtime evidence but are
not message-card display content.

A visible interaction owns two chronological positions after resolution: the
request keeps its creation `orderKey`, while the backend projects a distinct
`responseOrderKey` from the persisted resolution time. Both keys break
otherwise-adjacent message segments. The writer can therefore attach the
request and response to the exact preceding turn and render the next same-agent
message as a new segment; frontend arrival order, local clocks, and renderer
array position never decide this placement.

`rebuildTopLevelOrder` includes the request card, ordinary top-level
message/agent cards, integrity review cards, and orphan interactions, then
sorts by their canonical keys. Parent session metadata does not create visual
nesting by itself. Delegated context is rendered only from explicit message
ownership already present in the conversation projection.

The Conversation item projection follows every atomic visible card-tree
publication so mounted rows read current content and metadata from the store.
The structural projection compares card kind/ID and each sub-agent grid's
ordered Session IDs; content-only publications retain the previous item and
list identities, while a real insertion, removal, reorder, kind change, or
sub-agent grid membership change publishes a new projection. A live stream
therefore updates the existing card DOM instead of remounting unchanged rows
on every publication.

Provider-facing `role=user` does not by itself create a user-owned display
card. A delegated prompt in a non-main session is owned by the receiving
agent's canonical channel and agent identity, remains collapsed by its exact
message ID, and shares the adjacent agent segment when chronology permits.
Main-session input and explicitly sourced direct human replies remain
user-owned. The shared transport-protocol ownership projection is the single
source for server conversation views and Overlay live/hydrated rendering.

## Failure Contract

- Missing or drifted `agentID`, `sessionID`, `messageID`, Slice revision, parent,
  channel, or order ownership fails explicitly.
- The selected-Task conversation alert represents project-directory preparation
  or conversation hydration/stream setup failure only. A later workspace-settings
  persistence failure keeps the hydrated conversation and must not write
  `taskSelectionError`.
- Inactive expert-squad resources never enter the active conversation view.
- Unknown event payloads are reported; they are not silently ignored or mapped
  to a guessed card family.
- Card scrolling uses exact card IDs through the conversation virtualizer.

## Mailbox Projection

The left-sidebar Mailbox hydrates from the global registered-project `/mailbox`
projection and subscribes in memory to `mailbox.changed` on the page-global
`/work-ledger/events` notification stream. Work Ledger and Mailbox share that
single physical Server-Sent Events (SSE) connection; a selected Task or Session
may own one additional replay stream. Every Mailbox change causes a fresh
canonical page read, so the notification stream is not a second payload/history
source. Project directory changes abort the previous
transport request and rebind the API context before hydration, but they do not
filter the global result. Every item carries the joined Project worktree, which
is the sole grouping key and the directory used for explicit Task navigation.

Mailbox read/read-all/archive/restore/delete actions append
`mailbox.acknowledged` protocol events. Delete is a terminal projection action:
the exact source message leaves both active and archived views and their counts,
while its Task and protocol evidence remain intact. Single and multi-item delete
requests share the same global engine operation, which resolves every
requested source before appending any acknowledgement. Local search,
active/archived view selection, selected message IDs, inline expanded-message
IDs, loading, and action-pending state are ephemeral component state and cannot
survive as a competing durable source. Expanded IDs survive a same-scope page
refresh so a live Mailbox invalidation does not collapse content being read;
selection is reconciled against the refreshed canonical page and both are
cleared when their owning scope changes. The Kobalte Accordion owns
disclosure keyboard and accessibility semantics. Expanding an unread row
appends the canonical `read` acknowledgement; the refreshed projection, not a
frontend shadow flag, clears its unread dot. The Overlay requests the active
Inbox only and retains no Archived/view-switching state; one Inbox icon plus a
Badge sourced directly from the canonical active count represents that projection.
The explicitly expanded SearchField remains
presentation state. The resting header projects all compact controls in one
row; expanded Search is the sole header child, spans that row, exposes no X
action, and closes on header mouse leave or Escape. Closing Search clears its
query so no invisible filter survives. The explicit hover
Open Task action owns canonical navigation.
The serialized notification projector establishes the initial active page as a
no-replay baseline, then routes each new unread active notification/attention
item to the existing left sidebar launcher exactly once without changing the
selected activity. Progress/status rows remain in the durable Mailbox without
becoming host popups. Native
host delivery acquires a `default` permission through the canonical host
request before sending and keeps its own retry bookkeeping, so permission denial or a
deferred send does not repeatedly reveal Mailbox.
Each committed canonical Mailbox page projects its exact `unreadCount` to the
upper-right launcher; only the visual text is capped at `99+`. Hover ownership
changes the selected left activity without remounting either activity, so
pointer-leave close preserves the Mailbox pagination cursor, loaded list, and
scroll DOM.
The row grid reserves no action or Checkbox column. Open Task/delete actions
are an absolute hover/focus layer, so hidden actions cannot reduce summary
width or receive pointer input. Row checkboxes are likewise absolute and
pointer-inert at rest; hover/focus/active selection replaces the fixed identity
lane with the Checkbox without moving message content. The yellow leading edge
remains the independent backend `attention` projection, not an unread or
selection decoration. The body
is the sole vertical scroll owner and always exposes a stable draggable
scrollbar thumb without painting its track as a trailing border. Same-scope
refresh keeps the current rows and disclosure projection mounted while the
replacement canonical page is loading; only an initial empty hydration renders
the loading placeholder. Project directory headers and per-project Kobalte
Accordion roots remain presentation only; read, expansion, selection,
and action identity stay keyed by canonical message IDs.
Read-all is resolved over the backend registered-project projection and covers
every active unread item, not only the loaded page, selected directory, or local
search result.

Browser Preview target discovery follows the selected task and project scope,
not panel visibility. A missing-to-ready target transition selects Browser and
reveals the Right Dock through the existing panel owner. Evidence hydration and
native WebView mounting still require Browser to be active; the first resolved
target in a newly selected task scope is a no-interruption presentation
baseline.

Conversation HTTP(S) link activation is a separate operator navigation event.
It sends the URL to the mounted fixed Browser controller and reveals that tab;
it does not require Task scope or invalidate Browser Preview target discovery.

## Verification

Documentation and non-UI contract checks may validate Board transport shape.
Overlay presentation and interaction are accepted only through a real isolated
page, direct interaction, screenshots bound to the changed region, and manual
visual review. Goal acceptance must exercise a live Task and inspect at least
accepted and not-accepted rows alongside independent activity and review
associations. Browser Preview acceptance covers inactive target discovery,
automatic reveal when a target becomes ready, active evidence hydration, and
the native WebView mount without persisting UI automation artifacts.
