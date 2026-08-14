/** Exact Session termination writers. */
import { MessageStore } from "@/session/message-store"
import { Session } from "@/session"
import { SessionPromptState } from "@/session/prompt/state"
import { Instance } from "@/project/instance"
import { awaitSessionPromptFinishedInScope, cancelSessionPromptInScope } from "./cancellation-scope"
import { taskIDForSession } from "./task-session-lineage"
import { findTask } from "./store"
import { persistProcessShutdownRecoveryHandoffs } from "./task-root-ingress-delivery"
import { Database, and, eq, inArray, isNull } from "@/storage/db"
import { EngineTaskTable } from "./engine.sql"
import { SessionTable } from "@/session/session.sql"
import { taskRootDirectory } from "./task-directory"
import { randomUUID } from "node:crypto"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { executionInterruptionFailure } from "./execution-interruption"

// ---------------------------------------------------------------------------
// Termination primitives for recovery and explicit Task repair.
// ---------------------------------------------------------------------------

export type TerminateOwnedExecutionResult = {
  sessions: number
  toolParts: number
  releaseHandoff(): void
}

function completedToolTime(start: number, observedAt = Date.now()): { start: number; end: number } {
  return {
    start,
    end: Math.max(observedAt, start + 1),
  }
}

async function abortOpenToolParts(sessionID: string, reason: string): Promise<number> {
  const messages = await Session.messages({ sessionID })
  let updated = 0
  for (const message of messages) {
    const parts = await MessageStore.parts(message.info.id)
    for (const part of parts) {
      if (part.type !== "tool") continue
      if (part.state.status === "completed" || part.state.status === "error") continue
      const now = Date.now()
      const start = part.state.time.start
      await Session.updatePart({
        ...part,
        state: {
          status: "error",
          input: part.state.input,
          failure: executionInterruptionFailure({
            error: new Error(reason),
            originSite: "engine.writer.abort-open-tool-parts",
            sessionID,
            messageID: message.info.id,
            toolPartID: part.id,
            toolCallID: part.callID,
            toolName: part.tool,
          }),
          time: completedToolTime(start, now),
        },
      })
      updated += 1
    }
  }
  return updated
}

/**
 * Graceful process shutdown settles only prompt controllers physically owned
 * by this process. It never infers ownership from Task contract rows and
 * never rewrites Task or Delivery Slice satisfaction.
 */
