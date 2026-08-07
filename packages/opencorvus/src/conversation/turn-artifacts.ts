import {
  ArtifactCatalogEntrySchema,
  ArtifactReadLocatorSchema,
  ArtifactSchemaLimits,
  type ArtifactCatalogEntry,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { EngineService } from "@/task-api"
import { conversationMessageHasDisplay, type ConversationView } from "./view"
import { ConversationTurnArtifactSummary } from "@/engine/model"
import { requireTaskCompletionDecisionArtifact } from "@/engine/completion-decision"
import { requireTerminalLifecycleReferenceEvent } from "@/engine/terminal-lifecycle-reference"
import { SessionWake } from "@/session/wake"

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
  if (locator.source === "task_artifact_resource") return snapshotIdentity(locator.ref.snapshot)
  return undefined
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
      entries: [] as ArtifactCatalogEntry[],
      catalogComplete: true,
      providerErrors: [] as Array<{ source: "engine_artifact" | "task_artifact"; message: string }>,
    }
  }
  const catalog = await completeTaskCatalog(taskID)
  const entries = resolveCompletionArtifactEntries(taskID, locators, catalog.entries)
  return { task, entries, catalogComplete: catalog.catalogComplete, providerErrors: catalog.providerErrors }
}

type MissionChildTaskResultWake = Extract<
  SessionWake.WakeReason,
  { source: "mission.child_task_result" }
>

async function missionTaskDelivery(wake: MissionChildTaskResultWake) {
  const reference = wake.terminalLifecycleReference
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
      entries: [] as ArtifactCatalogEntry[],
      catalogComplete: true,
      providerErrors: [] as Array<{ source: "engine_artifact" | "task_artifact"; message: string }>,
    }
  }
  const catalog = await completeTaskCatalog(wake.taskID)
  const entries = resolveCompletionArtifactEntries(wake.taskID, locators, catalog.entries)
  return { wake, entries, catalogComplete: catalog.catalogComplete, providerErrors: catalog.providerErrors }
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

function missionChildResultWake(message: any): MissionChildTaskResultWake | undefined {
  if (message?.info?.role !== "user") return undefined
  const wake = message.info.extra?.wake_reason
  if (!wake || typeof wake !== "object" || Array.isArray(wake)) return undefined
  if (wake.source !== "mission.child_task_result") return undefined
  return SessionWake.MissionChildTaskResultWakeReason.parse(wake)
}

export async function projectMissionTurnArtifacts(input: {
  transcript: readonly any[]
  view: ConversationView
}) {
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
            ...(delivery.wake.taskStatus !== "completed" && delivery.wake.terminalLifecycleReference.terminalError
              ? { reason: delivery.wake.terminalLifecycleReference.terminalError }
              : {}),
          },
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
      entries: delivery.entries,
      catalogComplete: delivery.catalogComplete,
      providerErrors: delivery.providerErrors,
    }),
  ]
}
