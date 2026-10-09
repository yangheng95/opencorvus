# 07-panel-reactivity — Overlay Reactive Projection

> Current sources: `packages/overlay/src/store/card-tree.ts`,
> `packages/overlay/src/store/messages.ts`,
> `packages/overlay/src/services/tree-writer.ts`,
> `packages/overlay/src/services/event-policy.ts`,
> `packages/overlay/src/services/events.ts`,
> `packages/overlay/src/components/Conversation.tsx`, and
> `packages/opencorvus/src/conversation/view.ts`.

## Single Writer

### Applied connection ownership

API-state owns one reactive authority revision for the applied URL and credentials.
Logical reads, mutations, pagination, batches, streams and compound operations
capture it once; their existing request/selection owners additionally fence values,
public errors, cleanup, finally and retries. Directory/workspace epochs keep their
separate scope role. Authority changes retire business stream/replay owners before
closing transport, then rebind the current selected and global projections. The
native same-URL replacement path advances that same revision explicitly and marks
connecting so the existing monitor observes the replacement even after PID state
has been published.

Binary resource caches retain their existing maps and semaphore. Host-relative
entries include the same authority revision; exact pending-entry ownership keeps
an obsolete completion from replacing the successor entry. Component resource
sources subscribe to that revision, and full-resolution image previews retain the
canonical raw host-relative target beside the resolved object URL. Standalone
absolute/data/blob/file resources retain their independent identities. Old stream
close callbacks settle the original operation using the actual close fact; a known
final result remains known, and no automatic mutation retry targets the successor
connection. GET projection retirement and control-message POST disconnect retain
their distinct backend execution semantics.

The existing selection epoch also binds project-local presentation. A selection
that leaves and returns to the same directory does not re-admit an earlier form,
menu, search or configuration response. Accepted original configuration/VCS
results and explicitly committed errors remain original facts; obsolete UI
projection, feedback and finally retire. Source-local busy state resets through
its existing source effect, without another epoch or request owner.

Child transcript keys include the same captured API authority beside the actual
source, child Session and directory. The existing resource and refresh generation
retire queued reads/live frames on key change; loader and ordered snapshot parser
receive that original authority. Delta reuse requires the exact same key and
current resource owner. Side Chat supplies its existing captured stream token to
that shared parser. This retires a GET projection, not a child execution.

Artifact downloads and copy actions retain one current operation owner, its
AbortController, exact source material and component lifetime. API-bound sources
also retain the original connection authority and existing selection epoch.
Source replacement or disposal retires that owner; errors, copied feedback,
timers and finally publish only for their original current operation. Authored
text and independent absolute/data/blob/file resources keep their own material
identity across unrelated API changes. Current export generation errors remain
observable through the action error boundary. A native clipboard write already
accepted is an actual side effect; subsequent retirement only retires feedback.

`tree-writer.ts` is the only service that creates or mutates store-backed
conversation cards. `cardTreeStore` is the renderer source. `messages.ts`
retains message content and hydration indexes; it is not a second rendered
tree.

`StoreCardNode` passes one reactive canonical `CardNode` accessor to its child
factory, invoking that factory once per enclosing owner. Both virtual main
conversation cards and recursive card children read the accessor in their
component props. Updating an unrelated conversation item may rebuild its item
projection while retaining the same card ID; that update changes the reader's
dependencies without recreating its child factory. Real enclosing row removal
still retires the subtree. The canonical required lookup and missing-card error
remain the same; there is no separate card snapshot or renderer cache.

Hydration and live Server-Sent Events converge on the same writer. A payload
that lacks canonical identity or an `orderKey` fails before store mutation.
The shared event-ownership policy routes only message/tree events into that
writer. Board-only control-plane events such as `artifact.persisted` invalidate
the Board without entering the message tree; hydration replay and the live Task
stream use the same ownership decision, while events with no declared owner
still fail explicitly.

Conversation Agent activity is keyed by the accepted input Message within its
owning Session. Real inputs replace that Session's preparation-only placeholder;
the same topology is used to identify ordinary Session and Task occurrences.
Hydration, preceding history pages and Session reconnects read each visible
input's latest original `agent.execution.lifecycle` through ProtocolStore.
Task prepared-input identity and durable dispatch facts retain their authority,
and repeated event identities are applied once in hydration. A historical
Session streaming/retry fact is replayed only while that exact input still has
its current process-local execution owner. An accepted input without an admitted
lifecycle fact remains pending. Message and Part arrival updates content and
navigation targets; only actual lifecycle facts change execution status, so a
late body snapshot cannot revive a settled input. A slow same-source hydration
also retires the replaced preparation placeholder.

