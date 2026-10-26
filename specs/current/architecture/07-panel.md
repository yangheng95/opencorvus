# 07 — Overlay Panels And Task Evidence

The `/ui` document and its static resources share the server process's
[immutable resource ownership](server-runtime-readiness.md#static-frontend-resource-ownership).
Rebuilding an input directory does not switch a running page's module version;
new server processes capture the new publication. Project and conversation data
continue through their existing dynamic readers and subscriptions.

A complete `message.moved` bundle transfers the original Message and Parts from
its named source Session to their authoritative target positions. Source-side
full or Part-first projections retire before the target bundle is applied; a
new target order key is part of this transfer. Ordinary full replay and a Move
already owned by the target still require the existing order key. The Task tree,
member input/activity projection and open member transcript consume that same
original bundle, preserving IDs and full content without a second Message.

The shared workspace-location parser owns the current document's refresh input.
Task locations use `taskID`; Session locations use `sessionID`, `sessionKind` and
`directory`, with `experience` for Chat/Work. Mission restore reads the original
Session identity and Mission status before using the same explicit navigation
lifecycle. A global Composer launcher records its product pillar and conversation
target, so a refresh preserves explicit creation intent over an older saved Task.
Startup captures the location before workspace initialization can clear it.
After locale hydration, the first healthy connection restores an explicit
location through its ordinary navigation owner before default-directory
discovery, including a document which first started offline. A newer selection
owner supersedes that launch intent. Its actual project scope owns subsequent
initial data loading. The same initialization owner consumes the launch input
once; subsequent reconnects hydrate the current workspace. A cold start without
a locator still discovers its default and restores its existing saved preference.
The visible-period monitor distinguishes transport health from a completed
workspace recovery, so a healthy probe by another caller or an initialization
failure cannot retire pending recovery. It is registered after the initial
attempt even when that attempt fails, and keeps the existing single-flight probe.
Launch discovery retains the registered project inventory when its optional
scan root is missing or is a file: `root` keeps the authored launch path,
`defaultDirectory` is empty, and no substitute project is selected or created.
Other filesystem errors retain their actual error contract.
Successful current selection owners replace the same-origin URL; departure
clears the locator, and only explicit launcher navigation publishes its launcher
target. Other query/fragment data and History state retain their existing values.
The address carries no credentials or message bodies and creates no execution.
Existing Task cold-start preferences retain their separate host-settings role;
there is no additional localStorage selection cache or persisted-format revision.

Task, Chat and Mission hydration share the existing `boardStore.taskSwitching`
projection. App directly binds the non-blocking header progress indicator and
the conversation region's `aria-busy`/description to that one state. The
indicator has a localized conversation-loading name and indeterminate
`progressbar` semantics while active; its idle projection is hidden from the
accessibility tree. No second DOM-writing effect or synthetic percentage owns
the loading presentation, and the fixed indicator reserves no layout space.

Invalid or conflicting location parameters produce the existing localized
diagnostic after settings and locale hydration. Connection and sidebar loading
continue, while that rejected navigation consumes the existing workspace epoch
and does not restore an unrelated saved Task on startup or reconnect. A later
explicit sidebar selection uses its ordinary admission and replaces the locator.
The original rejected-location exception is the single volatile
`workspaceLocationError` value. App renders its localized inline Feedback with
the existing diagnostic Disclosure; the next admitted workspace selection retires
that error. Logging alone is not the visible error contract.

A well-formed location whose actual resource read fails follows the same
localized failure contract and leaves connection monitoring, capability
reconciliation and later navigation active. The existing Task selection failure
surface owns Task hydration errors rather than duplicating its summary. Startup
and reconnect Task restoration share this settlement. Failure publication belongs
to the real API authority and admitted selection epoch: superseded Task restores,
Chat/launcher navigation and Mission pre-reads retire their late failures. Mission
hydration transfers to its ordinary navigation owner after the pre-read; the
pre-read epoch cannot suppress an error from that new owner. None of these reads
creates a replacement conversation or changes durable execution recovery.

Task refresh resolves `taskID` through the same global Task index reader's exact
identity filter before publishing a selected source. That filter precedes the
list limit and preserves the original Project directory; the first ten rows are
not the resource authority. The shared selector requires a complete, consistent
directory owner before reactive consumers can observe the Task. A paginated
index publishes its `hasMore` alongside its rows and cannot classify an admitted
Task as removed solely because that Task is outside the current partial page.

Locale catalogs resolve relative to the executing module, whose source `utils`
and published `assets` directories both sit beside the `i18n` directory. The
document route does not supply the locale resource base. The static startup
surface owns real frontend errors and unhandled rejections until the renderer
mounts, retaining the original diagnostic and a page reload action. Native
environment preparation failures keep their existing native retry command.
One startup lifecycle hands readiness and listener disposal to the renderer;
pre-catalog error reporting does not query unavailable translations.

Provider rows display model counts, summaries, complete ID tooltips and model-ID
search from the same public catalog used by model selection, through the existing
modelsForProvider reader. Configuration remains the source for model editing and
field intent; inherited catalog models are not copied into configuration. Missing
catalog data, catalog read errors and applicable Provider projection issues render
an unknown count and localized model-list status. A successful explicit reload
restores the catalog presentation. A catalog count does not prove authentication
or runnable model availability.

## Composer availability

Composer model groups retain each connected catalog option's canonical label
beside its fully-qualified ID. The visible list and literal search consume that
same option; search covers model label, model ID, provider ID and provider label.
Listbox typeahead uses that visible model label for prefix navigation. Selection
and persistence continue to use the fully-qualified model ID.

Project file listing, content/source-content, file status and text/file search
GET readers use the existing Project identity admission independently of
executable model bootstrap. They retain the selected Project directory,
relative-path and canonical physical-path boundaries, exact absolute-source
validation, original file errors, content revisions and actual Git/process
owners. The exact file save, create, upload, copy, move and delete routes also
use Project identity independently of executable model availability. After
their original request validators, they await the same project-scoped plugin
initialization used by full bootstrap. Original path/root protection,
no-overwrite publication, loaded content revisions, atomic writes, configured
formatting and canonical file events remain owned by the existing File API.
An already active Runtime retains its listeners; a cold file operation does
not claim full Runtime initialization or admit model execution.

The independent Task turn-artifact catalog GET uses that same Project identity
admission as immutable artifact byte reads and Session artifact readers. It reads
the existing completion occurrence, message ownership and canonical catalog,
retaining Task-to-Project checks and the original artifact contracts without
requiring an executable model.

VCS information, local branches and diff GET readers use the same Project
identity admission independently of executable model bootstrap. Information
and branch selection query the existing physical Git branch reader for their
current checkout. Runtime BranchUpdated subscriptions keep their original
owner/disposal; branch switching explicitly reinitializes that owner after
reset before returning fresh information. Git mutation and streamed commit
message execution retain their existing runtime and prerequisite contracts.

File Editor initial read failures retain one current original thrown value
under the existing target, API authority and load/reload generations. Shared
Feedback presents a concise localized hint, full original HTTP diagnostics
and explicit Retry through the existing reload operation. A repeated retry
failure replaces that record; success or target retirement clears it. Loaded
draft reload failures keep the original draft/leave safeguards and action-error
ownership. The single action error retains its original cause beside one message
key, translated when rendered in the current interface language. Save conflicts,
an unavailable original file and other save failures present concise operation
feedback while the full original error, HTTP response and request identity stay
in Details. Drafts retain their original save/reload/leave safeguards. A failed
reload presents a concise hint and complete diagnostics through
shared Feedback; its bounded native scroll region leaves the loaded editor
available. The leave dialog reads the same action error. Save conflicts retain
their existing meaning and write preconditions. No automatic retry loop or
parallel file loader is introduced.

Shared CodeEditor keeps original CRLF, LF and CR separators as line-boundary
metadata beside canonical CodeMirror Text. Changes map surviving boundaries
and give new boundaries the loaded file's first separator (LF for a file with
no separator). Only removed or overridden format facts join CodeMirror's
existing mapped undo history. Serialization combines the current Text with
these boundaries, so small edits preserve mixed endings and undo restores
deleted separators. External values use canonical Text equality before any
document replacement; format-only updates keep the text and cursor intact.
File drafts, artifact edits and exact-byte file revision/write contracts share
this one serialization boundary; no second raw-text draft or undo stack exists.
The shared editor theme also styles the original CodeMirror search-panel close
button with the existing icon-control size, reserved end space and keyboard
focus treatment. CodeMirror retains the query, localized panel and close/focus
behavior; no parallel search panel or state is introduced.

File Editor renders base64 image content from its existing FileContent response
through the shared PreviewableImage and image preview host. Image viewing is
separate from text editability: images carry the existing read-only badge while
text files retain CodeEditor, citation ranges and save admission. Other binary
content keeps the existing non-editable description. The file-image container
owns its bounded layout and scrolling; there is no additional fetch, image
cache, file mutation or parallel preview implementation.

File readers admit existing text candidates only when their complete original
bytes are valid UTF-8 and contain no NUL. Invalid candidates use the existing
binary response before text decoding, diff generation or editable revision
publication. The same byte predicate guards text saves after the existing path,
read-only and revision checks. Submitted strings must also round-trip through
UTF-8 exactly; NUL and isolated UTF-16 surrogates produce FileInvalidPathError.
Successful atomic writes and revision receipts share the same validated bytes.
Configured text formatting belongs to the save itself. File.writeText awaits the
single Format.file operation while holding its existing file locks, captures the
actual final content/revision, then publishes its edit notification. The response
describes that captured commit even if an external writer subsequently changes
the file. FileEditorPane adopts the returned formatted body only while its submitted
draft still owns the editor; a newer draft remains intact. File creation formats
text explicitly. Attachment saves, upload, copy, move and removal retain their
original byte-transfer semantics; edit notifications do not mutate these files.
The opaque content revision and FileWriteConflictError definition are shared with
the Tool observed-byte precondition. This extraction preserves the GUI's existing
resource-identity/byte algorithm and response shape. Tool read receipts remain
Session-scoped runtime facts; they do not create another persisted editor baseline
or change the GUI's cross-process save ownership.
Valid replacement characters, BOM, empty content and line separators retain
their original text. Dedicated image/PDF previews and existing extension/MIME
classifications keep their contracts; no alternate encoding is guessed.

Read sources resolved from canonical attachments carry origin=attachment and
the exact original filename from AttachmentStore metadata, including Unicode and
punctuation. Only unnamed uploads use the existing generated-name policy;
staging-filename safety rules do not filter display labels. URL,
shorthand and the current Project store's physical blob paths use that same
authority; metadata is read after physical-path permission admission. The store
recognizes its own database-scoped directory and blob names, not arbitrary hash
filenames elsewhere. Windows blob aliases resolve to the canonical stored name
and path. Metadata sidecars remain ordinary files. Missing canonical
metadata keeps its actual failure instead of silently presenting a storage name.
Source path/range/symbol identity is unchanged. Sources shows the attachment name
and localized attachment caption, and opens its exact absolute path through the
existing read-only source reader. The file target's optional displayName is a
presentation annotation; content loading, write admission and navigation resource
identity still use directory/path/sourceAbsolutePath. A display-name change can
update the target/reveal without reloading its file content. Ordinary project
file sources retain editing. Ordinary Sources and body references use the same
file-workbench classifier: project-relative and project-contained absolute paths
open one project target, preserving drafts across repeated citations. External
absolute paths retain the source reader. Explicit attachment sources retain their
original display names and source targets. Existing persisted source snapshots
are not rewritten.
The file workbench prioritizes the exact filename in its compact heading and
text editor's accessible name; a long parent directory cannot consume the space
before the filename. Explicit displayName values remain authored presentation
labels without further path splitting. Ordinary filenames use the existing
server-path syntax and retain every character. The heading's full-path title
keeps the resource location available without changing its identity.
Body-reference click delegation also retains the exact already parsed path
attribute, including whitespace decoded from an authored Markdown destination.
Empty-attribute validation does not supply a trimmed replacement resource.

Ordinary project-file keys and absolute containment share the server-path lexical
normalizer with project-directory identity. Dot segments reduce against the
selected directory, including return into the project and root clamping. Windows
directory-prefix comparisons retain their existing case policy; the remaining
filename preserves case, whitespace and POSIX backslashes. Same-file citations
retain the draft resource while advancing the requested range/reveal; move and
delete admission use that same key before reconciling the returned location.
Explicit external/attachment source targets keep their original read-only path.
Lexical normalization does not infer physical symlink or hardlink identities.

File-content Git comparisons derive one literal worktree-relative path from the
already admitted lexical full path. One porcelain-v2 status snapshot supplies
the changed entry and HEAD identity, including an explicitly unborn branch.
Exact NUL-delimited tree entries select the original blob from that commit;
only an initial branch or a successful exact-path tree query proving a new file
(including a prior directory or gitlink at that location) admits an empty baseline.
Exact mode/type pairs distinguish regular blobs, symlink blobs, trees and gitlinks;
unknown pairs and Git/protocol errors retain the existing HTTP error
contract. Content, physical revision, permissions and original patch labels
keep their reader contracts; raw citation spelling is never Git object syntax.

Project file content projects an attachment's canonical displayName from the same
AttachmentStore metadata for text, binary, image and PDF reads. Body path links
therefore retain the original filename in the toolbar and accessible preview
labels, without making that label a resource key. A persisted Source's explicit
display label remains its annotation; ordinary references use the current loaded
content label. The existing resource/generation loader clears previous content
before another read. Header tooltips retain the actual path for same-name
attachments. Missing canonical metadata is a FileNotFoundError with a metadata
diagnostic; it is not replaced by a storage-name label. Ordinary copies and
metadata sidecars retain their file-path labels. Absolute source-content remains
an independent read-only byte reader.
Canonical attachment HTTP responses read the same verified reference and bytes,
and retain its filename through RFC 5987 UTF-8 Content-Disposition. Office source
types come from the qualified profile registry; PDF and other safe preview types
remain inline, while active SVG remains download-only octet-stream with nosniff.
Explicit Markdown image-file links and path-like image codespans use the shared
project-file recognition list and the existing workbench admission. The image
extensions accepted by that list follow the File reader's image formats, while
external URL and inline Markdown image semantics remain unchanged.

Project and absolute-source file reads also return PDF bytes through the same
FileContent base64/mimeType contract. Encoded PDFs remain read-only under the
existing write admission. File Editor lazily loads the shared PdfPreview used
by FilePreviewArtifact, retaining one PDF.js document/canvas lifecycle, resource
authority, page and zoom controls. The current viewport ref owns its resize
observer so error recovery observes the replacement node. Resource errors are
checked before reading a failed Solid resource. A pending navigation is read
only when its intent exists. A positive observed viewport width starts page
layout even before an inline reader has content height; zero height preserves
pending reading-position restoration rather than withholding the first width.
Original parse/resource diagnostics remain visible through Feedback. No synthetic Artifact is created
for a file source, and no second PDF renderer or file-read endpoint is added.
The current PDF document/page remembers only visible, stable top/left reading
offsets. Hiding a pane cannot replace them with zero-size geometry; reopening
restores them after the current-width page paint and layout animation settle.
Changing the document or page resets that local position. PDF and CodeEditor
share the existing finite ancestor-animation decision through the animation
utility; no global PDF history or conversation-follow controller is introduced.
The same page render also owns PDF.js TextLayer from that page's streamed text
content. Its display viewport shares the canvas page geometry independently of
canvas pixel density. Local transparent text styles enable native selection and
copy, including the library's rotation and user-unit dimensions. Only actual
text runs are selectable; the positioned layer's blank container cannot begin
a selection through unrelated PDF content-order nodes. Replacing a
page, zoom, width or source cancels both render tasks and removes the old text
nodes; read-position restoration waits for both current layers. There is no
second PDF parser, server text copy or optical character recognition path.

The same render owns PDF.js AnnotationLayer for HTTP(S) and internal Link
annotations. External URLs pass existing externalUrl admission and the main
document anchor opener. PDFLinkService resolves internal names, references and
page indexes within one immutable document per click; the local destination
mapper translates XYZ/Fit variants through the target page viewport and shared
zoom bounds. Navigation intent, document generation and render disposal protect
source/page changes and explicit same-value zoom commands. The final canvas,
text and annotation paint restores the target reading point after moving focus.
Each detached annotation container is removed on cleanup and may only be
attached by its current render. Annotation dimensions and rotation share page
geometry; keyboard links retain original labels or a localized accessible name.
Unresolved destinations show localized Feedback within the toolbar header,
leaving the document readable. Script, form and non-link actions are outside
this reader contract; there is no separate PDF history or external opener.

Text file-preview Artifacts use the existing resource's ready state to admit
CodeEditor. Successfully loaded zero-byte text is valid content and displays the
same read-only editor as nonempty text. Loading and resource failure remain
separate from content truthiness; no replacement characters, alternate attachment
contract or parallel loading state is introduced.

The main Composer owner derives ready, submitting or unavailable from the existing
connection/workspace admission and launcher submission signals. ChatComposer
derives interactivity from ready at the same dispatch, attachment, mention and
textarea boundaries. Submission is transient processing, not missing workspace or
model configuration. Send's disabled reason and help share one derivation from
the existing local submission, upload, availability, model and draft facts.
Active-work Stop retains precedence and only its existing stopping state disables
it. Availability is a derived presentation value, not a second state, model owner
or dispatch policy; directory-free Chat remains a valid ready context.

Historical conversation hydration and its existing SSE (Server-Sent Events)
stream settle independently of passive Composer model configuration. The single
Composer model service publishes ready/failed/retired reads only for its current
API authority, selection epoch, root Session/directory, projection generation
and caller ownership. A current failure clears the model and retains its original
typed error in one transient Composer issue, with Details and owner-scoped Retry;
successful reads or confirmed model writes clear that issue. Historical selection
failure remains owned by the history request. Persisted sources with an empty
model retain their existing Send availability requirement. Backend config and
execution validation, draft preferences and explicit write-error contracts remain
unchanged.

Session conversation tail, older-history pages, persisted message-list/message/Part
GET reads and event subscriptions use the
same existing Project identity admission, independently of executable model
bootstrap. Session lineage and exact Message/Part parent membership remain
authoritative; historical Tool state reads return the same complete persisted
state that owns the bounded transport marker. Tree filtering remains authoritative.
The common projection retains a long completed Tool title as its original Unicode-code-point
prefix with an ellipsis within the existing 256-byte JSON title budget. Escapes
and the marker count toward that budget; short titles remain exact. Transcript
and live projections share this owner, while disclosure reads retain the complete
canonical title, input and result under the original state-integrity marker.
The shared Tool summary uses a completed read's non-empty result title as its
resource label. ReadToolResultFacts validates producer-owned readType and the
existing lines/totalLines counts, with the actual offset for text and directory
windows. Binary reads have no displayed line window; directory counts label
entries. Completed text ranges use the returned count, including byte caps and
end-of-file limits. Empty content has zero lines. Read offset and limit are
positive integers admitted by the Tool parameter schema. The bounded transport
retains these same facts, and host file context still uses the sole lines count.
Pending/running ranges are explicitly requested bounds. A completed record
without current typed facts retains its name and expandable original details;
the UI does not infer a result type from paths or older count-only metadata.
Errors retain their canonical failure text. Expanded Input still shows the exact
request locator and bounds. Main, child and card summaries share this owner.
The event
handler captures its existing Question reader before entering streamGlobalSSE;
the stream runs outside Instance context and reads explicit Session/Project
identities, canonical message/protocol facts and the real Permission ledger.
Snapshot/live ordering, durable terminal/error recovery and abort cleanup retain
their existing owners. Session config and execution routes keep their runtime
validation contract.

The exact existing-execution Stop endpoints for Chat, Work, ordinary Sessions,
Tasks, Mission and Task child Sessions also use Project identity admission.
The original domain authority, projected worker identity, physical cancellation,
captured input terminal publication and canonical Task receipt remain authoritative.
Task cancellation retains its independent cleanup lease after the request returns;
unavailable execution models do not replace these controls with model bootstrap.
New input and actual execution retain full runtime initialization.

