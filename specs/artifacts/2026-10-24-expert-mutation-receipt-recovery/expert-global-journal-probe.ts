import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
const [stage = "outer", mode = "delete"] = process.argv.slice(2)
assert(["delete", "retain", "tombstone"].includes(mode))
const cut = process.env.EXPERT_AUDIT_CUT ?? "after-receipt"
const preserve = process.env.EXPERT_AUDIT_PRESERVE === "1"
const installationScope = process.env.EXPERT_AUDIT_SCOPE === "project" ? "project" : "global"
const operation = process.env.EXPERT_AUDIT_OPERATION === "restoration" ? "restoration" : "promotion"
const destination =
  process.env.EXPERT_AUDIT_OUTPUT_DIRECTORY ??
  path.resolve(`.tmp-product-iteration/durable-effect-receipt-audit/channel/expert-global-${mode}-${Date.now()}`)
fs.mkdirSync(destination, { recursive: true })
const reportFile = path.join(destination, "original.json")
if (stage === "outer") {
  assert(!fs.existsSync(reportFile), "new evidence directory preserves the original journal")
  const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
  const runtime = await bootstrapIsolatedTestRuntime("test")
  for (const key of Object.keys(process.env))
    if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
  const env = { ...process.env, EXPERT_AUDIT_OUTPUT_DIRECTORY: destination }
  for (const childStage of ["commit", "recover"]) {
    const running = Bun.spawn(
      [
        process.execPath,
        `--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`,
        import.meta.path,
        childStage,
        mode,
      ],
      { env, stdout: "pipe", stderr: "pipe" },
    )
    const [exit, stdout, stderr] = await Promise.all([
      running.exited,
      new Response(running.stdout).text(),
      new Response(running.stderr).text(),
    ])
    fs.writeFileSync(path.join(destination, `${childStage}.log`), stdout + stderr)
    assert.equal(exit, childStage === "commit" ? 23 : 0, `${childStage} actual process result; see original child log`)
  }
  const result = JSON.parse(fs.readFileSync(path.join(destination, "result.json"), "utf8"))
  assert.equal(result.original.actualTargetVersion, cut === "after-target-move" ? null : "2026.10.24.2")
  assert.equal(result.original.receiptRows.length, cut === "after-receipt" ? 1 : 0)
  assert.equal(result.original.journal.kind, "file")
  if (mode === "retain" && !preserve && cut === "after-receipt") {
    assert.equal(result.afterReconcile.targetVersion, "2026.10.24.2")
    assert.equal(result.afterReconcile.journal.kind, "absent")
  }
  result.runtime = runtime
  fs.writeFileSync(path.join(destination, "result.json"), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  process.exit(0)
}
const { Database } = await import("@/storage/db")
const { Instance } = await import("@/project/instance")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { ExpertSquadRegistry: Registry } = await import("@/expert-squad/registry")
function state(file: string) {
  try {
    const stat = fs.statSync(file)
    return { kind: stat.isDirectory() ? "directory" : "file", bytes: stat.size }
  } catch (error: any) {
    if (error.code === "ENOENT") return { kind: "absent" }
    throw error
  }
}
function snapshot(input: any) {
  return {
    schemaVersion: Database.allFinalized<any>("PRAGMA user_version")[0].user_version,
    targetVersion: fs.existsSync(input.targetRoot)
      ? JSON.parse(fs.readFileSync(path.join(input.targetRoot, "expert-squad.jsonc"), "utf8")).version
      : null,
    targetReadme: fs.existsSync(input.targetRoot)
      ? fs.readFileSync(path.join(input.targetRoot, "README.md"), "utf8")
      : null,
    journal: state(input.journalPath),
    journalText: fs.existsSync(input.journalPath) ? fs.readFileSync(input.journalPath, "utf8") : null,
    backup: state(input.backupPath),
    providerRequestCount: Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n,
    projects: Database.allFinalized<any>("SELECT id,generation FROM project").filter(
      (row) => row.id === input.projectID,
    ),
    tasks: Database.allFinalized<any>("SELECT id,project_id FROM engine_task").filter((row) => row.id === input.taskID),
    receiptRows: Database.allFinalized<any>("SELECT rowid AS __rowid,* FROM engine_artifact").filter(
      (row) => row.id === input.artifactID,
    ),
  }
}
if (stage === "commit") {
  const { memoryProject } = await import("../../../packages/opencorvus/test/fixture/memory")
  const { Global } = await import("@/global")
  const { writeExpertSquadPackage } = await import("@opencorvus-ai/sdk/expert-squad-authoring")
  const { persistEstablishedTask } = await import("../../../packages/opencorvus/test/fixture/engine-task")
  const { prepareTaskProcessBinding } = await import("@/engine/task-execution-capsule-binding")
  const { Session } = await import("@/session")
  const { Identifier } = await import("@/id/id")
  const { EngineService } = await import("@/task-api")
  const { projectTaskCreatorMetadata, resolveTaskCreator } = await import("@/task-api/task-creator")
  const { requireEvolutionMutationAuthorization } = await import("@/expert-squad/mutation-authorization")
  const { recordEngineArtifact } = await import("@/engine/artifact")
  const { exactEngineArtifactLocator } = await import("@/artifact-catalog")
  const { EngineArtifactEnvelopeSchema, EvolutionPromotionReceiptSchema } = await import("@opencorvus-ai/plugin")
  const { ExpertSquadPackageLocations } = await import("@/expert-squad/locations")
  const fixture = await memoryProject("global-expert-receipt-lifetime")
  const sourceRoot = await Global.createTemporaryDirectory("global-expert-journal-source-")
  const namespace = "durable-audit",
    id = "global-journal-audit"
  const source = (version: string) => path.join(sourceRoot, version, namespace, id)
  for (const version of ["2026.10.24.1", "2026.10.24.2"]) {
    await writeExpertSquadPackage({
      directory: source(version),
      definition: {
        manifest: {
          schema_version: 2,
          namespace,
          id,
          label: "Global journal audit",
          description: "Isolated actual package publication",
          version,
          product_pillars: ["code"],
          readme: "README.md",
          selector: {
            summary: "Isolated lifecycle evidence",
            selection_guidance: "Audit fixture only",
            instructions: "selector.md",
          },
          capability_sets: {},
          capability_projection: {
            scheduler: { capability_refs: [], base_role: "orchestrator" },
            agents: {
              "audit-worker": {
                capability_refs: [],
                label: "Audit worker",
                description: "Fixture role",
                base_role: "build",
                prompt: "agents/audit-worker/system.md",
              },
            },
            virtual_workflows: {},
          },
        },
        files: {
          "README.md": `# Global journal audit\n\nActual version ${version}\n`,
          "selector.md": "# Isolated audit selector\n",
          "agents/audit-worker/system.md": `# Fixture instructions ${version}\n`,
        },
      },
    })
  }
  await Instance.provide({
    directory: fixture.path,
    fn: async () => {
      EngineService.init()
      const baseline = await Manager.importDirectory({
        projectDirectory: fixture.path,
        sourceDirectory: source("2026.10.24.1"),
        installationScope,
      })
      const candidate = await Registry.readInstalledPackageRevision(source("2026.10.24.2"), { preserveSnapshot: true })
      const session = Session.prepareRootNext({
        kind: "root",
        directory: fixture.path,
        title: "Global receipt lifecycle",
        metadata: { configOverlay: { model: "firmware/gpt-5", prompt_profile: { active: id } } },
      })
      const taskID = Identifier.ascending("task"),
        now = Date.now(),
        projectID = Instance.project.id
      const creator = await resolveTaskCreator({ actor: "user" })
      persistEstablishedTask({
        taskID,
        rootSession: session,
        now,
        title: "Global receipt lifecycle",
        request: "Isolated global package mutation",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: projectTaskCreatorMetadata({}, creator),
        projectID,
        packageRevision: {
          scope: installationScope,
          projectID: installationScope === "project" ? projectID : null,
          namespace,
          id,
          version: baseline.after.version!,
          packageDigest: baseline.after.packageDigest,
        },
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID,
          rootDirectory: fixture.path,
          packageRevisionSHA256: baseline.after.packageDigest,
          timeCreated: now,
        }),
      })
      const confirmation = `${operation === "restoration" ? "Restore" : "Promote"} the isolated ${installationScope} audit package to its actual version 2026.10.24.2.`
      const message = await EngineService.handleTaskMessage(taskID, {
        text: confirmation,
        source: "expert_squad.evolution_authorization",
      })
      const authorization = await requireEvolutionMutationAuthorization({
        projectID,
        taskID,
        sessionID: session.id,
        messageID: message.user_message.info.id,
        expectedText: confirmation,
      })
      const evidenceID = recordEngineArtifact({
        taskID,
        kind: "expert_output",
        label: "Actual isolated package mutation input",
        payload: EngineArtifactEnvelopeSchema.parse({
          artifact_type: "audit/package-input",
          schema_version: 1,
          producer: {
            owner_kind: "core",
            component_id: "durable-delivery-audit",
            operation_id: authorization.message_id,
          },
          payload: { before: baseline.after, candidate, confirmation },
          resources: [],
          observed_artifact_locators: [],
          source_artifact_locators: [],
        }),
      })
      const evidence = [exactEngineArtifactLocator({ taskID, artifactID: evidenceID })]
      const artifactID = Identifier.ascending("artifact")
      if (process.env.EXPERT_AUDIT_PRECOMMIT_SNAPSHOT === "1")
        Manager.TestHooks.afterTargetInstallBeforeReceiptOnce(async () => {
          using raw = new SQLite(Database.Path(), { readonly: true, create: false })
          raw.exec("PRAGMA query_only=ON; BEGIN")
          fs.writeFileSync(path.join(destination, "before-actual-receipt.sqlite"), raw.serialize())
          raw.exec("ROLLBACK")
        })
      if (cut !== "after-receipt")
        (cut === "after-target-move"
          ? Manager.TestHooks.afterTargetMoveBeforeInstallOnce
          : Manager.TestHooks.afterTargetInstallBeforeReceiptOnce)(async () => {
          const targetRoot = baseline.after.targetRoot
          const journalPath = path.join(
            ExpertSquadPackageLocations.resolve(installationScope, fixture.path).configRoot,
            "expert-squad-staging",
            `.evolution-mutation-${id}.json`,
          )
          const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"))
          const original = {
            directory: fixture.path,
            databasePath: Database.Path(),
            projectID,
            projectGeneration: Instance.projectGeneration,
            taskID,
            artifactID,
            id,
            targetRoot,
            journalPath,
            backupPath: journal.backup,
            stagingPath: journal.staging,
            actualTargetVersion: fs.existsSync(targetRoot)
              ? JSON.parse(fs.readFileSync(path.join(targetRoot, "expert-squad.jsonc"), "utf8")).version
              : null,
            cut,
            ...snapshot({ projectID, taskID, artifactID, targetRoot, journalPath, backupPath: journal.backup }),
          }
          assert.equal(original.providerRequestCount, 0)
          fs.writeFileSync(reportFile, JSON.stringify(original, null, 2))
          {
            using raw = new SQLite(Database.Path(), { readonly: true, create: false })
            raw.exec("PRAGMA query_only=ON; BEGIN")
            fs.writeFileSync(path.join(destination, "committed-before-exit.sqlite"), raw.serialize())
            raw.exec("ROLLBACK")
          }
          process.exit(23)
        })
      const mutation =
        operation === "restoration"
          ? (input: any) =>
              Manager.restorePackageRevisionWithReceipt({ ...input, restorePackageDigest: candidate.packageDigest })
          : (input: any) => Manager.promotePackageRevision({ ...input, promotePackageDigest: candidate.packageDigest })
      await mutation({
        projectDirectory: fixture.path,
        id,
        installationScope,
        expectedCurrentPackageDigest: baseline.after.packageDigest,
        durableReceipt: {
          identity: { taskID, artifactID },
          commit: async (managerReceipt) => {
            const receipt = EvolutionPromotionReceiptSchema.parse({
              operation,
              authorization,
              target: {
                scope: installationScope,
                project_id: installationScope === "project" ? projectID : null,
                project_directory: installationScope === "project" ? fixture.path : null,
                namespace,
                id,
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
              label: "evolution-lab/promotion-receipt",
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
            const journalPath = path.join(
              ExpertSquadPackageLocations.resolve(installationScope, fixture.path).configRoot,
              "expert-squad-staging",
              `.evolution-mutation-${id}.json`,
            )
            const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"))
            const original = {
              directory: fixture.path,
              databasePath: Database.Path(),
              projectID,
              projectGeneration: Instance.projectGeneration,
              taskID,
              artifactID,
              id,
              targetRoot: managerReceipt.after.targetRoot,
              journalPath,
              backupPath: journal.backup,
              stagingPath: journal.staging,
              managerReceipt,
              receipt,
              actualTargetVersion: JSON.parse(
                fs.readFileSync(path.join(managerReceipt.after.targetRoot, "expert-squad.jsonc"), "utf8"),
              ).version,
              ...snapshot({
                projectID,
                taskID,
                artifactID,
                targetRoot: managerReceipt.after.targetRoot,
                journalPath,
                backupPath: journal.backup,
              }),
            }
            assert.equal(original.providerRequestCount, 0)
            fs.writeFileSync(reportFile, JSON.stringify(original, null, 2))
            {
              using raw = new SQLite(Database.Path(), { readonly: true, create: false })
              raw.exec("PRAGMA query_only=ON; BEGIN")
              fs.writeFileSync(path.join(destination, "committed-before-exit.sqlite"), raw.serialize())
              raw.exec("ROLLBACK")
            }
            process.exit(23)
          },
        },
      })
      throw new Error("Actual after-receipt hard cut was not reached")
    },
  })
} else {
  const original = JSON.parse(fs.readFileSync(reportFile, "utf8"))
  const before = snapshot(original)
  let deletion: unknown
  if (mode === "tombstone") {
    const { EngineService } = await import("@/task-api")
    deletion = await Instance.provide({
      directory: original.directory,
      fn: async () => {
        EngineService.init()
        return EngineService.deleteTask(original.taskID, {
          projectID: original.projectID,
          origin: {
            actor: "user",
            source: "task.delete",
            surface: "api",
            requestID: "ordinary-receipt-source-delete",
            reason: "Isolated ordinary Task tombstone boundary",
          },
        })
      },
    })
    assert.equal(deletion, true)
  }
  if (mode === "delete") {
    const { Project } = await import("@/project/project")
    const { deleteProject } = await import("@/project/delete")
    try {
      deletion = await deleteProject(Project.get(original.projectID)!, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "delete-global-receipt-origin",
        reason: "Isolated receipt lifetime audit",
      })
    } catch (error: any) {
      const describe = (value: any, depth = 0): unknown =>
        depth > 6
          ? String(value)
          : value && {
              name: value.name,
              message: value.message,
              stack: value.stack,
              data: value.data,
              cause: value.cause ? describe(value.cause, depth + 1) : undefined,
              errors: Array.isArray(value.errors)
                ? value.errors.map((entry: any) => describe(entry, depth + 1))
                : undefined,
            }
      fs.writeFileSync(
        path.join(destination, "delete-error.json"),
        JSON.stringify(
          {
            error: describe(error),
            before,
            after: snapshot(original),
            protocol: Database.allFinalized("SELECT * FROM protocol_event"),
          },
          null,
          2,
        ),
      )
      {
        using raw = new SQLite(Database.Path(), { readonly: true, create: false })
        raw.exec("PRAGMA query_only=ON; BEGIN")
        fs.writeFileSync(path.join(destination, "after-delete-error.sqlite"), raw.serialize())
        raw.exec("ROLLBACK")
      }
      throw error
    }
    assert.equal((deletion as any).status, "committed")
  }
  const afterDelete = snapshot(original)
  {
    using raw = new SQLite(Database.Path(), { readonly: true, create: false })
    raw.exec("PRAGMA query_only=ON; BEGIN")
    fs.writeFileSync(path.join(destination, "after-delete-before-reconcile.sqlite"), raw.serialize())
    raw.exec("ROLLBACK")
  }
  const files = path.join(destination, "after-delete-files")
  fs.mkdirSync(files, { recursive: true })
  const ownedRoot = path.resolve(path.dirname(path.dirname(path.dirname(original.databasePath))))
  for (const [name, source] of Object.entries({
    target: original.targetRoot,
    backup: original.backupPath,
    ...(original.stagingPath ? { staging: original.stagingPath } : {}),
    "journal.json": original.journalPath,
  })) {
    assert(
      path.resolve(source as string).startsWith(ownedRoot + path.sep),
      "evidence source belongs to the self-owned isolated runtime",
    )
    if (fs.existsSync(source as string))
      fs.cpSync(source as string, path.join(files, name), { recursive: true, errorOnExist: true, force: false })
  }
  let recovery: any
  if (!preserve)
    recovery = await Manager.reconcileCommittedPackageMutation({
      projectDirectory: original.directory,
      id: original.id,
      installationScope,
    })
  const afterReconcile = snapshot(original)
  assert.equal(afterReconcile.providerRequestCount, 0)
  await Instance.disposeAll()
  await Database.awaitEffectIdle(60_000)
  Database.close()
  const canonical = Database.allFinalized<any>("SELECT * FROM expert_squad_mutation_receipt").filter(
    (row) => row.artifact_id === original.artifactID,
  )
  if (!preserve && cut === "after-receipt") {
    assert.equal(canonical.length, 1)
    assert.equal(afterReconcile.targetVersion, "2026.10.24.2")
    assert(["committed", "none"].includes(recovery.disposition))
  }
  const result = {
    mode,
    cut,
    preserve,
    installationScope,
    operation,
    recovery,
    canonical,
    actualEntry: `Manager.${operation === "restoration" ? "restorePackageRevisionWithReceipt" : "promotePackageRevision"} + recordEngineArtifact durableReceipt.commit`,
    hardExit: 23,
    original,
    before,
    deletion,
    afterDelete,
    afterReconcile,
  }
  fs.writeFileSync(path.join(destination, "result.json"), JSON.stringify(result, null, 2))
  console.log(
    JSON.stringify({
      mode,
      beforeVersion: before.targetVersion,
      afterDeleteVersion: afterDelete.targetVersion,
      finalVersion: afterReconcile.targetVersion,
      originalReceiptRows: before.receiptRows.length,
      afterDeleteReceiptRows: afterDelete.receiptRows.length,
      afterDeleteJournal: afterDelete.journal,
      finalJournal: afterReconcile.journal,
      deletion,
    }),
  )
}
process.exit(0)
