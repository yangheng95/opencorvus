import { afterAll, expect, test } from "bun:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { EngineArtifactEnvelopeSchema, EvolutionPromotionReceiptSchema } from "@opencorvus-ai/plugin"
import { digestFilesystemTree } from "@opencorvus-ai/util/durable-publication"
import { exactEngineArtifactLocator } from "../src/artifact-catalog"
import { recordEngineArtifact } from "../src/engine/artifact"
import { readExpertSquadMutationReceipt } from "../src/engine/expert-squad-mutation-receipt"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { configureTaskIngressRunner } from "../src/engine/task-root-ingress-delivery"
import { ExpertSquadPackageLocations } from "../src/expert-squad/locations"
import { ExpertSquadPackageManager as Manager } from "../src/expert-squad/manager"
import { requireEvolutionMutationAuthorization } from "../src/expert-squad/mutation-authorization"
import { ExpertSquadRegistry as Registry } from "../src/expert-squad/registry"
import { Global } from "../src/global"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database } from "../src/storage/db"
import { EngineService } from "../src/task-api"
import { projectTaskCreatorMetadata, resolveTaskCreator } from "../src/task-api/task-creator"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const namespace = "continuation-test"
const versions = ["2026.10.24.1", "2026.10.24.2", "2026.10.24.3"] as const
type Scope = "project" | "global"
type Target = { projectDirectory: string; id: string; installationScope: Scope }
type Observation = { kind: "absent" } | { kind: "present"; treeDigest: string }
type Preservation = {
  intent: { payload: { protocol: string; journalText: string } }
  terminal: {
    outcome: string
    payload: {
      disposition: string
      resources: string
      resourceEvidence: Record<
        string,
        {
          expectedObservationAvailable: boolean
          expectedObservation: Observation
          preserved: Array<{ resource: string; classification: string; observation: Observation }>
        }
      >
    }
  }
}

async function sources(id: string) {
  const root = await Global.createTemporaryDirectory("expert-recovery-continuation-")
  for (const version of versions) {
    await writeExpertSquadPackage({
      directory: path.join(root, version, namespace, id),
      definition: {
        manifest: {
          schema_version: 2,
          namespace,
          id,
          label: "Recovery continuation",
          description: "Exercises actual Manager recovery before the next package publication.",
          version,
          product_pillars: ["code"],
          readme: "README.md",
          selector: {
            summary: "Recovery continuation",
            selection_guidance: "Isolated backend contract",
            instructions: "selector.md",
          },
          capability_sets: {},
          capability_projection: {
            scheduler: { capability_refs: [], base_role: "orchestrator" },
            agents: {
              worker: {
                capability_refs: [],
                label: "Continuation worker",
                description: "Fixture role",
                base_role: "build",
                prompt: "agents/worker/system.md",
              },
            },
            virtual_workflows: {},
          },
        },
        files: {
          "README.md": `# Recovery continuation ${id}\n\nActual version ${version}\n`,
          "selector.md": "# Isolated selector\n",
          "agents/worker/system.md": `# Worker ${version}\n`,
        },
      },
    })
  }
  return (version: (typeof versions)[number]) => path.join(root, version, namespace, id)
}

async function installedVersion(root: string) {
  return (await Registry.readInstalledPackageRevision(root)).version
}

