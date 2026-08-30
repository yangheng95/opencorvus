import { createHash, randomUUID } from "node:crypto"
import { Database, DatabaseEffectAdmissionClosedError, eq } from "@/storage/db"
import { Instance, InstanceProcessAdmissionClosedError } from "@/project/instance"
import { Project } from "@/project/project"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { Scheduler } from "@/scheduler"
import { Log } from "@/util/log"
import type { SessionWake } from "@/session/wake"
import type { EngineService } from "@/task-api"
import { ProtocolStore } from "./store"
import {
  assertSchedulerTargetOccurrenceAvailableInTransaction,
  claimNextSchedulerDelivery,
  deadLetterSchedulerDelivery,
  decodeSchedulerEndpoint,
  encodeSchedulerEndpoint,
  enqueueSchedulerMessageInTransaction,
  findSchedulerDelivery,
  listPendingSchedulerProjectIDs,
  listPendingSchedulerRecipientIDs,
  listUnansweredSchedulerSessionWakes,
  nextSchedulerDeliveryDueAt,
  renderSchedulerParticipantMessage,
  requireSchedulerDelivery,
  rescheduleSchedulerDelivery,
  schedulerSessionWakeNeedsRecovery,
  assertMissionSchedulerOccurrenceAdmission,
  missionSchedulerOccurrenceDispositionForEnvelope,
  schedulerTargetOccurrenceIdentity,
  schedulerSourceBodyInTransaction,
  SchedulerMessageConflictError,
  MissionSchedulerOccurrenceClosedError,
  SchedulerTargetOccurrenceStaleError,
  settleSchedulerDeliveryInTransaction,
  type SchedulerDeliveryReceipt,
} from "./delivery"
import { SchedulerEndpoint, SchedulerMessagePayload, type SchedulerMessageKind } from "./schema"
import { installSchedulerMessageDrainSignal, signalSchedulerMessageDrain } from "./scheduler-drain-signal"
import { RuntimeExecutionAdmissionClosedError } from "@/runtime/execution-settlement"
import {
  admitMissionExecutionWake,
  currentMissionExecutionClosure,
} from "@/mission/execution-closure"
import { requireMissionSession } from "@/mission/session"

const DELIVERY_LEASE_MS = 120_000
const MAX_DELIVERY_ATTEMPTS = 5
const DELIVERY_POLL_INTERVAL_MS = 1_000
const DELIVERY_RECIPIENT_PAGE_SIZE = 32
const DELIVERY_RECIPIENT_CONCURRENCY = 4
const DELIVERY_PROJECT_PAGE_SIZE = 32
const DELIVERY_PROJECT_CONCURRENCY = 4
const log = Log.create({ service: "scheduler-message-delivery" })
const drainTails = new Map<string, Promise<void>>()
let beforeMissionMaterializationForTest: (() => void | Promise<void>) | undefined
let beforeTaskMaterializationForTest: (() => void | Promise<void>) | undefined
let beforeGlobalPollForTest: (() => void | Promise<void>) | undefined
let signalDrainFailureReportForTest: ((error: unknown) => void) | undefined
type TaskDeliveryMaterializer = typeof EngineService.materializeClaimedSchedulerMessageToTask
type SessionWakePort = Pick<typeof SessionWake, "resumePersistedWakeWithReceipt" | "wakeWithReceipt">
let taskDeliveryMaterializer: TaskDeliveryMaterializer | undefined
let sessionWake: SessionWakePort | undefined

function requireTaskDeliveryMaterializer(): TaskDeliveryMaterializer {
  if (!taskDeliveryMaterializer) {
    throw new Error("Scheduler Message Task delivery materializer is not bound by Project bootstrap.")
  }
  return taskDeliveryMaterializer
}

function requireSessionWake(): SessionWakePort {
  if (!sessionWake) throw new Error("Scheduler Message Session wake port is not bound by Project bootstrap.")
  return sessionWake
}

function sameEndpoint(left: SchedulerEndpoint, right: SchedulerEndpoint) {
  return encodeSchedulerEndpoint(left) === encodeSchedulerEndpoint(right)
}

