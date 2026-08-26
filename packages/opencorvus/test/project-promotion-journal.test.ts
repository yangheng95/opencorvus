import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Instance } from "../src/project/instance"
import { ImplicitProject } from "../src/project/implicit-project"
import { PromotionJournal } from "../src/project/promotion-journal"
import { Project } from "../src/project/project"
import { ProjectTable } from "../src/project/project.sql"
import { Session } from "../src/session"
import { SessionTable } from "../src/session/session.sql"
import { Database, eq } from "../src/storage/db"
import { Filesystem } from "../src/util/filesystem"
import { Global } from "../src/global"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("anonymous Project promotion journal", () => {
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
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${randomUUID()}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${randomUUID()}`)
    const operationID = randomUUID()
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
    const quarantine = path.join(
      path.dirname(physicalSource),
      `.${path.basename(physicalSource)}.promoting-${randomUUID()}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${randomUUID()}`)
    const operationID = randomUUID()
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
      `.${path.basename(physicalSource)}.promoting-${randomUUID()}`,
    )
    const staging = path.join(destinationParent, `.opencorvus-promoting-${randomUUID()}`)

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
