import { createHash, randomUUID } from "node:crypto"
import { Database, DatabaseEffectAdmissionClosedError, eq } from "@/storage/db"
import { Instance, InstanceProcessAdmissionClosedError, runInstanceBackgroundWork } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
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
import { admitMissionExecutionWake, currentMissionExecutionClosure } from "@/mission/execution-closure"
import { requireMissionSession } from "@/mission/session"
import { FifoPermitPool, settledWork } from "@/util/queue"
import { globalExecutionCapacity } from "@/runtime/execution-capacity"
import { awaitWithAbort } from "@/util/abort"

const DELIVERY_LEASE_MS = 120_000
const MAX_DELIVERY_ATTEMPTS = 5
const DELIVERY_POLL_INTERVAL_MS = 1_000
const DELIVERY_RECIPIENT_PAGE_SIZE = 32
const DELIVERY_PROJECT_PAGE_SIZE = 32
const log = Log.create({ service: "scheduler-message-delivery" })
const recipientExecutionPermits = new FifoPermitPool(4)
const drainState = createInstanceState(
  () => ({
    lifecycle: new AbortController(),
    drain: undefined as Promise<void> | undefined,
    changed: Promise.withResolvers<void>(),
    revision: 0,
  }),
  async (state) => {
    state.lifecycle.abort(new InstanceProcessAdmissionClosedError())
    state.changed.resolve()
    await state.drain?.catch(() => undefined)
  },
  "scheduler-message-delivery",
)
let beforeMissionMaterializationForTest: (() => void | Promise<void>) | undefined
type TaskMaterializationHook = (input: { inboxID: string; signal?: AbortSignal }) => void | Promise<void>
let beforeTaskMaterializationForTest: TaskMaterializationHook | undefined
let beforeProjectDrainForTest: (() => void | Promise<void>) | undefined
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
    const signal = drainState().lifecycle.signal
    recipientExecutionPermits.resize(await globalExecutionCapacity("scheduler_message"))
    const wakeStatus =
      receipt.status !== "delivered" && receipt.status !== "dead_letter"
        ? await recipientExecutionPermits.run(() => drainTaskRecipient(target.task_id, receipt.inboxID, signal), signal)
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

