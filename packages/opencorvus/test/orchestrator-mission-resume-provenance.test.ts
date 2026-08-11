import { expect, test } from "bun:test"
import { renderWakeProvenanceNotice } from "@/orchestrator/agent"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { authorizedTaskRootMessagesForWake } from "@/orchestrator/interaction-tools"

test("Mission acceptance resume projects current message authority and real-decision obligation", () => {
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

  const notice = renderWakeProvenanceNotice(event, "tsk_current_acceptance", "art_current_acceptance_wake")

  expect(notice).toContain("Current durable wake occurrence=art_current_acceptance_wake")
  expect(notice).toContain("mission_id=mission-current-acceptance")
  expect(notice).toContain("reviewed_terminal_event=pev_reviewed_terminal_occurrence")
  expect(notice).toContain(`message_id=${messageID}`)
  expect(notice).toContain("Use the real Message identified above when deciding")
  expect(notice).toContain("record at least one current scheduling or lifecycle decision")
  expect(notice).toContain("matching real tool call")

  expect(authorizedTaskRootMessagesForWake(event)).toEqual([
    {
      messageID,
      kind: "mission",
      expectedSource: "mission.acceptance_resume",
    },
  ])

  const retryNotice = renderWakeProvenanceNotice(
    OrchestratorEventSchema.parse({
      taskIntent: {
        kind: "retry",
        actor: "operator",
        supersededOperatorMessageIDs: [],
      },
    }),
    "tsk_current_acceptance",
    "art_current_retry_wake",
  )
  expect(retryNotice).toContain("Current durable wake occurrence=art_current_retry_wake")
  expect(retryNotice).toContain("Current taskIntent=retry; actor=operator")
  expect(retryNotice).toContain("requested a fresh scheduling decision for the same Task")
})

test("agent lifecycle delivery projects its exact current occurrence", () => {
  const notice = renderWakeProvenanceNotice(
    OrchestratorEventSchema.parse({
      agentLifecycleDelivery: {
        eventID: "pev_worker_terminal_delivery",
        sessionID: "ses_worker_terminal_delivery",
        dispatchID: "dispatch_worker_terminal_delivery",
      },
    }),
    "tsk_lifecycle_delivery",
    "art_lifecycle_delivery_wake",
  )

  expect(notice).toContain("Current durable wake occurrence=art_lifecycle_delivery_wake")
  expect(notice).toContain("Current agentLifecycleDelivery")
  expect(notice).toContain("event_id=pev_worker_terminal_delivery")
  expect(notice).toContain("session_id=ses_worker_terminal_delivery")
  expect(notice).toContain("dispatch_id=dispatch_worker_terminal_delivery")
  expect(notice).toContain("durable agent.execution.lifecycle")
})