export async function sendSchedulerMessage(input: {
  invocationID: string
  kind: SchedulerMessageKind
  source: SchedulerEndpoint
  target?: SchedulerEndpoint
  replyTo?: string
  subject: string
  sourceMessageID?: string
  sourcePartID?: string
  sourceTerminalEventID?: string
}): Promise<SchedulerDeliveryReceipt & { messageID?: string; ingressID?: string; wakeStatus?: string }> {
  const source = SchedulerEndpoint.parse(input.source)
  let target: SchedulerEndpoint
  let correlationID: string
  let threadID: string
  if (input.kind === "reply") {
    if (!input.replyTo) throw new Error(`scheduler_message reply requires reply_to.`)
    const request = ProtocolStore.requireEvent(input.replyTo)
    if (request.type !== "scheduler.message" || request.kind !== "command" || !request.target) {
      throw new Error(`scheduler_message reply_to ${input.replyTo} is not a scheduler request.`)
    }
    const requestPayload = SchedulerMessagePayload.parse(request.payload)
    if (requestPayload.message_kind !== "request") {
      throw new Error(`scheduler_message reply_to ${input.replyTo} is not a request.`)
    }
    const requestTarget = decodeSchedulerEndpoint(request.target)
    if (!sameEndpoint(requestTarget, source)) {
      throw new Error(`scheduler_message source is not the target of request ${input.replyTo}.`)
    }
    target = decodeSchedulerEndpoint(request.source)
    if (input.target && !sameEndpoint(input.target, target)) {
      throw new Error(`scheduler_message reply target must be the original request source.`)
    }
    correlationID = request.correlationID ?? request.id
    threadID = requestPayload.thread_id
  } else {
    if (input.replyTo) throw new Error(`Only scheduler_message reply may set reply_to.`)
    if (!input.target) throw new Error(`scheduler_message ${input.kind} requires target.`)
    target = SchedulerEndpoint.parse(input.target)
    correlationID = input.invocationID
    threadID = input.invocationID
  }

  const receipt = Database.transaction((db) => {
    const persisted = enqueueSchedulerMessageInTransaction(db, {
      invocationID: input.invocationID,
      kind: input.kind,
      source,
      target,
      subject: input.subject,
      sourceMessageID: input.sourceMessageID,
      sourcePartID: input.sourcePartID,
      sourceTerminalEventID: input.sourceTerminalEventID,
      correlationID,
      threadID,
      replyTo: input.replyTo,
    })
    Database.effect(() => signalSchedulerMessageDrain())
    return persisted
  })
  if (target.kind === "task_scheduler") {
    const wakeStatus =
      receipt.status !== "delivered" && receipt.status !== "dead_letter"
        ? await drainTaskRecipient(target.task_id, receipt.inboxID)
        : undefined
    const delivered = requireSchedulerDelivery(receipt.inboxID)
    if (delivered.deliveryResult?.kind === "task_ingress") {
      return {
        ...receipt,
        status: delivered.status,
        messageID: delivered.deliveryResult.message_id,
        ingressID: delivered.deliveryResult.ingress_id,
        ...(wakeStatus ? { wakeStatus } : {}),
      }
    }
    return { ...receipt, status: delivered.status }
  }
  requestSchedulerMessageDrain()
  const current = findSchedulerDelivery(receipt.inboxID)
  if (current?.deliveryResult?.kind === "task_ingress") {
    return {
      ...receipt,
      status: current.status,
      messageID: current.deliveryResult.message_id,
      ingressID: current.deliveryResult.ingress_id,
    }
  }
  return { ...receipt, status: current?.status ?? receipt.status }
}

async function sourceMessageText(delivery: ReturnType<typeof requireSchedulerDelivery>): Promise<string> {
  const body = Database.use((db) =>
    schedulerSourceBodyInTransaction(db, {
      source: delivery.source,
      sourceMessageID: delivery.message.source_message_id,
      sourcePartID: delivery.message.source_part_id,
      sourceTerminalEventID: delivery.message.source_terminal_event_id,
    }),
  )
  const digest = createHash("sha256").update(body).digest("hex")
  if (digest !== delivery.message.source_body_sha256) {
    throw new Error(`Scheduler event ${delivery.event.id} source body changed after enqueue.`)
  }
  return body
}