Accepted Task and Mission stops retain the existing cleanup drivers even under
cached identity admission. Original cancelling/closing intents survive request
failure and converge through the same durable request and physical owner.
Normal execution scans retain initialized runtime admission. A cancelled Task's
current panel message submission can reopen its execution epoch; that submission
is not proof that terminal conversation history remains terminal. Repeated native
assistant text Parts must be investigated through their actual model/decision
facts and must not be hidden by display deduplication.

Task Build observation content GET uses the same Project identity admission
independently of executable model bootstrap. The handler retains actual Task
membership, Task-owned observation/file/side identity and bounded ranges, then
reads the persisted immutable Git object through its existing process owner.
Working files and current model availability do not substitute for that content;
config and execution routes retain their runtime validation.

Expert Squad search, active catalog, inventory status and diagnostics,
exact inspection/settings detail/configuration, Mission Skill catalog and Project memory
GET use Project identity admission. Their inventory generations, Session lineage,
Task-fixed package revision, skill cache invalidation and canonical memory envelope
remain authoritative. First memory read keeps idempotent envelope materialization.
These readers preserve actual configuration/package errors without execution-model
bootstrap; Session configuration, prompts and memory organization retain runtime admission.
Raw GET /config retains its separate configuration-data contract. Selected Expert readers
read current installations; configuration reads keep declared secret-value redaction.
They do not substitute current package bodies for a Task-fixed revision or change configuration writes.
Evolution history GET and exact campaign-detail POST use the same Project identity
admission. They retain canonical installed-package snapshot materialization and
freeze the Artifact Catalog upper revision under the current Project's persisted
Task/root Session graph. Detail keeps exact source locators and returns the named
foreign-Project authority error with HTTP400 through the shared error mapper.
These readers do not start or resume a Task or publish an evolution mutation.

Installed-panel selection has one canonical physical key: built_in:id or
installation scope:namespace:id, validated through the SDK's existing ID and
namespace schemas. Row, detail, configuration, pagination, active-revision and
receipt selection use the same key/parser. An absent-page inspection preserves
all three installed identity fields. Refresh publication also requires the
entry's existing selected key to remain current; a new user choice retires that
read through the same selection owner. Explicit effective selection after clearing
an override comes from the newly accepted active package revision.

Selected Settings detail has one scope/selected/selection envelope. Its selection
contains the accepted catalog revision and nullable canonical effective physical
identity for the selected ID, using the existing index source union. The same
inventory supplies the exact selected declaration and ID winner; the original
package reader supplies current full bodies. Manifest identity/version equality
and one final Registry generation check settle that read. A changed declaration
or generation returns the existing package error with HTTP400 and original cause;
an unknown exact identity retains404. This declaration relation does not prove
immutable bytes across unannounced external filesystem changes.

The Installed panel retains that complete envelope under its existing selection
key/sequence owner. Activation buttons and handlers derive eligibility from the
accepted winner matching the selected physical installation, independently of
the currently active ID. Builtin collision issues make that selection unavailable;
external precedence remains Registry-owned. ID-only configuration writes keep
their original model, package and Task validation. Project default badges use the
configured Project ID and current winner; Session override badges use the actual
effective revision. A fixed Task shows its canonical assignment name/version and
keeps Project default changes explicitly scoped to future work. Ordinary Session
override/clear controls remain distinct from that fixed assignment.

The canonical resolved Task scope carries its real Task association along with
the root Session. One scope identity function owns Panel and request identities;
pending Task scope remains pending, and public catalog queries still contain only
their supported directory/Session fields. Selected detail failures retain one
original-error record. Shared Feedback Details shows the dispatched HTTP facts,
and explicit Retry calls the same one-shot loader with current selection/scope
guards. No polling, automatic retry loop or second selection cache is introduced.

Package Details displays the count of canonical scheduler capability_refs as
declared capability references and retains those encoded declarations. It does
not count an incomplete frontend-expanded subset as executable tools. Runtime
expansion and actual model request grants remain backend-owned.

Shared HTTP errors carry the dispatched method, path, status, decoded response body
and request ID. Details include that method; binary readers keep the actual path,
including POST Artifact reads. Caller-init mutation cannot alter the captured method.
Ordinary non-HTTP errors retain their own facts.

The active Expert Squad catalog carries its name and package revision from the
same resolved package manifest and snapshot. One scope-keyed Composer projection
retains those facts independently of candidate search/inspection failures. Task
read-only references show the fixed assignment separately from literal references
in the original Task request. Session/Mission references describe the current
effective package and actual first-message references; they do not claim a fixed
launch assignment. Full catalog failure, a new scope and global drafts retire the
prior package fact through the existing loader owner.

Installed catalog feedback retains the original thrown value in one nullable
failure record. Its presence controls the concise recovery hint; Details use the
shared HTTP formatter on the original thrown value. Expert catalog/settings/market services preserve the original
rejection. Refresh and both pagination paths publish data, errors and loading
completion only under their existing current sequence and scope; API authority
retirement remains a control outcome.

Each subagent progress card exposes one visible header Open button with the
same real Session callback used by article/header clicks. Pointer and keyboard
activation share that control; nested Handoff disclosure and content actions
retain their own propagation guards. The existing main subagent selection and
Dock tab remain the sole navigation owners.

## File comparison evidence

One current diff service and Tool reducer project recorded comparisons. FileChange
declares complete evidence or a typed incomplete reason, original source receipts,
optional producer-owned physical status and nullable line counts. Undefined body
or object reference is unknown; explicit verified immutable null is absence. Empty
text cannot establish creation/deletion. Binary evidence has no text-line counts.
Tool, saved Session, immutable Build and path coverage intervals retain distinct
subjects. The shared summary counts unique known paths and leaves unknown or
overlapping comparison totals null; all Review, conversation, inline Tool and
Environment surfaces consume that same derivation.

Published Task Artifact previews and downloads read exact immutable bytes through
the existing Project-identity context. The POST byte-read request does not require
an available execution model. Task/Project ownership, original snapshot identity,
resource integrity and byte ranges remain mandatory; execution configuration and
prompt routes retain full runtime validation.

Normal multi-Edit composition requires the same real accepted input batch,
Session/actor, exact endpoint lineage and completed normal step controls with
unique completed Tool membership. Message placement and clocks do not establish
mutation causality. Missing/deferred/control/error/changed-batch or unsupported
lifecycle evidence remains explicitly incomplete; a single actual completed Tool
comparison remains separately inspectable. Write path coverage supplies no invented
after text. Canonical deferred mutation receipts remain visible even with no known
path. Current saved Session Snapshot DTO lacks binary/absence flags and is therefore
incomplete; current Build nullable object evidence is validated at its sole adapter.

Large completed Edit and Apply Patch results retain bounded per-file observations
from their producer metadata: original file index, exact path/move path, explicit
physical status and text-line counts. This shares the existing 1024-byte metadata
budget; a complete observation that cannot fit remains explicitly unknown. It is
a projection of the canonical Tool receipt, never a second persisted change store.
Single-receipt comparisons show those known counts and lazily read the exact
immutable Part only when Review opens. Inline disclosure and Review share one
authority-scoped Part reader/cache and verify canonical identity, state integrity
and observed comparison identity. Multiple Edit receipts still require full text
endpoints and normal causal evidence before composition. Current working files
cannot substitute for historical endpoints. Apply Patch deletion counts use the
same text comparison as additions, updates and Review, including trailing newlines.

Review layout follows its actual panel width through the existing CSS container
primitive. Narrow panels place the file scope above a full-width wrapping diff,
retaining independently scrollable panes and original keyboard selection. Wider
panels retain the side-by-side comparison and file collection.

Tree-writer retains actual qualification/control facts in the existing Message
owner, with a readonly transient snapshot for the reducer. Full history validates
canonical membership including control-only Messages. Authoritative incoming
bundles retire only their exact old projected Message before replacement, preserving
other Messages and older loaded pages. Real Part removal validates its original
Session/Message/Part/type before mutation; no new projection owner is introduced.

Task and Session conversation hydration, child snapshots/deltas and preceding
history retain the complete authorized Message identity window. Mission
conversation uses the same Session readers. `view.sessions.messageIDs` records
that window's actual membership; `view.messages` records its display placement.
Control-only Messages consume the bounded window and advance its canonical
history cursor. Reasoning bodies remain omitted by the current transport
projection. Changed Task Messages replace their own identity bundle; delta
removal IDs describe actual deletion or movement out of the addressed Session.
The child and Side chat parser retains those validated identities so a later
pending Part can attach to its real Message without replaying message creation.
The shared strict message-display predicate is applied when projecting cards
and Side chat lists. A real assistant error retains its reason and error state;
identity-only rows do not create visible message boundaries. Archive and
turn-artifact consumers retain their existing visible-output contracts.

Message cancellation derives from the canonical `MessageAbortedError` shape,
through one shared presentation reader. Main and Side projections retain the
aborted terminal reason. Message-level cancellation uses a neutral stopped
notice with its original reason and complete cancellation details; member
history carries that same classification with the original Message identity.
Copy controls and headings follow the current language. Other assistant errors
use a localized unfinished-response heading and follow-up guidance. Their complete
original reason and additional details remain in one expandable error diagnostic,
including failures that have no additional details; copy controls keep the original
reason/details text. The underlying Message/Tool facts stay intact.

Review selection is exact group/path. Material request identity includes endpoints,
objects, evidence and receipts in memory; ambiguous shorthand is a precise error.
Loading/failure cannot present a previous preview. The existing logical immutable
read captures one API authority and directory for both sides/all chunks and validates
the original authority before returning. Known non-text filtering excludes only
isText=false; unknown records stay inspectable. Incomplete prose wraps within its
pane; genuine text diffs retain native two-axis scrolling. Status chips remain
nonshrinking horizontal metadata in the three existing shared consumers.

## File editor language support

The File editor's existing download action exports the current text draft or the
complete loaded base64 image/PDF bytes with their MIME type and canonical file
title. Binary preview downloads use the shared transport decoder and Blob
download primitive; they do not stringify base64 or refetch the file. Content
without a byte payload uses the explicit original-file action only for a Project
file. `GET /file/download` reads that exact relative path under the existing
Project identity context, independently of execution model readiness. It checks
the canonical path, streams an opened ordinary file and preserves AttachmentStore
filenames through the same name reader as previews. Unknown absolute source files
retain their existing preview contract. Original downloads represent the current
file read, rather than an immutable historical Artifact snapshot.
The original-byte route always returns `application/octet-stream`, matching its
OpenAPI binary schema and default SDK Blob parsing even for TXT or JSON originals.
The filename remains in Content-Disposition; preview MIME types remain separate.
The same action is available in the non-previewable file empty state. Its binary
request captures the current API authority and file owner; file/authority changes
and pane cleanup cancel that request. Only its retained owner may show a download
error, through localized Feedback with complete diagnostics. Other editing and
navigation controls remain usable. Loading and file navigation reservations
retain the same disabled boundary as text downloads.

Every accepted explicit file-open request advances the existing reveal revision,
including a repeated range-free request for the current resource. The main
workbench consumes that revision to reveal a hidden Dock. Repeated resource
identity preserves the editor draft and loaded content; line citations also
retain their existing exact range reveal behavior.
FileEditorPane captures the current focus origin with that explicit reveal revision,
before an asynchronous read can mount its CodeEditor. Both range-free file opens
and citations use that layout-measured reveal for keyboard handoff. A newly created
file can receive input immediately; no synthetic line range is added. Artifact
editors without an explicit workbench reveal revision retain their own focus flow.
Range presentation still
sets the cursor, line band and scroll target after layout measurement. It transfers
keyboard focus only while the original origin, BODY or that editor's content DOM
still owns it. A control focused during loading retains its keyboard ownership.
The origin belongs to the existing pane/reveal lifetime; no global focus store or
new navigation revision is introduced.
Read-only CodeEditor content keeps a normal keyboard focus entry through the
existing read-only compartment's content attributes. It remains non-editable
at both the state and DOM levels; range reveals can focus the same view, and
navigation/search commands belong to that editor rather than the page.
An absolute Source target displays a localized read-only badge in the file
toolbar's save position. This status derives from the same target that owns
the editor's read-only mode; editable project-file targets retain their save action.
The shared CodeMirror theme also owns its built-in panel fields and buttons:
input surfaces, text, control sizing and focus use the existing design tokens,
so library light defaults cannot mix with the application's dark text palette.
The library retains its search layout, commands and keyboard behavior.
Both CodeMirror creation sites share the current application catalog through
one phrase mapping and a local configuration compartment. Locale changes
reconfigure the existing views, retaining their document and search state;
the library owns panel rebuilding. The editor's current accessible name updates
with its existing read-only content attributes instead of a mount-only label.
Equivalent phrase records retain their extension identity. A real phrase change
captures the library's scroll snapshot before configuration and applies it in a
following transaction, preserving the reading anchor across internal remeasurement.
Both ordinary CodeEditor and DiffArtifact use the same content configuration for
editability, read-only semantics, keyboard entry and accessible name. Each Diff
side combines its current translated role with the authored version label.
The merge library's unchanged-region widget is a native button in the maintained
package patch; Enter and Space use its existing synchronized expansion action,
then return focus to the originating editor. Collapsed text and action names use
the same phrase catalog, and the shared editor theme owns their surface and focus.
Citation reveal completion also requires a visible editor host with usable
dimensions. A retained hidden view keeps the current request unsettled;
the shared animation-frame scheduler and host resize observation apply that
same range after layout becomes visible. CodeMirror's measure phase confirms
usable layout and finished finite host motion before scheduling the reveal
outside the library's update phase. Completed request identity prevents
ordinary resizing from replacing the user's subsequent reading position.
An explicit whole-file source has no line range. Switching the retained view
to that source clears the prior citation band through the same decoration
effect while preserving its cursor and reading position; its current request
identity still includes the existing reveal revision.
The file pane uses the existing forced tab mount so hiding the Dock or selecting
another tool retains that single draft owner and its navigation guard. Closing
the file still clears the canonical target after the guard resolves.

Workspace selection asks this same editor owner before changing the selected
source, directory, intent, tools or accepting durable creation/dispatch. File
closure and the admitted workspace epoch commit synchronously through the file
owner's guarded boundary. Cancel, an explicit current-source no-op or a newer
user/committed-fact selection keeps both original file and workspace facts.
Internal hydration/directory primitives consume the explicit epoch; they do not
start another selection. Committed handoff/removal/recovery facts converge their
source while retaining the independently scoped file owner and tools.

Concurrent global Composer attachments share the existing single allocation
owner across admission, anonymous Project creation and complete activation.
Inputs capture their source epoch and begin transient byte capture immediately.
The resolver synchronously returns one readonly operation whose Promise yields
the exact directory/accepted epoch receipt. It explicitly accepts either
attachment admission or an already admitted epoch. Its
pointer, current admission sequence and workspace epoch must still agree;
same-lineage inputs join before a half-activated directory can return early.
Fulfilled operations remain current for their accepted epoch after the allocation
pointer is released. File and folder inputs register their identity before
awaiting; the Composer derives indexing count and Send availability from that
single live collection. Completion removes only its own token. Receipt and
operation validation keep late input bound to the Project that accepted it.
Current failures retain their own error feedback even when allocation rejects;
actual workspace navigation expires old input effects.

The registered file owner exposes its existing dirty memo for browser exit.
Only dirty pages register cancellable beforeunload confirmation. Actual page
destruction runs the one idempotent teardown on non-cached pagehide; browser Stay
and cached page preservation keep the mounted root, listeners and draft live.

Ctrl/Cmd+S within the file pane invokes that same dirty/save/error owner and
prevents the browser's Save Page action. It is not a global shortcut or a second
filesystem writer. CodeMirror retains its existing search and undo keymaps.

Editable project file reads expose an opaque revision of the same read bytes and
canonical physical resource. Both file save actions send that exact revision to
the single conditional HTTP writer. Canonical blobs in the current Project's
database-scoped AttachmentStore return their text without an editable revision;
the locked conditional writer rejects them with FileInvalidPathError. Metadata
sidecars and same-named ordinary project copies retain their existing editable
contract. The pane derives input editability, Save and the read-only badge from
this same revision-bearing text contract and the source target restriction.
A typed conflict preserves the authored
draft and loaded baseline. Reload uses the same unsaved decision owner and only
publishes a successful response still owned by the resource, generation and
draft revision; failed or superseded reads retain input. Save-and-leave errors
remain visible inside its decision dialog.

Explorer move/rename/delete asks that same file owner before mutating an opened
resource or its ancestor. The file-workbench service reconciles every successful
physical result immediately. Explorer refreshes all completed members even when
a later batch member fails, without owning a second editor target mapping.

Batch Copy uses that same completed-result reconciliation, including active file
search and the actual copied destination selection. Directory destination forms
validate their raw required input before normalizing it: relative dot segments
may identify the valid empty project-root key. A complete single-entry target
still requires a basename. File mutation sources cannot identify either the
current directory root or its Git worktree root, through lexical or physical
aliases. Independently addressable terminal symlink entries retain their own
move/delete semantics; an ancestor link does not make an entity root mutable.

File Node type describes the entry: an actual directory entry is `directory`,
and other entries, including terminal symbolic links and junctions, are `file`.
Listing and mutation receipts use the same entry projection and ignore-directory
hint. Listings extend this with the required `directoryTarget` boolean, observed
from the current target under the same project/worktree path authority. Ordinary
directories and admitted healthy directory links are expandable; files, known
missing targets and out-of-scope links are not directory targets. Unknown target
observation errors fail the listing. Listings sort directory targets before
other entries. Mutation receipts retain only the five entry fields and do not
perform another target query after publication.

Explorer's current successful listing owns this target fact. Expansion, folder
menus and destination actions use the link's original logical path. Selection
retains entry identity and its listing/file origin rather than copying a target
flag. File search remains a file-path result. A successful parent listing retires
unavailable child directory namespaces across expanded paths, cached children,
errors, loading and existing read tokens; it does not cover `..` siblings of an
empty project-root key. Failed parent reads preserve the last successful facts.
Completed read receipts keep their actual result when later parent observations
retire a branch. Moves map every expanded path and collect its required reads
alongside the source/destination parents, without deriving target facts from the
mutation receipt. The existing editor owner commits a successful move's new
logical path, then the content API determines bytes, revision or original error.
This does not add physical alias tracking or promise atomic target stability.

Move verifies that the destination parent's actual access chain remains
independent of the source entry being retired before native publication. A
dependency returns HTTP 400/FileInvalidPathError with the original destination
path; an existing destination entry, including a dangling link, takes precedence
as HTTP 409/FileConflictError. Independently addressable aliases to the same
target remain valid. Entry identity combines its exact address with BigInt
filesystem identity; Windows observes the terminal reparse entry through one
non-following handle and preserves junction versus symbolic access namespaces.
This integrity check does not apply to Copy or claim atomic external-retarget
protection. It does not add directory-link navigation or a second receipt.

Move/copy use one access resolver for source declarations and the complete final
tree. Access namespace and actual lookup position remain distinct; Windows
junctions retain the outer namespace while symbolic links replace it. Current
source facts and actual Copy staging facts supply entry identities, original
link text, creation types, member names and native short names. A finite position
projection interprets these facts at the destination's real parent. Move retires
the old source namespace; Copy retains it. The current directory and worktree
remain the only path authorities. Known in-scope missing targets stay valid.
An unallocated Windows root short name is not guessed: both missing and possible
root-alias interpretations must remain in scope and resolve finitely. Outside,
recursive or unverifiable recursive access returns HTTP 400/FileInvalidPathError
with the original source member path. Unknown filesystem failures remain errors.
Source/stage members and access witnesses are reobserved before publication;
external retarget races are not claimed atomic. Copy's mature ordinary-entry
copier and explicit typed symlink creation precede final-tree permission checks
and no-replace publication. Strict checks retain creation types, link text and
file bytes. None of these private facts add directory-link navigation, a public
target receipt or another permission root.
Recursion and self-directory protection apply to actual directory entries.
Delete retains the existing source authority and unlinks admitted terminal
entries without requiring their targets to exist. Unknown filesystem errors
remain errors; only known missing paths map to the public missing-path contract.

