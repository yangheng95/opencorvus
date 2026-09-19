import { expect, test } from "bun:test"
import { auditMissionOutcome } from "../../script/benchmark/external-agent/contract"

function completedTurn(suffix: string) {
  const input = { summary: `Accepted ${suffix}`, task_acceptances: [] }
  const output = {
    ...input,
    kind: "mission_completed",
    mission_id: "mission",
    mission_session_id: "session",
    assistant_message_id: `assistant-${suffix}`,
    tool_call_id: `call-${suffix}`,
    tool_part_id: `part-${suffix}`,
    time_recorded: 10,
  }
  return {
    messages: [
      { info: { id: `user-${suffix}`, sessionID: "session", role: "user" }, parts: [] },
      {
        info: {
          id: output.assistant_message_id,
          sessionID: "session",
          role: "assistant",
          parentID: `user-${suffix}`,
          time: { completed: 11 },
          finish: "stop",
        },
        parts: [
          {
            id: output.tool_part_id,
            callID: output.tool_call_id,
            type: "tool",
            tool: "panel_complete_mission",
            state: { status: "completed", input, output: JSON.stringify(output) },
          },
        ],
      },
    ],
    completion: {
      summary: input.summary,
      messageID: output.assistant_message_id,
      toolCallID: output.tool_call_id,
      toolPartID: output.tool_part_id,
      timeRecorded: output.time_recorded,
    },
  }
}

function audit(turns: ReturnType<typeof completedTurn>[]) {
  return auditMissionOutcome({
    missionRecord: {
      missionID: "mission",
      sessionID: "session",
      interruptible: false,
      tasks: [],
      completion: turns.at(-1)!.completion,
    },
    missionStatus: { status: "inactive", tasks: [] },
    missionTranscript: turns.flatMap((turn) => turn.messages),
    taskTranscripts: [],
  })
}

test("current Mission completion receipt settles bounded coordination", () => {
  expect(audit([completedTurn("current")])).toMatchObject({
    passed: true,
    scored_terminal: true,
    mission_completed: true,
    explicit_complete_mission: true,
    completion_receipt_matches: true,
  })
})

test("a reopened Mission settles its latest user occurrence with its current receipt", () => {
  expect(audit([completedTurn("first"), completedTurn("second")])).toMatchObject({
    passed: true,
    scored_terminal: true,
    mission_completed: true,
    explicit_complete_mission: true,
    completion_receipt_matches: true,
  })
})

test("a receipt identity mismatch yields an unsuccessful completion audit", () => {
  const turn = completedTurn("current")
  turn.completion.toolPartID = "another-part"
  expect(audit([turn])).toMatchObject({
    passed: false,
    scored_terminal: false,
    mission_completed: true,
    explicit_complete_mission: true,
    completion_receipt_matches: false,
  })
})
