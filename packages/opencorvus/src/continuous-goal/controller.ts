import { Database, and, desc, eq, sql } from "@/storage/db"
import { MessageTable } from "@/session/session.sql"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionWake } from "@/session/wake"
import { Message } from "@/session/message"
import { Identifier } from "@/id/id"
import { Scheduler } from "@/scheduler"
import { Log } from "@/util/log"
import { MissingModelConfigError } from "@/config/model-resolution-error"
import { Provider } from "@/provider/provider"
import {
  runWithIndependentProjectIdentity,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { pendingInteractionCounts, listAllMissionTasks } from "@/engine/store"
import { taskRootIngressDebugProjection } from "@/engine/task-root-ingress-delivery"
import { taskRootIngressReleasesHeadOfLine } from "@/engine/task-root-ingress-reducer"
import {
  assertTaskDispatchesSettledInTransaction,
  TaskDispatchSettlementPendingError,
} from "@/engine/dispatch-settlement"
import { listCurrentTaskWaits } from "@/engine/task-wait"
import { admitMissionExecutionWake } from "@/mission/execution-closure"
import {
  readContinuousGoal,
  resolveGoalOwner,
  goalScopeSessionIDs,
  latestGoalContinuation,
  planGoalContinuation,
  requestGoalContinuation,
  projectGoalOwners,
  updateContinuousGoal,
  type GoalOwner,
  type GoalContinuation,
} from "./store"
import { ContinuousGoalError, goalError, type ContinuousGoalOwner, type ContinuousGoalView } from "./schema"

const log = Log.create({ service: "continuous-goal" })

export function goalContinuationIdentity(request: GoalContinuation) {
  return {
    messageID: Identifier.deterministic("message", request.id),
    textPartID: Identifier.deterministic("part", request.id),
    controlID: Identifier.deterministic("session_control", request.id),
  }
}

function latestUser(sessionID: string) {
  const row = Database.use((db) =>
    db
      .select()
      .from(MessageTable)
      .where(and(eq(MessageTable.session_id, sessionID), sql`json_extract(${MessageTable.data}, '$.role')='user'`))
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .get(),
  )
  return row ? { ...row, data: Message.User.parse({ ...row.data, id: row.id, sessionID: row.session_id }) } : undefined
}

/** Ready frontiers are facts, never process-local spinner state. */
export function goalContinuationFrontier(owner: GoalOwner): string | undefined {
  if (goalScopeSessionIDs(owner).some((id) => SessionPromptOwner.activeExecution(id))) return undefined
  if (owner.kind === "task") {
    if ((pendingInteractionCounts([owner.id]).get(owner.id) ?? 0) > 0) return undefined
    if (listCurrentTaskWaits({ taskID: owner.id, limit: 1 }).length) return undefined
    try {
      Database.use((db) => assertTaskDispatchesSettledInTransaction(db, owner.id))
    } catch (error) {
      if (error instanceof TaskDispatchSettlementPendingError) return undefined
      throw error
    }
    const lifecycle = taskLifecycleProjection(owner.id)
    if (lifecycle.status === "cancelled" || lifecycle.status === "cancelling") return undefined
    const inputs = taskRootIngressDebugProjection(owner.id).filter((entry) => entry.executionEpoch === lifecycle.epoch)
    if (inputs.some((entry) => !taskRootIngressReleasesHeadOfLine(entry.projection))) return undefined
    // Infrastructure failures need their existing recovery or an operator; a goal is not a retry bypass.
    if (
      inputs.some((entry) =>
        ["host_fault", "exhausted", "operator_abandoned", "input_rejected"].includes(entry.projection.state),
      )
    )
      return undefined
    return [lifecycle.openedEventID, lifecycle.terminalEventID ?? "active", inputs.at(-1)?.ingressID ?? "start"].join(
      ":",
    )
  }
  if (owner.kind === "mission") {
    const tasks = listAllMissionTasks({
      projectID: owner.projectID,
      missionID: owner.missionID!,
      sessionID: owner.sessionID,
    })
    if (tasks.some((task) => taskLifecycleProjection(task.id).status === "active")) return undefined
    if ([...pendingInteractionCounts(tasks.map((task) => task.id)).values()].some((count) => count > 0))
      return undefined
  }
  const user = latestUser(owner.sessionID)
  if (!user) return "start"
  const assistant = Database.use((db) =>
    db
      .select()
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, owner.sessionID),
          sql`json_extract(${MessageTable.data}, '$.role')='assistant'`,
          sql`(json_extract(${MessageTable.data}, '$.parentID')=${user.id} OR EXISTS
      (SELECT 1 FROM json_each(${MessageTable.data}, '$.acceptedInputMessageIDs') WHERE value=${user.id}))`,
          sql`json_extract(${MessageTable.data}, '$.time.completed') IS NOT NULL`,
          sql`json_extract(${MessageTable.data}, '$.summary') IS NOT 1`,
        ),
      )
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .get(),
  )
  if (!assistant) return undefined
  const info = Message.Assistant.parse({ ...assistant.data, id: assistant.id, sessionID: assistant.session_id })
  // A cooperative wait/permission control belongs to the original scheduler.
  if (info.finish !== "stop" || info.error) return undefined
  return assistant.id
}