Task Message lifecycle has one exact live bridge. Initial hydrate supplies the
persisted tail; reconnect resumes the bounded Task live sequence in its exact
process epoch. Replay expiry or an epoch change first replaces the canonical
persisted tail and only then opens a new stream. There is no parallel timestamp
watermark poll or coarse `task.messages.changed` projection.

Unvalidated Provider Tool input is ephemeral transport, owned by the processor's
current call draft rather than a SQLite Tool request. The producer publishes
coalesced, self-contained `message.part.updated` snapshots with `status=pending`,
the actual Tool name/raw input and the owning Message/Session identity. The live
bridge derives draft ordering from its observed start and the persisted parent
Message. Raw input must not arrive as an orphan Part delta. The bounded replay
cache keeps the latest complete pending snapshot for each call. At validation,
the producer removes the draft projection before publishing the real persisted
Tool Part with its canonical admission ordering. Cancellation, retry and an
unfinished stream remove the draft; they do not fabricate a Tool execution fact.
The existing conversation writer and pending Tool renderer consume these events.

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

Snapshot hydration validates each visible message's execution owner against
that same message's `view.messages.sessionAgentID`, beside its participant,
Session, ordering and Part ownership. The aggregate `view.sessions.agentID`
describes the current projected Session actor and cannot replace historical
message ownership: a Side Chat keeps original Work references before its own
Chat replies. Control-only transcript rows retain their required owner and
Session/Part checks even when they have no visible message metadata. HTTP reads
and ordered Session connection snapshots use this one admission parser.

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

An expanded assistant bubble presents its canonical error reason after its
parts and children, including turns that already contain Sources, Tool results
or narrative. The existing header error detail remains available while the
body is collapsed. Main conversation, Side Chat and member transcripts use
the same bubble renderer and the same projected `CardNode.errorReason`; this
presentation does not create a Message/Part or a second lifecycle source.

Side Chat's visible reader retains its top/following intent in the existing
conversation UI owner, keyed by applied authority, source and Side Session.
Primary selection clears that bounded intent; hidden geometry and retired
selection/authority owners cannot write it. The selected reader restores through
the shared scroll controller, whose intent getter retains the original pending
top through incomplete layout instead of saving a clamped zero. Explicit reader
input and a return to the bottom retain the controller's existing semantics.

The primary conversation keeps at most 50 reading positions in that same UI
store, keyed by captured API authority revision and actual source kind/ID.
Selection clears transient primary disclosures without clearing this bounded
view memory. Before replay or projection retirement, its one registered visible
reader captures the current top/following intent and visible quotation Message
anchor, text ordinal and viewport offset. Empty, hidden, loading, unhydrated or
retired owners cannot publish a new position. A returning paused reader uses the
existing history loader to locate its actual Message and the existing virtualizer
card-scroll bridge to mount it, then resumes through the same scroll controller.
The bridge pins the actual item through the existing virtualizer keepMounted
ownership for reading restoration. It does not start index or DOM alignment for
that request: an outstanding index alignment can otherwise overwrite the saved
Message offset on later item measurement. Explicit card jumps still align through
the same bridge; restoration retires its temporary pin on completion, reader
movement or source retirement.
During that restoration the same scroll controller resolves the actual Message
offset on each correction frame and includes that resolved target in its existing
geometry stability check. The original TextPart pending signal is exposed on its
rendered text box so partially committed Markdown is not treated as ready geometry.
The pending reader and pin retire only when the controller settles or owned input
or cleanup retires it. Numeric position callers retain their existing behavior.
Initial sources follow the bottom. Explicit reader movement and Scroll to latest
retire pending restoration and own the next saved intent. API rotation and a new
browser lifetime remain new view ownership; this does not persist another
transcript, alter runtime status or manufacture a reading input event. Ordinary
Session, Task and Mission main views share this implementation; failed active
restoration is reported through the existing application diagnostic boundary.

Source disclosures retain their actual adjacent Part group and truthful group
count. Expanded leaves retain canonical type/Session/Message/source identity
while reading current metadata and index. A single-source group needs no leaf
ordinal; a larger group keeps its current per-group order. Opening a disclosure
and focusing its URL/file/document leaf declare reading intent through the
existing nearest transcript owner, releasing automatic following. Native Tooltip
and source actions retain their keyboard behavior; an explicit return to the
bottom can resume following through the existing scroll policy.

An expanded web-source leaf shows its full wrapping title and a secondary host
derived directly from that same canonical URL, including any port. The URL
remains the link target and full Tooltip detail; a title/provider is never used
to infer its host. An unparseable URL has no host presentation. An expanded
file-source leaf shows its existing title/range and a secondary path/range
from the same canonical source. The existing selected directory makes an
in-project path relative; an external path retains its absolute identity.
An identical title/range and path/range needs only one visible line.
Tooltip, accessible name and file navigation use those same facts. Document
leaves retain their existing actions and metadata, and group summaries retain
their actual title/count and adjacent timeline position.

