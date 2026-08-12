import type { ModelMessage } from "ai"
import z from "zod"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { resolveAgentModel } from "@/agent/model"
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

function estimateTokens(input: string) {
  return Math.ceil(input.length / 4)
}

function usableInputTokens(model: Provider.Model) {
  const declared = model.limit.input && model.limit.input > 0 ? model.limit.input : model.limit.context
  return Math.max(0, declared - RUNTIME_RESERVE_TOKENS)
}

function evidenceTokens(entry: Entry) {
  return estimateTokens(JSON.stringify(entry))
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
  config: Awaited<ReturnType<typeof EffectiveConfig.effective>>
}) {
  return JSON.stringify({
    projectID: input.projectID,
    availabilityGeneration: input.availabilityGeneration,
    model: input.config.model ?? null,
    memoryAgent: input.config.agent?.memory ?? null,
  })
}

function unavailableMessage(error: unknown) {
  if (error instanceof MissingModelConfigError) return error.data.message
  return error instanceof Error ? error.message : String(error)
}

export namespace ProjectMemoryOrganizer {
  export const protocolReserveTokens = PROTOCOL_RESERVE_TOKENS

  export async function run(input?: { projectID?: string; sessionID?: string; abort?: AbortSignal }) {
    const projectID = input?.projectID ?? Instance.project.id
    return withKeyedLock(organizerLocks, projectID, () => runUnlocked({ ...input, projectID }), 10 * 60_000)
  }

  async function runUnlocked(input: { projectID: string; sessionID?: string; abort?: AbortSignal }) {
    const projectID = input.projectID
    const snapshot = ProjectMemory.read(projectID)
    const pending = ProjectMemory.pending(projectID)
    if (pending.length === 0) return { status: "idle" as const, revision: snapshot.revision }

    const config = await EffectiveConfig.effective(input?.sessionID ? { sessionID: input.sessionID } : undefined)
    const memoryConfig = config.experimental?.memory
    const documentTokenLimit = memoryConfig?.document_token_limit ?? ProjectMemory.documentTokenLimit
    const configuredInputBudget = memoryConfig?.organizer_input_token_budget ?? 32_000
    const pendingAvailabilityLimit = memoryConfig?.pending_availability_limit ?? 500
    const leaseID = randomUUID()
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
      let helper: Awaited<ReturnType<typeof HelperAgentRegistry.get>>
      let model: Provider.Model
      try {
        helper = await HelperAgentRegistry.get("memory", { config })
        model = await resolveAgentModel("memory", input?.sessionID ? { sessionID: input.sessionID } : undefined)
      } catch (error) {
        if (!(error instanceof MissingModelConfigError)) throw error
        const unavailableKey = unavailableGeneration({
          projectID,
          availabilityGeneration: lease.availabilityGeneration,
          config,
        })
        const expectedOccurrenceIDs = pending.map((entry) => entry.occurrenceID)
        const unavailable = Database.transaction((db) =>
          ProjectMemory.markUnavailableAndTrimInTransaction(db, {
            projectID,
            leaseID,
            generation: unavailableKey,
            expectedRevision: snapshot.revision,
            expectedOccurrenceIDs,
            pendingAvailabilityLimit,
            allowTrim: snapshot.status === "unavailable" && snapshot.notice?.generation === unavailableKey,
            message: unavailableMessage(error),
          }),
        )
        if (!unavailable.applied) {
          throw new Error("Project MEMORY.MD Organizer lost its lease before unavailable settlement")
        }
        return { status: "unavailable" as const, revision: snapshot.revision, ...unavailable }
      }
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
      const sessionID = input?.sessionID ?? pending.find((entry) => entry.sessionID)?.sessionID
      if (!sessionID) throw new Error("Memory Organizer requires a real source Session identity")
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
        retries: 0,
        messages,
        toolChoice: "none",
      })
      const candidate = parseCandidate(await result.text)
      const candidateTokens = estimateTokens(candidate.markdown.trim() + "\n")
      if (candidateTokens > documentTokenLimit) {
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
    state.unsub = Bus.subscribe(
      ProjectMemory.Event.OrganizationRequested,
      ({ properties }) => run({ projectID: properties.projectID, sessionID: properties.sessionID }),
      { durableID: "project-memory.organizer" },
    )
    const configUnsub = Bus.subscribe(Session.Event.ConfigChanged, ({ properties }) =>
      Database.transaction((db) => {
        ProjectMemory.invalidateOrganizerAvailabilityInTransaction(db, { projectID: Instance.project.id })
        ProjectMemory.requestOrganizationInTransaction(db, {
          projectID: Instance.project.id,
          sessionID: properties.sessionID,
        })
      }),
    )
    const projectConfigListener = (event: { directory?: string; payload?: { type?: string } }) => {
      if (event.directory !== Instance.directory || event.payload?.type !== "config.changed") return
      Database.transaction((db) => {
        ProjectMemory.invalidateOrganizerAvailabilityInTransaction(db, { projectID: Instance.project.id })
        ProjectMemory.requestOrganizationInTransaction(db, { projectID: Instance.project.id })
      })
    }
    GlobalBus.on("event", projectConfigListener)
    Database.transaction((db) => ProjectMemory.requestOrganizationInTransaction(db, { projectID: Instance.project.id }))
    const currentUnsub = state.unsub
    state.unsub = () => {
      currentUnsub()
      configUnsub()
      GlobalBus.off("event", projectConfigListener)
    }
  }
}