export function admitGoalContinuation(owner: GoalOwner, goal: ContinuousGoalView, request: GoalContinuation) {
  if (goalContinuationFrontier(owner) !== request.frontier)
    return goalError("revision_conflict", "The execution frontier changed before goal continuation.")
  const accepted = requestGoalContinuation(owner, goal, request.frontier)
  if (accepted.id !== request.id) return goalError("conflict", "Goal continuation identity changed.")
}

function goalPrompt(goal: ContinuousGoalView, request: GoalContinuation) {
  return [
    "Continuous goal controller — automatic continuation " + request.number + ".",
    "The user authorized this ongoing objective: " + goal.objective,
    "Goal: " + goal.id + "; prior settled frontier: " + request.frontier + ".",
    "Continue from the actual accumulated evidence. Preserve the original permissions and constraints.",
    "If the objective is achieved, record complete with evidence through update_continuous_goal and settle the normal owner contract.",
    "If an external blocker prevents further progress, record blocked with the exact unmet work.",
    "Recorded tokens: " + goal.tokensUsed + "; token budget: " + (goal.tokenBudget ?? "unspecified") + ".",
    "This message is authored by the goal controller, not a new user instruction.",
  ].join("\n")
}

async function deliverConversation(
  owner: GoalOwner,
  goal: ContinuousGoalView,
  request: GoalContinuation,
  signal?: AbortSignal,
) {
  const identity = goalContinuationIdentity(request)
  const user = latestUser(owner.sessionID)
  const agent = user?.data.role === "user" ? user.data.agent : owner.kind === "mission" ? "mission" : "chat"
  const model = user?.data.role === "user" ? user.data.model : undefined
  const existing = Database.use((db) =>
    db.select().from(MessageTable).where(eq(MessageTable.id, identity.messageID)).get(),
  )
  const activate = async (admission?: Parameters<Parameters<typeof admitMissionExecutionWake>[0]["wake"]>[0]) => {
    if (existing) {
      if (existing.session_id !== owner.sessionID) return goalError("conflict", "Goal wake belongs to another Session.")
      const receipt = SessionWake.resumePersistedWakeWithReceipt({
        sessionID: owner.sessionID,
        messageID: identity.messageID,
        directory: owner.directory,
        signal,
        ownerPreflight: admission?.ownerPreflight,
        ownerLifecycle: admission?.ownerLifecycle,
      })
      await receipt.activation
      return receipt
    }
    return SessionWake.wakeWithReceipt({
      ...identity,
      sessionID: owner.sessionID,
      author: "goal-controller",
      agent,
      model,
      signal,
      prompt: goalPrompt(goal, request),
      reason: { source: "continuous_goal", goalID: goal.id, revision: request.revision, requestID: request.id },
      ...(owner.kind === "mission" ? { surface: "panel" as const } : {}),
      preflightBundle: (db, ...args) => {
        admission?.preflightBundle(db, ...args)
        admitGoalContinuation(owner, goal, request)
      },
      commitBundle: (db, ...args) => {
        admission?.commitBundle(db, ...args)
      },
      ownerPreflight: admission?.ownerPreflight,
      ownerLifecycle: admission?.ownerLifecycle,
    })
  }
  const receipt =
    owner.kind === "mission"
      ? await admitMissionExecutionWake({ missionID: owner.missionID!, sessionID: owner.sessionID, wake: activate })
      : await activate()
  await receipt.activation
  return identity.messageID
}