async function drainMissionRecipient(sessionID: string, signal: AbortSignal): Promise<void> {
  while (true) {
    signal.throwIfAborted()
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
            signal,
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

async function drainTaskRecipient(
  taskID: string,
  awaitedInboxID?: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  let awaitedWakeStatus: string | undefined
  while (true) {
    signal?.throwIfAborted()
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
      await beforeTaskMaterializationForTest?.({ inboxID: delivery.id, signal })
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
  signal?: AbortSignal
}): Promise<void> {
  const current = Instance.current()
  if (!current) return
  const state = drainState()
  state.lifecycle.signal.throwIfAborted()
  input?.signal?.throwIfAborted()
  state.revision += 1
  state.changed.resolve()
  state.changed = Promise.withResolvers<void>()
  // A joining poll owns only its wait; the existing background owner keeps
  // its Project lease until all previously admitted materialization settles.
  if (state.drain) return awaitWithAbort(state.drain, input?.signal)
  let failure: { error: unknown } | undefined
  const ownerSignal = input?.signal ? AbortSignal.any([state.lifecycle.signal, input.signal]) : state.lifecycle.signal
  const drain = Database.runOutsideContext(() =>
    runInstanceBackgroundWork(
      "scheduler-message-delivery",
      async (signal) => {
        try {
          await drainSchedulerRecipientFrontier({
            projectID: current.project.id,
            projectWorktree: current.project.worktree,
            excludeSessionIDs: input?.excludeSessionIDs,
            signal,
            discovery: state,
          })
        } catch (error) {
          failure = { error }
          throw error
        }
      },
      ownerSignal,
    ),
  )
    .then(() => {
      if (failure) throw failure.error
      ownerSignal.throwIfAborted()
    })
    .finally(() => {
      if (state.drain === drain) state.drain = undefined
    })
  state.drain = drain
  return drain
}

type DiscoveryWake = { revision: number; changed: ReturnType<typeof Promise.withResolvers<void>> }

// Only admitted keys live in memory. A completed scan stays receptive while
// another recipient runs, so free workers can discover later durable input.
function schedulerDiscovery<T>(input: {
  scan: () => Iterable<T>
  key: (item: T) => string
  signal: AbortSignal
  wake?: DiscoveryWake
}) {
  const active = new Set<string>()
  const wake = input.wake ?? { revision: 0, changed: Promise.withResolvers<void>() }
  function settled(item: T) {
    active.delete(input.key(item))
    wake.changed.resolve()
    wake.changed = Promise.withResolvers<void>()
  }
  async function* items(): AsyncGenerator<T> {
    while (true) {
      input.signal.throwIfAborted()
      const revision = wake.revision
      for (const item of input.scan()) {
        const key = input.key(item)
        if (active.has(key)) continue
        active.add(key)
        yield item
      }
      const rescanAt = Date.now() + DELIVERY_POLL_INTERVAL_MS
      while (revision === wake.revision && active.size > 0 && Date.now() < rescanAt) {
        await new Promise<void>((resolve, reject) => {
          const changed = wake.changed
          let completed = false
          const finish = (aborted: boolean) => {
            if (completed) return
            completed = true
            clearTimeout(timer)
            input.signal.removeEventListener("abort", onAbort)
            if (wake.changed === changed) wake.changed = Promise.withResolvers<void>()
            changed.resolve()
            if (aborted) reject(input.signal.reason)
            else resolve()
          }
          const done = () => finish(false)
          const onAbort = () => finish(true)
          const timer = setTimeout(done, Math.max(1, rescanAt - Date.now()))
          input.signal.addEventListener("abort", onAbort, { once: true })
          void changed.promise.then(done)
          if (input.signal.aborted) onAbort()
        })
      }
      if (revision === wake.revision && active.size === 0) return
    }
  }
  return { items: items(), settled }
}

type SchedulerRecipientWorkItem =
  | {
      kind: "wake"
      wake: ReturnType<typeof listUnansweredSchedulerSessionWakes>[number]
    }
  | {
      kind: "session"
      actorID: string
    }
  | {
      kind: "task"
      actorID: string
    }

function interleaveSchedulerRecipientPages(
  pages: readonly (readonly SchedulerRecipientWorkItem[])[],
): SchedulerRecipientWorkItem[] {
  const result: SchedulerRecipientWorkItem[] = []
  const length = Math.max(0, ...pages.map((page) => page.length))
  for (let index = 0; index < length; index += 1) {
    for (const page of pages) {
      const item = page[index]
      if (item) result.push(item)
    }
  }
  return result
}

async function drainSchedulerRecipientFrontier(input: {
  projectID: string
  projectWorktree: string
  excludeSessionIDs?: ReadonlySet<string>
  signal: AbortSignal
  discovery: DiscoveryWake
}): Promise<void> {
  const concurrency = await globalExecutionCapacity("scheduler_message")
  recipientExecutionPermits.resize(concurrency)
  function* recipients(): Generator<SchedulerRecipientWorkItem> {
    let afterWakeInboxID: string | undefined
    let afterSessionID: string | undefined
    let afterTaskID: string | undefined
    let wakesExhausted = false
    let sessionsExhausted = false
    let tasksExhausted = false
    while (true) {
      const wakes = wakesExhausted
        ? []
        : listUnansweredSchedulerSessionWakes({
            projectID: input.projectID,
            afterInboxID: afterWakeInboxID,
            limit: DELIVERY_RECIPIENT_PAGE_SIZE,
          })
      const sessionIDs = sessionsExhausted
        ? []
        : listPendingSchedulerRecipientIDs({
            actor: "session",
            projectID: input.projectID,
            afterActorID: afterSessionID,
            limit: DELIVERY_RECIPIENT_PAGE_SIZE,
          })
      const taskIDs = tasksExhausted
        ? []
        : listPendingSchedulerRecipientIDs({
            actor: "task",
            projectID: input.projectID,
            afterActorID: afterTaskID,
            limit: DELIVERY_RECIPIENT_PAGE_SIZE,
          })
      wakesExhausted = wakes.length === 0
      sessionsExhausted = sessionIDs.length === 0
      tasksExhausted = taskIDs.length === 0
      if (wakesExhausted && sessionsExhausted && tasksExhausted) return
      const work = interleaveSchedulerRecipientPages([
        wakes
          .filter((wake) => !input.excludeSessionIDs?.has(wake.sessionID))
          .map((wake) => ({ kind: "wake", wake }) satisfies SchedulerRecipientWorkItem),
        sessionIDs
          .filter((sessionID) => !input.excludeSessionIDs?.has(sessionID))
          .map((actorID) => ({ kind: "session", actorID }) satisfies SchedulerRecipientWorkItem),
        taskIDs.map((actorID) => ({ kind: "task", actorID }) satisfies SchedulerRecipientWorkItem),
      ])
      afterWakeInboxID = wakes.at(-1)?.inboxID ?? afterWakeInboxID
      afterSessionID = sessionIDs.at(-1) ?? afterSessionID
      afterTaskID = taskIDs.at(-1) ?? afterTaskID
      yield* work
    }
  }
  const discovery = schedulerDiscovery({
    scan: recipients,
    key: (item: SchedulerRecipientWorkItem) =>
      item.kind === "wake" ? `session:${item.wake.sessionID}` : `${item.kind}:${item.actorID}`,
    signal: input.signal,
    wake: input.discovery,
  })
  let failure: { error: unknown } | undefined
  await settledWork({
    concurrency,
    items: discovery.items,
    signal: input.signal,
    onSettled: (result) => {
      if (result.status === "rejected") failure ??= { error: result.reason }
    },
    run: (item) =>
      recipientExecutionPermits
        .run(async () => {
          if (item.kind === "session") return drainMissionRecipient(item.actorID, input.signal)
          if (item.kind === "task") return drainTaskRecipient(item.actorID, undefined, input.signal)
          const { wake } = item
          const closure = currentMissionExecutionClosure(wake.sessionID)
          if (closure?.state === "closing" || closure?.state === "closed") return
          if (!schedulerSessionWakeNeedsRecovery(wake)) return
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
                signal: input.signal,
                sessionID: wake.sessionID,
                messageID: wake.messageID,
                directory: input.projectWorktree,
                retryFailedReply: true,
                ownerPreflight: missionAdmission.ownerPreflight,
                ownerLifecycle: missionAdmission.ownerLifecycle,
              })
              await receipt.activation
              return { activation: Promise.resolve(undefined), completion: receipt.completion }
            },
          })
          if (reconciliation) await reconciliation.completion
        }, input.signal)
        .finally(() => discovery.settled(item)),
  })
  if (failure) throw failure.error
}

