import { requireTask } from "@/engine/store"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { taskOrchestratorSession } from "@/orchestrator/task-session"
import { createNoActionTool, noActionTaskObservation } from "@/orchestrator/no-action-tool"
import { normalizeToolResult } from "@/session/tool-result-normalization"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import type { OrchestratorEvent } from "@/orchestrator/event"

// Explicit test participant requests; output/decisions are produced by the real Tool.
export async function settleScriptedStatusInput(input: {
  taskID: string
  event: OrchestratorEvent
  wakeID: string
  activationID: string
  predecessorID: string
  directory: string
}) {
  const { taskID, event, wakeID, activationID, predecessorID } = input
  const scheduler = await taskOrchestratorSession(requireTask(taskID))
  const control = currentOrchestratorControlMessage(event, taskID, wakeID, predecessorID)
  if (!control) throw new Error("Expected the current source-backed control occurrence")
  await Session.persistMessage({
    info: {
      id: control.messageID,
      sessionID: scheduler.id,
      role: "user",
      author: "orchestrator",
      time: { created: Date.now() },
      agent: "orchestrator",
      model: { providerID: "firmware", modelID: "gpt-5" },
      extra: control.extra,
    },
    parts: [
      {
        id: control.partID,
        sessionID: scheduler.id,
        messageID: control.messageID,
        type: "text",
        text: control.text,
        kind: "control",
        source: "system",
      },
    ],
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: scheduler.id,
    parentID: control.messageID,
    role: "assistant",
    author: "orchestrator",
    time: { created: Date.now() },
    agent: "orchestrator",
    providerID: "firmware",
    modelID: "gpt-5",
    path: { cwd: input.directory, root: input.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    activationID,
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: scheduler.id,
    messageID: assistant.id,
    type: "text",
    text: "LOCAL PROTOCOL TEST: status observation returned.",
    time: { start: Date.now(), end: Date.now() },
  })
  const requestInput = {
    reason: "LOCAL PROTOCOL TEST: the requested status observation is returned.",
    observed_task: noActionTaskObservation(taskLifecycleProjection(taskID)),
  }
  const request = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: scheduler.id,
    messageID: assistant.id,
    type: "tool",
    callID: `local-status-${wakeID}`,
    tool: "no_action",
    state: { status: "running", input: requestInput, time: { start: Date.now() } },
  })
  const result = normalizeToolResult(await createNoActionTool({ taskID }).no_action.execute!(requestInput, {} as never))
  await Session.updatePart({
    ...request,
    state: {
      status: "completed",
      input: requestInput,
      output: result.output,
      title: result.title,
      metadata: result.metadata,
      time: { start: request.state.time.start, end: Date.now() },
    },
  })
  await Session.updateMessage({
    ...assistant,
    finish: "stop",
    time: { ...assistant.time, completed: Date.now() },
  })
  return { finalMessageID: assistant.id }
}
