# 07-panel-reactivity — Overlay Reactive Projection

Chat and Work conversation downloads offer Markdown and JSON from the same
complete project-scoped Session export snapshot. One formatter validates that
snapshot's Session and message identities and retains producer message/Part
order. Markdown presents original text, actual authors, localized dates and
structured failure status, with expandable original Session/message data that
includes every tool and Source Part. It does not rebuild from visible cards or
generate content. JSON remains the complete original snapshot. Both options
share the existing request owner, cancellation, busy feedback and Blob download.

Workspace navigation explainers use the destination label as their heading and
localized purpose copy as their description. Settings explains its appearance,
provider, connection and shared-resource scope through the existing work-ledger
tooltip copy; the trigger name, navigation and focus owner remain unchanged.

Main conversation message settlement preserves the structured cancellation's
original reason and details alongside completed/aborted. Live lifecycle updates
and complete transcript hydration consume that same settlement, so the existing
neutral stopped-message disclosure remains available with the original output.
Cancellation is classified from MessageAbortedError, never translated prose.

Authored participants with user transport role retain their actual author and
full original body. ChatBubble shares one participant classification between its
identity and presentation marker. Human input card width, trailing placement and
surface apply to human input; Goal controller and other authored participants
use the existing full narrative column. Transport role, message identity, Parts,
ordering, expansion and the shared text renderer remain unchanged.

Modal Dialogs capture their actual external opener before the open autofocus
hook. On close, caller autofocus hooks run first and may prevent the default.
Otherwise an available, visible, enabled opener receives focus only while BODY
or the retiring Dialog still owns it. A reopened dialog or a new focus owner is
respected. Non-modal prompts retain their existing close focus behavior; missing
or detached openers do not cause a search for another target or delayed retries.

Dialog dismissal separates pointer intent from keyboard focus movement. A
non-modal interaction prompt stays visible when Tab moves focus outside its
content, while retaining its original pending interaction and reply authority.
Escape and configured outside pointer interactions still dismiss it. This does
not turn non-modal prompts into focus traps or change modal dialogs' existing
focus boundary, authorization decisions or continuation state.

Member list/detail navigation retains keyboard context in the same panel.
The selected member belongs to the current API authority, source kind and ID,
and project directory. A same-source recovery may advance the workspace request
epoch without clearing that member or retiring its accepted transcript reader.
Changing the actual scope or explicitly leaving the conversation retires the
member selection through the existing owner.
Opening All agents focuses the currently selected Session row; opening that row
focuses the detail view's All agents control. The original click or BODY must
still own focus when the next frame commits, and the panel and destination must
be active, visible and connected. SelectControl retains its popup focus owner;
navigation does not replace transcript owners, reading anchors or request state.

The member progress grid replaces member transcript turns while retaining their
canonical child cards as ordinary timeline items at each child's own orderKey.
Permission and question controls therefore remain actionable after their
non-modal prompt is dismissed, and their resolved history keeps its real card
identity. This presentation does not move ownership in the card tree or create
another interaction projection. Navigation resolves a directly rendered card
item before looking up a member grid or an enclosing transcript turn.

> Current sources: `packages/overlay/src/store/card-tree.ts`,
> `packages/overlay/src/store/messages.ts`,
> `packages/overlay/src/services/tree-writer.ts`,
> `packages/overlay/src/services/event-policy.ts`,
> `packages/overlay/src/services/events.ts`,
> `packages/overlay/src/components/Conversation.tsx`, and
> `packages/opencorvus/src/conversation/view.ts`.

## Single Writer

### Applied connection ownership

Canonical Session configuration GETs use the actual transport outcome and
captured API authority even while the last periodic health observation is
offline. A selected Task or Session stream may reconnect before that observation
updates. Composer reads retain their projection generation and selection owner,
and publish the returned model or original request error. This read neither
changes global connection status nor admits configuration writes or message sends.

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

Accepted complete configuration responses use the app store's single
setConfigSnapshot helper and the existing Solid reconcile utility. Normal writes,
explicitly committed error receipts, unchanged readbacks and project/global loads
replace the complete configuration projection, including removed root and nested
keys. Loaders batch that publication with their original resource results. The
existing request, connection, selection and write owners still decide admission;
original returns, committed errors, permission serialization and scope reset keep
their contracts. Field components consume that one snapshot without compensating
local writes or another configuration cache.

