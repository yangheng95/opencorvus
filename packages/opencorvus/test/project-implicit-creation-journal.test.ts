import { afterEach, describe, expect, spyOn, test } from "bun:test"
import * as fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"
import { Instance } from "../src/project/instance"
import { ImplicitProjectCreation } from "../src/project/implicit-project-creation"
import { ImplicitProject } from "../src/project/implicit-project"
import { Global } from "../src/global"
import { Filesystem } from "../src/util/filesystem"
import { Project } from "../src/project/project"
import { ProjectDirectoryAdmissionTable } from "../src/project/project.sql"
import { Database } from "../src/storage/db"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const FIXTURE = path.join(import.meta.dir, "fixture", "implicit-project-creation-child.ts")
const CWD = path.join(import.meta.dir, "..")

async function isolatedRuntimeRoot(label: string) {
  const root = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), label))
  const env = { ...process.env, OPENCORVUS_HOME: root }
  delete env.OPENCORVUS_TEST_HOME
  delete env.OPENCORVUS_TEST_PROCESS_ROOT
  return { root, env, store: new DurablePublicationStore(path.join(root, "data", "durable-publications")) }
}

function startChild(env: NodeJS.ProcessEnv, args: string[]) {
  return Bun.spawn([process.execPath, FIXTURE, ...args], { cwd: CWD, env, stdout: "pipe", stderr: "pipe" })
}

async function collectChild(child: ReturnType<typeof startChild>) {
  const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()])
  const stderr = await new Response(child.stderr).text()
  const last = stdout.trim().split(/\r?\n/).at(-1)
  return { exitCode, value: exitCode === 0 && last ? JSON.parse(last) : undefined, stderr }
}

async function runChild(env: NodeJS.ProcessEnv, args: string[]) {
  return collectChild(startChild(env, args))
}

async function waitForFile(target: string) {
  const deadline = Date.now() + 30_000
  while (!(await Filesystem.exists(target))) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
    await Bun.sleep(10)
  }
}

/**
 * Forcing `dead_or_reused` applies to every open occurrence in this root, not
 * just the one under test, and the decision it feeds is a recursive delete. So
 * sole occupancy is a checked precondition of any forced sweep: if an earlier
 * test or a concurrent suite left an occurrence open here, the forced sweep
 * would reclaim its directory too, and this fails loudly instead.
 */
async function expectSoleOpenOccurrence(directory: string) {
  const open = await new DurablePublicationStore(path.join(Global.Path.data, "durable-publications")).listOpen(
    "implicit-project-creation",
  )
  expect(open.map((entry) => entry.intent.occurrenceID)).toEqual([path.basename(directory)])
}

/** An anonymous-root directory this test alone owns. */
function ownDirectory() {
  return path.join(Global.Path.data, "projects", "2026", "08", "27", randomUUID())
}

/**
 * The in-process cases share the real publication root with every other suite
 * that uses this test home, so they assert on their own occurrence rather than
 * on the whole sweep: an unrelated open occurrence must not decide whether
 * this contract holds.
 */
function forDirectory(result: ImplicitProjectCreation.ConvergeResult, directory: string) {
  return {
    reclaimed: result.reclaimed.filter((entry) => entry === directory),
    retained: result.retained
      .filter((entry) => entry.directory === directory)
      .map(({ directory: entryDirectory, reason }) => ({ directory: entryDirectory, reason })),
  }
}

function prepareProjectFor(resolve: (directory: string, transaction?: unknown) => string | undefined) {
  return async (directory: string) => ({
    findOwner: () => {
      const projectID = resolve(directory)
      return projectID ? { projectID, relation: "worktree_exact" as const } : undefined
    },
    revalidatePhysical: async () => undefined,
  })
}

