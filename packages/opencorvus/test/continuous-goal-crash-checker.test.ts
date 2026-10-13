import { expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { crashCandidate, recoveryCandidate, goalCrashActivity } from "../script/continuous-goal-crash-check"

for (const kind of ["task", "mission"] as const) {
  test(`${kind} crash checker selects current output with exact accepted-input and physical-reader authority`, () => {
    const continuationID = Identifier.ascending("protocol_event")
    const inputID = Identifier.deterministic("message", continuationID)
    const sessionID = Identifier.ascending("session")
    const oldInputID = Identifier.ascending("message")
    const controlID = kind === "task" ? Identifier.ascending("message") : inputID
    const assistantID = Identifier.ascending("message")
    const unrelatedAssistantID = Identifier.ascending("message")
    const ingressID = Identifier.deterministic("artifact", "goal-crash-checker-ingress")
    const textID = Identifier.ascending("part")
    const promptOwner = { session_id: sessionID, owner_pid: 41, generation: "exact-physical-generation" }
    const facts: Parameters<typeof crashCandidate>[0] = {
      session: { id: sessionID },
      ids: [sessionID],
      messages: [
        { id: inputID, time_created: 100, data: { role: "user", author: "goal-controller" } },
        ...(kind === "task"
          ? [{ id: controlID, data: { extra: { orchestrator_control_ingress: { ingress_id: ingressID } } } }]
          : []),
        {
          id: unrelatedAssistantID,
          session_id: sessionID,
          time_created: 110,
          data: { role: "assistant", time: {}, parentID: oldInputID, acceptedInputMessageIDs: [oldInputID] },
        },
        {
          id: assistantID,
          session_id: sessionID,
          time_created: 120,
          data: { role: "assistant", time: {}, parentID: controlID, acceptedInputMessageIDs: [controlID] },
        },
      ],
      parts: [
        {
          id: "older-part",
          message_id: assistantID,
          time_updated: 150,
          data: { type: "text", text: "Earlier provider request" },
        },
        {
          id: "unrelated-part",
          message_id: unrelatedAssistantID,
          time_updated: 230,
          data: { type: "text", text: "Another accepted input" },
        },
        {
          id: textID,
          message_id: assistantID,
          time_updated: 230,
          data: { type: "text", text: "Actual partial output" },
        },
      ],
      tools: [],
      outcomes: [],
      events: [],
      created: undefined,
      updates: [],
      usage: [],
      activations: [],
      continuations: [{ id: continuationID }],
      ingresses: kind === "task" ? [{ id: ingressID, source_id: inputID, execution_epoch: 2 }] : [],
      promptOwners: [promptOwner],
    }
    const reader = (id: string) => ({
      state: "reading",
      byteCount: 256,
      firstByteReadAt: 200,
      requestContext: { sessionID, activity: { assistantMessageID: id } },
    })
    const candidate = crashCandidate(facts, {
      pid: 41,
      requests: [{ response_reader: reader(unrelatedAssistantID) }, { response_reader: reader(assistantID) }],
    })
    expect(candidate).toMatchObject({
      continuationID,
      inputID,
      assistantID,
      requestIndex: 1,
      promptOwner,
      progress: [{ id: textID, type: "text", characters: 21 }],
      ...(kind === "task" ? { ingress: { id: ingressID, execution_epoch: 2 } } : {}),
    })
    const recoveredAssistantID = Identifier.ascending("message")
    const interrupted = facts.messages.find((message) => message.id === assistantID)!
    interrupted.data.time.completed = 300
    interrupted.data.error = {
      name: "ProcessExecutionInterruptedError",
      data: { message: "Exact process interruption" },
    }
    facts.promptOwners = [{ session_id: sessionID, owner_pid: 42, generation: "new-physical-generation" }]
    facts.messages.push({
      id: recoveredAssistantID,
      session_id: sessionID,
      data: { role: "assistant", time: { created: 310 }, parentID: controlID, acceptedInputMessageIDs: [controlID] },
    })
    expect(
      recoveryCandidate(facts, { requests: [{ response_reader: reader(recoveredAssistantID) }] }, candidate!, 42),
    ).toMatchObject({
      kind: kind === "task" ? "task_ingress" : "accepted_goal_input",
      inputID: controlID,
      assistantID: recoveredAssistantID,
      interruptedAssistantID: assistantID,
      promptOwner: { owner_pid: 42, generation: "new-physical-generation" },
    })
  })
}

test("Mission runtime recovery carries the exact opened event, dead generation and interrupted frontier", () => {
  const sessionID = "mission-session"
  const reason = {
    source: "mission.process_recovery",
    openedEventID: "opened",
    deadOwnerGeneration: "old-generation",
    interruptedAssistantMessageIDs: ["interrupted"],
  }
  const facts = {
    ids: [sessionID],
    messages: [
      { id: "interrupted", data: { error: { name: "ProcessExecutionInterruptedError" }, time: { completed: 300 } } },
      { id: "runtime-input", data: { extra: { wake_reason: reason } } },
      { id: "recovered", data: { parentID: "runtime-input", acceptedInputMessageIDs: ["runtime-input"] } },
    ],
    promptOwners: [{ session_id: sessionID, owner_pid: 52, generation: "new-generation" }],
  } as unknown as Parameters<typeof recoveryCandidate>[0]
  const cut = {
    assistantID: "interrupted",
    inputID: "goal-input",
    opened: { id: "opened" },
    promptOwner: { generation: "old-generation" },
  } as Parameters<typeof recoveryCandidate>[2]
  const result = recoveryCandidate(
    facts,
    {
      requests: [{ response_reader: { requestContext: { sessionID, activity: { assistantMessageID: "recovered" } } } }],
    },
    cut,
    52,
  )
  expect(result).toMatchObject({
    kind: "mission_process_recovery",
    inputID: "runtime-input",
    assistantID: "recovered",
    reason,
    interruptedAt: 300,
  })
})

test("inactivity evidence consists of business frontiers and physical reader progress", () => {
  const facts = {
    session: { time_updated: 999 },
    activations: [{ expires_at: 999 }],
    promptOwners: [{ generation: "renewed" }],
    messages: [{ id: "message", time_updated: 999, data: { role: "assistant" } }],
    parts: [],
    tools: [],
    outcomes: [],
    events: [{ id: "event", type: "continuous_goal.created", payload: { input: { objective: "one" } } }],
    usage: [{ id: "usage" }],
  } as unknown as Parameters<typeof goalCrashActivity>[0]
  const request = {
    model: "exact-model",
    status: 200,
    response_reader: { state: "reading", byteCount: 64, chunkCount: 2, receivedAt: 999 },
  }
  expect(goalCrashActivity(facts, { observedAt: 999, requests: [request] })).toEqual({
    messages: [{ id: "message", data: { role: "assistant" } }],
    parts: [],
    tools: [],
    outcomes: [],
    protocol: [{ id: "event", type: "continuous_goal.created", payload: { input: { objective: "one" } } }],
    usageIDs: ["usage"],
    requests: [
      {
        model: "exact-model",
        status: 200,
        state: "reading",
        byteCount: 64,
        chunkCount: 2,
        requestContext: undefined,
        terminal: undefined,
      },
    ],
  })
})