async function readPreservation(target: Target): Promise<Preservation> {
  const list = await Manager.inspectMutationRecovery(target)
  assert("entries" in list && Array.isArray(list.entries))
  expect(list.entries.map(({ disposition, preservation }) => ({ disposition, preservation }))).toEqual([
    { disposition: "commit_receipt_unavailable", preservation: "complete" },
  ])
  const chunks: Buffer[] = []
  let byteOffset: number | null = 0
  while (byteOffset !== null) {
    const page = await Manager.inspectMutationRecovery({
      ...target,
      occurrenceID: list.entries[0]!.occurrenceID,
      byteOffset,
    })
    assert("dataBase64" in page && typeof page.dataBase64 === "string")
    chunks.push(Buffer.from(page.dataBase64, "base64"))
    byteOffset = page.nextByteOffset
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Preservation
}

// Established Task/Session inputs exercise the public Manager and original
// Artifact writer. The ingress runner is a fixture boundary: this contract
// records the visible authorization without dispatching a model or campaign.
async function mutationFixture(target: Target, source: Awaited<ReturnType<typeof sources>>) {
  configureTaskIngressRunner(async () => {})
  const baseline = await Manager.importDirectory({ ...target, sourceDirectory: source(versions[0]) })
  const candidate = await Registry.readInstalledPackageRevision(source(versions[1]), { preserveSnapshot: true })
  const taskID = Identifier.ascending("task"),
    now = Date.now()
  const session = Session.prepareRootNext({
    kind: "root",
    directory: target.projectDirectory,
    title: "Recovery continuation",
    metadata: { configOverlay: { model: "firmware/gpt-5", prompt_profile: { active: target.id } } },
  })
  persistEstablishedTask({
    taskID,
    rootSession: session,
    now,
    title: "Recovery continuation",
    request: "Exercise persistent Manager continuation",
    productPillar: "code",
    source: "test",
    priority: "normal",
    projectID: Instance.project.id,
    metadata: projectTaskCreatorMetadata({}, await resolveTaskCreator({ actor: "user" })),
    packageRevision: {
      scope: target.installationScope,
      projectID: target.installationScope === "project" ? Instance.project.id : null,
      namespace,
      id: target.id,
      version: baseline.after.version!,
      packageDigest: baseline.after.packageDigest,
    },
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: target.projectDirectory,
      packageRevisionSHA256: baseline.after.packageDigest,
      timeCreated: now,
    }),
  })
  const text = `Promote the isolated ${target.installationScope} continuation package.`
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
    label: "Continuation input",
    payload: EngineArtifactEnvelopeSchema.parse({
      artifact_type: "continuation-test/input",
      schema_version: 1,
      producer: { owner_kind: "core", component_id: "continuation-test", operation_id: authorization.message_id },
      payload: { baseline: baseline.after, candidate },
      resources: [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
    }),
  })
  const evidence = [exactEngineArtifactLocator({ taskID, artifactID: evidenceID })]
  const artifactID = Identifier.ascending("artifact")
  const journalPath = path.join(
    ExpertSquadPackageLocations.resolve(target.installationScope, target.projectDirectory).configRoot,
    "expert-squad-staging",
    `.evolution-mutation-${target.id}.json`,
  )
  return {
    baseline,
    candidate,
    artifactID,
    journalPath,
    promote: (interruptAfterCommit = false) =>
      Manager.promotePackageRevision({
        ...target,
        expectedCurrentPackageDigest: baseline.after.packageDigest,
        promotePackageDigest: candidate.packageDigest,
        durableReceipt: {
          identity: { taskID, artifactID },
          commit: async (managerReceipt) => {
            const receipt = EvolutionPromotionReceiptSchema.parse({
              operation: "promotion",
              authorization,
              target: {
                scope: target.installationScope,
                project_id: target.installationScope === "project" ? Instance.project.id : null,
                project_directory: target.installationScope === "project" ? target.projectDirectory : null,
                namespace,
                id: target.id,
              },
              expected_current_digest: baseline.after.packageDigest,
              before_digest: managerReceipt.before!.packageDigest,
              after_digest: managerReceipt.after.packageDigest,
              evidence,
              manager_receipt: managerReceipt,
            })
            recordEngineArtifact({
              id: artifactID,
              taskID,
              kind: "expert_output",
              label: "Continuation receipt",
              payload: EngineArtifactEnvelopeSchema.parse({
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
              }),
            })
            if (interruptAfterCommit) throw new Manager.EvolutionMutationAbruptTerminationForTest()
          },
        },
      }),
  }
}

async function interruptBeforeReceipt(fixture: Awaited<ReturnType<typeof mutationFixture>>) {
  const restore = Manager.TestHooks.interruptAfterTargetInstallBeforeReceiptOnce()
  let interruption: unknown
  try {
    await fixture.promote()
  } catch (error) {
    interruption = error
  } finally {
    restore()
  }
  expect(interruption).toBeInstanceOf(Manager.EvolutionMutationAbruptTerminationForTest)
}

test("ordinary import preserves the pending unknown installation before publishing the next revision", async () => {
  await using project = await memoryProject("recovery-continuation-unknown")
  const target: Target = { projectDirectory: project.path, id: "continuation-unknown", installationScope: "project" }
  const source = await sources(target.id)
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const fixture = await mutationFixture(target, source)
      await interruptBeforeReceipt(fixture)
      const journalText = await readFile(fixture.journalPath, "utf8")
      const originalTree = await digestFilesystemTree(fixture.baseline.after.targetRoot)
      const originalReadme = await readFile(path.join(fixture.baseline.after.targetRoot, "README.md"))
      const replaced = await Manager.importDirectory({
        ...target,
        sourceDirectory: source(versions[2]),
        expectedCurrentPackageDigest: fixture.candidate.packageDigest,
      })
      expect({
        operation: replaced.operation,
        before: replaced.before?.version,
        after: replaced.after.version,
      }).toEqual({
        operation: "replaced",
        before: versions[1],
        after: versions[2],
      })
      const preservation = await readPreservation(target)
      expect(preservation.intent.payload.protocol).toBe("opencorvus/expert-squad-mutation-preservation@2")
      expect(preservation.intent.payload.journalText).toBe(journalText)
      expect(preservation.terminal.payload.resourceEvidence.target.expectedObservationAvailable).toBe(true)
      const archived = preservation.terminal.payload.resourceEvidence.target.preserved.find(
        (item) => item.classification === "expected",
      )!
      expect(await digestFilesystemTree(archived.resource)).toBe(originalTree)
      expect(await readFile(path.join(archived.resource, "README.md"))).toEqual(originalReadme)
      expect(await installedVersion(replaced.after.targetRoot)).toBe(versions[2])
      expect(await Manager.reconcileCommittedPackageMutation(target)).toEqual({ disposition: "none" })
    },
  })
})

