import { Token } from "@/util/token"
import type { ModelMessage } from "ai"
import z from "zod"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { configuredDefaultModelRef } from "@/agent/model"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { EffectiveConfig } from "@/config/effective"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import { Message } from "@/session/message"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { ProjectMemory, type Entry } from "./project-memory"
import { Bus } from "@/bus"
import { withKeyedLock } from "@/util/lock"
import { createInstanceState } from "@/project/instance-state"
import { MissingModelConfigError } from "@/config/model-resolution-error"
import { GlobalBus } from "@/bus/global"
import { randomUUID } from "node:crypto"
import { findTask } from "@/engine/store"

const log = Log.create({ service: "memory.organizer" })
const PROTOCOL_RESERVE_TOKENS = 2_000
const RUNTIME_RESERVE_TOKENS = 2_000
const organizerLocks = new Map<string, Promise<unknown>>()
const lifecycle = createInstanceState(
  () => ({ unsub: undefined as (() => void) | undefined }),
  async (state) => state.unsub?.(),
  "project-memory-organizer",
)

const Candidate = z.object({
  baseRevision: z.number().int().nonnegative(),
  coveredOccurrenceIDs: z.array(z.string().min(1)).min(1),
  disposition: z.literal("organized"),
  markdown: z.string().min(1),
})

function usableInputTokens(model: Provider.Model) {
  const declared = model.limit.input && model.limit.input > 0 ? model.limit.input : model.limit.context
  return Math.max(0, declared - RUNTIME_RESERVE_TOKENS)
}

function evidenceTokens(entry: Entry) {
  return Token.estimate(JSON.stringify(entry))
}

function selectPrefix(input: {
  pending: Entry[]
  documentTokens: number
  documentTokenLimit: number
  configuredInputBudget: number
  model: Provider.Model
}) {
  const budget = Math.min(input.configuredInputBudget, usableInputTokens(input.model))
  if (budget <= input.documentTokenLimit + PROTOCOL_RESERVE_TOKENS) {
    return { kind: "model_context_incompatible" as const, budget }
  }
  const available = budget - input.documentTokens - PROTOCOL_RESERVE_TOKENS
  if (available <= 0) return { kind: "model_context_incompatible" as const, budget }
  const entries: Entry[] = []
  let used = 0
  for (const entry of input.pending.slice(0, 500)) {
    const tokens = evidenceTokens(entry)
    if (used + tokens > available) break
    entries.push(entry)
    used += tokens
  }
  if (entries.length === 0 && input.pending.length > 0) return { kind: "evidence_too_large" as const, budget }
  return { kind: "selected" as const, budget, entries }
}

function organizerPrompt(input: {
  baseRevision: number
  document: string
  documentTokenLimit: number
  pending: Entry[]
}) {
  return [
    "Maintain the Project MEMORY.MD from the evidence below.",
    `The complete replacement must contain at most ${input.documentTokenLimit} estimated tokens.`,
    "Return only JSON matching this shape:",
    '{"baseRevision":number,"coveredOccurrenceIDs":[string,...],"disposition":"organized","markdown":string}',
    `baseRevision must be ${input.baseRevision}.`,
    `coveredOccurrenceIDs must be exactly ${JSON.stringify(input.pending.map((item) => item.occurrenceID))}.`,
    "\nCURRENT PROJECT MEMORY.MD\n",
    input.document || "(empty)",
    "\nORDERED PENDING USER-INPUT EVIDENCE\n",
    JSON.stringify(input.pending),
  ].join("\n")
}

async function sourceUser(sessionID: string): Promise<Message.User | undefined> {
  const source = (await Session.messages({ sessionID })).findLast(
    (message): message is Message.WithParts & { info: Message.User } => message.info.role === "user",
  )
  return source?.info
}

function parseCandidate(text: string) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim()
  const raw = cleaned.startsWith("```") ? cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "") : cleaned
  return Candidate.parse(JSON.parse(raw))
}

function generation(input: { projectID: string; revision: number; pending: Entry[]; model?: Provider.Model }) {
  return JSON.stringify({
    projectID: input.projectID,
    revision: input.revision,
    pending: input.pending.map((entry) => entry.occurrenceID),
    model: input.model ? `${input.model.providerID}/${input.model.id}` : "unconfigured",
  })
}

function unavailableGeneration(input: {
  projectID: string
  availabilityGeneration: number
  head: Entry
  reason: string
  model?: string
}) {
  return JSON.stringify({
    projectID: input.projectID,
    availabilityGeneration: input.availabilityGeneration,
    headOccurrenceID: input.head.occurrenceID,
    owner: input.head.taskID
      ? { kind: "task", id: input.head.taskID }
      : { kind: "session", id: input.head.sessionID ?? input.head.ownerID },
    reason: input.reason,
    model: input.model ?? null,
  })
}

