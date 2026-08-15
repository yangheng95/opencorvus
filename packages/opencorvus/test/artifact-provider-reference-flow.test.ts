import { afterEach, describe, expect, test } from "bun:test"
import {
  EngineArtifactEnvelopeSchema,
  ArtifactReadLocatorSchema,
  mintArtifactLocatorReference,
  mintArtifactReadReference,
  mintArtifactSelectionReference,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { publishExpertArtifact } from "@/artifact-catalog"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import {
  ArtifactReferenceAmbiguityError,
  ArtifactReferenceResolutionError,
  completeArtifactReadsBeforePublication,
  resolveArtifactLocatorReferenceBeforeRead,
  resolveArtifactReadReferenceBeforeSelection,
  resolveArtifactSelectionReferencesBeforePublication,
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
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

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
  return part
}

async function actionBoundary(input: {
  sessionID: string
  messageID: string
  created: number
  tool: string
}) {
  return Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "tool",
    callID: Identifier.ascending("tool"),
    tool: input.tool,
    state: {
      status: "running",
      input: {},
      time: { start: input.created },
    },
  })
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
        artifact_transport_version: 2,
        artifact_locator_ref: locatorRef,
        byte_offset: 0,
        max_bytes: 4,
        delivery: "inline",
      }),
    ).toEqual({
      artifact_transport_version: 2,
      artifact_locator_ref: locatorRef,
      byte_offset: 0,
      max_bytes: 4,
      delivery: "inline",
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
        source_selection_refs: [selectionRef],
      }),
    ).toEqual({
      artifact_type: "equity-research/diagnostic",
      schema_version: 1,
      label: "Diagnostic",
      payload_json: '{"status":"complete"}',
      resource_set: null,
      source_selection_refs: [selectionRef],
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

        expect(() => resolveArtifactLocatorReferenceBeforeRead({
          sessionID: session.id,
          assistantMessageID: assistant.id,
          toolPartID: earlyRead.id,
          reference,
        })).toThrow(ArtifactReferenceResolutionError)
        expect(resolveArtifactLocatorReferenceBeforeRead({
          sessionID: session.id,
          assistantMessageID: assistant.id,
          toolPartID: read.id,
          reference,
        })).toEqual(locator)
      },
    })
  }, 0)

  test("resolves paginated read and explicit selection references to one canonical publication locator", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Provider reference facts" })
        const now = Date.now()
        const taskID = Identifier.ascending("task")
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "reference-squad",
          version: "2026.08.13.1",
          packageDigest: "f".repeat(64),
        }
        persistTask({
          taskID,
          sessionID: session.id,
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
        const locatorRef = mintArtifactLocatorReference()
        const readRef = mintArtifactReadReference()
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
            artifact_read_ref: readRef,
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
        const sourceLocators = resolveArtifactSelectionReferencesBeforePublication({
          sessionID: session.id,
          assistantMessageID: publishMessage.id,
          toolPartID: publishBoundary.id,
          references: [selectionRef, duplicateSelectionRef],
        })
        expect(sourceLocators).toEqual([locator])
        const observedLocators = completeArtifactReadsBeforePublication({
          sessionID: session.id,
          assistantMessageID: publishMessage.id,
          toolPartID: publishBoundary.id,
        })
        const published = await publishExpertArtifact({
          scope: {
            kind: "task",
            projectID: Instance.project.id,
            projectDirectory: project.path,
            taskID,
            taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
            sessionID: session.id,
            messageID: publishMessage.id,
            toolCallID: "call_publish_short_reference",
            toolPartID: Identifier.ascending("part"),
            executionSurface: createToolExecutionSurface({ toolIDs: ["artifact_publish"], permission: [] }),
            owner: {
              kind: "projected-worker",
              expertSquadID: "reference-squad",
              packageRevision,
              agentID: "reference-worker",
              projectionHash: "9".repeat(64),
              workerTurnDescriptorID: Identifier.ascending("artifact"),
              workerTurnDescriptorHash: "8".repeat(64),
            },
          },
          artifact: {
            artifact_type: "reference-squad/result",
            schema_version: 1,
            label: "Reference result",
            payload: { status: "complete" },
            resources: [],
            source_artifact_locators: sourceLocators,
            idempotent: true,
          },
          observedArtifactLocators: observedLocators,
          selectedArtifactLocators: sourceLocators,
        })
        const stored = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.id, published.locator.artifact_id))
            .get(),
        )
        const envelope = EngineArtifactEnvelopeSchema.parse(stored?.payload)
        expect(envelope.source_artifact_locators).toEqual([locator])
        expect(envelope.source_artifact_locators[0]!.source).toBe("task_artifact_resource")
        if (envelope.source_artifact_locators[0]!.source !== "task_artifact_resource") {
          throw new Error("Expected canonical task_artifact_resource provenance")
        }
        expect(envelope.source_artifact_locators[0]!.ref.snapshot.manifest_sha256.length).toBe(64)

        const legacyLocator = ArtifactReadLocatorSchema.parse({
          source: "engine_artifact",
          artifact_id: "art_legacy_provider_fact",
          catalog_revision: 9,
          expected_sha256: "e".repeat(64),
        })
        const legacyReadMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 11,
          projectPath: project.path,
        })
        await completedToolPart({
          sessionID: session.id,
          messageID: legacyReadMessage.id,
          created: now + 11,
          tool: "artifact_read",
          toolInput: { locator: legacyLocator, byte_offset: 0, max_bytes: 4, delivery: "inline" },
          output: {
            locator: legacyLocator,
            media_type: "application/json",
            byte_start: 0,
            byte_end: 4,
            next_offset: null,
            total_bytes: 4,
            complete: true,
            sha256: legacyLocator.expected_sha256,
            text: "null",
            attachment: false,
          },
        })
        const legacySelectMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 13,
          projectPath: project.path,
        })
        await completedToolPart({
          sessionID: session.id,
          messageID: legacySelectMessage.id,
          created: now + 13,
          tool: "artifact_select",
          toolInput: { locator: legacyLocator, purpose: "immutable historical evidence" },
          output: { locator: legacyLocator, purpose: "immutable historical evidence" },
        })
        const auditMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 15,
          projectPath: project.path,
        })
        const auditBoundary = await actionBoundary({
          sessionID: session.id,
          messageID: auditMessage.id,
          created: now + 15,
          tool: "artifact_publish",
        })
        expect(
          completeArtifactReadsBeforePublication({
            sessionID: session.id,
            assistantMessageID: auditMessage.id,
            toolPartID: auditBoundary.id,
          }),
        ).toEqual([legacyLocator, locator])
        expect(
          selectedArtifactLocatorsBeforePublication({
            sessionID: session.id,
            assistantMessageID: auditMessage.id,
            toolPartID: auditBoundary.id,
          }),
        ).toEqual([legacyLocator, locator])
      },
    })
  }, 0)

  test("rejects one selection token bound to different canonical provenance", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Selection collision" })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "worker",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const collision = mintArtifactSelectionReference()
        for (const [index, locator] of [
          {
            source: "engine_artifact" as const,
            artifact_id: "art_collision_first",
            catalog_revision: 1,
            expected_sha256: "1".repeat(64),
          },
          {
            source: "engine_artifact" as const,
            artifact_id: "art_collision_second",
            catalog_revision: 2,
            expected_sha256: "2".repeat(64),
          },
        ].entries()) {
          const locatorRef = mintArtifactLocatorReference()
          const readRef = mintArtifactReadReference()
          const readMessage = await assistantMessage({
            sessionID: session.id,
            parentID: user.id,
            created: now + 1 + index * 4,
            projectPath: project.path,
          })
          await completedToolPart({
            sessionID: session.id,
            messageID: readMessage.id,
            created: now + 1 + index * 4,
            tool: "artifact_read",
            toolInput: {
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              byte_offset: 0,
              max_bytes: 4,
              delivery: "inline",
            },
            output: {
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              artifact_read_ref: readRef,
              locator,
              media_type: "application/json",
              byte_start: 0,
              byte_end: 4,
              next_offset: null,
              total_bytes: 4,
              complete: true,
              sha256: locator.expected_sha256,
              text: "null",
              attachment: false,
            },
          })
          const selectMessage = await assistantMessage({
            sessionID: session.id,
            parentID: user.id,
            created: now + 3 + index * 4,
            projectPath: project.path,
          })
          await completedToolPart({
            sessionID: session.id,
            messageID: selectMessage.id,
            created: now + 3 + index * 4,
            tool: "artifact_select",
            toolInput: { artifact_transport_version: 2, artifact_read_ref: readRef, purpose: `source ${index}` },
            output: {
              artifact_transport_version: 2,
              selection: { locator, purpose: `source ${index}` },
              artifact_selection_ref: collision,
            },
          })
        }
        const publishMessage = await assistantMessage({
          sessionID: session.id,
          parentID: user.id,
          created: now + 10,
          projectPath: project.path,
        })
        const publishBoundary = await actionBoundary({
          sessionID: session.id,
          messageID: publishMessage.id,
          created: now + 10,
          tool: "artifact_publish",
        })
        let failure: unknown
        try {
          resolveArtifactSelectionReferencesBeforePublication({
            sessionID: session.id,
            assistantMessageID: publishMessage.id,
            toolPartID: publishBoundary.id,
            references: [collision],
          })
        } catch (cause) {
          failure = cause
        }
        expect(failure).toBeInstanceOf(ArtifactReferenceAmbiguityError)
        expect((failure as ArtifactReferenceAmbiguityError).code).toBe("ARTIFACT_REFERENCE_AMBIGUOUS")
      },
    })
  }, 0)
})
