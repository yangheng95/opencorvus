import { isDeepStrictEqual } from "node:util"
import { Database, and, asc, eq, inArray, sql } from "@/storage/db"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { setSessionTitleFromGoalInTransaction } from "@/session/first-message-title"
import { SessionTable } from "@/session/session.sql"
import { EngineTaskTable } from "@/engine/engine.sql"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { listAllMissionTasks, taskDeletedInTransaction } from "@/engine/store"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Identifier } from "@/id/id"
import { currentMissionExecutionClosureInTransaction } from "@/mission/execution-closure"
import {
  ContinuousGoalCreate,
  ContinuousGoalUpdate,
  ContinuousGoalOwner,
  ContinuousGoalView,
  ContinuousGoalError,
  goalError,
} from "./schema"
import type z from "zod"

type Event = typeof ProtocolEventTable.$inferSelect
export type GoalOwner = ContinuousGoalOwner & {
  sessionID: string
  projectID: string
  directory: string
  missionID?: string
}
const CREATED = "continuous_goal.created"
const UPDATED = "continuous_goal.updated"
export const GOAL_CONTINUATION = "continuous_goal.continuation_requested"

export function resolveGoalOwner(raw: ContinuousGoalOwner, options?: { includeArchived?: boolean }): GoalOwner {
  const input = ContinuousGoalOwner.parse({ kind: raw.kind, id: raw.id })
  return Database.use((db) => {
    const task =
      input.kind === "task"
        ? db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.id)).get()
        : undefined
    if (
      input.kind === "task" &&
      (!task || task.project_id !== Instance.project.id || taskDeletedInTransaction(db, input.id))
    )
      return goalError("owner_unavailable", "Continuous goal Task is unavailable in the current Project.")
    const sessionID = task?.session_id ?? input.id
    const session = db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get()
    if (
      !session ||
      session.project_id !== Instance.project.id ||
      Session.deletedInTransaction(db, sessionID) ||
      (!options?.includeArchived && session.time_archived !== null)
    )
      return goalError("owner_unavailable", "Continuous goal Session is unavailable in the current Project.")
    if (!options?.includeArchived && task?.time_archived != null)
      return goalError("owner_unavailable", "Archived Task cannot own an active continuous goal.")
    if (input.kind === "chat" && (session.kind !== "assistant" || session.parent_id || taskIDForSession(session.id)))
      return goalError("owner_forbidden", "A Chat continuous goal belongs to its standalone primary Session.")
    const mission = session.metadata?.mission as { id?: string } | undefined
    if (input.kind === "mission" && (session.kind !== "mission" || !mission?.id))
      return goalError("owner_forbidden", "A Mission continuous goal belongs to its canonical Mission Session.")
    return {
      ...input,
      sessionID: session.id,
      projectID: session.project_id,
      directory: session.directory,
      ...(input.kind === "mission" ? { missionID: mission!.id! } : {}),
    }
  })
}

export function goalOwnerForAgent(sessionID: string): GoalOwner {
  const session = Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get())
  if (
    !session ||
    session.project_id !== Instance.project.id ||
    Database.use((db) => Session.deletedInTransaction(db, sessionID))
  )
    return goalError("owner_unavailable", "Goal Tool Session is unavailable in the current Project.")
  const taskID = taskIDForSession(sessionID)
  if (taskID) {
    if (session.kind !== "orchestrator")
      return goalError("owner_forbidden", "Only the Task owner may change its continuous goal.")
    return resolveGoalOwner({ kind: "task", id: taskID })
  }
  return resolveGoalOwner({ kind: session.kind === "mission" ? "mission" : "chat", id: sessionID })
}