Network proxy tests capture the existing draft generation as well as their
operation and scope owner. Edited fields, purpose switches and accepted config
hydration advance that same draft generation, retiring the old result or error
projection. The original HTTP operation keeps its lifetime and clears its busy
state only on its actual settlement. A new test of the current draft uses the
same public endpoint and physical transport; editing adds no cancellation or retry.

Network validation and save/delete failures retain message keys and original
diagnostic details, and deletion success retains its accepted boolean fact.
Feedback summaries translate at render time in the current UI locale. Native
Details keeps original HTTP, path, request ID and error evidence through the
shared error formatter. Changing locale preserves the original draft and feedback
fact, with the existing scope, draft, busy and feedback-timer owners unchanged.

Channel feedback likewise retains translation keys and original details in its
existing form slot. Only success feedback starts the original dismissal timer;
errors stay available through native Details. Public-URL hydration observes the
accepted store value and existing scope, independently of the save busy owner.
A rejected write therefore preserves its draft, while accepted configuration or
a new authority, selection or directory hydrates the corresponding value.

Provider settings retain separate form, catalog-refresh and model-refresh feedback
owners. Each stores message keys, variables and original diagnostic details;
summaries translate at render time and details use the existing native disclosure.
Exceptions retain available HTTP method, path, request ID and body, while service
issues retain their phase and Provider identity. Configuration committed, credential
saved and follow-up failed remain distinct facts; deletion residue and reload failure
can retain both messages. A successful refresh clears its own operation feedback.
Existing API authority, directory selection and operation generation govern publication
and retirement, without a second state owner or automatic mutation retry.

Provider form declaration identity has one owner in the existing provider-form
service, shared by preview, discovery and save. Editing retains its actual existing
ID; explicit IDs and display names retain their prior priority and normalization.
New IPv4, localhost and .localhost entries use the normalized full host with its
non-default port. IPv6 entries retain their normalized address and non-default
port under the ipv6 prefix. Each IPv6 colon maps to one underscore, preserving
compressed zero-segment positions. Ordinary DNS entries retain the existing brand-label
derivation. Existing declarations are not renamed. Conflicting derived or explicit
IDs use the existing configuration conflict contract; paths, query strings and
protocols are not a general uniqueness guarantee.

Accepted Provider mutations publish their captured API authority, actual global or
project scope and affected Provider IDs to current subscribers, independently of
the initiating form's lifetime. Shared registry outcomes explicitly address all
observations. The current panel retires its existing per-ID Test generations and
result Map; project outcomes apply only to their exact directory. The notification
stores listeners only, with no replay queue, credential or second result store.
Drafts and reads retain their original selection ownership. This covers accepted
responses in the current frontend process; external writers and responses lost to
transport timeout require separate qualification.

Shared Skill and MCP resource actions use one notice object with a message key,
render-time variables, Feedback tone and optional original diagnostic. Rendering
translates the summary; errors retain the already public message and, for a real
ApiError, its request ID in the existing disclosure. Dismissal clears only that
notice. Source ownership checks and form values retain their existing contracts.
This presentation does not reclassify backend errors or add resource operations.

The MCP settings list exposes the existing per-server connection and disconnect
operations beside its canonical status. Connected servers can disconnect;
disabled, disconnected and failed servers can connect. Authentication states
remain explicit and do not imply that connection can complete authorization.
Only a successful project-status read for the current directory and API authority
admits project rows and their count; a failed read retires that read ownership
instead of presenting global MCP inventory as project-owned definitions. The
existing store remains the only status projection; its map and actual
project/effective scope, directory and API authority publish atomically. An
effective-inventory publication cannot stand in for a project-status read.
Rows key by server name so
periodic status reads retain their controls and keyboard focus. Add, removal and
connection actions share the panel's pending admission, capture their actual
directory and API authority, and refresh canonical status after success. They do
not rewrite definitions, tool assignments, permissions or runtime connection state.

