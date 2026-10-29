# Continuous goal execution intent

Continuous goal mode attaches explicit, revocable user intent to one existing Chat
Session, Task or Mission Session. It is distinct from the Delivery Slice contracts
displayed as Deliverables, and grants no additional capabilities or permissions.

The single implementation is src/continuous-goal. Native Chat and Mission tools and
the projected Task scheduler expose create_continuous_goal, get_continuous_goal and
update_continuous_goal directly. Creation, pause, resume and budget changes require
explicit user intent. Workers inherit context and usage scope, and report evidence
to that owner; they cannot change the parent goal.

GET/POST/PATCH /continuous-goal/:kind/:ownerID uses the same project-scoped store.
kind is chat, task or mission. ownerID is a Task ID for task and the canonical Session
ID otherwise. requestID replays one mutation; updates require goalID and expectedRevision.

All three methods use the shared Project identity context, like persisted
conversation reads. Stored objective, status and usage remain readable and
explicit user decisions remain writable when the selected model is unavailable.
Owner membership, deletion and archive validation still apply. Actual
continuation admission initializes its full independent execution runtime.

Owner, request and revision conflicts return HTTP 409 with the named
`ContinuousGoalError` body and its domain `data.code`. All three operation responses
declare that same name in OpenAPI and the generated SDK; human descriptions are
response documentation, not alternate error identities.

## Facts and projections

protocol_event stores continuous_goal.created, continuous_goal.updated and
continuous_goal.continuation_requested on the existing owner aggregate. The latest
definition and decisions project active, paused, blocked or complete. Owner cancellation,
archive/deletion and exhausted explicit budgets project paused or budget_limited.
Completion records an evidence judgment by the owner agent or an explicit operator
action; completing a Task or Mission alone does not complete its goal.
The existing reason string carries stable system identifiers or original free text.
UI controls write user_paused, user_resumed, budget_updated or
budget_updated_and_resumed, and render these through the current locale alongside
the existing owner, budget and model reasons. Ordinary paused/blocked budget saves
retain the prior reason. Completion evidence and unclassified historical free text
retain their original content; locale changes do not mutate durable decisions.
For a complete goal, reason is always completion evidence and is displayed verbatim,
even when its text exactly matches a known system reason identifier. Reason-code
localization applies to unfinished status explanations, not completed evidence.
Explicit paused/blocked intent takes precedence over exhausted budgets; budget_limited
is derived only for active intent. Resuming preserves all usage and rechecks the limit.

At most one unresolved goal owns any overlapping Session/Task/Mission scope.
Archived owners retain that scope and inherited usage association while paused;
creation and explicit active updates recheck exclusivity in the same transaction.
Owner deletion follows the existing Session/Task deletion facts, including retained
history rows. A retained row alone does not authorize execution or public goal access.
Objective and identity are immutable; updates preserve accumulated usage and accepted
continuation count. A completed goal permits a new goal identity.

Every streamed Session Provider request captures its goal at request start. UsageLedger
inserts the original provider_usage_event and a continuous_goal.usage association in one
transaction. The association references the exact usage ID on a stream aggregate
identified by goal ID; it contains no copied token totals. Late settlement stays with
that original goal after completion, a newer goal or owner retention. The request that
creates a goal has already started and is not retroactively billed. Tokens include input,
output, reasoning and cache according to the existing Provider normalization.

The shared Goal details show this request-start attribution scope beside the
cumulative total, using the same localized explanation as the header usage
tooltip. A completed Goal's total may differ from its conversation turn when
another Provider request starts after completion. The UI reads the existing
usage association and does not reassign or infer usage from message timestamps.
Completed Goal details initially collapse their read-only budget section so the
next-goal action stays visible. Operators can expand the existing values, and
returning from the guide preserves that explicit choice. Unfinished details and
the creation draft retain their existing budget disclosure rules.

tokenBudget stops admitting new automatic turns; it cannot retract accepted requests
or cap an in-flight turn's final usage. turnBudget counts accepted automatic continuation
Messages. The last admitted turn can settle after admission reaches the limit.
Unspecified budgets remain unspecified.

## Execution and recovery