async function drainMissionRecipient(sessionID: string): Promise<void> {
  while (true) {
    const ownerID = `scheduler-message:${process.pid}:${randomUUID()}`
    const claimed = claimNextSchedulerDelivery({
      actor: "session",
      actorID: sessionID,
      ownerID,
      leaseMilliseconds: DELIVERY_LEASE_MS,
    })
    if (!claimed) return
    try {
      const delivery = requireSchedulerDelivery(claimed.id)
      if (delivery.target.kind !== "mission_scheduler" || delivery.target.session_id !== sessionID) {
        throw new Error(`Scheduler inbox ${claimed.id} target does not match recipient Mission Session.`)
      }
      const message = await sourceMessageText(delivery)
      const ids = schedulerTargetOccurrenceIdentity(delivery.id)
      const disposition = missionSchedulerOccurrenceDispositionForEnvelope(sessionID, delivery.event.id)
      if (disposition.kind === "mission_closed") {
        Database.immediateTransaction((db) =>
          settleSchedulerDeliveryInTransaction(db, {
            inboxID: delivery.id,
            ownerID,
            result: { kind: "mission_closed", closure_event_id: disposition.closureEventID },
          }),
        )
        continue
      }
      await beforeMissionMaterializationForTest?.()
      const mission = await requireMissionSession(sessionID)
      const receipt = await admitMissionExecutionWake({
        missionID: mission.missionID,
        sessionID,
        wake: async (missionAdmission) => {
          assertMissionSchedulerOccurrenceAdmission({
            sessionID,
            openedEventID: disposition.openedEventID,
            admissionOpenedEventID: missionAdmission.closureEventID,
          })
          const wakeReceipt = await requireSessionWake().wakeWithReceipt({
            sessionID,
            messageID: ids.messageID,
            textPartID: ids.textPartID,
            controlID: ids.controlID,
            author: "orchestrator",
            agent: "mission",
            surface: "panel",
            reason: {
              source: "scheduler.message",
              eventID: delivery.event.id,
              inboxID: delivery.id,
              threadID: delivery.message.thread_id,
              messageKind: delivery.message.message_kind,
              sourceEndpoint: delivery.source,
              targetEndpoint: delivery.target,
              ...(delivery.event.replyTo ? { replyTo: delivery.event.replyTo } : {}),
            },
            prompt: renderSchedulerParticipantMessage({
              eventID: delivery.event.id,
              kind: delivery.message.message_kind,
              source: delivery.source,
              threadID: delivery.message.thread_id,
              replyTo: delivery.event.replyTo,
              subject: delivery.message.subject,
              message,
            }),
            commitBundle: (userMessage) => {
              if (userMessage.id !== ids.messageID) {
                throw new Error(`Scheduler inbox ${delivery.id} materialized an unexpected Mission Message.`)
              }
              Database.use((db) => {
                const currentBody = schedulerSourceBodyInTransaction(db, {
                  source: delivery.source,
                  sourceMessageID: delivery.message.source_message_id,
                  sourcePartID: delivery.message.source_part_id,
                  sourceTerminalEventID: delivery.message.source_terminal_event_id,
                })
                const currentDigest = createHash("sha256").update(currentBody).digest("hex")
                if (currentDigest !== delivery.message.source_body_sha256 || currentBody !== message) {
                  throw new Error(
                    `Scheduler event ${delivery.event.id} source body changed before Mission materialization.`,
                  )
                }
                settleSchedulerDeliveryInTransaction(db, {
                  inboxID: delivery.id,
                  ownerID,
                  result: { kind: "session_wake", message_id: userMessage.id },
                })
              })
            },
            preflightBundle: (userMessage, parts) => {
              missionAdmission.preflightBundle(userMessage, parts)
              const textPart = parts.find((part) => part.id === ids.textPartID)
              if (!textPart) {
                throw new SchedulerMessageConflictError({
                  message: `Scheduler inbox ${delivery.id} did not materialize its exact text Part.`,
                  eventID: delivery.event.id,
                })
              }
              Database.use((db) =>
                assertSchedulerTargetOccurrenceAvailableInTransaction(db, {
                  inboxID: delivery.id,
                  messageID: userMessage.id,
                  textPartID: textPart.id,
                  controlID: ids.controlID,
                }),
              )
            },
            ownerPreflight: missionAdmission.ownerPreflight,
            ownerLifecycle: missionAdmission.ownerLifecycle,
          })
          await wakeReceipt.activation
          return wakeReceipt
        },
      })
      await receipt.completion
    } catch (error) {
      const current = requireSchedulerDelivery(claimed.id)
      if (current.status !== "leased" || current.leaseOwner !== ownerID) continue
      if (MissionSchedulerOccurrenceClosedError.isInstance(error)) {
        Database.immediateTransaction((db) =>
          settleSchedulerDeliveryInTransaction(db, {
            inboxID: current.id,
            ownerID,
            result: { kind: "mission_closed", closure_event_id: error.data.closureEventID },
          }),
        )
        continue
      }
      if (current.attempt >= MAX_DELIVERY_ATTEMPTS) {
        deadLetterSchedulerDelivery({ inboxID: current.id, ownerID, error })
        continue
      }
      const delay = Math.min(30_000, 500 * 2 ** Math.max(0, current.attempt - 1))
      rescheduleSchedulerDelivery({
        inboxID: current.id,
        ownerID,
        error,
        visibleAt: Date.now() + delay,
      })
      return
    }
  }
}