The same resource notice records its explicit form origin and actual request
directory. Skill installation and MCP addition render that notice near the open
form's submit controls; closing the form retains it in the panel slot. Only an
inline notice can request a nearest-block reveal. Its one microtask rechecks the
connected element, exact notice object, current slot, active panel and directory
owner before scrolling. It never moves keyboard focus. Background refresh and
ordinary panel notices retain panel placement without requesting a reveal.

Child transcript keys include the same captured API authority beside the actual
source, child Session and directory. The existing resource and refresh generation
retire queued reads/live frames on key change; loader and ordered snapshot parser
receive that original authority. Delta reuse requires the exact same key and
current resource owner. Side Chat supplies its existing captured stream token to
that shared parser. This retires a GET projection, not a child execution.

The member transcript's read revision follows canonical boundaries. Intermediate
text/reasoning snapshots with an actual start and no end, and pending Tool drafts,
remain in the existing live projection while the canonical writer proves that
exact assistant Message is unfinished. Their periodic persistence does not issue
another transcript read. Ended Parts, Message boundaries, Source/file updates,
admitted Tool results, removals and completed Message edits retain canonical reads.
An unknown Message also requires a read; historical running status alone cannot
qualify an intermediate update. This rule is shared by Task and Session members.

A successfully committed initial hydration, Task tail recovery or Session
connection snapshot also invalidates the active member transcript for that same
source. These read boundaries share the member update bus with live facts;
they are not synthetic Message events or a second transcript projection.
The existing refresh controller coalesces invalidations through its pending,
in-flight and ready states, including snapshots whose live sequence is unchanged.
The target identity and accepted resource value remain mounted during the read.
History pagination and intermediate live values retain their existing behavior.

Session-keyed member surfaces choose their current occurrence by its canonical
timeline order, including the store's Session-only lookup and pending-Todo
attribution. A late recovery fact can update an old occurrence's observation
time without making that input newer than its subsequent continuation. Within
one exact occurrence, live/hydrated state still converges by observation time.

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

One assistant reply can accept several real input Messages. Agent hydration
uses that reply's `acceptedInputMessageIDs` to associate transcript-only batch
members with its parent execution, retaining every member in that execution's
message navigation. A batch member with its own prepared or lifecycle evidence
retains that independent occurrence. Repeated reply steps retain the first
acceptance association; later unaccepted inputs remain pending. This projection
is shared by Task and Session hydration and does not alter the transcript,
persisted Messages, or the status of any actual execution.

Task Message lifecycle has one exact live bridge. Initial hydrate supplies the
persisted tail; reconnect resumes the bounded Task live sequence in its exact
process epoch. Replay expiry or an epoch change first replaces the canonical
persisted tail and only then opens a new stream. There is no parallel timestamp
watermark poll or coarse `task.messages.changed` projection.

Member conversation projection orders each Message's merged Parts by the
canonical Part `orderKey`, matching persisted transcript reads. Replay retains
original publication order: replacing an earlier Part's snapshot can place its
latest event after a newer Part. Arrival order therefore cannot determine the
rendered Part order. Snapshot values, complete field updates, removals and
completed-message sealing keep their existing authority.

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

Standalone session hydration and connection snapshots carry the complete current
`pendingQuestions` array for the selected durable Project/Session tree. The
backend projects each original Request and its interaction `orderKey` through
one reader. Non-Task children use the same durable lineage admission as the
selected Session; Task-owned questions remain sourced only from
`board.interactions`. Live Asked and terminal deliveries read the original
publication facts, so a delayed Asked cannot reopen an accepted terminal.
For standalone live Asked delivery, the prepared canonical pending reader and
publication facts are read synchronously; only a complete current Request owned
by this server's reply API becomes a pending projection. A dead ordinary Tool's
original Asked and Tool facts remain intact, with the explicit reply error.
Task recovery reconciles already materialized interaction sources before
restoring a physical waiter. Source-only Task Asked recovery and cross-process
physical waiter authority remain an unresolved boundary recorded in batch 404.
There is no fabricated pending-Asked replay during connection setup.

## Session Stream Cutover

