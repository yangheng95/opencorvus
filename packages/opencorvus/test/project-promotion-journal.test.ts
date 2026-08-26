import { afterEach, describe, expect, spyOn, test } from "bun:test"
import * as fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Instance } from "../src/project/instance"
import { ImplicitProject } from "../src/project/implicit-project"
import { PromotionJournal } from "../src/project/promotion-journal"
import { Project } from "../src/project/project"
import { ProjectTable } from "../src/project/project.sql"
import { ensureProjectPromotionFenceInTransaction } from "../src/project/deletion-registry"
import { releaseProjectMaintenanceFencesInTransaction } from "../src/project/deletion-registry"
import { Session } from "../src/session"
import { SessionTable } from "../src/session/session.sql"
import { Database, eq } from "../src/storage/db"
import { Filesystem } from "../src/util/filesystem"
import { Global } from "../src/global"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("anonymous Project promotion journal", () => {
  test("two backend processes publish exactly one terminal promotion for one Project generation", async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "promotion-race-"))
    const destinationParent = path.join(runtimeRoot, "destinations")
    const fixture = path.join(import.meta.dir, "fixture", "project-promotion-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    const setup = Bun.spawn([process.execPath, fixture, "setup", "-", destinationParent], {
      cwd: path.join(import.meta.dir, ".."),
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const setupOutput = await new Response(setup.stdout).text()
    await new Response(setup.stderr).text()
    expect(await setup.exited).toBe(0)
    const prepared = JSON.parse(setupOutput.trim().split(/\r?\n/).at(-1)!) as {
      projectID: string
      source: string
    }
    const command = [process.execPath, fixture, "promote", prepared.projectID, destinationParent, "one-winner"]
    const children = [
      Bun.spawn(command, { cwd: path.join(import.meta.dir, ".."), env, stdout: "pipe", stderr: "pipe" }),
      Bun.spawn(command, { cwd: path.join(import.meta.dir, ".."), env, stdout: "pipe", stderr: "pipe" }),
    ]
    const exits = await Promise.all(children.map((child) => child.exited))
    const occurrences = await new DurablePublicationStore(path.join(runtimeRoot, "data", "durable-publications")).list(
      "project-promotion",
    )
    expect({
      exits: exits.sort((left, right) => left - right),
      occurrences: occurrences.length,
      terminals: occurrences.filter((entry) => entry.terminal?.outcome === "committed").length,
      sourceExists: await Filesystem.exists(prepared.source),
      destinationExists: await Filesystem.exists(path.join(destinationParent, "one-winner")),
    }).toEqual({
      exits: [0, expect.any(Number)],
      occurrences: 1,
      terminals: 1,
      sourceExists: false,
      destinationExists: true,
    })
    expect(exits[1]).not.toBe(0)
    await fs.rm(runtimeRoot, { recursive: true, force: true })
  }, 90_000)

  test("startup releases the exact terminal-to-publication fence after a process death", async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "promotion-terminal-crash-"))
    const destinationParent = path.join(runtimeRoot, "destinations")
    const fixture = path.join(import.meta.dir, "fixture", "project-promotion-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    const run = (args: string[]) =>
      Bun.spawn([process.execPath, fixture, ...args], {
        cwd: path.join(import.meta.dir, ".."),
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
    const setup = run(["setup", "-", destinationParent])
    const setupOutput = await new Response(setup.stdout).text()
    await new Response(setup.stderr).text()
    expect(await setup.exited).toBe(0)
    const prepared = JSON.parse(setupOutput.trim().split(/\r?\n/).at(-1)!) as {
      projectID: string
      source: string
    }
    const killed = run([
      "promote-cut",
      prepared.projectID,
      destinationParent,
      "terminal-recovered",
      "terminal-published",
    ])
    await new Response(killed.stdout).text()
    await new Response(killed.stderr).text()
    expect(await killed.exited).not.toBe(0)

    const store = new DurablePublicationStore(path.join(runtimeRoot, "data", "durable-publications"))
    const beforeRecovery = await store.list("project-promotion")
    expect(beforeRecovery).toHaveLength(1)
    expect(beforeRecovery[0]?.terminal?.outcome).toBe("committed")

    const recovery = run(["recover", prepared.projectID, destinationParent])
    const recoveryOutput = await new Response(recovery.stdout).text()
    await new Response(recovery.stderr).text()
    expect(await recovery.exited).toBe(0)
    const recovered = JSON.parse(recoveryOutput.trim().split(/\r?\n/).at(-1)!) as {
      recovered: { forward: number; backward: number; failures: string[] }
      project?: { worktree: string }
    }
    expect({
      recovered: recovered.recovered,
      worktree: recovered.project?.worktree,
      destinationExists: await Filesystem.exists(path.join(destinationParent, "terminal-recovered")),
    }).toEqual({
      recovered: { forward: 1, backward: 0, failures: [] },
      worktree: path.join(destinationParent, "terminal-recovered"),
      destinationExists: true,
    })
    await fs.rm(runtimeRoot, { recursive: true, force: true })
  }, 90_000)

  test("startup rolls back a durable intent left before its Project fence was acquired", async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "promotion-intent-crash-"))
    const destinationParent = path.join(runtimeRoot, "destinations")
    const fixture = path.join(import.meta.dir, "fixture", "project-promotion-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    const run = (args: string[]) =>
      Bun.spawn([process.execPath, fixture, ...args], {
        cwd: path.join(import.meta.dir, ".."),
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
    const setup = run(["setup", "-", destinationParent])
    const setupOutput = await new Response(setup.stdout).text()
    await new Response(setup.stderr).text()
    expect(await setup.exited).toBe(0)
    const prepared = JSON.parse(setupOutput.trim().split(/\r?\n/).at(-1)!) as {
      projectID: string
      source: string
    }

    const killed = run([
      "promote-cut",
      prepared.projectID,
      destinationParent,
      "intent-recovered",
      "occurrence-published",
    ])
    await new Response(killed.stdout).text()
    await new Response(killed.stderr).text()
    expect(await killed.exited).not.toBe(0)

    const store = new DurablePublicationStore(path.join(runtimeRoot, "data", "durable-publications"))
    const beforeRecovery = await store.list("project-promotion")
    expect(beforeRecovery).toHaveLength(1)
    expect(beforeRecovery[0]?.terminal).toBeUndefined()
    expect(await Filesystem.exists(prepared.source)).toBe(true)

    const inspection = run(["inspect", prepared.projectID, destinationParent])
    const inspectionOutput = await new Response(inspection.stdout).text()
    await new Response(inspection.stderr).text()
    expect(await inspection.exited).toBe(0)
    const inspected = JSON.parse(inspectionOutput.trim().split(/\r?\n/).at(-1)!) as {
      project?: { worktree: string }
      promotionFences: unknown[]
    }
    expect(inspected).toMatchObject({
      project: { worktree: prepared.source },
      promotionFences: [],
    })

    const recovery = run(["recover", prepared.projectID, destinationParent])
    const recoveryOutput = await new Response(recovery.stdout).text()
    await new Response(recovery.stderr).text()
    expect(await recovery.exited).toBe(0)
    const recovered = JSON.parse(recoveryOutput.trim().split(/\r?\n/).at(-1)!) as {
      recovered: { forward: number; backward: number; failures: string[] }
      project?: { worktree: string }
    }
    expect({
      recovered: recovered.recovered,
      worktree: recovered.project?.worktree,
      sourceExists: await Filesystem.exists(prepared.source),
      destinationExists: await Filesystem.exists(path.join(destinationParent, "intent-recovered")),
      receipt: (await store.list("project-promotion"))[0]?.terminal?.outcome,
    }).toEqual({
      recovered: { forward: 0, backward: 1, failures: [] },
      worktree: prepared.source,
      sourceExists: true,
      destinationExists: false,
      receipt: "rolled_back",
    })
    await fs.rm(runtimeRoot, { recursive: true, force: true })
  }, 90_000)

  test("a promotion that died after publication converges forward at recovery", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const sessionID = await Instance.provide({
      directory: anonymous.directory,
      fn: async () => (await Session.create({ kind: "assistant", title: "Promoted conversation" })).id,
    })
    await Instance.disposeAll()

    const physicalSource = await fs.realpath(anonymous.directory)
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
    const destination = path.join(destinationParent, "recovered-forward")
    const operationID = randomUUID()
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${operationID}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${operationID}`)
    const projectGeneration = Database.use((db) =>
      db
        .select({ generation: ProjectTable.generation })
        .from(ProjectTable)
        .where(eq(ProjectTable.id, anonymous.project.id))
        .get(),
    )!.generation

    // The exact durable state a death after destination publication leaves:
    // the journal at "published", the physical tree at the destination, the
    // database still mapping the anonymous source.
    await PromotionJournal.record({
      operationID,
      projectID: anonymous.project.id,
      projectGeneration,
      source: anonymous.directory,
      physicalSource,
      quarantine,
      staging,
      destination,
      name: "recovered-forward",
      sourceDigest: await PromotionJournal.digestDirectory(physicalSource),
      database: ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id),
      time_created: Date.now(),
    })
    await fs.rename(physicalSource, quarantine)
    await fs.cp(quarantine, staging, { recursive: true })
    await PromotionJournal.markPrepared(operationID, await PromotionJournal.digestDirectory(staging))
    await fs.rename(staging, destination)
    await PromotionJournal.markPublished(operationID)

    const recovered = await ImplicitProject.recoverPromotions()
    const project = Project.get(anonymous.project.id)
    const sessionRow = Database.use((db) =>
      db.select({ directory: SessionTable.directory }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get(),
    )
    expect({
      outcome: recovered,
      worktree: project?.worktree,
      name: project?.name,
      sessionDirectory: sessionRow?.directory,
      journal: await PromotionJournal.get(anonymous.project.id),
      receipt: await PromotionJournal.terminal(operationID),
      destinationExists: await Filesystem.exists(destination),
      quarantineExists: await Filesystem.exists(quarantine),
    }).toEqual({
      outcome: { forward: 1, backward: 0, failures: [] },
      worktree: destination,
      name: "recovered-forward",
      sessionDirectory: destination,
      journal: undefined,
      receipt: expect.objectContaining({ occurrenceID: operationID, outcome: "committed" }),
      destinationExists: true,
      quarantineExists: false,
    })
  }, 60_000)

  test("a promotion that died before publication restores the source identity", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const physicalSource = await fs.realpath(anonymous.directory)
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
    const destination = path.join(destinationParent, "never-published")
    const operationID = randomUUID()
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${operationID}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${operationID}`)
    const projectGeneration = Database.use((db) =>
      db
        .select({ generation: ProjectTable.generation })
        .from(ProjectTable)
        .where(eq(ProjectTable.id, anonymous.project.id))
        .get(),
    )!.generation

    // The exact durable state a death before publication leaves: the journal
    // at "moving", the source renamed into quarantine, a partial staging
    // copy, and no destination.
    await PromotionJournal.record({
      operationID,
      projectID: anonymous.project.id,
      projectGeneration,
      source: anonymous.directory,
      physicalSource,
      quarantine,
      staging,
      destination,
      name: "never-published",
      sourceDigest: await PromotionJournal.digestDirectory(physicalSource),
      database: ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id),
      time_created: Date.now(),
    })
    await fs.rename(physicalSource, quarantine)
    await fs.mkdir(staging, { recursive: true })
    await fs.writeFile(path.join(staging, "partial.txt"), "partial copy")

    const recovered = await ImplicitProject.recoverPromotions()
    const project = Project.get(anonymous.project.id)
    expect({
      outcome: recovered,
      worktree: project?.worktree,
      sourceExists: await Filesystem.exists(physicalSource),
      stagingExists: await Filesystem.exists(staging),
      quarantineExists: await Filesystem.exists(quarantine),
      destinationExists: await Filesystem.exists(destination),
      journal: await PromotionJournal.get(anonymous.project.id),
      receipt: await PromotionJournal.terminal(operationID),
    }).toEqual({
      outcome: { forward: 0, backward: 1, failures: [] },
      worktree: anonymous.directory,
      sourceExists: true,
      stagingExists: false,
      quarantineExists: false,
      destinationExists: false,
      journal: undefined,
      receipt: expect.objectContaining({ occurrenceID: operationID, outcome: "rolled_back" }),
    })
  }, 60_000)

  test("recovery preserves both source and quarantine when source ownership is ambiguous", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const physicalSource = await fs.realpath(anonymous.directory)
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
    const operationID = randomUUID()
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${operationID}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${operationID}`)
    const destination = path.join(destinationParent, "ambiguous-source")
    const database = ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id)
    await PromotionJournal.record({
      operationID,
      projectID: anonymous.project.id,
      projectGeneration: database.project.generation,
      source: anonymous.directory,
      physicalSource,
      quarantine,
      staging,
      destination,
      name: "ambiguous-source",
      sourceDigest: await PromotionJournal.digestDirectory(physicalSource),
      database,
      time_created: Date.now(),
    })
    await fs.rename(physicalSource, quarantine)
    await fs.mkdir(physicalSource)
    await fs.writeFile(path.join(physicalSource, "foreign.txt"), "not promotion-owned")

    const recovered = await ImplicitProject.recoverPromotions()
    expect({
      failure: recovered.failures[0],
      sourceForeign: await fs.readFile(path.join(physicalSource, "foreign.txt"), "utf8"),
      quarantineDigest: await PromotionJournal.digestDirectory(quarantine),
      open: (await PromotionJournal.get(anonymous.project.id))?.operationID,
    }).toEqual({
      failure: expect.stringContaining("both source and quarantine"),
      sourceForeign: "not promotion-owned",
      quarantineDigest: await PromotionJournal.digestDirectory(quarantine),
      open: operationID,
    })

    await fs.rm(physicalSource, { recursive: true, force: false })
    await fs.rename(quarantine, physicalSource)
    await PromotionJournal.settle(operationID, "rolled_back", { reason: "ambiguity test cleanup" })
  }, 60_000)

  test("destination-mapped database is atomically restored when unpublished files roll back", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const sessionID = await Instance.provide({
      directory: anonymous.directory,
      fn: async () => (await Session.create({ kind: "assistant", title: "Rollback conversation" })).id,
    })
    await Instance.disposeAll()
    const physicalSource = await fs.realpath(anonymous.directory)
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
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
      source: anonymous.directory,
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
    Database.immediateTransaction((db) => {
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
          expectedWorktree: anonymous.directory,
          worktree: destination,
          name: "database-was-forward",
          sandboxes: [],
        },
        db,
      )
      Session.relocateProject(
        {
          projectID: anonymous.project.id,
          sourceDirectory: anonymous.directory,
          destinationDirectory: destination,
        },
        db,
      )
      Project.finishPromotionCommit(
        { projectID: anonymous.project.id, operationID, expectedGeneration: database.project.generation },
        db,
      )
    })

    const recovered = await ImplicitProject.recoverPromotions()
    const session = Database.use((db) =>
      db.select({ directory: SessionTable.directory }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get(),
    )
    expect({
      recovered,
      project: Project.get(anonymous.project.id),
      sessionDirectory: session?.directory,
      sourceExists: await Filesystem.exists(physicalSource),
      terminal: await PromotionJournal.terminal(operationID),
    }).toMatchObject({
      recovered: { forward: 0, backward: 1, failures: [] },
      project: { worktree: anonymous.directory, name: undefined },
      sessionDirectory: anonymous.directory,
      sourceExists: true,
      terminal: { outcome: "rolled_back" },
    })
  }, 60_000)

  test("the promotion fence returns one deterministic error contract for Project and Session writers", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const sessionID = await Instance.provide({
      directory: anonymous.directory,
      fn: async () => (await Session.create({ kind: "assistant", title: "Before fence" })).id,
    })
    const operationID = randomUUID()
    Database.immediateTransaction((db) => {
      const project = db.select().from(ProjectTable).where(eq(ProjectTable.id, anonymous.project.id)).get()!
      ensureProjectPromotionFenceInTransaction(db, { project, operationID })
    })

    const projectError = await Project.update({ projectID: anonymous.project.id, name: "blocked" }).catch(
      (error) => error as { code?: string; message?: string },
    )
    const sessionError = await Session.setTitle({ sessionID, title: "Blocked" }).catch(
      (error) => error as { code?: string; message?: string },
    )
    expect({
      project: { code: projectError.code, message: projectError.message },
      session: { code: sessionError.code, message: sessionError.message },
    }).toEqual({
      project: { code: "SQLITE_CONSTRAINT_TRIGGER", message: expect.stringContaining("project_promotion_fenced") },
      session: { code: "SQLITE_CONSTRAINT_TRIGGER", message: expect.stringContaining("project_promotion_fenced") },
    })
    Database.transaction((db) => releaseProjectMaintenanceFencesInTransaction(db, { operationID }))
  }, 60_000)

  test("recovery rejects an operation path that is not derived from its occurrence identity", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const physicalSource = await fs.realpath(anonymous.directory)
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
    const operationID = randomUUID()
    const protectedDirectory = path.join(destinationParent, "protected-foreign-directory")
    await fs.mkdir(protectedDirectory)
    await fs.writeFile(path.join(protectedDirectory, "owner.txt"), "foreign")
    const database = ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id)
    await PromotionJournal.record({
      operationID,
      projectID: anonymous.project.id,
      projectGeneration: database.project.generation,
      source: anonymous.directory,
      physicalSource,
      quarantine: protectedDirectory,
      staging: path.join(destinationParent, `.opencorvus-promoting-${operationID}`),
      destination: path.join(destinationParent, "invalid-path-entry"),
      name: "invalid-path-entry",
      sourceDigest: await PromotionJournal.digestDirectory(physicalSource),
      database,
      time_created: Date.now(),
    })

    const recovered = await ImplicitProject.recoverPromotions()
    expect({
      failure: recovered.failures[0],
      protectedContent: await fs.readFile(path.join(protectedDirectory, "owner.txt"), "utf8"),
    }).toEqual({
      failure: expect.stringContaining("path ownership"),
      protectedContent: "foreign",
    })
    await PromotionJournal.settle(operationID, "rolled_back", { reason: "invalid path test cleanup" })
  }, 60_000)

  test("a completed promotion leaves no journal entry", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
    const promoted = await Instance.provide({
      directory: anonymous.directory,
      fn: () =>
        ImplicitProject.promote({
          project: anonymous.project,
          name: "fully-promoted",
          destinationParent,
        }),
    })
    expect({
      directory: promoted.directory,
      journal: await PromotionJournal.get(anonymous.project.id),
      worktree: Project.get(anonymous.project.id)?.worktree,
    }).toEqual({
      directory: path.join(destinationParent, "fully-promoted"),
      journal: undefined,
      worktree: path.join(destinationParent, "fully-promoted"),
    })
  }, 60_000)

  test("a lost terminal write keeps the destination mapping fenced until exact recovery commits", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
    const destination = path.join(destinationParent, "live-destination")

    // A real promotion whose terminal settle is lost. The Project mapping is
    // already destination but remains fenced from publication until recovery.
    const settle = spyOn(PromotionJournal, "settle").mockRejectedValueOnce(new Error("injected settle loss"))
    try {
      await Instance.provide({
        directory: anonymous.directory,
        fn: () => ImplicitProject.promote({ project: anonymous.project, name: "live-destination", destinationParent }),
      }).catch(() => undefined)
    } finally {
      settle.mockRestore()
    }
    const open = await PromotionJournal.get(anonymous.project.id)
    expect({
      operationID: open?.operationID,
      databaseWorktree: ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id).project
        .worktree,
    }).toEqual({
      operationID: expect.any(String),
      databaseWorktree: destination,
    })
    await fs.writeFile(path.join(destination, "live-change.txt"), "written after database relocation")

    const recovered = await ImplicitProject.recoverPromotionJournalEntry(anonymous.project.id)
    expect({
      recovered,
      worktree: Project.get(anonymous.project.id)?.worktree,
      journal: await PromotionJournal.get(anonymous.project.id),
      receipt: await PromotionJournal.terminal(open!.operationID),
      liveContent: await fs.readFile(path.join(destination, "live-change.txt"), "utf8"),
    }).toEqual({
      recovered: "forward",
      worktree: destination,
      journal: undefined,
      receipt: expect.objectContaining({ occurrenceID: open!.operationID, outcome: "committed" }),
      liveContent: "written after database relocation",
    })
  }, 60_000)

  test("a foreign Project generation is reported as an unreconciled promotion occurrence", async () => {
    await using _anchor = await memoryProject()
    const anonymous = await ImplicitProject.create()
    const operationID = randomUUID()
    const physicalSource = await fs.realpath(anonymous.directory)
    const destinationParent = path.join(Global.Path.data, "promotion-recovery-destinations")
    await fs.mkdir(destinationParent, { recursive: true })
    const destination = path.join(destinationParent, "foreign-generation")
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${operationID}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${operationID}`)

    await PromotionJournal.record({
      operationID,
      projectID: anonymous.project.id,
      projectGeneration: randomUUID(),
      source: anonymous.directory,
      physicalSource,
      quarantine,
      staging,
      destination,
      name: "foreign-generation",
      sourceDigest: await PromotionJournal.digestDirectory(physicalSource),
      database: ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id),
      time_created: Date.now(),
    })

    const recovered = await ImplicitProject.recoverPromotions()
    expect({
      recovered,
      openOperation: (await PromotionJournal.get(anonymous.project.id))?.operationID,
      sourceExists: await Filesystem.exists(physicalSource),
    }).toEqual({
      recovered: {
        forward: 0,
        backward: 0,
        failures: [expect.stringContaining("Project generation mismatch")],
      },
      openOperation: operationID,
      sourceExists: true,
    })

    await PromotionJournal.settle(operationID, "rolled_back", { reason: "test generation fence cleanup" })
  }, 60_000)
})
