export type DuplexSchedulerEndpoint =
  | {
      kind: "mission_scheduler"
      project_id: string
      mission_id: string
      session_id: string
    }
  | {
      kind: "task_scheduler"
      project_id: string
      task_id: string
      root_session_id: string
    }

export type DuplexOccurrence = {
  eventID: string
  sequence: number
  emittedAt: number
  kind: "request" | "reply" | "notification"
  subject: string
  source: DuplexSchedulerEndpoint
  target: DuplexSchedulerEndpoint
  replyTo: string | null
  correlationID: string | null
  threadID: string
}

export type MissionTaskDuplexChain = {
  readyA: DuplexOccurrence
  readyB: DuplexOccurrence
  startPeer: DuplexOccurrence
  startPeerReply: DuplexOccurrence
  peerRequest: DuplexOccurrence
  peerReply: DuplexOccurrence
  decisionRequest: DuplexOccurrence
  decisionReply: DuplexOccurrence
  bDone: DuplexOccurrence
  aDone: DuplexOccurrence
}

export type MissionTaskDuplexAuthority = {
  projectID: string
  missionID: string
  missionSessionID: string
  taskA: { id: string; rootSessionID: string }
  taskB: { id: string; rootSessionID: string }
}

export class MissionTaskDuplexContractError extends Error {
  override name = "MissionTaskDuplexContractError"
}