The public Session Server-Sent Events (SSE) route subscribes before reading the
bounded canonical Message/Part tail. Protocol events received during that read
are buffered. After reading the transcript and pending interactions, the route
drains deliveries already accepted by its subscriptions. This barrier waits for
that accepted prefix, not future events. The route first emits the typed
`session.connected` envelope, whose required payload contains the exact Session
ID and projected connection snapshot, including both complete pending interaction
arrays, then releases the compacted original events in their retained order.

Session bootstrap and Task live replay use the same conversation buffer rule:
the latest complete Message metadata or Part snapshot supersedes earlier values
for that exact Task/Session/Message/Part identity. A complete Part absorbs its
earlier deltas; only the latest subsequent delta for each field is retained,
with its original sequence and epoch. Shorter
authoritative rewrites are valid. Message metadata updates preserve Parts,
removals supersede the removed identity, and a complete Task-root Message move
supersedes its source and destination copies. This avoids replaying historical
empty text over an already hydrated body. Connected subscribers still receive
every original live event. Compaction does not advance the retention floor;
the existing expiration, terminal retirement and epoch rules remain authoritative.

A zero Task live sequence paired with its snapshot's known epoch is a resume
cursor, including before the first live event. Retention expiry applies to that
cursor as well as positive sequences: child Session reads return the canonical
snapshot, and the selected Task stream emits the existing replay-expired event
for tail recovery. Only zero without an epoch denotes a fresh subscription after
hydration. Task completion, failure and cancellation preserve this distinction
when retiring their retained payloads; reopening preserves the live cursor domain.

Text and reasoning `message.part.delta` events require `field: "text"`, the
original `delta` fragment and the complete current `value` from the processor's
existing accumulator. Command-line and Agent Client Protocol consumers output
the fragment; conversation projections assign the complete value. Task live
cursors still include unpersisted activity, so a newly attached projection must
not append a fragment to an HTTP prefix that may precede that cursor. The main
writer's bounded batch retains the latest actual field event, and child/Side Chat
projections apply the same value contract without string-overlap inference.
Tool input drafts continue to use complete pending Part snapshots.

All server SSE routes share HTTP content-encoding negotiation in `server/sse.ts`.
Accepted gzip responses use one compressor per connection and flush each original
frame immediately; identity remains the standard unencoded representation.
`Vary: Accept-Encoding` is merged with existing response variation. An explicit
exclusion of both representations returns HTTP 406 before subscribing. Event
contents, ordering, cursors and participant identity are unchanged. Cancellation
propagates through the Web stream to the original Hono stream owner; reconnection
creates a new compressor. The packageManager-pinned Bun 1.4 runtime is required
for immediate decoding of compressed fetch streams; Bun 1.3.14 buffered them.
Compression reduces wire bytes, not the decoded JSON or field-value allocation.

The browser and desktop HostTransport use the same WebSocket adapter for all six
UI stream callers: selected Task/Mission/Session, global Work Ledger/Mailbox,
Side Session, panel message POST, VCS commit message POST and MCP App. Each stream
first sends a short POST to `/global/transport/stream`, through the existing
Basic Auth and Origin middleware, preserving its target method, relative path,
query, headers and body. The single-use ticket expires after ten seconds and is
bound to the admitting Origin. Upgrade consumes it through a subprotocol; user
credentials never enter the socket URL. The target executes only after upgrade
through the same complete App.fetch pipeline, which revalidates authentication,
project lineage and runtime authority. Public HTTP/SSE routes remain the sole
business handlers; this adapter forwards their identity-encoded response bytes.

No UI long-lived request occupies the browser HTTP connection pool. Response
status precedes raw byte frames; EOF and original errors settle the same logical
owner. Native send backpressure waits for drain before reading another chunk.
Socket close, request abort, authority change and listener shutdown cancel the
original request and reader; shutdown retires unconsumed tickets. The existing
business layer alone owns reconnect, replay and cursors. There is no EventSource
or fetch-stream fallback, polling, source deduplication cache or second publisher.

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

The connection snapshot also carries the required `agentView` from the same
Session tail projection used by HTTP hydration, including canonical input
occurrences, activity, message identities, times, targets, Todos and any bound
Task execution facts. The frontend validates it before mutation and hydrates
the existing agent store in the same batch as the transcript. Subsequent real
lifecycle events update these complete records; a reconnect does not first
create partial records from their final status timestamps. Ordinary Session
and Mission streams share this contract and preserve the current member reader.
The shared activity schema includes the URL, document and file Source variants
already produced by the canonical activity projector, reusing Message source
payload validation. Source identity, URL/path, title and file range survive both
HTTP hydration and the schema-validated connection frame.

