import { afterAll, expect, test } from "bun:test"
import { writeExpertSquadPackage } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { EngineArtifactEnvelopeSchema, EvolutionPromotionReceiptSchema } from "@opencorvus-ai/plugin"
import { createHash } from "node:crypto"
import path from "node:path"
import { Global } from "../src/global"
import { Database, eq, and, sql } from "../src/storage/db"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Identifier } from "../src/id/id"
import { EngineService } from "../src/task-api"
import { resolveTaskCreator, projectTaskCreatorMetadata } from "../src/task-api/task-creator"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { EngineArtifactTable } from "../src/engine/engine.sql"
import {
  insertEngineArtifact,
  recordEngineArtifact,
  patchEngineArtifact,
  updateEngineArtifactsWhere,
  updateEngineArtifactWhereReturning,
} from "../src/engine/artifact"
import { readExpertSquadMutationReceipt } from "../src/engine/expert-squad-mutation-receipt"
import { exactEngineArtifactLocator } from "../src/artifact-catalog"
import { ExpertSquadPackageManager as Manager } from "../src/expert-squad/manager"
import { ExpertSquadRegistry as Registry } from "../src/expert-squad/registry"
import { requireEvolutionMutationAuthorization } from "../src/expert-squad/mutation-authorization"
import { EvolutionMutationReceiptIdentityConflictError } from "../src/expert-squad/mutation-receipt-validation"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