export function goalScopeSessionIDs(owner: GoalOwner): string[] {
  const roots = [owner.sessionID]
  if (owner.kind === "mission") {
    roots.push(
      ...listAllMissionTasks({
        projectID: owner.projectID,
        missionID: owner.missionID!,
        sessionID: owner.sessionID,
      }).flatMap((task) => (task.session_id ? [task.session_id] : [])),
    )
  }
  return Database.use((db) =>
    db
      .all<{ id: string }>(
        sql`
    WITH RECURSIVE scope(id) AS (
      SELECT id FROM session WHERE project_id=${owner.projectID} AND id IN (${sql.join(
        roots.map((id) => sql`${id}`),
        sql`,`,
      )})
      UNION
      SELECT s.id FROM session s JOIN scope p ON s.parent_id=p.id WHERE s.project_id=${owner.projectID}
    ) SELECT id FROM scope
  `,
      )
      .map((row) => row.id),
  )
}

function events(owner: GoalOwner): Event[] {
  return Database.use((db) =>
    db
      .select()
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.aggregate_type, owner.kind === "task" ? "task" : "session"),
          eq(ProtocolEventTable.aggregate_id, owner.id),
          inArray(ProtocolEventTable.type, [CREATED, UPDATED, GOAL_CONTINUATION]),
        ),
      )
      .orderBy(asc(ProtocolEventTable.seq))
      .all(),
  )
}

function append(owner: GoalOwner, type: string, payload: Record<string, unknown>, id?: string) {
  return ProtocolStore.appendEventInTransaction({
    id,
    kind: "event",
    type,
    aggregate: owner.kind === "task" ? "task" : "session",
    aggregate_id: owner.id,
    ...(owner.kind === "task" ? { session_id: owner.sessionID } : {}),
    source: "continuous-goal",
    payload,
  })
}

export function goalOwnerBoundary(owner: GoalOwner, afterRevisionSeq?: number): string | undefined {
  return Database.use((db) => {
    const session = db.select().from(SessionTable).where(eq(SessionTable.id, owner.sessionID)).get()
    if (!session || Session.deletedInTransaction(db, owner.sessionID))
      return "owner_unavailable"
    if (session.time_archived !== null) return "owner_archived"
    if (afterRevisionSeq !== undefined) {
      const stopped = db
        .select()
        .from(ProtocolEventTable)
        .where(
          and(
            eq(ProtocolEventTable.aggregate_type, owner.kind === "task" ? "task" : "session"),
            eq(ProtocolEventTable.aggregate_id, owner.id),
            sql`${ProtocolEventTable.seq} > ${afterRevisionSeq}`,
            owner.kind === "chat"
              ? sql`${ProtocolEventTable.type}='agent.execution.lifecycle' AND
                  json_extract(${ProtocolEventTable.payload}, '$.status.type')='terminal' AND
                  json_extract(${ProtocolEventTable.payload}, '$.status.reason')='aborted'`
              : owner.kind === "task"
                ? eq(ProtocolEventTable.type, "task.cancelled")
                : inArray(ProtocolEventTable.type, ["mission.execution.closing", "mission.execution.closed"]),
          ),
        )
        .orderBy(sql`${ProtocolEventTable.seq} DESC`)
        .get()
      if (stopped) return owner.kind === "mission" ? "mission_closed" : "owner_cancelled"
    }
    if (owner.kind === "task") {
      const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, owner.id)).get()
      if (!task || taskDeletedInTransaction(db, owner.id)) return "owner_unavailable"
      if (task.time_archived !== null) return "owner_archived"
      const lifecycle = taskLifecycleProjectionInTransaction(db, owner.id)
      if (lifecycle.status === "cancelled" || lifecycle.status === "cancelling") return "owner_cancelled"
    }
    if (owner.kind === "mission") {
      const closure = currentMissionExecutionClosureInTransaction(db, owner.sessionID)
      if (!closure || closure.state !== "opened") return "mission_closed"
    }
    return undefined
  })
}

