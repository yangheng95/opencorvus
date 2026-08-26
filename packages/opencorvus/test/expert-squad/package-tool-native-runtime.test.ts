import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { persistEstablishedTask as persistTask } from "../fixture/engine-task"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import {
  executePackageToolInCapsule,
  introspectPackageToolInCapsule,
  nativePackageToolEnvironment,
} from "../../src/expert-squad/package-tool-capsule"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "viral-content")
const publisherRef = "viral-content/shared/publish-viral-content-artifact"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("native Task package-tool process authority", () => {
  test("publishes and introspects concurrent frozen workers through one native Task process binding", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
        const prepared = loaded.packageToolBundles.get(publisherRef)
        if (!prepared) throw new Error(`Missing prepared package tool ${publisherRef}`)

        const session = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Native package-tool authority" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: session,
          now,
          title: "Native package-tool authority",
          request: "Introspect the exact frozen package tool",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: loaded.manifest.namespace,
            id: loaded.manifest.id,
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: loaded.packageDigest,
            timeCreated: now,
          }),
        })

        const introspections = await Promise.all(
          Array.from({ length: 8 }, () => introspectPackageToolInCapsule({ prepared, taskID, cwd: project.path })),
        )
        const introspection = introspections[0]!
        expect(introspections).toEqual(Array.from({ length: 8 }, () => introspection))
        expect(introspection.description).toBe(
          "Validate and publish one strict viral-content Artifact with exact typed predecessors and immutable resources. Publish viral-content/delivery before any interactive Artifact and give it exactly the six typed campaign predecessors; never include snapshot, document@1, table@1, or other interactive Artifact locators.",
        )
        expect(introspection.inputSchema.type).toBe("object")
        expect(Object.keys(introspection.inputSchema.properties as Record<string, unknown>)).toEqual([
          "artifact",
          "resource_set",
          "source_artifact_locators",
        ])
        expect(introspection.inputSchema.required).toEqual(["artifact", "resource_set", "source_artifact_locators"])
        const artifactBranches = (
          introspection.inputSchema.properties as Record<
            string,
            { oneOf?: Array<{ properties: { artifact_type: { const: string }; payload: { type: string } } }> }
          >
        ).artifact?.oneOf
        expect(
          artifactBranches?.map((branch) => ({
            artifactType: branch.properties.artifact_type.const,
            payloadType: branch.properties.payload.type,
          })),
        ).toEqual([
          { artifactType: "viral-content/campaign-brief", payloadType: "object" },
          { artifactType: "viral-content/audience-dossier", payloadType: "object" },
          { artifactType: "viral-content/trend-dossier", payloadType: "object" },
          { artifactType: "viral-content/concept-set", payloadType: "object" },
          { artifactType: "viral-content/copy-pack", payloadType: "object" },
          { artifactType: "viral-content/review", payloadType: "object" },
          { artifactType: "viral-content/delivery", payloadType: "object" },
        ])
        expect(nativePackageToolEnvironment()).toEqual(
          process.platform === "win32" ? { SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT } : {},
        )

        const published = {
          locator: {
            artifact_id: "art_package_tool_native_runtime",
            task_id: taskID,
            catalog_revision: 1,
            payload_sha256: "b".repeat(64),
          },
          sha256: "b".repeat(64),
        }
        const host = {
          kind: "task",
          managedRuntimeDirectory: project.path,
          engineArtifacts: {
            publish: async () => published,
          },
        } as any
        const context = {
          sessionID: session.id,
          messageID: Identifier.ascending("message"),
          agent: "viral-brief-strategist",
          directory: project.path,
          worktree: project.path,
          configuration: {},
        }
        const execution = await executePackageToolInCapsule({
          prepared,
          taskID,
          cwd: project.path,
          host,
          context,
          args: {
            artifact: {
              artifact_type: "viral-content/campaign-brief",
              payload: {
                workflow_id: "evidence-backed-content-campaign",
                campaign_name: "Native package-tool lifecycle",
                goal: "Prove terminal process settlement",
                audience_hypotheses: ["Maintainers need deterministic cleanup evidence"],
                offer: "One exact terminal worker result",
                channels: ["repository test"],
                constraints: ["No external side effects"],
                evidence_questions: ["Did the worker return and naturally exit?"],
                success_hypotheses: ["The exact publication receipt returns before the cleanup deadline"],
              },
            },
            resource_set: null,
            source_artifact_locators: [],
          },
          abort: new AbortController().signal,
        })
        expect(execution).toEqual({
          output: JSON.stringify({
            artifact_type: "viral-content/campaign-brief",
            schema_version: 1,
            locator: published.locator,
            artifact_sha256: published.sha256,
          }),
          title: "Viral Content: campaign-brief",
          metadata: {},
        })

        await expect(
          executePackageToolInCapsule({
            prepared,
            taskID,
            cwd: project.path,
            host,
            context: { ...context, messageID: Identifier.ascending("message") },
            args: {
              artifact: { artifact_type: "viral-content/campaign-brief", payload: {} },
              resource_set: null,
              source_artifact_locators: [],
            },
            abort: new AbortController().signal,
          }),
        ).rejects.toThrow(/workflow_id/)

        await expect(
          executePackageToolInCapsule({
            prepared,
            taskID,
            cwd: project.path,
            host,
            context: { ...context, messageID: Identifier.ascending("message") },
            args: {
              artifact: {
                artifact_type: "viral-content/campaign-brief",
                payload: {
                  workflow_id: "evidence-backed-content-campaign",
                  campaign_name: "Malformed publication boundary",
                  goal: "Prove schema validation precedes package execution",
                  audience_hypotheses: ["Maintainers need exact input validation"],
                  offer: "One typed package-tool error",
                  channels: ["repository test"],
                  constraints: ["No external side effects"],
                  evidence_questions: ["Was the frozen input schema applied?"],
                  success_hypotheses: ["Malformed sibling controls are rejected before execution"],
                },
                resource_set: null,
                source_artifact_locators: [],
              },
            },
            abort: new AbortController().signal,
          }),
        ).rejects.toThrow(/resource_set|Unrecognized key/)
      },
    })
  }, 0)
})
