/**
 * Task Control Loop — the single entry point for task lifecycle.
 *
 * One wake = one orchestrator decision pass. There is no internal loop and no
 * watermark. The orchestrator LLM owns every scheduler decision through its own
 * tool calls (exact projected implementation worker / manage_task action=complete_task /
 * manage_task action=modify_goal / manage_task action=fail_task / question).
 * When it stops after a valid decision, the loop exits. The next wake normally
 * comes from an external trigger (operator message or scheduler tick) —
 * re-entering this function with a fresh persisted wake.
 *
 * Per rule 23 (no state machines): the loop does NOT inspect artifacts and
 * synthesise wake notes to push the LLM through a fixed pipeline. Past
 * iterations grew three such gates (acceptance-rejection rewake,
 * build-settled-without-deliver rewake, general orchestrator-stream-error
 * rewake); all three were FSM in disguise and have been deleted. External
 * ingress settlement is owned by the durable root-ingress record: a current operator/root
 * message must be read and paired with a scheduler decision before the wake is
 * marked delivered. Only explicit external ingress can re-enter the task loop.
 *
 * What this does NOT own:
 *   - Deciding what the orchestrator does on wake (LLM reads describe).
 *   - Dispatching Task workflow nodes (the Orchestrator chooses an exact projected worker).
 *   - Reacting to acceptance rejection / build settlement / stream error —
 *     those are facts the LLM reads via describe on its next decision turn.
 */

import { Log } from "@/util/log"
import { Orchestrator } from "@/orchestrator/agent"
import type { OrchestratorEvent } from "@/orchestrator/event"
import { findTask } from "@/engine"
import { terminalTask } from "@/engine/state"
import { deriveTaskStatus, isTaskTerminal } from "@/engine/task-status"
import { recordTaskInfrastructureError, recordTaskInfrastructureErrorInTransaction } from "@/engine/persist"
import { createTerminalConversationAuthority } from "./terminal-conversation-authority"

const log = Log.create({ service: "orchestrator-loop" })

export async function runTaskLoop(input: {
  taskID: string
  event?: OrchestratorEvent
  signal?: AbortSignal
  wakeID?: string
  activationID?: string
  predecessorID?: string
}) {
  if (input.signal?.aborted) return
  return runTaskLoopInner(input)
}

/**
 * Run one orchestrator decision pass.
 *
 * Single-pass: enter, run `Orchestrator.processTask` once with the caller event,
 * exit. If the LLM stops mid-task after a valid
 * decision (acceptance rejection, build settled, stream error, pending
 * question), the next external trigger re-enters this function. Current
 * operator/root ingress is not considered delivered until its owner verifies
 * that this physical pass read the exact ingress message and made a scheduler
 * decision. Concurrent entries for the same task are serialised by
 * `runTaskLoop`.
 */
async function runTaskLoopInner(input: {
  taskID: string
  event?: OrchestratorEvent
  signal?: AbortSignal
  wakeID?: string
  activationID?: string
  predecessorID?: string
}) {
  const { taskID, signal, event, wakeID, activationID, predecessorID } = input
  if (signal?.aborted) return

  log.info("task loop started", { taskID, note: event?.note })

  if (signal?.aborted) return

  let task = findTask(taskID)
  if (!task) {
    log.error("task not found, exiting loop", { taskID })
    return
  }
  if (isTaskTerminal(task)) {
    if (!event || !wakeID || !activationID) {
      log.info("terminal task loop has no admitted conversational ingress", { taskID, status: deriveTaskStatus(task), note: event?.note })
      return
    }
    const finalMessageID = await Orchestrator.processTerminalConversation({
      taskID,
      event,
      authority: createTerminalConversationAuthority({ taskID, ingressID: wakeID, event }),
      signal,
      activationID,
      predecessorID: predecessorID ?? wakeID,
    })
    return { finalMessageID }
  }
  // Attempt to capture the git baseline before the decision. Failure is a
  // visible infrastructure fact, not admission authority for the Orchestrator
  // pass. Exact repository checkpoint operations own their physical baseline.
  {
    const { EngineGit } = await import("@/engine/git")
    const result = await EngineGit.prepare(task)
    if (result.error) {
      log.error("EngineGit.prepare failed", { taskID, error: result.error })
      if (result.terminalFailure) {
        const terminalFailure = result.terminalFailure
        await terminalTask(
          task,
          { status: "failed", error: result.error },
          "Task creation workspace identity no longer matches its first execution source",
          {
            preExecutionInfrastructureFailure: terminalFailure,
            transactionEffect(db) {
              recordTaskInfrastructureErrorInTransaction(db, {
                taskID,
                component: "engine-git",
                operation: "prepare-baseline",
                reason: result.error!,
                context: {
                  code: terminalFailure.code,
                  initial_tree_sha256: terminalFailure.initialTreeSHA256,
                  execution_tree_sha256: terminalFailure.executionTreeSHA256,
                },
                now: Date.now(),
              })
            },
          },
        )
        return
      }
      recordTaskInfrastructureError({
        taskID,
        component: "engine-git",
        operation: "prepare-baseline",
        reason: result.error,
        now: Date.now(),
      })
    }
  }

  log.info("decision point", { taskID, note: event?.note })

  try {
    const finalMessageID = await Orchestrator.processTask(
      taskID,
      event,
      signal,
      wakeID,
      activationID,
      predecessorID,
    )
    return finalMessageID ? { finalMessageID } : {}
  } catch (err) {
    if (signal?.aborted) return
    // Pass the Error object directly so Log.formatError walks the stack +
    // err.cause chain. String(err) collapses to message-only and hides the
    // underlying provider/transport/DB cause.
    log.error("orchestrator error at decision point", { taskID, error: err })
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    recordTaskInfrastructureError({
      taskID,
      component: "orchestrator-loop",
      operation: "decision-pass",
      reason: message,
      errorName: err instanceof Error ? err.name : undefined,
      now: Date.now(),
    })
  }

  log.info("task loop exited", { taskID })
}