type GoalModelBlockReason = "model_not_configured" | "model_unavailable"

function modelBlockReason(error: unknown): GoalModelBlockReason | undefined {
  if (MissingModelConfigError.isInstance(error) && error.data.agent) return "model_not_configured"
  if (Provider.ModelNotFoundError.isInstance(error)) return "model_unavailable"
}

function recordModelBlock(owner: GoalOwner, goal: ContinuousGoalView, reason: GoalModelBlockReason, error: unknown) {
  const outcome = Database.immediateTransaction(() => {
    const current = readContinuousGoal(owner)
    // Domain cancellation can pause the projection without a new Goal intent.
    if (current?.id === goal.id && current.revision === goal.revision && current.status === "paused") return "paused"
    updateContinuousGoal(owner, {
      requestID: `${goal.id}:${goal.revision}:${reason}`,
      goalID: goal.id,
      expectedRevision: goal.revision,
      status: "blocked",
      reason,
    }, "goal-controller")
    return "blocked"
  })
  if (outcome === "blocked")
    log.error("goal blocked by model admission", { owner, goalID: goal.id, revision: goal.revision, reason, error: String(error) })
  return outcome
}

/** One normal and restart path. Its result is diagnostic, not a persisted queue state. */
export async function reconcileContinuousGoal(owner: GoalOwner, signal?: AbortSignal): Promise<string> {
  const goal = readContinuousGoal(owner)
  if (!goal) return "absent"
  try {
    return await reconcileGoal(owner, goal, signal)
  } catch (error) {
    signal?.throwIfAborted()
    const reason = modelBlockReason(error)
    if (!reason) throw error
    // Model admission failed on the original execution path. Record that real
    // blocker on the same intent revision, before asking the operator to resume.
    // A concurrent user decision or owner boundary retains its existing fence.
    return recordModelBlock(owner, goal, reason, error)
  }
}

type GoalReconciliationPlan =
  | { outcome: string; request?: never }
  | {
      outcome: "accepted" | "recovered"
      request: GoalContinuation
    }

/** A read-only hint. Delivery always plans again under the initialized owner. */
async function planGoalReconciliation(owner: GoalOwner, goal: ContinuousGoalView): Promise<GoalReconciliationPlan> {
  if (goal.status === "complete" || goal.status === "paused" || goal.status === "blocked")
    return { outcome: goal.status }
  const previous = latestGoalContinuation(owner)
  if (previous) {
    const identity = goalContinuationIdentity(previous)
    const accepted = Database.use((db) =>
      db.select().from(MessageTable).where(eq(MessageTable.id, identity.messageID)).get(),
    )
    if (accepted && latestUser(owner.sessionID)?.id === identity.messageID && !goalContinuationFrontier(owner)) {
      if (goalScopeSessionIDs(owner).some((id) => SessionPromptOwner.activeExecution(id))) return { outcome: "running" }
      if (owner.kind !== "task") {
        // Re-enter only an unanswered accepted wake. A completed wait/error belongs to its original recovery contract.
        const { completedReplyToUserMessage } = await import("@/session/completed-reply")
        if (await completedReplyToUserMessage(owner.sessionID, identity.messageID, true))
          return { outcome: "settled_control" }
      }
      return { outcome: "recovered", request: previous }
    }
  }
  if (goal.status !== "active") return { outcome: goal.status }
  const frontier = goalContinuationFrontier(owner)
  if (!frontier) return { outcome: "waiting" }
  if (previous?.revision === goal.revision && previous.frontier === frontier) return { outcome: "accepted" }
  return { outcome: "accepted", request: planGoalContinuation(goal, frontier) }
}