function project(owner: GoalOwner, rows: Event[], goalID?: string): ContinuousGoalView | undefined {
  const created = goalID
    ? rows.find((event) => event.type === CREATED && event.id === goalID)
    : rows.filter((event) => event.type === CREATED).at(-1)
  if (!created) return undefined
  const initial = ContinuousGoalCreate.parse(created.payload?.input)
  const updates = rows.filter((event) => event.type === UPDATED && event.payload?.goal_id === created.id)
  const last = updates.at(-1)
  const update = last ? ContinuousGoalUpdate.parse(last.payload?.input) : undefined
  const revisions = updates.map((event) => ContinuousGoalUpdate.parse(event.payload?.input))
  const tokenBudget =
    revisions.filter((value) => value.tokenBudget !== undefined).at(-1)?.tokenBudget ?? initial.tokenBudget
  const turnBudget =
    revisions.filter((value) => value.turnBudget !== undefined).at(-1)?.turnBudget ?? initial.turnBudget
  const tokensUsed = Database.use(
    (db) =>
      db.all<{ total: number }>(sql`
    SELECT coalesce(sum(u.total_tokens),0) AS total FROM provider_usage_event u
    WHERE u.id IN (SELECT json_extract(payload,'$.usage_id') FROM protocol_event
      WHERE type='continuous_goal.usage' AND json_extract(payload,'$.goal_id')=${created.id})
  `)[0]!.total,
  )
  const turnsAccepted = rows.filter(
    (event) => event.type === GOAL_CONTINUATION && event.payload?.goal_id === created.id,
  ).length
  let status: ContinuousGoalView["status"] = update?.status ?? "active"
  let reason = update?.reason
  if (status !== "complete") {
    const boundary = goalOwnerBoundary(owner, last?.seq ?? created.seq)
    if (boundary) {
      status = "paused"
      reason = boundary
    } else if (
      status === "active" &&
      ((tokenBudget !== undefined && tokensUsed >= tokenBudget) ||
        (turnBudget !== undefined && turnsAccepted >= turnBudget))
    ) {
      status = "budget_limited"
      reason = tokenBudget !== undefined && tokensUsed >= tokenBudget ? "token_budget" : "turn_budget"
    }
  }
  return ContinuousGoalView.parse({
    id: created.id,
    revision: last?.id ?? created.id,
    owner: { kind: owner.kind, id: owner.id },
    objective: initial.objective,
    status,
    reason,
    tokenBudget,
    turnBudget,
    tokensUsed,
    turnsAccepted,
    createdAt: created.emitted_at,
    updatedAt: last?.emitted_at ?? created.emitted_at,
    sessionID: owner.sessionID,
    projectID: owner.projectID,
    directory: owner.directory,
  })
}

export function readContinuousGoal(owner: GoalOwner): ContinuousGoalView | undefined {
  return Database.use(() => project(owner, events(owner)))
}

export function projectGoalOwners(projectID = Instance.project.id): ContinuousGoalOwner[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(ProtocolEventTable)
      .where(
        and(
          sql`(${ProtocolEventTable.project_id}=${projectID} OR
      (${ProtocolEventTable.aggregate_type}='session' AND ${ProtocolEventTable.aggregate_id} IN
      (SELECT id FROM session WHERE project_id=${projectID})))`,
          eq(ProtocolEventTable.type, CREATED),
        ),
      )
      .all(),
  )
  return [
    ...new Map(
      rows.map((event) => {
        const owner = ContinuousGoalOwner.parse(event.payload?.owner)
        return [owner.kind + ":" + owner.id, owner] as const
      }),
    ).values(),
  ]
}

function assertExclusiveGoalScope(owner: GoalOwner) {
  const scope = new Set(goalScopeSessionIDs(owner))
  for (const other of projectGoalOwners(owner.projectID)) {
    if (other.kind === owner.kind && other.id === owner.id) continue
    let otherOwner: GoalOwner
    try {
      // Archiving pauses execution while retaining the unresolved goal's scope.
      otherOwner = resolveGoalOwner(other, { includeArchived: true })
    } catch (error) {
      if (
        ContinuousGoalError.isInstance(error as Error) &&
        (error as InstanceType<typeof ContinuousGoalError>).data.code === "owner_unavailable"
      )
        continue
      throw error
    }
    const goal = readContinuousGoal(otherOwner)
    if (goal && goal.status !== "complete" && goalScopeSessionIDs(otherOwner).some((id) => scope.has(id)))
      return goalError(
        "overlapping_owner",
        "A parent or child already owns a continuous goal for this execution scope.",
      )
  }
}