File listing and mutation receipts share one current-worktree root ignore-rule
loader and entry matcher. Public Node paths stay directory-relative; rule
coordinates retain the logical worktree entry, including internal and terminal
links. An admitted external directory alias maps its outer continuous physical worktree
ancestor to that root while preserving the remaining logical entry suffix.
An admitted entry with neither a logical worktree coordinate nor a continuous
physical-parent worktree mapping has ignored=false; the root container itself
also has ignored=false. An empty root offset remains a valid entry anchor;
rule reads and path resolution errors remain errors. Root .gitignore and .ignore
retain their existing order and scope, without a second directory rule source.

Explorer feedback retains operation results, validation reasons and original
failure causes in the existing mutation, upload, directory and search owners.
Current-language summaries and counts derive during rendering; language changes
do not replay file actions. Stable API error types supply localized summaries,
with complete original diagnostics in the shared Details disclosure. Upload
publication followed by reload failure retains its committed-upload meaning.
Expanded directory failures derive from the current directory error Map;
feedback and diagnostic scrolling stay within a bounded Explorer region.

Empty normalized directory keys display the current-language root-folder label
in Explorer destination, creation and directory-refresh feedback. Nonempty
directory paths remain exact; a missing target is not a root fact. Only the
typed upload-target directory field uses this display projection in errors.
API paths, completed receipts and original Details retain their identities.

One Explorer action outcome retains its actual completed receipts, the failed
member or operation cause, and every started directory/search refresh receipt.
Completed counts derive only from successful responses. Member failure and
subsequent refresh failure remain independent original diagnostics; all started
reads settle before that action owner publishes its final outcome. A current
read is loaded only after its scope/token-owned result is published. Superseded,
unstarted or scope-retired reads have explicit retired receipts, never inferred
refresh success. Current actions can show completed work with unconfirmed
refresh; retired project/authority/selection owners cannot publish old feedback.
Upload uses the same refresh receipt contract and retains independent admission.
Directory and search owners remain the only read state, without a second queue
or waiting cache. Creating a file retains its successful creation separately
from the editor's actual opened, stopped or failed post-open result. Stable
failure and refresh facts preserve their Details owner across language changes.

The existing Explorer TabPanel stays mounted while its Files tool tab is open,
through the same Tabs forceMount primitive used by retained workbench tools.
Selecting File after a successful mutation, switching tools or hiding the dock
preserves this single Explorer owner, its query, expansion, selection and action
receipts. Explicitly closing Files disposes it; directory, API authority and
selection epoch changes keep their existing reset and late-receipt fences.
The active property means tool-open, so its one existing 15-second directory
poll continues while hidden. Existing selected-panel CSS owns visibility.
All explicit file actions, including upload, refresh the current nonempty query
through the same required-refresh collector as their directory reads. There is
no separate revision watcher, search polling loop or search opt-out. Concurrent
superseded upload publication and in-flight backend scan freshness remain
independent audit boundaries, not guarantees added by this panel lifetime change.

Explorer rows retain their render identity through equivalent directory refreshes.
The key derives from the existing API authority revision, directory, committed
selection epoch, row kind, physical node type and exact normalized path. Ordinary
and virtual rows use those string keys and read current metadata through the same
row projection; menu labels and actions consume current accessors. Name, ignored,
loading, error, depth and expansion updates do not replace the row owner. Actual
removal, rename, type or scope changes retire it. Search/filter retirement,
virtual-window retirement and switching across the existing virtualization
threshold can remount rows; stable focus across those boundaries is not promised.
Successful token/scope-owned directory listings reconcile the existing selection
Map with that exact parent's current members. Missing or type-replaced members
and descendants under retired ancestors leave the selection; unchanged members
retain order and read current metadata. Hidden rows, filters and failed listings
do not establish retirement. Anchor and active drag/drop lifetime use the same
listing fact. Already-entered filesystem actions retain their captured targets
and guarded operation owner.

Before the first successful root directory listing, an active scoped Explorer
shows pending loading, including the initial request scheduling interval. Empty
state is derived from a successful empty list; a failed root list retains its
error and Retry action. Cached successful rows stay visible during refresh.

The existing CodeMirror editor selects syntax by filename using the shared
`components/ui/code-editor-language.ts` registry. CodeMirror language-data owns
grammar metadata and cached dynamic loading; Markdown fences use that same
registry. File, code, notebook and diff surfaces share this language source and
the existing theme-token palette. Unknown files intentionally remain plain text.

Changing a language reconfigures only the editor's language compartment, keeping
the draft, selection and undo history. A disposed or superseded view cannot
accept a late grammar result. The editor displays its language, loading state or
a retryable highlighting failure; grammar loading never owns file saving.

## Mission draft and schedule authoring

Mission Board draft cards offer separate Edit request and Start actions. The
editor snapshots exact Mission/directory and original pending text when opened;
Board refreshes do not replace its authored input. Save uses `mission.editDraft`
and the shared refresh lifecycle. Typed conflicts preserve entered text for
review/copy; cancellation and saving do not dispatch an execution.

Manual Mission draft creation, draft edits, Mission/Task titles and Work Ledger
item pin changes use Project identity independently of execution-model readiness.
Their existing exact owner, kind, revision, transaction and event contracts still
apply. Item pin reads the Session in that exact Project; Project pin remains a
global operation naming its Project directly. AI creation and explicit dispatch
retain execution-model admission.

Mission creation failures preserve the entered fields and focus the existing
inline Feedback into view. Its current-language summary identifies the submitted
creation mode; the original diagnostic remains in expandable Details. Changing
mode or reopening clears that submission's feedback through the form's owner.

Mission creation searches update candidates while retaining the exact authored
selection, including a deliberately cleared selection. Context initialization,
explicit installation and user checkboxes remain the selection owners; search
ranking does not choose a candidate. The existing selected-ID count is shown in
the current language and number format. Available candidates with no selection,
an empty query result and an unavailable compatible catalog have distinct hints.
Package-authored descriptions wrap fully in the native scrolling checklist;
the Project directory dropdown retains its compact path presentation.

A hydrated empty Mission conversation reads its exact Session/directory record
from that same loaded Mission Board store. Its saved pending request is a
read-only context section outside the message tree, with the existing Board
action for editing or starting. Its displayed title reads the same current
Work Ledger Session item as the header, rather than the hydration snapshot's
title; renaming therefore updates both displays through one existing metadata
projection. Loading, failed or mismatched list data does not
supply draft text. Long requests retain native focused-region keyboard scrolling;
the parent history keymap owns only its directly focused viewport. Opening the
already selected source from the Board reveals that conversation without another
selection epoch, hydration or file-owner transition.

Scheduled timestamp presentation uses the current application locale while
retaining the original instant and existing browser time-zone semantics. List,
detail and search share one localized recurrence summary built from the existing
calendar parser. Basic frequency and weekday names use current translations;
advanced expressions retain their complete authored rule as technical content.
The machine calendar service owns parsing, serialization and edit comparison,
without a parallel hard-coded English presentation export.

Paused definitions present an explicit localized automatic-runs-paused state in
both list and detail. Their retained calendar frontier remains the authority for
resume. Manual Run now uses the existing server-settled request policy because
its response contains completed execution receipts. The panel's single mutation
owner also supplies its localized Running state until that response and the
canonical definition/run refresh settle; it does not retry the execution.

Scheduled automation basic fields own an explicit start date, time, time zone
and weekly day. The date/weekday of today are creation defaults only; changing
unrelated fields omits recurrence from the existing PATCH. Seconds and advanced
recurrence components that the basic fields cannot express retain their complete
authored rule in the current advanced editor. Explicit calendar changes use the
chosen anchor, rather than resetting it to the save date. Weekly review's Friday
is suggestion data passed through that same weekly field.

Scheduled editing owns an opening definition snapshot; the edit flag derives
from it. Submit uses its exact ID, original recurrence and session target, and
captures authored fields before resolving project identities. Background list
refreshes own list data only and cannot change navigation. User navigation
invalidates old list requests. Missing edit targets retain the form and report
an explicit error rather than becoming new definitions.

The opening snapshot also owns the observed physical revisionId. Save, explicit
status changes and deletion submit that exact version to the conditional public
writer. Revision conflicts retain authored input and explain an explicit fresh
read; the panel does not retry against a newer head. Automation public shapes
derive from the canonical generated SDK operation types.
Explicit return to the list starts its existing foreground read; row selection
and deletion stay unavailable while that read is in progress. The form's list
back button consumes the same owner, so reopening follows the latest definition.

The host-wide automation editor labels retained model and reasoning identities
explicitly when they are absent from the active project's connected catalog.
The target's saved identity remains visible and is validated by its existing
backend target contract. Explicit Default selection clears the saved override;
the panel neither invents another catalog nor switches global project state.

## Side conversations and quotations

The selected Chat, Task-root or Mission can open a Side chat in the Right Dock,
including from a transcript text selection or `/side [question]`.
Opening without a quotation or question selects a retained side Session after
its canonical list settles, creating the first only when that list is empty.
Explicit New side chat, quotations and questions create a fresh fork. List
failures remain lookup errors and retry the same lookup, rather than implying
an empty history. The internal request carries that explicit opening intent.
Each side chat is an independent assistant Session root. `metadata.sideChat` records its source
Session and inherited Message identities; this reference is not an execution
parent edge. The canonical atomic fork copies only completed reference history,
remaps Message/Part and accepted-input identities, and snapshots the source root
configuration overlay. Shared LLM system composition marks inherited context as
reference and only newly authored side-chat requests as active instructions.

Listing retained Side chats uses Project identity admission independently of
execution-model bootstrap. The addressed source must belong to the current
Project; the list reads that source's nonarchived retained side Sessions through
the existing metadata relation. Creating a side Session keeps its runtime
admission, canonical fork and configuration contract. An unavailable current
model can block creation or sending while the historical list remains readable.

The panel uses the canonical Session prompt, abort and event contracts with its
own exact target and stream lifetime. Connection snapshots and the shared
transcript parser reconcile reconnects; current activity comes from Session
status and exact-occurrence lifecycle events. The main selection, prompt owner
and transcript remain independent. Side chats are retained and reopenable;
closing their tab hides the panel rather than deleting audit history.
Side diagnostics retain the original complete Session error payload until
display, including its failure occurrence and convergence/observation failures.
Replayed errors whose exact original Message is followed by a later Message in
the same transcript remain with that historical Message. Current and uncorrelated
diagnostics still reach the panel's notice owner, as do additional persistence
or observation failures. A cancellation is neutral only when those additional
faults are absent. The existing transcript supplies this qualification; there
is no extra error cache, message lookup or inferred timestamp boundary.
The reference-history disclosure retains the user's open/closed choice in the
existing conversation disclosure store, scoped to API authority, source and Side
Session. Its layout choice survives Dock remounts and primary-conversation
returns alongside the reading position;
opening it pauses the nearest transcript's follow controller for reading.
Reference-history rows retain their component identity by canonical Message ID,
independently of wrapper objects received in a replacement connection snapshot.
The keyed accessor supplies current message data; removing a Message or changing
the actual target retains the existing retirement behavior. Reconnection does
not discard rendered history solely because its snapshot objects are new.
Pending questions and permissions render through the existing InteractionCard.
Permission approvals and retained requests share the structured scope renderer.
The canonical ledger Request supplies Tool identity, effect, exact scope and
available decisions; Task live/history projections use one helper, and standalone
Session snapshots/live events retain those same fields. Request body is the
original summary rather than embedded diagnostic JSON. Pending review shows the
requested resource in a bounded, selectable region; the complete original scope
remains in native Details. History defaults to a compact request and the original
decision label. These permission facts use direct text and structured rendering,
while Question and participant messages retain their Markdown contract. Product
labels follow the current locale; technical identifiers and source values stay
unchanged. This presentation does not change authorization, reply ownership or
recorded ledger facts.
Side Chat cards project their body parts through the shared conversation display
contract, as child transcript cards do. Full protocol parts remain in the
transcript; execution step markers are metadata rather than card body content.
Replies use the exact Question or Permission endpoint and side-chat directory;
the side stream owns refresh, so answering does not reload the main Board.

Text selection offers Quote and Ask in side chat. A scoped composer draft owns
the quotation, its exact source identity and question text. The removable quote
card is presentation of that draft. Submission serializes the quotation as a
visible Markdown blockquote in the real user Message, using the same text for
storage, rendering and model input. Side replies can be quoted back into the
main composer for the user to review and send.
Side submissions retain their caller-minted Message identity with the scoped
draft across transport retries and reloads.
During a connected, healthy running Side response, the unchanged submitted
draft's quotation and textarea are hidden once that exact caller Message ID is
present as a real user Message in the current transcript. The existing draft
store and request identity remain intact; status and Stop stay available.
Changed or unaccepted drafts, errors and disconnection keep the writing area
visible. Successful HTTP completion clears only the unchanged draft carrying
that request's exact submitted Message identity under the same API authority.
This request-owned cleanup survives Side panel disposal; component status and
error updates retain their current view ownership.

The shared AutoGrowTextarea owns content height for all writing surfaces. Value
changes and observed content-width changes use the same measurement and line cap;
connected, nonzero geometry is required. Its observer ignores height-only updates
and disconnects on disposal. Caller rows and CSS minimum heights keep their
existing floors, including the main Composer's manual resize floor. Opening or
resizing a Dock therefore remeasures wrapping without requiring another keystroke.

## Reference-led navigation and usage

The renderer shell uses its actual viewport width and height as the sole bounds
for panes, dialogs, and popovers. Native minimum window dimensions remain owned
by Tauri; they are not injected as HTML body minimums or an aspect-ratio cap.
Browser desktop windows, including a 900-pixel viewport, retain reachable
Composer controls through the existing measured toolbar presentation and pane
geometry owners. No automatic zoom or alternate renderer is involved.

The desktop shell has a fixed icon rail and an independently resizable project
list. WorkLedger mounts its existing navigation once into App's explicit rail
outlet; the pane geometry owner reserves that rail's measured width. Sidebar
pointer resize captures the actual outer sidebar width and initial pointer
position once, then applies pointer displacement within current pane bounds.
The fixed rail and pointer grab offset do not enter the saved sidebar width.
The same pane owner retains keyboard resize and final width persistence.
Sidebar collapse leaves the rail available. Project groups initially expose five rows
with a disclosure for the rest. Recents derives eight updated items from the
same loaded ledger, preserving exact row actions and owning directories.
App owns the single mounted navigation rail beside a bounded page stack. The
project/conversation/dock row and settings region are sibling pages inside
that stack; Scheduled, Expert Squads and all other settings pages render inline,
without a body-level Dialog Portal. The underlying primary page stays mounted
but hidden and inert while settings is open. Its inactive CSS rule sets the
whole ordinary descendant compositing group to the canonical hidden opacity,
so a library's explicit child visibility cannot paint over settings. Geometry
and mounted renderer instances remain intact. Escaped body portals, browser
top-layer surfaces and native windows retain their existing visibility owners.
Rail active state derives from the
open config tab or primary surface; Chats/Mission Board navigation closes the
config page through its existing native-surface reveal lifecycle before opening
the selected primary surface. Settings owns search focus, scoped Escape/Back
and focus restoration; nested action dialogs keep the shared modal primitive.
Its navigation uses the shared Tabs rail layout and allows destination labels
to wrap within the measured sidebar. Settings owns compact row density and
selection colors; the shared primitive owns vertical layout and tab semantics.
Rail rows retain their intrinsic content height as the navigation scrolls.
The search field keeps a concise visible hint and a complete accessible name.
Shared SearchField uses explicit `clearable` for its clear affordance; optional
`onClear` owns only a domain action after the single empty-value publication.
Clear restores the same connected, enabled input synchronously and shares the
input's disabled state. External input refs remain available to navigation
owners. Memory retains its clear-triggered list reload; Mailbox retains its
existing search dismissal without a clear button. There is no delayed focus
recovery or consumer-specific duplicate focus implementation.
Its resize separator projects the mounted sidebar's actual width and applied
CSS scale through one local frame-scheduled geometry owner. Size and root-style
observation retire with that open node; CSS default measurements do not become
user-requested width settings. Keyboard actions accumulate from the current
explicit request, or the actual box when unset, using current event-time scale.
Pointer actions retain the actual starting box and displacement contract.
The config store owns the one settings-search query. Explicit page-open and
close actions clear that query so a rail selection opens its exact target even
when the preceding page was filtered.

Search filters the navigation while retaining the active section once in its
canonical group. The same selected-page identity continues to own its title,
Tabs value and mounted panel, so typing or clearing a query preserves that
panel's authored input. The selected trigger remains associated with the panel;
matching results navigate only on explicit activation. An unmatched query shows
its empty result beside the navigation while the active content stays available.
Canonical navigation groups and tab objects retain their component identity
across filtering and selection, keeping the active trigger registered in the
shared Tabs collection throughout the update.

Command palette ledger selections close the settings page through that same
reveal lifecycle after file departure is approved and before selecting the
exact Mission, Task or conversation.
Global New chat actions from the rail, palette and titlebar all enter main's
single global Composer lifecycle: close Settings, open the directory-free
workspace, apply the default chat intent and reset the primary center surface.

Usage presents the current server's real aggregate with an OpenCorvus identity,
five equal metrics, activity grid, and side-by-side token/provider breakdowns.
Period selection controls the existing usage contract; year is the initial
view. The activity header, period controls and refresh button stay mounted
while current-period data loads, preserving keyboard focus across consecutive
selections and refreshes. Loading clears the prior data and appears within the
activity section; a busy refresh remains focusable and suppresses repeat requests.
Empty periods retain their actual zero-valued buckets. Official provider
comparisons and model detail remain below the primary overview. No personal
identity, subscription, streak or plugin usage is inferred from server credentials.
Activity buckets use one Listbox inspection collection with a single Tab entry,
visual-direction arrows and chronological Home/End. Zero-valued buckets remain
inspectable; year positions express real weekdays without synthetic options.
The collection carrier stays mounted with an empty current-data collection and
aria-busy during loading, so a rapid Tab after refresh has a stable focus target.
Kobalte owns collection selection and focus; retired data clears its selection.
The shared Tooltip presents the same localized event interval, UTC offsets and
Token count on hover or focus, with the item's registered description pointing
to the actual popup. Escape closes that popup through its existing owner.
Default light/dark palettes use neutral chrome; named palettes retain their
own colors. Page typography follows the sole shared typography authority.

## Tool activity, delivery inventory, and directory status

Handoff context keeps its existing disclosure state and reads at natural height
within the conversation width. Authored paragraph line boundaries and long
identifiers remain readable in main/child transcripts and progress previews.
An explicit expansion releases the nearest transcript's existing follow mode
before layout grows, preserving the operator's reading position.
The main conversation scrollport keeps native scroll anchoring disabled in both
reading and follow modes. Its existing Virtua owner compensates virtual-item
resizes; explicit history restoration, user navigation and bottom following
retain their existing controls. The inner virtual window's own opt-out alone
does not define the policy of the surrounding scrollport. Child transcript and
editor scrollports keep their separate existing ownership.
The virtual-window adapter inherits the surrounding surface's pointer policy
through one computed style object. Library scroll updates keep visible buttons,
source links and tool controls interactive while modal background restrictions
still apply. Item mounting, measurement, scroll compensation and keyboard
semantics stay with their owners.
The same measured Composer block size supplies main content end padding and
native scroll-padding clearance, including the existing edge-fade extent, so
browser focus scrolling can use the region above the floating Composer's paint.
The terminal file-change summary preserves its
natural block size as a nonshrinking flex item alongside the virtual window;
the main scrollport owns their combined overflow.
Virtual-window measurement notifies the existing complete-scrollport follow
controller. It does not navigate to the last virtual item, whose endpoint
excludes the terminal summary and Composer clearance. Explicit requested-card
navigation retains the virtualizer's item targeting; reading and preserved
history retain their existing tracking and anchor controls.
The canonical scheduler participant message places its subject and unchanged
body before grouped delivery references. Task and Mission consume that same
persisted Markdown; the Overlay neither parses protocol keywords nor creates
a separate display-only message. Historical messages retain their original
ordering and content.

