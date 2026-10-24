import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "../../../packages/util/src/test-runtime-environment"
import { prepareTestProcessSupervisor } from "../../../packages/opencorvus/script/prepare-test-process-supervisor"

const stage = process.argv[2] ?? "outer"
const destination =
  process.env.JUDGE_FEEDBACK_RETRY_DIRECTORY ??
  path.resolve(".tmp-product-iteration/expert-recovery-continuation-audit/judge", `feedback-retry-${Date.now()}`)
fs.mkdirSync(destination, { recursive: true })
const requestFile = path.join(destination, "request.json")
function save(name: string, value: unknown) {
  fs.writeFileSync(path.join(destination, `${name}.json`), JSON.stringify(value, null, 2))
}

if (stage === "outer") {
  const runtime = await bootstrapIsolatedTestRuntime("runner")
  applyIsolatedTestUserEnvironment(runtime)
  const helper = prepareTestProcessSupervisor()
  if (helper) process.env.OPENCORVUS_PROCESS_SUPERVISOR = helper
  const { runHostCommandWithInactivity } = await import("@/shell/command-inactivity")
  const environment = {
    ...process.env,
    JUDGE_FEEDBACK_RETRY_DIRECTORY: destination,
    OPENCORVUS_DISABLE_EXTERNAL_SKILLS: "1",
    OPENCORVUS_DISABLE_AUTOUPDATE: "1",
  }
  for (const key of Object.keys(environment))
    if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key))
      delete environment[key as keyof typeof environment]
  save("runtime", runtime)
  for (const childStage of ["prepare", "resume"]) {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: ["--tsconfig-override=packages/opencorvus/tsconfig.json", import.meta.path, childStage],
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: environment,
      inactivityTimeoutMs: 120_000,
      onStdout: (text) => process.stdout.write(text),
      onStderr: (text) => process.stderr.write(text),
    })
    fs.writeFileSync(path.join(destination, `${childStage}.log`), result.stdout + result.stderr)
    save(`${childStage}-settlement`, {
      exit: result.exitCode,
      failure: result.failure,
      settlementConfirmed: result.settlementConfirmed,
    })
    assert.equal(result.exitCode, childStage === "prepare" ? 23 : 0)
    assert.equal(result.settlementConfirmed, true)
  }
  console.log(JSON.stringify({ destination, result: path.join(destination, "result.json") }))
  process.exit(0)
}

const { Database } = await import("@/storage/db")
const { Instance } = await import("@/project/instance")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { ExpertSquadRegistry: Registry } = await import("@/expert-squad/registry")
const { authorizeEvolutionPackageMutation, executeEvolutionPackageMutation } = await import(
  "@/expert-squad/evolution-mutation"
)
const { reviseInstalledExpertSquadFromFeedback } = await import("@/expert-squad/feedback-revision")
const { prepareEvolutionPackageMutation, evolutionMutationConfirmationText } = await import(
  "@/expert-squad/evolution-mutation-intent"
)
const { configureTaskIngressRunner } = await import("@/engine/task-root-ingress-delivery")
const id = "judge-feedback-retry",
  namespace = "judge-continuation"
function treeFiles(root: string): Record<string, string> {
  const output: Record<string, string> = {}
  const visit = (file: string) => {
    const stat = fs.lstatSync(file),
      relative = path.relative(root, file)
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name))
    else
      output[relative] = stat.isSymbolicLink()
        ? `link:${fs.readlinkSync(file)}`
        : fs.readFileSync(file).toString("base64")
  }
  visit(root)
  return output
}
function snapshot(name: string) {
  using raw = new SQLite(Database.Path(), { readonly: true, create: false })
  raw.exec("PRAGMA query_only=ON;BEGIN")
  fs.writeFileSync(path.join(destination, `${name}.sqlite`), raw.serialize())
  raw.exec("ROLLBACK")
}
async function archiveState(name: string, target: string, journalPath: string) {
  snapshot(name)
  if (fs.existsSync(target))
    fs.cpSync(target, path.join(destination, `${name}-target`), { recursive: true, force: false, errorOnExist: true })
  if (fs.existsSync(journalPath)) fs.copyFileSync(journalPath, path.join(destination, `${name}-journal.json`))
}