Every Task and Session hydrate, history page, connection snapshot and live
Message event passes through the same bounded display-transport projection.
It omits Reasoning and replaces a completed Tool state above the inline byte
budget with a compact identity-preserving marker containing exact state/output
bytes and a state SHA-256. The canonical Part remains unchanged in persistence.
Only mounting an expanded Tool body may read that exact project-scoped
Session/Message/Part; the renderer verifies identity, byte counts and digest and
keeps a bounded identity/digest cache for collapse/reopen.
The existing canonical message-list/message/Part GET readers use Project
identity admission, independently of the current execution-model configuration.
Their Session lineage and exact parent membership checks remain authoritative;
config and execution requests continue to validate their required runtime.

The project-scoped `GET /session/status` read uses that same Project identity
admission independently of execution-model availability. Its existing process
status facts are projected through durable, visible Session membership in the
selected Project; internal process-wide status observations retain their own
scope. Reading status does not initialize a Provider or change an execution.

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

The Card Tree generation owns one captured Virtualizer handle. A retiring
generation may clear the shared handle only when it still owns that exact
handle. While transcript follow mode is armed, the virtual-root measurement
callback anchors the exact last item and synchronously writes the outer
Conversation scroll owner to its current bottom in the same frame. This is one
presentation convergence path, not a second message state; preserved history
and operator-released follow mode do not perform the bottom write.

Completed Markdown presentation belongs to the existing renderer service,
independently of a text component's lifetime. Successful non-streaming worker
results are retained by exact full text, mode, locale/resource sequence and
actual code-copy label/icon inputs. The service keeps at most 32 results and
4,000,000 UTF-16 code units of keys and HTML, evicting least recently used
results. A remounted model installs a matching produced artifact before paint;
misses retain the same off-thread lexer/parser and bounded HTML mount batches.
Worker failure clears retained results and remains a visible render error.
Streaming output uses current worker replies, and an older revision cannot
overwrite an immediately restored completed result. Last-subscriber disposal
retires the worker while completed artifacts remain within the same authority.

Streaming Markdown uses that same lexer/parser for every accepted token,
including the currently growing final block. A continuous list, table or code
block does not turn its already accepted content into a plain-text tail. The
final token bypasses the completed-token cache while it changes; unchanged
rendered block strings retain their existing presentation identity. Replies
use the one ordered HTML batch path, with the existing latest-request queue
and bounded frame mounts. Unmatched Markdown syntax follows the current
parser's interpretation rather than guessed closing delimiters. Tool raw-input
previews retain their own existing display limit.

Transcript follow remains owned by each caller's tracking signal. The shared
controller releases follow on owned upward input before asynchronous resize;
editable keyboard controls and another nested transcript retain their input.
Program echoes, layout clamping and near-bottom geometry alone cannot rearm
released follow. Owned downward movement reaching the bottom can rearm it;
explicit bottom and new selection/send actions retain their caller-owned
behavior. Sources reading intent clears stale event attribution and pauses the
nearest transcript through the existing reading event.

Side-chat message cards project the same message's created and completed
timestamps to the shared running/finished duration display. A selected child
conversation instead projects the current selected activity's started and
terminal completed timestamps; its visible first message is not the execution
clock. Its content/identity projection omits clock fields until the caller
assembles a complete Card from that exact activity. The activity and transcript
must identify the same Session, and a pending/running/idle activity does not
expose a prior terminal timestamp as its current completion. Reloading these
views retains the original persisted times; the renderer does not invent a
completion time from the current clock.

Owned native Home/End navigation includes Ctrl+Home/End. Ctrl+Home releases
follow before the browser scrolls. End/Ctrl+End requests following synchronously
through the caller's existing tracking signal, so the controller's existing
resize/frame policy converges the real latest position as virtual items mount
and remeasure. Its follow-request callback also covers owned downward movement
reaching the bottom; initial estimated geometry is not a separate acceptance
condition for an explicit End command. A nested vertically overflowing scroll
box retains its local End action. Editable controls retain caret navigation,
and other modified shortcuts retain browser/application handling. Native key
actions are not prevented, and there is one scroll/follow implementation.

Native focus entering a descendant control declares reading through that same
nearest transcript controller. Sources, Tool buttons and local reading regions
share this input; the scroll owner itself retains its navigation/follow state.
An explicit End can resume following while the focused item remains mounted,
and subsequent Tab navigation pauses following for the newly focused control.

The sub-agent panel owns at most 32 recent reading positions, keyed by the
canonical target identity including API authority, parent source, session and
directory. These positions contain only viewport geometry and follow intent;
transcript data still comes from the existing projection. The outer panel is
force-mounted to retain this UI state across Dock closure, while its inactive
request scope aborts loads and retires the transcript scroll owner. Only visible,
active observations update a remembered position. Parent disposal clears it.