Consecutive Tool/Patch runs have one chronological disclosure, labelled by the
latest actual Tool name and its summary. One expansion directly exposes all
results in order; multiple results have static identities rather than nested
per-Tool toggles. The shared identity row reserves the Tool name's intrinsic
width, capped at 220 scaled pixels. When a detail is present, the name is also
capped at half the row and the detail absorbs available-space truncation. Outcome
and disclosure controls retain their fixed space. This applies to collapsed
runs and expanded event headers in Main, Side and child conversations.
Narrative, sources, files and interactive artifacts retain
their original positions. Each run exposes every real Tool result and its outcome;
pending argument preparation and running execution have separate status-derived
counts, independently of the parent stream decoration. Earlier errors stay visible
independently of the latest Tool's identity. Expanded pending headers and input
details explain receiving arguments. Expanded Tools expose their persisted arguments through
a compact payload control, output or structured evidence, and explicit pending,
running or empty-result information. Expanded live input keeps the existing bounded
payload viewport and native internal scrolling; completed/nonlive full expansion
retains its full-height contract. Existing active tail previews and their Copy
values retain their current limits, separately from complete persisted arguments.
Deferred Tool state reads keep failure feedback inside their own disclosure.
The common Part accessor checks resource loading and error before reading its
value; the existing completed-state marker is only an identity/status projection.
The body-ready boundary covers all arguments, structured results and execution
errors, so a rejected read displays its actual error without presenting bounded
projection data as full results or replacing the surrounding message and Sources.
The shared Feedback primitive presents the localized result-load problem and
close/reopen retry action; its native Details retains the complete read diagnostic.
Actual tool execution failures use that same Feedback primitive. The canonical
failure message remains literal, selectable text with its original line breaks;
diagnostic paths and punctuation do not enter the Markdown renderer. The full
shared diagnostic, including classification, origin and structured data, belongs
to the native Details disclosure. The Overlay does not rewrite the failure or
repeat its diagnostic envelope as the primary message. Unstructured errors keep
their complete existing message. Collapsed execution rows, expanded Tool headers,
activity summaries and session chips use the same failure-message projection as
the body, before selecting input or result descriptions. Arguments and full
diagnostics remain available in the existing disclosures. Sources and tool inputs
retain their own controls.
For a canonical tool-execution/FileWriteConflictError, that same reader also
derives a localized short headline. Compact rows put this reason before the
input's relative resource path; expanded Feedback uses the headline as its title
while retaining the complete literal original message and diagnostic. Recognition
uses the structured kind/name contract, never message keywords or path parsing.
Other failures keep their original message projection. Locale changes update the
derived headline without changing the persisted failure, Tool status or counts.
The same canonical failure presentation recognizes a `MessageAbortedError`
kind/name pair as cancellation. Tool transport status stays `error`; only the
localized presentation distinguishes its cancelled label and group count from
execution failures. Cancelled results retain their original reason and complete
diagnostic in neutral Feedback. Other failures keep error Feedback, and a group
with a cancelled result does not present an all-completed marker. The shared
Main and member renderers derive this directly from each Tool's failure, never
from Task status, reason text or a second cancellation store.
Completed Bash results additionally project their integer `metadata.exit` as the
actual command exit code, including zero. Tool completion remains `completed`;
a nonzero program exit does not create a synthetic failure or fail the Session.
The shared identity, activity and session-chip detail and expanded result expose
the localized code while preserving the literal command and original output.
Each execution run independently counts every nonzero Bash exit, including an
earlier command followed by a successful Tool, and retains that warning instead
of an all-completed checkmark. Expanded event headers distinguish the command's
code from Tool delivery status. Pending/running results, unknown exit values and
background commands whose exit is still null retain their existing presentation.
The bounded historical/live Tool transport prioritizes that canonical exit value
within its existing small-metadata budget, even when command output requires a
deferred full-state read. Large stdout does not erase the collapsed exit outcome.
The Bash Tool and user Session shell also place the observed exit code in the
same visible Tool result's `bash_metadata` tail, alongside existing lifecycle
details. This body reaches both live model input and replay through the ordinary
Tool-result conversion. The default tail truncation preserves it; structured
`metadata.exit` continues to drive the UI. An unavailable exit remains explicit,
and foreground stdout and streamed byte counts retain their original meaning.
Trace data uses the code typography role;
the disclosure identity uses caption. Sources keep their chronological position.
The webfetch identity detail projects its structured request URL directly, before
generic result-title selection. Response media/encoding remains in the original
result disclosure; a source title never replaces the request identity. Canonical
failure messages keep their shared precedence over this request detail.
A source run keeps its first citation directly available with its complete
readable identity and existing resource action. Additional sources use the shared
native Disclosure, initially collapsed with an explicit remaining count;
operator expansion state and exact source links remain available. Both portions
use the same identity-keyed source entry renderer. Individual
excerpt disclosure remains scoped to the real source. Citation identity uses body
typography; site and index metadata retain caption.
The label alone carries the link underline. Hover strengthens that label's
decoration while metadata remains visually secondary; the complete entry keeps
its existing activation area and visible keyboard focus.
Web citations put the host before the exact navigation fragment in their
secondary caption, keeping website provenance visible when a long text anchor is
clipped. Short chapters with the same publisher title remain distinguishable.
The shared activation name carries the same location. URL captions
use the shared two-line auxiliary-caption pattern while their Tooltip retains the full URL.
File directory/location captions use that same pattern, keeping long directories
bounded when the file workbench narrows the transcript. The complete original
path/range remains in the accessible action name, Tooltip, copy and open actions;
the presentation clamp never changes source identity or persisted text.
Source activation, group
expansion and excerpt expansion use the existing transcript reading-intent
notification. The nearest transcript pauses follow-to-bottom while
its operator reads; native pointer and keyboard behavior, source identity and
the single expansion store remain authoritative. The explicit bottom control
resumes following through the same existing scroll owner.
Source tooltips localize explicit ISO calendar dates and valid timezone-qualified
timestamps as the publisher's original calendar day. They retain the exact source
value in the metadata title and preserve authored date text with its original
precision. This presentation does not convert publication days into local event
times or change the stored citation payload.
Known built-in read, local search and webfetch provenance uses localized resource-acquisition
labels; the original provider identifier remains in the metadata title and stored
payload. Other source-provider names retain their authored value.
Webfetch decodes the bounded response bytes once before title extraction and
text/Markdown/HTML conversion. Parsed HTTP charset and the document's HTML/XML
encoding declarations use the standard sniffing library; byte-order marks take
precedence. Other media types use BOM and transport declarations without treating
literal HTML metadata as encoding instructions. Undeclared text retains the
product's UTF-8 default. The same decoded document supplies both Source metadata
and Tool output; persisted historical Messages are not rewritten.

HTML/XHTML conversion to Markdown resolves link and image destinations against
the final fetched document URL, using the first `base[href]` element when its
URL is valid and allowed by the document-base rules. The converted document enters
the existing Turndown renderer, preserving its formatting and embedded-image
attachment extraction. This gives relative links their original web target when
quoted outside the source page. It neither fetches those destinations nor emits
Sources for unread pages. Original HTML, plain-text extraction and native
Markdown responses retain their existing format contracts.

Webfetch publishes the document's own title from HTML/XHTML metadata or default
YAML frontmatter in native Markdown responses, using the shared frontmatter
parser. Remote script-language metadata is literal resource content. Optional
malformed YAML metadata leaves the successful body and canonical URL intact;
the Overlay displays the published Source payload without fetching or inventing
another title.
The same normalized response media type selects HTML/XHTML title parsing and
text/Markdown body conversion. Case variants and media-type parameters do not
change that classification; parameter contents cannot turn a non-HTML type into
HTML. An explicit HTML-format request retains the fetched markup.
Plain-text HTML/XHTML retrieval uses one compiled html-to-text converter for
documents and fragments. It decodes entities once, preserves inline text, separates
block/list/line-break content and retains preformatted indentation. Head metadata,
script/style and embedded-content subtrees are excluded structurally, without
dropping subsequent visible tail text. Links contribute their authored text;
headings retain case and lines are not forcibly wrapped. The published Source title
remains metadata. The existing HTTP byte cap and final text-output budget stay
authoritative; this text extraction neither executes scripts nor infers visual layout.
When webfetch's first line exceeds its byte budget, its visible prefix ends at a
complete UTF-8 character. Shown and omitted byte counts describe that exact prefix.
The shared byte-prefix decoder also serves tool-result text attachments and Bash
live previews; a budget cut retains partial encoding bytes as omitted input,
whereas the real end of malformed input keeps normal replacement-character decoding.
Existing size limits, line-first selection, truncation notices and source identity
remain owned by their original consumers.
Tooltip detail adds location or media information only when it differs from the
primary source identity; it does not repeat a root-level file's name or range.
File citation labels and location details share one line-range presentation:
single-line sources show `file:2`, while multi-line sources keep `file:2-8`.
The original numeric range remains the file editor's exact navigation target.
When a file label already contains its actual basename and range, its secondary
caption shows the complete parent directory, including its final separator,
instead of repeating the filename and range. Custom titles retain the actual
file location in that caption. Tooltips and accessible action names still carry
the complete location; source identity and file navigation remain unchanged.
Source file routing and change summaries share one lexical directory relation.
It recognizes server Windows drive/UNC paths independently of the browser host,
normalizes their separators for comparison, and retains case-insensitive Windows
matching. POSIX paths retain case and literal backslashes, including at a directory
name's end; the root directory remains a valid base. Project-relative Windows
results use forward separators without changing filename case. External locations
keep their original absolute identity. The server still owns physical realpath
and access validation; this display/routing relation is not a permission check.
Completed assistant messages seal their ordinary Part content. The shared child
and Side transcript projector keeps that canonical Info and content when an older
live prefix survives hydration. Actual removals still apply; existing Tool
requests can settle after assistant completion, while an already persisted
terminal Tool outcome keeps its immutable result. Post-completion compaction
checkpoints remain appendable. Active text continues to use complete live fields,
because streamed-Part checkpoints are deliberately less frequent than deltas.
Within one child transcript target, hydration retains authoritative message
exclusions in `removedMessageIDs`. Incremental removals survive later reads;
replacement snapshots, epoch changes and cursor resets also retire known prior
members outside the new snapshot. Live projection respects those exclusions as
well as live removal events. A message explicitly returned by a later read
rejoins the target, and an unseen new live message remains eligible. A different
target starts with its own membership facts. This repairs retained live content
after a missed removal or move without treating an unpersisted text tail as lost.
The same transcript owns sparse `removedPartIDs` grouped by Message identity.
Each returned Message supplies its complete presented Part membership, so known
prior Parts outside that set remain excluded from retained live snapshots.
Whole-message retirement also retains its known Part exclusions; a later read
restoring that Message or Part reestablishes only the returned membership.
New live-only Parts remain eligible, and existing active Parts still accept
unpersisted complete text fields. These are current-target projection facts,
not another server protocol or persistent store.
Each child HTTP read captures the already received live objects before dispatch.
Its resource settles the received scope, merged transcript and that observation
together. Reconciliation retires only unchanged observed entries in the returned
Message scope; events received during the read keep their own identities. A delta
does not acknowledge unreturned Messages. Durable Info, Source snapshots and old
removal events can yield to this later read. Unpersisted text fields on returned
Parts, omitted reasoning scaffolds and uncommitted pending Tool input remain live.
Empty text Parts remain in the HTTP transcript. A known text Part missing from
the later read is retired, including its earlier unpersisted field observation.
The live Message removal map retains original event objects, allowing independent
removals to be compared without inventing a sequence or wall-clock watermark.
The display projects the reconciled live data with the same settled base before
an effect retires those observations from the existing frame queue and signal;
cleanup never exposes the previous base between resource settlements.
The same server-path primitive owns separator interpretation for project-file
keys in the Explorer and workbench. Windows project paths use forward separators;
POSIX filename backslashes stay literal. Source file labels, direct opens,
workbench reference targets and Explorer filename input preserve authored filename
whitespace. File labels render that whitespace rather than collapsing it. Accepted
move receipts reconcile the same exact descendant target; the server continues to
validate filesystem names and write permissions. This filename contract does not
change global project-directory selection or natural-language reference parsing.
The file-source producer preserves nonblank authored title characters, including
filename whitespace; an untitled source uses its exact filesystem basename.
The shared Source presentation marks nonordinary filename/path whitespace with a
compact localized metadata badge. Its existing tooltip and open/copy accessible
names show each such character as an explicit Unicode code point and position;
ordinary ASCII spaces retain their original presentation. The annotation uses
the displayed project-relative path, or only the original attachment display
name for attachments. Raw labels, resource keys, open targets, clipboard payloads
and line/column ranges continue to use the original Source values.
Host path delivery and external-editor commands preserve the same literal
resource characters. Empty-input validation never supplies a trimmed replacement
path. A located editor action launches its declared command-line program with
the original path/line/column; application identifiers used for native file
association are distinct from Unix command-line launcher names. Windows batch
launchers go directly through the standard process command API's batch escaping,
without an additional manually assembled command-interpreter invocation.
A failed located launch surfaces its actual error and launcher identity through
the current localized operation feedback. It does not turn into an unlocated
file open. Successful process launch is an application handoff receipt, not
confirmation that an external editor has finished loading the file.
Source-file payload and persisted-part validation retain path/title characters
while enforcing nonempty strings. Validation does not rewrite a resource name.
Child conversation message dividers retain the shared transcript margin and use
the medium spacing token for their inner top inset. This keeps independent
Source-bearing messages distinct without repeating a large blank band; the
Source count and grouping remain attached to their actual chronological run.
Native Markdown tables share one intrinsic-width policy within a bounded local
horizontal scroll surface. Headers keep Chinese, Japanese and Korean (CJK) character sequences together to
provide their intrinsic column width, while body cells retain normal wrapping.
Long headers remain reachable through the same local horizontal scroll surface.
The existing Marked renderer emits focusable native
tables and delegates header/body cells and rows to its standard primitives;
keyboard focus is visible and native horizontal keys reach the remaining cells.
Table identity, alignment, links and inline rendering remain ordinary Markdown.
The label uses the actual publisher title from the Source payload; webfetch's
HTML/XHTML and native Markdown metadata contract is defined above. An empty title
remains optional and uses a path-and-query preview with the host on the location
line, keeping same-site resource differences near the start of a compact label.
This preview and its fragment caption decode visible non-ASCII percent-encoded
text through the native UTF-8 URI decoder. Encoded ASCII delimiters, percent signs,
spaces, Unicode controls/separators/default-ignorable characters and malformed
UTF-8 sequences retain their exact encoded representation. Publisher titles are
authored text and are not URL-decoded. Query order and source/navigation identity
remain unchanged; the full serialized URL is still shown in the Tooltip detail.
A root URL without a query uses its host as the label; if the label already names
the host, the location line contains only an actual fragment when present.
Accessible link names combine the nonempty label and location once.
The complete URL remains available in its tooltip and activation target.
New URL sources use the native URL serializer for that complete navigation
location, including its fragment. Distinct document chapters retain distinct
source identities; repeated canonical locations deduplicate through the existing
Message source owner. Webfetch, web search and code search share that generator.
Redirected URL owns source
identity and activation independently of the title. Historical source payloads
retain their original recorded values.
The shared Message source schema validates HTTP and HTTPS URLs with the native
URL validator. Malformed and other-protocol inputs produce a URL-format schema
error; accepted URL strings and source metadata retain their recorded values.
Local search file sources use the same CR, LF and CRLF logical lines as file
reads and the editor. Search operates on original bytes (`--encoding=none`),
including a UTF-8 BOM, to agree with the current UTF-8 file display. For matched
files whose results have preceding LF records, the same ripgrep execution
authority reads internal bare-CR records and counts missing line boundaries.
That scan shares the original deadline and cumulative output budget; a failed
boundary scan returns the existing typed execution error rather than invented
coordinates. There is no Host file-read bypass for Task searches.
Original submatch byte spans determine logical matching lines; spans on the
same or overlapping lines share one source, while spans across CR carry the
complete line range. A real zero-width result without reported spans keeps its
whole record's logical range. The public find-text and debug ripgrep APIs retain
their explicit raw ripgrep protocol, encoding behavior and coordinates.
Local search file sources retain the same bounded, inline-payload-redacted
matching-line or range preview that appears in the Tool output. Short safe lines remain
complete. Longer safe lines use the existing 2000 UTF-16 code-unit budget around
the first reported ripgrep match span, with up to 40 preceding code units.
Records without a reported span retain the bounded line prefix. Original
byte coordinates are retained at the parser boundary, including for byte-encoded
lines; the public find-text response keeps its original data shape and offsets.
Full-line inline-payload redaction adjusts the match position through the same
replacement pass before window selection, so a match inside omitted data points
to its omission marker. Both window boundaries retain complete characters, and
ordinary omission markers identify clipped ends. The resulting window passes
through the same redactor before either Tool output or Source persistence, since
cropping can expose a new binary-signature boundary within a longer token.
The optional file snippet preserves its indentation and trailing whitespace
through the canonical Source schema and persistence; source identity remains
path/range/symbol based. Other file producers and historical Parts only carry
the facts they actually supplied, without a presentation-time file read.
Single-line sources may also carry a positive, one-based UTF-16 `startColumn`
from the original first match. It is independent of redacted or cropped preview
coordinates and participates in source identity. Byte spans inside a UTF-8
decoding unit point to that displayed character's beginning. The canonical
Source range is also the SDK, workbench and editor range contract; Markdown
`path:line:column` references retain their parsed column through that same path.
Navigation retains the column through repeated and hidden-editor reveals,
clamping to current line content and complete surrogate boundaries. Line-only
and multiline sources retain their existing line reveal semantics. Source
navigation completes at the clamped location when a file has become shorter;
the file pane owns content-loading readiness, while later draft edits retain
the user's cursor. An out-of-range historical line is not a loading signal.
Full source locations include a supplied column; compact badges show columns beyond one.
File tooltips expose this preview on pointer hover or keyboard focus, with a
localized excerpt label and four-line visual limit. Exact file/range activation
provides the full original content. This preview keeps the compact citation row;
it does not add a separate excerpt action to every file match.
Web source snippets belong to a separate native disclosure within each source
entry. Its normal page reading region retains the complete text and
supports native keyboard and pointer scrolling.
Successful `webfetch` text reads populate that existing snippet from the decoded
resource, bounded to a complete-character 4 KiB UTF-8 prefix. HTML/XHTML uses
the existing readable-text parser across all requested output formats, with
semantic navigation, page banners/footers and complementary regions skipped
for the excerpt. HTML excerpt runs of three or more line breaks become one
paragraph boundary; full Tool text retains its existing complete-document rules.
Other text media retain the decoded literal text. The formatted Tool body and
excerpt share one response-local embedded-data attachment map, assigning the
body's attachments first so excerpt references identify the same actual files.
Embedded data URLs follow the existing attachment externalization before the
preview is bounded. The
excerpt is fetched text, rather than a publisher-authored summary. The full
Tool output keeps its existing format and budget, and the existing Source
writer persists the excerpt with its exact URL and Tool binding. Earlier
sources retain their originally published fields.
Its text uses the body typography role, while the excerpt action and source
metadata keep their caption role. The reading region is capped at forty percent
of the viewport height rather than a multiple of button height, preserving an
accessible scroll area as the surrounding source list grows.
The existing conversation UI store owns its expansion by canonical source
identity. Opening or focusing the
reading region pauses transcript following through the shared reading intent.
The same conversation UI store retains the excerpt's last visible scroll
position across reader remounts and primary-conversation returns. Each current
API revision and source kind/ID selects one presentation record containing card
folds, reference disclosures, excerpt positions and Side reading positions.
Task, ordinary Session and Mission entry points select that record in the same
synchronous batch as their Board source; an empty workspace deselects it. The
store retains fifty recently selected conversations, with two hundred entries
per presentation field. Only card folds persist across reloads, under the server
URL and source kind/ID; reading positions remain in memory. The previous bare
Task-ID folding keys are no longer read, so that old presentation preference
starts from its default on first use. There is no second active-state copy.
Board source selection writes a complete discriminated union through the one
`setSelectedSource` store operation. It reconciles the incoming value instead
of shallow-merging fields from the previously selected kind. Task, ordinary
Session, Mission and selection retirement use that same operation within their
existing selection batches, so request/reader identity reflects the current source.
Position keys also include the current API authority revision and canonical
Source identity. The reader uses
the shared animation-frame scheduler after visible geometry is ready, retires
its observer on completion or disposal, and lets new native reading input
cancel a pending restore. Hidden geometry and stale connection/selection owners
cannot overwrite the last observed position. Excerpt text remains the canonical
source text and has no parallel content cache.
The noninteractive source tooltip contains identity, detail and metadata.
The canonical Kobalte Tooltip scroll handler preserves an open tooltip while
its trigger has native `:focus-visible`. Focus-driven scrolling and viewport
adjustments therefore keep keyboard context readable. Hover-only tooltips retain
their ancestor-scroll dismissal; Escape, blur, activation and disposal retain
their existing library ownership. The dependency's single patch applies this
rule to both runtime exports and its source without a second tooltip state.
The shared noninteractive tooltip recipe also makes its direct Popper positioner
transparent to pointer hit testing. Its visual bounds therefore do not intercept
links or controls underneath. Project and work-row summaries use the same recipe.
The first Source remains a directly actionable entry with its location and
excerpt, regardless of the group's size. A separate native disclosure names
the remaining source count and reveals those entries in their original order.
Its content box and expanded list are bounded by the actual source region.
Source labels use that available width and wrap long titles or tokens within it.
Indexes, icons, full tooltips and activation targets keep their actual source
identity. Activity uses
the owning card's live state, including Mission and subagent cards. Reduced
motion retains static status. Valid JSON displays expandable values with
multiline strings intact; full raw content and copy remain available.
Tool payloads expose named Input, Output and Details groups. Format, expansion
and copy actions name their own payload while retaining compact visible labels.
The changing Raw/Readable action is an ordinary button; choosing a format reveals
an initially collapsed payload through its existing expansion state. Output's
bounded preview keeps its independent full-height expansion. Controls reference
the currently mounted body, and copy continues to use the complete original value.
Tool payload format, expansion and JSON node expansion/item limits belong to
the current conversation presentation record. Keys use the canonical producing
Session, Message and Part, the input/metadata/output slot, and the JSON field
path. Remounting a member's transcript retains those operator choices and its
layout; translated labels and payload contents do not define identity. The same
bounded store owns these preferences, without component-local duplicate state
or a second payload cache. Clipboard feedback remains local to its actual action.
Shell Tool bodies display the canonical committed progress `metadata.output` while
running and after failure or cancellation. The running view is labelled Live output;
the terminal partial observation is labelled Recorded output, with the original
failure or cancellation still visible. These labels and their named copy/expansion
controls follow the current interface language. A running command with observed
output uses its actual active status rather than claiming that it is waiting for a
result. Completed Tools continue to display their definitive `state.output` once.
All views use the existing producing Part and output-slot identity, ToolPayload
reader, bounded preview and clipboard writer.