if (stage === "prepare") {
  const { memoryProject } = await import("../../../packages/opencorvus/test/fixture/memory")
  const { persistEstablishedTask } = await import("../../../packages/opencorvus/test/fixture/engine-task")
  const { prepareTaskProcessBinding } = await import("@/engine/task-execution-capsule-binding")
  const { writeExpertSquadPackage } = await import("@opencorvus-ai/sdk/expert-squad-authoring")
  const { Session } = await import("@/session")
  const { Identifier } = await import("@/id/id")
  const { Global } = await import("@/global")
  const { ExpertSquadPackageLocations } = await import("@/expert-squad/locations")
  const project = await memoryProject("judge-feedback-retry")
  const source = path.join(await Global.createTemporaryDirectory("judge-feedback-baseline-"), "source")
  await writeExpertSquadPackage({
    directory: source,
    definition: {
      manifest: {
        schema_version: 2,
        namespace,
        id,
        label: "Judge recovery retry",
        description: "Isolated actual retry boundary",
        version: "2026.10.24.1",
        product_pillars: ["code"],
        readme: "README.md",
        selector: {
          summary: "Synthetic retry contract",
          selection_guidance: "Use only for this isolated contract",
          instructions: "selector.md",
        },
        capability_sets: {},
        capability_projection: {
          scheduler: { base_role: "orchestrator", capability_refs: [] },
          agents: {
            "judge-retry-worker": {
              label: "Retry contract",
              description: "Isolated worker",
              base_role: "build",
              prompt: "agents/judge-retry-worker/system.md",
              capability_refs: [],
            },
          },
          virtual_workflows: {},
        },
      },
      files: {
        "README.md": "# Judge retry\n\nBaseline bytes\n",
        "selector.md": "# Isolated retry fixture\n",
        "agents/judge-retry-worker/system.md": "# Retry worker\n\nOriginal instruction.\n",
      },
    },
  })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      configureTaskIngressRunner(async () => {})
      const baseline = await Manager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: source,
        installationScope: "project",
      })
      const session = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Judge feedback retry",
        metadata: { configOverlay: { model: "firmware/gpt-5", prompt_profile: { active: id } } },
      })
      const taskID = Identifier.ascending("task"),
        now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: session,
        now,
        title: "Judge feedback retry",
        request: "Synthetic actual retry contract",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: {},
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
      const feedback = "Keep the original instruction and add the explicit retry requirement."
      const revision = await reviseInstalledExpertSquadFromFeedback({
        taskID,
        sessionID: session.id,
        request: {
          target_squad_id: `${namespace}/${id}`,
          feedback,
          hypothesis:
            "One explicit worker requirement changes its retry report; this probe tests persistence, not reasoning quality.",
          source_read_refs: [],
          edits: [
            {
              path: "agents/judge-retry-worker/system.md",
              old_text: "Original instruction.",
              new_text: "Original instruction.\nReport the exact retry outcome.",
              reason: "Preserve the original behavior and make the current retry result explicit.",
            },
          ],
        },
      })
      const intent = {
        operation: "feedback_revision" as const,
        candidateRevisionLocator: revision.locator,
        expectedCurrentPackageDigest: revision.expectedCurrentPackageDigest,
      }
      const prepared = prepareEvolutionPackageMutation({ taskID, intent })
      const confirmationText = evolutionMutationConfirmationText({
        projectID: Instance.project.id,
        target: prepared.target,
        beforeDigest: prepared.beforeDigest,
        afterDigest: prepared.afterDigest,
        evidenceSHA256s: prepared.evidence.map((x) => x.expected_sha256),
        operation: "feedback_revision",
        feedback,
      })
      const authorization = await authorizeEvolutionPackageMutation({
        taskID,
        sessionID: session.id,
        intent,
        confirmationText,
      })
      const request = { ...intent, authorization: authorization.authorization }
      const journalPath = path.join(
        ExpertSquadPackageLocations.project(project.path).configRoot,
        "expert-squad-staging",
        `.evolution-mutation-${id}.json`,
      )
      save("request", {
        syntheticTestDataOnly: true,
        directory: project.path,
        taskID,
        sessionID: session.id,
        request,
        confirmationText,
        baseline,
        revision,
        journalPath,
        databasePath: Database.Path(),
      })
      Manager.TestHooks.afterTargetInstallBeforeReceiptOnce(async () => {
        const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"))
        save("original", {
          journal,
          journalText: fs.readFileSync(journalPath, "utf8"),
          authority: Database.Identity(),
          providerRequests: Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n,
        })
        await archiveState("before-hard-exit", baseline.after.targetRoot, journalPath)
        fs.cpSync(journal.backup, path.join(destination, "before-hard-exit-backup"), {
          recursive: true,
          force: false,
          errorOnExist: true,
        })
        process.exit(23)
      })
      await executeEvolutionPackageMutation(request)
      throw new Error("Actual target-install hard cut not reached")
    },
  })
}

