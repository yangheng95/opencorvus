import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Identifier } from "../../src/id/id"
import {
  ProjectMemory,
  ProjectMemoryInvariantError,
  ProtectedProjectMemoryError,
} from "../../src/memory/project-memory"
import { Memory } from "../../src/memory"
import { MemoryChunkTable } from "../../src/memory/memory.sql"
import { Database, eq } from "../../src/storage/db"
import type { Message } from "../../src/session/message"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { MemoryTool } from "../../src/tool/memory"
import { Server } from "../../src/server/server"
import { persistQueuedTask } from "../../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { EngineService } from "../../src/task-api"
import { Question } from "../../src/question"
import { findInteractionByExternal } from "../../src/engine/store"
import { QuestionRoutes } from "../../src/server/routes/question"
import { Bus } from "../../src/bus"
import { Config } from "../../src/config/config"
import { PermissionAuthority } from "../../src/permission/authority"
import { PermissionRoutes } from "../../src/server/routes/permission"
import { ChannelIngress } from "../../src/channel/ingress"
import { ProjectMemoryOrganizer } from "../../src/memory/project-memory-organizer"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { EffectiveConfig } from "../../src/config/effective"
import { LLM } from "../../src/session/llm"
import { MemoryInjection } from "../../src/memory/injection"

const model = { providerID: "test", modelID: "project-memory" }
const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "project-memory-test",
  version: "2026.08.12.1",
  packageDigest: "b".repeat(64),
}

function organizerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Project Memory Organizer Test",
    limit: { context: 100_000, input: 90_000, output: 12_000 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: { id: model.modelID, url: "https://project-memory.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-12",
  } as ProviderType.Model
}

async function taskFixture(
  title: string,
  actor: "user" | "mission" = "mission",
  channelBinding?: { platform: "slack"; channel: string; thread: string },
) {
  const root = await Session.create({ kind: "root", title })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  persistQueuedTask({
    taskID,
    sessionID: root.id,
    now,
    title,
    request: `Create ${title}`,
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: { actor },
    channelBinding,
    projectID: Instance.project.id,
    queue: false,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  return { root, taskID }
}

async function waitFor(check: () => boolean, message: string, timeout = 5_000) {
  const deadline = Date.now() + timeout
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(message)
    await Bun.sleep(20)
  }
}

function permissionInvocation(sessionID: string, suffix: string) {
  return {
    projectID: Instance.project.id,
    sessionID,
    messageID: `msg_memory_permission_${suffix}`,
    toolCallID: `call_memory_permission_${suffix}`,
    providerKind: "builtin" as const,
    providerID: "builtin",
    toolName: "webfetch",
    args: { url: `https://example.test/${suffix}` },
  }
}

async function pendingPermission(sessionID: string, suffix: string) {
  let resolveRequest!: (request: PermissionAuthority.Request) => void
  const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveRequest = resolve))
  const unsubscribe = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveRequest(properties))
  const execution = PermissionAuthority.authorizeAndExecute(permissionInvocation(sessionID, suffix), async () => "ok")
  const request = await asked
  unsubscribe()
  return { request, execution }
}

function userMessage(sessionID: string, text: string, time: number, extra?: Record<string, unknown>) {
  const info: Message.User = {
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "assistant",
    model,
    time: { created: time },
    extra,
  }
  const part: Message.TextPart = {
    id: Identifier.ascending("part"),
    sessionID,
    messageID: info.id,
    type: "text",
    text,
    kind: "user_content",
    source: "user",
  }
  return { info, parts: [part] }
}