export function createContinuousGoal(owner: GoalOwner, raw: z.input<typeof ContinuousGoalCreate>, author: string) {
  const input = ContinuousGoalCreate.parse(raw)
  return Database.immediateTransaction(() => {
    resolveGoalOwner(owner)
    const rows = events(owner)
    const replay = rows.find((event) => event.type === CREATED && event.payload?.request_id === input.requestID)
    if (replay) {
      if (!isDeepStrictEqual(replay.payload?.input, input))
        return goalError("conflict", "Goal request ID has a different input.")
      return project(owner, rows, replay.id)!
    }
    const current = project(owner, rows)
    if (current && current.status !== "complete")
      return goalError("conflict", "Complete the current goal before creating another.")
    if (goalOwnerBoundary(owner))
      return goalError("owner_unavailable", "Open the owner before creating a continuous goal.")
    assertExclusiveGoalScope(owner)
    append(owner, CREATED, { owner: { kind: owner.kind, id: owner.id }, request_id: input.requestID, input, author })
    if (owner.kind !== "task") setSessionTitleFromGoalInTransaction({ sessionID: owner.sessionID, objective: input.objective })
    return readContinuousGoal(owner)!
  })
}

export function updateContinuousGoal(owner: GoalOwner, raw: z.input<typeof ContinuousGoalUpdate>, author: string) {
  const input = ContinuousGoalUpdate.parse(raw)
  return Database.immediateTransaction(() => {
    resolveGoalOwner(owner)
    const rows = events(owner)
    const replay = rows.find((event) => event.type === UPDATED && event.payload?.request_id === input.requestID)
    if (replay) {
      if (!isDeepStrictEqual(replay.payload?.input, input))
        return goalError("conflict", "Goal update request ID has a different input.")
      return project(owner, rows, input.goalID)!
    }
    const current = project(owner, rows)
    if (!current || current.id !== input.goalID || current.revision !== input.expectedRevision)
      return goalError("revision_conflict", "Read the current goal revision before updating it.")
    if (current.status === "complete") return goalError("inactive", "This goal has already completed.")
    if (input.status === "active" && goalOwnerBoundary(owner))
      return goalError("owner_unavailable", "Resume the owner explicitly before resuming its continuous goal.")
    if (input.status === "active") assertExclusiveGoalScope(owner)
    append(owner, UPDATED, { goal_id: current.id, request_id: input.requestID, input, author })
    return readContinuousGoal(owner)!
  })
}

export function inheritedContinuousGoal(sessionID: string): ContinuousGoalView | undefined {
  for (const candidate of projectGoalOwners()) {
    let owner: GoalOwner
    try {
      owner = resolveGoalOwner(candidate, { includeArchived: true })
    } catch (error) {
      if (
        ContinuousGoalError.isInstance(error as Error) &&
        (error as InstanceType<typeof ContinuousGoalError>).data.code === "owner_unavailable"
      )
        continue
      throw error
    }
    const goal = readContinuousGoal(owner)
    if (goal && goal.status !== "complete" && goalScopeSessionIDs(owner).includes(sessionID)) return goal
  }
  return undefined
}

/** Archiving is explicit owner control. Persist its pause atomically before the owner becomes unavailable. */
export function pauseContinuousGoalForArchive(target: { taskID: string } | { sessionID: string }) {
  Database.requireActiveTransaction("pauseContinuousGoalForArchive")
  for (const candidate of projectGoalOwners()) {
    const matches =
      "taskID" in target
        ? candidate.kind === "task" && candidate.id === target.taskID
        : candidate.kind === "task"
          ? Database.use(
              (db) =>
                db
                  .select({ sessionID: EngineTaskTable.session_id })
                  .from(EngineTaskTable)
                  .where(eq(EngineTaskTable.id, candidate.id))
                  .get()?.sessionID,
            ) === target.sessionID
          : candidate.id === target.sessionID
    if (!matches) continue
    let owner: GoalOwner
    try {
      owner = resolveGoalOwner(candidate)
    } catch (error) {
      if (
        ContinuousGoalError.isInstance(error as Error) &&
        (error as InstanceType<typeof ContinuousGoalError>).data.code === "owner_unavailable"
      )
        continue
      throw error
    }
    const goal = readContinuousGoal(owner)
    if (!goal || goal.status === "complete") continue
    updateContinuousGoal(
      owner,
      {
        requestID: "archive:" + goal.revision,
        goalID: goal.id,
        expectedRevision: goal.revision,
        status: "paused",
        reason: "owner_archived",
      },
      "owner-control",
    )
  }
}