The existing Scheduler supplies hints to one reconciler in normal execution and after
restart. Durable facts, rather than an in-memory queue, determine ownership. Each
continuation binds goal identity, current intent revision and settled execution frontier.
The global scan first projects execution candidates under independent Project identity,
using the same read-only reconciliation plan as delivery. It releases that identity
lease before initializing runtime capabilities, and initializes only directories with
an actionable new or previously accepted continuation. Budget-limited goals still
qualify for recovery of unanswered accepted input. Delivery resolves and plans again
under the initialized Project; the hint carries no execution or mutation authority.
Each continuation derives exact Message/Part/control identities and commits its receipt with the real,
visible goal-controller Message. That participant never impersonates a human.
Overlay preserves the persisted author separately from transport role. The shared
conversation display projection presents goal-controller inputs as independent
participants in both main and native Chat/Mission channels. Localized headers retain
the exact author identity and original message body; SideChat follows the same projection.

SessionPromptOwner observes physical execution across processes. Outstanding Task
ingress, Interaction, worker dispatch settlement and scheduled wait facts keep their
current authority. Goal mode cannot bypass them. Chat uses SessionWake. Mission also
uses its exact opened execution admission. Task uses the original root Message, ingress
and first-in-first-out pipeline. A current active goal receipt adds narrowly scoped
authority to reopen a completed/failed Task at epoch+1. Cancelled Tasks still require
an explicit operator Message; ordinary scheduler input retains its original permission.

An unanswered accepted Mission goal wake can resume its original Message through
SessionWake under the same opened occurrence. The existing Mission process-recovery
driver can instead claim a dead Prompt generation and persist its own visible recovery
Message, binding that opened event, generation and interrupted assistant frontier.
Both triggers share the durable SessionPromptOwner authority; exact dead-generation
release and recovery admission fences prevent a stale claimant from replacing a live
successor. Recovery evidence follows whichever persisted input acquired the new owner.
Recovery preserves the original goal identity and accepted continuation receipt;
replaying that input does not increment the accepted-turn count. A runtime recovery
Message is not an extra goal continuation. A later, independently eligible execution
frontier may admit another goal-controller continuation through the same authoritative
counter and budget checks, including after a Mission child Task completes.

The Mission recovery deadline bounds reconciliation and physical Prompt admission.
After activation, the existing execution activity policy governs the model reply;
the recovery admission timer cannot cancel an active reply. Caller cancellation and
loss of the exact recovery lease remain connected until completion. SessionWake
preserves a typed caller cancellation origin, identifies an untyped caller abort as
runtime Prompt-owner cancellation, and reserves process-shutdown attribution for
runtime settlement cancellation. A later crash may replay the same actionable
runtime recovery Message with its immutable original reason while terminalizing the
newly interrupted frontier under a new physical Prompt generation.

Pause stops new automatic Message admission. Already committed input may settle through
its normal owner; uncommitted candidates must revalidate current intent and frontier.
Goal state does not discard requested external effects or replace Task/Mission completion.
When the original model resolver rejects admission with an agent-bound
MissingModelConfigError, the same reconciler records a blocked revision authored
by goal-controller with reason model_not_configured. The existing request replay
and expected-revision transaction coalesces identical failures and preserves a
concurrent operator decision. Structural lineage errors and unrelated failures
retain their original error paths. This configuration blocker does not create a
Message, count a turn, choose a model or retry through another execution path.
After configuring the model, the operator explicitly resumes the same goal;
original usage and accepted input identities remain intact.
An unavailable configured model uses the same blocker writer with reason
`model_unavailable`. Project-initialization failures are observed before the
delivery callback can run, so the read-only plan retains its exact owner and
Goal revision for that attempt. The initialized execution path still replans
under its real authority. If initialization reports the typed model failure,
an independent identity context records the blocker only for those original
revisions; a newer operator decision or owner boundary keeps its own facts.
The blocker transaction also retains a same-revision paused projection from a
domain cancellation or Mission close/reopen, whose event order is independent
of Goal intent revision. A delayed model failure cannot consume that boundary.
Each Project handles its own candidates, and cancellation retains its original
authority. The public candidate diagnostic remains an owner-only projection of
this single plan. Blocked goals wait for explicit resume rather than repeatedly
initializing an unavailable model.
Archived/deleted owners and closed Mission occurrences are not silently reopened.
Cancellation/closure after the last explicit goal revision keeps that goal paused
even when an operator later reopens the owner. Only an explicit active revision
resumes it. The boundary uses event sequence, including same-millisecond decisions.
Session/Task archive transactions also append the same goal's paused revision with
owner-control authorship. Restoring visibility retains that pause; child Session
archives affect only goals whose exact owner is that Session.

## User controls

Goal reads and explicit intent mutations use the existing Project identity
context. Recording a pause, budget or completion decision does not require an
available Provider or a valid execution model. Owner, Project, revision,
idempotency and domain-boundary checks still run in the canonical Goal store.
The controller initializes the full independent Project runtime before actual
continuation admission; durable user intent is separate from model execution.

