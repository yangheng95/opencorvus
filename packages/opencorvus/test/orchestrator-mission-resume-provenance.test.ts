import { expect, test } from "bun:test"
import { currentWakeControlProjection, renderWakeProvenanceNotice } from "@/orchestrator/agent"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { authorizedTaskRootMessagesForWake } from "@/orchestrator/interaction-tools"

test("Mission acceptance resume projects one current read and real-decision obligation", () => {
  const messageID = "msg_mission_acceptance_gap"
  const event = OrchestratorEventSchema.parse({
    missionAcceptanceResume: {
      missionID: "mission-current-acceptance",
      missionSessionID: "ses_mission_current_acceptance",
      messageID,
      panelMessageID: "msg_panel_current_acceptance",
      toolCallID: "call_resume_current_acceptance",
      toolPartID: "prt_resume_current_acceptance",
      reviewedTerminalLifecycleReference: {
        terminalEventID: "pev_reviewed_terminal_occurrence",
        terminalStatus: "completed",
        timeCompleted: 1,
      },
      evidenceLocators: [
        {
          source: "engine_artifact",
          artifact_id: "art_reviewed_acceptance_evidence",
          catalog_revision: 1,
          expected_sha256: "a".repeat(64),
        },
      ],
    },
  })

  const notice = renderWakeProvenanceNotice(event, "tsk_current_acceptance")

  expect(notice).toContain(`read_task_message(message_id="${messageID}"`)
  expect(notice).toContain("record at least one current scheduling or lifecycle decision")
  expect(notice).toContain("matching real tool call")
  expect(notice).toContain("a prose-only response")

  const control = currentWakeControlProjection({
    taskID: "tsk_current_acceptance",
    event,
    wakeID: "art_current_acceptance_wake",
  })
  expect(control).toMatchObject({
    messageID: "msg_current_acceptance_wake",
    author: "mission",
    wakeReason: {
      source: "mission.acceptance_resume",
      wakeID: "art_current_acceptance_wake",
      taskID: "tsk_current_acceptance",
      missionAcceptanceResume: event.missionAcceptanceResume,
    },
  })
  expect(control?.text).toContain("# Mission Acceptance Repair Control")
  expect(control?.text).toContain(`read_task_message(message_id="${messageID}"`)
  expect(control?.text).toContain("matching real tool call")
  expect(control?.text).toContain("proves only that the Host accepted a prior request to reopen the Task")
  expect(control?.text).toContain("not Mission acceptance of deliverables")
  expect(control?.text).toContain("missionSessionID identifies the originating Mission")
  expect(control?.text).toContain("actual Task-root Session authority")

  expect(authorizedTaskRootMessagesForWake(event)).toEqual([
    {
      messageID,
      kind: "mission",
      expectedSource: "mission.acceptance_resume",
    },
  ])

  const retryControl = currentWakeControlProjection({
    taskID: "tsk_current_acceptance",
    event: OrchestratorEventSchema.parse({
      taskIntent: {
        kind: "retry",
        actor: "operator",
        supersededOperatorMessageIDs: [],
      },
    }),
    wakeID: "art_current_retry_wake",
  })
  expect(retryControl?.text).toContain("proves only that the Host accepted a prior request to reopen the Task")
  expect(retryControl?.text).toContain("not Mission acceptance of deliverables")
})