async function reconcileGoal(owner: GoalOwner, goal: ContinuousGoalView, signal?: AbortSignal): Promise<string> {
  const plan = await planGoalReconciliation(owner, goal)
  if (!plan.request) return plan.outcome
  const request = plan.request
  if (owner.kind === "task") {
    const { EngineService } = await import("@/task-api")
    await EngineService.deliverContinuousGoalMessage({ owner, goal, request, text: goalPrompt(goal, request) })
  } else {
    await deliverConversation(owner, goal, request, signal)
  }
  return plan.outcome
}

type GoalExecutionCandidate = { owner: GoalOwner; goal: ContinuousGoalView }

async function projectGoalExecutionPlans(): Promise<GoalExecutionCandidate[]> {
  const candidates = await Promise.all(
    projectGoalOwners().map(async (candidate) => {
      try {
        const owner = resolveGoalOwner(candidate)
        const goal = readContinuousGoal(owner)
        return goal && (await planGoalReconciliation(owner, goal)).request ? { owner, goal } : undefined
      } catch (error) {
        if (!ContinuousGoalError.isInstance(error as Error))
          log.error("goal reconciliation failed", { owner: candidate, error: String(error) })
        return undefined
      }
    }),
  )
  return candidates.filter((candidate): candidate is GoalExecutionCandidate => candidate !== undefined)
}

/** Exact owner hints from the same plan used at execution; no queue or stored plan. */
export async function projectGoalExecutionCandidates(): Promise<ContinuousGoalOwner[]> {
  return (await projectGoalExecutionPlans()).map(({ owner }) => ({ kind: owner.kind, id: owner.id }))
}

async function reconcileProjectGoals(directory: string, signal: AbortSignal) {
  const candidates = await runWithIndependentProjectIdentity({ directory, fn: projectGoalExecutionPlans })
  if (candidates.length === 0) return
  signal.throwIfAborted()
  try {
    await runWithInitializedIndependentProject({
      directory,
      signal,
      fn: async () => {
        await Promise.allSettled(candidates.map(async ({ owner }) => {
          try {
            await reconcileContinuousGoal(resolveGoalOwner(owner), signal)
          } catch (error) {
            if (ContinuousGoalError.isInstance(error as Error)) return
            log.error("goal reconciliation failed", { owner, error: String(error) })
          }
        }))
      },
    })
  } catch (error) {
    signal.throwIfAborted()
    const reason = modelBlockReason(error)
    if (!reason) throw error
    await runWithIndependentProjectIdentity({ directory, fn: () => {
      for (const { owner, goal } of candidates) {
        try {
          recordModelBlock(owner, goal, reason, error)
        } catch (conflict) {
          if (!ContinuousGoalError.isInstance(conflict as Error)) throw conflict
        }
      }
    } })
  }
}

export function initializeContinuousGoals() {
  Scheduler.register({
    id: "continuous-goal.reconcile",
    interval: 1_000,
    runAtStart: false,
    async run(signal) {
      const rows = Database.use((db) =>
        db.all<{ directory: string }>(sql`
        SELECT DISTINCT s.directory FROM protocol_event e JOIN session s ON
          (e.aggregate_type='session' AND e.aggregate_id=s.id) OR
          (e.aggregate_type='task' AND e.session_id=s.id)
        WHERE e.type='continuous_goal.created' AND s.time_archived IS NULL
          AND NOT EXISTS (SELECT 1 FROM protocol_event newer
            WHERE newer.aggregate_type=e.aggregate_type AND newer.aggregate_id=e.aggregate_id
              AND newer.type='continuous_goal.created' AND newer.seq>e.seq)
          AND coalesce((SELECT json_extract(decision.payload,'$.input.status') FROM protocol_event decision
            WHERE decision.type='continuous_goal.updated' AND json_extract(decision.payload,'$.goal_id')=e.id
            ORDER BY decision.seq DESC LIMIT 1),'active')='active'
      `),
      )
      await Promise.allSettled(
        rows.map(async ({ directory }) => {
          try {
            await reconcileProjectGoals(directory, signal)
          } catch (error) {
            if (signal.aborted && error === signal.reason) return
            log.error("goal project reconciliation failed", { directory, error: String(error) })
          }
        }),
      )
    },
  })
}