Each shared scroll-controller caller supplies an explicit initial bottom or
position intent. A restored position remains owned by that controller until
content reaches it and the Dock/content geometry stabilizes across consecutive
frames. Its existing resize observer watches the layout root as well as content;
insufficient content waits for resize rather than spinning frames. Owned reading
input cancels restoration immediately. A first visit still follows the bottom;
returning to a paused conversation retains its reading position and pause.

The Right Dock tab strip retains metadata independently of component lifetime.
Except for the sub-agent outer UI owner described above, when the Dock is open,
Kobalte mounts only the selected tab body; closing the
Dock, changing selection, or closing a tab disposes the prior component through
the normal Solid lifecycle. Panel-owned requests, observers, Server-Sent Events,
native surfaces, and controllers cannot remain active behind an unselected tab.
Closing the selected Dock tab moves the canonical selection to the adjacent
remaining Dock tab, preferring the preceding tab, and returns to Conversation
only when no Dock tab remains. A missing Dock selection uses a reserved metadata
identity that cannot mount an arbitrary retained body.
An HTTP(S) message link may select an unmounted Browser body first and transfers
its pending URL to that body when its controller mounts.

Provider-facing `role=user` does not by itself create a user-owned display
card. A delegated prompt in a non-main session is owned by the receiving
agent's canonical channel and agent identity, remains collapsed by its exact
message ID, and shares the adjacent agent segment when chronology permits.
Main-session input and canonical human-authored input (`author=user`) remain
user-owned, including genuine Task creator requests in non-main Sessions.
Other non-main provider user-role input belongs to its receiving agent;
source provenance never grants human authorship. Missing author fails explicitly
before any main/role shortcut. The shared transport-protocol ownership projection
is the single source for server conversation views and Overlay live/hydrated
rendering; the retired direct-human-source whitelist has no other classification
path. Actual receiving Session/channel, Message/Part/input and parent identities
stay immutable when presentation segments change. Historical imported dynamic
`user` author collisions cannot be disambiguated by this projection; current
package/runtime identity admission reserves that human participant name.

Assistant settlement (status, terminal reason, error and completion time) stays
with its exact Message projection. Adjacent-card regrouping derives settlement
from the segment's latest Message, so changing card ownership cannot turn a
settled assistant back into a running timer. An executing successor assistant
clears the preceding assistant's terminal display metadata. Lifecycle-only
cards retain their execution-occurrence projection until a real Message owns
the card; Task lifecycle is never inferred from a visual card's timer.
An occurrence lifecycle can supply terminal status before Message settlement;
it applies only to that occurrence's owner card. Once the last Message has a
completion timestamp, that timestamp bounds the segment's duration, so a later
physical runtime shutdown cannot extend already completed work.

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
- The conversation virtualizer keeps the item owning real keyboard focus
  mounted through its existing `keepMounted` policy, alongside any history
  anchor. Scoped native focus events update that item's canonical ID and clear
  it when focus leaves; index projection uses the current item order. Scrolling
  an item out of view preserves its virtual mount and transcript key ownership;
  inner control identity remains owned by that control's rendering projection.
  No focus migration or global keyboard routing is introduced.

The installed Solid 1.9.14 browser renderer uses the root patched-dependency
policy for ordered-array prefix reconciliation: an existing subtree containing
its document's active element stays attached while preceding items are
inserted. Component identity alone cannot preserve native focus if a retained
subtree is temporarily removed by a replace/reinsert optimization. The same
branch applies across its development/production module exports; it does not
introduce a separate transcript renderer or focus-restoration path.

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

A durable event may invalidate both projections: Task completion/failure and
interaction requests emit each applicable Mailbox and Work Ledger notification.
Neither projection consumes the other's invalidation. Every global stream
connection, including reconnect, rehydrates both canonical projections because
this notification stream does not replay changes from a disconnected interval.

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
It selects and reveals the fixed Browser tab. When that selected body is not
yet mounted, one owner-fenced pending navigation transfers the latest URL to
the controller that actually mounts; a retired controller or stale microtask
cannot consume or overwrite it. This event does not require Task scope or
invalidate Browser Preview target discovery.

## Verification

Documentation and non-UI contract checks may validate Board transport shape.
Overlay presentation and interaction are accepted only through a real isolated
page, direct interaction, screenshots bound to the changed region, and manual
visual review. Goal acceptance must exercise a live Task and inspect at least
accepted and not-accepted rows alongside independent activity and review
associations. Browser Preview acceptance covers inactive target discovery,
automatic reveal when a target becomes ready, active evidence hydration, and
the native WebView mount without persisting UI automation artifacts.