if (stage === "resume") {
  const original = JSON.parse(fs.readFileSync(requestFile, "utf8"))
  let result: unknown
  await Instance.provide({
    directory: original.directory,
    fn: async () => {
      configureTaskIngressRunner(async () => {})
      const recovery = await Manager.reconcileCommittedPackageMutation({
        projectDirectory: original.directory,
        id,
        installationScope: "project",
      })
      assert(["commit_receipt_unavailable", "none"].includes(recovery.disposition))
      const inspectionBefore = await Manager.inspectMutationRecovery({
        projectDirectory: original.directory,
        id,
        installationScope: "project",
      })
      const originalJournal = JSON.parse(fs.readFileSync(path.join(destination, "original.json"), "utf8")).journal
      assert.deepEqual(
        inspectionBefore.entries.map((entry: any) => ({
          occurrenceID: entry.occurrenceID,
          preservation: entry.preservation,
        })),
        [{ occurrenceID: originalJournal.operationID, preservation: "complete" }],
      )
      const { ExpertSquadPackageLocations } = await import("@/expert-squad/locations")
      const archive = path.join(
        ExpertSquadPackageLocations.project(original.directory).configRoot,
        "durable-publications",
        "expert-squad-mutations",
        id,
        "preservation",
        originalJournal.operationID,
      )
      const retainedBefore = treeFiles(archive)
      fs.cpSync(archive, path.join(destination, "archive-before-new-operation"), {
        recursive: true,
        force: false,
        errorOnExist: true,
      })
      let sameAfterError: any
      try {
        await executeEvolutionPackageMutation(original.request)
      } catch (error) {
        sameAfterError = error
      }
      assert.equal(sameAfterError?.name, "ExpertSquadPackageMutationConflictError")
      await archiveState("same-after-retry", original.baseline.after.targetRoot, original.journalPath)
      const current = await Registry.readInstalledPackageRevision(original.baseline.after.targetRoot)
      const restore = await Manager.importDirectory({
        projectDirectory: original.directory,
        sourceDirectory: path.join(destination, "before-hard-exit-backup"),
        installationScope: "project",
        expectedCurrentPackageDigest: current.packageDigest,
      })
      assert.equal(restore.after.packageDigest, original.baseline.after.packageDigest)
      await archiveState("explicit-before-restored", original.baseline.after.targetRoot, original.journalPath)
      let newJournal: any
      Manager.TestHooks.afterTargetInstallBeforeReceiptOnce(async () => {
        newJournal = JSON.parse(fs.readFileSync(original.journalPath, "utf8"))
        assert.notEqual(newJournal.operationID, originalJournal.operationID)
        await archiveState("new-attempt-before-receipt", original.baseline.after.targetRoot, original.journalPath)
      })
      const retry = await executeEvolutionPackageMutation(original.request)
      await archiveState("original-authorized-retry", original.baseline.after.targetRoot, original.journalPath)
      const repeated = await executeEvolutionPackageMutation(original.request)
      assert.deepEqual(repeated, retry)
      const inspectionAfter = await Manager.inspectMutationRecovery({
        projectDirectory: original.directory,
        id,
        installationScope: "project",
      })
      assert.deepEqual(inspectionAfter, inspectionBefore)
      assert.deepEqual(treeFiles(archive), retainedBefore)
      fs.cpSync(archive, path.join(destination, "archive-after-original-retry"), {
        recursive: true,
        force: false,
        errorOnExist: true,
      })
      result = {
        syntheticTestDataOnly: true,
        recovery,
        sameAfterError: { name: sameAfterError.name, message: sameAfterError.message, data: sameAfterError.data },
        restore,
        retry,
        repeated,
        inspectionBefore,
        inspectionAfter,
        archive,
        archiveBytesExact: true,
        originalJournal,
        newJournal,
        providerRequests: Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n,
        canonical: Database.allFinalized("SELECT * FROM expert_squad_mutation_receipt"),
      }
    },
  })
  save("result", result)
  await Instance.disposeAll()
  await Database.awaitEffectIdle(60_000)
  Database.close()
  console.log(JSON.stringify({ actual: "completed", result: path.join(destination, "result.json") }))
  process.exit(0)
}
