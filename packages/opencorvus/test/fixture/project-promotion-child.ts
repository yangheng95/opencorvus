const [action, projectID, destinationParent, name, requestedCut, requestedRelease] = process.argv.slice(2)
if (!action || !destinationParent) {
  throw new Error(
    "usage: project-promotion-child <setup|setup-backward-window|promote|promote-cut|promote-held-admission|promote-held-prepared|inspect|recover|recover-held> <project-id-or-dash> <destination-parent> [name] [cut-or-started] [release]",
  )
}

const fs = await import("node:fs/promises")
const path = await import("node:path")
const { randomUUID } = await import("node:crypto")
const { ImplicitProject } = await import("../../src/project/implicit-project")

async function exists(target: string): Promise<boolean> {
  return fs.stat(target).then(
    () => true,
    () => false,
  )
}

async function waitFor(target: string): Promise<void> {
  const deadline = Date.now() + 30_000
  while (!(await exists(target))) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

if (action === "setup") {
  await fs.mkdir(destinationParent, { recursive: true })
  const anonymous = await ImplicitProject.create()
  process.stdout.write(`${JSON.stringify({ projectID: anonymous.project.id, source: anonymous.directory })}\n`)
} else if (action === "setup-backward-window") {
  const { Global } = await import("../../src/global")
  const { Database, eq } = await import("../../src/storage/db")
  const { Project } = await import("../../src/project/project")
  const { ProjectDirectoryAdmission } = await import("../../src/project/directory-admission")
  const { ProjectTable } = await import("../../src/project/project.sql")
  const { PromotionJournal } = await import("../../src/project/promotion-journal")
  const { ImplicitProjectCreation } = await import("../../src/project/implicit-project-creation")
  const { ensureProjectPromotionFenceInTransaction } = await import("../../src/project/deletion-registry")
  await fs.mkdir(destinationParent, { recursive: true })
  const source = path.join(Global.Path.data, "projects", "2026", "08", "28", randomUUID())
  const creationOccurrenceID = await ImplicitProjectCreation.begin(source)
  await fs.mkdir(source, { recursive: true })
  await ImplicitProjectCreation.markDirectoryCreated(creationOccurrenceID)
  const initialized = Bun.spawnSync(["git", "init"], { cwd: source, stdout: "pipe", stderr: "pipe" })
  if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
  await ImplicitProjectCreation.markGitInitialized(creationOccurrenceID)
  const anonymous = await Project.fromDirectory(source)
  const physicalSource = await fs.realpath(source)
  const operationID = randomUUID()
  const quarantine = path.join(
    path.dirname(physicalSource),
    `.${path.basename(physicalSource)}.promoting-${operationID}`,
  )
  const staging = path.join(destinationParent, `.opencorvus-promoting-${operationID}`)
  const destination = path.join(destinationParent, "database-was-forward")
  const database = ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id)
  await PromotionJournal.record({
    operationID,
    projectID: anonymous.project.id,
    projectGeneration: database.project.generation,
    source,
    physicalSource,
    quarantine,
    staging,
    destination,
    name: "database-was-forward",
    sourceDigest: await PromotionJournal.digestDirectory(physicalSource),
    database,
    time_created: Date.now(),
  })
  await fs.rename(physicalSource, quarantine)
  const destinationAdmission = await ProjectDirectoryAdmission.acquire({
    directory: destination,
    operationID,
    kind: "promotion_publish",
  })
  if (destinationAdmission.outcome === "owned") throw new Error("fixture destination unexpectedly owned")
  ProjectDirectoryAdmission.settle(destinationAdmission.token, (db) => {
    const row = db.select().from(ProjectTable).where(eq(ProjectTable.id, anonymous.project.id)).get()!
    ensureProjectPromotionFenceInTransaction(db, { project: row, operationID })
    Project.beginPromotionCommit(
      { projectID: anonymous.project.id, operationID, expectedGeneration: database.project.generation },
      db,
    )
    Project.relocate(
      {
        projectID: anonymous.project.id,
        operationID,
        expectedGeneration: database.project.generation,
        expectedWorktree: source,
        worktree: destination,
        name: "database-was-forward",
        sandboxes: [],
        directoryAdmission: destinationAdmission.token,
      },
      db,
    )
    Project.finishPromotionCommit(
      { projectID: anonymous.project.id, operationID, expectedGeneration: database.project.generation },
      db,
    )
  })
  process.stdout.write(
    `${JSON.stringify({
      projectID: anonymous.project.id,
      source,
      destination,
      operationID,
      creationOccurrenceID,
    })}\n`,
  )
} else if (
  action === "promote" ||
  action === "promote-cut" ||
  action === "promote-held-admission" ||
  action === "promote-held-prepared"
) {
  const { Project } = await import("../../src/project/project")
  const project = Project.get(projectID!)
  if (!project) throw new Error(`Project not found: ${projectID}`)
  if (action === "promote-cut") {
    const { setDurablePublicationTestCutHook } = await import("@opencorvus-ai/util/durable-publication")
    setDurablePublicationTestCutHook((cut) => {
      if (cut === requestedCut) process.kill(process.pid, "SIGKILL")
    })
  }
  using _held =
    action === "promote-held-admission"
      ? ImplicitProject.PromotionTestHooks.installAfterAdmissions(async () => {
          if (!requestedCut || !requestedRelease) {
            throw new Error("promote-held-admission requires started and release paths")
          }
          await fs.writeFile(requestedCut, "started")
          await waitFor(requestedRelease)
        })
      : undefined
  using _prepared =
    action === "promote-held-prepared"
      ? ImplicitProject.PromotionTestHooks.installAfterPrepared(async () => {
          if (!requestedCut || !requestedRelease) {
            throw new Error("promote-held-prepared requires started and release paths")
          }
          await fs.writeFile(requestedCut, "started")
          await waitFor(requestedRelease)
        })
      : undefined
  const result = await ImplicitProject.promote({ project, destinationParent, name: name! })
  process.stdout.write(`${JSON.stringify({ directory: result.directory })}\n`)
} else if (action === "recover" || action === "recover-held") {
  const { Project } = await import("../../src/project/project")
  using _held =
    action === "recover-held"
      ? ImplicitProject.PromotionTestHooks.installAfterSourceRestore(async () => {
          if (!name || !requestedCut) throw new Error("recover-held requires started and release paths")
          await fs.writeFile(name, "started")
          await waitFor(requestedCut)
        })
      : undefined
  const recovered = await ImplicitProject.recoverPromotions()
  process.stdout.write(`${JSON.stringify({ recovered, project: Project.get(projectID!) })}\n`)
} else if (action === "inspect") {
  const { Project } = await import("../../src/project/project")
  const { ProjectMaintenanceFenceTable } = await import("../../src/project/project.sql")
  const { Database, eq } = await import("../../src/storage/db")
  const promotionFences = Database.use((db) =>
    db.select().from(ProjectMaintenanceFenceTable).where(eq(ProjectMaintenanceFenceTable.project_id, projectID!)).all(),
  )
  process.stdout.write(`${JSON.stringify({ project: Project.get(projectID!), promotionFences })}\n`)
} else {
  throw new Error(`unknown action: ${action}`)
}