The canonical Tool Part reader joins the last immutable progress fact for a running
or failed request. Failed metadata combines that progress with explicit terminal
metadata, whose fields take precedence; it preserves the original failure and
stored request/progress/outcome facts. A completed outcome owns its final metadata
and output directly. Progress admission already closes at the committed outcome,
so rereading a failed Tool after restart exposes the same recorded observation
without a new message, a copied result, or renewed execution authority.
Bounded payload bodies retain their scroll position in that same record, separately
for raw and readable formats. Restoration waits for the visible content box and
yields to user input. Full-height expansion keeps the bounded preview's reading
position; hidden or retired content cannot overwrite another conversation's state.
Full-height Tool payloads participate in the shared transcript reading anchor using
their existing Session/Message/Part/slot identity. The anchor retains the rendered
text position and its viewport offset, so hiding a reader and changing Dock width
restores the same output text after wrapping changes. Main, Side Chat and member
readers consume this same in-memory anchor; Main retains the producing Message for
virtual-history lookup. Native Range geometry observes text without replacing its
content or introducing another scroll owner. Bounded payload scroll and original
copy bytes remain owned by the existing ToolPayload presentation record.
Markdown prose uses its existing Message, text owner and frozen-block identity
plus a rendered character offset within that block. Its viewport offset belongs
to that character's line, rather than the entire paragraph's top edge. Capture
keeps the previous character only while the same block and character are still
visible; genuine scrolling otherwise captures the current visible text. The
same native Range primitive already used for Tool payloads resolves this anchor
after wrapping or font-scale changes. These anchors remain UI memory only.
Source anchors retain their saved offset within the current viewport's feasible
range. A card that fits stays fully visible; a taller card can keep the viewport
inside its existing content. When reflow makes the old offset infeasible, the
same resolver uses the nearest card edge instead of restoring the Source outside
the viewport. Existing source identity, selected-citation priority and the one
scroll writer remain the owners.
Visible member and Side Chat viewport changes reuse the same position-restoration
path. Layout-driven scroll events retain the prior reading record until that
restore settles; new operator scroll input may take over normally. The controller
measures the actual viewport width and height and asks its current reader for the saved
anchor, without keeping another anchor store or creating a second observer.
Tool-payload and delivery-name copying share one mounted copy-action owner over
the canonical host clipboard writer. Only a fulfilled host write shows the brief
checkmark and contextual copied label. The busy action retains keyboard focus;
failure stays beside that payload or delivery with original error details and
an explicit retry through the same button. Value replacement or disposal retires
old feedback and its timer. No global toast or alternate clipboard writer is used.
Completed Tool groups and individual calls use a solid circular check with an
accessible status instead of repeating Completed text.

Transcript prose and document artifacts share one module-worker Markdown
renderer. The existing Marked lexer/renderer retains reference links, lists,
tables, fences and copy/file-link attributes. Fenced code has one normal-flow
header for its language and native copy control, followed by the independently
horizontal-scrolling code body. Hover or keyboard focus never places that
header over the first code line; the shared wrapper owns the surface and border.
The delegated copy action reads the raw code from its parsed DOM attribute and
passes it directly to the single host clipboard writer. Attribute escaping
protects the HTML representation; it is not a second content-decoding step.
Literal entity spellings, nested entities, quotes and Unicode remain authored
code in the copy payload. Automatic codespan file actions
require a path prefix or a declared file extension with a directory separator
or cited line. Unprefixed slash-delimited concepts and MIME types remain code
prose. Rooted Windows drive paths
retain their drive and either separator through the same reference grammar.
Path tokens accept Unicode letters, numbers and combining marks, preserving
the authored character sequence through the existing file-reference attributes.
The shared location parser accepts `:line[:column]`, the Source location format
`:line-end`, and `#Lline[-Lend]`. Valid ranges use positive safe integers and an
end at or after their start; invalid ranges retain their original path text.
Both colon ranges and line anchors carry their inclusive end through the same delegated file
action and canonical workbench range; unknown fragments retain their original
text. External web links keep their complete authored URL and fragment.
Bare filenames remain code
prose; explicit Markdown file links retain their authored destinations.
Parsing and highlighting occur
off-thread; top-level HTML blocks mount over animation frames. Latest updates
are coalesced by text owner, stale replies are discarded, disposal releases the
owner, and stable blocks keep their DOM identity. Identical text, streaming mode,
locale and current locale-resource generation reuse the accepted owner input.
Initial rendering status appears only before accepted HTML or a live tail is
visible; resource-generation changes retire incompatible replies. The worker's
block cache includes its actual copy label/icon and reference-link inputs.
Full document Markdown is
not clipped at the trace-preview limit. Worker errors remain visible instead
of starting a synchronous parser path. Transcript prewarming is removed.

Future assistant Markdown prose uses the existing shared observable-work-narrative
guidance for valid emphasis boundaries: punctuation can follow a bold label, or
whitespace can separate a punctuation-ending bold span from subsequent prose.
Requested literal text, code and other formats retain their own contract. This is
authoring guidance; the same renderer parses the actual text without rewriting
persisted Messages, stripping delimiters or introducing another Markdown dialect.

Conversation Source entries keep opening and copying as separate native actions.
Copy location uses the actual URL including encoded query/fragment, or the full
file path with its recorded line range; a display title never replaces that
location. Sources without a URL or file path remain informational. The shared
clipboard owner scopes pending/success/error feedback to the mounted control
and its current value, while source identity and disclosure state remain intact.
Its value dependency compares the actual text: replacing source metadata with
an equivalent location during streaming retains the in-flight copy and its
feedback. A changed text value or retired control still ends that ownership.

Interactive Artifact frames expose a shared copy/download/open strip. Downloads
name their actual format: original attachments, Markdown, CSV, source code,
patches, notebooks or visualization data. Editable Code and Spreadsheet exports
read the mounted editor state. MCP App actions read the current real Tool
result; returned resources use the existing Host download protocol and App
requests retain confirmation. Opening keeps the same mounted renderer and MCP
authority. A source/data export does not replace a requested PDF or Word file.
For native Office delivery cards, `InteractiveArtifactRecord.downloads` is a
read projection of the exact producing display Part's completed Tool outcome.
The declared source identity selects its canonical attachment within the same
Project; a declared source without a matching attachment is a corruption error.
Original DOCX, XLSX or PPTX downloads precede renderer exports and derived PDF
previews in the shared actions menu, with URL deduplication and the actual first
binary filename used by copy-name. Historical completed deliveries use the
same projection. Persisted artifact payloads, messages and schema remain intact;
there is no second download registry or persisted source field.

Create-only attachment writes contribute their actual saved path to the same
conversation file summary and Review groups. The shared transport contract
validates the original completed Tool's destination, exclusive-create result,
canonical source identity and byte count; full and deferred Tool views consume
that one projection. These opaque-byte observations retain Added status and
explicit non-text comparisons with null line counts. They never synthesize text
endpoints or zero-line diffs, and historical Tool facts need no rewriting.
Text `write` returns the existing `filediff` contract from its actual before and
read-back after content, with explicit Added or Modified status. Full and bounded
Tool projections retain that same status and observation; ordinary `edit` keeps
its own declared status semantics. Original results without recorded endpoints
are not reconstructed from request text or current filesystem contents.

Conversation artifact text and each immutable diff side use one fatal streaming
UTF-8 decoder for the complete logical read, including its final flush. Explicit
`text/csv` resources use the existing Table renderer for local search, sorting
and pagination. The first record supplies column labels; positional identities
preserve duplicate labels and fields beyond the header. The D3 row parser keeps
cell values as strings, with current-language labels for unnamed columns.
Decimal-aware sorting is presentation-only; the decimal comparator keeps
large integers and fractional amounts precise without converting displayed cells
to JavaScript numbers. Other text sorts through the current-language collator.
Copy and download use the original decoded CSV and filename rather than regenerating
data from the table. This is a view of canonical resource bytes, not a new
interactive-artifact publication or an extension-based renderer inference. Literal
U+FEFF bytes are retained as content rather than removed as a decoding signature.
The shared artifact download Blob encodes its given text exactly; MIME type does
not add a BOM or any other content. An explicitly authored signature remains part
of the source, including for generated CSV exports.
Range, byte integrity and original connection/directory receipts remain the same
reader contract. Direct Task resource download passes its original authority and
cancellation signal through that reader before the current action accepts bytes.
The pure `services/mcp-app-payload.ts` owns MCP App policy serialization and
bounded download-byte decoding. The renderer and service contracts import that
same implementation; DOM materialization remains in the browser renderer.
The shared MCP event-stream owner reconnects after transport failure and replays
its actual connection boundary to late consumers. Each connection refreshes the
exact persisted lifecycle; monotonic `timeUpdated` prevents stale reads from
replacing a newer result. Directory/session ownership isolates shared streams.

Terminal `declaredOutputs` contains published file resources. Resource-free
engine records remain in the exact catalog `entries` as inspectable evidence;
they do not count as usable delivery files. Resource cards offer direct download
and the existing content preview. The environment popover derives its delivery
inventory from the same current conversation projection, including message-owned
interactive artifacts, and opens those same exact resources without another
registry or publication protocol. Resource-free summaries retain their actual
records, provider errors and failed/cancelled outcome. A completed summary with
no resources, records or provider errors adds no file card to the original
assistant reply; the actual narrative and completion remain their message and
lifecycle projections. Meaningful summaries report actual download availability
without inferring a required document. Task completion
and review retain the exact request and occurrence contracts.

When a Task requests a conversational answer, the Orchestrator emits that
requested content in its natural assistant Message before the terminal
`manage_task action=complete_task` call. Successful completion parks the current
Turn. The completion summary remains the acceptance decision, and selected
worker Messages remain evidence; the panel renders each real participant's
content through its existing projection. File resources and external-action
deliveries retain their existing contracts.

Project metadata is scoped by its exact directory and latest request. The panel
refreshes on opening/scope changes and exposes loading, error and disconnected
states. Repository file counts and branch/unborn/detached identity come from
`GET /vcs`; Task change counts appear only with real Task change groups and an
explicit Task label. Unsupported GitHub CLI status is not fabricated. Client
startup only observes Git state. The `initGit` preference defaults off and only
offers a confirmation on explicit directory opening; initialization remains an
operator action. A non-Git identity mutation with an active project prompt owner
returns `OwnedPromptControllersError` before disk mutation. Existing Git access
remains idempotent.

An explicit initialization captures the current API authority, selection epoch
and directory. Its accepted POST remains successful even if a later view refresh
or notification fails. Only that original selection may clear/reload its
projection or open the queued result dialog; successor and same-directory ABA
selections retain their own state. Physical prompt ownership includes legitimate
standby and is independent of the visible idle status.

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

Replacing a selected stream retires its old handle, timers and generation without
publishing a stopped subscription. Task, Chat and Mission retries remain in their
connecting/reconnecting state until the replacement actually opens. Only explicit
`stopSSE` publishes idle. This keeps the notice grace period tied to the sustained
interruption rather than resetting it on every retry; source/authority retirement
still invalidates old callbacks before closing their handles.

The sidebar badge and banner use one stateless presentation of those observations.
A restored selected stream with backend health still unconfirmed is Connecting,
with an explicit live-updates-connected message; it is neither an Online claim
nor an unreachable-backend warning. An online backend with an established stream
reconnecting likewise presents Connecting and identifies live updates as the
remaining boundary. Ordinary initial stream setup retains its loading contract.
The banner's data-status uses the same online/connecting/offline vocabulary as
the existing color styles; its data-problem names the observed boundary. An
already visible notice changes text and tone as recovery progresses without
closing and starting another grace period. Initial grace and complete recovery
cleanup retain their original owners. This presentation changes no health signal,
stream state, workspace recovery, send admission or configuration-write condition.

The banner's configuration action opens the canonical Network settings section,
where the existing server URL and authentication form are immediately available.
Navigation retains the configured API address; the saved settings and connection
owner continue to control recovery.

Network keeps the server URL, username and password in the mounted editor's
local draft. Typing and unrelated preference saves retain the applied connection;
explicit departure disposes that unsaved editor normally. Connection Save uses
the single preference transaction defined in [05-config](05-config.md) to publish
those three fields only after persistence is confirmed. The confirmed connection
owner applies them through the sole API configure primitive; main synchronizes
the current derived directory. Persistence failure retains the draft and the
applied connection; activation failure is labelled as a saved fact that could
not be applied. Closing the editor can retire its feedback and optional refresh,
but cannot suppress the transaction's confirmed connection publication.

A different manually saved endpoint admits a workspace departure before writing
preferences. The existing file decision owner reserves its exact target and draft
revision through persistence; keyboard edits, Save/Reload and affected Explorer
mutations honor that same reservation. Cancel retains the current workspace.
Discard closes only after acknowledgement; a confirmed A file Save remains a
real saved baseline if the later preference write fails. CodeMirror reconfigures
its existing editable/read-only Compartment when that owner changes, preserving
the mounted editor, selection and history.

Successful departure clears the old selected source, project/ledger projections,
source-bound image popup, attachments, quotation/submission identities and model
projection. Canonical mention ranges use the existing parser/removal semantics.
The sole composer record writer updates a temporary parsed preparation before
each real record mutation; confirmed commit performs no parse and retains the
latest ordinary prose through the existing global launcher draft key. A concise
localized notice accompanies actual reference removal. Credentials-only and
confirmed owned native rotation preserve the workspace/dirty file, retire old
async owners and rehydrate the selected view under the exact new API token.
Late receipts remain truthful and cannot restore old quotation, retry IDs or
loading/finally state into the new view.

Connection address admission belongs to the shared operational base parser,
not HTML input validity or an online probe. HTTP(S) bases retain their hostname,
IPv6 and optional encoded path prefix; base query, fragment and embedded
credentials yield the explicit local ServerBaseUrlError contract. An offline
valid base is still a saveable intent. Structurally readable historical invalid
addresses remain visible after hydration so the same Network editor can correct
them, while request/resource construction reports the local error instead of
silently selecting a different authority. The existing failure callback restores
confirmed preference state after rejected admission. Explicit empty usernames
remain empty across cold load and subsequent saves; password/header semantics
stay with the existing authentication fields. These local errors do not invent
a server response status or request ID.

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
They use the existing selected Task identity for their context: without a Task,
the shared shell explains how to open one and distinguishes these records from
Continuous goal in the conversation. A Session's linked Task identifier does
not turn its Session board into a TaskBoard. An empty requirement projection
uses neutral text about what can be displayed; it never implies that analysis
is running. Structured lists and acceptance facts retain their original data
projection, and Main keeps ownership of Task selection progress and failures.
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
`Squad agents` Dock tab. Its list/detail navigation and shared SelectControl
read the canonical conversation-agent projection. Progress-card, list and
selector actions write the same selected `sessionID`. Task conversations load the
exact `/task/:taskID/conversation/session/:sessionID` view; standalone Chats
load the selected `/session/:sessionID/conversation` view. The main progress
card tree's global visible revision never participates in this request
identity. Live reload follows only the selected canonical Agent record's
persisted transcript revision, so unrelated Sessions, TODO progress, scrolling,
and message-part deltas cannot redownload the complete selected transcript.
The main progress grid, inner Agent selector, and Right Dock transcript remain
presentations of one backend session/message stream rather than parallel
frontend Agent lists or message stores.

The continuous Agent transcript header uses the selected execution's canonical
activity status. Historical assistant failures belong to their original Message,
including failures with no body Parts. The child projection derives message-bound
failure metadata from `Message.info.error`; CardParts presents it at that message
boundary through the same error block used by ordinary Chat bubbles. Details and
copy actions retain their Message identity across transcript refreshes. A prior
failure never substitutes for the latest execution status or moves to the end of
the complete transcript. This metadata is a view projection, not a persisted Part
or a second error store.

ConversationCard owns its bubble/card branch through a non-keyed boolean
condition. A new selected-child transcript projection updates the mounted
renderer through reactive props; object replacement is not a reason to
recreate the entire bubble and its streaming Markdown controllers.

The selected-child resource and its presentation share the resource's single
storage signal. A failed refresh keeps an accepted transcript readable only
while its complete target key still matches. The resource's actual error is
shown beside that content with an explicit retry action; initial load failures
show the same error without an indefinite loading placeholder. Reading the
stored value does not rethrow a fetch failure into unrelated reactive work.
Target changes retain the existing keyed retirement and request ownership.
Full fetch diagnostics remain in a bounded, keyboard-focusable reading region,
so expanding an error preserves space for the loaded transcript and Sources.

The selected Agent transcript uses the existing transcript-run gap token at
the medium spacing tier. That scoped token controls adjacent message margins
and quotation-to-tool spacing; the message border and padding still preserve
the visible boundary. Source groups keep their own count, label, margin and
chronological placement. Main and Side Chat retain their existing gap defaults.