async function pollSchedulerMessageDeliveries(signal: AbortSignal): Promise<void> {
  await beforeGlobalPollForTest?.()
  const concurrency = await globalExecutionCapacity("scheduler_message")
  function* projects(): Generator<string> {
    let afterProjectID: string | undefined
    while (true) {
      const projectIDs = listPendingSchedulerProjectIDs({
        afterProjectID,
        limit: DELIVERY_PROJECT_PAGE_SIZE,
      })
      if (projectIDs.length === 0) return
      afterProjectID = projectIDs.at(-1)
      for (const projectID of projectIDs) {
        const now = Date.now()
        const dueAt = nextSchedulerDeliveryDueAt(projectID, now)
        const hasUnansweredWake = listUnansweredSchedulerSessionWakes({ projectID, limit: 1 }).length > 0
        if (hasUnansweredWake || (dueAt !== undefined && dueAt <= now)) yield projectID
      }
    }
  }
  const discovery = schedulerDiscovery({ scan: projects, key: (projectID) => projectID, signal })
  let failure: { error: unknown } | undefined
  await settledWork({
    concurrency,
    items: discovery.items,
    signal,
    onSettled: (result) => {
      if (result.status === "rejected") failure ??= { error: result.reason }
    },
    run: async (projectID) => {
      try {
        const project = Project.get(projectID)
        if (project) await requestSchedulerMessageDrainForProject(projectID, project.worktree, signal)
      } finally {
        discovery.settled(projectID)
      }
    },
  })
  if (signal.aborted) throw signal.reason
  if (failure) throw failure.error
}

export function requestSchedulerMessageDrain(): void {
  const current = Instance.current()
  if (!current) return
  void drainSchedulerMessagesForCurrentProject().catch((error) => {
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
  return drainSchedulerMessagesForCurrentProject(input)
}

function requestSchedulerMessageDrainForProject(
  _key: string,
  directory: string,
  signal?: AbortSignal,
  input?: { excludeSessionIDs?: ReadonlySet<string> },
): Promise<void> {
  return Database.runOutsideContext(() =>
    runWithInitializedIndependentProject({
      directory,
      signal,
      fn: async () => {
        drainState()
        await beforeProjectDrainForTest?.()
        return drainSchedulerMessagesForCurrentProject({ ...input, signal })
      },
    }),
  )
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
  requestProjectDrain(projectID: string, directory: string, signal?: AbortSignal): Promise<void> {
    return requestSchedulerMessageDrainForProject(projectID, directory, signal)
  },
  installBeforeProjectDrain(hook: () => void | Promise<void>): Disposable {
    if (beforeProjectDrainForTest) throw new Error("Scheduler Project drain admission test hook is already installed")
    beforeProjectDrainForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeProjectDrainForTest === hook) beforeProjectDrainForTest = undefined
      },
    }
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
  installBeforeTaskMaterialization(hook: TaskMaterializationHook): Disposable {
    if (beforeTaskMaterializationForTest) throw new Error("Task materialization test hook is already installed")
    beforeTaskMaterializationForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeTaskMaterializationForTest === hook) beforeTaskMaterializationForTest = undefined
      },
    }
  },
}
