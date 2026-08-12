import { describe, expect, test } from "bun:test"
import {
  assertMissionTaskDuplexContract,
  assertMissionTaskTerminalOrder,
  MissionTaskDuplexContractError,
  parseDuplexSchedulerEndpoint,
  type DuplexOccurrence,
  type DuplexSchedulerEndpoint,
} from "../script/mission-task-duplex-contract"

describe("Mission Task duplex checker contract", () => {
  test("accepts exact endpoint authority, correlated reply threads, recipient FIFO, and semantic order", () => {
    const mission = parseDuplexSchedulerEndpoint(
      'scheduler-endpoint:{"kind":"mission_scheduler","project_id":"project-1","mission_id":"mission-1","session_id":"session-mission"}',
    )
    const taskA = parseDuplexSchedulerEndpoint(
      'scheduler-endpoint:{"kind":"task_scheduler","project_id":"project-1","task_id":"task-a","root_session_id":"session-a"}',
    )
    const taskB = parseDuplexSchedulerEndpoint(
      'scheduler-endpoint:{"kind":"task_scheduler","project_id":"project-1","task_id":"task-b","root_session_id":"session-b"}',
    )
    const occurrence = (input: {
      eventID: string
      sequence: number
      emittedAt: number
      kind: DuplexOccurrence["kind"]
      subject: string
      source: DuplexSchedulerEndpoint
      target: DuplexSchedulerEndpoint
      replyTo?: string
      correlationID: string
      threadID: string
    }): DuplexOccurrence => ({ ...input, replyTo: input.replyTo ?? null })

    const readyB = occurrence({
      eventID: "ready-b",
      sequence: 1,
      emittedAt: 1,
      kind: "notification",
      subject: "READY_B nonce",
      source: taskB,
      target: mission,
      correlationID: "ready-b-correlation",
      threadID: "ready-b-thread",
    })
    const readyA = occurrence({
      eventID: "ready-a",
      sequence: 2,
      emittedAt: 2,
      kind: "notification",
      subject: "READY_A nonce",
      source: taskA,
      target: mission,
      correlationID: "ready-a-correlation",
      threadID: "ready-a-thread",
    })
    const startPeer = occurrence({
      eventID: "start-peer",
      sequence: 1,
      emittedAt: 3,
      kind: "request",
      subject: "START_PEER nonce",
      source: mission,
      target: taskA,
      correlationID: "start-correlation",
      threadID: "start-thread",
    })
    const startPeerReply = occurrence({
      eventID: "start-peer-reply",
      sequence: 3,
      emittedAt: 4,
      kind: "reply",
      subject: "START_PEER nonce",
      source: taskA,
      target: mission,
      replyTo: startPeer.eventID,
      correlationID: startPeer.correlationID!,
      threadID: startPeer.threadID,
    })
    const peerRequest = occurrence({
      eventID: "peer-request",
      sequence: 1,
      emittedAt: 5,
      kind: "request",
      subject: "PEER_CONFIRM nonce",
      source: taskA,
      target: taskB,
      correlationID: "peer-correlation",
      threadID: "peer-thread",
    })
    const peerReply = occurrence({
      eventID: "peer-reply",
      sequence: 2,
      emittedAt: 6,
      kind: "reply",
      subject: "PEER_CONFIRM nonce",
      source: taskB,
      target: taskA,
      replyTo: peerRequest.eventID,
      correlationID: peerRequest.correlationID!,
      threadID: peerRequest.threadID,
    })
    const bDone = occurrence({
      eventID: "b-done",
      sequence: 4,
      emittedAt: 7,
      kind: "notification",
      subject: "B_DONE nonce",
      source: taskB,
      target: mission,
      correlationID: "b-done-correlation",
      threadID: "b-done-thread",
    })
    const decisionRequest = occurrence({
      eventID: "decision-request",
      sequence: 5,
      emittedAt: 8,
      kind: "request",
      subject: "DECISION nonce",
      source: taskA,
      target: mission,
      correlationID: "decision-correlation",
      threadID: "decision-thread",
    })
    const decisionReply = occurrence({
      eventID: "decision-reply",
      sequence: 3,
      emittedAt: 9,
      kind: "reply",
      subject: "DECISION nonce",
      source: mission,
      target: taskA,
      replyTo: decisionRequest.eventID,
      correlationID: decisionRequest.correlationID!,
      threadID: decisionRequest.threadID,
    })
    const aDone = occurrence({
      eventID: "a-done",
      sequence: 6,
      emittedAt: 10,
      kind: "notification",
      subject: "A_DONE nonce",
      source: taskA,
      target: mission,
      correlationID: "a-done-correlation",
      threadID: "a-done-thread",
    })

    expect(
      assertMissionTaskDuplexContract({
        authority: {
          projectID: "project-1",
          missionID: "mission-1",
          missionSessionID: "session-mission",
          taskA: { id: "task-a", rootSessionID: "session-a" },
          taskB: { id: "task-b", rootSessionID: "session-b" },
        },
        chain: {
          readyA,
          readyB,
          startPeer,
          startPeerReply,
          peerRequest,
          peerReply,
          decisionRequest,
          decisionReply,
          bDone,
          aDone,
        },
      }),
    ).toEqual({ exactEndpoints: true, correlatedReplies: 3, recipientFIFO: true, semanticOrder: true })

    expect(
      assertMissionTaskTerminalOrder({
        authority: {
          projectID: "project-1",
          missionID: "mission-1",
          missionSessionID: "session-mission",
          taskA: { id: "task-a", rootSessionID: "session-a" },
          taskB: { id: "task-b", rootSessionID: "session-b" },
        },
        aDone,
        bDone,
        terminalA: occurrence({
          eventID: "terminal-a",
          sequence: 8,
          emittedAt: 12,
          kind: "notification",
          subject: "Task A completed",
          source: taskA,
          target: mission,
          correlationID: "terminal-a-correlation",
          threadID: "terminal-a-thread",
        }),
        terminalB: occurrence({
          eventID: "terminal-b",
          sequence: 7,
          emittedAt: 11,
          kind: "notification",
          subject: "Task B completed",
          source: taskB,
          target: mission,
          correlationID: "terminal-b-correlation",
          threadID: "terminal-b-thread",
        }),
      }),
    ).toEqual({ terminalNotificationsAfterDone: true })
  })

  test("maps an ambiguous cross-recipient timestamp to the typed checker contract error", () => {
    const mission: DuplexSchedulerEndpoint = {
      kind: "mission_scheduler",
      project_id: "project-1",
      mission_id: "mission-1",
      session_id: "session-mission",
    }
    const taskA: DuplexSchedulerEndpoint = {
      kind: "task_scheduler",
      project_id: "project-1",
      task_id: "task-a",
      root_session_id: "session-a",
    }
    const taskB: DuplexSchedulerEndpoint = {
      kind: "task_scheduler",
      project_id: "project-1",
      task_id: "task-b",
      root_session_id: "session-b",
    }
    const occurrence = (
      eventID: string,
      sequence: number,
      emittedAt: number,
      kind: DuplexOccurrence["kind"],
      source: DuplexSchedulerEndpoint,
      target: DuplexSchedulerEndpoint,
      correlationID: string,
      threadID: string,
      replyTo: string | null = null,
    ): DuplexOccurrence => ({
      eventID,
      sequence,
      emittedAt,
      kind,
      subject: eventID,
      source,
      target,
      replyTo,
      correlationID,
      threadID,
    })
    const readyA = occurrence("READY_A", 1, 1, "notification", taskA, mission, "ready-a", "ready-a")
    const readyB = occurrence("READY_B", 2, 1, "notification", taskB, mission, "ready-b", "ready-b")
    const startPeer = occurrence("START_PEER", 1, 1, "request", mission, taskA, "start", "start")
    const startPeerReply = occurrence("START_REPLY", 3, 2, "reply", taskA, mission, "start", "start", startPeer.eventID)
    const peerRequest = occurrence("PEER_CONFIRM", 1, 3, "request", taskA, taskB, "peer", "peer")
    const peerReply = occurrence("PEER_REPLY", 2, 4, "reply", taskB, taskA, "peer", "peer", peerRequest.eventID)
    const decisionRequest = occurrence("DECISION", 4, 5, "request", taskA, mission, "decision", "decision")
    const decisionReply = occurrence("DECISION_REPLY", 3, 6, "reply", mission, taskA, "decision", "decision", decisionRequest.eventID)
    const bDone = occurrence("B_DONE", 5, 7, "notification", taskB, mission, "b-done", "b-done")
    const aDone = occurrence("A_DONE", 6, 8, "notification", taskA, mission, "a-done", "a-done")

    expect(() =>
      assertMissionTaskDuplexContract({
        authority: {
          projectID: "project-1",
          missionID: "mission-1",
          missionSessionID: "session-mission",
          taskA: { id: "task-a", rootSessionID: "session-a" },
          taskB: { id: "task-b", rootSessionID: "session-b" },
        },
        chain: {
          readyA,
          readyB,
          startPeer,
          startPeerReply,
          peerRequest,
          peerReply,
          decisionRequest,
          decisionReply,
          bDone,
          aDone,
        },
      }),
    ).toThrow(MissionTaskDuplexContractError)
  })
})