Both the main Conversation and selected Agent transcript use the same explicit
content-change follow controller. A canonical transcript revision and the
controller's one native `ResizeObserver` over the scrollport and its current direct content boxes
schedule the same bounded bottom pin; the observer covers descendant Markdown,
code, media, and disclosure layout that settles after the data notification.
Observing the scrollport also covers content wrappers using `display: contents`,
whose own zero-size boxes cannot report a changed viewport width.
Browser layout may change `scrollTop` before or after either notification, so
movement alone never releases follow mode. Upward wheel, keyboard, touch, or
an active native-scrollbar gesture owns subsequent upward movement. Once that
movement leaves the existing bottom tolerance, the controller releases follow
mode. Recognized upward movement inside the tolerance preserves its current
input intent instead of consuming it as a return to the bottom. Programmatic
echoes and content-layout rebasing keep their existing discrimination. An
ordinary return to the bottom re-arms follow mode.

The main virtual Conversation reads that same follow signal for its render
buffer. Following the output uses the viewport range; reading history uses the
existing four-card pixel buffer. This keeps directional scroll/idle overscan
changes from repeatedly rebuilding offscreen Markdown during streaming pauses.
Focused controls and a pending history restoration keep their existing explicit
mounted-item pins. The buffer owns neither a second follow state nor a scroll
writer; Session, Task, and Mission use the same Conversation policy.

Agent list/detail visibility is local presentation state; it does not own
Session identity. Returning to the list or choosing another Session is an
explicit user action. List rows remain keyed by canonical `sessionID`, while
live record fields update their existing presentation. Selection/status updates
do not scroll an ancestor or remount a continuously selected transcript.
The transcript follow controller remains the sole vertical scroll writer.

Main child-progress cards preview the latest four projected activity items and
size to that content; the full child history remains in the selected Agent transcript. They
do not own a nested scrollport or automatic scroll writer. Current-source child
activity changes notify the outer Conversation follow controller, including
updates to an existing child. Native wheel movement over a card belongs to the
outer transcript. Manual history navigation keeps the existing follow/pause
contract, and full child history remains in the selected Agent transcript.

Compact child activity and full Source Parts preserve the same canonical
sourceId, URL, native file path and document media/filename descriptors without
text truncation or whitespace rewriting. Only presentation titles remain bounded
in the shared transport projector; item-count and ordinary text/Tool bounds stay
unchanged. Full Source rendering/navigation still uses the current transcript
owner, and compact data qualification does not imply a live long-URL UI pass.

Expanded Source controls retain identity by the canonical tuple of type,
sessionID, messageID and sourceId. Reprojecting the same citation updates its
current payload and ordinal without retiring its focused link or Tooltip owner.
Actual source removal, owner changes and disclosure collapse retire that control
through the shared keyed primitive; no focus restoration or shadow source store
owns the interaction.

## Shared visual primitives

Settings boolean switches use the existing Kobalte default Root, Control, Input,
and associated Label. A native label cannot wrap a Control that already toggles
the Input, because its forwarded click would toggle a second time. Explicit
input IDs and accessible names belong to the Input; visible captions use the
library Label. Pointer, external-label, and keyboard operation retain the same
single checked-state contract across General, Network, Channel, and Expert Squad
configuration forms.

The existing design-language tokens own geometry, typography and neutral
selection. Persistent titlebar and left navigation use one
`oc-material-glass` primitive. Theme palettes provide its translucent fill and
edge; the body paints the single static ambient background. Readers use the
canonical opaque conversation surface and popups remain opaque. Material has no
live backdrop filter, per-frame script, desktop capture or animation owner.
VS Code Dark retains its own neutral background and the same material contract.

Button, TextField, SelectControl, Tabs, Disclosure and navigation rows own
interactive states. Settings rows/groups and main/agent transcripts consume
these contracts instead of restoring per-page card geometry. Sources retain
their exact identities, indexes and destinations as lightweight links.
SelectControl uses the installed Select.Value owner for current-value identity
and accessible trigger labeling. Its same null renderer supplies the root
placeholder; domain surfaces keep their existing value/option renderers.
SelectControl suppresses duplicate key-selection events through the installed
SelectionManager so translated option refresh cannot become user navigation.
Actual enabled Item activation dismisses the same library-owned popup even when
the selected key is unchanged; selection and modifier behavior stay in the Item.
Enabled Enter/Space activation consumes the browser default before focus can
move into the Composer, while the installed Item still owns the selection.
The Composer reference picker owns Escape as disclosure dismissal in both its
search and Listbox. Its current directives remain selected until an explicit
selection change; clearing the last selected reference remains available.
Shared Listbox items use the installed library's default li/option element;
the library owns keyboard and pointer selection without a competing native
button activation. File changes retain their explicit keyboard/click open
action. The editable reference Listbox's scrollRef is the existing bounded
results container, so its keyboard-focused item scrolls within that owner.
File comparison groups use the same complete observation identity as the
merge projection. Rendered rows are keyed by selected Task scope, that group
identity and exact recorded path; global list index is position only. Both
ordinary For and virtualized range data consume these stable keys and read
current row data reactively, keeping the same visible row owner across live
evidence updates. A different scope/observation/path or actual removal retires
its owner. Virtual viewport eviction and the 80-row renderer switch still
retire nodes; stable identity does not promise focus through those boundaries.
The Diff reader memo compares the current connection authority revision, Task
scope, normalized target and complete visible group evidence revision using
the existing group revision primitive. Equivalent freshly projected objects
keep one resource request owner; a changed context/target/evidence uses the
original strict resolver and truthful loading/error/incomplete state. This
does not add an alternate content cache, selected-path fallback or a second
HTTP reader/cancellation policy.
An enabled item consumes Enter/Space browser defaults through its direct
listener when that exact item is the event target. Kobalte retains selection
and existing caller key handlers; nested interactive targets keep their own
defaults. This prevents native Space page scrolling without duplicating the
selection algorithm or manually forwarding caller event-handler unions.

Feedback is the shared inline loading/failure/notice primitive for settings,
ledger lists and message submission. Optional diagnostics use the existing
Disclosure and retain complete error text. A failed list retains existing data
with an explicit stale-data notice. Unknown Provider counts are not displayed
as a successful empty catalog. Composer presentation does not change the
existing dispatch boundary or automatically retry a submission.
Composer reference catalog problems retain their exact load/search source in
the single scope-keyed snapshot. A successful Squad search settles only its
own problem; full-load failures and typed Skill issues remain visible until
a complete reload resolves them. Both editable reference entry points share
concise Feedback, expandable complete diagnostics and an explicit retry through
the existing coalesced current-scope loader. Feedback has no separate catalog
state and does not retry a submission. Long diagnostics scroll inside the
existing measured mention panel height and bounded reference Popover; they do
not push dismissal controls beyond the clipping boundary. Reference search
precedes feedback in focus order.

Home headings, starter actions and the Composer use the same inherited reading
column insets as the transcript. Home has no separate percentage-width rule or
visible empty transcript scrollbar. The Textarea owns its native, static
placeholder; no separate placeholder text layer, decorative caret or rotation
timer participates in layout. Mention selection still uses the real Composer
reference catalog and remains available through typing and the reference menu.
Dock tabs share one neutral selected treatment across all panel kinds. Their
header shares the Dock's opaque content canvas. Shared empty hints provide
low-specificity typography defaults so each panel can own its content inset
without a late cascade override.

The Mission board separates page creation from search/project filters. Its
canonical five lane order and Mission/Task projections remain unchanged; lanes
use quiet headings and independently scrollable content instead of full-height
framed containers. Cards lead with the Mission title and retain identity, time,
project and execution details beneath it. Mailbox uses the shared Feedback and
neutral navigation selection while retaining unread and attention facts.
Transcript actor avatars use neutral chrome with the role glyph; elapsed times
are caption metadata and activity disclosures use the shared compact row height.
The existing pane layout effect observes settings hydration and zoom so resolved
widths follow the scale that the theme owner has applied.

The compact Agent Rail uses the shared Kobalte Tooltip as its only hover and
keyboard-focus detail surface. That Tooltip opens deterministically to the
right of the active tick with an eight-pixel gutter and no placement fallback;
its identity and bounded input preview remain viewport-constrained, while the
same trigger continues to own stepped proximity and exact-card navigation.

Dialog scrims share the modal layer; menu, popover and select content sit above
that layer. Shared Kobalte presence attributes drive short entry/exit effects,
with reduced-motion support and no perpetual animation or live blur. Dialog
header/body/footer insets share their surface geometry. Screenshot panels retain
virtualized rows and lazy thumbnail loading, with larger contained previews and
separate owner/date/count metadata; full-size images still use ImagePreview.

Pickers have one outer popup surface. Select lists own a single inset and do
not add an inner frame or fill; composer popup variants only change size constraints.
Model/reference groups use headings and spacing, and option glyphs are plain.
Selected and focused rows use the shared interaction washes, with check marks
for single selection and functional checkboxes for multiple selection. Provider
names/counts, descriptions, role badges and search fields retain their semantics.

## Color Themes

Theme selection uses the existing persisted Overlay theme identifier. The named
palettes are Light, Dark, VS Code Dark, Ivory, Sage, Mist Blue and Graphite Violet;
System resolves through the operating-system preference. Every palette declares
the complete semantic token set and its CSS color-scheme. Settings, command
palette and web menu consume the theme registry; pre-module startup, native
settings validation and native menu boundaries accept the same identifiers.
Embedded diagram, spreadsheet and MCP app binary light/dark modes read the
applied CSS color-scheme rather than comparing specific palette names. The static
frosted material, primitive geometry and interaction semantics stay shared.

The Right Dock uses the same opaque `--chat-canvas` reading/editing surface as
the conversation. Files, Browser chrome/new-tab/host canvas, editor, Review and
task-scope panels share that role; toolbars remain transparent over it and use
the standard dividers. Inset fills belong to controls, raised fills to cards.
The Dock does not composite workspace glass beneath otherwise transparent tool
panels. Guest web pages and captured images retain their own content colors.
The effective palette owner is `html[data-theme]`; body-scoped dark interaction
washes select descendants of that owner, including Graphite Violet.

## Typography Hierarchy

Panel typography follows [Overlay typography](overlay-typography.md), which is
the sole authority for font-size roles, line-height roles, ownership, and the
Interactive Artifact boundary. Panel surfaces may own layout, color, spacing,
and context-specific weight, but they cannot define another typography scale
or resize a shared primitive locally.

The chat-header Environment Information control owns one controlled non-modal Kobalte
Popover and one open signal. Conversation selection, arriving cards and trigger focus leave
presentation under operator control. Clicking the Environment button, Enter or Space opens
the same visible surface; activating it again closes it. Escape and outside pointer or focus
interaction follow the canonical accessible Popover dismissal and focus lifecycle.
Explicit child-feature navigation, the canonical
empty-home projection, and the complete Settings surface hiding the Conversation
anchor also close it. Every existing or newly registered
Settings section inherits that one surface-level lifecycle and never owns an
Environment-specific dismissal path. A new Right Dock opening edge dismisses
the currently visible Environment surface;
after the Dock is open, the operator may explicitly reopen Environment and both
surfaces retain their responsive coexistence. Outside interaction can dismiss Environment
while changing another surface; the Right Dock has no independent Environment visibility owner.
Escape on the topmost Environment surface clears its existing open owner and
returns focus to the trigger without scrolling; nested menu dismissal retains its
own layer precedence.
The hidden-anchor transition closes the existing controlled Popover before its
Portal can survive without usable anchor geometry. Environment sits directly
after the editor launcher and the Right Dock button remains the trailing
chat-header action. The Popover retains native `bottom-end` placement and uses
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
motion token while the Popover reveals from its trailing edge. The canonical
reduced-motion preference makes both changes instant. Below that boundary the
same portaled Popover reserves no content clearance and renders above the
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

Desktop pane allocation reserves both the Conversation and open Right Dock
minimums when resolving the left Projects width. If the measured Panel cannot
fit navigation, the Projects minimum, both separators and those reading lanes,
the Projects root temporarily presents as collapsed. This projection reads the
existing saved collapse preference, Dock open state, shared scale-aware tokens
and measured Panel width; it does not rewrite pane preferences. Closing the Dock
or widening the Panel restores an expanded Projects preference. Explicitly
showing Projects while that space is constrained closes the Dock, so the same
toggle always exposes a usable navigation lane. The toggle, inert state and
left separator share the projected collapse state. Existing window and visual
viewport resize scheduling updates the measurement; no second resize observer
or persisted layout state is introduced. Focus inside Projects returns to its
toggle before automatic collapse.

The open Right Dock retains the same Workbench minimum floor in its CSS maximum
and pointer/keyboard clamp. On a desktop Panel too narrow even for navigation
and the two reading lanes without Projects, Conversation takes the remainder.
Closed Dock width remains zero through its canonical open signal.

Environment Information embeds one compact `TaskProgressBar` projection only
when the canonical board contains Goals. Its header exposes the Deliverables shortcut,
one Completion Decision accepted/total summary, and disclosure. Deliverables is a peer Environment title
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
directory, branch, and Git host facts belong directly to
Environment Information and do not acquire a synthetic Runtime parent.

Goals, Requirements, Workspace, and Tools are peer classifications below the
project-name header. The header title and every peer
classification consume the shared body role. Named Goal rows, Worktrees,
Tools, Sources, and operation feedback also use body; compact counts, status,
and technical metadata use caption. Every classification and named region uses
one regular, muted, 32px title-row recipe, and every category indicator
occupies the same far-edge 16px column with a quiet resting opacity. Environment facts,
Subagents, classified task resources, and Sources are sibling menu regions;
every adjacent region is separated by the same quiet one-pixel border and
shared large-gap block inset. All title and content text in the Environment
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
Dock. It shows real role avatars with active and terminal counts in one compact
row. The decorative avatar strip is clipped to available width; the complete
counts and existing Dock remain authoritative. Activating that
row selects an exact real child `sessionID` before opening the existing Dock;
the Environment surface never creates a generic unselected Subagent panel, a
second session list, or another transcript source.

The Overlay radius scale remains owned only by
`styles/tokens/design-language.css`. At scale one, soft containers use eight
pixels for fields, Buttons, navigation and tabs; the Composer shell and reusable
popup surfaces use the twelve-pixel tier. Agent transcripts have no enclosing
card silhouette. The `.workspace-main` frame has square corners and one shared
one-pixel top/left divider. The body owns the ambient field, while persistent
chrome consumes the glass material; `.panel-body` adds no second paint owner.
The Workbench paints no exterior shadow or glow. Ordinary dialogs use the
twelve-pixel popup tier; extra-large remains available for immersive media
viewers and explicitly rounded macro surfaces. Zero and pill semantics
retain their existing values.
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

PreviewableImage reports the current image element's native decode failure with
a compact localized description while retaining its full-preview action. The
single image preview host reports native decode failures and original resource
errors through Feedback. Only positive intrinsic dimensions qualify an image
for zoom and pan; rendered layout dimensions and `complete` alone do not prove
successful decoding. Copy reports image unavailability before clipboard work.
Source changes retire the previous decode result, and a successful native load
restores normal controls. No alternate image, retry loop or second resource
loader is introduced; original resource error details remain available.

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

The project-scoped `GET /project/current/worktrees` uses the existing Project
identity context to read the actual Git registry and current removal eligibility.
Unavailable execution models do not block this read. It retains the strict
primary/managed projection, explicit non-Git prerequisite error and current
owned-prompt protection; deletion and cleanup keep their existing runtime
authority and revalidate their actual ownership at mutation time.

Environment Information, Goals, Requirements, Workspace, and Tools retain one
aligned title structure. Peer classifications share one compact 32px title-row
height and a far-edge 16px disclosure or navigation glyph;
their title and body text leading edges remain on the Popover's global text axis.
Classification titles reserve no leading icon slot. Collapsible title controls
and direct launchers share that trailing column; functional icons belong only
to body rows on the left side of the global text axis. Category glyphs remain
quietly visible at rest, strengthen on hover or keyboard focus, and never move
the title text. The project-name header retains the independent disclosure and
collapsed totals, with one circular ellipsis command trigger at its far edge.
Its shared DropdownMenu is owned by the mounted Environment content and anchored
to the whole panel, opening beside it with viewport collision handling. Setup,
switch folder, add tool, refresh and commit/push keep their existing action owners.
The menu uses owner-aware native-surface occlusion and releases that owner on
close/unmount. Local directory and branch menus use the shared command-menu
owner and renderer; the existing host kind selects either the native window or
the Web UI Popover presentation. Changes, branch facts, Subagents and actual Task Sources precede
conditional resource classifications and deliveries; Sources has no decorative
add action. The panel and command menu use the shared extra-large radius as
explicitly rounded macro surfaces. Classification title rows retain transparent hover/focus chrome;
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
the Overlay. The Environment command menu is only the trigger: the current branch,
streamed editable subject, regenerate control, and applicable Commit / Commit &
Push / Push actions live in the shared modal Dialog primitive, never in an
inline expansion or a second VCS surface.

Work Ledger 顶层只保留 New Chat，并与标题栏和命令面板共享同一个 global launcher。该入口
以 Work/Chat 作为初始模式；Code 与 Work 由同一个 Composer 内的 Code / Work selector 选择，Mission
继续通过显式 reference 或 Chat 的语义 handoff 进入，禁止在 Work Ledger 重复创建 mode-specific
入口。每次调用只清除会话与 Project runtime selection、进入 directory-free launcher 并聚焦
composer；没有实际提交时禁止调用任何 Project 或 Session 写路由。首次 Code / Work 发送分别
通过 `/global/chat` 或 `/global/work` 原子创建一个新的 dated UUID 临时 Project 与 Session；
directory-free launcher 从既有 Overlay settings 的 `lastSelectedModel` 恢复最后一次显式模型选择；
主动选模型更新该偏好，浏览历史会话只投影其根 Session 配置。当前选择的 Model 作为这两个创建请求的可选 `model` 字段传递，并在
返回前写入根 Session 的 config overlay。未显式选择时请求保持继承语义；后续 prompt 禁止再次
携带临时 Model，而是统一通过根 Session overlay、Project config 与 global config 的既定优先级
解析。Provider catalog 只负责证明 Model 可用，不能替代这条持久化配置来源。
新草稿未显式选择模型时显示“继承配置”，并允许有内容的普通提交；既有 Session 或 Task 的模型
投影尚未完成时保留其等待状态。继承展示不计算、写入或传递一个前端推测的默认模型。
首次显式 Mission 发送才通过 `/global/projects/anonymous` 创建并激活它的独立 Project。
Mission 草稿标题、输入提示与首页说明使用通用 Mission 语义；选择 Mission 目标本身不代表
已选专家团或执行上下文已就绪。已选 Squad 的精确身份继续由同一份真实可见 reference 展示。
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

Composer toolbar follows its own available width and UI scale: full labels,
then icons with current-value titles, then one popover containing the same
controls. Attachments and send/stop stay directly accessible. Model and
launch-reference controls retain the toolbar's available space: the single
attachment count/indexing status lives beside the attachment area above the
input shell and can wrap. It remains visible during pending uploads without a
chip, independently of input admission, and does not compete in the footer.
The folder attachment menu reads the existing host capability for
`workspace.pickDir`. A browser keeps a disabled, localized desktop-app folder
item with an explanation; supported desktop hosts use the native picker. File
selection continues through the ordinary HTML file input in both hosts. The
menu and handler share that capability declaration; no recursive browser folder
upload or alternative directory reference protocol is introduced.
Model readiness
comes from the canonical composer model projection even when the popover is
closed. Per-project explicit launch intent restores from Overlay preferences;
opening historical Task/Session/Mission occurrences projects their own mode
without changing that preference. Provider/config read responses must still
belong to the active server and directory before updating the current view.

Chat 与 Work 共用一个
right-sidebar conversation session、message、attachment、tool、Skill、Model Context Protocol
(MCP) server 和 lifecycle 实现；持久化的 `metadata.conversation.experience` 是唯一身份来源，
分别映射到 `/coding/chat/**` 与 `/coding/work/**`。Work 的独立 harness 拥有自己的 primary
prompt、默认 Skill/MCP assignment、typed office tool inventory 与 parent-only delivery policy，
同时继续复用上述 conversation 基建；它通过
`BriefcaseBusiness` identity 在 Dock、Composer、Conversation header、Work Ledger 和 Archive
保持一致。Work prompt 默认先规划最有利于审阅和复用的 interactive artifact 交付面，优先
一个完整 primary artifact，并只在能提供不同证据、比较、顺序、结构或演示视角时增加互补
artifact。Project 行内 New Chat 恢复该 server/directory 已保存的 Composer intent；没有偏好时
使用同一个 Work/Chat 默认值，实际提交按当前 intent 进入既有 Project scope route。每次真正提交的
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