Session HTTP hydration and the ordered connection snapshot require both
`pendingPermissions` and `pendingQuestions`. Each is a complete current pending
set for the admitted conversation tree, distinct from the bounded additive
transcript tail. The existing standalone interaction Map owns both. Strict
adapters preserve Request identity, summary, directory, time and interaction
order key for cold, connection and live input. A repeated identical pending
Question retains its original object and component owner, including its local
draft; conflicting immutable payloads produce an explicit contract error.
Connection replacement applies both arrays once. Absence removes a pending
projection without inventing a terminal status or time. Actual Question replied,
rejected, expired and abandoned facts preserve their original outcome/provenance;
Permission Replied or ledger-backed Terminated retires its matching card.
Task cards continue to come from Board interactions. Side Chat uses the same
Question adapter, admits only its exact independent Session and replaces its
pending set without an intermediate empty callback.

Resolved Question history derives request/response presentation phases from the
same original interaction, order keys and terminal times. Stable interaction and
phase identities retain the history owners; the mounted renderer formats them
with the current locale. Empty authored titles use the localized Question label.
Deadline expiry and infrastructure closure have separate localized outcomes;
authored question text and answers retain their original contents.

Question options share one compact grid across inline, Side Chat and Dialog renderers;
the Dialog retains its existing larger spacing and interaction area. The authored
short label names the native selection input, while the separately registered
description supplies supplemental information and native label activation. An
empty description adds no row. The shared Checkbox forwards an explicit caller
accessibility name to its actual Input; consumers with visible labels retain the
library's existing Label registration. Selection, authored values and reply
authority remain in the original interaction owner.
Each shared option establishes the positioning context for its clipped native
input, so native focus follows that option inside the same transcript scroller.

Side Chat transport interruption retains its original target/generation diagnostic
in AppLog and follows the existing reconnect lifecycle. Its status first presents
the actual connection, then the current running activity. Session, protocol,
action and current activity-read errors retain their business feedback; an older
activity read cannot update a newer connection lifecycle.

Interaction actions capture the request target, directory, endpoint, API
authority and main selection epoch before awaiting transport. A default Task
refresh runs only while that original source and authority remain current.
Session cards reconcile through their normal events and snapshots; Side Chat
retains its own explicit refresh callback.

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

Agent activity projects the real output Parts of assistant-role Messages. User
input belongs to the original transcript and the occurrence's input context,
which the progress card exposes through its handoff disclosure. Both bounded
Task history queries and Session transcript projections classify by the
persisted Message role before ordering and limiting activity, matching live
Part updates. A reconnect therefore preserves the same output activity while
keeping the complete input available; input text and attachments do not become
extra agent progress or consume its bounded activity slots.

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

Side Chat's visible reader retains its top/following intent and first visible
Source row or Markdown block anchor in the existing
conversation UI owner, keyed by applied authority, source and Side Session.
Primary selection clears that bounded intent; hidden geometry and retired
selection/authority owners cannot write it. The selected reader restores through
the shared scroll controller, whose intent getter retains the original pending
top through incomplete layout instead of saving a clamped zero. Main, Side Chat
and member transcripts share one stateless content-anchor capture and resolution
implementation. Returning to a Side Session after a hidden width change resolves
the same original Source identity or Message/block offset in its current layout;
intermediate restore geometry cannot replace the saved anchor. Explicit reader
input and a return to the bottom retain the controller's existing semantics.

Side Chat exposes the same explicit scroll-to-bottom action while its reader is
paused. Its current authority/source/Session reader owns that action: it enables
the existing tracking intent, jumps through the shared controller and saves the
result in the same bounded store. Sending a new side question performs that action
once at dispatch. Later output and completion retain any reading intent the user
expresses during the reply; expanding reference history still pauses following.

