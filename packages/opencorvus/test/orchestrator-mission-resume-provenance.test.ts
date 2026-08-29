import { afterEach, expect, spyOn, test } from "bun:test"
import {
  currentOrchestratorControlMessage,
  isCurrentWakeIngress,
  renderWakeProvenanceNotice,
} from "@/orchestrator/agent"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { authorizedTaskRootMessagesForWake } from "@/orchestrator/interaction-tools"
import { ProtocolStore } from "@/protocol/store"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"

afterEach(() => {
  ;(ProtocolStore.requireEvent as { mockRestore?: () => void }).mockRestore?.()
})

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
      },
      acceptanceLedgerRevisionArtifactID: "art_acceptance_ledger_revision",
      acceptanceGap: {
        gap_id: "gap-current-acceptance",
        reviewed_terminal_lifecycle_reference: {
          terminalEventID: "pev_reviewed_terminal_occurrence",
        },
        criteria: [
          {
            criterion_id: "audit-receipt",
            state: "open",
            disposition: "failed",
            finding: "The audit receipt is inconsistent with the canonical output.",
            responsibility: { kind: "workflow_node", workflow_id: "repair", workflow_node_id: "builder" },
            observation_evidence_locators: [
              {
                source: "engine_artifact",
                artifact_id: "art_reviewed_acceptance_evidence",
                catalog_revision: 1,
                expected_sha256: "a".repeat(64),
              },
            ],
            repair_evidence_locators: [],
            resolution_evidence_locators: [],
            invalidating_evidence_locators: [],
            irreducible_blocker_evidence_locators: [],
            repair_action: {
              operation: "correct_artifact",
              target: "audit-receipt",
              expected_evidence_kind: "corrected-audit-receipt",
              parameters: {},
              identity_sha256: "b".repeat(64),
            },
          },
        ],
      },
    },
  })

  const notice = renderWakeProvenanceNotice(event, "tsk_current_acceptance", "art_current_acceptance_wake")

  expect(notice).toContain("Current durable wake occurrence=art_current_acceptance_wake")
  expect(notice).toContain("mission_id=mission-current-acceptance")
  expect(notice).toContain("reviewed_terminal_event=pev_reviewed_terminal_occurrence")
  expect(notice).toContain(`message_id=${messageID}`)
  expect(notice).toContain("acceptance_ledger_revision_artifact_id=art_acceptance_ledger_revision")
  expect(notice).toContain('"gap_id":"gap-current-acceptance"')
  expect(notice).toContain("record at least one current scheduling or lifecycle decision")
  expect(notice).toContain("matching real tool call")
  expect(notice).toContain("no_action alone cannot settle it")
  expect(notice).toContain("complete/fail lifecycle decision")
  expect(isCurrentWakeIngress(event)).toBe(true)

  expect(authorizedTaskRootMessagesForWake(event)).toEqual([
    {
      messageID,
      kind: "mission",
      expectedSource: "mission.acceptance_resume",
    },
  ])

  // An operator message reopening a terminal Task carries no separate intent
  // vocabulary: it is an ordinary operator root message, and the reopen is a
  // durable lifecycle fact rather than something the prompt has to announce.
  const operatorNotice = renderWakeProvenanceNotice(
    OrchestratorEventSchema.parse({
      rootMessage: { messageID: "msg_operator_resume", kind: "operator" },
    }),
    "tsk_current_acceptance",
    "art_current_operator_wake",
  )
  expect(operatorNotice).toContain("Current durable wake occurrence=art_current_operator_wake")
  expect(operatorNotice).not.toContain("taskIntent")
})

test("agent lifecycle delivery projects its exact current occurrence", () => {
  const requireEvent = spyOn(ProtocolStore, "requireEvent").mockReturnValue({
    id: "pev_worker_terminal_delivery",
    kind: "event",
    type: "agent.execution.lifecycle",
    aggregate: "session",
    aggregateID: "ses_worker_terminal_delivery",
    taskID: "tsk_lifecycle_delivery",
    sessionID: "ses_worker_terminal_delivery",
    source: "session.status",
    sequence: 1,
    orderKey: "session:0000000000001:msg_worker_terminal_delivery",
    summary: "Worker completed exact inspection",
    payload: {
      sessionID: "ses_worker_terminal_delivery",
      inputMessageID: "msg_worker_terminal_delivery",
      status: { type: "terminal", reason: "completed", final_message_id: "msg_worker_final_delivery" },
    },
    time: { emitted: 1, created: 1, updated: 1 },
  } as ReturnType<typeof ProtocolStore.requireEvent>)
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
  expect(notice).toContain("CURRENT LIFECYCLE CONTROL FACT")
  expect(notice).toContain("event_id=pev_worker_terminal_delivery")
  expect(notice).toContain("session_id=ses_worker_terminal_delivery")
  expect(notice).toContain("dispatch_id=dispatch_worker_terminal_delivery")
  expect(notice).toContain("input_message_id=msg_worker_terminal_delivery")
  expect(notice).toContain("authoritative_status=terminal/completed")
  expect(notice).toContain('final_message_id="msg_worker_final_delivery"')
  expect(notice).toContain("physical_turn_state=settled")
  expect(notice).toContain("Any earlier assistant text or wait reason")
  expect(notice).toContain("this terminal fact satisfies that wait")
  const control = currentOrchestratorControlMessage(
    OrchestratorEventSchema.parse({
      agentLifecycleDelivery: {
        eventID: "pev_worker_terminal_delivery",
        sessionID: "ses_worker_terminal_delivery",
        dispatchID: "dispatch_worker_terminal_delivery",
      },
    }),
    "tsk_lifecycle_delivery",
    "art_lifecycle_delivery_wake",
    "msg_prior_lifecycle_turn",
  )!
  expect(control).toMatchObject({
    ...orchestratorControlOccurrenceIdentity("art_lifecycle_delivery_wake", "msg_prior_lifecycle_turn"),
    extra: {
      orchestrator_control_ingress: {
        ingress_id: "art_lifecycle_delivery_wake",
        predecessor_id: "msg_prior_lifecycle_turn",
      },
    },
  })
  expect(control.text).toContain("CURRENT LIFECYCLE CONTROL FACT")
  expect(control.text).toContain("authoritative_status=terminal/completed")
  expect(control.text).toContain('final_message_id="msg_worker_final_delivery"')
  expect(requireEvent).toHaveBeenCalledWith("pev_worker_terminal_delivery")
})