Every Mission, Task, Chat, and Work row exposes one narrow hover/focus actions
menu containing its persisted pin action and applicable stop, download, and
archive actions. The transparent resting trigger is absolutely anchored to the
row and contributes no grid width; the title body permanently reserves its hit
area so revealing the trigger cannot move the main button beneath a pointer.
Hover, focus, or keyboard action-open changes trigger visibility while the row
bounds, leading icon, trailing indicator anchor, and adjacent-row positions
remain unchanged. Stopping a Task, Mission, or Chat from this menu requires an
item-named confirmation before dispatch. The row menu has no rename action;
double-clicking the canonical row main button invokes its existing domain rename
dialog while single click retains selection. Ordinary Chat/Work title PATCH uses
Project identity admission independently of execution-model bootstrap. Its
existing exact directory, Project and conversation-experience checks, normalized
title validation, transactional title/time update and Session.Updated publication
remain authoritative. Archive, selection and execution retain their respective
runtime admission. Pinned items remain inside their
canonical Project group or one-list projection and sort before unpinned siblings
without changing activity time.

Work Ledger and the selected Conversation header expose one binary activity
projection for Task and Mission: `Running` while execution is active and
`Not running` otherwise. A running row may use the shared spinner. Task rows
and the selected Task title separately show the current execution's terminal
outcome (`Completed`, `Failed`, or `Cancelled`) through one shared compact
indicator. This derives only from the current validated Task lifecycle row;
a reopened active execution does not carry its predecessor's result. Raw Task
`active` lifecycle alone does not imply running: the shared Task projection
checks current streaming/retry occurrences across its owned Session tree. A
parked scheduler is inactive unless a descendant is executing. Historical
lifecycle events do not establish liveness after process restart. Task
execution-lifecycle publications invalidate the existing global Work Ledger
stream so pause, wake and settlement update mounted rows and Mission counts.
Task lifecycle remains available for diagnostics, timestamp validation,
recovery, explicit operator cancellation and the separate execution outcome.
The Conversation header visibly presents the existing activity caption and
elapsed time beside its title. A physically inactive terminal Task retains its
elapsed time beside the separate outcome indicator. The activity caption's
visibility is derived once in TaskStatusHeader and shared by its rendered text,
accessible label and tooltip. A settled terminal header exposes its elapsed time
beside the outcome indicator without an additional hidden activity caption.
That outcome does not establish business deliverable acceptance; Mission
acceptance remains an evidence judgment outside the activity projection.
The active Composer context identifies an actual selected Task as `Task`,
using the same current ledger kind. Its existing conversation-target routing,
product pillar, profile, tools and natural participant messages are unchanged.

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
absent. The Conversation is one flat opaque reading surface within the ambient
Workbench; header and content share that surface instead
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

`panel_query_task` returns structured JSON for both Task listing and inspection.
Omitted `taskIDs` lists the latest eight Project Tasks, or all Tasks owned by the
current Mission, as identity/title/status rows. Explicit IDs (up to fifty) return
canonical status and current active execution or terminal lifecycle references. `include: ["board",
"plan"]` adds Board overview and goal/planning-artifact summaries from the same
EngineService Board. Listing is an identity discovery receipt; Artifact catalog
reads require an explicit-ID inspection receipt from the current physical Turn.

`panel_respond_interaction` delegates typed `answer`, `allow_once`,
`allow_project`, or `reject` responses to the existing EngineService interaction
writers. Mission mutation exclusivity and permission effect classification
remain owned by those existing authorities. `panel_select_workspace` accepts a
Task/Session target only on a local surface and emits the existing typed
`select_task`/`select_session` local event; output events are not model-tool aliases.

The model tool and human interaction APIs have distinct input envelopes. A model
calls `panel_respond_interaction` with `interactionID` and typed `response`;
the structured gateway uses the same parameters with
`action: "respond_interaction"` and no `panel_` prefix. Overlay interaction cards
continue to call `/interaction/:id/reply` or `/reject`, and standalone Question
cards use their `/question/:id/...` routes. Human permission replies additionally
support `allow_task`; the model tool retains its declared
`allow_once`/`allow_project` choices. Both paths reach their existing
EngineService/Question authorities. This consolidation changes neither those
human endpoints nor the visible card actions. Gateway selection remains
forbidden because `select_workspace` is local.

The Mission Panel exposes `query_task_artifacts.queries` for up to eight independent owned Task catalog queries per call, including active Tasks. Worker and Orchestrator `artifact_search.queries` use the same bounded batch envelope. Results identify their submitted item by zero-based `request_index`; `next_queries` contains only cursor/page patches to apply to the original item, excluding `request_index`, while `pending_queries` identifies items to resubmit unchanged. Panel pages consume the batch's assigned output budget, starting from the canonical maximum of 100 entries. The signed catalog cursor pins membership and ordering; a page number is the continuation ordinal, not an instruction to reconstruct pages from the current catalog. Page 1 has no cursor; every later page supplies the exact returned cursor. A large batch may return smaller pages or defer whole queries according to the shared output bound.
For a Session-bound model caller, the Host binds the exact persisted observation
returned by `panel_query_task` earlier in the same physical Turn: either a terminal
reference or an active opened event and execution epoch. The model does not invent
these references. A continuation must match the prior completed batch's
`next_queries` and its corresponding result observation. A stateless Panel or
gateway request instead binds the current canonical occurrence at request start.
Both paths revalidate the observation before and after each page. The existing
catalog authenticates cursor scope, filters and frozen membership; newly published
Artifacts appear in a fresh query rather than shifting an existing page sequence.
One physical Turn is the exact Session input occurrence named by the assistant
Messages' common `parentID`; sequential streaming Tool-call Messages produced
while resolving that input do not create new Turns. Mission completion evidence
therefore owns an interactive Artifact when the Artifact-producing assistant
Message and the completion assistant Message belong to the same Mission Session
and have that exact common parent. Equality of those two assistant Message IDs
would incorrectly reject the required publish, query, read, then complete Tool
sequence, while a different parent remains a different occurrence and is never
accepted as completion evidence.

Mission completion stays current only while its receipt accepts the exact current child Task set and each completed terminal occurrence remains unchanged. New operator authority invalidates an earlier acceptance; internal scheduler notifications, proven one-shot delay wakes and recovery envelopes do not create a new user requirement merely by arriving later. A real scheduled Automation job remains fresh execution authority. The board derives this from canonical Task lifecycle references and the immutable completion receipt, never notification arrival order.

Task creation publishes an exact durable child identity and retains exclusive mutation admission. Its Tool receipt
does not automatically finish the caller's physical Turn: the Mission may still owe another ready creation, a
stage binding or a correlated reply. Initial creation, replay and accepted-target-unavailable recovery follow the
same result contract. The real caller finishes or explicitly waits after satisfying its current responsibilities;
the Host does not synthesize a follow-up wake or force a workflow step after publication.

Task evidence reads are independently immutable completed Tool facts. A
Mission may retain every Host-minted `artifact_read_ref` from a complete chunk
sequence across later inputs and use that full supplied set for final completion
without re-reading unchanged terminal Tasks. The completion writer resolves all
Task acceptance sets through one fixed-count indexed batch reducer, considers only the supplied prior
reads in that Mission Session, requires those chunks alone to prove complete
byte coverage, and compares every read's bound terminal lifecycle reference with
the Task's exact current completed occurrence. It does not scan Session history
once per Task or mix another occurrence's chunks into completeness. Reopening a
Task therefore makes its former references ineligible and requires fresh
reconciliation; no mutable acceptance cache or Host-selected Artifact is
introduced.

`panel_read_task_artifact.reads` performs up to eight exact canonical body reads under
same-Mission child authority; worker and Orchestrator `artifact_read.reads` share the batch implementation. Each Panel chunk binds its observed active execution or terminal occurrence, revalidated around the read. Active inspection provides immutable evidence for coordination, while formal handoff and acceptance retain terminal authority. Terminal acceptance and resume reducers cannot use active-period bytes to fill a later terminal read. Structured results share 40 KiB and text chunks share 24 KiB per call; encoded media attachment URLs share 32 MiB. An item exceeding the media limit returns an explicit error; a batch that fills the limit defers whole remaining media items. `next_reads` contains exact continuation requests to resubmit unchanged. Each visible result retains its current version-2 atomic receipt. Evidence reducers traverse these atoms in the real Tool outcome, including deferred permission results, and match each read to exactly one submitted reference and byte offset. Final completion filters the Session-scoped joined query by the supplied references and accepts only those chunks; multiple receipts in one Tool Part remain distinct evidence. Existing immutable scalar version-2 receipts use the same atomic parser, with no second execution protocol, schema reset or copied evidence store. `resume_task` is the separate mutation for an
evidence-backed acceptance gap: it binds the reviewed terminal occurrence and
fully read locators, writes one visible Mission participant message, and
returns the durable same-Task wake/receipt identity. `send_task_message` keeps
its ordinary terminal conversation behavior. These are model-visible control
facts; Overlay renders the existing Task, message, activity, and Artifact
projections and does not invent a second acceptance or resume state.

`panel_extend_task_acceptance` is Mission-only control for additional obligations in an existing active repair. Its read references bind the exact active execution and complete bytes, using the same observation-aware reducer as terminal reads. It preserves every existing open grant, can reopen an accepted criterion with new invalidating evidence, and can add open criteria. It records a visible Mission request and returns a pending receipt until the root input lease applies the exact ledger CAS. Immutable request/outcome Artifacts distinguish applied from rejected; prior completion or cancellation makes a queued request inapplicable. Neither acceptance of the request nor active evidence reading grants terminal acceptance, changes a running worker descriptor, or starts a new Task epoch. Existing terminal `resume_task` retains its separate lifecycle authority.

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
it with a text heading and compact count sourced from the backend `activeCount`;
the unread/selection summary is plain secondary text. The title and exact active
count share the heading row with Search. Bulk actions occupy a second row only
when there are visible messages. The surface exposes no Archived
control. The upper-right left-Dock Mailbox launcher independently projects the
exact backend `unreadCount` through the shared Badge primitive, visually caps
counts above 99 as `99+`, and retains the exact count in its accessible label.
A delayed launcher hover selects Mailbox transiently; leaving the whole left
Dock returns to Work Ledger only when that hover still owns the selection.
Clicking pins a hover-opened Mailbox. Both activities remain mounted, so this
selection change preserves Mailbox pagination, loaded rows, disclosure, and
scroll position. Search expands to
the canonical SearchField only after explicit activation. Search takes the second
header row while the Inbox heading remains stable; its close button and Escape
use the same query-clearing operation. Open Task is a separate
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
WebviewWindow owned by `main` on desktop. The owned window is the single styled menu layer
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
The ordinary Web UI consumes that same model through the same
`CommandMenuSurface` renderer and keyboard interactions. Its physical surface
uses the existing Popover primitive for placement, dismissal and collision
handling. Its manual HTML popover host stays inside the anchor's DOM ownership
while the browser top layer prevents ancestor scrolling surfaces from clipping
the menu. Only the menu content receives pointer input. Host selection is explicit through the existing immutable transport
kind before presentation begins; a failed native surface never switches hosts.
One active request and owner cover both mutually exclusive physical surfaces,
and closing removes the owned presentation before delivering its real action.
Native window resets remain local to native-menu.html, while both hosts import
one shared menu card stylesheet.
Submitting the address field with Enter navigates the live embedded WebView.
The trailing arrow is a separate operating-system `open-url` action:
it opens a nonblank normalized address in the computer's default browser
application without retargeting the embedded WebView.

The Browser page meets its stage without a decorative host frame or inset.
The ordinary Web UI explains its existing capability when embedded navigation
is unavailable: an empty stage presents the external-browser action, and the
address placeholder describes that available action. Canonical target/evidence
loading, saved evidence and real errors keep their existing priority. Desktop
empty tabs retain their native new-tab presentation. Enter continues to request
embedded navigation and reports its real unavailable result; an external page
opens only through the separate explicit operator action. The external action
keeps its normalized address as the current edited draft; it does not retarget
the embedded surface or reset the draft from an unrelated empty target. Its
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

Each open Browser tab retains its single component owner across tool selection
and Dock visibility changes. The existing tab record controls that lifetime:
the fixed Task preview is retained only while its exact `browser` tab is open,
and each operator tab is retained by its own dynamic record. Address editing
and live-page state remain local to that owner. Inactive evidence reads and
native actions still follow the existing active/occlusion lifecycle; inactive
panels remain hidden through the shared selected-tab styling. Explicit tab
closure and workspace reset dispose the same owner and perform its existing
resource, controller and native-surface cleanup.

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
screenshot index. Its `ResizeObserver` content width determines how many
`208px` logical minimum-width slots fit at the current UI scale, without a
maximum-column cap. Cards share the available row width and contain the image
inside a 16:10 preview. Virtua remains the row-window owner and thumbnail
attachment requests remain lazily scheduled through animation frames. The Dock
tab remains the only panel title; owner-group headers separate agent, date and
image count. Each card keeps its title and short time, with the full timestamp
available on hover.

The Explorer tool's empty chooser, add menu, tab and overflow titles, and
applicable Environment shortcut resolve the same `explorer.title` as the panel
body. The File viewing/editing tool retains its separate `file.title`, so both
tools have distinct localized names while their canonical IDs remain unchanged.

Right Dock tabs and their embedded close actions use the shared `32px`
header-control geometry. The Dock-global add and close actions use the same
icon-button density and standard `14px` Icon tier, matching
the rest of the application chrome. The fixed-height tab header and mounted
panel body meet at one quiet divider drawn by the header through the shared
border-width and divider-color tokens. Open tabs use one Chrome-style width
contract: each tab keeps the shared preferred width while space is available,
then all visible tabs shrink evenly to the shared usable minimum before the
existing overflow menu activates. The active tab remains visible. Its exact
tab is removed on close; closing Review also clears the legacy diff
workspace presentation before the canonical tab collection selects the
preceding remaining tab.
Focused open tabs expose Delete as a direct close action. The close button and
keyboard action await the same completed close result, including the existing
File dirty-draft confirmation; cancellation keeps the tab and its focus owner.
The File decision's programmatic Dialog restores the initiating visible control
on cancellation through the primitive close-autofocus hook. It uses the existing
file resource and connection authority to retire stale focus intent; accepted
leave decisions hand focus to their destination instead.
After actual removal, the existing Dock reflow frame restores focus to the
canonical selected visible tab, or to Add tool when the collection is empty.
Opening a tool from the empty chooser captures that initiating button before
the chooser becomes hidden and uses the same reflow frame to focus the newly
selected visible tab. Ordinary tools and a new Browser tab keep their existing
creation callbacks and identities. The add menu retains its primitive's own
focus lifecycle; a tool body that has already acquired focus keeps it.
The File pane names its close action with the current original file title in
the current interface language. Its Close file action uses the same focus selection after a
successful close and its resulting layout frame. Its content-side entry must
not leave focus on the removed editor; navigation admission keeps its own
destination focus. Both presentation entries preserve focus already moved by
the operator and retire the intent when the captured Dock is hidden or gone.
The tab strip retains only the initiating element as a short-lived focus intent
and respects an operator who has already moved focus. Disposing the Dock cancels
that reflow frame.
The same main UI operation reporter exposes its handled completion promise so
this interaction can observe completion without another close/error path.
Closing the whole Dock restores its focused descendant or resizer to the
visible conversation header toggle before making the Dock inert. Focus already
outside the Dock remains with its owner; Settings and Mission Board navigation
retain their destination focus. File presentation observes only the canonical
open flag and explicit reveal revision through Solid's `on` utility. Reading the
current primary surface inside that handler cannot turn a page switch into a
new file reveal. New and repeated explicit file requests still reveal the File
tab through the existing opener.
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
connected-provider catalog and renders each model's canonical label once on
one line. Its fully-qualified `<provider>/<model>` ID remains the selection
value and tooltip; the visible label also supplies keyboard prefix navigation.

Right Dock width has one persisted source, `rightDockWidth`. Its runtime
renderer, pointer and keyboard resizers, and Cascading Style Sheets (CSS)
maximum all apply the same bounds: the Dock keeps the shared workbench-panel
minimum, never exceeds the shared Dock maximum, and reserves the canonical
`--ui-chat-min-width` plus the separator when the available Workspace can fit
both reading lanes. The shared desktop allocation above first releases Projects
when necessary; only a Workspace narrower than the two lane minimums lets the
Conversation shrink further. Restoring an older wide Dock preference uses these
same constraints.
The Dock separator exposes its current constrained rendered width and the same
minimum/maximum through ARIA range properties. One resize observer follows the
Dock and workspace geometry, coalesced by the existing animation-frame scheduler;
open/close and width rendering use that same semantics projection. Closed handles
retain their existing hidden/focus behavior and omit the active range. Observation
and pending frames end with the main application lifetime. The stored width,
pointer/keyboard behavior and layout bounds remain the original owners.
The separator's existing five-pixel pointer reach on either side of its visible
line stays unclipped by its own box. It does not consume additional layout width;
the closed separator keeps pointer events disabled.

## Inline Interactive Artifacts

Conversation message cards can render durable interactive content without
using the Right Dock Browser Preview. A real tool publishes one strict
message-owned `interactive_artifact` row and returns an
`interactive-artifact` display part. The Session processor commits that part
with the real tool outcome and Sources in one transaction. The message part
contains the artifact ID and a `toolPartID` binding to the completed invocation;
its own Session identity and the active project directory provide
route scope. The session artifact route remains the only payload source across
live display and replay, so standalone Chat, task conversations, Mission,
delegated workers, and active expert-squad agents share the same protocol.
Title, summary, compaction, and control roles do not receive the publisher.
The exact artifact-body GET route requires Project identity and the persisted
Project/Session/Message ownership join. Reading an existing payload does not
require an executable model configuration. MCP App host requests and capability
event routes retain their runtime authority.

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

Native Table cells format actual booleans, numbers and dates with the current
product locale. Boolean columns do not apply truthiness to mixed scalar source
values: a string `"false"` remains that string in a boolean column. The shared
pure presentation owns both display text and literal search across original and
formatted values. Every declared column can participate, including boolean or
initially empty columns. Query, current presentation and declared column types
derive one controlled filter input, so locale changes refresh matching rows as
well as cells without replacing the mounted table's query or sorting state.
Pagination retains TanStack's existing reset behavior when filtered results change.
Authored labels and exported payload values retain their original identities.

Editable Code presents this local lifetime beside the editor, asks the operator
to copy or download before leaving, and derives a modified marker from its one
current source against the published payload. It does not write a durable draft
or mutate the original publication. Copy/download continue to export the current
mounted source; recreating the renderer restores the published content.

