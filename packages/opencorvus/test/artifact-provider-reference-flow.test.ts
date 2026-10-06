import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { publishTaskArtifactProjectFiles } from "@/task-artifact/store"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import {
  EngineArtifactEnvelopeSchema,
  ArtifactReadLocatorSchema,
  mintArtifactLocatorReference,
  mintArtifactReadReference,
  mintArtifactSelectionReference,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import {
  ArtifactReferenceResolutionError,
  completeArtifactReadsBeforePublication,
  resolveArtifactLocatorReferenceBeforeRead,
  resolveArtifactReadReferenceBeforeSelection,
  selectedArtifactLocatorsBeforePublication,
} from "@/agent/artifact-read-facts"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Database, eq } from "@/storage/db"
import { createToolExecutionSurface } from "@/tool/execution-surface"
import { ArtifactPublishTool, ArtifactReadTool, ArtifactSelectTool } from "@/tool/artifact-catalog"
import * as TaskToolScope from "@/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

// Only the established projected-worker ownership boundary is isolated below.
// Resource publication, ArtifactReadTool, durable facts, audit and publisher are real.
for (const deliveries of [["materialized_file"], ["materialized_file", "materialized_file"],
  ["materialized_file", "inline"]] as const) {
  for (const differentTurn of [false, true]) {
    test(`real resource ${deliveries.join("+")} publication ${differentTurn ? "rejects different Turn" : "preserves same-Turn provenance"}`, async () => {
      await using project = await memoryProject()
      await Instance.provide({ directory: project.path, fn: async () => {
        const session = Session.prepareRootNext({ kind: "root", directory: project.path, title: "Complete resource reads" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        const loaded = await ExpertSquadRegistry.loadPackage(path.resolve(import.meta.dir, "../src/expert-squad/builtin/base"))
        const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base",
          version: loaded.manifest.version, packageDigest: loaded.packageDigest }
        persistTask({ taskID, rootSession: session, now, title: "Complete resource reads", request: "Read published bytes",
          productPillar: "work", metadata: {}, projectID: Instance.project.id, packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID,
            projectID: Instance.project.id, rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }) })
        const scope: TaskToolScope.TaskToolExecutionScope = {
          packageToolRef: null, kind: "task", projectID: Instance.project.id, projectDirectory: project.path, taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID), sessionID: session.id,
          messageID: Identifier.ascending("message"), toolCallID: Identifier.ascending("tool"), toolPartID: Identifier.ascending("part"),
          executionSurface: createToolExecutionSurface({ toolIDs: ["artifact_read", "artifact_publish"], permission: [] }),
          owner: { kind: "projected-worker", expertSquadID: "base", packageRevision, agentID: "reference-worker",
            projectionHash: "9".repeat(64), workerTurnDescriptorID: Identifier.ascending("artifact"), workerTurnDescriptorHash: "8".repeat(64) },
        }
        const text = "Hello from a formal Task.\n"
        await fs.writeFile(path.join(project.path, "hello.txt"), text)
        const publication = await publishTaskArtifactProjectFiles({ scope,
          files: [{ path: "hello.txt", mediaType: "text/plain" }], source: { kind: "current_task_project" } })
        const locator = { source: "task_artifact_resource" as const, ref: publication.artifacts[0]! }
        const locatorRef = mintArtifactLocatorReference()
        const user = await Session.updateMessage({ id: Identifier.ascending("message"), sessionID: session.id,
          role: "user", author: "user", agent: "worker", time: { created: now },
          model: { providerID: "openai", modelID: "gpt-5.6-terra" } })
        const search = await assistantMessage({ sessionID: session.id, parentID: user.id, created: now + 1, projectPath: project.path })
        await completedToolPart({ sessionID: session.id, messageID: search.id, created: now + 1, tool: "artifact_search",
          toolInput: {}, output: { entries: [{ locator, artifact_locator_ref: locatorRef }] } })
        const readTool = await ArtifactReadTool.init()
        const references: string[] = []
        for (const [index, delivery] of deliveries.entries()) {
          const message = await assistantMessage({ sessionID: session.id, parentID: user.id,
            created: now + 3 + index * 3, projectPath: project.path })
          const args = readTool.parameters.parse({ reads: [{ artifact_transport_version: 2,
            artifact_locator_ref: locatorRef, byte_offset: 0, max_bytes: 6000, delivery }] })
          const boundary = await actionBoundary({ sessionID: session.id, messageID: message.id,
            created: now + 3 + index * 3, tool: "artifact_read", toolInput: args })
          const result = await readTool.execute(args, { sessionID: session.id, messageID: message.id,
            callID: boundary.callID, agent: "reference-worker", abort: new AbortController().signal,
            messages: [], executionSurface: scope.executionSurface, metadata() {},
            extra: { projectID: Instance.project.id, toolPartID: boundary.id } })
          const output = JSON.parse(result.output)
          const chunk = output.results[0].value
          expect({ complete: chunk.complete, bytes: chunk.total_bytes, start: chunk.byte_start, end: chunk.byte_end })
            .toEqual({ complete: true, bytes: 26, start: 0, end: 26 })
          if (delivery === "materialized_file") expect(await fs.readFile(chunk.materialized_path, "utf8")).toBe(text)
          else expect(chunk.text).toBe(text)
          references.push(chunk.artifact_read_ref)
          await Session.updatePart({ ...boundary, state: { status: "completed", input: args, output: result.output,
            title: result.title, metadata: result.metadata, time: { start: now + 3 + index * 3, end: now + 4 + index * 3 } } })
          await Session.updateMessage({ ...message, finish: "tool-calls", time: { ...message.time, completed: now + 5 + index * 3 } })
        }
        const parent = differentTurn ? await Session.updateMessage({ id: Identifier.ascending("message"),
          sessionID: session.id, role: "user", author: "user", agent: "worker", time: { created: now + 20 },
          model: { providerID: "openai", modelID: "gpt-5.6-terra" } }) : user
        const action = await assistantMessage({ sessionID: session.id, parentID: parent.id, created: now + 21, projectPath: project.path })
        const publishTool = await ArtifactPublishTool.init()
        const args = publishTool.parameters.parse({ artifact_type: "base/complete-resource-read", schema_version: 1,
          label: "Verified resource", payload_json: '{"status":"complete"}', resource_set: null, source_read_refs: references })
        const boundary = await actionBoundary({ sessionID: session.id, messageID: action.id, created: now + 21, tool: "artifact_publish", toolInput: args })
        using owner = spyOn(TaskToolScope, "resolveCoreProjectedWorkerToolExecutionScope").mockResolvedValue({ ...scope,
          messageID: action.id, toolPartID: boundary.id, toolCallID: boundary.callID })
        const execution = () => publishTool.execute(args, { sessionID: session.id, messageID: action.id,
          callID: boundary.callID, agent: "reference-worker", abort: new AbortController().signal, messages: [],
          executionSurface: scope.executionSurface, metadata() {}, extra: { projectID: Instance.project.id, toolPartID: boundary.id } })
        if (differentTurn) await expect(execution()).rejects.toBeInstanceOf(ArtifactReferenceResolutionError)
        else {
          const result = JSON.parse((await execution()).output)
          const row = Database.use((db) => db.select({ payload: EngineArtifactTable.payload }).from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.id, result.locator.artifact_id)).get())
          expect(EngineArtifactEnvelopeSchema.parse(row?.payload)).toMatchObject({ payload: { status: "complete" },
            source_artifact_locators: [locator], observed_artifact_locators: [locator] })
        }
      } })
    }, 60_000)
  }
}