async function drainTaskRecipient(taskID: string, awaitedInboxID?: string): Promise<string | undefined> {
  let awaitedWakeStatus: string | undefined
  while (true) {
    const ownerID = `scheduler-message:${process.pid}:${randomUUID()}`
    const claimed = claimNextSchedulerDelivery({
      actor: "task",
      actorID: taskID,
      ownerID,
      leaseMilliseconds: DELIVERY_LEASE_MS,
    })
    if (!claimed) return awaitedWakeStatus
    try {
      const delivery = requireSchedulerDelivery(claimed.id)
      if (delivery.target.kind !== "task_scheduler" || delivery.target.task_id !== taskID) {
        throw new Error(`Scheduler inbox ${claimed.id} target does not match recipient Task.`)
      }
      const message = await sourceMessageText(delivery)
      await beforeTaskMaterializationForTest?.()
      const result = await requireTaskDeliveryMaterializer()({
        inboxID: delivery.id,
        ownerID,
        message,
      })
      if (delivery.id === awaitedInboxID) awaitedWakeStatus = result.wakeStatus
    } catch (error) {
      const current = requireSchedulerDelivery(claimed.id)
      if (current.status !== "leased" || current.leaseOwner !== ownerID) continue
      if (
        current.attempt >= MAX_DELIVERY_ATTEMPTS ||
        /after its active root changed/.test(String(error)) ||
        SchedulerTargetOccurrenceStaleError.isInstance(error)
      ) {
        deadLetterSchedulerDelivery({ inboxID: current.id, ownerID, error })
        continue
      }
      const delay = Math.min(30_000, 500 * 2 ** Math.max(0, current.attempt - 1))
      rescheduleSchedulerDelivery({
        inboxID: current.id,
        ownerID,
        error,
        visibleAt: Date.now() + delay,
      })
      return awaitedWakeStatus
    }
  }
}

export async function drainSchedulerMessagesForCurrentProject(input?: {
  excludeSessionIDs?: ReadonlySet<string>
}): Promise<void> {
  const current = Instance.current()
  if (!current) return
  let afterWakeInboxID: string | undefined
  while (true) {
    const wakes = listUnansweredSchedulerSessionWakes({
      projectID: current.project.id,
      afterInboxID: afterWakeInboxID,
      limit: 64,
    })
    if (wakes.length === 0) break
    for (const wake of wakes) {
      if (input?.excludeSessionIDs?.has(wake.sessionID)) continue
      const closure = currentMissionExecutionClosure(wake.sessionID)
      if (closure?.state === "closing" || closure?.state === "closed") continue
      if (!schedulerSessionWakeNeedsRecovery(wake)) continue
      const mission = await requireMissionSession(wake.sessionID)
      const reconciliation = await admitMissionExecutionWake({
        missionID: mission.missionID,
        sessionID: wake.sessionID,
        wake: async (missionAdmission) => {
          assertMissionSchedulerOccurrenceAdmission({
            sessionID: wake.sessionID,
            openedEventID: wake.openedEventID,
            admissionOpenedEventID: missionAdmission.closureEventID,
          })
          const receipt = requireSessionWake().resumePersistedWakeWithReceipt({
            sessionID: wake.sessionID,
            messageID: wake.messageID,
            directory: current.project.worktree,
            retryFailedReply: true,
            ownerPreflight: missionAdmission.ownerPreflight,
            ownerLifecycle: missionAdmission.ownerLifecycle,
          })
          await receipt.activation
          return { activation: Promise.resolve(undefined), completion: receipt.completion }
        },
      })
      if (reconciliation) await reconciliation.completion
    }
    afterWakeInboxID = wakes.at(-1)!.inboxID
  }

  await drainRecipientPages({
    actor: "session",
    projectID: current.project.id,
    excludeActorIDs: input?.excludeSessionIDs,
    drain: drainMissionRecipient,
  })
  await drainRecipientPages({ actor: "task", projectID: current.project.id, drain: drainTaskRecipient })
}