Spreadsheet passes its canonical payload identity to the shared Frame while its
custom export accessor continues to read the currently mounted workbook. Product
language changes update that same Univer instance through its public locale
service and the already registered language packages; they do not recreate the
workbook or replace edited cells with the published payload.
Editable spreadsheets show a current-language note before editing: changes live
only in the current view, and edited sheets must be downloaded before leaving or
collapsing it. CSV exports preserve cell values rather than workbook formulas or
formatting. A local column layout gives the note its natural height and the same
mounted workbook the remaining fullscreen space. This guidance does not add a
durable draft, a dirty-state owner or a navigation prompt.
The installed Univer locale packages own sheet-tab, Sidebar and notification
accessibility names. Their four mounted components redraw from the same locale
service with the existing disposable update binder. Sidebar projection includes
the current locale in its memo inputs, so keyed labels and render-time panel
text refresh without replacing component state, width or the workbook. Previously
translated titles and stored translated panel state remain separate consumer
contracts; this does not claim every panel snapshot is locale-reactive.
The shared hidden document input returns editing focus with `preventScroll`,
so focusing this keyboard proxy does not scroll an enclosing Chat to its offscreen
position. Docs and Sheets retain their explicit internal cursor and selection
reveal controllers; visible controls retain their own native focus behavior.
This contract concerns ancestor scrolling, while button activation focus is a
separate policy.
Native buttons retain focus before activation: the shared layout listener returns
only layout/canvas proxies to the editing input. Generic Design buttons and
SheetBar buttons use their existing native activation and context updates.
Explicit menu/command calls to the layout focus service still return to editing
after their actions; dialog return-focus and non-button links keep their own
existing contracts.
The protection panel keeps the locale key in both List Add and successful Detail
Confirm title producers. Its range error is derived from the current ranges by
the existing checker at render time, and that same result governs display and
Confirm. Description, choices, workbook and original validation order remain
owned by their existing state and services.
Protection rule cards use the existing Univer dark hover surface, and their
Edit/Delete regions use its existing dark operation surface. Rule descriptions
use the same theme’s dark foreground variant. The mounted list and ThemeService
supply these variants in ordinary and fullscreen views while retaining the
existing rule identity, actions, locale and range drawing. No Host colour
override or separate theme state supplies the protection card.
Design Dialog close names consume the existing ConfigContext locale projection.
ConfigProvider resolves optional locale input from the complete published en-US
design resource and supplies Dialog.close; all nineteen language resources
declare that field in each published format. A mounted Dialog reads that same
Context on language changes, retaining its input and existing Radix close action.
No Host dictionary, extra locale subscription or renderer remount supplies it.

Shared artifact action controls preserve native focus while an operation owns
their busy state. Native disabled is reserved for genuinely unavailable actions;
ARIA disabled/busy and the existing operation owner describe transient work.
The existing disclosure owns Download open state, admits opening only when
available, and always admits closing. Resource identity, project selection and
abort ownership still decide whether a completed export belongs to the current
view. Visible type badges use the current payload renderer and the product
locale catalog; technical kind attributes retain their stable styling identity.

Menu keyboard activation uses the shared Kobalte scroll primitive. When root
overflow is locked, each completed scroll step continues from the current scroll
ancestor’s parent, so traversal advances toward the root. The dependency patch
keeps the existing inclusive getScrollParent contract and normal native scrolling;
fullscreen uses the same trigger, portal and mounted artifact renderer.

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

Artifact inspector previews use one current request owner for connection
authority, owning Project directory, Task, exact locator and title. The existing
reader returns content together with that request; only its matching successful
ready result supplies title, filename, content and export. Pending/error/removed
targets retire the previous displayed renderer. Equivalent semantic requests
retain their owner; a genuine snapshot request change retires its resource
selection and search along with the renderer. The same helper owns outer and
selected-resource loading, without another cache, reader or directory resolver.
The local error boundary contains the request-owning body and child renderers.

`ArtifactFrame` is the only native artifact work surface. It presents the same
mounted renderer in compact Conversation form and, when supported, through the
browser Fullscreen API; it never creates a second renderer tree or copies the
payload into a modal. MCP Apps keep their protocol-owned display modes and do
not receive this native control. Delegated Markdown file links leave their owning
fullscreen subtree before opening the existing file workbench or its draft
decision dialog. The native transition uses the current connection, workspace
selection and file reveal revision to retire a stale click. Both codespan and
authored file-link destinations retain their exact existing path/range and editor
policy; no second renderer or file-navigation owner handles this transition.
One Overlay artifact-theme materializer reads
the applied product CSS custom properties and supplies the semantic palette,
type, surface, axis, grid, legend, and interaction values used by the mature
renderer libraries. Chart and Dashboard share its Vega-Lite configuration;
Network consumes its library style values and Diagram passes its product font
to Mermaid. Timeline's existing stylesheet projects product tokens into the
vis-timeline surface, including explicit selected foreground/background for
point and other supported item shapes; authored inline colors keep their
existing payload precedence. Timeline completes its final layout on the library's
public range-settled event, including the first explicit payload viewport with
automatic resize polling disabled. Its scoped Moment date constructor and selected
event details follow the current product language; language updates use the same
mounted instance and retain its current viewport and selection. Authored event
timestamps retain their existing local-time display contract. Diagram's fullscreen
SVG relinquishes Mermaid's compact intrinsic width cap while retaining the original
mounted viewBox and graph.
This keeps data semantics in the durable payload while making visual
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
Each Univer workbench owns one stable floating-content container. Its existing
configuration supplies that container to context menus and their submenus,
dialogs, dropdowns, popovers and tooltips. The owner attaches it to the containing
fullscreen element while active and to its document body otherwise, preserving
the workbook and disposing the container with that workbench. Tooltip geometry
uses fixed viewport coordinates. Context-menu lifetime follows the actual open
state and anchor; child portal pointer/wheel events belong to their React menu
owner, and a dialog-consumed Escape is respected before closing the parent.
Closing a parent retires its submenu, while repeated submenu activation retains
its established positioning.
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

The Board is materialized once as its complete JSON-visible response. Its
opaque weak entity tag, `W/"task-board-v1:<digest>"`, identifies that projection
using the canonical resource digest before adding `snapshotVersion`; the same
object supplies the response body and ETag. Project names, Task titles, exact
interaction identities and states, topology, execution, incidents and Brief
therefore participate, rather than a count/max-time approximation. The installed
Hono ETag middleware owns conditional GET/HEAD, tag lists, wildcard and weak
comparison after the actual Task record lookup. A Board read does not advance
Task execution, but may fill its existing derived Brief cache; this validator
does not change that cache policy or claim large-Board performance.

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

Provider connection Test delegates an omitted model ID to the backend's
effective catalog. One per-provider observation map retains the generated
result or the original HTTP error. Its short summary uses the current interface
language and actual model identity; native disclosure exposes the original
model output or complete technical diagnostic without translating the source.
Accepted configuration, credential, cleanup and deletion mutations retire that
provider's Test generation, result and busy state. Successful registry refresh
retires all current observations; live model refresh uses its returned provider
IDs. Scope, authority, selection and unmount fencing keep their existing owners.
Opening, cancelling or failing an uncommitted edit is not an accepted mutation.
Retiring a Test does not advance the shared owner used by Save, Auth or reads.

Provider authoring uses one pure endpoint-edit validator for localized field
feedback, save/discovery actions and the canonical form writer. New or explicit
API edits require a parseable absolute HTTP(S) address without URL userinfo;
untouched addresses remain owned by the latest provider definition, including
model-only declarations and runtime templates. Discovery validates its current
input without the edit exemption. This does not prove connectivity or alter
the backend provider schema or its single template-expansion owner.

Provider search derives its numerator and denominator from the same custom and
catalog row collections. The unsearched collections retain editable custom
declarations and exclude their IDs from catalog rows; the query filters those
collections without counting declarations twice. The separate Configured
summary remains the union of configuration and connected IDs, while Catalog
remains the complete current catalog projection. Model quantities in provider
rows, discovery receipts, Composer groups and usage use the shared plural
translation contract. Discovery stores the current successful count, translated
at render time under the existing form occurrence and response ownership.

Provider forms accept empty model declarations under the same global/project
save transaction. Empty-to-empty edits retain the declaration shape and current
peer additions; explicit removal deletes only the initial model overrides.
Inherited models can reappear when an override is removed. The localized inline
hint states that models can be added or discovered later and inheritance is
preserved. Model references, captured scope and API validation keep their existing
contracts. Saving configuration alone does not claim inference qualification.

Provider saves distinguish configuration commitment, credential commitment and
directory observation. A successful configuration response or the shared typed
committed receipt proceeds through the existing serial followups, retaining any
reconciliation issue. Auth acceptance permits credential cleanup; cleanup or
Auth failure leaves the independent directory read eligible. Fulfilled partial
load issues remain visible alongside rejected stages. The current form closes
only after owned followups settle and reports saved-with-issues when needed;
ordinary initial errors retain authored input. Row Key saves classify their
result from the actual Auth receipt. Each stage uses the captured ownership;
form saves additionally keep their exact occurrence. Reset clears that form's
busy state before retirement, and an older completion cannot own a newer form.
Diagnostic details consume the shared receipt projection while the original
configuration snapshot remains exclusively in the business response.

Channel edits require the currently selected project and show the existing
workspace selection hint in the directory-free launcher. Shared Skill/MCP
resource pages use the same loading lifecycle on first entry and manual reload;
Skill issue projection checks its owning directory before committing the result.
Channel rows use generated ChannelListResponse and display configuration status
and runtime status separately; missing configuration is not runtime availability.

The current GET /channel field descriptor provides labelKey and an optional
example-or-hint placeholder, using the shared ChannelFieldPlaceholder schema.
The interface translates label and hint keys in its current locale and preserves
technical examples exactly. Configuration descriptions derive from typed status;
required fields being present does not assert a running connection. Runtime
diagnostics retain their original runtime_detail. The old fixed summary, label
and string-placeholder response is replaced by this descriptor in the generated
OpenAPI and SDK, without a compatibility reader or persisted-config change.

The Channel public-URL editor validates its native URL input and HTTP(S) pattern
before acquiring a save owner or calling the configuration writer. Blur and save
share that same field validity, including case-insensitive schemes and empty-value
clearing. The existing TextField renders a localized inline error and accessible
field state; edits and accepted config hydration retire that field error. Catalog
feedback retires on public-URL edits without clearing a channel editor's own slot.
The lower-level configuration string and explicit environment contracts remain
unchanged; this editor does not introduce a second URL parser or migrate old data.

Channel save and tutorial feedback stores message keys, variables and original
details, translating summaries in the current interface locale. Catalog failures
retain their original service diagnostic under the same native Details disclosure.
Successful saves retain the existing 2600 ms dismissal; errors remain readable
until explicit feedback retirement or scope change. An accepted committed-config
receipt reports saved settings with reconciliation issues. Public-URL hydration
subscribes only to accepted configuration and the existing authority, selection
and directory scope; ordinary save settlement preserves the authored draft.

The desktop updater checks the compiled signed release channel at app startup,
on visibility return, and hourly while visible, independently of backend
health. The native updater owns signature verification and the prepared package;
the sidebar and About panel project that one state. Discovery can download in
the background, while installation requires an explicit restart confirmation.

## Verification

- `bun test packages/opencorvus/test/workbench/board.test.ts`
- `bun test packages/opencorvus/test/interactive-artifact/interactive-artifact.test.ts packages/opencorvus/test/session/processor-duplicate-tool-call.test.ts`
- `bun test packages/opencorvus/test/tool/send-mailbox-message.test.ts packages/opencorvus/test/server/mailbox-routes.test.ts`
- `bun test packages/opencorvus/test/script/document-health.test.ts`

### Resource and factual settings layout

SettingsGroup and SettingsDetailSection share SettingsSectionHeader: one title,
description and action composition, with wrapping text and one separator. The
shared panel owns section spacing and rows own list density; individual panels
do not restyle that hierarchy. Settings use flat neutral surfaces, including
About and Usage. Semantic colors remain for status and analytical graphics.
Network and Provider result/error notices use the shared Feedback primitive.

General presents Notifications, Permissions and Diagnostics in that order.
The Composer and General authorization controls project only a confirmed
`permission_mode` from the current accepted configuration snapshot. An unloaded
or unrecognized mode remains unavailable; neither surface substitutes Full
access. The Composer retains its settings entry while mode choices wait for a
confirmed value. General offers an explicit reload through the existing scoped
configuration reader and retains its original load diagnostics. This view state
does not change server authorization or create a second permission policy.
Permission records load on demand under one disclosure. The presentation joins
the project-scoped ledger by request_id, derives identity from its requested row,
and shows one expandable operation summary with a localized execution result.
Request retirement never overrides a known execution outcome. Saved approvals
resolve their owner from that same ledger; revocation still uses the canonical
grant endpoint. Full chronological evidence and exact scopes remain expandable.

SettingsRow owns a distinct read-only value slot with a bounded label column and
a wrapping value column. Long paths never compete with labels as unshrinkable
button clusters. Settings content has a single reading column: Mission Skills
and installed Expert Squads show a list, then open the selected resource in the
same column with a Back to list action. Browsing details never activates a Squad.
Independent capability groups, usage sections and settings forms flow vertically;
the settings navigation rail and ordinary label/value rows retain their roles. Skill
library rows show the name and two-line preview; the canonical Disclosure exposes
the complete description, source and existing operations. Chat/Work show one short
project label with an expandable exact path. Native and Mission tool references
use a shared compact, wrapping text list inside Disclosure, without per-tool
cards or repeated read-only labels. Squad scope explanations remain independently
expandable. Empty usage periods show
one empty presentation; detailed composition, provider and model sections render
when the canonical call count is positive. Configured official usage sources keep
their independent presentation even when local call count is zero.
About presents product identity, a concise runtime status summary and desktop
updates first; exact server and workspace facts plus keyboard shortcuts remain
available in disclosures. Usage gives the measured Token total and selected
calendar period one dominant summary, keeps supporting metrics compact, and
preserves official Provider reconciliation as a separate compare-only section.

Release notes is a canonical CONFIG_SECTIONS entry with an About action. Its
lazy panel bundles root CHANGELOG.md through the shared util parser and uses the
existing safe Markdown renderer. It starts at the installed Overlay version;
searchable descending history and selected details use the same single-column
list-to-detail pattern. Website and GitHub links supplement the offline reading
surface rather than providing another content/cache authority.

Every dated entry in that source contains explicit zh-CN and en-US bodies.
The shared parser requires both authored languages. Details, summaries, search
content, language attributes, dates and website links follow the current UI
locale while retaining the selected version. Locale readers subscribe to the
existing locale-resource sequence so localized formatting also updates without
requiring unrelated content changes.

## Permission decision presentation

Conversation history labels completed permission decisions as approvals or
denials, including their original task/project exact scope. It reads the same
durable interaction response as before; live approval controls keep their
action labels. Continuation retirement remains separate from the original
authorization decision and never changes that history into a new request.

## Continuous-goal presentation

The shared Chat/Task/Mission conversation area and an opened SideChat expose the
current continuous-goal HTTP projection and explicit create, pause, resume, budget
and completion controls. Scope, request lifetime, conflict behavior and budget
semantics follow [continuous-goal](continuous-goal.md#user-controls). Delivery Slice
Goal controls retain their separate existing meaning. Goal-controller messages are
real orchestration participants with localized headers and preserved canonical authors.
Manual interaction and screenshot review on the formal development `/ui` surface
provide UI acceptance; API contract checks do not substitute for visual evidence.

The launcher home keeps ordinary chat starters immediately after the real
composer. Goal creation opens through the composer's + menu or the explicit
`/goal` input command, with an optional objective after the command. Main and
SideChat inputs share the command grammar and open the same owner-bound form;
the command moves its objective into the existing composer draft and does not
submit a conversation Message. The menu shows `/goal` and the localized guide
explains both entry points. The centered heading and suggested starter pills
retain the real composer as the primary action. Goal explanation, model guidance
and optional budgets remain within the original form and guide. Opening
the home form preserves the composer draft and creates no owner, Message, or
goal; confirmation invokes the existing new-conversation/goal launch flow.
Selected conversations keep the owner-bound strip above their transcript.
Completed goals use one summary row with their status, truncated original
objective and existing Details action, including narrow desktop and compact
SideChat surfaces. Details retains the complete objective, completion evidence,
usage and budgets. Other statuses retain their usage, reason and current controls.
The existing mutation confirmation notice keeps its original lifetime below the
summary; this density change introduces no persisted collapse preference.
Creation remains an explicit action, with automatic-continuation and budget
semantics shown before confirmation. The home composition scrolls as one region
so the input and starters remain reachable with a desktop dock open.

## Current diagnostic log viewer

LogViewer reads the current backend event envelope and preserves nested subject `data`, actual ambient bindings and original raw record in Details. Elapsed duration comes from `data.duration`; subject time/level/service do not change the row header. Historical non-string event time has unknown chronology and its original value remains in details/raw. Unparsed output remains the actual raw diagnostic line without a parallel plaintext interpretation. The live component owns current aggregation/copy behavior; unused duplicate utility aggregation is retired.

Loaded logs have one local literal, case-insensitive query through the shared search primitive. The existing level-qualified aggregation depends only on original sources/level; query filters those records without re-parsing them, and empty/whitespace query returns that base result. The same matching result supplies list, Copy and no-match feedback, so Copy includes all loaded matches. Query covers header/message/structured fields/raw, is retired on close and is not persisted or sent to a backend. Search explicitly covers loaded logs; server tail remains bounded to the current fetch, not full-file history. Clear search and Clear logs keep distinct semantics; source read failures remain visible.

Support ZIP exports exact retained raw files, canonical-time formatted records and original subject details. Historical timestamp/ts fields are diagnostic content rather than alternate clocks. Logging is diagnostic presentation; these records do not synthesize conversation participants or replace durable activity/occurrence timestamps.

## Archive queries

The Chat/Work, Task and Mission archive/restore endpoints use the existing
Project identity context independently of execution-model initialization.
Their original ownership, cancellation, physical settlement, closure and
retention transactions remain authoritative. Restore retains the original
stopped occurrence and paused Goal; it does not admit new execution.

Settings Archive passes its current search to the existing archived Work Ledger
reader. Search runs over the complete archive before cursor pagination; it does
not filter only the loaded rows. Query replacement and API authority changes
retire the previous request, rows and cursor through the existing request owner.
Continuation and post-mutation reload keep the current query. The shared search
field stays editable during reads and is disabled during a row mutation; clearing
it reloads the first unfiltered page. Empty results are localized separately from
an empty archive. Restore/delete and their focus ownership remain unchanged.

## Command palette queries

The command palette reads current, unarchived Chat/Task/Mission records through the
existing Work Ledger search and public cursor. An empty query shows up to nine
recent selectable items; Project rows do not consume that allowance. Nonempty
queries use bounded pages, with explicit continuation, and flatten only the
canonical Mission child Tasks. Search covers original titles, IDs, directories
and technical kinds, including each conversation's canonical Chat/Work experience.
The shared active/archive projection treats percent,
underscore and backslash literally using one escaped SQL LIKE parameter;
archive visibility and directory boundaries remain unchanged.

The shared search entry and its input describe chats, work and commands in the
current UI language. Canonical ledger results share a Chats and work heading;
empty results describe the same scope, and each row retains its original title
and actual kind. The selected conversation
header's item menu uses the same More actions label as Work Ledger item menus,
while the actual Project menu retains its Project actions identity.

Top-level selectable item membership comes from the Work Ledger response.
The palette keeps its existing parent/child relevance selection when expanding
a Mission's complete Task collection. Accepted ledger items proceed directly
to the visible command list; local action commands retain their text filter.
Conversation experience is read from the same canonical metadata used to
classify that conversation and to produce its public row.

Selectable ledger commands retain the original title and show the current UI
language's kind label beside the original Project directory basename. Chat and
Work icons and labels use the same canonical conversation-experience helpers as
the Work Ledger and Archive, so equal titles within one Project remain
distinguishable through the existing visible and accessible option description.

Each query owns its existing AbortController and captured API authority. Query
replacement, closing, reopening and authority changes retire prior responses,
errors and completion callbacks. Pagination retains accepted rows by kind:id.
Local commands remain usable while work records load or fail. Loading, empty
results and failed reads have distinct UI states; failures expose the original
diagnostic and a current-query retry beside the results.

Filtering precedes group headings and numeric shortcuts. Ctrl+1 through Ctrl+9
select those same currently listed work items. When a completed continuation or
retry removes its focused button, only that still-current operation may restore
the search input, and only if focus has fallen to the document body. It preserves
scroll position and does not override a new user focus target.

Closing the palette restores its original visible focus target through the
Dialog's close-auto-focus lifecycle, after Combobox selection has finished
focusing its own input. A newly opened palette or a command's new focus target
keeps ownership; there is no immediate competing focus write in the close action.

The shared ComboboxControl supplies Kobalte's public translation callbacks from
the existing UI locale, including candidate counts, localized numbers, selection
announcements and suggestion labels. Original option text is preserved. This
applies to the command palette and scheduled-automation timezone control without
a separate locale provider or custom announcement channel.