async function assistantMessage(input: { sessionID: string; parentID: string; created: number; projectPath: string }) {
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: input.sessionID,
    parentID: input.parentID,
    role: "assistant",
    author: "worker",
    time: { created: input.created },
    agent: "worker",
    providerID: "openai",
    modelID: "gpt-5.6-terra",
    path: { cwd: input.projectPath, root: input.projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: message.id,
    type: "step-start",
  })
  if (message.role !== "assistant") throw new Error("Assistant fixture returned a different message variant")
  return message
}

async function completedToolPart(input: {
  sessionID: string
  messageID: string
  created: number
  tool: string
  toolInput: unknown
  output: unknown
  completeAssistant?: boolean
}) {
  const part = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "tool",
    callID: Identifier.ascending("tool"),
    tool: input.tool,
    state: {
      status: "completed",
      input: input.toolInput,
      output: JSON.stringify(input.output),
      title: input.tool,
      metadata: { truncated: false },
      time: { start: input.created, end: input.created + 1 },
    },
  })
  if (input.completeAssistant !== false) {
    const message = await MessageStore.get({ sessionID: input.sessionID, messageID: input.messageID })
    if (message.info.role !== "assistant") throw new Error(`Tool Part parent ${input.messageID} is not an assistant`)
    await Session.updateMessage({
      ...message.info,
      finish: "tool-calls",
      time: { ...message.info.time, completed: input.created + 2 },
    })
  }
  if (part.type !== "tool") throw new Error("Completed Tool fixture returned a different Part variant")
  return part
}

