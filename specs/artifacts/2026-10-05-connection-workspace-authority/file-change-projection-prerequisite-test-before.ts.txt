import { afterAll, afterEach, beforeAll, expect, test } from "bun:test"
import { routeSSEEvent } from "../src/services/events"
import {
  ProjectionPrerequisiteError,
  applyEvent,
  isProjectionPrerequisiteError,
  resetWriter,
} from "../src/services/tree-writer"
import { boardStore, setBoardStore } from "../src/store/board"
import { cardTreeStore } from "../src/store/card-tree"
import type { SelectedTaskRecoveryScheduler } from "../src/services/selected-task-recovery"

const taskID = "tsk_projection_recovery"
const sessionID = "ses_projection_recovery"
const messageID = "msg_projection_recovery"
const partID = "part_projection_recovery"
const messageOrderKey = `v1:${String(1_776_000_000_000).padStart(16, "0")}:${String(2).padStart(16, "0")}:${String(0).padStart(16, "0")}:message:${messageID}`
const partOrderKey = `v1:${String(1_776_000_000_001).padStart(16, "0")}:${String(3).padStart(16, "0")}:${String(0).padStart(16, "0")}:part:${partID}`
const originalRequestAnimationFrame = globalThis.requestAnimationFrame

beforeAll(() => {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(performance.now())
    return 1
  }) as typeof requestAnimationFrame
})

afterAll(() => {
  if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame
  else Reflect.deleteProperty(globalThis, "requestAnimationFrame")
})

function projectConversation(): void {
  applyEvent({
    type: "message.updated",
    orderKey: messageOrderKey,
    properties: {
      info: {
        id: messageID,
        sessionID,
        sessionAgentID: "build",
        agentID: "build",
        role: "assistant",
        author: "build",
        channel: "build",
        originSource: "agent",
        resolvedRole: "build",
        time: { created: 1_776_000_000_000 },
        orderKey: messageOrderKey,
      },
    },
  })
  applyEvent({
    type: "message.part.updated",
    orderKey: messageOrderKey,
    properties: {
      orderKey: messageOrderKey,
      agentID: "build",
      sessionAgentID: "build",
      role: "assistant",
      author: "build",
      channel: "build",
      originSource: "agent",
      resolvedRole: "build",
      part: {
        id: partID,
        messageID,
        sessionID,
        type: "text",
        text: "recovered",
        orderKey: partOrderKey,
      },
    },
  })
}

function selectedTask(): void {
  setBoardStore({
    selectedSource: { kind: "task", id: taskID },
    board: { task: { id: taskID, sessionID }, snapshotVersion: "projection-recovery-v1" },
    taskSequence: 7,
  })
}

afterEach(() => {
  resetWriter({ cause: "projection-prerequisite-test-cleanup" })
  setBoardStore({ selectedSource: null, board: null, taskSequence: 0 })
})

test("Session, Message, and Part route failures each recover once without advancing the live sequence", async () => {
  const cases = [
    {
      name: "Session",
      prepare: () => undefined,
      event: {
        type: "message.removed",
        taskID,
        sequence: 8,
        properties: { sessionID, messageID: "msg_missing_session" },
      },
    },
    {
      name: "Message",
      prepare: projectConversation,
      event: {
        type: "message.removed",
        taskID,
        sequence: 8,
        properties: { sessionID, messageID: "msg_missing" },
      },
    },
    {
      name: "Part",
      prepare: projectConversation,
      event: {
        type: "message.part.removed",
        taskID,
        sequence: 8,
        properties: { sessionID, partID: "part_missing" },
      },
    },
  ] as const

  for (const scenario of cases) {
    resetWriter({ cause: `projection-prerequisite-${scenario.name}` })
    selectedTask()
    scenario.prepare()
    const recoveries: Array<{ reason: string; taskID: string }> = []
    const recovery: SelectedTaskRecoveryScheduler = {
      async recoverConversation(reason, recoveredTaskID) {
        recoveries.push({ reason, taskID: recoveredTaskID })
        projectConversation()
        return boardStore.taskSequence
      },
      async recoverAfterRewindClear() {
        throw new Error("unexpected rewind recovery")
      },
    }

    expect(routeSSEEvent(scenario.event, recovery)).toBe(true)
    await Promise.resolve()
    const card = Object.values(cardTreeStore.cards).find((candidate) => candidate.messageID === messageID)
    expect({
      recoveries,
      taskSequence: boardStore.taskSequence,
      cardID: card?.id,
      part: card?.parts.find((candidate: any) => candidate.id === partID),
    }).toEqual({
      recoveries: [{ reason: `message writer prerequisites missing: ${scenario.event.type}`, taskID }],
      taskSequence: 7,
      cardID: `build:session:${sessionID}:message:${messageID}`,
      part: expect.objectContaining({ id: partID, text: "recovered" }),
    })
  }
})

test("Session, Message, and Part prerequisites share one structured protocol independent of diagnostic prose", () => {
  resetWriter({ cause: "projection-prerequisite-variants" })
  const missingSession = (() => {
    try {
      applyEvent({
        type: "message.removed",
        properties: { sessionID, messageID },
      })
    } catch (error) {
      return error
    }
  })()
  projectConversation()
  const missingMessage = (() => {
    try {
      applyEvent({
        type: "message.removed",
        properties: { sessionID, messageID: "msg_missing" },
      })
    } catch (error) {
      return error
    }
  })()
  const missingPart = (() => {
    try {
      applyEvent({
        type: "message.part.removed",
        properties: { sessionID, partID: "part_missing" },
      })
    } catch (error) {
      return error
    }
  })()

  const errors = [missingSession, missingMessage, missingPart]
  for (const error of errors) {
    expect(isProjectionPrerequisiteError(error)).toBe(true)
    if (error instanceof ProjectionPrerequisiteError) error.message = "diagnostic text may change freely"
    expect(isProjectionPrerequisiteError(error)).toBe(true)
  }
  expect(
    errors.map((error) =>
      error instanceof ProjectionPrerequisiteError
        ? { eventType: error.eventType, entity: error.missingEntity, id: error.missingID, sessionID: error.sessionID }
        : null,
    ),
  ).toEqual([
    { eventType: "message.removed", entity: "session", id: sessionID, sessionID },
    { eventType: "message.removed", entity: "message", id: "msg_missing", sessionID },
    { eventType: "message.part.removed", entity: "part", id: "part_missing", sessionID },
  ])
})