async function drainRecipientPages(input: {
  actor: "task" | "session"
  projectID: string
  excludeActorIDs?: ReadonlySet<string>
  drain: (actorID: string) => Promise<unknown>
}): Promise<void> {
  let afterActorID: string | undefined
  while (true) {
    const actorIDs = listPendingSchedulerRecipientIDs({
      actor: input.actor,
      projectID: input.projectID,
      afterActorID,
      limit: DELIVERY_RECIPIENT_PAGE_SIZE,
    })
    if (actorIDs.length === 0) return
    for (let offset = 0; offset < actorIDs.length; offset += DELIVERY_RECIPIENT_CONCURRENCY) {
      const batch = actorIDs
        .slice(offset, offset + DELIVERY_RECIPIENT_CONCURRENCY)
        .filter((actorID) => !input.excludeActorIDs?.has(actorID))
      const settled = await Promise.allSettled(batch.map((actorID) => input.drain(actorID)))
      const failures = settled.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) {
        throw new AggregateError(failures, `Scheduler ${input.actor} recipient drain batch failed`)
      }
    }
    afterActorID = actorIDs.at(-1)
  }
}

async function pollSchedulerMessageDeliveries(signal: AbortSignal): Promise<void> {
  await beforeGlobalPollForTest?.()
  const now = Date.now()
  let afterProjectID: string | undefined
  while (true) {
    const projectIDs = listPendingSchedulerProjectIDs({
      afterProjectID,
      limit: DELIVERY_PROJECT_PAGE_SIZE,
    })
    if (projectIDs.length === 0) return
    for (let offset = 0; offset < projectIDs.length; offset += DELIVERY_PROJECT_CONCURRENCY) {
      if (signal.aborted) throw signal.reason
      const drains = projectIDs.slice(offset, offset + DELIVERY_PROJECT_CONCURRENCY).flatMap((projectID) => {
        const dueAt = nextSchedulerDeliveryDueAt(projectID, now)
        const hasUnansweredWake = listUnansweredSchedulerSessionWakes({ projectID, limit: 1 }).length > 0
        if (!hasUnansweredWake && (dueAt === undefined || dueAt > now)) return []
        const project = Project.get(projectID)
        return project ? [requestSchedulerMessageDrainForProject(projectID, project.worktree, signal)] : []
      })
      const results = await Promise.allSettled(drains)
      if (signal.aborted) throw signal.reason
      const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) throw new AggregateError(failures, "Scheduler Message Project drain batch failed")
    }
    afterProjectID = projectIDs.at(-1)
  }
}

export function requestSchedulerMessageDrain(): void {
  const current = Instance.current()
  if (!current) return
  void requestSchedulerMessageDrainForProject(current.project.id, current.project.worktree).catch((error) => {
    handleSignalDrainFailure(error)
  })
}

function handleSignalDrainFailure(error: unknown): "lifecycle_closed" | "reported" {
  if (
    error instanceof InstanceProcessAdmissionClosedError ||
    error instanceof DatabaseEffectAdmissionClosedError ||
    error instanceof RuntimeExecutionAdmissionClosedError
  ) {
    return "lifecycle_closed"
  }
  signalDrainFailureReportForTest?.(error)
  log.error("signal drain failed", { error })
  return "reported"
}