function assistantMessage(sessionID: string, text: string, time: number, parentID: string) {
  const info: Message.Assistant = {
    id: Identifier.ascending("message"),
    sessionID,
    role: "assistant",
    author: "assistant",
    agent: "assistant",
    modelID: model.modelID,
    providerID: model.providerID,
    parentID,
    path: { cwd: Instance.directory, root: Instance.worktree },
    time: { created: time, completed: time },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
  const part: Message.TextPart = {
    id: Identifier.ascending("part"),
    sessionID,
    messageID: info.id,
    type: "text",
    text,
  }
  return { info, parts: [part] }
}

describe("Project MEMORY.MD pending input and organizer document", () => {
  afterEach(async () => {
    Server.resetProjectRoutesAppForTest()
    await resetMemoryDatabase()
  })

  test("captures trusted turns with two transcript contexts, redaction, replay, rename, and protected access", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Chat" })
        const marker = ProjectMemory.userInputExtra({ surface: "test.prompt", literalText: "Initial request" })
        const first = userMessage(session.id, "Initial request", 1_000, marker)
        await Session.persistMessage(first)
        const assistant = assistantMessage(session.id, "Visible answer", 2_000, first.info.id)
        await Session.persistMessage(assistant)
        const runtime = userMessage(session.id, "Durable runtime wake", 3_000)
        const internal = ProjectMemory.captureMessageInTransaction
        await Session.persistMessage(runtime)
        expect(typeof internal).toBe("function")

        const third = userMessage(
          session.id,
          "password=top-secret\nBearer abc.def.ghi\nQk0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          4_000,
          ProjectMemory.userInputExtra({
            surface: "test.prompt",
            literalText: "password=top-secret\nBearer abc.def.ghi\nQk0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          }),
        )
        await Session.persistMessage(third)
        await Session.persistMessage(third)

        const renamed = await Session.setTitle({ sessionID: session.id, title: "Renamed conversation" })
        expect(renamed.title).toBe("Renamed conversation")

        const document = ProjectMemory.read(Instance.project.id)
        expect(document).toMatchObject({
          filename: "MEMORY.MD",
          scope: "project",
          pendingCount: 2,
          revision: 0,
          content: "",
        })
        const pendingText = JSON.stringify(ProjectMemory.pending(Instance.project.id))
        expect(pendingText).toContain("Initial request")
        expect(pendingText).toContain("assistant")
        expect(pendingText).toContain("Durable runtime wake")
        expect(pendingText).toContain("password=<redacted>")
        expect(pendingText).toContain("Bearer <redacted>")
        expect(pendingText).toContain("inline_binary_omitted")

        const tool = await MemoryTool.init()
        const toolResult = await tool.execute({ action: "project_read" }, {
          sessionID: session.id,
          messageID: "msg_project_memory_tool",
          callID: "call_project_memory_tool",
          agent: "build",
          abort: AbortSignal.any([]),
          messages: [],
          metadata: () => {},
          ask: async () => {},
        } as never)
        expect(JSON.parse(toolResult.output).document).toEqual(document)

        const response = await Server.App().request("/experimental/project-memory", {
          headers: { "x-opencorvus-directory": project.path },
        })
        if (response.status !== 200) throw new Error(await response.text())
        expect(await response.json()).toMatchObject({
          filename: "MEMORY.MD",
          scope: "project",
          revision: document.revision,
          pendingCount: document.pendingCount,
          content: document.content,
        })

        const ledgerRows = Database.use((db) =>
          db
            .select()
            .from(MemoryChunkTable)
            .all()
            .filter((row) => row.id.startsWith("mck_user_")),
        )
        expect(ledgerRows).toHaveLength(2)
        const fileID = ledgerRows[0]!.file_id
        expect(Memory.getFileInProject({ fileId: fileID, projectId: Instance.project.id })).toBeNull()
        expect(() => Memory.deleteFileInProject({ fileId: fileID, projectId: Instance.project.id })).toThrow(
          ProtectedProjectMemoryError,
        )
        expect(() => Memory.writeChunks(fileID, Instance.project.id, "tampered")).toThrow(ProtectedProjectMemoryError)
        expect(Memory.getChunks(fileID)).toEqual([])
        expect(Memory.getChunksInProject({ fileId: fileID, projectId: Instance.project.id })).toEqual([])

        const changed = { ...third, parts: [{ ...third.parts[0]!, text: "Changed replay" }] }
        expect(() => Database.transaction((db) => ProjectMemory.captureMessageInTransaction(db, changed))).toThrow(
          ProjectMemoryInvariantError,
        )

        Database.transaction((db) => {
          const concurrent = ProjectMemory.captureOccurrenceInTransaction(db, {
            occurrenceKind: "interaction_reply",
            occurrenceID: "concurrent-identical",
            projectID: Instance.project.id,
            sessionID: session.id,
            surface: "test.concurrent",
            timeCreated: 5_000,
            text: "Identical replay",
          })
          const replay = ProjectMemory.captureOccurrenceInTransaction(db, {
            occurrenceKind: "interaction_reply",
            occurrenceID: "concurrent-identical",
            projectID: Instance.project.id,
            sessionID: session.id,
            surface: "test.concurrent",
            timeCreated: 5_000,
            text: "Identical replay",
          })
          expect(replay).toEqual(concurrent)
          expect(ProjectMemory.readInTransaction(db, Instance.project.id).pendingCount).toBe(3)
        })

        const beforeCommit = ProjectMemory.read(Instance.project.id)
        const covered = ProjectMemory.pending(Instance.project.id).map((entry) => entry.occurrenceID)
        const commitLease = Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "successful-organizer-lease",
            expectedRevision: beforeCommit.revision,
            timeUpdated: 5_999,
          }),
        )
        expect(commitLease).toMatchObject({ id: "successful-organizer-lease", revision: beforeCommit.revision })
        const committed = Database.transaction((db) =>
          ProjectMemory.commitOrganizationInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "successful-organizer-lease",
            baseRevision: beforeCommit.revision,
            coveredOccurrenceIDs: covered,
            markdown:
              "# Project context\n\nThe user needs the initial request and the later identical interaction handled; secrets stay redacted.",
            timeUpdated: 6_000,
          }),
        )
        expect(committed).toMatchObject({ revision: 1, coveredOccurrenceIDs: covered })
        const replayed = Database.transaction((db) =>
          ProjectMemory.commitOrganizationInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "successful-organizer-lease",
            baseRevision: beforeCommit.revision,
            coveredOccurrenceIDs: covered,
            markdown:
              "# Project context\n\nThe user needs the initial request and the later identical interaction handled; secrets stay redacted.",
            timeUpdated: 7_000,
          }),
        )
        expect(replayed).toEqual(committed)
        expect(ProjectMemory.read(Instance.project.id)).toMatchObject({
          filename: "MEMORY.MD",
          scope: "project",
          revision: 1,
          pendingCount: 0,
        })
        expect(ProjectMemory.read(Instance.project.id).content).toContain("The user needs the initial request")

        Database.close()
        Database.Client()
        expect(ProjectMemory.read(Instance.project.id).content).toContain("initial request")
      },
    })
  })

  test("fences competing Organizer runtimes until lease expiry and rejects the stale result", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Concurrent memory organization" })
        await Session.persistMessage(
          userMessage(
            session.id,
            "Preserve this project decision semantically.",
            8_000,
            ProjectMemory.userInputExtra({
              surface: "test.concurrent-organizer",
              literalText: "Preserve this project decision semantically.",
            }),
          ),
        )
        const snapshot = ProjectMemory.read(Instance.project.id)
        const coveredOccurrenceIDs = ProjectMemory.pending(Instance.project.id).map((entry) => entry.occurrenceID)
        const availableLease = Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "available-stream",
            expectedRevision: snapshot.revision,
            leaseTtlMs: 100,
            timeUpdated: 1_000,
          }),
        )
        expect(availableLease).toMatchObject({ id: "available-stream", expiresAt: 1_100 })

        const competingLease = Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "missing-model-competitor",
            expectedRevision: snapshot.revision,
            timeUpdated: 1_050,
          }),
        )
        expect(competingLease).toBeUndefined()
        const competingFifo = Database.transaction((db) =>
          ProjectMemory.markUnavailableAndTrimInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "missing-model-competitor",
            generation: "must-not-apply",
            expectedRevision: snapshot.revision,
            expectedOccurrenceIDs: coveredOccurrenceIDs,
            pendingAvailabilityLimit: 0,
            allowTrim: true,
            message: "The competing runtime has no model.",
          }),
        )
        expect(competingFifo).toEqual({ applied: false, droppedOccurrenceIDs: [] })
        expect(ProjectMemory.read(Instance.project.id).pendingCount).toBe(1)

        expect(
          Database.transaction((db) =>
            ProjectMemory.setStatusInTransaction(db, {
              projectID: Instance.project.id,
              leaseID: "available-stream",
              status: "capacity_reached",
              generation: "expired-status",
              expectedRevision: snapshot.revision,
              message: "An expired Organizer must not settle status.",
              timeUpdated: 1_101,
            }),
          ),
        ).toBe(false)
        expect(
          Database.transaction((db) =>
            ProjectMemory.markUnavailableAndTrimInTransaction(db, {
              projectID: Instance.project.id,
              leaseID: "available-stream",
              generation: "expired-fifo",
              expectedRevision: snapshot.revision,
              expectedOccurrenceIDs: coveredOccurrenceIDs,
              pendingAvailabilityLimit: 0,
              allowTrim: true,
              message: "An expired Organizer must not delete pending input.",
              timeUpdated: 1_101,
            }),
          ),
        ).toEqual({ applied: false, droppedOccurrenceIDs: [] })
        expect(() =>
          Database.transaction((db) =>
            ProjectMemory.commitOrganizationInTransaction(db, {
              projectID: Instance.project.id,
              leaseID: "available-stream",
              baseRevision: snapshot.revision,
              coveredOccurrenceIDs,
              markdown: "# Project context\n\nExpired organizer output.",
              timeUpdated: 1_101,
            }),
          ),
        ).toThrow(ProjectMemoryInvariantError)
        expect(ProjectMemory.read(Instance.project.id)).toMatchObject({
          pendingCount: 1,
          status: "organizing",
          notice: undefined,
        })

        const takeoverLease = Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "expired-lease-takeover",
            expectedRevision: snapshot.revision,
            timeUpdated: 1_101,
          }),
        )
        expect(takeoverLease).toMatchObject({ id: "expired-lease-takeover", revision: snapshot.revision })
        expect(() =>
          Database.transaction((db) =>
            ProjectMemory.commitOrganizationInTransaction(db, {
              projectID: Instance.project.id,
              leaseID: "available-stream",
              baseRevision: snapshot.revision,
              coveredOccurrenceIDs,
              markdown: "# Project context\n\nStale organizer output.",
              timeUpdated: 1_102,
            }),
          ),
        ).toThrow(ProjectMemoryInvariantError)
        expect(ProjectMemory.read(Instance.project.id).pendingCount).toBe(1)

        const committed = Database.transaction((db) =>
          ProjectMemory.commitOrganizationInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "expired-lease-takeover",
            baseRevision: snapshot.revision,
            coveredOccurrenceIDs,
            markdown: "# Project context\n\nThe project requires the decision to be preserved semantically.",
            timeUpdated: 1_102,
          }),
        )
        expect(committed).toMatchObject({ revision: snapshot.revision + 1, coveredOccurrenceIDs })
        expect(ProjectMemory.read(Instance.project.id)).toMatchObject({ pendingCount: 0, status: "idle" })
      },
    })
  })

  test("revokes an active Organizer lease when model availability changes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Memory model configuration race" })
        await Session.persistMessage(
          userMessage(
            session.id,
            "Use the newly configured memory model.",
            9_000,
            ProjectMemory.userInputExtra({
              surface: "test.config-race",
              literalText: "Use the newly configured memory model.",
            }),
          ),
        )
        const snapshot = ProjectMemory.read(Instance.project.id)
        const coveredOccurrenceIDs = ProjectMemory.pending(Instance.project.id).map((entry) => entry.occurrenceID)
        Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "pre-config-change",
            expectedRevision: snapshot.revision,
          }),
        )
        const generation = Database.transaction((db) =>
          ProjectMemory.invalidateOrganizerAvailabilityInTransaction(db, { projectID: Instance.project.id }),
        )
        expect(generation).toBe(1)
        expect(() =>
          Database.transaction((db) =>
            ProjectMemory.commitOrganizationInTransaction(db, {
              projectID: Instance.project.id,
              leaseID: "pre-config-change",
              baseRevision: snapshot.revision,
              coveredOccurrenceIDs,
              markdown: "# Project context\n\nOutput from the old model configuration.",
            }),
          ),
        ).toThrow(ProjectMemoryInvariantError)
        const staleFifo = Database.transaction((db) =>
          ProjectMemory.markUnavailableAndTrimInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "pre-config-change",
            generation: "stale-config-fifo",
            expectedRevision: snapshot.revision,
            expectedOccurrenceIDs: coveredOccurrenceIDs,
            pendingAvailabilityLimit: 0,
            allowTrim: true,
            message: "Old configuration must not delete pending input.",
          }),
        )
        expect(staleFifo).toEqual({ applied: false, droppedOccurrenceIDs: [] })
        expect(ProjectMemory.read(Instance.project.id).pendingCount).toBe(1)
        const replacement = Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "post-config-change",
            expectedRevision: snapshot.revision,
          }),
        )
        expect(replacement).toMatchObject({ id: "post-config-change", availabilityGeneration: 1 })
      },
    })
  })

  test("applies pending FIFO only when the same unavailable generation owns a persisted Organizer lease twice", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Unavailable memory agent" })
        for (let index = 0; index < 3; index += 1) {
          const message = userMessage(
            session.id,
            `Pending intent ${index + 1}`,
            10_000 + index,
            ProjectMemory.userInputExtra({ surface: "test.unavailable", literalText: `Pending intent ${index + 1}` }),
          )
          await Session.persistMessage(message)
        }
        const before = ProjectMemory.read(Instance.project.id)
        const occurrenceIDs = ProjectMemory.pending(Instance.project.id).map((entry) => entry.occurrenceID)
        const firstLease = Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "first-unavailable-lease",
            expectedRevision: before.revision,
          }),
        )
        expect(firstLease).toMatchObject({ id: "first-unavailable-lease", availabilityGeneration: 0 })
        const first = Database.transaction((db) =>
          ProjectMemory.markUnavailableAndTrimInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "first-unavailable-lease",
            generation: "unavailable-generation",
            expectedRevision: before.revision,
            expectedOccurrenceIDs: occurrenceIDs,
            pendingAvailabilityLimit: 2,
            allowTrim: false,
            message: "Memory Organizer has no configured model.",
          }),
        )
        expect(first).toEqual({ applied: true, droppedOccurrenceIDs: [] })
        const secondLease = Database.transaction((db) =>
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "second-unavailable-lease",
            expectedRevision: before.revision,
          }),
        )
        expect(secondLease).toMatchObject({ id: "second-unavailable-lease", availabilityGeneration: 0 })
        const applied = Database.transaction((db) =>
          ProjectMemory.markUnavailableAndTrimInTransaction(db, {
            projectID: Instance.project.id,
            leaseID: "second-unavailable-lease",
            generation: "unavailable-generation",
            expectedRevision: before.revision,
            expectedOccurrenceIDs: occurrenceIDs,
            pendingAvailabilityLimit: 2,
            allowTrim: true,
            message: "Memory Organizer has no configured model.",
          }),
        )
        expect(applied).toEqual({ applied: true, droppedOccurrenceIDs: [occurrenceIDs[0]!] })
        expect(ProjectMemory.pending(Instance.project.id).map((entry) => entry.text)).toEqual([
          "Pending intent 2",
          "Pending intent 3",
        ])
        expect(ProjectMemory.read(Instance.project.id)).toMatchObject({
          filename: "MEMORY.MD",
          scope: "project",
          status: "unavailable",
          pendingCount: 2,
          droppedPendingCount: 1,
          notice: { generation: "unavailable-generation", acknowledged: false },
        })
      },
    })
  })

  test("streams the fixed memory agent and commits its semantic replacement envelope", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const automaticDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
        const session = await Session.create({ kind: "assistant", title: "Organizer semantic consolidation" })
        for (const [index, text] of [
          "Keep every raw quote forever.",
          "Correction: maintain the complete meaning, not a quotation ledger, and cap the project context at 10k tokens.",
        ].entries()) {
          await Session.persistMessage(
            userMessage(
              session.id,
              text,
              20_000 + index,
              ProjectMemory.userInputExtra({ surface: "test.organizer", literalText: text }),
            ),
          )
        }
        const pending = ProjectMemory.pending(Instance.project.id)
        const candidate = JSON.stringify({
          baseRevision: 0,
          coveredOccurrenceIDs: pending.map((entry) => entry.occurrenceID),
          disposition: "organized",
          markdown:
            "# Project context\n\nThe dedicated Memory Organizer maintains complete intended meaning rather than a quotation ledger. Project context is capped at 10,000 estimated tokens.",
        })
        const resolvedModel = organizerModel()
        const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(resolvedModel)
        const streamCalls: Parameters<typeof LLM.stream>[0][] = []
        const streamSpy = spyOn(LLM, "stream").mockImplementation(async (input) => {
          streamCalls.push(input)
          return { text: Promise.resolve(candidate) } as never
        })
        const configSpy = spyOn(EffectiveConfig, "effective").mockResolvedValue({
          model: `${model.providerID}/${model.modelID}`,
          experimental: {
            memory: {
              enabled: true,
              document_token_limit: 10_000,
              organizer_input_token_budget: 32_000,
              pending_availability_limit: 500,
            },
          },
        } as never)
        const baseSpy = spyOn(EffectiveConfig, "base").mockResolvedValue({
          model: `${model.providerID}/${model.modelID}`,
        } as never)
        try {
          const result = await ProjectMemoryOrganizer.run({
            projectID: Instance.project.id,
            sessionID: session.id,
          })
          expect(result).toMatchObject({ status: "idle", revision: 1 })
          expect(streamCalls).toHaveLength(1)
          expect(streamCalls[0]).toMatchObject({ agentID: "memory", tools: {}, retries: 0, toolChoice: "none" })
          expect(ProjectMemory.read(Instance.project.id)).toMatchObject({
            filename: "MEMORY.MD",
            scope: "project",
            status: "idle",
            revision: 1,
            pendingCount: 0,
          })
          expect(ProjectMemory.read(Instance.project.id).content).toContain("complete intended meaning")
          automaticDrain[Symbol.dispose]()
          Bus.resumeDurablePublications()
          await waitFor(() => Bus.TestHooks.outbox().length === 0, "Organizer publication receipt did not settle")
        } finally {
          automaticDrain[Symbol.dispose]()
          baseSpy.mockRestore()
          configSpy.mockRestore()
          streamSpy.mockRestore()
          modelSpy.mockRestore()
        }
      },
    })
  })

  test("injects a capacity notice that requires a visible user prompt without delegating organization to the main agent", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Capacity notice" })
        Database.transaction((db) =>
          ProjectMemory.setStatusInTransaction(db, {
            projectID: Instance.project.id,
            status: "capacity_reached",
            generation: "capacity-generation",
            message: "Project MEMORY.MD reached its 10,000-token capacity. Please run memory organization.",
          }),
        )
        const configSpy = spyOn(EffectiveConfig, "effective").mockResolvedValue({
          experimental: { memory: { enabled: true, auto_inject: true, token_budget: 10_000 } },
        } as never)
        try {
          const section = await MemoryInjection.systemPromptSection({
            projectID: Instance.project.id,
            sessionID: session.id,
            query: "continue",
            memoryToolAvailable: true,
          })
          expect(section).toContain("Project MEMORY.MD reached its 10,000-token capacity")
          expect(section).toContain("Tell the user in your next visible response")
          expect(section).toContain("Do not organize it yourself")
        } finally {
          configSpy.mockRestore()
        }
      },
    })
  })

  test("captures attachment-only input and direct occurrences with stable canonical metadata", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Attachment work" })
        const literalInput = "Use the attached notes only"
        const info: Message.User = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "assistant",
          model,
          time: { created: 5_000 },
          extra: ProjectMemory.userInputExtra({ surface: "test.attachment", literalText: literalInput }),
        }
        await Session.persistMessage({
          info,
          parts: [
            {
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID: info.id,
              type: "file",
              mime: "text/plain",
              filename: "notes.txt",
              url: "https://example.invalid/private?token=secret",
            },
            {
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID: info.id,
              type: "text",
              text: "host-expanded-file-content password=must-not-copy",
            },
          ],
        })
        Database.transaction((db) =>
          ProjectMemory.captureOccurrenceInTransaction(db, {
            occurrenceKind: "interaction_reply",
            occurrenceID: "interaction-stable-1",
            projectID: Instance.project.id,
            sessionID: session.id,
            surface: "interaction.question",
            timeCreated: 6_000,
            text: "Structured answer",
          }),
        )
        const document = ProjectMemory.read(Instance.project.id)
        expect(document.pendingCount).toBe(2)
        const pendingText = JSON.stringify(ProjectMemory.pending(Instance.project.id))
        expect(pendingText).toContain("notes.txt")
        expect(pendingText).toContain("text/plain")
        expect(pendingText).toContain("<external-reference-omitted>")
        expect(pendingText).toContain(literalInput)
        const captured = Database.use((db) =>
          db
            .select({ content: MemoryChunkTable.content })
            .from(MemoryChunkTable)
            .where(eq(MemoryChunkTable.project_id, Instance.project.id))
            .all()
            .map((row) => JSON.parse(row.content))
            .find((entry) => entry.occurrenceKind === "message"),
        )
        expect(captured.text).toBe(literalInput)
        expect(pendingText).toContain("interaction-stable-1")
        expect(pendingText).toContain("Structured answer")
      },
    })
  })

  test("captures direct user Task creation and trusted HTTP interaction input while service calls stay internal", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const direct = await taskFixture("Direct user task", "user")
        await taskFixture("Mission task", "mission")
        expect(JSON.stringify(ProjectMemory.pending(Instance.project.id))).toContain("Create Direct user task")
        expect(ProjectMemory.read(Instance.project.id).pendingCount).toBe(1)

        const requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: direct.root.id,
          requestID,
          questions: [{ header: "Choice", question: "Which option?", options: [] }],
        })
        let interaction
        for (let attempt = 0; attempt < 80; attempt += 1) {
          interaction = findInteractionByExternal(requestID)
          if (interaction) break
          await Bun.sleep(25)
        }
        expect(interaction?.status).toBe("pending")

        await EngineService.replyInteraction(interaction!.id, { answers: [["internal"]], autoReply: false })
        expect(await waiting).toEqual([["internal"]])
        expect(ProjectMemory.read(Instance.project.id).pendingCount).toBe(1)

        const routeRequestID = Identifier.ascending("question")
        const routeWaiting = Question.ask({
          sessionID: direct.root.id,
          requestID: routeRequestID,
          questions: [{ header: "Route", question: "Answer through HTTP?", options: [] }],
        })
        for (let attempt = 0; attempt < 80 && !findInteractionByExternal(routeRequestID); attempt += 1) {
          await Bun.sleep(25)
        }
        const response = await QuestionRoutes().request(`/${routeRequestID}/reply`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: [["operator answer password=route-secret"]] }),
        })
        if (response.status !== 200) throw new Error(await response.text())
        expect(await routeWaiting).toEqual([["operator answer password=route-secret"]])
        const document = ProjectMemory.read(Instance.project.id)
        expect(document.pendingCount).toBe(2)
        const pendingText = JSON.stringify(ProjectMemory.pending(Instance.project.id))
        expect(pendingText).toContain("password=<redacted>")
        expect(pendingText.includes("route-secret")).toBe(false)
        const rawLedger = Database.use((db) =>
          db
            .select({ content: MemoryChunkTable.content })
            .from(MemoryChunkTable)
            .where(eq(MemoryChunkTable.project_id, Instance.project.id))
            .all()
            .map((row) => row.content)
            .join("\n"),
        )
        expect(rawLedger.includes("route-secret")).toBe(false)
      },
    })
  })

  test("commits one authoritative permission reply when the HTTP decision is repeated with different text", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        EngineService.init()
        const task = await taskFixture("Permission memory")
        const pending = await pendingPermission(task.root.id, "duplicate")
        await waitFor(
          () => findInteractionByExternal(pending.request.id)?.status === "pending",
          "permission interaction was not projected",
        )

        const reply = async (message: string) => {
          const response = await PermissionRoutes().request(`/${pending.request.id}/reply`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decision: "allow_once", actorID: "operator", message }),
          })
          if (response.status !== 200) throw new Error(await response.text())
          return response.json()
        }
        await reply("approve password=winner-secret")
        await reply("approve password=loser-secret")
        expect(await pending.execution).toBe("ok")
        await waitFor(() => Bus.TestHooks.outbox().length === 0, "permission reply outbox did not converge")

        const decisions = (await PermissionAuthority.history()).filter((row) => row.event_type === "allowed_once")
        const document = ProjectMemory.read(Instance.project.id)
        expect(decisions).toHaveLength(1)
        expect(document.pendingCount).toBe(1)
        const pendingText = JSON.stringify(ProjectMemory.pending(Instance.project.id))
        expect(pendingText).toContain("password=<redacted>")
        expect(pendingText.includes("winner-secret")).toBe(false)
        expect(pendingText.includes("loser-secret")).toBe(false)
        expect(findInteractionByExternal(pending.request.id)?.status).toBe("answered")
      },
    })
  })

  test("recovers a committed question reply and its memory occurrence after interruption before durable delivery", async () => {
    await using project = await memoryProject()
    let requestID = ""
    let waitingOutcome: Promise<unknown> | undefined
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const task = await taskFixture("Question recovery memory")
        requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: task.root.id,
          requestID,
          questions: [{ header: "Recovery", question: "Continue?", options: [] }],
        })
        waitingOutcome = waiting.catch((error) => error)
        await waitFor(() => findInteractionByExternal(requestID)?.status === "pending", "question was not projected")
        await waitFor(() => Bus.TestHooks.outbox().length === 0, "precondition outbox did not drain")

        using _interruption = Question.TestHooks.failAfterNextUserOutboxCommit()
        using _suppressedDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
        const response = await QuestionRoutes().request(`/${requestID}/reply`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: [["recover password=recovery-secret"]] }),
        })
        expect(response.status).toBe(500)
        expect(
          Bus.TestHooks.outbox().some(
            (row) => row.event_type === Question.Event.Replied.type && row.occurrence_id.startsWith("bus-occurrence:"),
          ),
        ).toBe(true)
        expect(findInteractionByExternal(requestID)?.status).toBe("pending")
      },
    })

    await Instance.disposeAll()
    void waitingOutcome
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        Bus.resumeDurablePublications()
        await waitFor(() => Bus.TestHooks.outbox().length === 0, "recovered question outbox did not converge")
        expect(findInteractionByExternal(requestID)?.status).toBe("answered")
        const document = ProjectMemory.read(Instance.project.id)
        expect(document.pendingCount).toBe(1)
        const pendingText = JSON.stringify(ProjectMemory.pending(Instance.project.id))
        expect(pendingText).toContain("password=<redacted>")
        expect(pendingText.includes("recovery-secret")).toBe(false)
      },
    })
  })

  test("records the literal channel answer through the real bound-task interaction path", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const task = await taskFixture("Channel memory", "mission", {
          platform: "slack",
          channel: "memory-channel",
          thread: "memory-thread",
        })
        const requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: task.root.id,
          requestID,
          questions: [{ header: "Channel", question: "Your answer?", options: [] }],
        })
        await waitFor(
          () => findInteractionByExternal(requestID)?.status === "pending",
          "channel question was not projected",
        )
        const result = await ChannelIngress.message({
          platform: "slack",
          channel: "memory-channel",
          thread: "memory-thread",
          text: "channel answer password=channel-secret",
          allow_create: false,
        })
        expect(result.kind).toBe("interaction")
        expect(await waiting).toEqual([["channel answer password=channel-secret"]])
        const document = ProjectMemory.read(Instance.project.id)
        expect(document.pendingCount).toBe(1)
        const pendingText = JSON.stringify(ProjectMemory.pending(Instance.project.id))
        expect(pendingText).toContain("password=<redacted>")
        expect(pendingText.includes("channel-secret")).toBe(false)
      },
    })
  })
})