function unavailableMessage(error: unknown) {
  if (error instanceof MissingModelConfigError) return error.data.message
  return error instanceof Error ? error.message : String(error)
}

function organizerOwner(entry: Entry) {
  if (entry.taskID) {
    const task = findTask(entry.taskID)
    if (!task) {
      throw new MissingModelConfigError({
        message: `Project MEMORY.MD pending occurrence ${entry.occurrenceID} belongs to missing Task ${entry.taskID}.`,
      })
    }
    const rootSessionID = task.session_id
    if (!rootSessionID) {
      throw new MissingModelConfigError({
        message: `Project MEMORY.MD pending Task ${entry.taskID} has no bound root Session model configuration.`,
      })
    }
    return { scope: { taskID: entry.taskID }, sessionID: entry.sessionID ?? rootSessionID }
  }
  if (entry.sessionID) return { scope: { sessionID: entry.sessionID }, sessionID: entry.sessionID }
  throw new MissingModelConfigError({
    message: `Project MEMORY.MD pending occurrence ${entry.occurrenceID} has no owning Session model configuration.`,
  })
}

export namespace ProjectMemoryOrganizer {
  export const protocolReserveTokens = PROTOCOL_RESERVE_TOKENS

  export async function run(input?: { projectID?: string; abort?: AbortSignal }) {
    const projectID = input?.projectID ?? Instance.project.id
    return withKeyedLock(
      organizerLocks,
      projectID,
      () => runUnlocked({ ...input, projectID }),
      10 * 60_000,
      input?.abort,
    )
  }

  async function runUnlocked(input: { projectID: string; abort?: AbortSignal }) {
    const checkpoint = () => input.abort?.throwIfAborted()
    checkpoint()
    const projectID = input.projectID
    const snapshot = ProjectMemory.read(projectID)
    const pending = ProjectMemory.pending(projectID)
    if (pending.length === 0) return { status: "idle" as const, revision: snapshot.revision }

    const leaseID = randomUUID()
    checkpoint()
    const lease = Database.transaction((db) =>
      ProjectMemory.beginOrganizerAttemptInTransaction(db, {
        projectID,
        leaseID,
        expectedRevision: snapshot.revision,
      }),
    )
    if (!lease) throw new Error("Project MEMORY.MD changed before the Organizer attempt began")
    const releaseLease = () =>
      Database.transaction((db) => ProjectMemory.releaseOrganizerAttemptInTransaction(db, { projectID, leaseID }))
    try {
      let owner!: ReturnType<typeof organizerOwner>
      let config: Awaited<ReturnType<typeof EffectiveConfig.effective>> | undefined
      let helper!: Awaited<ReturnType<typeof HelperAgentRegistry.get>>
      let model!: Provider.Model
      try {
        owner = organizerOwner(pending[0]!)
        config = await EffectiveConfig.effective(owner.scope)
        checkpoint()
        helper = await HelperAgentRegistry.get("memory", { config })
        const modelRef = configuredDefaultModelRef(config)
        model = await Provider.getModel(modelRef.providerID, modelRef.modelID, { config })
      } catch (error) {
        if (!(error instanceof MissingModelConfigError)) throw error
        const message = unavailableMessage(error)
        const unavailableKey = unavailableGeneration({
          projectID,
          availabilityGeneration: lease.availabilityGeneration,
          head: pending[0]!,
          reason: message,
          model: config?.model,
        })
        const expectedOccurrenceIDs = pending.map((entry) => entry.occurrenceID)
        const pendingAvailabilityLimit = config?.experimental?.memory?.pending_availability_limit ?? 500
        checkpoint()
        const unavailable = Database.transaction((db) =>
          ProjectMemory.markUnavailableAndTrimInTransaction(db, {
            projectID,
            leaseID,
            generation: unavailableKey,
            expectedRevision: snapshot.revision,
            expectedOccurrenceIDs,
            pendingAvailabilityLimit,
            allowTrim: snapshot.status === "unavailable" && snapshot.notice?.generation === unavailableKey,
            message,
          }),
        )
        if (!unavailable.applied) {
          throw new Error("Project MEMORY.MD Organizer lost its lease before unavailable settlement")
        }
        return { status: "unavailable" as const, revision: snapshot.revision, ...unavailable }
      }
      const memoryConfig = config.experimental?.memory
      const documentTokenLimit = memoryConfig?.document_token_limit ?? ProjectMemory.documentTokenLimit
      const configuredInputBudget = memoryConfig?.organizer_input_token_budget ?? 32_000
      const selected = selectPrefix({
        pending,
        documentTokens: snapshot.tokenCount,
        documentTokenLimit,
        configuredInputBudget,
        model,
      })
      if (selected.kind !== "selected") {
        const statusGeneration = generation({ projectID, revision: snapshot.revision, pending, model })
        const message =
          selected.kind === "model_context_incompatible"
            ? "The configured Memory Organizer model cannot fit the complete current MEMORY.MD plus one pending input. Configure a model with a larger context window or organize MEMORY.MD."
            : "The oldest pending input cannot fit the Memory Organizer input budget. Organize MEMORY.MD or increase the configured Organizer input budget."
        checkpoint()
        const applied = Database.transaction((db) =>
          ProjectMemory.setStatusInTransaction(db, {
            projectID,
            leaseID,
            status: selected.kind,
            generation: statusGeneration,
            message,
            expectedRevision: snapshot.revision,
          }),
        )
        if (!applied) throw new Error("Project MEMORY.MD Organizer lost its lease before attention settlement")
        return { status: selected.kind, revision: snapshot.revision }
      }

      const prompt = organizerPrompt({
        baseRevision: snapshot.revision,
        document: snapshot.content,
        documentTokenLimit,
        pending: selected.entries,
      })
      const sessionID = owner.sessionID
      const user = await sourceUser(sessionID)
      const messages: ModelMessage[] = [{ role: "user", content: prompt }]
      const result = await LLM.stream({
        agentID: "memory",
        agent: sessionRuntimeFromNativeAgent(helper),
        ...(user ? { user } : { requestID: selected.entries[0]!.occurrenceID }),
        system: [],
        small: true,
        tools: {},
        model,
        abort: input?.abort ?? new AbortController().signal,
        sessionID,
        config,
        retries: 0,
        messages,
        toolChoice: "none",
      })
      let candidateText = ""
      for await (const chunk of result.textStream) candidateText += chunk
      checkpoint()
      const candidate = parseCandidate(candidateText)
      checkpoint()
      const candidateTokens = Token.estimate(candidate.markdown.trim() + "\n")
      if (candidateTokens > documentTokenLimit) {
        checkpoint()
        const applied = Database.transaction((db) =>
          ProjectMemory.setStatusInTransaction(db, {
            projectID,
            leaseID,
            status: "capacity_reached",
            generation: generation({ projectID, revision: snapshot.revision, pending, model }),
            message:
              `Project MEMORY.MD reached its ${documentTokenLimit}-token capacity. ` +
              "Please ask the Memory Organizer to consolidate or remove stale project context before continuing.",
            expectedRevision: snapshot.revision,
          }),
        )
        if (!applied) throw new Error("Project MEMORY.MD Organizer lost its lease before capacity settlement")
        return { status: "capacity_reached" as const, revision: snapshot.revision, tokenCount: candidateTokens }
      }
      checkpoint()
      const committed = Database.transaction((db) =>
        ProjectMemory.commitOrganizationInTransaction(db, {
          projectID,
          leaseID,
          baseRevision: candidate.baseRevision,
          coveredOccurrenceIDs: candidate.coveredOccurrenceIDs,
          markdown: candidate.markdown,
          documentTokenLimit,
        }),
      )
      log.info("Project MEMORY.MD organized", { projectID, ...committed })
      return { status: "idle" as const, ...committed }
    } catch (error) {
      releaseLease()
      throw error
    }
  }