export function drainSchedulerMessagesForProject(input?: { excludeSessionIDs?: ReadonlySet<string> }): Promise<void> {
  const current = Instance.current()
  if (!current) return Promise.resolve()
  return requestSchedulerMessageDrainForProject(current.project.id, current.project.worktree, undefined, input)
}

function requestSchedulerMessageDrainForProject(
  key: string,
  directory: string,
  signal?: AbortSignal,
  input?: { excludeSessionIDs?: ReadonlySet<string> },
): Promise<void> {
  const active = drainTails.get(key)
  if (active) return active
  const next = Database.runOutsideContext(() =>
    runWithInitializedIndependentProject({
      directory,
      signal,
      fn: () => drainSchedulerMessagesForCurrentProject(input),
    }),
  ).finally(() => {
    if (drainTails.get(key) === next) drainTails.delete(key)
  })
  drainTails.set(key, next)
  return next
}

installSchedulerMessageDrainSignal(requestSchedulerMessageDrain)

export namespace SchedulerMessageDeliveryService {
  export function bindSessionWake(next: SessionWakePort): void {
    const bound = Object.freeze({
      wakeWithReceipt: next.wakeWithReceipt,
      resumePersistedWakeWithReceipt: next.resumePersistedWakeWithReceipt,
    }) satisfies SessionWakePort
    if (
      sessionWake &&
      (sessionWake.wakeWithReceipt !== bound.wakeWithReceipt ||
        sessionWake.resumePersistedWakeWithReceipt !== bound.resumePersistedWakeWithReceipt)
    ) {
      throw new Error("Scheduler Message Session wake port is already bound to another implementation.")
    }
    sessionWake = bound
  }

  export function bindTaskDeliveryMaterializer(materializer: TaskDeliveryMaterializer): void {
    if (taskDeliveryMaterializer && taskDeliveryMaterializer !== materializer) {
      throw new Error("Scheduler Message Task delivery materializer is already bound to another implementation.")
    }
    taskDeliveryMaterializer = materializer
  }

  export function initGlobal(): void {
    Scheduler.register({
      id: "scheduler-message-delivery.poll",
      interval: DELIVERY_POLL_INTERVAL_MS,
      runAtStart: true,
      run: pollSchedulerMessageDeliveries,
    })
  }

  export async function runDueNow(): Promise<void> {
    await pollSchedulerMessageDeliveries(new AbortController().signal)
  }
}

export const SchedulerMessageTestHooks = {
  handleSignalDrainFailure(error: unknown): "lifecycle_closed" | "reported" {
    return handleSignalDrainFailure(error)
  },
  installSignalDrainFailureReport(observer: (error: unknown) => void): Disposable {
    if (signalDrainFailureReportForTest) throw new Error("Scheduler Message signal-drain failure observer is installed")
    signalDrainFailureReportForTest = observer
    return {
      [Symbol.dispose]() {
        if (signalDrainFailureReportForTest === observer) signalDrainFailureReportForTest = undefined
      },
    }
  },
  poll(signal: AbortSignal): Promise<void> {
    return pollSchedulerMessageDeliveries(signal)
  },
  requestProjectDrain(projectID: string, directory: string): Promise<void> {
    return requestSchedulerMessageDrainForProject(projectID, directory)
  },
  installBeforeGlobalPoll(hook: () => void | Promise<void>): Disposable {
    if (beforeGlobalPollForTest) throw new Error("Scheduler Message global poll test hook is already installed")
    beforeGlobalPollForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeGlobalPollForTest === hook) beforeGlobalPollForTest = undefined
      },
    }
  },
  installBeforeMissionMaterialization(hook: () => void | Promise<void>): Disposable {
    if (beforeMissionMaterializationForTest) throw new Error("Mission materialization test hook is already installed")
    beforeMissionMaterializationForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeMissionMaterializationForTest === hook) beforeMissionMaterializationForTest = undefined
      },
    }
  },
  installBeforeTaskMaterialization(hook: () => void | Promise<void>): Disposable {
    if (beforeTaskMaterializationForTest) throw new Error("Task materialization test hook is already installed")
    beforeTaskMaterializationForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeTaskMaterializationForTest === hook) beforeTaskMaterializationForTest = undefined
      },
    }
  },
}