export function continuousGoalSystem(sessionID?: string): string[] {
  if (!sessionID) return []
  const goal = inheritedContinuousGoal(sessionID)
  if (!goal) return []
  return [
    "Continuous goal (durable user-authorized execution intent; separate from Delivery Slice Goals):\n" +
      JSON.stringify(goal) +
      "\nKeep working toward this objective across turns. Preserve user constraints and permissions. " +
      "The owner can use get_continuous_goal and update_continuous_goal. Mark complete only with actual outcome evidence; " +
      "mark blocked only with a concrete external blocker and unmet work. Pause only on the user's instruction. " +
      "Do not create goals or raise budgets without an explicit user request. Workers report evidence to the owner. " +
      "Goal completion does not replace the normal Task/Mission completion contract. " +
      "Paused or budget-limited goals accept no new automatic goal turns; already accepted work may settle. " +
      "Token usage includes this execution's descendant Sessions and is checked before each automatic continuation.",
  ]
}

/** Capture before streaming. The callback links the exact usage row inside its insertion transaction. */
export function captureContinuousGoalUsage(sessionID: string): ((usageID: string) => void) | undefined {
  const goal = inheritedContinuousGoal(sessionID)
  if (!goal) return undefined
  return (usageID) => {
    ProtocolStore.appendEventInTransaction({
      id: Identifier.deterministic("protocol_event", "continuous-goal-usage:" + usageID),
      kind: "event",
      type: "continuous_goal.usage",
      aggregate: "stream",
      aggregate_id: goal.id,
      source: "continuous-goal",
      payload: { goal_id: goal.id, usage_id: usageID },
    })
  }
}

export type GoalContinuation = { id: string; goalID: string; revision: string; frontier: string; number: number }
export function planGoalContinuation(goal: ContinuousGoalView, frontier: string): GoalContinuation {
  return {
    id: Identifier.deterministic("protocol_event", "continuous-goal:" + goal.id + ":" + goal.revision + ":" + frontier),
    goalID: goal.id,
    revision: goal.revision,
    frontier,
    number: goal.turnsAccepted + 1,
  }
}
export function latestGoalContinuation(owner: GoalOwner): GoalContinuation | undefined {
  const goal = readContinuousGoal(owner)
  const row = events(owner)
    .filter((event) => event.type === GOAL_CONTINUATION && event.payload?.goal_id === goal?.id)
    .at(-1)
  if (!row) return undefined
  return {
    id: row.id,
    goalID: String(row.payload!.goal_id),
    revision: String(row.payload!.revision),
    frontier: String(row.payload!.frontier),
    number: Number(row.payload!.number),
  }
}

export function requestGoalContinuation(
  owner: GoalOwner,
  expected: ContinuousGoalView,
  frontier: string,
): GoalContinuation {
  return Database.immediateTransaction(() => {
    const goal = readContinuousGoal(owner)
    if (!goal || goal.id !== expected.id || goal.revision !== expected.revision)
      return goalError("revision_conflict", "Goal changed before continuation admission.")
    const latest = latestGoalContinuation(owner)
    if (latest?.revision === goal.revision && latest.frontier === frontier) return latest
    if (goal.status !== "active") return goalError("inactive", "Goal is " + goal.status + ".")
    const request = planGoalContinuation(goal, frontier)
    append(
      owner,
      GOAL_CONTINUATION,
      {
        goal_id: request.goalID,
        revision: request.revision,
        frontier,
        number: request.number,
      },
      request.id,
    )
    return request
  })
}
