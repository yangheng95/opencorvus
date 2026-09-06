import { afterEach, describe, expect, spyOn, test } from "bun:test"
import * as fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Instance } from "../src/project/instance"
import { ImplicitProject } from "../src/project/implicit-project"
import { PromotionJournal } from "../src/project/promotion-journal"
import { Project } from "../src/project/project"
import { ProjectDirectoryAdmission } from "../src/project/directory-admission"
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
import { Identifier } from "../src/id/id"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function removeRuntimeRootAfterWindowsContention(target: string) {
  const deadline = Date.now() + 30_000
  while (true) {
    try {
      await fs.rm(target, { recursive: true, force: true })
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EBUSY" || Date.now() >= deadline) throw error
      await Bun.sleep(250)
    }
  }
}

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
    const physicalDestination = await fs.realpath(path.join(destinationParent, "terminal-recovered"))
    expect({
      recovered: recovered.recovered,
      worktree: recovered.project?.worktree,
      destinationExists: await Filesystem.exists(path.join(destinationParent, "terminal-recovered")),
    }).toEqual({
      recovered: { forward: 1, backward: 0, failures: [] },
      worktree: physicalDestination,
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

  test("backward recovery keeps restored source closed to creation reclamation across file-lock compromise", async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "promotion-source-admission-"))
    const destinationParent = path.join(runtimeRoot, "destinations")
    const promotionFixture = path.join(import.meta.dir, "fixture", "project-promotion-child.ts")
    const creationFixture = path.join(import.meta.dir, "fixture", "implicit-project-creation-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    const start = (fixture: string, args: string[]) =>
      Bun.spawn([process.execPath, fixture, ...args], {
        cwd: path.join(import.meta.dir, ".."),
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
    const collect = async (child: ReturnType<typeof start>) => {
      const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
      const stderr = await new Response(child.stderr).text()
      const last = stdout.trim().split(/\r?\n/).at(-1)
      return { exitCode, value: exitCode === 0 && last ? JSON.parse(last) : undefined, stderr }
    }
    const waitForFile = async (target: string) => {
      const deadline = Date.now() + 30_000
      while (!(await Filesystem.exists(target))) {
        if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
        await Bun.sleep(10)
      }
    }

    try {
      const setup = await collect(start(promotionFixture, ["setup-backward-window", "-", destinationParent]))
      expect(setup.exitCode).toBe(0)
      const prepared = setup.value as { projectID: string; source: string; destination: string }
      const recoveryInside = path.join(runtimeRoot, "recovery-inside")
      const recoveryRelease = path.join(runtimeRoot, "recovery-release")
      const recovery = start(promotionFixture, [
        "recover-held",
        prepared.projectID,
        destinationParent,
        recoveryInside,
        recoveryRelease,
      ])
      await waitForFile(recoveryInside)

      // Simulate the concrete proper-lockfile compromise: a peer can enter the
      // callback while the original callback is still alive. SQLite admission,
      // rather than that queue lock, remains the destructive safety authority.
      await fs.rm(path.join(runtimeRoot, "data", "project-directory-admission.json.lock"), {
        recursive: true,
        force: true,
      })
      const refused = await collect(start(creationFixture, ["converge"]))
      expect({
        exitCode: refused.exitCode,
        failure: refused.value?.result.failures[0],
        sourceState: (await Filesystem.exists(prepared.source)) ? "protected" : "removed",
      }).toEqual({
        exitCode: 0,
        failure: expect.stringContaining("is owned by promotion_restore operation"),
        sourceState: "protected",
      })

      await fs.writeFile(recoveryRelease, "release")
      await collect(recovery)
      const converged = await collect(start(creationFixture, ["converge"]))
      const inspected = await collect(start(creationFixture, ["inspect"]))
      const project = inspected.value?.projects.find((candidate: { id: string }) => candidate.id === prepared.projectID)
      expect({
        convergence: converged.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        sourceState: (await Filesystem.exists(prepared.source)) ? "owned" : "removed",
        destinationState: (await Filesystem.exists(prepared.destination)) ? "published" : "absent",
        worktree: project?.worktree,
        openCreations: inspected.value?.open.length,
        openAdmissions: inspected.value?.admissions.length,
      }).toEqual({
        convergence: ["project_exists"],
        sourceState: "owned",
        destinationState: "absent",
        worktree: prepared.source,
        openCreations: 0,
        openAdmissions: 0,
      })
    } finally {
      await fs.rm(runtimeRoot, { recursive: true, force: true })
    }
  }, 120_000)

  test("forward promotion refuses a destination under active parent reclamation after file-lock compromise", async () => {
    const runtimeRoot = await fs.mkdtemp(
      path.join(path.dirname(Global.Path.temporary), "promotion-destination-admission-"),
    )
    const destinationParent = path.join(runtimeRoot, "destinations")
    const promotionFixture = path.join(import.meta.dir, "fixture", "project-promotion-child.ts")
    const creationFixture = path.join(import.meta.dir, "fixture", "implicit-project-creation-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    const start = (fixture: string, args: string[]) =>
      Bun.spawn([process.execPath, fixture, ...args], {
        cwd: path.join(import.meta.dir, ".."),
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
    const collect = async (child: ReturnType<typeof start>) => {
      const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
      const stderr = await new Response(child.stderr).text()
      const last = stdout.trim().split(/\r?\n/).at(-1)
      return { exitCode, value: exitCode === 0 && last ? JSON.parse(last) : undefined, stderr }
    }
    const waitForFile = async (target: string) => {
      const deadline = Date.now() + 30_000
      while (!(await Filesystem.exists(target))) {
        if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
        await Bun.sleep(10)
      }
    }

    try {
      const setup = await collect(start(promotionFixture, ["setup", "-", destinationParent]))
      expect(setup.exitCode).toBe(0)
      const source = setup.value as { projectID: string; source: string }
      const intent = await collect(start(creationFixture, ["prepare-intent"]))
      expect(intent.exitCode).toBe(0)
      const destination = intent.value.directory as string
      const reclaimInside = path.join(runtimeRoot, "reclaim-inside")
      const reclaimRelease = path.join(runtimeRoot, "reclaim-release")
      const reclaimer = start(creationFixture, ["converge-held", reclaimInside, reclaimRelease])
      await waitForFile(reclaimInside)
      await fs.rm(path.join(runtimeRoot, "data", "project-directory-admission.json.lock"), {
        recursive: true,
        force: true,
      })

      const promotion = await collect(
        start(promotionFixture, ["promote", source.projectID, path.dirname(destination), path.basename(destination)]),
      )
      const beforeRelease = await collect(start(promotionFixture, ["inspect", source.projectID, destinationParent]))
      expect({
        promotion: promotion.exitCode === 0 ? "accepted" : "refused",
        sourceState: (await Filesystem.exists(source.source)) ? "owned" : "removed",
        destinationState: (await Filesystem.exists(destination)) ? "published" : "absent",
        worktree: beforeRelease.value?.project.worktree,
        promotionFences: beforeRelease.value?.promotionFences.length,
      }).toEqual({
        promotion: "refused",
        sourceState: "owned",
        destinationState: "absent",
        worktree: source.source,
        promotionFences: 0,
      })

      await fs.writeFile(reclaimRelease, "release")
      await collect(reclaimer)
      const inspected = await collect(start(creationFixture, ["inspect"]))
      expect({
        openCreations: inspected.value?.open.length,
        openAdmissions: inspected.value?.admissions.length,
      }).toEqual({ openCreations: 0, openAdmissions: 0 })
    } finally {
      await fs.rm(runtimeRoot, { recursive: true, force: true })
    }
  }, 120_000)

  test("startup takes over and releases destination and workspace admissions after promotion owner death", async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "promotion-admission-death-"))
    const destinationParent = path.join(runtimeRoot, "destinations")
    const promotionFixture = path.join(import.meta.dir, "fixture", "project-promotion-child.ts")
    const creationFixture = path.join(import.meta.dir, "fixture", "implicit-project-creation-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    const start = (fixture: string, args: string[]) =>
      Bun.spawn([process.execPath, fixture, ...args], {
        cwd: path.join(import.meta.dir, ".."),
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
    const collect = async (child: ReturnType<typeof start>) => {
      const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
      const stderr = await new Response(child.stderr).text()
      const last = stdout.trim().split(/\r?\n/).at(-1)
      return { exitCode, value: exitCode === 0 && last ? JSON.parse(last) : undefined, stderr }
    }
    const waitForFile = async (target: string) => {
      const deadline = Date.now() + 30_000
      while (!(await Filesystem.exists(target))) {
        if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
        await Bun.sleep(10)
      }
    }

    try {
      const setup = await collect(start(promotionFixture, ["setup", "-", destinationParent]))
      expect(setup.exitCode).toBe(0)
      const prepared = setup.value as { projectID: string; source: string }
      const started = path.join(runtimeRoot, "admissions-owned")
      const neverReleased = path.join(runtimeRoot, "never-release")
      const killed = start(promotionFixture, [
        "promote-held-admission",
        prepared.projectID,
        destinationParent,
        "recovered-admission",
        started,
        neverReleased,
      ])
      await waitForFile(started)
      killed.kill()
      await collect(killed)
      const before = await collect(start(creationFixture, ["inspect"]))
      expect(before.value?.admissions.map((row: { kind: string }) => row.kind).sort()).toEqual([
        "promotion_publish",
        "promotion_workspace",
        "promotion_workspace",
      ])

      const recovery = await collect(start(promotionFixture, ["recover", prepared.projectID, destinationParent]))
      const after = await collect(start(creationFixture, ["inspect"]))
      expect({
        recovery: recovery.value?.recovered,
        worktree: recovery.value?.project.worktree,
        sourceState: (await Filesystem.exists(prepared.source)) ? "owned" : "removed",
        admissionCount: after.value?.admissions.length,
      }).toEqual({
        recovery: { forward: 0, backward: 1, failures: [] },
        worktree: prepared.source,
        sourceState: "owned",
        admissionCount: 0,
      })
    } finally {
      await fs.rm(runtimeRoot, { recursive: true, force: true })
    }
  }, 120_000)

  test("prepared promotion workspace admissions refuse durable sandbox ownership before cleanup", async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "promotion-workspace-owner-"))
    const destinationParent = path.join(runtimeRoot, "destinations")
    const promotionFixture = path.join(import.meta.dir, "fixture", "project-promotion-child.ts")
    const creationFixture = path.join(import.meta.dir, "fixture", "implicit-project-creation-child.ts")
    const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    const start = (fixture: string, args: string[]) =>
      Bun.spawn([process.execPath, fixture, ...args], {
        cwd: path.join(import.meta.dir, ".."),
        env,
        stdout: "pipe",
        stderr: "pipe",
      })
    const collect = async (child: ReturnType<typeof start>) => {
      const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
      const stderr = await new Response(child.stderr).text()
      const last = stdout.trim().split(/\r?\n/).at(-1)
      return { exitCode, value: exitCode === 0 && last ? JSON.parse(last) : undefined, stderr }
    }
    const waitForFile = async (target: string) => {
      const deadline = Date.now() + 30_000
      while (!(await Filesystem.exists(target))) {
        if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
        await Bun.sleep(10)
      }
    }

    try {
      const setup = await collect(start(promotionFixture, ["setup", "-", destinationParent]))
      expect(setup.exitCode).toBe(0)
      const prepared = setup.value as { projectID: string; source: string }
      const started = path.join(runtimeRoot, "prepared")
      const release = path.join(runtimeRoot, "prepared-release")
      const promotion = start(promotionFixture, [
        "promote-held-prepared",
        prepared.projectID,
        destinationParent,
        "workspace-protected",
        started,
        release,
      ])
      await waitForFile(started)
      const inspected = await collect(start(creationFixture, ["inspect"]))
      const workspaces = inspected.value?.admissions
        .filter((row: { kind: string }) => row.kind === "promotion_workspace")
        .map((row: { directory: string }) => row.directory)
        .sort() as string[]
      expect(workspaces).toHaveLength(2)
      const outcomes = []
      for (const [index, workspace] of workspaces.entries()) {
        const queued = path.join(runtimeRoot, `workspace-${index}-queued`)
        const registration = await collect(
          start(creationFixture, ["sandbox-register", prepared.projectID, workspace, queued]),
        )
        outcomes.push({
          outcome: registration.value?.outcome,
          errorName: registration.value?.errorName,
          errorMessage: registration.value?.errorMessage,
        })
      }
      expect(outcomes).toEqual([
        {
          outcome: "registration_refused",
          errorName: "ProjectDirectoryAdmissionClosedError",
          errorMessage: expect.any(String),
        },
        {
          outcome: "registration_refused",
          errorName: "ProjectDirectoryAdmissionClosedError",
          errorMessage: expect.any(String),
        },
      ])

      await fs.writeFile(release, "release")
      const completed = await collect(promotion)
      const after = await collect(start(creationFixture, ["inspect"]))
      expect({
        promotion: completed.exitCode === 0 ? "committed" : "failed",
        destinationState: (await Filesystem.exists(path.join(destinationParent, "workspace-protected")))
          ? "owned"
          : "missing",
        admissionCount: after.value?.admissions.length,
      }).toEqual({ promotion: "committed", destinationState: "owned", admissionCount: 0 })
    } finally {
      await removeRuntimeRootAfterWindowsContention(runtimeRoot)
    }
  }, 120_000)

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
          expectedWorktree: anonymous.directory,
          worktree: destination,
          name: "database-was-forward",
          sandboxes: [],
          directoryAdmission: destinationAdmission.token,
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

  test("restores a logical Project path under the admission's physical directory key", async () => {
    await using anchor = await memoryProject()
    const physicalSource = path.join(anchor.path, "physical-source")
    const logicalSource = path.join(path.dirname(anchor.path), `${path.basename(anchor.path)}-source-alias`)
    const destination = path.join(anchor.path, "published-destination")
    await fs.mkdir(physicalSource)
    await fs.mkdir(destination)
    await fs.symlink(physicalSource, logicalSource, process.platform === "win32" ? "junction" : "dir")

    const projectID = Identifier.ascending("project")
    const projectGeneration = randomUUID()
    const operationID = randomUUID()
    const timeUpdated = Date.now() - 1_000
    Database.use((db) =>
      db
        .insert(ProjectTable)
        .values({
          id: projectID,
          generation: projectGeneration,
          worktree: destination,
          sandboxes: [],
          time_created: timeUpdated,
          time_updated: timeUpdated,
        })
        .run(),
    )
    Database.immediateTransaction((db) => {
      const project = db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get()!
      ensureProjectPromotionFenceInTransaction(db, { project, operationID })
    })

    try {
      const admission = await ProjectDirectoryAdmission.acquire({
        directory: physicalSource,
        operationID,
        kind: "promotion_restore",
      })
      if (admission.outcome === "owned") throw new Error("fixture source unexpectedly Project-owned")
      ProjectDirectoryAdmission.settle(admission.token, (db) => {
        Project.beginPromotionCommit({ projectID, operationID, expectedGeneration: projectGeneration }, db)
        Project.restoreRelocation(
          {
            projectID,
            operationID,
            expectedGeneration: projectGeneration,
            expectedWorktree: destination,
            worktree: logicalSource,
            name: null,
            sandboxes: [],
            timeUpdated,
            directoryAdmission: admission.token,
          },
          db,
        )
        Project.finishPromotionCommit({ projectID, operationID, expectedGeneration: projectGeneration }, db)
      })

      expect({
        worktree: Database.use((db) =>
          db.select({ worktree: ProjectTable.worktree }).from(ProjectTable).where(eq(ProjectTable.id, projectID)).get(),
        )?.worktree,
        logicalKey: await ProjectDirectoryAdmission.key(logicalSource),
        physicalKey: await ProjectDirectoryAdmission.key(physicalSource),
      }).toEqual({
        worktree: logicalSource,
        logicalKey: await ProjectDirectoryAdmission.key(physicalSource),
        physicalKey: await ProjectDirectoryAdmission.key(physicalSource),
      })
    } finally {
      await fs.unlink(logicalSource).catch(() => undefined)
    }
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
    const physicalDestination = await fs.realpath(path.join(destinationParent, "fully-promoted"))
    expect({
      directory: promoted.directory,
      journal: await PromotionJournal.get(anonymous.project.id),
      worktree: Project.get(anonymous.project.id)?.worktree,
    }).toEqual({
      directory: physicalDestination,
      journal: undefined,
      worktree: physicalDestination,
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
    const physicalDestination = await fs.realpath(destination)
    const open = await PromotionJournal.get(anonymous.project.id)
    expect({
      operationID: open?.operationID,
      databaseWorktree: ImplicitProject.PromotionTestHooks.promotionDatabaseSnapshot(anonymous.project.id).project
        .worktree,
    }).toEqual({
      operationID: expect.any(String),
      databaseWorktree: physicalDestination,
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
      worktree: physicalDestination,
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