export async function terminateCurrentProcessOwnedExecution(input: {
  reason: string
}): Promise<TerminateOwnedExecutionResult> {
  const cancellationRequestID = randomUUID()
  const owners = (
    await Promise.all(
      SessionPromptState.ownedPromptSessionIDs().map(async (sessionID) => ({
        sessionID,
        session: await Session.get(sessionID).catch(() => undefined),
      })),
    )
  ).filter((owner): owner is { sessionID: string; session: Session.Info } => owner.session !== undefined)

  const taskHandoffs = new Map<
    string,
    {
      rootDirectory: string
      ownedSessionIDs: string[]
    }
  >()
  for (const owner of owners) {
    const binding = await Instance.provideProjectIdentity({
      directory: owner.session.directory,
      fn: async () => {
        const taskID = taskIDForSession(owner.sessionID)
        if (!taskID) return undefined
        const task = findTask(taskID)
        if (!task?.session_id) return undefined
        return {
          taskID,
          rootDirectory: taskRootDirectory(task),
        }
      },
    })
    if (!binding) continue
    const existing = taskHandoffs.get(binding.taskID)
    if (existing) {
      existing.ownedSessionIDs.push(owner.sessionID)
      continue
    }
    taskHandoffs.set(binding.taskID, {
      rootDirectory: binding.rootDirectory,
      ownedSessionIDs: [owner.sessionID],
    })
  }

  const affectedDirectories = [...new Set([...taskHandoffs.values()].map((handoff) => handoff.rootDirectory))]
  const affectedRootSessionIDs =
    affectedDirectories.length === 0
      ? []
      : Database.use((db) =>
          db
            .select({ sessionID: SessionTable.id })
            .from(EngineTaskTable)
            .innerJoin(SessionTable, eq(SessionTable.id, EngineTaskTable.session_id))
            .where(
              and(
                inArray(SessionTable.directory, affectedDirectories),
                isNull(EngineTaskTable.time_completed),
                isNull(EngineTaskTable.time_archived),
              ),
            )
            .all()
            .map((row) => row.sessionID),
        )

  const handoffScopes: Array<{ close(): void }> = []
  let handoffSetupComplete = false
  let settlementComplete = false
  let handoffReleased = false
  const releaseHandoff = () => {
    if (handoffReleased) return
    handoffReleased = true
    for (const scope of handoffScopes.reverse()) scope.close()
  }
  const cancelled: Session.Info[] = []
  let toolParts = 0
  const failures: unknown[] = []

  try {
    // Freeze every Task root in each affected serialization directory before
    // persisting one handoff occurrence and recovery wake per physically owned
    // Task. This closes both re-entry and concurrent-sibling launch races while the
    // current process settles its owners.
    for (const rootSessionID of new Set(affectedRootSessionIDs)) {
      const taskID = taskIDForSession(rootSessionID)
      handoffScopes.push(
        SessionPromptState.beginRootSessionProcessShutdownHandoff(
          rootSessionID,
          createExecutionCancellationOrigin({
            actor: "runtime",
            source: "process.shutdown",
            surface: "runtime",
            requestID: cancellationRequestID,
            reason: input.reason,
            ...(taskID ? { taskID } : {}),
          }),
        ),
      )
    }
    persistProcessShutdownRecoveryHandoffs({
      tasks: [...taskHandoffs].map(([taskID, handoff]) => ({
        taskID,
        ownedSessionIDs: handoff.ownedSessionIDs,
      })),
      reason: input.reason,
    })
    handoffSetupComplete = true

    // Cancellation is deliberately two-phase. Every physical owner receives
    // its abort request before shutdown waits for any one loop to finish.
    // Otherwise an idle root loop can block sibling worker cancellation while
    // it re-enters the same project to finalize.
    const cancellationResults = await Promise.allSettled(
      owners.map((owner) =>
        Instance.provideProjectIdentity({
          directory: owner.session.directory,
          fn: async () => {
            const taskID = taskIDForSession(owner.session.id)
            const didCancel = cancelSessionPromptInScope({
              session: owner.session,
              handle: "SessionPrompt.terminate",
              origin: createExecutionCancellationOrigin({
                actor: "runtime",
                source: "process.shutdown",
                surface: "runtime",
                requestID: cancellationRequestID,
                reason: input.reason,
                targetSessionID: owner.session.id,
                ...(taskID ? { taskID } : {}),
              }),
              settleBeforeReuse: true,
            })
            const settledToolParts = await abortOpenToolParts(owner.sessionID, input.reason)
            return { didCancel, settledToolParts }
          },
        }),
      ),
    )
    for (let index = 0; index < cancellationResults.length; index++) {
      const result = cancellationResults[index]!
      if (result.status === "rejected") {
        failures.push(result.reason)
        continue
      }
      toolParts += result.value.settledToolParts
      if (result.value.didCancel) cancelled.push(owners[index]!.session)
    }

    const finishResults = await Promise.allSettled(
      cancelled.map((session) =>
        Instance.provideProjectIdentity({
          directory: session.directory,
          fn: () =>
            awaitSessionPromptFinishedInScope({
              session,
              handle: "SessionPrompt.terminate",
            }),
        }),
      ),
    )
    for (const result of finishResults) {
      if (result.status === "rejected") failures.push(result.reason)
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `Failed to settle ${failures.length} process-owned prompt operation(s)`)
    }
    settlementComplete = true
    return { sessions: cancelled.length, toolParts, releaseHandoff }
  } finally {
    if (!handoffSetupComplete || !settlementComplete) releaseHandoff()
  }
}
