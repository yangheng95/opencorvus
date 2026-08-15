import z from "zod"
import {
  ArtifactCatalogEntrySchema,
  ArtifactProducerSchema,
  ArtifactReadLocatorSchema,
  ArtifactSchemaLimits,
  EngineArtifactEnvelopeSchema,
  type ArtifactCatalogEntry,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { TaskArtifactRefSchema, type TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { EngineService } from "@/task-api"
import { conversationMessageHasDisplay, type ConversationView } from "./view"
import { ConversationTurnArtifactSummary } from "@/engine/model"
import { requireTaskCompletionDecisionArtifact } from "@/engine/completion-decision"
import { requireTerminalLifecycleReferenceEvent, resolveTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { artifactCatalogAuthority, requireEngineArtifactByLocator } from "@/artifact-catalog"
import { readTaskArtifactSnapshotManifest, taskArtifactSnapshotResourceRefs } from "@/task-artifact/store"
import { engineArtifactUsesTransportEnvelope } from "@/engine/artifact-catalog-metadata"
import { SchedulerMessagePayload } from "@/protocol/schema"
import { ProtocolStore } from "@/protocol/store"
import {
  TerminalLifecycleReferenceSchema,
  requireCurrentTerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision"
import { findTask } from "@/engine/store"

function exactString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function exactPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function snapshotIdentity(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const snapshot = value as Record<string, unknown>
  const schemaVersion = exactPositiveInteger(snapshot.schema_version)
  const projectID = exactString(snapshot.project_id)
  const taskID = exactString(snapshot.task_id)
  const snapshotID = exactString(snapshot.snapshot_id)
  const manifestSHA256 = exactString(snapshot.manifest_sha256)
  if (!schemaVersion || !projectID || !taskID || !snapshotID || !manifestSHA256) return undefined
  return `task_artifact_snapshot:${schemaVersion}:${projectID}:${taskID}:${snapshotID}:${manifestSHA256}`
}

function locatorIdentity(value: unknown): string | undefined {
  const parsed = ArtifactReadLocatorSchema.safeParse(value)
  if (!parsed.success) return undefined
  const locator = parsed.data
  if (locator.source === "engine_artifact") {
    return `engine_artifact:${locator.artifact_id}:${locator.catalog_revision}:${locator.expected_sha256}`
  }
  if (locator.source === "task_artifact_snapshot") return snapshotIdentity(locator.snapshot)
  if (locator.source === "task_artifact_resource") {
    return `task_artifact_resource:${resourceIdentity(locator.ref)}`
  }
  return undefined
}

function resourceIdentity(resource: TaskArtifactRef): string {
  return [
    resource.snapshot.schema_version,
    resource.snapshot.project_id,
    resource.snapshot.task_id,
    resource.snapshot.snapshot_id,
    resource.snapshot.manifest_sha256,
    resource.tree,
    resource.path,
    resource.media_type,
    resource.bytes,
    resource.sha256,
  ].join("\u0000")
}

type DeclaredTurnOutput = z.infer<typeof ConversationTurnArtifactSummary>["declaredOutputs"][number]

function structuredOutput(input: { locator: ArtifactReadLocator; entry: ArtifactCatalogEntry }): DeclaredTurnOutput {
  return {
    declarationLocator: input.locator,
    producer: input.entry.producer,
    label: input.entry.label || input.entry.artifact_type || input.entry.kind,
    ...(input.entry.artifact_type ? { artifactType: input.entry.artifact_type } : {}),
    resources: [],
  }
}

export async function projectDeclaredTurnOutputs(input: {
  taskID: string
  locators: readonly ArtifactReadLocator[]
  entries: readonly ArtifactCatalogEntry[]
}): Promise<DeclaredTurnOutput[]> {
  if (input.locators.length === 0) return []
  const authority = artifactCatalogAuthority(input.taskID)
  const entryByIdentity = new Map(
    input.entries.flatMap((entry) => {
      const identity = locatorIdentity(entry.locator)
      return identity ? [[identity, entry] as const] : []
    }),
  )
  const outputs: DeclaredTurnOutput[] = []

  const appendResources = (input: {
    declarationLocator: ArtifactReadLocator
    label: string
    producer: z.infer<typeof ArtifactProducerSchema>
    resources: readonly TaskArtifactRef[]
  }) => {
    const resources = input.resources.map((resource) => TaskArtifactRefSchema.parse(resource))
    if (resources.length === 0) return
    outputs.push({
      declarationLocator: input.declarationLocator,
      producer: input.producer,
      label: input.label,
      resources,
    })
  }

  for (const locator of input.locators) {
    const identity = locatorIdentity(locator)
    const entry = identity ? entryByIdentity.get(identity) : undefined
    if (!entry) throw new Error(`Task ${input.taskID} declared output is missing from its exact Artifact catalog`)

    if (locator.source === "engine_artifact") {
      const row = requireEngineArtifactByLocator({ taskID: input.taskID, locator })
      if (!engineArtifactUsesTransportEnvelope(row.kind)) {
        outputs.push(structuredOutput({ locator, entry }))
        continue
      }
      const envelope = EngineArtifactEnvelopeSchema.safeParse(row.payload)
      if (entry.schema_diagnostic || !envelope.success) {
        const diagnostic =
          entry.schema_diagnostic ||
          (envelope.success ? "Artifact catalog rejected the typed envelope identity" : envelope.error.message)
        throw new Error(
          `Task ${input.taskID} selected Engine Artifact ${locator.artifact_id} is not a valid current transport envelope: ${diagnostic}`,
        )
      }
      if (envelope.data.resources.length === 0) {
        outputs.push({
          ...structuredOutput({ locator, entry }),
          producer: envelope.data.producer,
          artifactType: envelope.data.artifact_type,
        })
        continue
      }
      appendResources({
        declarationLocator: locator,
        label: entry.label || entry.artifact_type || entry.kind,
        producer: envelope.data.producer,
        resources: envelope.data.resources,
      })
      continue
    }

    const snapshot = locator.source === "task_artifact_snapshot" ? locator.snapshot : locator.ref.snapshot
    const record = await readTaskArtifactSnapshotManifest({ ...authority, snapshot })
    const resources = taskArtifactSnapshotResourceRefs(record)
    const producer = ArtifactProducerSchema.parse(record.manifest.producer)
    if (locator.source === "task_artifact_resource") {
      const selectedIdentity = resourceIdentity(locator.ref)
      const exact = resources.find((resource) => resourceIdentity(resource) === selectedIdentity)
      if (!exact) {
        throw new Error(`Task ${input.taskID} declared resource ${locator.ref.tree}/${locator.ref.path} is not exact`)
      }
      appendResources({
        declarationLocator: locator,
        label: entry.label || locator.ref.path,
        producer,
        resources: [exact],
      })
      continue
    }
    appendResources({ declarationLocator: locator, label: entry.label || entry.kind, producer, resources })
  }

  return outputs
}

async function completeTaskCatalog(taskID: string): Promise<{
  entries: ArtifactCatalogEntry[]
  catalogComplete: boolean
  providerErrors: Array<{ source: "engine_artifact" | "task_artifact"; message: string }>
}> {
  const entries: ArtifactCatalogEntry[] = []
  const providerErrors = new Map<string, { source: "engine_artifact" | "task_artifact"; message: string }>()
  const visited = new Set<string>()
  let cursor: string | null = null
  let catalogComplete = true
  do {
    const page = await EngineService.searchArtifactCatalog(taskID, {
      version_scope: "all",
      sort: "newest",
      limit: ArtifactSchemaLimits.maxSearchLimit,
      ...(cursor ? { cursor } : {}),
    })
    entries.push(...page.entries.map((entry) => ArtifactCatalogEntrySchema.parse(entry)))
    catalogComplete = catalogComplete && page.catalog_complete
    for (const error of page.provider_errors) providerErrors.set(`${error.source}:${error.message}`, error)
    const next = page.next_cursor
    if (next && visited.has(next)) throw new Error(`Task ${taskID} Artifact catalog repeated cursor ${next}`)
    if (next) visited.add(next)
    cursor = next
  } while (cursor)
  return { entries, catalogComplete, providerErrors: [...providerErrors.values()] }
}

async function taskDelivery(taskID: string) {
  const task = await EngineService.getTask(taskID)
  if (task.status !== "completed" && task.status !== "failed" && task.status !== "cancelled") {
    throw new Error(`Conversation Turn Artifact task ${taskID} is not terminal`)
  }
  const locators = (task.completionDecision?.deliverableArtifactLocators ?? []).map((locator: unknown) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  if (locators.length === 0) {
    return {
      task,
      locators,
      entries: [] as ArtifactCatalogEntry[],
      catalogComplete: true,
      providerErrors: [] as Array<{ source: "engine_artifact" | "task_artifact"; message: string }>,
    }
  }
  const catalog = await completeTaskCatalog(taskID)
  const entries = resolveCompletionArtifactEntries(taskID, locators, catalog.entries)
  return { task, locators, entries, catalogComplete: catalog.catalogComplete, providerErrors: catalog.providerErrors }
}

type MissionChildTaskResultWake = {
  taskID: string
  taskTitle: string
  taskStatus: "completed" | "failed" | "cancelled"
  terminalLifecycleReference: ReturnType<typeof requireCurrentTerminalLifecycleReference>
  completionDecisionArtifactID?: string
}

async function missionTaskDelivery(wake: MissionChildTaskResultWake) {
  const reference = resolveTerminalLifecycleReference(wake.taskID, wake.terminalLifecycleReference)
  if (wake.taskStatus !== reference.terminalStatus) {
    throw new Error(
      `Mission child Task ${wake.taskID} status ${wake.taskStatus} conflicts with terminal occurrence ${reference.terminalEventID}`,
    )
  }
  if (wake.taskStatus !== "completed" && wake.completionDecisionArtifactID) {
    throw new Error(
      `Mission child Task ${wake.taskID} terminal occurrence ${reference.terminalEventID} has invalid completion decision authority`,
    )
  }
  requireTerminalLifecycleReferenceEvent(wake.taskID, reference)
  const decision = wake.completionDecisionArtifactID
    ? requireTaskCompletionDecisionArtifact({
        taskID: wake.taskID,
        artifactID: wake.completionDecisionArtifactID,
        timeCompleted: reference.timeCompleted,
      })
    : undefined
  const locators = (decision?.payload.deliverable_artifact_locators ?? []).map((locator: unknown) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  if (locators.length === 0) {
    return {
      wake,
      terminalReference: reference,
      locators,
      entries: [] as ArtifactCatalogEntry[],
      catalogComplete: true,
      providerErrors: [] as Array<{ source: "engine_artifact" | "task_artifact"; message: string }>,
    }
  }
  const catalog = await completeTaskCatalog(wake.taskID)
  const entries = resolveCompletionArtifactEntries(wake.taskID, locators, catalog.entries)
  return { wake, terminalReference: reference, locators, entries, catalogComplete: catalog.catalogComplete, providerErrors: catalog.providerErrors }
}

export function resolveCompletionArtifactEntries(
  taskID: string,
  locators: readonly ArtifactReadLocator[],
  catalogEntries: readonly ArtifactCatalogEntry[],
): ArtifactCatalogEntry[] {
  const entriesByIdentity = new Map(
    catalogEntries.flatMap((entry) => {
      const identity = locatorIdentity(entry.locator)
      return identity ? [[identity, entry] as const] : []
    }),
  )
  return locators.map((locator: ArtifactReadLocator) => {
    const identity = locatorIdentity(locator)
    const entry = identity ? entriesByIdentity.get(identity) : undefined
    if (!entry) {
      throw new Error(`Task ${taskID} completion deliverable is missing from its exact Artifact catalog`)
    }
    return entry
  })
}

function finalVisibleAssistantMessageID(
  transcript: readonly any[],
  view: ConversationView,
  userMessageID: string,
): string | undefined {
  const transcriptByID = new Map(transcript.map((message) => [String(message?.info?.id || ""), message]))
  return view.messages
    .filter((message) => {
      const transcriptMessage = transcriptByID.get(message.messageID)
      return (
        transcriptMessage?.info?.role === "assistant" &&
        transcriptMessage.info.parentID === userMessageID &&
        conversationMessageHasDisplay(transcriptMessage)
      )
    })
    .at(-1)?.messageID
}

export function missionChildResultWake(message: any): MissionChildTaskResultWake | undefined {
  if (message?.info?.role !== "user") return undefined
  const wake = message.info.extra?.wake_reason
  if (!wake || typeof wake !== "object" || Array.isArray(wake)) return undefined
  if (wake.source !== "scheduler.message" || wake.messageKind !== "notification") return undefined
  const deliveryEvent = ProtocolStore.requireEvent(wake.eventID)
  const deliveryPayload = SchedulerMessagePayload.parse(deliveryEvent.payload)
  if (!deliveryPayload.source_terminal_event_id || deliveryEvent.causationID !== deliveryPayload.source_terminal_event_id) {
    return undefined
  }
  const terminalEvent = ProtocolStore.requireEvent(deliveryPayload.source_terminal_event_id)
  const payload = terminalEvent.payload ?? {}
  if (!terminalEvent.taskID) return undefined
  const terminalStatus = terminalEvent.type === "task.completed"
    ? "completed"
    : terminalEvent.type === "task.failed"
      ? "failed"
      : terminalEvent.type === "task.cancelled"
        ? "cancelled"
        : undefined
  if (!terminalStatus) return undefined
  // The scheduler notification names one immutable terminal occurrence. Never
  // reinterpret it through the Task's current row: the Task may have resumed
  // into a later lifecycle or been physically deleted before Mission drain.
  const reference = TerminalLifecycleReferenceSchema.parse({ terminalEventID: terminalEvent.id })
  const resolvedReference = resolveTerminalLifecycleReference(terminalEvent.taskID, reference)
  requireTerminalLifecycleReferenceEvent(terminalEvent.taskID, reference)
  const task = findTask(terminalEvent.taskID)
  const completionDecision =
    resolvedReference.terminalStatus === "completed"
      ? findTaskCompletionDecisionForTerminalTime({
          taskID: terminalEvent.taskID,
          timeCompleted: resolvedReference.timeCompleted,
        })
      : undefined
  return {
    taskID: terminalEvent.taskID,
    taskTitle: task?.title ?? `Task ${terminalEvent.taskID}`,
    taskStatus: resolvedReference.terminalStatus,
    terminalLifecycleReference: reference,
    ...(completionDecision ? { completionDecisionArtifactID: completionDecision.id } : {}),
  }
}

export async function projectMissionTurnArtifacts(input: { transcript: readonly any[]; view: ConversationView }) {
  const summaries = await Promise.all(
    projectMissionTurnArtifactOwners(input).map(async ({ wake, userMessageID, messageID }) => {
      const delivery = await missionTaskDelivery(wake)
      return ConversationTurnArtifactSummary.parse({
        messageID,
        userMessageID,
        task: {
          id: delivery.wake.taskID,
          title: delivery.wake.taskTitle,
          status: delivery.wake.taskStatus,
          ...(delivery.wake.taskStatus !== "completed" && delivery.terminalReference.terminalError
            ? { reason: delivery.terminalReference.terminalError }
            : {}),
        },
        declaredOutputs: await projectDeclaredTurnOutputs({
          taskID: delivery.wake.taskID,
          locators: delivery.locators,
          entries: delivery.entries,
        }),
        entries: delivery.entries,
        catalogComplete: delivery.catalogComplete,
        providerErrors: delivery.providerErrors,
      })
    }),
  )
  return summaries
}

export function projectMissionTurnArtifactOwners(input: {
  transcript: readonly any[]
  view: ConversationView
}): Array<{ wake: MissionChildTaskResultWake; userMessageID: string; messageID: string }> {
  return input.transcript.flatMap((message) => {
    const wake = missionChildResultWake(message)
    const userMessageID = exactString(message?.info?.id)
    const messageID = userMessageID
      ? finalVisibleAssistantMessageID(input.transcript, input.view, userMessageID)
      : undefined
    return wake && userMessageID && messageID ? [{ wake, userMessageID, messageID }] : []
  })
}

export async function projectTaskTurnArtifacts(input: {
  taskID: string
  transcript: readonly any[]
  view: ConversationView
}) {
  const delivery = await taskDelivery(input.taskID)
  const decisionMessageID = exactString(delivery.task.completionDecision?.orchestratorMessageID)
  if (!decisionMessageID) return []
  if (!input.view.messages.some((message) => message.messageID === decisionMessageID)) return []
  const messageID = decisionMessageID
  const assistant = input.transcript.find((message) => message?.info?.id === messageID)
  const userMessageID = exactString(assistant?.info?.parentID)
  if (!userMessageID) return []
  return [
    ConversationTurnArtifactSummary.parse({
      messageID,
      userMessageID,
      task: {
        id: delivery.task.id,
        title: delivery.task.title,
        status: delivery.task.status,
        ...(delivery.task.status === "failed" && delivery.task.error
          ? { reason: delivery.task.error }
          : delivery.task.status === "cancelled" && delivery.task.cancellation?.reason
            ? { reason: delivery.task.cancellation.reason }
            : {}),
      },
      declaredOutputs: await projectDeclaredTurnOutputs({
        taskID: delivery.task.id,
        locators: delivery.locators,
        entries: delivery.entries,
      }),
      entries: delivery.entries,
      catalogComplete: delivery.catalogComplete,
      providerErrors: delivery.providerErrors,
    }),
  ]
}