The home page places the heading, existing composer and suggested conversation
starters together. Its localized subtitle explains the + menu and `/goal` entry
for work across turns, using the current localized goal action label. The
composer's + menu offers Continuous goal and opens the
same goal form in Home, Chat, Task and Mission. SideChat's own composer + menu
opens that form for its independent Session. The explicit `/goal` input command
in either composer opens the same form or current goal details. An optional
objective after the command replaces only the command invocation in that
composer's existing draft; quotation and attachment context retains its original
authority. The ordinary-message path and `/side` context restrictions remain
unchanged. Opening a command performs no goal mutation or Message submission.
No goal creation section or empty
goal strip occupies the conversation surface. Existing goals retain their status
and details controls. Noncomplete goals also retain inline usage, applicable
pause/resume actions and reasons. Completed goals keep a single summary row;
their full objective, completion evidence, usage and budgets remain in Details.
The existing mutation confirmation notice retains its original lifetime. This
presentation does not change Goal projection or control semantics.
The introduction names the same localized
menu action. The creation guide and form footer resolve the same localized start
action for Home and existing conversation owners. Task scope tools, tabs and Environment progress use Deliverables for
Delivery Slice contracts; their panel explains where to find continuous execution
controls without creating another goal entry or mutation path.
It opens the existing goal form before creating a Conversation. The Home form
binds the original API authority, selection epoch and composer draft scope;
closing it retains the Home and its draft. Objective and budget fields remain in
the same unsubmitted form when it is reopened, including after How it works.
The form's existing field signals own that draft; its source snapshot binds API
revision, selection epoch, owner, composer key and initial text. A changed scope
or composer text initializes a new draft, and successful creation retires it.
No modal edits are written back into the composer. Explicit form confirmation uses the
existing project/global Conversation creation and selection authority to create
one real Chat. The one-time form request then carries the confirmed input and
the same requestID to that exact Session's existing goal mutation. The handoff
binds its API authority and new selection epoch, is consumed once and cannot
follow a later selection. A submitted creation failure retains any real Chat
already committed; cancellation never needs a compensating deletion.
No user Message is fabricated. Submission uses the same continuous-goal endpoint,
budgets and visible controller Messages; existing-owner and SideChat controls
retain their current mutation path. Help in that dialog opens its introduction mode.
The introduction provides an explicit return to its originating form mode.
This view change preserves the existing field signals, budget disclosure, resume
choice, completion evidence and captured revision/request attempt. It does not
reload saved values or acquire a new Home launch authority. Returning restores
the existing mode-specific focus target; owner, service or selection retirement
also retires this local return intent. Closing the introduction still closes the
dialog, independently of returning to the same unsubmitted form.
Starting from the composer moves its text and quotation through one write to the
existing draft store, after creation authority is rechecked and before selecting
the newly published Session. That creation preserves staged attachments; ordinary
history selection retains its existing cleanup. The form reads the exact supplied
composer key, including SideChat's own key, and cancellation preserves the draft.
Successful creation consumes only unchanged plain text without pending quotation
or attachments. Pending context stays in the message input and is explained in the
current interface language; creating a goal does not send that context as a Message.
Detailed steps live in the existing guide dialog rather than a permanent home tutorial.
The guide explains provider/model preparation, confirmation before a Home
conversation exists, inherited permissions, immutable objectives and explicit
resume after resolving a displayed blocker. Known model-configuration reasons
use the current interface language and the actual localized Resume label.
Its first step identifies the model menu below the Home message input and that
menu's Configure Provider action for an empty connected-model list. Configured
defaults may still be inherited; this guidance adds no model-selection policy.
The form opens only after an explicit menu or input-command request. That request waits for the
initial owner projection before choosing creation or existing-goal details, and
does not carry a goal value or mutation authority across a selection.
The creation dialog uses a bounded 560px width, one concise execution explanation
and the original objective field. Optional budgets use the shared native Disclosure;
its summary states No limit or Custom limits. Existing draft values reopen expanded,
and invalid budget fields reveal themselves. Detailed cost, pause and immutable
objective guidance stays in that section and the existing guide. No disclosure
changes the single form draft, unlimited default or execution contract.

Creating a Chat or Mission goal names a still-default conversation from the
structured objective, using the existing first-line title derivation in the
same transaction as the goal fact. Task titles and custom conversation names
retain their own authority. Replaying the creation request does not rename a
conversation again. The controller's technical Message remains complete and
visible; its transport role does not make it a human-authored naming input.