describe("anonymous Project creation journal", () => {
  test("a creation killed before its directory exists is reclaimed by the next backend", async () => {
    const { root, env, store } = await isolatedRuntimeRoot("implicit-create-intent-")
    try {
      // The intent is durable before `mkdir`, so the child dies owning a
      // recorded directory that was never created.
      const killed = await runChild(env, ["create-cut", "occurrence-published", "1"])
      expect(killed.exitCode).not.toBe(0)

      const open = await store.listOpen("implicit-project-creation")
      expect(open.length).toBe(1)
      const directory = (open[0]!.intent.payload as { directory: string }).directory
      expect(await Filesystem.exists(directory)).toBe(false)

      const converged = await runChild(env, ["converge"])
      expect(converged.exitCode).toBe(0)
      expect({
        reclaimed: converged.value.result.reclaimed,
        retained: converged.value.result.retained,
        openAfter: converged.value.after.length,
      }).toEqual({ reclaimed: [directory], retained: [], openAfter: 0 })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("a creation killed with its directory on disk but no Project row has that directory removed", async () => {
    const { root, env, store } = await isolatedRuntimeRoot("implicit-create-dir-")
    try {
      // `directory_created` is the first phase, so the second phase-published
      // cut cannot fire before the directory exists; the first one leaves a
      // real directory behind with no git identity and no Project row.
      const killed = await runChild(env, ["create-cut", "phase-published", "1"])
      expect(killed.exitCode).not.toBe(0)

      const open = await store.listOpen("implicit-project-creation")
      expect(open.length).toBe(1)
      const directory = (open[0]!.intent.payload as { directory: string }).directory
      expect({
        phases: open[0]!.phases.map((phase) => phase.name),
        directoryExists: await Filesystem.exists(directory),
        gitExists: await Filesystem.exists(path.join(directory, ".git")),
      }).toEqual({ phases: ["directory_created"], directoryExists: true, gitExists: false })

      const converged = await runChild(env, ["converge"])
      expect(converged.exitCode).toBe(0)
      expect({
        reclaimed: converged.value.result.reclaimed,
        stillExists: converged.value.reclaimedStillExist,
        openAfter: converged.value.after.length,
        removed: await Filesystem.exists(directory),
      }).toEqual({ reclaimed: [directory], stillExists: [false], openAfter: 0, removed: false })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("an ordinary creation commits its receipt and leaves no open occurrence", async () => {
    const { root, env, store } = await isolatedRuntimeRoot("implicit-create-ok-")
    try {
      const created = await runChild(env, ["create"])
      expect(created.exitCode).toBe(0)
      expect({
        directoryExists: await Filesystem.exists(created.value.directory),
        gitExists: await Filesystem.exists(path.join(created.value.directory, ".git")),
        open: (await store.listOpen("implicit-project-creation")).length,
      }).toEqual({ directoryExists: true, gitExists: true, open: 0 })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("recovery recognizes a committed Project while promotion hides it from the public listing", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-promoting-project-")
    try {
      const prepared = await runChild(env, ["prepare-committed-fenced"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const converged = await runChild(env, ["converge"])
      expect({
        recovery: converged.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        journalState: converged.value?.after.length === 0 ? "settled" : "open",
      }).toEqual({ recovery: ["project_exists"], directoryState: "owned", journalState: "settled" })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("recovery recognizes durable sandbox ownership of an anonymous directory", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-sandbox-owner-")
    try {
      const prepared = await runChild(env, ["prepare-sandbox-owned"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const converged = await runChild(env, ["converge"])
      expect({
        recovery: converged.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        journalState: converged.value?.after.length === 0 ? "settled" : "open",
      }).toEqual({ recovery: ["project_overlap"], directoryState: "owned", journalState: "open" })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("recovery recognizes an owned child whose legal name begins with two dots", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-dotdot-child-owner-")
    try {
      const prepared = await runChild(env, ["prepare-dotdot-nested-owned"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const converged = await runChild(env, ["converge"])
      expect({
        recovery: converged.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        parentState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        childState: (await Filesystem.exists(prepared.value.registeredDirectory)) ? "owned" : "reclaimed",
        journalState: converged.value?.after.length === 0 ? "settled" : "open",
      }).toEqual({
        recovery: ["project_overlap"],
        parentState: "owned",
        childState: "owned",
        journalState: "open",
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("recovery resolves a durable alias to physical ownership inside the reclaimed parent", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-physical-alias-owner-")
    try {
      const prepared = await runChild(env, ["prepare-alias-owned"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const converged = await runChild(env, ["converge"])
      expect({
        recovery: converged.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        parentState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        physicalState: (await Filesystem.exists(prepared.value.physicalRegisteredDirectory)) ? "owned" : "reclaimed",
        aliasState: (await Filesystem.exists(prepared.value.registeredDirectory)) ? "owned" : "broken",
      }).toEqual({
        recovery: ["project_overlap"],
        parentState: "owned",
        physicalState: "owned",
        aliasState: "owned",
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("reclamation revalidates a registered junction retargeted after durable admission", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-alias-retarget-")
    try {
      const prepared = await runChild(env, ["prepare-dead"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string

      const ownerDirectory = path.join(root, "owner")
      const ownerStarted = path.join(root, "owner-started")
      const ownerRelease = path.join(root, "owner-release")
      await fs.mkdir(ownerDirectory, { recursive: true })
      await fs.writeFile(ownerRelease, "release")
      const registered = await runChild(env, ["register-held", ownerDirectory, ownerStarted, ownerRelease])
      expect(registered.value?.outcome).toBe("registered")

      const outside = path.join(root, "outside")
      const alias = path.join(root, "aliases", "retargetable")
      await fs.mkdir(outside, { recursive: true })
      const initialized = Bun.spawnSync(["git", "init"], { cwd: outside, stdout: "pipe", stderr: "pipe" })
      expect(initialized.exitCode).toBe(0)
      await fs.mkdir(path.dirname(alias), { recursive: true })
      await fs.symlink(outside, alias, "junction")
      const sandboxQueued = path.join(root, "sandbox-queued")
      const sandbox = await runChild(env, ["sandbox-register", registered.value.projectID, alias, sandboxQueued])
      expect(sandbox.value?.outcome).toBe("registered")

      const reclaimStarted = path.join(root, "reclaim-started")
      const reclaimRelease = path.join(root, "reclaim-release")
      const reclamation = startChild(env, ["converge-held", reclaimStarted, reclaimRelease])
      await waitForFile(reclaimStarted)
      await fs.rm(alias, { recursive: true, force: true })
      await fs.symlink(directory, alias, "junction")
      await fs.writeFile(reclaimRelease, "release")

      const refused = await collectChild(reclamation)
      const afterRefusal = await runChild(env, ["inspect"])
      expect({
        failure: refused.value?.result.failures[0],
        directoryState: (await Filesystem.exists(directory)) ? "protected" : "removed",
        journalState: afterRefusal.value?.open.length === 0 ? "settled" : "open",
        admissionState: afterRefusal.value?.admissions.length === 0 ? "settled" : "open",
      }).toEqual({
        failure: expect.stringContaining("Physical Project directory ownership changed while admission was held"),
        directoryState: "protected",
        journalState: "open",
        admissionState: "settled",
      })

      const converged = await runChild(env, ["converge"])
      expect({
        retained: converged.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        directoryState: (await Filesystem.exists(directory)) ? "protected" : "removed",
        journalState: converged.value?.after.length === 0 ? "settled" : "open",
      }).toEqual({ retained: ["project_overlap"], directoryState: "protected", journalState: "open" })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("when registration owns directory admission first, reclamation preserves the committed Project", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-register-wins-")
    try {
      const prepared = await runChild(env, ["prepare-dead", "git"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const registrationInside = path.join(root, "registration-inside")
      const registrationRelease = path.join(root, "registration-release")
      const convergenceStarted = path.join(root, "convergence-started")

      const registrationProcess = startChild(env, ["register-held", directory, registrationInside, registrationRelease])
      await waitForFile(registrationInside)
      const convergenceProcess = startChild(env, ["converge", convergenceStarted])
      await waitForFile(convergenceStarted)
      await fs.writeFile(registrationRelease, "release")

      const [registration, convergence] = await Promise.all([
        collectChild(registrationProcess),
        collectChild(convergenceProcess),
      ])
      const inspected = await runChild(env, ["inspect"])
      expect({
        registration: registration.value?.outcome,
        convergence: convergence.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        projectWorktrees: inspected.value?.projects.map((project: { worktree: string }) => project.worktree),
        journalState: inspected.value?.open.length === 0 ? "settled" : "open",
      }).toEqual({
        registration: "registered",
        convergence: ["project_exists"],
        directoryState: "owned",
        projectWorktrees: [registration.value.directory],
        journalState: "settled",
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("registration generation prevents delete-then-stale-commit after file-lock compromise", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-registration-generation-")
    try {
      const prepared = await runChild(env, ["prepare-dead", "git"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const registrationInside = path.join(root, "registration-inside")
      const registrationRelease = path.join(root, "registration-release")
      const registrationCompromised = path.join(root, "registration-compromised")
      const registration = startChild(env, [
        "register-held",
        directory,
        registrationInside,
        registrationRelease,
        "",
        registrationCompromised,
      ])
      await waitForFile(registrationInside)
      await fs.rm(path.join(root, "data", "project-directory-admission.json.lock"), {
        recursive: true,
        force: true,
      })

      const refused = await runChild(env, ["converge"])
      expect({
        failure: refused.value?.result.failures[0],
        directoryState: (await Filesystem.exists(directory)) ? "protected" : "removed",
        journalState: refused.value?.after.length === 0 ? "settled" : "open",
      }).toEqual({
        failure: expect.stringContaining("is owned by registration operation"),
        directoryState: "protected",
        journalState: "open",
      })

      await Bun.sleep(12_000)
      await fs.writeFile(registrationRelease, "release")
      const registered = await collectChild(registration)
      const converged = await runChild(env, ["converge"])
      const inspected = await runChild(env, ["inspect"])
      expect({
        registration: registered.value?.outcome,
        queueCompromise: (await Filesystem.exists(registrationCompromised)) ? "observed" : "missing",
        convergence: converged.value?.result.retained.map((entry: { reason: string }) => entry.reason),
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "removed",
        admissionState: inspected.value?.admissions.length === 0 ? "settled" : "open",
      }).toEqual({
        registration: "registered",
        queueCompromise: "observed",
        convergence: ["project_exists"],
        directoryState: "owned",
        admissionState: "settled",
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("when reclamation owns directory admission first, a waiting backend observes the reclaimed directory", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-reclaim-wins-")
    try {
      const prepared = await runChild(env, ["prepare-dead", "git"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const reclaimInside = path.join(root, "reclaim-inside")
      const reclaimRelease = path.join(root, "reclaim-release")
      const registrationInside = path.join(root, "registration-inside")
      const registrationRelease = path.join(root, "registration-release")
      const registrationQueued = path.join(root, "registration-queued")
      await fs.writeFile(registrationRelease, "release")

      const convergenceProcess = startChild(env, ["converge-held", reclaimInside, reclaimRelease])
      await waitForFile(reclaimInside)
      const registrationProcess = startChild(env, [
        "register-held",
        directory,
        registrationInside,
        registrationRelease,
        registrationQueued,
      ])
      await waitForFile(registrationQueued)
      await fs.writeFile(reclaimRelease, "release")

      const [convergence, registration] = await Promise.all([
        collectChild(convergenceProcess),
        collectChild(registrationProcess),
      ])
      const inspected = await runChild(env, ["inspect"])
      expect({
        convergence: convergence.value?.result.reclaimed,
        registration: registration.value?.outcome,
        registrationError: registration.value?.errorName,
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        registryState: inspected.value?.projects.length === 0 ? "empty" : "owned",
        journalState: inspected.value?.open.length === 0 ? "settled" : "open",
      }).toEqual({
        convergence: [directory],
        registration: "directory_reclaimed",
        registrationError: "ProjectDirectoryIntegrityError",
        directoryState: "reclaimed",
        registryState: "empty",
        journalState: "settled",
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("durable reclamation authority survives a compromised file lock and refuses peer registration", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-compromised-lock-")
    try {
      const prepared = await runChild(env, ["prepare-dead", "git"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const reclaimInside = path.join(root, "reclaim-inside")
      const reclaimRelease = path.join(root, "reclaim-release")
      const registrationInside = path.join(root, "registration-inside")
      const registrationRelease = path.join(root, "registration-release")
      const registrationQueued = path.join(root, "registration-queued")
      await fs.writeFile(registrationRelease, "release")

      const convergenceProcess = startChild(env, ["converge-held", reclaimInside, reclaimRelease])
      await waitForFile(reclaimInside)
      await fs.rm(path.join(root, "data", "project-directory-admission.json.lock"), {
        recursive: true,
        force: true,
      })
      const registrationProcess = startChild(env, [
        "register-held",
        directory,
        registrationInside,
        registrationRelease,
        registrationQueued,
      ])
      await waitForFile(registrationQueued)
      const registration = await collectChild(registrationProcess)
      expect({
        contender: registration.value?.outcome,
        errorName: registration.value?.errorName,
        directoryState: (await Filesystem.exists(directory)) ? "protected" : "removed_early",
      }).toEqual({
        contender: "registration_refused",
        errorName: "ProjectDirectoryAdmissionClosedError",
        directoryState: "protected",
      })

      await fs.writeFile(reclaimRelease, "release")
      const convergence = await collectChild(convergenceProcess)
      const inspected = await runChild(env, ["inspect"])
      expect({
        reclaimerExit: convergence.exitCode,
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        registryState: inspected.value?.projects.length === 0 ? "empty" : "owned",
        admissionState: inspected.value?.admissions.length === 0 ? "settled" : "open",
        journalState: inspected.value?.open.length === 0 ? "settled" : "open",
      }).toEqual({
        reclaimerExit: 0,
        directoryState: "reclaimed",
        registryState: "empty",
        admissionState: "settled",
        journalState: "settled",
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("parent reclamation authority refuses nested worktree registration after file-lock compromise", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-parent-overlap-")
    try {
      const prepared = await runChild(env, ["prepare-dead-parent"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const nested = prepared.value.gitDirectory as string
      const reclaimInside = path.join(root, "reclaim-inside")
      const reclaimRelease = path.join(root, "reclaim-release")
      const registrationInside = path.join(root, "registration-inside")
      const registrationRelease = path.join(root, "registration-release")
      const registrationQueued = path.join(root, "registration-queued")
      await fs.writeFile(registrationRelease, "release")

      const convergenceProcess = startChild(env, ["converge-held", reclaimInside, reclaimRelease])
      await waitForFile(reclaimInside)
      await fs.rm(path.join(root, "data", "project-directory-admission.json.lock"), {
        recursive: true,
        force: true,
      })
      const registrationProcess = startChild(env, [
        "register-held",
        nested,
        registrationInside,
        registrationRelease,
        registrationQueued,
      ])
      await waitForFile(registrationQueued)
      const registration = await collectChild(registrationProcess)
      expect({
        contender: registration.value?.outcome,
        errorName: registration.value?.errorName,
        parentState: (await Filesystem.exists(directory)) ? "protected" : "removed_early",
      }).toEqual({
        contender: "registration_refused",
        errorName: "ProjectDirectoryAdmissionClosedError",
        parentState: "protected",
      })

      await fs.writeFile(reclaimRelease, "release")
      await collectChild(convergenceProcess)
      const inspected = await runChild(env, ["inspect"])
      expect({
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        registryState: inspected.value?.projects.length === 0 ? "empty" : "owned",
        admissionState: inspected.value?.admissions.length === 0 ? "settled" : "open",
      }).toEqual({ directoryState: "reclaimed", registryState: "empty", admissionState: "settled" })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("main-worktree reclamation refuses linked-worktree discovery after file-lock compromise", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-linked-main-overlap-")
    try {
      const prepared = await runChild(env, ["prepare-dead-linked"])
      expect(prepared).toMatchObject({ exitCode: 0 })
      const directory = prepared.value.directory as string
      const linked = prepared.value.linkedDirectory as string
      const reclaimInside = path.join(root, "reclaim-inside")
      const reclaimRelease = path.join(root, "reclaim-release")
      const registrationInside = path.join(root, "registration-inside")
      const registrationRelease = path.join(root, "registration-release")
      const registrationQueued = path.join(root, "registration-queued")
      await fs.writeFile(registrationRelease, "release")
      const reclaimer = startChild(env, ["converge-held", reclaimInside, reclaimRelease])
      await waitForFile(reclaimInside)
      await fs.rm(path.join(root, "data", "project-directory-admission.json.lock"), {
        recursive: true,
        force: true,
      })

      const registrar = startChild(env, [
        "register-held",
        linked,
        registrationInside,
        registrationRelease,
        registrationQueued,
      ])
      await waitForFile(registrationQueued)
      const refused = await collectChild(registrar)
      expect({
        outcome: refused.value?.outcome,
        errorName: refused.value?.errorName,
        mainState: (await Filesystem.exists(directory)) ? "protected" : "removed_early",
      }).toEqual({
        outcome: "registration_refused",
        errorName: "ProjectDirectoryAdmissionClosedError",
        mainState: "protected",
      })

      await fs.writeFile(reclaimRelease, "release")
      await collectChild(reclaimer)
      const inspected = await runChild(env, ["inspect"])
      expect({
        mainState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        registryState: inspected.value?.projects.length === 0 ? "empty" : "owned",
        admissionState: inspected.value?.admissions.length === 0 ? "settled" : "open",
      }).toEqual({ mainState: "reclaimed", registryState: "empty", admissionState: "settled" })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("durable reclamation authority refuses a sandbox writer after file-lock compromise", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-sandbox-race-")
    try {
      const prepared = await runChild(env, ["prepare-dead-and-owner"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const reclaimInside = path.join(root, "reclaim-inside")
      const reclaimRelease = path.join(root, "reclaim-release")
      const sandboxQueued = path.join(root, "sandbox-queued")
      const convergenceProcess = startChild(env, ["converge-held", reclaimInside, reclaimRelease])
      await waitForFile(reclaimInside)
      await fs.rm(path.join(root, "data", "project-directory-admission.json.lock"), {
        recursive: true,
        force: true,
      })
      const sandboxProcess = startChild(env, [
        "sandbox-register",
        prepared.value.ownerProjectID,
        directory,
        sandboxQueued,
      ])
      await waitForFile(sandboxQueued)
      const sandbox = await collectChild(sandboxProcess)
      expect({ writer: sandbox.value?.outcome, errorName: sandbox.value?.errorName }).toEqual({
        writer: "registration_refused",
        errorName: "ProjectDirectoryAdmissionClosedError",
      })

      await fs.writeFile(reclaimRelease, "release")
      await collectChild(convergenceProcess)
      const inspected = await runChild(env, ["inspect"])
      const owner = inspected.value?.projects.find(
        (project: { id: string }) => project.id === prepared.value.ownerProjectID,
      )
      expect({
        directoryState: (await Filesystem.exists(directory)) ? "owned" : "reclaimed",
        sandboxState: owner?.sandboxes.length === 0 ? "unregistered" : "registered",
        admissionState: inspected.value?.admissions.length === 0 ? "settled" : "open",
      }).toEqual({ directoryState: "reclaimed", sandboxState: "unregistered", admissionState: "settled" })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("a registrar rejects same-path replacement observed while it waited for admission", async () => {
    const { root, env } = await isolatedRuntimeRoot("implicit-create-directory-aba-")
    try {
      const prepared = await runChild(env, ["prepare-dead", "git"])
      expect(prepared.exitCode).toBe(0)
      const directory = prepared.value.directory as string
      const holderInside = path.join(root, "holder-inside")
      const holderRelease = path.join(root, "holder-release")
      const registrationInside = path.join(root, "registration-inside")
      const registrationRelease = path.join(root, "registration-release")
      const registrationQueued = path.join(root, "registration-queued")
      await fs.writeFile(registrationRelease, "release")
      const holder = startChild(env, ["hold-admission", holderInside, holderRelease])
      await waitForFile(holderInside)
      const registrationProcess = startChild(env, [
        "register-held",
        directory,
        registrationInside,
        registrationRelease,
        registrationQueued,
      ])
      await waitForFile(registrationQueued)

      await fs.rm(directory, { recursive: true, force: true })
      await fs.mkdir(directory, { recursive: true })
      const initialized = Bun.spawnSync(["git", "init"], { cwd: directory, stdout: "pipe", stderr: "pipe" })
      expect(initialized.exitCode).toBe(0)
      await fs.writeFile(holderRelease, "release")
      const [holderResult, registration] = await Promise.all([collectChild(holder), collectChild(registrationProcess)])
      expect({
        holder: holderResult.exitCode === 0 ? "released" : "failed",
        registrar: registration.value?.outcome,
        errorName: registration.value?.errorName,
      }).toEqual({
        holder: "released",
        registrar: "registration_refused",
        errorName: "ProjectDirectoryOccurrenceChangedError",
      })
      await runChild(env, ["converge"])
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 120_000)

  test("an undecidable compensation lookup retains an open recovery occurrence", async () => {
    let directory = ""
    using _compensation = ImplicitProject.TestHooks.installCreationCompensation({
      beforeLookup: (candidate) => {
        directory = candidate
        throw new Error("database lookup unavailable")
      },
    })
    const initialization = spyOn(Project, "initGit").mockImplementation(async () => {
      throw new Error("git initialization failed")
    })
    try {
      await expect(ImplicitProject.create()).rejects.toThrow("git initialization failed")
      const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
      const occurrence = (await store.listOpen("implicit-project-creation")).find(
        (entry) => (entry.intent.payload as { directory?: string }).directory === directory,
      )
      expect({
        compensationDecision: occurrence ? "deferred" : "lost",
        directoryState: (await Filesystem.exists(directory)) ? "retained" : "reclaimed",
      }).toEqual({ compensationDecision: "deferred", directoryState: "retained" })
    } finally {
      initialization.mockRestore()
      if (directory) {
        await ImplicitProjectCreation.rollback(path.basename(directory), "test cleanup")
        await fs.rm(directory, { recursive: true, force: true })
      }
    }
  })

  test("a failed compensation removal retains an open recovery occurrence", async () => {
    let directory = ""
    using _compensation = ImplicitProject.TestHooks.installCreationCompensation({
      beforeRemoval: (candidate) => {
        directory = candidate
        throw new Error("directory removal unavailable")
      },
    })
    const initialization = spyOn(Project, "initGit").mockImplementation(async () => {
      throw new Error("git initialization failed")
    })
    try {
      await expect(ImplicitProject.create()).rejects.toThrow("git initialization failed")
      const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
      const occurrence = (await store.listOpen("implicit-project-creation")).find(
        (entry) => (entry.intent.payload as { directory?: string }).directory === directory,
      )
      expect({
        compensationDecision: occurrence ? "deferred" : "lost",
        directoryState: (await Filesystem.exists(directory)) ? "retained" : "reclaimed",
      }).toEqual({ compensationDecision: "deferred", directoryState: "retained" })
    } finally {
      initialization.mockRestore()
      if (directory) {
        await ImplicitProjectCreation.rollback(path.basename(directory), "test cleanup")
        await fs.rm(directory, { recursive: true, force: true })
      }
    }
  })

  test("creation compensation preserves a nested Project and rethrows the initialization failure", async () => {
    let directory = ""
    let nestedProjectID = ""
    const initialization = spyOn(Project, "initGit").mockImplementation(async (candidate) => {
      directory = candidate
      const nested = path.join(candidate, "nested-owner")
      await fs.mkdir(nested, { recursive: true })
      nestedProjectID = (await Project.fromDirectory(nested)).project.id
      throw new Error("git initialization failed beside nested owner")
    })
    try {
      await expect(ImplicitProject.create()).rejects.toThrow("git initialization failed beside nested owner")
      const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
      const occurrence = (await store.listOpen("implicit-project-creation")).find(
        (entry) => (entry.intent.payload as { directory?: string }).directory === directory,
      )
      expect({
        directoryState: (await Filesystem.exists(directory)) ? "retained" : "reclaimed",
        journalState: occurrence ? "open" : "settled",
        nestedOwnerState: Project.get(nestedProjectID) ? "registered" : "missing",
      }).toEqual({ directoryState: "retained", journalState: "open", nestedOwnerState: "registered" })
    } finally {
      initialization.mockRestore()
      if (directory) {
        await ImplicitProjectCreation.rollback(path.basename(directory), "test cleanup")
        await fs.rm(directory, { recursive: true, force: true })
      }
    }
  })

  test("a Project row committed before an initialization tail failure is returned as business success", async () => {
    const initialize = Project.initGit
    let committed: Awaited<ReturnType<typeof Project.initGit>> | undefined
    const initialization = spyOn(Project, "initGit").mockImplementation(async (directory) => {
      committed = await initialize(directory)
      throw new Error("post-commit initialization tail failed")
    })
    let directory = ""
    try {
      const created = await ImplicitProject.create()
      directory = created.directory
      const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
      expect({
        outcome: created.project.id === committed?.project.id ? "canonical_project_returned" : "identity_changed",
        directoryState: (await Filesystem.exists(created.directory)) ? "owned" : "reclaimed",
        journalState: (await store.listOpen("implicit-project-creation")).some(
          (entry) => (entry.intent.payload as { directory?: string }).directory === created.directory,
        )
          ? "open"
          : "settled",
      }).toEqual({ outcome: "canonical_project_returned", directoryState: "owned", journalState: "settled" })
    } finally {
      initialization.mockRestore()
      if (directory) await fs.rm(directory, { recursive: true, force: true })
    }
  })

  test("a live owner's in-flight creation is never reclaimed, and an undecidable owner is left alone", async () => {
    const directory = ownDirectory()
    await fs.mkdir(directory, { recursive: true })
    const id = await ImplicitProjectCreation.begin(directory)
    await ImplicitProjectCreation.markDirectoryCreated(id)
    try {
      // The current process owns it, so a real observation is `exact_live`.
      const live = await ImplicitProjectCreation.converge({
        isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
        prepareProjectFor: prepareProjectFor(() => undefined),
      })
      expect({ ...forDirectory(live, directory), exists: await Filesystem.exists(directory) }).toEqual({
        reclaimed: [],
        retained: [{ directory, reason: "owner_live" }],
        exists: true,
      })

      // An owner whose liveness cannot be decided is a refusal, not a licence
      // to delete: only a provably gone owner releases a directory.
      const unknown = await ImplicitProjectCreation.converge({
        isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
        prepareProjectFor: prepareProjectFor(() => undefined),
        observe: () => "unknown_live",
      })
      expect({ ...forDirectory(unknown, directory), exists: await Filesystem.exists(directory) }).toEqual({
        reclaimed: [],
        retained: [{ directory, reason: "owner_unknown" }],
        exists: true,
      })
    } finally {
      await ImplicitProjectCreation.rollback(id, "test cleanup")
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  test("a dead owner whose Project row did commit keeps its directory and settles the receipt", async () => {
    const directory = ownDirectory()
    await fs.mkdir(directory, { recursive: true })
    const id = await ImplicitProjectCreation.begin(directory)
    await ImplicitProjectCreation.markDirectoryCreated(id)
    try {
      await expectSoleOpenOccurrence(directory)
      const converged = await ImplicitProjectCreation.converge({
        isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
        prepareProjectFor: prepareProjectFor((candidate) => (candidate === directory ? randomUUID() : undefined)),
        observe: () => "dead_or_reused",
      })
      expect({ ...forDirectory(converged, directory), exists: await Filesystem.exists(directory) }).toEqual({
        reclaimed: [],
        retained: [{ directory, reason: "project_exists" }],
        exists: true,
      })
    } finally {
      await ImplicitProjectCreation.rollback(id, "test cleanup")
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  test("physical alias ownership cannot be registered to a second Project", async () => {
    const root = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "project-physical-owner-conflict-"))
    try {
      const firstDirectory = path.join(root, "first")
      const secondDirectory = path.join(root, "second")
      const physical = path.join(root, "physical")
      const alias = path.join(root, "alias")
      await Promise.all([firstDirectory, secondDirectory, physical].map((directory) => fs.mkdir(directory)))
      await fs.symlink(physical, alias, "junction")
      const first = await Project.fromDirectory(firstDirectory)
      const second = await Project.fromDirectory(secondDirectory)
      await Project.addSandbox(first.project.id, alias)
      const conflict = await Project.addSandbox(second.project.id, physical).catch((error) => error)
      expect({
        errorName: conflict instanceof Error ? conflict.name : "none",
        firstSandboxes: Project.get(first.project.id)?.sandboxes,
        secondSandboxes: Project.get(second.project.id)?.sandboxes,
      }).toEqual({
        errorName: "ProjectRegisteredDirectoryConflictError",
        firstSandboxes: [path.resolve(alias)],
        secondSandboxes: [],
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("discovery of a registered nested execution directory admits one canonical worktree owner", async () => {
    const root = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "project-nested-discovery-"))
    try {
      const nested = path.join(root, "nested", "child")
      await fs.mkdir(nested, { recursive: true })
      const initialized = Bun.spawnSync(["git", "init"], { cwd: root, stdout: "pipe", stderr: "pipe" })
      expect(initialized.exitCode).toBe(0)

      const owner = await Project.fromDirectory(root)
      await Project.addSandbox(owner.project.id, nested)
      const discovered = await Project.fromDirectory(nested)
      const admissions = Database.use((db) => db.select().from(ProjectDirectoryAdmissionTable).all())
      expect({
        identity: discovered.project.id === owner.project.id ? "canonical" : "changed",
        worktree: Project.samePath(discovered.project.worktree, root) ? "canonical" : discovered.project.worktree,
        requestedDirectory: discovered.project.sandboxes.some((directory) => Project.samePath(directory, nested))
          ? "registered"
          : "missing",
        admissionState: admissions.length === 0 ? "settled" : "open",
      }).toEqual({
        identity: "canonical",
        worktree: "canonical",
        requestedDirectory: "registered",
        admissionState: "settled",
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("two sweeps racing the same dead owner both succeed", async () => {
    const directory = ownDirectory()
    await fs.mkdir(directory, { recursive: true })
    const id = await ImplicitProjectCreation.begin(directory)
    await ImplicitProjectCreation.markDirectoryCreated(id)
    const sweep = () =>
      ImplicitProjectCreation.converge({
        isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
        prepareProjectFor: prepareProjectFor(() => undefined),
        observe: () => "dead_or_reused",
      })
    await expectSoleOpenOccurrence(directory)
    // Two "new chat" requests after a crash both sweep. The loser settles an
    // occurrence that is already gone, which is the expected end of the race,
    // not a failure that should fail its caller's creation.
    const [first, second] = await Promise.all([sweep(), sweep()])
    // Both may report the directory: `fs.rm` is idempotent and settling an
    // already-settled occurrence is tolerated, so each sweep truthfully ends
    // with "this directory is gone and its occurrence is closed". What must
    // not happen is either sweep failing, or the loser being left with an
    // unsettled occurrence.
    expect({
      firstReclaimed: first.reclaimed.filter((entry) => entry === directory).length,
      secondReclaimed: second.reclaimed.filter((entry) => entry === directory).length,
      failures: [...first.failures, ...second.failures].filter((entry) => entry.includes(path.basename(directory))),
      exists: await Filesystem.exists(directory),
      stillOpen: (
        await new DurablePublicationStore(path.join(Global.Path.data, "durable-publications")).listOpen(
          "implicit-project-creation",
        )
      ).some((entry) => entry.intent.occurrenceID === path.basename(directory)),
    }).toEqual({ firstReclaimed: 1, secondReclaimed: 1, failures: [], exists: false, stillOpen: false })
  })

  test("an occurrence settled but never removed is swept, not left to be re-read forever", async () => {
    const directory = ownDirectory()
    const id = await ImplicitProjectCreation.begin(directory)
    // Exactly the state a process killed between the terminal write and its
    // removal leaves: `listOpen` filters it out, so only the settled sweep
    // finds it, while `list` keeps parsing it on every later creation.
    const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
    await store.settle("implicit-project-creation", {
      occurrenceID: id,
      outcome: "committed",
      payload: { projectID: randomUUID() },
      timeCreated: Date.now(),
    })
    expect((await store.list("implicit-project-creation")).some((entry) => entry.intent.occurrenceID === id)).toBe(true)
    // Settled, so nothing is open — the forced sweep below cannot reach any
    // other directory.
    expect(await store.listOpen("implicit-project-creation")).toEqual([])

    const converged = await ImplicitProjectCreation.converge({
      isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
      prepareProjectFor: prepareProjectFor(() => undefined),
      observe: () => "dead_or_reused",
    })
    expect({
      failures: converged.failures.filter((entry) => entry.includes(id)),
      remaining: (await store.list("implicit-project-creation")).some((entry) => entry.intent.occurrenceID === id),
    }).toEqual({ failures: [], remaining: false })
  })

  test("an occurrence directory left half-removed does not stop the sweep or the boot", async () => {
    const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
    // The residue below makes `listOpen` throw, so sole occupancy — the
    // precondition every forced sweep in this file needs — has to be taken
    // before it is planted rather than skipped.
    expect(await store.listOpen("implicit-project-creation")).toEqual([])
    const residue = await ImplicitProjectCreation.begin(ownDirectory())
    // Exactly what a backend killed inside `removeSettled`'s recursive delete
    // leaves: the intent already unlinked, the phases directory not. The
    // shared listing throws on this entry, and on the startup sweep that is a
    // listener that never binds and a backend nobody can boot again.
    await fs.mkdir(path.join(store.occurrenceDirectory("implicit-project-creation", residue), "phases"), {
      recursive: true,
    })
    await fs.rm(path.join(store.occurrenceDirectory("implicit-project-creation", residue), "intent.json"), {
      force: true,
    })
    await expect(store.list("implicit-project-creation")).rejects.toThrow()

    // A healthy occurrence beside the residue still has to be reached.
    const directory = ownDirectory()
    await fs.mkdir(directory, { recursive: true })
    const id = await ImplicitProjectCreation.begin(directory)
    await ImplicitProjectCreation.markDirectoryCreated(id)
    try {
      const converged = await ImplicitProjectCreation.converge({
        isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
        prepareProjectFor: prepareProjectFor(() => undefined),
        observe: () => "dead_or_reused",
      })
      expect({
        ...forDirectory(converged, directory),
        exists: await Filesystem.exists(directory),
        residueRemains: await Filesystem.exists(store.occurrenceDirectory("implicit-project-creation", residue)),
        listReadable: (await store.list("implicit-project-creation")).length >= 0,
      }).toEqual({ reclaimed: [directory], retained: [], exists: false, residueRemains: false, listReadable: true })
    } finally {
      await ImplicitProjectCreation.rollback(id, "test cleanup")
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  test("a stray file is ignored and an unreadable intent is refused, not reported forever", async () => {
    const store = new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
    expect(await store.listOpen("implicit-project-creation")).toEqual([])
    const kindDirectory = path.join(Global.Path.data, "durable-publications", "implicit-project-creation")
    await fs.mkdir(kindDirectory, { recursive: true })
    await fs.writeFile(path.join(kindDirectory, ".DS_Store"), "")

    // An intent whose payload this build cannot interpret. It may belong to a
    // writer this build does not understand, so it is refused rather than
    // settled — and refusing is not the same as failing.
    const unreadable = randomUUID()
    await store.create({
      occurrenceID: unreadable,
      kind: "implicit-project-creation",
      subject: `implicit-project:${unreadable}`,
      payload: { directory: 42 } as never,
      timeCreated: Date.now(),
    })
    try {
      const converged = await ImplicitProjectCreation.converge({
        isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
        prepareProjectFor: prepareProjectFor(() => undefined),
        observe: () => "dead_or_reused",
      })
      expect({
        failures: converged.failures,
        unreadable: converged.retained.filter((entry) => entry.occurrenceID === unreadable),
      }).toEqual({
        failures: [],
        unreadable: [{ occurrenceID: unreadable, directory: "", reason: "unreadable" }],
      })
    } finally {
      await fs.rm(path.join(kindDirectory, ".DS_Store"), { force: true })
      await ImplicitProjectCreation.rollback(unreadable, "test cleanup")
    }
  })

  test("a dead owner naming a path outside the anonymous root is refused, not deleted", async () => {
    const outside = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "implicit-create-foreign-"))
    const id = await ImplicitProjectCreation.begin(outside)
    try {
      await expectSoleOpenOccurrence(outside)
      const converged = await ImplicitProjectCreation.converge({
        isAnonymousDirectory: ImplicitProject.isAnonymousDirectory,
        prepareProjectFor: prepareProjectFor(() => undefined),
        observe: () => "dead_or_reused",
      })
      expect({ ...forDirectory(converged, outside), exists: await Filesystem.exists(outside) }).toEqual({
        reclaimed: [],
        retained: [{ directory: outside, reason: "not_owned" }],
        exists: true,
      })
    } finally {
      await ImplicitProjectCreation.rollback(id, "test cleanup")
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
})
