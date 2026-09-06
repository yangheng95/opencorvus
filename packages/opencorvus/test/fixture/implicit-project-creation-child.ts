const [action, ...requested] = process.argv.slice(2)
if (!action) {
  throw new Error(
    "usage: implicit-project-creation-child <create|create-cut|prepare-intent|prepare-dead|prepare-dead-parent|prepare-dead-linked|prepare-dead-and-owner|prepare-sandbox-owned|prepare-dotdot-nested-owned|prepare-alias-owned|prepare-committed-fenced|hold-admission|register-held|sandbox-register|converge|converge-held|inspect> [...args]",
  )
}

const fs = await import("node:fs/promises")
const path = await import("node:path")
const { randomUUID } = await import("node:crypto")
const { ImplicitProject } = await import("../../src/project/implicit-project")

async function waitFor(target: string): Promise<void> {
  const deadline = Date.now() + 30_000
  while (!(await exists(target))) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target)
    return true
  } catch {
    return false
  }
}

async function openOccurrences() {
  const { DurablePublicationStore } = await import("@opencorvus-ai/util/durable-publication")
  const { Global } = await import("../../src/global")
  const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
  const open = await store.listOpen("implicit-project-creation")
  return Promise.all(
    open.map(async (occurrence) => {
      const directory = (occurrence.intent.payload as { directory?: string }).directory ?? ""
      return {
        directory,
        phases: occurrence.phases.map((phase) => phase.name),
        directoryExists: await exists(directory),
        gitExists: await exists(path.join(directory, ".git")),
      }
    }),
  )
}