The common conversation surface and an opened SideChat each own one continuous-goal
projection and form. Task binds its Task ID; Chat and Mission bind their canonical Session ID.
Every request also binds project directory, current API authority and selection lifetime.
The single HTTP projection carries its request source key; a different owner cannot
temporarily display the previous owner's goal. Visible conversation containers refresh read-only data
every five seconds and on focus, and re-read after explicit mutations. They do not
schedule execution or maintain a second goal store.

The existing selected-owner and independent SideChat streams also invalidate that
same HTTP projection on connection snapshots, completed assistant Messages and
terminal execution notices. Task streams additionally forward their existing goal
decision and Task terminal notifications. Invalidation carries only the exact owner,
project-directory identity and API authority; no Goal value is copied from an event
or inferred from tool output. The control coalesces same-microtask notices and keeps
its existing visibility, busy and selection-lifetime checks. While the current
resource is loading or a mutation is busy, background invalidations retain one
pending refresh in that same source lifetime. They re-read after the current work
settles, allowing the first snapshot to become ready instead of replacing it on
every timer tick. Source retirement disposes this pending intent. Explicit mutation
reads keep their existing post-commit behavior. Periodic observation
still handles durable changes without an execution notice, including changes from
another process. Native Session streams do not acquire an undeclared Goal protocol.

The status strip shows objective, current state, cumulative tokens and accepted turns.
Details expose the complete objective, original reason/evidence, localized date and
budget controls. Creation allows unspecified budgets. Once set, a budget requires a
positive whole number; changes retain cumulative usage. Paused/blocked goals whose
limits are exhausted use the same Adjust & resume form as budget_limited goals.
Adjust & resume selects resumption explicitly. Opening Details instead also lets an
operator save a budget-limited goal as paused using Save without resuming; the
existing Resume after saving choice controls this intent. Editing a paused goal
retains its state and accumulated usage unless resumption is explicitly selected.
Pausing admits no new automatic input and leaves accepted work to settle; the existing
conversation Stop operation retains its own meaning.

The shared dialog also identifies the selected owner by the existing conversation
title or the SideChat selector's localized name, alongside its scope description.
Long names wrap inside the dialog. This is presentation from the current owner;
it does not become request identity, a source key or a second persisted title.
Home creation retains its explicit new-conversation scope until an owner exists.

Completion requires the operator's evidence. A completed goal remains readable and
offers a new goal with a new identity. Form drafts survive revision conflicts; the
operator explicitly reviews the current revision before resubmitting. Owner/service
selection retires the dialog and pending UI feedback. Request IDs bind the same
submission content. Product labels, errors and number/date formatting follow the
current locale; user/model originals and technical identities retain their actual values.
The creation form owns one transient draft of its objective, budgets and budget
disclosure state. Reading a completed goal's details or its guide preserves that
draft, so reopening through Details or the composer restores the same values.
Saved goal details read their existing projection; editing their budgets owns
separate values. Creation scope includes the current goal identity and original
composer text alongside the existing authority, selection and owner scope. A new
scope initializes from its own composer, and successful creation retires its draft.
Objective, budget and completion-evidence fields retain native constraint validation.
Their invalid events report the existing localized goal error, and editing clears
the custom validity and the prior local submission summary before updating the
field value. Server failures retain their original disclosure. Native focus, required and
numeric constraints still precede the unchanged application and service checks.

The goal dialog keeps its header and action footer inside the existing bounded
frame while its form or introduction owns body scrolling. Expanded diagnostics
remain complete inside that body. A revision-conflict review displays the latest
saved limits from the same HTTP projection alongside the retained form draft;
reviewing the revision does not silently replace the draft's budget values.

In-place Goal dialog view changes preserve keyboard context. After the current
render commits, the next view's explicit Objective, completion evidence, saved
Objective or Close control receives focus only while the same mode, API authority,
selection and source still own the dialog and its old control or BODY still owns
focus. A newer focus owner is respected. The existing Dialog retains initial and
close autofocus; this handoff adds no global target search or retry.

## Verification

Database/process tests verify identity, state, replay and usage separately from real
Provider behavior. script/continuous-goal-check.ts requires explicit credential-use
opt-in, pairs copied auth.json with models.json, verifies the exact model and streaming
request, and exercises public HTTP routes with two automatic continuations and visible
controller Messages. Its finite hold supports manual inspection through the development
/ui page; it contains no UI automation. Actual results belong in the dated record.