const ENDPOINT_PREFIX = "scheduler-endpoint:"

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string.`)
  return value
}

export function parseDuplexSchedulerEndpoint(value: string | null): DuplexSchedulerEndpoint {
  if (!value?.startsWith(ENDPOINT_PREFIX)) throw new Error(`Scheduler endpoint is missing ${ENDPOINT_PREFIX}.`)
  const parsed = JSON.parse(value.slice(ENDPOINT_PREFIX.length)) as Record<string, unknown>
  if (parsed.kind === "mission_scheduler") {
    return {
      kind: parsed.kind,
      project_id: requireString(parsed.project_id, "Mission endpoint project_id"),
      mission_id: requireString(parsed.mission_id, "Mission endpoint mission_id"),
      session_id: requireString(parsed.session_id, "Mission endpoint session_id"),
    }
  }
  if (parsed.kind === "task_scheduler") {
    return {
      kind: parsed.kind,
      project_id: requireString(parsed.project_id, "Task endpoint project_id"),
      task_id: requireString(parsed.task_id, "Task endpoint task_id"),
      root_session_id: requireString(parsed.root_session_id, "Task endpoint root_session_id"),
    }
  }
  throw new Error(`Unsupported scheduler endpoint kind ${String(parsed.kind)}.`)
}

function endpointIdentity(endpoint: DuplexSchedulerEndpoint) {
  return JSON.stringify(endpoint)
}

function assertEndpoint(actual: DuplexSchedulerEndpoint, expected: DuplexSchedulerEndpoint, label: string) {
  if (endpointIdentity(actual) !== endpointIdentity(expected)) {
    throw new Error(`${label} endpoint authority mismatch: ${endpointIdentity(actual)}.`)
  }
}

function assertOccurrence(
  occurrence: DuplexOccurrence,
  expected: {
    kind: DuplexOccurrence["kind"]
    source: DuplexSchedulerEndpoint
    target: DuplexSchedulerEndpoint
  },
  label: string,
) {
  if (occurrence.kind !== expected.kind) throw new Error(`${label} kind is ${occurrence.kind}, not ${expected.kind}.`)
  if (!Number.isInteger(occurrence.sequence) || occurrence.sequence <= 0) {
    throw new Error(`${label} protocol sequence must be positive.`)
  }
  if (!Number.isInteger(occurrence.emittedAt) || occurrence.emittedAt <= 0) {
    throw new Error(`${label} emitted_at must be positive.`)
  }
  requireString(occurrence.threadID, `${label} thread_id`)
  assertEndpoint(occurrence.source, expected.source, `${label} source`)
  assertEndpoint(occurrence.target, expected.target, `${label} target`)
}

function assertReply(request: DuplexOccurrence, reply: DuplexOccurrence, label: string) {
  if (reply.replyTo !== request.eventID) throw new Error(`${label} does not resolve the exact request event.`)
  if (!request.correlationID || reply.correlationID !== request.correlationID) {
    throw new Error(`${label} correlation_id drifted from its request.`)
  }
  if (reply.threadID !== request.threadID) throw new Error(`${label} thread_id drifted from its request.`)
  assertEndpoint(reply.source, request.target, `${label} reversed source`)
  assertEndpoint(reply.target, request.source, `${label} reversed target`)
}

function assertBefore(before: DuplexOccurrence, after: DuplexOccurrence, label: string) {
  if (endpointIdentity(before.target) === endpointIdentity(after.target)) {
    if (before.sequence >= after.sequence) throw new Error(`${label} violates recipient protocol sequence order.`)
    return
  }
  if (before.emittedAt >= after.emittedAt) {
    throw new MissionTaskDuplexContractError(`${label} lacks a strict immutable emission order.`)
  }
}

export function assertMissionTaskDuplexContract(input: {
  authority: MissionTaskDuplexAuthority
  chain: MissionTaskDuplexChain
}) {
  const { authority, chain } = input
  const mission: DuplexSchedulerEndpoint = {
    kind: "mission_scheduler",
    project_id: authority.projectID,
    mission_id: authority.missionID,
    session_id: authority.missionSessionID,
  }
  const taskA: DuplexSchedulerEndpoint = {
    kind: "task_scheduler",
    project_id: authority.projectID,
    task_id: authority.taskA.id,
    root_session_id: authority.taskA.rootSessionID,
  }
  const taskB: DuplexSchedulerEndpoint = {
    kind: "task_scheduler",
    project_id: authority.projectID,
    task_id: authority.taskB.id,
    root_session_id: authority.taskB.rootSessionID,
  }

  assertOccurrence(chain.readyA, { kind: "notification", source: taskA, target: mission }, "READY_A")
  assertOccurrence(chain.readyB, { kind: "notification", source: taskB, target: mission }, "READY_B")
  assertOccurrence(chain.startPeer, { kind: "request", source: mission, target: taskA }, "START_PEER")
  assertOccurrence(chain.startPeerReply, { kind: "reply", source: taskA, target: mission }, "START_PEER reply")
  assertOccurrence(chain.peerRequest, { kind: "request", source: taskA, target: taskB }, "PEER_CONFIRM")
  assertOccurrence(chain.peerReply, { kind: "reply", source: taskB, target: taskA }, "PEER_CONFIRM reply")
  assertOccurrence(chain.decisionRequest, { kind: "request", source: taskA, target: mission }, "DECISION")
  assertOccurrence(chain.decisionReply, { kind: "reply", source: mission, target: taskA }, "DECISION reply")
  assertOccurrence(chain.bDone, { kind: "notification", source: taskB, target: mission }, "B_DONE")
  assertOccurrence(chain.aDone, { kind: "notification", source: taskA, target: mission }, "A_DONE")

  assertReply(chain.startPeer, chain.startPeerReply, "START_PEER reply")
  assertReply(chain.peerRequest, chain.peerReply, "PEER_CONFIRM reply")
  assertReply(chain.decisionRequest, chain.decisionReply, "DECISION reply")

  const semanticEdges: Array<[DuplexOccurrence, DuplexOccurrence, string]> = [
    [chain.readyA, chain.startPeer, "READY_A before START_PEER"],
    [chain.readyB, chain.startPeer, "READY_B before START_PEER"],
    [chain.startPeer, chain.startPeerReply, "START_PEER request before reply"],
    [chain.startPeerReply, chain.peerRequest, "START_PEER reply before PEER_CONFIRM"],
    [chain.peerRequest, chain.peerReply, "PEER_CONFIRM request before reply"],
    [chain.peerReply, chain.bDone, "PEER_CONFIRM reply before B_DONE"],
    [chain.peerReply, chain.decisionRequest, "PEER_CONFIRM reply before DECISION"],
    [chain.decisionRequest, chain.decisionReply, "DECISION request before reply"],
    [chain.decisionReply, chain.aDone, "DECISION reply before A_DONE"],
  ]
  for (const [before, after, label] of semanticEdges) assertBefore(before, after, label)

  const byRecipient = new Map<string, DuplexOccurrence[]>()
  for (const occurrence of Object.values(chain)) {
    const key = endpointIdentity(occurrence.target)
    byRecipient.set(key, [...(byRecipient.get(key) ?? []), occurrence])
  }
  for (const occurrences of byRecipient.values()) {
    const protocolOrder = occurrences.toSorted((left, right) => left.sequence - right.sequence)
    for (let index = 1; index < protocolOrder.length; index += 1) {
      if (protocolOrder[index - 1]!.sequence >= protocolOrder[index]!.sequence) {
        throw new Error(`Recipient protocol sequence is not a strict total order.`)
      }
      if (protocolOrder[index - 1]!.emittedAt > protocolOrder[index]!.emittedAt) {
        throw new Error(`Recipient protocol sequence reverses immutable emission order.`)
      }
    }
  }

  return {
    exactEndpoints: true,
    correlatedReplies: 3,
    recipientFIFO: true,
    semanticOrder: true,
  } as const
}

export function assertMissionTaskTerminalOrder(input: {
  authority: MissionTaskDuplexAuthority
  aDone: DuplexOccurrence
  bDone: DuplexOccurrence
  terminalA: DuplexOccurrence
  terminalB: DuplexOccurrence
}) {
  const mission: DuplexSchedulerEndpoint = {
    kind: "mission_scheduler",
    project_id: input.authority.projectID,
    mission_id: input.authority.missionID,
    session_id: input.authority.missionSessionID,
  }
  const taskA: DuplexSchedulerEndpoint = {
    kind: "task_scheduler",
    project_id: input.authority.projectID,
    task_id: input.authority.taskA.id,
    root_session_id: input.authority.taskA.rootSessionID,
  }
  const taskB: DuplexSchedulerEndpoint = {
    kind: "task_scheduler",
    project_id: input.authority.projectID,
    task_id: input.authority.taskB.id,
    root_session_id: input.authority.taskB.rootSessionID,
  }
  assertOccurrence(input.terminalA, { kind: "notification", source: taskA, target: mission }, "Task A terminal")
  assertOccurrence(input.terminalB, { kind: "notification", source: taskB, target: mission }, "Task B terminal")
  assertBefore(input.aDone, input.terminalA, "A_DONE before Task A terminal")
  assertBefore(input.bDone, input.terminalB, "B_DONE before Task B terminal")
  return { terminalNotificationsAfterDone: true } as const
}