The primary conversation keeps at most 50 reading positions in that same UI
store, keyed by captured API authority revision and actual source kind/ID.
Selection clears transient primary disclosures without clearing this bounded
view memory. Before replay or projection retirement, its one registered visible
reader captures the current top/following intent, viewport width and visible
content anchor in transcript order. Text anchors carry the quotation Message,
text ordinal, rendered Markdown block ordinal and block offset. Source anchors
carry the original Message and stable type/Session/Message/source identity of the
visible source row, plus its viewport offset. Source rows remain citations rather
than quotation text. An explicitly focused Source row in the same transcript
has priority over earlier visible prose when capturing that existing anchor;
the same visibility and closed-disclosure filters still apply. The existing
position Map's previous Source anchor retains that priority while its original
row remains visible, so layout controls and restore settlement do not replace
the reader's selected citation with preceding prose. Current Source focus takes
precedence over that previous row. Other captures retain their chronological
visible order. This lets the original width-restoration
controller preserve the reader's selected citation while preceding text rewraps.
Both anchor kinds use the same bounded reading-position
store and restoration owner. A long first-visible Message can rewrap internally without changing its
virtual item index, so its whole-text pixel offset is not a reading anchor.
Empty, hidden, loading, unhydrated or
retired owners cannot publish a new position. A returning paused reader uses the
existing history loader to locate its actual Message and the existing virtualizer
card-scroll bridge to mount it, then resumes through the same scroll controller.
An already mounted target is pinned directly; an absent historical target uses
the bridge. Both pin the actual item through the existing virtualizer keepMounted
ownership for reading restoration. It does not start index or DOM alignment for
that request: an outstanding index alignment can otherwise overwrite the saved
Message offset on later item measurement. Explicit card jumps still align through
the same bridge; restoration retires its temporary pin on completion, reader
movement or source retirement.
During that restoration the same scroll controller resolves the actual rendered
block or source-row offset on each correction frame and includes that resolved target in its
existing geometry stability check. An unavailable target element waits for its real
layout; an unrelated streaming TextPart does not block a ready earlier anchor.
The existing measured-content callback also restores this same paused reader
when viewport width changes. Layout-induced scroll/clamp echoes cannot overwrite
the pre-resize position; explicit input or a settled restoration adopts the new
width. The controller's existing scroll-input ownership also prevents layout
restoration from restarting during an active key, wheel or pointer movement;
actual scroll events can record that reader's new width and paragraph. This
keyboard intent is recorded in the capture phase, before a caller's custom key
handler prevents the default action; cleanup retains the same capture option.
Recreating a controller cannot invert that order. Existing nested-owner,
editable-control and modifier boundaries still decide which input it owns. This
applies to pane and window width changes without a Dock-specific
scroll path. It preserves the paragraph and pixel offset within it, not a character
position after rewrapping. Regions without a rendered Markdown anchor retain the
numeric-position contract.
The pending reader and pin retire only when the controller settles or owned input
or cleanup retires it. Numeric position callers retain their existing behavior.
Initial sources follow the bottom. Explicit reader movement and Scroll to latest
retire pending restoration and own the next saved intent. API rotation and a new
browser lifetime remain new view ownership; this does not persist another
transcript, alter runtime status or manufacture a reading input event. Ordinary
Session, Task and Mission main views share this implementation; failed active
restoration is reported through the existing application diagnostic boundary.

Source disclosures retain their actual adjacent Part group and truthful group
count. The summary states its next action from the same expansion state: show
the remaining source count when closed, collapse that count when open. Its
count excludes the first, always-visible leaf, and follows the actual group.
Expanded leaves retain canonical type/Session/Message/source identity
while reading current metadata and index. A single-source group needs no leaf
ordinal; a larger group keeps its current per-group order. Opening a disclosure
and focusing its URL/file/document leaf declare reading intent through the
existing nearest transcript owner, releasing automatic following. Native Tooltip
and source actions retain their keyboard behavior; an explicit return to the
bottom can resume following through the existing scroll policy.

An expanded group also exposes a compact collapse action after its last leaf.
It closes the same disclosure state, declares reading intent, returns focus to
the original summary and brings the collapsed source group into view. The native
details keeps one summary; the trailing action is an ordinary Button, without a
second expansion authority or asynchronous scroll restoration.