  export function init() {
    const state = lifecycle()
    if (state.unsub) return
    const directory = Instance.directory
    const projectID = Instance.project.id
    const unsubs: Array<() => void> = []
    let disposed = false
    const dispose = () => {
      if (disposed) return
      disposed = true
      for (const unsub of unsubs.reverse()) unsub()
    }
    state.unsub = dispose
    try {
      unsubs.push(
        Bus.subscribe(
          ProjectMemory.Event.OrganizationRequested,
          ({ properties, signal }) => run({ projectID: properties.projectID, abort: signal }),
          { durableID: "project-memory.organizer", effect: "idempotent_by_occurrence" },
        ),
      )
      unsubs.push(
        Bus.subscribe(Session.Event.ConfigChanged, () =>
          Database.transaction((db) => {
            ProjectMemory.invalidateOrganizerAvailabilityInTransaction(db, { projectID })
            ProjectMemory.requestOrganizationInTransaction(db, { projectID })
          }),
        ),
      )
      const projectConfigListener = (event: { directory?: string; payload?: { type?: string } }) => {
        if (event.directory !== directory || event.payload?.type !== "config.changed") return
        Database.transaction((db) => {
          ProjectMemory.invalidateOrganizerAvailabilityInTransaction(db, { projectID })
          ProjectMemory.requestOrganizationInTransaction(db, { projectID })
        })
      }
      GlobalBus.on("event", projectConfigListener)
      unsubs.push(() => GlobalBus.off("event", projectConfigListener))
      Database.transaction((db) => ProjectMemory.requestOrganizationInTransaction(db, { projectID }))
    } catch (error) {
      if (state.unsub === dispose) state.unsub = undefined
      dispose()
      throw error
    }
  }
}