if (action === "create") {
  const anonymous = await ImplicitProject.create()
  process.stdout.write(`${JSON.stringify({ directory: anonymous.directory, projectID: anonymous.project.id })}\n`)
} else if (action === "create-cut") {
  const [requestedCut, requestedOrdinal] = requested
  const { setDurablePublicationTestCutHook } = await import("@opencorvus-ai/util/durable-publication")
  const ordinal = Number(requestedOrdinal ?? "1")
  let seen = 0
  setDurablePublicationTestCutHook((cut, kind) => {
    // Several subsystems share one store root and a fresh OPENCORVUS_HOME is
    // exactly when their first-run publications land, so the ordinal is only
    // stable when this journal's own kind is the one being counted.
    if (cut !== requestedCut || kind !== "implicit-project-creation") return
    seen += 1
    if (seen === ordinal) process.kill(process.pid, "SIGKILL")
  })
  const anonymous = await ImplicitProject.create()
  process.stdout.write(`${JSON.stringify({ directory: anonymous.directory, projectID: anonymous.project.id })}\n`)
} else if (
  action === "prepare-intent" ||
  action === "prepare-dead" ||
  action === "prepare-dead-parent" ||
  action === "prepare-dead-linked"
) {
  const { Global } = await import("../../src/global")
  const { ImplicitProjectCreation } = await import("../../src/project/implicit-project-creation")
  const { currentRuntimeProcessOccurrence } = await import("../../src/runtime/process-occurrence")
  const directory = path.join(Global.Path.data, "projects", "2026", "08", "28", randomUUID())
  const occurrenceID = await ImplicitProjectCreation.begin(directory)
  const creationOwner = currentRuntimeProcessOccurrence()
  if (action === "prepare-intent") {
    process.stdout.write(`${JSON.stringify({ directory, occurrenceID, creationOwner })}\n`)
    process.exit(0)
  }
  await fs.mkdir(directory, { recursive: true })
  await ImplicitProjectCreation.markDirectoryCreated(occurrenceID)
  const gitDirectory = action === "prepare-dead-parent" ? path.join(directory, "nested") : directory
  if (requested[0] === "git" || action === "prepare-dead-parent") {
    await fs.mkdir(gitDirectory, { recursive: true })
    const initialized = Bun.spawnSync(["git", "init"], { cwd: gitDirectory, stdout: "pipe", stderr: "pipe" })
    if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
  }
  let linkedDirectory: string | undefined
  if (action === "prepare-dead-linked") {
    const initialized = Bun.spawnSync(["git", "init"], { cwd: directory, stdout: "pipe", stderr: "pipe" })
    if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
    const committed = Bun.spawnSync(
      [
        "git",
        "-c",
        "user.name=OpenCorvus Test",
        "-c",
        "user.email=test@opencorvus.ai",
        "commit",
        "--allow-empty",
        "-m",
        "initial",
      ],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    )
    if (committed.exitCode !== 0) throw new Error(committed.stderr.toString())
    linkedDirectory = path.join(Global.Path.data, "w", "l")
    await fs.mkdir(path.dirname(linkedDirectory), { recursive: true })
    const linked = Bun.spawnSync(["git", "worktree", "add", "-b", "t", linkedDirectory], {
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    })
    if (linked.exitCode !== 0) throw new Error(linked.stderr.toString())
  }
  process.stdout.write(`${JSON.stringify({ directory, occurrenceID, gitDirectory, linkedDirectory, creationOwner })}\n`)
} else if (
  action === "prepare-dead-and-owner" ||
  action === "prepare-sandbox-owned" ||
  action === "prepare-dotdot-nested-owned" ||
  action === "prepare-alias-owned"
) {
  const { Global } = await import("../../src/global")
  const { Project } = await import("../../src/project/project")
  const { ImplicitProjectCreation } = await import("../../src/project/implicit-project-creation")
  const { currentRuntimeProcessOccurrence } = await import("../../src/runtime/process-occurrence")
  const directory = path.join(Global.Path.data, "projects", "2026", "08", "28", randomUUID())
  const occurrenceID = await ImplicitProjectCreation.begin(directory)
  const creationOwner = currentRuntimeProcessOccurrence()
  await fs.mkdir(directory, { recursive: true })
  await ImplicitProjectCreation.markDirectoryCreated(occurrenceID)
  const physicalRegisteredDirectory =
    action === "prepare-dotdot-nested-owned"
      ? path.join(directory, "..nested")
      : action === "prepare-alias-owned"
        ? path.join(directory, "physical")
        : directory
  await fs.mkdir(physicalRegisteredDirectory, { recursive: true })
  const initialized = Bun.spawnSync(["git", "init"], {
    cwd: physicalRegisteredDirectory,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
  const ownerDirectory = path.join(Global.Path.data, "test-project-owners", randomUUID())
  await fs.mkdir(ownerDirectory, { recursive: true })
  const owner = await Project.fromDirectory(ownerDirectory)
  const registeredDirectory =
    action === "prepare-alias-owned"
      ? path.join(Global.Path.data, "test-project-aliases", randomUUID())
      : physicalRegisteredDirectory
  if (action === "prepare-alias-owned") {
    await fs.mkdir(path.dirname(registeredDirectory), { recursive: true })
    await fs.symlink(physicalRegisteredDirectory, registeredDirectory, "junction")
  }
  if (
    action === "prepare-sandbox-owned" ||
    action === "prepare-dotdot-nested-owned" ||
    action === "prepare-alias-owned"
  ) {
    await Project.addSandbox(owner.project.id, registeredDirectory)
  }
  process.stdout.write(
    `${JSON.stringify({ directory, registeredDirectory, physicalRegisteredDirectory, occurrenceID, ownerDirectory, ownerProjectID: owner.project.id, creationOwner })}\n`,
  )
} else if (action === "prepare-committed-fenced") {
  const { Global } = await import("../../src/global")
  const { Database } = await import("../../src/storage/db")
  const { Project } = await import("../../src/project/project")
  const { ProjectMaintenanceFenceTable } = await import("../../src/project/project.sql")
  const { ImplicitProjectCreation } = await import("../../src/project/implicit-project-creation")
  const { currentRuntimeProcessOccurrence } = await import("../../src/runtime/process-occurrence")
  const directory = path.join(Global.Path.data, "projects", "2026", "08", "28", randomUUID())
  const occurrenceID = await ImplicitProjectCreation.begin(directory)
  const creationOwner = currentRuntimeProcessOccurrence()
  await fs.mkdir(directory, { recursive: true })
  await ImplicitProjectCreation.markDirectoryCreated(occurrenceID)
  const registered = await Project.fromDirectory(directory)
  const owner = currentRuntimeProcessOccurrence()
  Database.use((db) =>
    db
      .insert(ProjectMaintenanceFenceTable)
      .values({
        project_id: registered.project.id,
        project_generation: registered.generation,
        operation_id: randomUUID(),
        kind: "promotion",
        owner_occurrence_id: owner.occurrenceID,
        owner_pid: owner.pid,
        owner_process_instance_id: owner.processInstanceID,
        time_created: Date.now(),
      })
      .run(),
  )
  process.stdout.write(`${JSON.stringify({ directory, occurrenceID, projectID: registered.project.id, creationOwner })}\n`)
} else if (action === "hold-admission") {
  const [started, release] = requested
  if (!started || !release) throw new Error("hold-admission requires started and release")
  const { ProjectDirectoryAdmission } = await import("../../src/project/directory-admission")
  await ProjectDirectoryAdmission.run(async () => {
    await fs.writeFile(started, "started")
    await waitFor(release)
  })
} else if (action === "register-held") {
  const [directory, started, release, queued, compromised] = requested
  if (!directory || !started || !release) throw new Error("register-held requires directory, started, and release")
  const { Project } = await import("../../src/project/project")
  const { ProjectDirectoryAdmission } = await import("../../src/project/directory-admission")
  using _queued = queued
    ? ProjectDirectoryAdmission.TestHooks.installBeforeAcquire(() => fs.writeFile(queued, "queued"))
    : undefined
  using _compromised = compromised
    ? ProjectDirectoryAdmission.TestHooks.installAfterQueueCompromised(() => fs.writeFile(compromised, "compromised"))
    : undefined
  using _commit = Project.TestHooks.installAfterDiscoveryAdmission(async () => {
    await fs.writeFile(started, "started")
    await waitFor(release)
  })
  try {
    const initialized = await Project.initGit(directory)
    process.stdout.write(
      `${JSON.stringify({ outcome: "registered", directory: initialized.project.worktree, projectID: initialized.project.id })}\n`,
    )
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    process.stdout.write(
      `${JSON.stringify({
        outcome: errorName === "ProjectDirectoryIntegrityError" ? "directory_reclaimed" : "registration_refused",
        errorName,
        errorMessage: error instanceof Error ? error.message : String(error),
      })}\n`,
    )
  }
} else if (action === "sandbox-register") {
  const [projectID, directory, queued] = requested
  if (!projectID || !directory || !queued) throw new Error("sandbox-register requires projectID, directory, queued")
  const { Project } = await import("../../src/project/project")
  const { ProjectDirectoryAdmission } = await import("../../src/project/directory-admission")
  using _queued = ProjectDirectoryAdmission.TestHooks.installBeforeAcquire(() => fs.writeFile(queued, "queued"))
  try {
    await Project.registerExecutionDirectory(projectID, directory)
    const project = Project.get(projectID)
    process.stdout.write(`${JSON.stringify({ outcome: "registered", sandboxes: project?.sandboxes ?? [] })}\n`)
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        outcome: "registration_refused",
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      })}\n`,
    )
  }
} else if (action === "converge") {
  const { ProjectDirectoryAdmission } = await import("../../src/project/directory-admission")
  using _queued = requested[0]
    ? ProjectDirectoryAdmission.TestHooks.installBeforeAcquire(() => fs.writeFile(requested[0]!, "queued"))
    : undefined
  const before = await openOccurrences()
  const result = await ImplicitProject.convergeCreations()
  const reclaimedStillExist = await Promise.all(result.reclaimed.map(exists))
  process.stdout.write(`${JSON.stringify({ before, result, reclaimedStillExist, after: await openOccurrences() })}\n`)
} else if (action === "converge-held") {
  const [started, release] = requested
  if (!started || !release) throw new Error("converge-held requires started and release")
  const { Project } = await import("../../src/project/project")
  const { ProjectDirectoryAdmission } = await import("../../src/project/directory-admission")
  using _held = ProjectDirectoryAdmission.TestHooks.installAfterDurableAcquire(async () => {
    await fs.writeFile(started, "started")
    await waitFor(release)
  })
  const result = await ImplicitProject.convergeCreations(() => "dead_or_reused")
  process.stdout.write(`${JSON.stringify({ result, after: await openOccurrences(), projects: Project.list() })}\n`)
} else if (action === "inspect") {
  const { Project } = await import("../../src/project/project")
  const { ProjectDirectoryAdmissionTable } = await import("../../src/project/project.sql")
  const { Database } = await import("../../src/storage/db")
  const admissions = Database.use((db) => db.select().from(ProjectDirectoryAdmissionTable).all())
  process.stdout.write(`${JSON.stringify({ open: await openOccurrences(), projects: Project.list(), admissions })}\n`)
} else {
  throw new Error(`unknown action: ${action}`)
}
