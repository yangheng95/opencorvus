# Continuous goal execution intent

Continuous goal mode attaches explicit, revocable user intent to one existing Chat
Session, Task or Mission Session. It is distinct from the Delivery Slice contracts
displayed as Goals, and grants no additional capabilities or permissions.

The single implementation is src/continuous-goal. Native Chat and Mission tools and
the projected Task scheduler expose create_continuous_goal, get_continuous_goal and
update_continuous_goal directly. Creation, pause, resume and budget changes require
explicit user intent. Workers inherit context and usage scope, and report evidence
to that owner; they cannot change the parent goal.

GET/POST/PATCH /continuous-goal/:kind/:ownerID uses the same project-scoped store.
kind is chat, task or mission. ownerID is a Task ID for task and the canonical Session
ID otherwise. requestID replays one mutation; updates require goalID and expectedRevision.

## Facts and projections

protocol_event stores continuous_goal.created, continuous_goal.updated and
continuous_goal.continuation_requested on the existing owner aggregate. The latest
definition and decisions project active, paused, blocked or complete. Owner cancellation,
archive/deletion and exhausted explicit budgets project paused or budget_limited.
Completion remains an agent-authored evidence judgment; completing a Task or Mission
alone does not complete its goal.
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

tokenBudget stops admitting new automatic turns; it cannot retract accepted requests
or cap an in-flight turn's final usage. turnBudget counts accepted automatic continuation
Messages. The last admitted turn can settle after admission reaches the limit.
Unspecified budgets remain unspecified.

## Execution and recovery

The existing Scheduler supplies hints to one reconciler in normal execution and after
restart. Durable facts, rather than an in-memory queue, determine ownership. Each
continuation binds goal identity, current intent revision and settled execution frontier.
It derives exact Message/Part/control identities and commits its receipt with the real,
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
Archived/deleted owners and closed Mission occurrences are not silently reopened.
Cancellation/closure after the last explicit goal revision keeps that goal paused
even when an operator later reopens the owner. Only an explicit active revision
resumes it. The boundary uses event sequence, including same-millisecond decisions.
Session/Task archive transactions also append the same goal's paused revision with
owner-control authorship. Restoring visibility retains that pause; child Session
archives affect only goals whose exact owner is that Session.

## User controls

The home page offers Create goal beside a compact explanation and How it works.
It uses the existing project/global Conversation creation and selection authority
to create one real Chat, then opens that exact Session's existing goal form. This
one-time form request binds the original API authority and selection epoch, is
consumed on handoff and cannot follow a later selection.
No user Message is fabricated. Closing the form retains the empty Chat; submitting
uses the same continuous-goal endpoint, budgets and visible controller Messages.
Detailed steps live in the existing guide dialog rather than a permanent home tutorial.
The home explanation uses body text and a regular primary control size; compact
status-strip sizing belongs to existing conversation controls.

The common conversation surface and an opened SideChat expose one continuous-goal
control. Task binds its Task ID; Chat and Mission bind their canonical Session ID.
Every request also binds project directory, current API authority and selection lifetime.
The single HTTP projection carries its request source key; a different owner cannot
temporarily display the previous owner's goal. Visible controls refresh read-only data
every five seconds and on focus, and re-read after explicit mutations. They do not
schedule execution or maintain a second goal store.

The status strip shows objective, current state, cumulative tokens and accepted turns.
Details expose the complete objective, original reason/evidence, localized date and
budget controls. Creation allows unspecified budgets. Once set, a budget requires a
positive whole number; changes retain cumulative usage. Paused/blocked goals whose
limits are exhausted use the same Adjust & resume form as budget_limited goals.
Pausing admits no new automatic input and leaves accepted work to settle; the existing
conversation Stop operation retains its own meaning.

Completion requires the operator's evidence. A completed goal remains readable and
offers a new goal with a new identity. Form drafts survive revision conflicts; the
operator explicitly reviews the current revision before resubmitting. Owner/service
selection retires the dialog and pending UI feedback. Request IDs bind the same
submission content. Product labels, errors and number/date formatting follow the
current locale; user/model originals and technical identities retain their actual values.

## Verification

Database/process tests verify identity, state, replay and usage separately from real
Provider behavior. script/continuous-goal-check.ts requires explicit credential-use
opt-in, pairs copied auth.json with models.json, verifies the exact model and streaming
request, and exercises public HTTP routes with two automatic continuations and visible
controller Messages. Its finite hold supports manual inspection through the development
/ui page; it contains no UI automation. Actual results belong in the dated record.