async function actionBoundary(input: { sessionID: string; messageID: string; created: number; tool: string; toolInput?: unknown }) {
  const part = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "tool",
    callID: Identifier.ascending("tool"),
    tool: input.tool,
    state: {
      status: "running",
      input: input.toolInput ?? {},
      time: { start: input.created },
    },
  })
  if (part.type !== "tool") throw new Error("Tool boundary fixture returned a different Part variant")
  return part
}

describe("provider Artifact references", () => {
  test("projects the locator, read, selection, and publication provider inputs as typed references", async () => {
    const locator = ArtifactReadLocatorSchema.parse({
      source: "task_artifact_resource",
      ref: {
        snapshot: {
          schema_version: 2,
          project_id: "project-provider-reference",
          task_id: "task-provider-reference",
          snapshot_id: "00000000-0000-4000-8000-000000000001",
          manifest_sha256: "a".repeat(64),
        },
        tree: "resources",
        path: "case/input.md",
        media_type: "text/markdown",
        bytes: 8,
        sha256: "b".repeat(64),
      },
    })
    const locatorRef = mintArtifactLocatorReference()
    const readRef = mintArtifactReadReference()
    const selection = { locator, purpose: "frozen diagnostic input" }
    const selectionRef = mintArtifactSelectionReference()
    const readTool = await ArtifactReadTool.init()
    const selectTool = await ArtifactSelectTool.init()
    const publishTool = await ArtifactPublishTool.init()

    expect([locatorRef, readRef, selectionRef].map((reference) => reference.length)).toEqual([19, 19, 19])
    expect([locatorRef.slice(0, 3), readRef.slice(0, 3), selectionRef.slice(0, 3)]).toEqual(["al_", "ar_", "as_"])

    expect(
      readTool.parameters.parse({
        reads: [
          {
            artifact_transport_version: 2,
            artifact_locator_ref: locatorRef,
            byte_offset: 0,
            max_bytes: 4,
            delivery: "inline",
          },
        ],
      }),
    ).toEqual({
      reads: [
        {
          artifact_transport_version: 2,
          artifact_locator_ref: locatorRef,
          byte_offset: 0,
          max_bytes: 4,
          delivery: "inline",
        },
      ],
    })
    expect(
      selectTool.parameters.parse({
        artifact_transport_version: 2,
        artifact_read_ref: readRef,
        purpose: selection.purpose,
      }),
    ).toEqual({
      artifact_transport_version: 2,
      artifact_read_ref: readRef,
      purpose: selection.purpose,
    })
    expect(
      publishTool.parameters.parse({
        artifact_type: "equity-research/diagnostic",
        schema_version: 1,
        label: "Diagnostic",
        payload_json: '{"status":"complete"}',
        resource_set: null,
        source_read_refs: [readRef],
      }),
    ).toEqual({
      artifact_type: "equity-research/diagnostic",
      schema_version: 1,
      label: "Diagnostic",
      payload_json: '{"status":"complete"}',
      resource_set: null,
      source_read_refs: [readRef],
    })
  })

  test("resolves an earlier completed catalog fact inside the same retained assistant", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "orchestrator", title: "Retained Artifact causality" })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: now },
          agent: "orchestrator",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const assistant = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 1,
          projectPath: project.path,
        })
        const locator = ArtifactReadLocatorSchema.parse({
          source: "engine_artifact",
          artifact_id: "art_retained_catalog_fact",
          catalog_revision: 1,
          expected_sha256: "a".repeat(64),
        })
        const reference = mintArtifactLocatorReference()
        const earlyRead = await actionBoundary({
          sessionID: session.id,
          messageID: assistant.id,
          created: now + 2,
          tool: "artifact_read",
        })
        await completedToolPart({
          sessionID: session.id,
          messageID: assistant.id,
          created: now + 2,
          tool: "artifact_search",
          toolInput: {},
          output: { entries: [{ locator, artifact_locator_ref: reference }] },
          completeAssistant: false,
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: assistant.id,
          type: "step-start",
        })
        const read = await actionBoundary({
          sessionID: session.id,
          messageID: assistant.id,
          created: now + 3,
          tool: "artifact_read",
        })

        expect(() =>
          resolveArtifactLocatorReferenceBeforeRead({
            sessionID: session.id,
            assistantMessageID: assistant.id,
            toolPartID: earlyRead.id,
            reference,
          }),
        ).toThrow(ArtifactReferenceResolutionError)
        expect(
          resolveArtifactLocatorReferenceBeforeRead({
            sessionID: session.id,
            assistantMessageID: assistant.id,
            toolPartID: read.id,
            reference,
          }),
        ).toEqual(locator)
      },
    })
  })

  test("publishes paginated read references as canonical sources and retains independent selection facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Provider reference facts",
        })
        const now = Date.now()
        const taskID = Identifier.ascending("task")
        const loadedPackage = await ExpertSquadRegistry.loadPackage(path.resolve(import.meta.dir, "../src/expert-squad/builtin/base"))
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: loadedPackage.manifest.version,
          packageDigest: loadedPackage.packageDigest,
        }
        persistTask({
          taskID,
          rootSession: session,
          now,
          title: "Provider reference facts",
          request: "Prove short reference provenance.",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "worker",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const locator = ArtifactReadLocatorSchema.parse({
          source: "task_artifact_resource",
          ref: {
            snapshot: {
              schema_version: 2,
              project_id: session.projectID,
              task_id: taskID,
              snapshot_id: "00000000-0000-4000-8000-000000000002",
              manifest_sha256: "c".repeat(64),
            },
            tree: "resources",
            path: "case/input.md",
            media_type: "text/markdown",
            bytes: 8,
            sha256: "d".repeat(64),
          },
        })
        if (locator.source !== "task_artifact_resource") throw new Error("Resource fixture returned a different locator variant")
        const locatorRef = mintArtifactLocatorReference()
        const readRef = mintArtifactReadReference()
        const finalReadRef = mintArtifactReadReference()
        const purpose = "frozen diagnostic input"
        const selection = { locator, purpose }
        const selectionRef = mintArtifactSelectionReference()

        const searchMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 1,
          projectPath: project.path,
        })
        await completedToolPart({
          sessionID: session.id,
          messageID: searchMessage.id,
          created: now + 1,
          tool: "artifact_search",
          toolInput: {},
          output: { entries: [{ locator, artifact_locator_ref: locatorRef }] },
        })

        const firstReadMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 3,
          projectPath: project.path,
        })
        const firstReadBoundary = await actionBoundary({
          sessionID: session.id,
          messageID: firstReadMessage.id,
          created: now + 3,
          tool: "artifact_read",
        })
        expect(
          resolveArtifactLocatorReferenceBeforeRead({
            sessionID: session.id,
            assistantMessageID: firstReadMessage.id,
            toolPartID: firstReadBoundary.id,
            reference: locatorRef,
          }),
        ).toEqual(locator)
        await completedToolPart({
          sessionID: session.id,
          messageID: firstReadMessage.id,
          created: now + 3,
          tool: "artifact_read",
          toolInput: {
            artifact_transport_version: 2,
            artifact_locator_ref: locatorRef,
            byte_offset: 0,
            max_bytes: 4,
            delivery: "inline",
          },
          output: {
            locator,
            artifact_transport_version: 2,
            artifact_locator_ref: locatorRef,
            artifact_read_ref: readRef,
            media_type: "text/markdown",
            byte_start: 0,
            byte_end: 4,
            next_offset: 4,
            total_bytes: 8,
            complete: false,
            sha256: locator.ref.sha256,
            text: "case",
            attachment: false,
          },
        })

        const finalReadMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 5,
          projectPath: project.path,
        })
        await completedToolPart({
          sessionID: session.id,
          messageID: finalReadMessage.id,
          created: now + 5,
          tool: "artifact_read",
          toolInput: {
            artifact_transport_version: 2,
            artifact_locator_ref: locatorRef,
            byte_offset: 4,
            max_bytes: 4,
            delivery: "inline",
          },
          output: {
            locator,
            artifact_transport_version: 2,
            artifact_locator_ref: locatorRef,
            artifact_read_ref: finalReadRef,
            media_type: "text/markdown",
            byte_start: 4,
            byte_end: 8,
            next_offset: null,
            total_bytes: 8,
            complete: true,
            sha256: locator.ref.sha256,
            text: "data",
            attachment: false,
          },
        })

        const directMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 7,
          projectPath: project.path,
        })
        const publishTool = await ArtifactPublishTool.init()
        const directArgs = publishTool.parameters.parse({
          artifact_type: "base/direct-result",
          schema_version: 1,
          label: "Direct read source",
          payload_json: '{"status":"complete"}',
          resource_set: null,
          source_read_refs: [readRef, finalReadRef],
        })
        const directPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: directMessage.id,
          type: "tool",
          tool: "artifact_publish",
          callID: "call_publish_read_reference",
          state: { status: "running", input: directArgs, time: { start: now + 7 } },
        })
        const directScope: TaskToolScope.TaskToolExecutionScope = {
          packageToolRef: null,
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: directMessage.id,
          toolCallID: "call_publish_read_reference",
          toolPartID: directPart.id,
          executionSurface: createToolExecutionSurface({ toolIDs: ["artifact_publish"], permission: [] }),
          owner: {
            kind: "projected-worker",
            expertSquadID: "base",
            packageRevision,
            agentID: "reference-worker",
            projectionHash: "9".repeat(64),
            workerTurnDescriptorID: Identifier.ascending("artifact"),
            workerTurnDescriptorHash: "8".repeat(64),
          },
        }
        // Isolate only the already-covered worker authorization boundary. The
        // actual Tool, persisted read resolver and canonical publication run.
        {
          using owner = spyOn(TaskToolScope, "resolveCoreProjectedWorkerToolExecutionScope").mockResolvedValue(
            directScope,
          )
          const directResult = await publishTool.execute(directArgs, {
            sessionID: session.id,
            messageID: directMessage.id,
            callID: directScope.toolCallID,
            agent: "reference-worker",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: directScope.executionSurface,
            metadata() {},
            extra: { projectID: Instance.project.id, toolPartID: directPart.id },
          })
          const direct = JSON.parse(directResult.output)
          const row = Database.use((db) =>
            db
              .select({ payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, direct.locator.artifact_id))
              .get(),
          )
          expect(EngineArtifactEnvelopeSchema.parse(row?.payload)).toMatchObject({
            payload: { status: "complete" },
            source_artifact_locators: [locator],
            observed_artifact_locators: [locator],
          })
          const missingArgs = { ...directArgs, source_read_refs: [mintArtifactReadReference()] }
          const missingPart = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: directMessage.id,
            type: "tool",
            tool: "artifact_publish",
            callID: "call_publish_missing_read",
            state: { status: "running", input: missingArgs, time: { start: now + 7 } },
          })
          owner.mockResolvedValue({
            ...directScope,
            toolCallID: "call_publish_missing_read",
            toolPartID: missingPart.id,
          })
          await expect(
            publishTool.execute(missingArgs, {
              sessionID: session.id,
              messageID: directMessage.id,
              callID: "call_publish_missing_read",
              agent: "reference-worker",
              abort: new AbortController().signal,
              messages: [],
              executionSurface: directScope.executionSurface,
              metadata() {},
              extra: { projectID: Instance.project.id, toolPartID: missingPart.id },
            }),
          ).rejects.toBeInstanceOf(ArtifactReferenceResolutionError)
        }

        const selectMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 7,
          projectPath: project.path,
        })
        const selectBoundary = await actionBoundary({
          sessionID: session.id,
          messageID: selectMessage.id,
          created: now + 7,
          tool: "artifact_select",
        })
        expect(
          resolveArtifactReadReferenceBeforeSelection({
            sessionID: session.id,
            assistantMessageID: selectMessage.id,
            toolPartID: selectBoundary.id,
            reference: readRef,
          }),
        ).toEqual(locator)
        await completedToolPart({
          sessionID: session.id,
          messageID: selectMessage.id,
          created: now + 7,
          tool: "artifact_select",
          toolInput: { artifact_transport_version: 2, artifact_read_ref: readRef, purpose },
          output: { artifact_transport_version: 2, selection, artifact_selection_ref: selectionRef },
        })

        const duplicateSelectionRef = mintArtifactSelectionReference()
        const duplicateSelectMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 8,
          projectPath: project.path,
        })
        await completedToolPart({
          sessionID: session.id,
          messageID: duplicateSelectMessage.id,
          created: now + 8,
          tool: "artifact_select",
          toolInput: { artifact_transport_version: 2, artifact_read_ref: readRef, purpose },
          output: { artifact_transport_version: 2, selection, artifact_selection_ref: duplicateSelectionRef },
        })

        const publishMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 9,
          projectPath: project.path,
        })
        const publishBoundary = await actionBoundary({
          sessionID: session.id,
          messageID: publishMessage.id,
          created: now + 9,
          tool: "artifact_publish",
        })
        expect(
          completeArtifactReadsBeforePublication({
            sessionID: session.id,
            assistantMessageID: publishMessage.id,
            toolPartID: publishBoundary.id,
          }),
        ).toEqual([locator])
      },
    })
  })
})