test("the original Artifact writer commits one exact Manager authority and preserves its report across public writers", async () => {
  await using project = await memoryProject()
  const root = await Global.createTemporaryDirectory("mutation-receipt-writer-")
  const id = "mutation-receipt-writer",
    namespace = "durable-test"
  for (const version of ["2026.10.24.1", "2026.10.24.2"])
    await writeExpertSquadPackage({
      directory: path.join(root, version, namespace, id),
      definition: {
        manifest: {
          schema_version: 2,
          namespace,
          id,
          label: "Receipt writer",
          description: "Actual Manager receipt writer",
          version,
          product_pillars: ["code"],
          readme: "README.md",
          selector: { summary: "Receipt writer", selection_guidance: "Isolated contract", instructions: "selector.md" },
          capability_sets: {},
          capability_projection: {
            scheduler: { capability_refs: [], base_role: "orchestrator" },
            agents: {
              worker: {
                capability_refs: [],
                label: "Writer",
                description: "Receipt writer",
                base_role: "build",
                prompt: "agents/worker/system.md",
              },
            },
            virtual_workflows: {},
          },
        },
        files: {
          "README.md": `# Receipt writer ${version}\n`,
          "selector.md": "# Isolated selector\n",
          "agents/worker/system.md": "# Receipt writer\n",
        },
      },
    })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      EngineService.init()
      const baseline = await Manager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: path.join(root, "2026.10.24.1", namespace, id),
        installationScope: "project",
      })
      const candidate = await Registry.readInstalledPackageRevision(path.join(root, "2026.10.24.2", namespace, id), {
        preserveSnapshot: true,
      })
      const taskID = Identifier.ascending("task"),
        now = Date.now()
      const session = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Mutation receipt writer",
        metadata: { configOverlay: { model: "firmware/gpt-5", prompt_profile: { active: id } } },
      })
      persistEstablishedTask({
        taskID,
        rootSession: session,
        now,
        title: "Receipt writer",
        request: "Exercise actual receipt publication",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: projectTaskCreatorMetadata({}, await resolveTaskCreator({ actor: "user" })),
        projectID: Instance.project.id,
        packageRevision: {
          scope: "project",
          projectID: Instance.project.id,
          namespace,
          id,
          version: baseline.after.version!,
          packageDigest: baseline.after.packageDigest,
        },
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: baseline.after.packageDigest,
          timeCreated: now,
        }),
      })
      const text = "Promote the actual isolated writer package."
      const message = await EngineService.handleTaskMessage(taskID, {
        text,
        source: "expert_squad.evolution_authorization",
      })
      const authorization = await requireEvolutionMutationAuthorization({
        projectID: Instance.project.id,
        taskID,
        sessionID: session.id,
        messageID: message.user_message.info.id,
        expectedText: text,
      })
      const evidenceID = recordEngineArtifact({
        taskID,
        kind: "expert_output",
        label: "Actual receipt input",
        payload: EngineArtifactEnvelopeSchema.parse({
          artifact_type: "durable-test/input",
          schema_version: 1,
          producer: {
            owner_kind: "core",
            component_id: "mutation-receipt-test",
            operation_id: authorization.message_id,
          },
          payload: { baseline: baseline.after, candidate },
          resources: [],
          observed_artifact_locators: [],
          source_artifact_locators: [],
        }),
      })
      const evidence = [exactEngineArtifactLocator({ taskID, artifactID: evidenceID })]
      const artifactID = Identifier.ascending("artifact")
      let envelope!: ReturnType<typeof EngineArtifactEnvelopeSchema.parse>
      const installed = await Manager.promotePackageRevision({
        projectDirectory: project.path,
        id,
        installationScope: "project",
        expectedCurrentPackageDigest: baseline.after.packageDigest,
        promotePackageDigest: candidate.packageDigest,
        durableReceipt: {
          identity: { taskID, artifactID },
          commit: async (managerReceipt) => {
            const receipt = EvolutionPromotionReceiptSchema.parse({
              operation: "promotion",
              authorization,
              target: {
                scope: "project",
                project_id: Instance.project.id,
                project_directory: project.path,
                namespace,
                id,
              },
              expected_current_digest: baseline.after.packageDigest,
              before_digest: baseline.after.packageDigest,
              after_digest: candidate.packageDigest,
              evidence,
              manager_receipt: managerReceipt,
            })
            envelope = EngineArtifactEnvelopeSchema.parse({
              artifact_type: "evolution-lab/promotion-receipt",
              schema_version: 1,
              producer: {
                owner_kind: "core",
                component_id: "expert-squad-package-manager",
                operation_id: authorization.message_id,
              },
              payload: receipt,
              resources: [],
              observed_artifact_locators: evidence,
              source_artifact_locators: evidence,
            })
            recordEngineArtifact({
              id: artifactID,
              taskID,
              kind: "expert_output",
              label: "Actual Manager receipt",
              payload: envelope,
            })
          },
        },
      })
      expect(installed.after.packageDigest).toBe(candidate.packageDigest)
      const raw = () =>
        Database.allFinalized<any>(
          `SELECT a.payload,a.payload_sha256,a.time_created,r.envelope,r.time_created AS receipt_time FROM engine_artifact a JOIN expert_squad_mutation_receipt r ON r.artifact_id=a.id WHERE a.id='${artifactID}'`,
        )[0]
      const original = raw()
      expect({ envelope: original.envelope, time: original.receipt_time, digest: original.payload_sha256 }).toEqual({
        envelope: original.payload,
        time: original.time_created,
        digest: createHash("sha256").update(original.payload).digest("hex"),
      })
      const failure = new Error("rollback the original caller transaction")
      const rowsBefore = Database.allFinalized<any>("SELECT count(*) AS n FROM expert_squad_mutation_receipt")[0].n
      expect(() =>
        Database.immediateTransaction((db) => {
          insertEngineArtifact(db, { taskID, kind: "expert_output", label: "Rolled back report", payload: envelope })
          throw failure
        }),
      ).toThrow(failure)
      expect(Database.allFinalized<any>("SELECT count(*) AS n FROM expert_squad_mutation_receipt")[0].n).toBe(
        rowsBefore,
      )
      const reordered = Object.fromEntries(Object.entries(envelope).reverse())
      const changed = { ...envelope, source_artifact_locators: [] }
      for (const payload of [changed, reordered]) {
        expect(() =>
          recordEngineArtifact({
            id: artifactID,
            taskID,
            kind: "expert_output",
            label: "Conflicting receipt identity",
            payload,
          }),
        ).toThrow(EvolutionMutationReceiptIdentityConflictError)
        expect(() =>
          Database.immediateTransaction((db) => patchEngineArtifact(db, { id: artifactID, payload })),
        ).toThrow(EvolutionMutationReceiptIdentityConflictError)
        expect(() =>
          Database.immediateTransaction((db) =>
            updateEngineArtifactsWhere(db, {
              where: eq(EngineArtifactTable.id, artifactID),
              kind: "expert_output",
              payload,
            }),
          ),
        ).toThrow(EvolutionMutationReceiptIdentityConflictError)
        expect(() =>
          Database.immediateTransaction((db) =>
            updateEngineArtifactWhereReturning(db, {
              where: eq(EngineArtifactTable.id, artifactID),
              kind: "expert_output",
              payload,
            }),
          ),
        ).toThrow(EvolutionMutationReceiptIdentityConflictError)
      }
      Database.immediateTransaction((db) => {
        patchEngineArtifact(db, { id: artifactID, label: "Readable original receipt" })
        updateEngineArtifactsWhere(db, {
          where: eq(EngineArtifactTable.id, artifactID),
          label: "Current receipt label",
        })
        const updated = updateEngineArtifactWhereReturning(db, {
          where: eq(EngineArtifactTable.id, artifactID),
          label: "Verified receipt label",
        })
        expect(updated?.label).toBe("Verified receipt label")
      })
      expect(raw()).toEqual(original)
      for (const returning of [false, true]) {
        const pendingID = recordEngineArtifact({
          taskID,
          kind: "expert_output",
          label: "Conditional receipt projection",
          payload: {
            ...envelope,
            artifact_type: "durable-test/pending",
            producer: {
              owner_kind: "core",
              component_id: "mutation-receipt-test",
              operation_id: authorization.message_id,
            },
          },
        })
        const beforeRow = Database.use((db) =>
          db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, pendingID)).get(),
        )
        const revision = Database.allFinalized<any>(
          "SELECT max(revision) AS n FROM engine_artifact_catalog_revision",
        )[0].n
        const conditional = and(
          eq(EngineArtifactTable.id, pendingID),
          sql`(SELECT max(revision) FROM engine_artifact_catalog_revision) = ${revision}`,
        )!
        const result = Database.immediateTransaction((db) =>
          returning
            ? updateEngineArtifactWhereReturning(db, { where: conditional, kind: "expert_output", payload: envelope })
            : updateEngineArtifactsWhere(db, { where: conditional, kind: "expert_output", payload: envelope }),
        )
        expect(result).toBeUndefined()
        expect(
          Database.use((db) =>
            db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, pendingID)).get(),
          ),
        ).toEqual(beforeRow)
        expect(
          Database.allFinalized<any>("SELECT artifact_id FROM expert_squad_mutation_receipt").map(
            (row) => row.artifact_id,
          ),
        ).toEqual([artifactID])
      }
      const imported = EngineArtifactEnvelopeSchema.parse({
        ...envelope,
        producer: {
          owner_kind: "mission",
          mission_id: "mission-import",
          session_id: session.id,
          message_id: authorization.message_id,
          tool_call_id: "import-receipt",
        },
        import_lineage: {
          source_task_id: taskID,
          source_locator: exactEngineArtifactLocator({ taskID, artifactID }),
          source_kind: "expert_output",
          source_producer: envelope.producer,
          source_provenance: { observed_artifact_locators: evidence, source_artifact_locators: evidence },
        },
      })
      const importedID = recordEngineArtifact({
        taskID,
        kind: "expert_output",
        label: "Imported Manager report",
        payload: imported,
      })
      expect(
        Database.use((db) =>
          db
            .select({ label: EngineArtifactTable.label })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.id, importedID))
            .get(),
        ),
      ).toEqual({ label: "Imported Manager report" })
      expect(
        Database.allFinalized<any>("SELECT artifact_id FROM expert_squad_mutation_receipt").map(
          (row) => row.artifact_id,
        ),
      ).toEqual([artifactID])
      expect(Database.use((db) => readExpertSquadMutationReceipt(db, artifactID))?.envelopeText).toBe(original.payload)
    },
  })
})