The same footer offers copying the group's source locations when at least two
leaves have a canonical URL or file path. It includes the first visible leaf,
preserves producer order and duplicates, and joins the same locations used by
individual copy actions with newlines. Its localized count describes copyable
locations; documents without an address do not acquire one from a display title.
The shared clipboard primitive owns pending, confirmation and failure feedback
for the current value and mounted control. Copying declares reading intent;
neither source identity nor disclosure state is rewritten.

An expanded web-source leaf shows its full wrapping title and a secondary host
derived directly from that same canonical URL, including any port. The URL
remains the link target and full Tooltip detail; a title/provider is never used
to infer its host. An unparseable URL has no host presentation. An expanded
file-source leaf presents its existing filename/title on one ellipsized line
and, when the canonical Source has a range, a separate compact localized line
label. The line label does not shrink with the filename; full title, path and
range remain available through the same focusable Tooltip and accessible name.
Filename whitespace is preserved rather than normalized for this layout. A
whole-file Source without a range has no invented line label. Secondary path/range
metadata still comes from the same canonical source. The existing selected directory makes an
in-project path relative; an external path retains its absolute identity.
An identical title/range and path/range needs only one visible line.
Within one adjacent Source group, consecutive ordinary file entries for the
same exact path share an identical directory caption: the first retains it,
and subsequent entries keep their own filename/range and actions. A different
path starts its own caption even when filenames match. Attachment labels and
location captions required by custom titles remain per-entry. Full Tooltip
details, accessible names and copied locations retain each Source's own facts.
An ordinary file's copy-action name uses that same relative path and line range
as its open action, so identical filenames in different directories remain
distinguishable when the copy control receives focus. Attachment titles keep
their authored display contract; clipboard values retain the complete target.
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
Completed, expanded Tool payloads participate in the outer conversation's scroll
flow and do not establish an internal scroll container. Bounded and live payloads
retain their own scrolling and reading-position restoration; expansion keeps the
complete source text, wrapping and copy value intact.
Bounded Tool payloads keep each format's pixel position and visible original-text
anchor in that same conversation UI record. They reuse the outer transcript's
character measurement and resolution primitives. Their existing ResizeObserver
continues observing visible size changes after initial restoration; one frame
controller restores the original character after rewrapping. Layout scroll events
cannot replace the record before its changed width has been handled. Real user
scroll input still takes over, and full expansion leaves the outer transcript as
the scroll owner. These reading records are in memory, separate from persisted
card folding and application data migrations.
The existing canonical message-list/message/Part GET readers use Project
identity admission, independently of the current execution-model configuration.
Session metadata, project Session lists, child lists, TODO records and turn
artifacts use the same identity admission. Mission status and durable activity
cursors are likewise projections under that exact Project identity.
Opening persisted Mission or ordinary
Session history does not initialize executable capabilities or validate the
currently configured Provider model. Exact Project membership and Session
lineage still qualify these reads; effective configuration and execution
requests retain their own model-validation and runtime admission contracts.
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

Frame mounts replace accepted HTML blocks by index while retaining the already
presented tail until the current result supplies its final length. A changed early
block, including a newly resolved reference link, does not truncate the rest of
the document while later blocks await their frame. The frame's local cursor,
rather than the retained array length, determines remaining mount work. A complete
result trims any surplus tail only after its target blocks have been processed;
an actually empty source still clears its presentation immediately.

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
directory. These positions contain viewport geometry, follow intent and the same
Source/Markdown content anchor used by Main and Side Chat.
Anchor capture and restoration exclude the content subtree of closed native
disclosures, whose layout boxes can remain nonzero. Visible summaries and open
disclosure content retain the ordinary geometry and identity rules.
Transcript data still comes from the existing projection. The outer panel is
force-mounted to retain this UI state across Dock closure. The canonical target
identity is independent of visibility. Its already presented transcript and
selected-agent controls remain mounted while the Dock or member-list view hides
them; changing authority, parent source, child Session or directory still retires
the prior target. Only one current target is retained, without another transcript
cache. The inactive request scope aborts loads and pauses live/refresh admission;
reactivation catches up through the existing resource and cursor. Live projection
resets on actual target replacement, not on hiding the current target.
The scroll controller follows visible activity: cleanup retires its listeners and
observers while hidden, and reactivation restores from the same reading-position
Map. Only visible active observations outside pending restoration save the
controller's reading intent and current content anchor. Hidden width changes
resolve that anchor through the existing scroll controller on reactivation,
including when a source grid changes column count. User input or successful
settlement retires the pending restoration before new reading observations.
Parent disposal clears the Map and retires the retained presentation.

