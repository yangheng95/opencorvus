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
Overlay preserves the persisted author separately from transport role. Main-channel
message headers and adjacent segments retain the exact non-human participant identity.

SessionPromptOwner observes physical execution across processes. Outstanding Task
ingress, Interaction, worker dispatch settlement and scheduled wait facts keep their
current authority. Goal mode cannot bypass them. Chat uses SessionWake. Mission also
uses its exact opened execution admission. Task uses the original root Message, ingress
and first-in-first-out pipeline. A current active goal receipt adds narrowly scoped
authority to reopen a completed/failed Task at epoch+1. Cancelled Tasks still require
an explicit operator Message; ordinary scheduler input retains its original permission.

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

## Verification

Database/process tests verify identity, state, replay and usage separately from real
Provider behavior. script/continuous-goal-check.ts requires explicit credential-use
opt-in, pairs copied auth.json with models.json, verifies the exact model and streaming
request, and exercises public HTTP routes with two automatic continuations and visible
controller Messages. Its finite hold supports manual inspection through the development
/ui page; it contains no UI automation. Actual results belong in the dated record.