test("ordinary import settles an earlier committed journal and retains the original canonical receipt", async () => {
  await using project = await memoryProject("recovery-continuation-committed")
  const target: Target = { projectDirectory: project.path, id: "continuation-committed", installationScope: "global" }
  const source = await sources(target.id)
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const fixture = await mutationFixture(target, source)
      let interruption: unknown
      try {
        await fixture.promote(true)
      } catch (error) {
        interruption = error
      }
      expect(interruption).toBeInstanceOf(Manager.EvolutionMutationAbruptTerminationForTest)
      const original = Database.use((db) => readExpertSquadMutationReceipt(db, fixture.artifactID))!
      expect(original.receipt.after_digest).toBe(fixture.candidate.packageDigest)
      expect(JSON.parse(await readFile(fixture.journalPath, "utf8")).identity.artifactID).toBe(fixture.artifactID)
      const replaced = await Manager.importDirectory({
        ...target,
        sourceDirectory: source(versions[2]),
        expectedCurrentPackageDigest: fixture.candidate.packageDigest,
      })
      expect({
        operation: replaced.operation,
        before: replaced.before?.version,
        after: replaced.after.version,
      }).toEqual({
        operation: "replaced",
        before: versions[1],
        after: versions[2],
      })
      expect(Database.use((db) => readExpertSquadMutationReceipt(db, fixture.artifactID))).toEqual(original)
      expect(await installedVersion(replaced.after.targetRoot)).toBe(versions[2])
      expect(await Manager.reconcileCommittedPackageMutation(target)).toEqual({ disposition: "none" })
    },
  })
})

test("same-ID publications keep each Project and the global installation on their own continuation", async () => {
  await using first = await memoryProject("recovery-continuation-project-a")
  await using second = await memoryProject("recovery-continuation-project-b")
  const id = "continuation-isolation",
    source = await sources(id)
  const firstTarget: Target = { projectDirectory: first.path, id, installationScope: "project" }
  const secondTarget: Target = { projectDirectory: second.path, id, installationScope: "project" }
  const globalTarget: Target = { projectDirectory: second.path, id, installationScope: "global" }
  const secondBaseline = await Manager.importDirectory({ ...secondTarget, sourceDirectory: source(versions[0]) })
  const globalBaseline = await Manager.importDirectory({ ...globalTarget, sourceDirectory: source(versions[0]) })
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      const fixture = await mutationFixture(firstTarget, source)
      await interruptBeforeReceipt(fixture)
      const journalText = await readFile(fixture.journalPath, "utf8")
      const firstTree = await digestFilesystemTree(fixture.baseline.after.targetRoot)
      const secondChanged = await Manager.importDirectory({
        ...secondTarget,
        sourceDirectory: source(versions[2]),
        expectedCurrentPackageDigest: secondBaseline.after.packageDigest,
      })
      const globalChanged = await Manager.importDirectory({
        ...globalTarget,
        sourceDirectory: source(versions[2]),
        expectedCurrentPackageDigest: globalBaseline.after.packageDigest,
      })
      expect([
        secondChanged.after.installationScope,
        secondChanged.after.projectDirectory,
        secondChanged.after.version,
      ]).toEqual(["project", second.path, versions[2]])
      expect([
        globalChanged.after.installationScope,
        globalChanged.after.projectDirectory,
        globalChanged.after.version,
      ]).toEqual(["global", null, versions[2]])
      expect(await readFile(fixture.journalPath, "utf8")).toBe(journalText)
      expect(await digestFilesystemTree(fixture.baseline.after.targetRoot)).toBe(firstTree)
      const secondTree = await digestFilesystemTree(secondChanged.after.targetRoot)
      const globalTree = await digestFilesystemTree(globalChanged.after.targetRoot)
      const firstChanged = await Manager.importDirectory({
        ...firstTarget,
        sourceDirectory: source(versions[2]),
        expectedCurrentPackageDigest: fixture.candidate.packageDigest,
      })
      const preservation = await readPreservation(firstTarget)
      const archived = preservation.terminal.payload.resourceEvidence.target.preserved.find(
        (item) => item.classification === "expected",
      )!
      expect(await digestFilesystemTree(archived.resource)).toBe(firstTree)
      expect(await readFile(path.join(preservation.terminal.payload.resources, "original-journal.json"), "utf8")).toBe(
        journalText,
      )
      expect(await installedVersion(firstChanged.after.targetRoot)).toBe(versions[2])
      expect(await digestFilesystemTree(secondChanged.after.targetRoot)).toBe(secondTree)
      expect(await digestFilesystemTree(globalChanged.after.targetRoot)).toBe(globalTree)
    },
  })
})