Member selection labels use the real agent role and, when that role belongs to
multiple distinct Sessions, a short suffix of the actual Session ID. Suffixes
extend when necessary to distinguish the current peers, and the full identity
remains available on hover. The selector, member list, progress cards, activity
rail and their accessible names share this presentation. Rail navigation names
contain the localized view action, actual identity and current status. Rail
tooltips contain identity and status only, keeping their native accessible
description concise. Original input remains with its canonical Message and
handoff context in the conversation, without inferring human authorship from
provider role=user. Activity updates and later execution
occurrences keep the same Session value; they do not recreate selector options
when identity labels are unchanged. Conversation targets and reading positions
remain keyed by the complete canonical target.

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

Inline operator guidance requires the selected Task's resolved root Session.
The shared target helper then selects a non-root, non-orchestrator agent for
the existing Task coordination route. Card, ChatBubble and nested worker cards
use this same applicability rule. Ordinary Session members retain transcript,
copy and Source actions; they do not expose the Task-only guidance form.
The shared guidance form explains that coordination does not reopen a finished
Task and points to its main message input for further work. Its localized help
describes the textarea, and the send button is positioned against the input
field rather than the full form, so help, errors and receipts cannot shift it.
Acceptance feedback states durable receipt only, not execution completion.
The single Conversation turn control remains available for a resolved Task
worker while it is pending or running, so guidance can arrive during execution.
Its answer-copy action still receives text only after the turn has settled;
guidance applicability does not depend on a final answer being present.

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
single physical WebSocket connection carrying canonical SSE bytes; a selected Task or Session
may own one additional replay stream. Starting the global stream is idempotent
while its owner belongs to the current API authority. Health recovery, workspace
projection refresh and the stream's retry share that owner, preserving live
notification delivery. Explicit disposal, an expired authority or an actual
disconnect ends the owner before another connection takes its place.
Task metadata mutations (archive/restore, title, budget and pin state) publish
their committed `TaskUpdated` through the existing durable Bus. The same global
stream maps that publication to `work-ledger.changed` with the source directory,
Task identity and sequence zero: it invalidates a current read without advancing
the execution Protocol cursor. Execution/Interaction facts retain their original
Protocol subscription and sequence. Reconnection hydrates the current canonical
projection, including Mission outcomes and child Tasks.
Archive actions show their observed committed result with the shared inline
Feedback component. Subsequent list-read errors retain that success alongside
the read error; source/query replacement retires the feedback. Its action key
is translated at render time while the original item title remains unchanged.
Every Mailbox change causes a fresh
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

Permission and Question history parts retain original interaction identity,
request/response order keys and times. The sole seed pipeline marks the stable
part phase as pending, request or response; the renderer dispatches by that
phase. A mutable interaction status cannot turn an old pending part into a
history response during Board replacement. Pending controls require current
pending status, while resolved request/response text uses the existing reactive
formatter in the current locale. Permission replies validate the exact canonical
decision/status and derive automatic provenance from the real response.

Permission Settings groups use the original requested time and execution outcome.
Historical decision-index facts appear with their actual indexing time and a
neutral localized label. Unclassified original audit reasons remain recorded
data in Operation details under localized labels; the main timeline uses the
current language without rewriting participants' original content or the ledger.

Documentation and non-UI contract checks may validate Board transport shape.
Overlay presentation and interaction are accepted only through a real isolated
page, direct interaction, screenshots bound to the changed region, and manual
visual review. Goal acceptance must exercise a live Task and inspect at least
accepted and not-accepted rows alongside independent activity and review
associations. Browser Preview acceptance covers inactive target discovery,
automatic reveal when a target becomes ready, active evidence hydration, and
the native WebView mount without persisting UI automation artifacts.
