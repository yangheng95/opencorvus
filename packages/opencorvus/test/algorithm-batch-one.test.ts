import { describe, expect, spyOn, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { WorktreeOwnershipCriticalSection } from "../src/worktree/ownership-critical-section"
import { SessionPromptState } from "../src/session/prompt/state"
import { SessionPromptOwner } from "../src/session/prompt/owner"
import { SessionStatus } from "../src/session/status"
import { ProjectGitLock } from "../src/worktree/git-lock"
import { Ownership } from "../src/engine/ownership"
import fs, { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { memoryProject } from "./fixture/memory"
import { Instance } from "../src/project/instance"
import { Worktree } from "../src/worktree"
import { Session } from "../src/session"
import { createExecutionCancellationOrigin } from "../src/session/prompt/cancellation"
import * as ManagedSessionOwner from "../src/worktree/managed-session-owner"
import {
  assertSessionPromptSubtreeFinished,
  requestSessionPromptSubtreeCancellation,
  terminateOwnedSessionPromptInScope,
} from "../src/engine/cancellation-scope"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { Bus } from "../src/bus"
import { Database, eq, sql } from "../src/storage/db"
import { ProjectDirectoryAdmissionTable, ProjectTable } from "../src/project/project.sql"
import { Project } from "../src/project/project"
import { ProjectDirectoryAdmission } from "../src/project/directory-admission"
import { EngineService, TaskExecutionDirectoryInitializerTestHooks } from "../src/task-api"
import { TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { InstanceBootstrap } from "../src/project/bootstrap"

async function validWorktreeOwners(primaryWorktreeDir: string) {
  const snapshot = await Ownership.Worktree.list(primaryWorktreeDir)
  return snapshot.entries.filter(
    (entry): entry is Extract<Ownership.SnapshotEntry, { status: "valid" }> => entry.status === "valid",
  )
}

async function ownerlessCriticalSectionProof(primaryWorktreeDir: string, worktreeDir: string) {
  const evidence = await Ownership.Worktree.proveOwnerless({ primaryWorktreeDir, worktreeDir })
  if (evidence.status !== "ownerless") throw new Error("Expected ownerless worktree evidence")
  return WorktreeOwnershipCriticalSection.ownerless(evidence)
}

describe("ascending identifier logical clock", () => {
  test("emits a strict total order across counter overflow and wall-clock rollback", () => {
    const boundaryScript = [
      `import { Identifier } from "./src/id/id.ts"`,
      `const lower = 2 ** 36 - 1`,
      `const upper = 2 ** 36`,
      `const lowerID = Identifier.create("message", false, lower)`,
      `const upperID = Identifier.create("message", false, upper)`,
      `const planID = Identifier.create("plan_node", false, upper + 1)`,
      `const ascendingID = Identifier.create("message", false, upper + 2)`,
      `const descendingID = Identifier.create("message", true, upper + 2)`,
      `console.log(JSON.stringify({ lower: Identifier.timestamp(lowerID), upper: Identifier.timestamp(upperID), plan: Identifier.timestamp(planID), ordered: lowerID < upperID, ascendingLength: ascendingID.length, descendingLength: descendingID.length, planLength: planID.length }))`,
    ].join(";")
    const boundary = Bun.spawnSync([process.execPath, "-e", boundaryScript], {
      cwd: path.resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect({ exitCode: boundary.exitCode, stderr: Buffer.from(boundary.stderr).toString() }).toEqual({
      exitCode: 0,
      stderr: "",
    })
    expect(JSON.parse(Buffer.from(boundary.stdout).toString())).toEqual({
      lower: 2 ** 36 - 1,
      upper: 2 ** 36,
      plan: 2 ** 36 + 1,
      ordered: true,
      ascendingLength: 24,
      descendingLength: 24,
      planLength: 24,
    })

    const timestamp = Date.now() + 60_000
    const ids = Array.from({ length: 3_800 }, () => Identifier.create("message", false, timestamp))
    ids.push(Identifier.create("message", false, timestamp - 10_000))

    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
    expect(Identifier.timestamp(ids.at(-1)!)).toBe(timestamp)
  })
})

describe("worktree ownership critical section", () => {
  test("classifies process ownership probes without guessing from unknown errors", () => {
    expect(Ownership.observePid(42, () => undefined)).toEqual({ status: "alive" })
    expect(
      Ownership.observePid(42, () => {
        throw Object.assign(new Error("denied"), { code: "EPERM" })
      }),
    ).toEqual({ status: "alive" })
    expect(
      Ownership.observePid(42, () => {
        throw Object.assign(new Error("gone"), { code: "ESRCH" })
      }),
    ).toEqual({ status: "dead" })
    const unknown = Ownership.observePid(42, () => {
      throw Object.assign(new Error("busy"), { code: "EBUSY" })
    })
    expect(unknown.status).toBe("unobservable")
  })

  test("returns complete absence for a missing root and ignores unrelated Artifact subtrees", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-owner-scope-"))
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    const worktreeDir = path.join(root, "managed-worktree")
    try {
      expect(await Ownership.Worktree.snapshot(path.join(root, "missing-root"))).toEqual({
        entries: [],
        issues: [],
        integrity: { status: "complete" },
      })
      await mkdir(ProjectRuntimePaths.taskArtifactRoot(root, taskID), { recursive: true })
      await writeFile(path.join(ProjectRuntimePaths.taskArtifactRoot(root, taskID), "artifact.json"), "{}")
      await Ownership.Worktree.record({ primaryWorktreeDir: root, worktreeDir, taskID, sessionID })
      const original = fs.readdir.bind(fs)
      const readdir = spyOn(fs, "readdir").mockImplementation(async (target, options) => {
        if (String(target).includes(`${path.sep}artifacts${path.sep}`)) {
          throw Object.assign(new Error("artifact unreadable"), { code: "EACCES" })
        }
        return original(target, options as never) as never
      })
      try {
        const snapshot = await Ownership.Worktree.snapshot(root)
        expect(snapshot.integrity).toEqual({ status: "complete" })
        expect(snapshot.entries.flatMap((entry) => (entry.status === "valid" ? [entry.marker.sessionID] : []))).toEqual(
          [sessionID],
        )
      } finally {
        readdir.mockRestore()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("preserves typed integrity when an observed ownership directory becomes unreadable or disappears", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-owner-observation-"))
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    const worktreeDir = path.join(root, "managed-worktree")
    try {
      await Ownership.Worktree.record({ primaryWorktreeDir: root, worktreeDir, taskID, sessionID })
      const markerDir = ProjectRuntimePaths.ownershipPaths(root, taskID, sessionID).worktreeMarkerDir
      const original = fs.readdir.bind(fs)
      for (const code of ["EACCES", "ENOENT"] as const) {
        const readdir = spyOn(fs, "readdir").mockImplementation(async (target, options) => {
          if (path.resolve(String(target)) === path.resolve(markerDir)) {
            throw Object.assign(new Error(`marker directory ${code}`), { code })
          }
          return original(target, options as never) as never
        })
        try {
          const snapshot = await Ownership.Worktree.snapshot(root)
          expect(snapshot.integrity.status).toBe("unobservable")
          if (snapshot.integrity.status === "unobservable") {
            expect(snapshot.integrity.errors[0]?.data).toMatchObject({ operation: "list-worktree-markers", code })
          }
        } finally {
          readdir.mockRestore()
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("releases an exact valid owner and returns preservation for an invalid sibling authority", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-owner-release-"))
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    const worktreeDir = path.join(root, "managed-worktree")
    try {
      await Ownership.Worktree.record({ primaryWorktreeDir: root, worktreeDir, taskID, sessionID })
      const markerDir = ProjectRuntimePaths.ownershipPaths(root, taskID, sessionID).worktreeMarkerDir
      await writeFile(path.join(markerDir, "corrupt.ownership.json"), "{not-json")
      const receipt = await Ownership.Worktree.releaseOwner({
        primaryWorktreeDir: root,
        worktreeDir,
        taskID,
        sessionID,
      })
      expect(receipt.released).toEqual([{ taskID, sessionID, worktreeDir }])
      expect(receipt.integrity.status).toBe("invalid")
      const remaining = await Ownership.Worktree.snapshot(root)
      expect(remaining.entries.map((entry) => entry.status)).toEqual(["invalid"])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("treats an owner marker for a missing directory as a different worktree instead of failing observation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-owner-stale-"))
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    const staleTaskID = Identifier.ascending("task")
    const staleSessionID = Identifier.ascending("session")
    const presentWorktree = path.join(root, "present-worktree")
    const missingWorktree = path.join(root, "missing-worktree")
    try {
      await mkdir(presentWorktree)
      await Ownership.Worktree.record({ primaryWorktreeDir: root, worktreeDir: presentWorktree, taskID, sessionID })
      await Ownership.Worktree.record({
        primaryWorktreeDir: root,
        worktreeDir: missingWorktree,
        taskID: staleTaskID,
        sessionID: staleSessionID,
      })

      const presentIdentity = await Ownership.Worktree.observeIdentity(presentWorktree, "observe-present-target")
      expect(await Ownership.Worktree.compareIdentity(presentIdentity, missingWorktree, "compare-missing-target")).toBe(
        "different",
      )

      const release = Ownership.Worktree.requireCompleteRelease(
        await Ownership.Worktree.releaseSessionOwner({
          primaryWorktreeDir: root,
          worktreeDir: presentWorktree,
          sessionID,
        }),
      )
      expect(release.released).toEqual([{ taskID, sessionID, worktreeDir: presentWorktree }])

      const proof = await Ownership.Worktree.proveOwnerless({ primaryWorktreeDir: root, worktreeDir: presentWorktree })
      expect(proof.status).toBe("ownerless")

      expect(
        (await validWorktreeOwners(root)).map((entry) => entry.marker.sessionID),
      ).toEqual([staleSessionID])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("returns a typed observation error when an owned target cannot be inspected", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-owner-target-"))
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    const worktreeDir = path.join(root, "managed-worktree")
    try {
      await mkdir(worktreeDir)
      await Ownership.Worktree.record({ primaryWorktreeDir: root, worktreeDir, taskID, sessionID })
      const original = fs.lstat.bind(fs)
      const lstat = spyOn(fs, "lstat").mockImplementation(async (target, options) => {
        if (path.resolve(String(target)) === path.resolve(worktreeDir)) {
          throw Object.assign(new Error("target busy"), { code: "EBUSY" })
        }
        return original(target, options as never) as never
      })
      try {
        const error = await Ownership.Worktree.orphans({ primaryWorktreeDir: root }).catch((cause) => cause)
        expect(Ownership.Worktree.ObservationError.isInstance(error)).toBe(true)
        expect(error.data).toMatchObject({ operation: "stat-owner-target", code: "EBUSY" })
      } finally {
        lstat.mockRestore()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("reports durable ownership while acquisition and proof share the removal boundary", async () => {
    const directory = `${import.meta.dir}/owned-worktree-contract`
    const ownerlessProof = await ownerlessCriticalSectionProof(directory, directory)
    const acquisition = WorktreeOwnershipCriticalSection.acquire(directory)
    const active = await WorktreeOwnershipCriticalSection.remove({
      directory,
      proveOwnerless: () => ownerlessProof,
      remove: async () => "removed",
    })
    acquisition[Symbol.dispose]()
    expect(active).toEqual({ status: "owned" })

    const durable = await WorktreeOwnershipCriticalSection.remove({
      directory,
      proveOwnerless: () => WorktreeOwnershipCriticalSection.owned(),
      remove: async () => "removed",
    })
    expect(durable).toEqual({ status: "owned" })

    const ownerless = await WorktreeOwnershipCriticalSection.remove({
      directory,
      proveOwnerless: () => ownerlessProof,
      remove: async () => "removed",
    })
    expect(ownerless).toEqual({ status: "removed", value: "removed" })

    let durableOwnerRecorded = true
    await expect(
      WorktreeOwnershipCriticalSection.remove({
        directory,
        proveOwnerless: () =>
          durableOwnerRecorded ? WorktreeOwnershipCriticalSection.ownerless(ownerlessProof.evidence) : ownerlessProof,
        remove: async () => {
          throw new Error("physical removal failed")
        },
      }),
    ).rejects.toThrow("physical removal failed")
    expect(durableOwnerRecorded).toBe(true)
  })

  test("publishes durable ownership before a competing cross-process removal lease", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-owner-lease-"))
    const lockPath = path.join(root, "project-git.lock")
    const worktreeDir = path.join(root, "managed-worktree")
    const events: string[] = []
    try {
      const createLease = await ProjectGitLock.acquire(lockPath, "project-owner-contract")
      events.push("create-acquired")
      const removal = ProjectGitLock.acquire(lockPath, "project-owner-contract").then(async (lease) => {
        events.push("removal-proof")
        await lease.release()
      })
      await Ownership.Worktree.record({
        primaryWorktreeDir: root,
        worktreeDir,
        taskID: Identifier.ascending("task"),
        sessionID: Identifier.ascending("session"),
      })
      events.push("durable-owner-published")
      await createLease.release()
      await removal
      expect(events).toEqual(["create-acquired", "durable-owner-published", "removal-proof"])
      expect((await Ownership.Worktree.proveOwnerless({ primaryWorktreeDir: root, worktreeDir })).status).toBe("owned")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("binds reentrant project Git leases to one canonical project authority", async () => {
    const first = await mkdtemp(path.join(os.tmpdir(), "opencorvus-git-lease-a-"))
    const second = await mkdtemp(path.join(os.tmpdir(), "opencorvus-git-lease-b-"))
    try {
      await ProjectGitLock.withLease({ projectID: "project-a", primaryWorktreeDir: first }, async (outer) => {
        await ProjectGitLock.withLease({ projectID: "project-a", primaryWorktreeDir: first }, async (inner) => {
          expect(inner.owner.token).toBe(outer.owner.token)
          expect(path.resolve(inner.lockPath)).toBe(path.resolve(outer.lockPath))
        })
        await expect(
          ProjectGitLock.withLease({ projectID: "project-b", primaryWorktreeDir: second }, async () => undefined),
        ).rejects.toThrow("nested lock authority differs")
      })
    } finally {
      await rm(first, { recursive: true, force: true })
      await rm(second, { recursive: true, force: true })
    }
  })

  test("preserves a crash-surviving active Task owner and releases only terminal or target-missing owners", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-owner-reconcile-"))
    const existingWorktree = path.join(root, "existing-worktree")
    const missingWorktree = path.join(root, "missing-worktree")
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    try {
      await mkdir(existingWorktree)
      await Ownership.Worktree.record({
        primaryWorktreeDir: root,
        worktreeDir: existingWorktree,
        taskID,
        sessionID,
        ownerPid: 2_147_483_647,
      })
      expect(
        await Ownership.Worktree.reconcileOrphans({
          primaryWorktreeDir: root,
          observeOwnerPid: () => ({ status: "dead" }),
          canReleaseDeadOwner: () => false,
        }),
      ).toEqual({ released: 0, preserved: 1, integrity: { status: "complete" } })
      expect((await validWorktreeOwners(root)).map((entry) => entry.marker.sessionID)).toEqual([sessionID])

      expect(
        await Ownership.Worktree.reconcileOrphans({
          primaryWorktreeDir: root,
          observeOwnerPid: () => ({ status: "dead" }),
          canReleaseDeadOwner: () => true,
        }),
      ).toEqual({ released: 1, preserved: 0, integrity: { status: "complete" } })
      expect((await Ownership.Worktree.list(root)).entries).toEqual([])

      await Ownership.Worktree.record({
        primaryWorktreeDir: root,
        worktreeDir: missingWorktree,
        taskID,
        sessionID,
        ownerPid: process.pid,
      })
      expect(
        await Ownership.Worktree.reconcileOrphans({
          primaryWorktreeDir: root,
          observeOwnerPid: () => ({ status: "alive" }),
          canReleaseDeadOwner: () => false,
        }),
      ).toEqual({ released: 1, preserved: 0, integrity: { status: "complete" } })
      expect((await Ownership.Worktree.list(root)).entries).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("renews and releases exact managed-worktree owners through the production lock path", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const firstSessionID = Identifier.ascending("session")
        const secondSessionID = Identifier.ascending("session")
        const worktree = await Worktree.create({ name: `owner-${taskID.slice(-8)}`, taskID, sessionID: firstSessionID })
        await Worktree.renewManagedWorktreeOwner({
          directory: worktree.directory,
          taskID,
          sessionID: secondSessionID,
        })
        expect(
          (await validWorktreeOwners(Instance.project.worktree))
            .filter((entry) => entry.marker.cwd === worktree.directory)
            .map((entry) => entry.marker.sessionID)
            .sort(),
        ).toEqual([firstSessionID, secondSessionID].sort())
        await Worktree.releaseManagedWorktreeSessionOwner({
          projectID: Instance.project.id,
          primaryWorktreeDir: Instance.project.worktree,
          directory: worktree.directory,
          sessionID: firstSessionID,
        })
        expect(
          (await validWorktreeOwners(Instance.project.worktree))
            .filter((entry) => entry.marker.cwd === worktree.directory)
            .map((entry) => entry.marker.sessionID),
        ).toEqual([secondSessionID])
        await Worktree.releaseManagedWorktreeSessionOwner({
          projectID: Instance.project.id,
          primaryWorktreeDir: Instance.project.worktree,
          directory: worktree.directory,
          sessionID: secondSessionID,
        })
        await Worktree.remove({ directory: worktree.directory })
        expect(
          (await validWorktreeOwners(Instance.project.worktree)).filter(
            (entry) => entry.marker.cwd === worktree.directory,
          ),
        ).toEqual([])
        await Ownership.Worktree.record({
          primaryWorktreeDir: Instance.project.worktree,
          worktreeDir: worktree.directory,
          taskID,
          sessionID: secondSessionID,
        })
        expect(await Worktree.reconcileOrphanWorktreeOwners()).toEqual({
          released: 1,
          preserved: 0,
          integrity: { status: "complete" },
        })
        expect(
          (await validWorktreeOwners(Instance.project.worktree)).filter(
            (entry) => entry.marker.cwd === worktree.directory,
          ),
        ).toEqual([])
      },
    })
  }, 60_000)

  test("returns an exact public receipt after explicit durable sandbox release", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `delete-receipt-${Date.now()}` })
        const result = await Worktree.removeProjectWorktree({ directory: worktree.directory })
        expect(result.receipt).toEqual({ ok: true, status: "removed" })
      },
    })
  })

  test("preserves public remove and reset while a durable Session owns the worktree, then admits both after settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const worktree = await Worktree.create({ name: `durable-session-owner-${Date.now()}` })
        const session = await Session.createNext({
          kind: "assistant",
          directory: worktree.directory,
          title: "Durable worktree owner",
        })
        const scratch = path.join(worktree.directory, "reset-owner-proof.txt")
        await fs.writeFile(scratch, "durable owner\n", "utf8")

        const preservedRemoval = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        const preservedReset = await Worktree.resetProjectWorktree({ directory: worktree.directory }).catch(
          (error) => error,
        )

        await EngineService.deleteSession(session.id, { projectID: session.projectID })
        const resetAfterSettlement = await Worktree.resetProjectWorktree({ directory: worktree.directory })
        const scratchAfterReset = await fs.stat(scratch).then(() => "present", () => "absent")
        const removalAfterSettlement = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })

        expect({
          preservedRemoval,
          preservedReset: preservedReset?.name,
          resetAfterSettlement: path.resolve(resetAfterSettlement.directory),
          scratchAfterReset,
          removalAfterSettlement,
        }).toEqual({
          preservedRemoval: { directory: worktree.directory, removed: false, proof: "owned" },
          preservedReset: "WorktreeResetFailedError",
          resetAfterSettlement: path.resolve(worktree.directory),
          scratchAfterReset: "absent",
          removalAfterSettlement: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
        })
      },
    })
  }, 90_000)

  test("releases the exact stored sandbox alias authorized by physical identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `delete-alias-${Date.now()}` })
        const alias = path.join(path.dirname(worktree.directory), `${path.basename(worktree.directory)}-alias`)
        await fs.symlink(worktree.directory, alias, process.platform === "win32" ? "junction" : "dir")
        const current = Project.get(Instance.project.id)!
        Database.use((db) =>
          db
            .update(ProjectTable)
            .set({ sandboxes: [alias], time_updated: Date.now() })
            .where(eq(ProjectTable.id, current.id))
            .run(),
        )

        const result = await Worktree.removeProjectWorktree({ directory: worktree.directory })

        expect({ receipt: result.receipt, sandboxes: Project.get(current.id)?.sandboxes }).toEqual({
          receipt: { ok: true, status: "removed" },
          sandboxes: [],
        })
      },
    })
  })

  test("preserves an alias replacement at the occurrence-bound quarantine cut", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `delete-alias-replacement-${Date.now()}` })
        const alias = path.join(path.dirname(worktree.directory), `${path.basename(worktree.directory)}-alias`)
        await fs.symlink(worktree.directory, alias, process.platform === "win32" ? "junction" : "dir")
        const current = Project.get(Instance.project.id)!
        Database.use((db) =>
          db
            .update(ProjectTable)
            .set({ sandboxes: [alias], time_updated: Date.now() })
            .where(eq(ProjectTable.id, current.id))
            .run(),
        )
        let replaced = false
        using _replace = Worktree.TestHooks.installAfterSandboxAliasObservation(async (observed) => {
          if (replaced || !Project.samePath(observed, alias)) return
          replaced = true
          await fs.rm(alias, { recursive: true, force: true })
          await fs.mkdir(alias, { recursive: true })
          await fs.writeFile(path.join(alias, "replacement.txt"), "preserve alias replacement\n", "utf8")
        })

        const preserved = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: current.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        const replacement = await fs.readFile(path.join(alias, "replacement.txt"), "utf8")
        const retainedAdmissions = Database.use(
          (db) => db.select().from(ProjectDirectoryAdmissionTable).all().length,
        )
        await fs.rm(alias, { recursive: true, force: true })
        const resumed = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: current.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })

        expect({
          replaced,
          preserved,
          replacement,
          retainedAdmissions,
          resumed,
          sandboxes: Project.get(current.id)?.sandboxes,
          finalAdmissions: Database.use(
            (db) => db.select().from(ProjectDirectoryAdmissionTable).all().length,
          ),
        }).toEqual({
          replaced: true,
          preserved: { directory: worktree.directory, removed: false, proof: "owned" },
          replacement: "preserve alias replacement\n",
          retainedAdmissions: 1,
          resumed: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
          sandboxes: [],
          finalAdmissions: 0,
        })
      },
    })
  }, 90_000)

  test("holds production Task directory admission until its durable process binding exists", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const projectID = Instance.project.id
        const unboundWorktree = await Worktree.create({ name: `delete-admission-unbound-${Date.now()}` })
        await Project.removeSandbox(projectID, unboundWorktree.directory)
        const sandboxesBeforeUnboundCreation = Project.get(projectID)!.sandboxes
        {
          using _unboundInitializer = TaskExecutionDirectoryInitializerTestHooks.replace(undefined)
          await expect(
            EngineService.createTask(
              {
                requestID: `directory-admission-unbound-${Identifier.ascending("artifact")}`,
                request: "Reject an uncomposed external-directory Task before durable registration",
                directory: unboundWorktree.directory,
                productPillar: "code",
                model: "firmware/gpt-5",
                promptProfile: "base",
              },
              { actor: "user" },
            ),
          ).rejects.toThrow("Task execution directory initializer is not bound by Project bootstrap.")
        }
        expect(Project.get(projectID)!.sandboxes).toEqual(sandboxesBeforeUnboundCreation)
        await Worktree.removeManagedProjectWorktreeDirectory({
          projectID,
          directory: unboundWorktree.directory,
          releaseSandboxOwnership: true,
        })

        const worktree = await Worktree.create({ name: `delete-admission-${Date.now()}` })
        let initializerCalls = 0
        let ingressRunnerCalls = 0
        let targetIngressRunner: Disposable | undefined
        using _initializer = TaskExecutionDirectoryInitializerTestHooks.replace(async () => {
          initializerCalls += 1
          {
            using _bootstrapBinding = TaskExecutionDirectoryInitializerTestHooks.replace(InstanceBootstrap)
            await InstanceBootstrap()
          }
          targetIngressRunner = TaskControlTestHooks.replaceTaskIngressRunner({
            runner: async () => {
              ingressRunnerCalls += 1
              return {}
            },
          })
        })
        const originalRegister = Project.registerExecutionDirectory
        let releaseRegistration!: () => void
        let registrationOwned!: () => void
        const registrationStarted = new Promise<void>((resolve) => (registrationOwned = resolve))
        const registrationRelease = new Promise<void>((resolve) => (releaseRegistration = resolve))
        const register = spyOn(Project, "registerExecutionDirectory").mockImplementation(async (...args) => {
          const result = await originalRegister(...args)
          registrationOwned()
          await registrationRelease
          return result
        })
        try {
          const creation = EngineService.createTask(
            {
              requestID: `directory-admission-${Identifier.ascending("artifact")}`,
              request: "Publish the durable external-directory Task process binding",
              directory: worktree.directory,
              productPillar: "code",
              model: "firmware/gpt-5",
              promptProfile: "base",
            },
            { actor: "user" },
          )
          await registrationStarted

          const preservedDuringAdmission = await Worktree.removeManagedProjectWorktreeDirectory({
            projectID: Instance.project.id,
            directory: worktree.directory,
            releaseSandboxOwnership: true,
          })
          releaseRegistration()
          const taskID = await creation
          const task = await EngineService.getTask(taskID)
          const replayedRelease = await Worktree.removeManagedProjectWorktreeDirectory({
            projectID: Instance.project.id,
            directory: worktree.directory,
            releaseSandboxOwnership: true,
          })

          expect({
            initializerCalls,
            ingressRunnerCalls,
            taskKind: Identifier.schema("task").parse(taskID) === taskID,
            taskDirectory: task.directory,
            preservedDuringAdmission,
            replayedRelease,
          }).toEqual({
            initializerCalls: 1,
            ingressRunnerCalls: 1,
            taskKind: true,
            taskDirectory: worktree.directory,
            preservedDuringAdmission: {
              directory: worktree.directory,
              removed: false,
              proof: "owned",
            },
            replayedRelease: {
              directory: worktree.directory,
              removed: false,
              proof: "owned",
            },
          })
        } finally {
          releaseRegistration()
          register.mockRestore()
          targetIngressRunner?.[Symbol.dispose]()
        }
      },
    })
  }, 90_000)

  test("rejects a replacement filesystem occurrence before durable Task binding", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const worktree = await Worktree.create({ name: `directory-occurrence-${Date.now()}` })
        let replaced = false
        using _replace = Project.TestHooks.installBeforeDiscoveryCommit(async ({ directory }) => {
          if (replaced || !Project.samePath(directory, worktree.directory)) return
          replaced = true
          await fs.rm(worktree.directory, { recursive: true, force: true })
          await fs.mkdir(worktree.directory, { recursive: true })
        })
        const failure = await EngineService.createTask(
          {
            requestID: `directory-occurrence-${Identifier.ascending("artifact")}`,
            request: "Bind only the admitted filesystem occurrence",
            directory: worktree.directory,
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
          },
          { actor: "user" },
        ).catch((error) => error)
        const cleanup = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        expect({ replaced, failure: failure?.name, cleanup }).toEqual({
          replaced: true,
          failure: "ProjectDirectoryOccurrenceChangedError",
          cleanup: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
        })
      },
    })
  }, 90_000)

  test("fences a new durable Session while reclamation owns its Project directory", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const worktree = await Worktree.create({ name: `session-reclamation-${Date.now()}` })
        const alias = path.join(path.dirname(worktree.directory), `${path.basename(worktree.directory)}-session-alias`)
        await fs.symlink(worktree.directory, alias, process.platform === "win32" ? "junction" : "dir")
        Database.use((db) =>
          db
            .update(ProjectTable)
            .set({ sandboxes: [alias], time_updated: Date.now() })
            .where(eq(ProjectTable.id, Instance.project.id))
            .run(),
        )
        const occurrence = await ProjectDirectoryAdmission.observeDirectory(worktree.directory)
        const acquired = await ProjectDirectoryAdmission.acquire({
          directory: worktree.directory,
          operationID: ProjectDirectoryAdmission.scopeOperationID(
            Instance.project.id,
            `session-reclamation-${Identifier.ascending("artifact")}`,
          ),
          kind: "reclamation",
          occurrence,
        })
        if (acquired.outcome !== "acquired") throw new Error("Expected reclamation admission")
        const operationPrefix = ProjectDirectoryAdmission.scopeOperationID(Instance.project.id, "")
        const plan = Database.Client().all<{ detail: string }>(sql`
          EXPLAIN QUERY PLAN
          SELECT operation_id FROM project_directory_admission
          WHERE operation_id >= ${operationPrefix} AND operation_id < ${`${operationPrefix}\uffff`}
        `)
        const fenced = await Session.createNext({
          kind: "assistant",
          directory: alias,
          title: "Fenced Session",
        }).catch((error) => error)
        const fencedTask = await EngineService.createTask(
          {
            requestID: `task-reclamation-${Identifier.ascending("artifact")}`,
            request: "Fence a Task owner behind directory reclamation",
            directory: worktree.directory,
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
          },
          { actor: "user" },
        ).catch((error) => error)
        const siblingSession = await Session.createNext({
          kind: "assistant",
          directory: project.path,
          title: "Unrelated primary Session",
        })
        using _primaryIngress = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async () => ({}),
        })
        const siblingTask = await EngineService.createTask(
          {
            requestID: `task-primary-progress-${Identifier.ascending("artifact")}`,
            request: "Continue an unrelated primary Task while a sibling directory is reclaimed",
            directory: project.path,
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
          },
          { actor: "user" },
        )
        ProjectDirectoryAdmission.settle(acquired.token, () => undefined)
        const admitted = await Session.createNext({
          kind: "assistant",
          directory: alias,
          title: "Admitted Session",
        })
        expect({
          indexed: plan.some((entry) => entry.detail.includes("project_directory_admission_operation_idx")),
          fenced: fenced?.name,
          fencedTask: fencedTask?.name,
          siblingSessionDirectory: siblingSession.directory,
          siblingTaskID: siblingTask,
          admittedDirectory: admitted.directory,
        }).toEqual({
          indexed: true,
          fenced: "ProjectDirectoryAdmissionClosedError",
          fencedTask: "ProjectDirectoryAdmissionClosedError",
          siblingSessionDirectory: project.path,
          siblingTaskID: expect.stringContaining("tsk_"),
          admittedDirectory: alias,
        })
      },
    })
  })

  test("releases process-local registration ownership after durable acquire and settle failures", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `registration-release-${Date.now()}` })
        const occurrence = await ProjectDirectoryAdmission.observeDirectory(worktree.directory)
        const reclamation = await ProjectDirectoryAdmission.acquire({
          directory: worktree.directory,
          operationID: ProjectDirectoryAdmission.scopeOperationID(
            Instance.project.id,
            `registration-conflict-${Identifier.ascending("artifact")}`,
          ),
          kind: "reclamation",
          occurrence,
        })
        if (reclamation.outcome !== "acquired") throw new Error("Expected reclamation admission")
        const acquireFailure = await Worktree.withSandboxAdmission(worktree.directory, async () => undefined).catch(
          (error) => error,
        )
        ProjectDirectoryAdmission.settle(reclamation.token, () => undefined)
        const afterAcquireFailure = await WorktreeOwnershipCriticalSection.mutate({
          directory: occurrence.directoryKey,
          mutate: async () => "released",
        })

        const settleFailure = await Worktree.withSandboxAdmission(worktree.directory, async (token) => {
          Database.use((db) =>
            db
              .delete(ProjectDirectoryAdmissionTable)
              .where(eq(ProjectDirectoryAdmissionTable.generation, token.generation))
              .run(),
          )
        }).catch((error) => error)
        const afterSettleFailure = await WorktreeOwnershipCriticalSection.mutate({
          directory: occurrence.directoryKey,
          mutate: async () => "released",
        })
        expect({
          acquireFailure: acquireFailure?.name,
          afterAcquireFailure,
          settleFailure: settleFailure?.message,
          afterSettleFailure,
        }).toEqual({
          acquireFailure: "ProjectDirectoryAdmissionClosedError",
          afterAcquireFailure: { status: "mutated", value: "released" },
          settleFailure: expect.stringContaining("is no longer authoritative"),
          afterSettleFailure: { status: "mutated", value: "released" },
        })
      },
    })
  })

  test("maps process-local mutation ownership to the public preservation contracts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `local-public-conflict-${Date.now()}` })
        const occurrence = await ProjectDirectoryAdmission.observeDirectory(worktree.directory)
        const local = WorktreeOwnershipCriticalSection.acquire(occurrence.directoryKey)
        const removal = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        const reset = await Worktree.resetProjectWorktree({ directory: worktree.directory }).catch((error) => error)
        local[Symbol.dispose]()
        const cleanup = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        expect({ removal, reset: reset?.name, cleanup }).toEqual({
          removal: { directory: worktree.directory, removed: false, proof: "owned" },
          reset: "WorktreeResetFailedError",
          cleanup: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
        })
      },
    })
  }, 90_000)

  test("preserves a present replacement before public removal reaches its destructive effect", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `remove-replacement-${Date.now()}` })
        const original = `${worktree.directory}-original`
        let replaced = false
        using _replace = ProjectDirectoryAdmission.TestHooks.installAfterDurableAcquire(async (token) => {
          if (replaced || token.kind !== "reclamation" || token.directory !== path.resolve(worktree.directory)) return
          replaced = true
          await fs.rename(worktree.directory, original)
          await fs.mkdir(worktree.directory, { recursive: true })
          await fs.writeFile(path.join(worktree.directory, "replacement.txt"), "preserve\n", "utf8")
        })
        const failure = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        }).catch((error) => error)
        const replacement = await fs.readFile(path.join(worktree.directory, "replacement.txt"), "utf8")
        await fs.rm(worktree.directory, { recursive: true, force: true })
        await fs.rename(original, worktree.directory)
        const cleanup = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        expect({ replaced, failure: failure?.name, replacement, cleanup }).toEqual({
          replaced: true,
          failure: "WorktreeRemoveFailedError",
          replacement: "preserve\n",
          cleanup: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
        })
      },
    })
  }, 90_000)

  test("preserves a present replacement before public reset reaches its destructive effect", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `reset-replacement-${Date.now()}` })
        const original = `${worktree.directory}-original`
        let replaced = false
        using _replace = ProjectDirectoryAdmission.TestHooks.installAfterDurableAcquire(async (token) => {
          if (replaced || token.kind !== "reclamation" || token.directory !== path.resolve(worktree.directory)) return
          replaced = true
          await fs.rename(worktree.directory, original)
          await fs.mkdir(worktree.directory, { recursive: true })
          await fs.writeFile(path.join(worktree.directory, "replacement.txt"), "preserve reset\n", "utf8")
        })
        const failure = await Worktree.resetProjectWorktree({ directory: worktree.directory }).catch((error) => error)
        const replacement = await fs.readFile(path.join(worktree.directory, "replacement.txt"), "utf8")
        await fs.rm(worktree.directory, { recursive: true, force: true })
        await fs.rename(original, worktree.directory)
        const cleanup = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        expect({ replaced, failure: failure?.name, replacement, cleanup }).toEqual({
          replaced: true,
          failure: "WorktreeResetFailedError",
          replacement: "preserve reset\n",
          cleanup: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
        })
      },
    })
  }, 90_000)

  test("retains the exact reclamation generation across a partial physical removal and resumes cleanup", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `partial-removal-${Date.now()}` })
        const alias = path.join(path.dirname(worktree.directory), `${path.basename(worktree.directory)}-partial-alias`)
        await fs.symlink(worktree.directory, alias, process.platform === "win32" ? "junction" : "dir")
        Database.use((db) =>
          db
            .update(ProjectTable)
            .set({ sandboxes: [alias], time_updated: Date.now() })
            .where(eq(ProjectTable.id, Instance.project.id))
            .run(),
        )
        let injected = false
        const hook = Worktree.TestHooks.installAfterPhysicalDirectoryRemoval(() => {
          if (injected) return
          injected = true
          throw new Worktree.RemoveFailedError({ message: "Injected post-removal registry interruption" })
        })
        const first = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        }).catch((error) => error)
        hook[Symbol.dispose]()
        const directoryKey = await ProjectDirectoryAdmission.key(worktree.directory)
        const preservedAdmissions = Database.use(
          (db) =>
            db
              .select()
              .from(ProjectDirectoryAdmissionTable)
              .where(eq(ProjectDirectoryAdmissionTable.directory_key, directoryKey))
              .all().length,
        )
        const danglingAlias = await fs.lstat(alias).then(() => "retained", () => "missing")
        let replaced = false
        using _replace = ProjectDirectoryAdmission.TestHooks.installAfterDurableAcquire(async (token) => {
          if (replaced || token.kind !== "reclamation" || token.directory !== path.resolve(worktree.directory)) return
          replaced = true
          await fs.mkdir(worktree.directory, { recursive: true })
          await fs.writeFile(path.join(worktree.directory, "replacement.txt"), "preserve retained replacement\n", "utf8")
        })
        const preservedReplacement = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        const replacement = await fs.readFile(path.join(worktree.directory, "replacement.txt"), "utf8")
        const retainedAdmissions = Database.use(
          (db) =>
            db
              .select()
              .from(ProjectDirectoryAdmissionTable)
              .where(eq(ProjectDirectoryAdmissionTable.directory_key, directoryKey))
              .all().length,
        )
        await fs.rm(worktree.directory, { recursive: true, force: true })
        const resumed = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        const finalAdmissions = Database.use(
          (db) =>
            db
              .select()
              .from(ProjectDirectoryAdmissionTable)
              .where(eq(ProjectDirectoryAdmissionTable.directory_key, directoryKey))
              .all().length,
        )
        const aliasAfterSettlement = await fs.lstat(alias).then(() => "retained", () => "removed")
        expect({
          first: first?.name,
          danglingAlias,
          preservedAdmissions,
          replaced,
          preservedReplacement,
          replacement,
          retainedAdmissions,
          resumed,
          aliasAfterSettlement,
          sandboxes: Project.get(Instance.project.id)?.sandboxes,
          finalAdmissions,
        }).toEqual({
          first: "WorktreeRemoveFailedError",
          danglingAlias: "retained",
          preservedAdmissions: 1,
          replaced: true,
          preservedReplacement: { directory: worktree.directory, removed: false, proof: "owned" },
          replacement: "preserve retained replacement\n",
          retainedAdmissions: 1,
          resumed: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
          aliasAfterSettlement: "removed",
          sandboxes: [],
          finalAdmissions: 0,
        })
      },
    })
  }, 90_000)

  test("preserves a replacement introduced at the final filesystem-to-database settlement cut", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worktree = await Worktree.create({ name: `settlement-replacement-${Date.now()}` })
        let replaced = false
        using _replace = Worktree.TestHooks.installBeforeRemovalSettlement(async (directory) => {
          if (replaced || !Project.samePath(directory, worktree.directory)) return
          replaced = true
          await fs.mkdir(worktree.directory, { recursive: true })
          await fs.writeFile(path.join(worktree.directory, "replacement.txt"), "preserve final replacement\n", "utf8")
        })

        const preserved = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })
        const replacement = await fs.readFile(path.join(worktree.directory, "replacement.txt"), "utf8")
        const retainedAdmissions = Database.use(
          (db) => db.select().from(ProjectDirectoryAdmissionTable).all().length,
        )
        await fs.rm(worktree.directory, { recursive: true, force: true })
        const resumed = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })

        expect({
          replaced,
          preserved,
          replacement,
          retainedAdmissions,
          resumed,
          finalAdmissions: Database.use(
            (db) => db.select().from(ProjectDirectoryAdmissionTable).all().length,
          ),
        }).toEqual({
          replaced: true,
          preserved: { directory: worktree.directory, removed: false, proof: "owned" },
          replacement: "preserve final replacement\n",
          retainedAdmissions: 1,
          resumed: {
            directory: worktree.directory,
            removed: true,
            proof: "ownerless",
            receipt: { ok: true, status: "removed" },
          },
          finalAdmissions: 0,
        })
      },
    })
  }, 90_000)

  test("binds a retained reset generation to its immutable branch and commit intent", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const git = (...args: string[]) => {
          const result = Bun.spawnSync(["git", ...args], { cwd: project.path, stdout: "pipe", stderr: "pipe" })
          if (result.exitCode !== 0) throw new Error(result.stderr.toString() || `git ${args.join(" ")} failed`)
          return result.stdout.toString().trim()
        }
        const worktree = await Worktree.create({ name: `reset-intent-${Date.now()}` })
        await fs.writeFile(path.join(project.path, "reset-intent.txt"), "next\n", "utf8")
        git("add", "--", "reset-intent.txt")
        git("-c", "user.name=OpenCorvus Test", "-c", "user.email=test@opencorvus.ai", "commit", "-m", "next reset target")
        const nextCommit = git("rev-parse", "HEAD")
        let injected = false
        const hook = Worktree.TestHooks.installAfterResetHard(() => {
          if (injected) return
          injected = true
          throw new Worktree.ResetFailedError({ message: "Injected post-reset interruption" })
        })
        const first = await Worktree.resetProjectWorktree({ directory: worktree.directory }).catch((error) => error)
        hook[Symbol.dispose]()
        await fs.writeFile(path.join(project.path, "reset-intent-later.txt"), "later\n", "utf8")
        git("add", "--", "reset-intent-later.txt")
        git("-c", "user.name=OpenCorvus Test", "-c", "user.email=test@opencorvus.ai", "commit", "-m", "advance moving reset ref")
        const advancedCommit = git("rev-parse", "HEAD")
        const conflictingIntent = await Worktree.resetProjectWorktree({
          directory: worktree.directory,
          baseRef: advancedCommit,
        }).catch((error) => error)
        const resumed = await Worktree.resetProjectWorktree({ directory: worktree.directory })
        const finalHead = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
          cwd: worktree.directory,
          stdout: "pipe",
          stderr: "pipe",
        }).stdout.toString().trim()
        expect({
          first: first?.name,
          conflictingIntent: conflictingIntent?.name,
          resumed: path.resolve(resumed.directory),
          finalHead,
        }).toEqual({
          first: "WorktreeResetFailedError",
          conflictingIntent: "WorktreeResetFailedError",
          resumed: path.resolve(worktree.directory),
          finalHead: nextCommit,
        })
      },
    })
  }, 90_000)
})

describe("prompt ownership termination", () => {
  test("retains the live local owner until its exact durable generation release succeeds", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Durable owner release retry" })
        const owner = SessionPromptState.start(session.id, session.directory)
        if (!owner) throw new Error("Expected a fresh prompt owner")
        const durableOwner = SessionPromptOwner.current(session.id)
        if (!durableOwner) throw new Error("Expected a durable prompt owner")

        const releaseOwner = SessionPromptOwner.release
        let attempts = 0
        const firstFailure = Promise.withResolvers<void>()
        const release = spyOn(SessionPromptOwner, "release").mockImplementation((authority) => {
          attempts += 1
          if (attempts === 1) {
            firstFailure.resolve()
            throw new Error("injected transient durable owner release failure")
          }
          return releaseOwner(authority)
        })
        try {
          const settlement = SessionPromptState.release(session.id, session.directory)
          await firstFailure.promise
          expect({
            terminating: SessionPromptState.TestHooks.isPromptTerminating(session.id, session.directory),
            resources: SessionPromptState.TestHooks.promptResourceSnapshot(session.id),
            durableGeneration: SessionPromptOwner.current(session.id)?.generation,
          }).toEqual({
            terminating: true,
            resources: {
              promptOwners: 1,
              messageOwnerRegistries: 1,
              startReservations: 0,
              cancellationReceipts: 0,
            },
            durableGeneration: durableOwner.generation,
          })

          await settlement
          expect({ attempts, resources: SessionPromptState.TestHooks.promptResourceSnapshot(session.id) }).toEqual({
            attempts: 2,
            resources: {
              promptOwners: 0,
              messageOwnerRegistries: 0,
              startReservations: 0,
              cancellationReceipts: 0,
            },
          })
          expect(SessionPromptOwner.current(session.id)).toBeUndefined()

          const replacement = SessionPromptState.start(session.id, session.directory)
          expect(replacement).toBeInstanceOf(AbortSignal)
          expect(SessionPromptOwner.current(session.id)?.generation).not.toBe(durableOwner.generation)
          await SessionPromptState.release(session.id, session.directory)
        } finally {
          release.mockRestore()
        }
      },
    })
  })

  test("releases a managed-worktree Session owner after its Instance lease closes", async () => {
    await using project = await memoryProject()
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    let primaryWorktreeDir = ""
    let managedWorktreeDir = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        primaryWorktreeDir = Instance.project.worktree
        const worktree = await Worktree.create({ name: `closed-lease-${taskID.slice(-8)}`, taskID, sessionID })
        managedWorktreeDir = worktree.directory
        await Session.createNext({
          id: sessionID,
          kind: "assistant",
          directory: managedWorktreeDir,
          title: "Closed managed-worktree prompt owner",
        })
        SessionPromptState.start(sessionID, managedWorktreeDir)
      },
    })

    await SessionPromptState.release(sessionID)

    expect(
      (await validWorktreeOwners(primaryWorktreeDir)).filter(
        (entry) => entry.marker.cwd === managedWorktreeDir && entry.marker.sessionID === sessionID,
      ),
    ).toEqual([])
  })

  test("retries the exact managed-worktree cleanup receipt after a transient owner-release failure", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const sessionID = Identifier.ascending("session")
        const worktree = await Worktree.create({ name: `retry-owner-${taskID.slice(-8)}`, taskID, sessionID })
        await Session.createNext({
          id: sessionID,
          kind: "assistant",
          directory: worktree.directory,
          title: "Retry managed-worktree prompt owner",
        })
        SessionPromptState.start(sessionID, worktree.directory)
        const owner = SessionPromptState.promptOwner(sessionID)!
        const receipt = SessionPromptState.cancelOwned(sessionID, worktree.directory, owner, {
          origin: createExecutionCancellationOrigin({
            actor: "runtime",
            source: "runtime.prompt_owner",
            surface: "agent",
            requestID: sessionID,
            reason: "settle managed worktree cleanup",
            targetSessionID: sessionID,
            taskID,
          }),
        })!
        const releaseOwner = ManagedSessionOwner.releaseManagedWorktreeSessionOwner
        let attempts = 0
        const release = spyOn(ManagedSessionOwner, "releaseManagedWorktreeSessionOwner").mockImplementation(
          async (authority) => {
            attempts += 1
            if (attempts === 1) throw new Error("injected transient managed owner release failure")
            await releaseOwner(authority)
          },
        )
        try {
          await expect(SessionPromptState.finish(sessionID, owner, worktree.directory)).rejects.toThrow(
            "injected transient managed owner release failure",
          )
          expect({ outcome: receipt.outcome, retryCleanup: typeof receipt.retryCleanup }).toEqual({
            outcome: "pending",
            retryCleanup: "function",
          })
          await receipt.finished
          SessionPromptState.clearCancellationReceipt(sessionID, owner)
          expect({ attempts, outcome: receipt.outcome }).toMatchObject({
            attempts: 2,
            outcome: "succeeded",
          })
        } finally {
          release.mockRestore()
        }
      },
    })
  })

  test("readmits a Session prompt after a deterministic owner-release failure by retrying the retained cleanup on start", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const sessionID = Identifier.ascending("session")
        const worktree = await Worktree.create({ name: `sticky-owner-${taskID.slice(-8)}`, taskID, sessionID })
        await Session.createNext({
          id: sessionID,
          kind: "assistant",
          directory: worktree.directory,
          title: "Retained managed-worktree prompt owner",
        })
        SessionPromptState.start(sessionID, worktree.directory)
        const owner = SessionPromptState.promptOwner(sessionID)!
        const receipt = SessionPromptState.cancelOwned(sessionID, worktree.directory, owner, {
          origin: createExecutionCancellationOrigin({
            actor: "runtime",
            source: "runtime.prompt_owner",
            surface: "agent",
            requestID: sessionID,
            reason: "quarantine managed worktree cleanup",
            targetSessionID: sessionID,
            taskID,
          }),
        })!
        const releaseOwner = ManagedSessionOwner.releaseManagedWorktreeSessionOwner
        let deterministicFailure = true
        let attempts = 0
        const release = spyOn(ManagedSessionOwner, "releaseManagedWorktreeSessionOwner").mockImplementation(
          async (authority) => {
            attempts += 1
            if (deterministicFailure) throw new Error("injected deterministic managed owner release failure")
            await releaseOwner(authority)
          },
        )
        try {
          await expect(SessionPromptState.finish(sessionID, owner, worktree.directory)).rejects.toThrow(
            "injected deterministic managed owner release failure",
          )
          while (receipt.outcome !== "failed" || receipt.retryRunning) {
            await Bun.sleep(5)
          }
          // The next ordinary start is the quarantine's exit: it re-attempts
          // the retained release instead of refusing until a restart.
          const nextOwner = SessionPromptState.start(sessionID, worktree.directory)
          deterministicFailure = false
          expect(nextOwner).toBeInstanceOf(AbortSignal)
          expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID).cancellationReceipts).toBe(0)
          await receipt.finished
          const settledOutcome: string = receipt.outcome
          expect({ outcome: settledOutcome, retriedOnStart: attempts >= 3 }).toEqual({
            outcome: "succeeded",
            retriedOnStart: true,
          })
          await SessionPromptState.release(sessionID)
          expect(
            (await validWorktreeOwners(Instance.project.worktree)).filter(
              (entry) => entry.marker.cwd === worktree.directory,
            ),
          ).toEqual([])
        } finally {
          release.mockRestore()
        }
      },
    })
  })

  test("releases the complete prompt resource set idempotently", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = Identifier.ascending("session")
        const directory = `${import.meta.dir}/prompt-owner-contract`
        await Session.createNext({
          id: sessionID,
          kind: "assistant",
          directory,
          title: "Complete prompt resource cleanup",
        })
        SessionPromptState.start(sessionID, directory)
        expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID)).toEqual({
          promptOwners: 1,
          messageOwnerRegistries: 1,
          startReservations: 0,
          cancellationReceipts: 0,
        })
        await SessionPromptState.release(sessionID)
        await SessionPromptState.release(sessionID)
        expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID)).toEqual({
          promptOwners: 0,
          messageOwnerRegistries: 0,
          startReservations: 0,
          cancellationReceipts: 0,
        })
      },
    })
  })

  test("releases ownership and side tables when status termination fails", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = Identifier.ascending("session")
        const directory = `${import.meta.dir}/prompt-owner-status-failure`
        await Session.createNext({
          id: sessionID,
          kind: "assistant",
          directory,
          title: "Prompt status cleanup failure",
        })
        SessionPromptState.start(sessionID, directory)
        const status = spyOn(SessionStatus, "finishPromptGeneration").mockImplementation(() => {
          throw new Error("status termination failed")
        })
        try {
          await expect(SessionPromptState.release(sessionID)).rejects.toThrow("status termination failed")
        } finally {
          status.mockRestore()
        }
        expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID)).toEqual({
          promptOwners: 0,
          messageOwnerRegistries: 0,
          startReservations: 0,
          cancellationReceipts: 0,
        })
      },
    })
  })

  test("reports cleanup failure when subtree settlement starts after the prompt owner has finished", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Delayed cancellation settlement" })
        SessionPromptState.start(session.id, session.directory)
        const requested = await requestSessionPromptSubtreeCancellation({
          sessionID: session.id,
          projectID: session.projectID,
          handle: "test.delayed-subtree-settlement",
          origin: {
            actor: "runtime",
            source: "task.lifecycle",
            surface: "test",
            requestID: Identifier.ascending("message"),
            reason: "verify delayed cancellation settlement",
          },
        })
        expect(requested.cancelledSessions.map((entry) => entry.id)).toEqual([session.id])

        const status = spyOn(SessionStatus, "finishPromptGeneration").mockImplementation(() => {
          throw new Error("delayed prompt cleanup failed")
        })
        try {
          await expect(SessionPromptState.release(session.id)).rejects.toThrow("delayed prompt cleanup failed")
        } finally {
          status.mockRestore()
        }

        const assertSettlement = () =>
          assertSessionPromptSubtreeFinished({
            sessions: requested.cancelledSessions,
            failures: requested.failures,
            handle: "test.delayed-subtree-settlement",
          })
        await expect(assertSettlement()).rejects.toMatchObject({
          name: "TaskCancellationIncompleteError",
          message: expect.stringContaining("delayed prompt cleanup failed"),
        })
        await expect(assertSettlement()).rejects.toMatchObject({
          name: "TaskCancellationIncompleteError",
          message: expect.stringContaining("delayed prompt cleanup failed"),
        })
        expect(() => SessionPromptState.start(session.id, session.directory)).toThrow(
          expect.objectContaining({ name: "BusyError" }),
        )
        expect(SessionPromptState.TestHooks.promptResourceSnapshot(session.id)).toEqual({
          promptOwners: 0,
          messageOwnerRegistries: 0,
          startReservations: 0,
          cancellationReceipts: 1,
        })
      },
    })
  })

  test("publishes the exact owned cancellation after prompt resources finish", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "owned cancellation receipt" })
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: session.id,
          author: "user",
          time: { created: Date.now() },
          agent: "assistant",
          model: { providerID: "test", modelID: "test" },
        })
        const owner = SessionPromptState.start(session.id, session.directory)
        if (!owner) throw new Error("Expected a fresh prompt owner")
        SessionStatus.beginExecutionOccurrence(session.id, input.id, owner)
        await SessionStatus.set(
          session.id,
          { type: "streaming" },
          {
            inputMessageID: input.id,
            promptGenerationOwner: owner,
          },
        )

        const lock = await ProjectGitLock.acquire(
          ProjectRuntimePaths.projectGitLock(Instance.project.worktree),
          Instance.project.id,
        )
        try {
          const origin = createExecutionCancellationOrigin({
            actor: "runtime",
            source: "runtime.prompt_owner",
            surface: "algorithm-batch-one",
            reason: "focused owned cancellation",
            targetSessionID: session.id,
          })
          expect(
            SessionPromptState.cancelOwned(session.id, session.directory, owner, {
              origin,
              settlementRequired: false,
            }),
          ).toMatchObject({ owner })
          const termination = terminateOwnedSessionPromptInScope({
            session,
            owner,
            origin,
          })
          const firstSettlement = termination.then(
            () => ({ status: "fulfilled" as const }),
            (error) => ({ status: "rejected" as const, error }),
          )
          const finish = SessionPromptState.finish(session.id, owner, session.directory)
          while (!SessionPromptState.TestHooks.isPromptTerminating(session.id, session.directory)) {
            await Bun.sleep(10)
          }
          const nextEntry = SessionPromptState.enterLoop({
            sessionID: session.id,
            directory: session.directory,
            resumeExisting: false,
            resultMode: "reply",
          })
          const stopFailure = Bus.subscribe(SessionStatus.Event.Status, () => {
            throw new Error("focused terminal publication failure")
          })
          try {
            await lock.release()
            await finish
            expect(await firstSettlement).toMatchObject({
              status: "rejected",
              error: { name: "TaskCancellationIncompleteError" },
            })
          } finally {
            stopFailure()
          }
          expect(SessionStatus.getExecution(session.id, input.id)).toEqual({ type: "streaming" })
          expect(SessionPromptState.TestHooks.promptResourceSnapshot(session.id)).toEqual({
            promptOwners: 0,
            messageOwnerRegistries: 0,
            startReservations: 0,
            cancellationReceipts: 1,
          })

          expect(
            await terminateOwnedSessionPromptInScope({
              session,
              owner,
              origin,
            }),
          ).toBe(true)
          const next = await nextEntry
          expect(next.startedOwner).toBe(true)
          expect(SessionStatus.getExecution(session.id, input.id)).toEqual({
            type: "terminal",
            reason: "aborted",
            error: "focused owned cancellation",
          })
          const nextResult = next.firstResult.then(
            () => undefined,
            (error) => error,
          )
          await SessionPromptState.release(session.id)
          expect(await nextResult).toMatchObject({
            name: "SessionPromptLoopFinishedError",
            sessionID: session.id,
          })
        } finally {
          await lock.release()
        }
        expect(SessionPromptState.TestHooks.promptResourceSnapshot(session.id)).toEqual({
          promptOwners: 0,
          messageOwnerRegistries: 0,
          startReservations: 0,
          cancellationReceipts: 0,
        })
      },
    })
  })

  test("holds replacement admission from live-owner cleanup through terminal handoff", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = Identifier.ascending("session")
        const directory = `${import.meta.dir}/prompt-owner-terminal-handoff`
        await Session.createNext({
          id: sessionID,
          kind: "assistant",
          directory,
          title: "Prompt owner terminal handoff",
        })
        const owner = SessionPromptState.start(sessionID, directory)!
        const reservation = SessionPromptState.claimPromptSettlementReservation(sessionID, directory, owner)
        const settlement = SessionPromptState.cancelOwned(sessionID, directory, owner, {
          origin: {
            actor: "runtime",
            source: "runtime.prompt_owner",
            surface: "test",
            requestID: Identifier.ascending("message"),
            reason: "verify terminal handoff reservation",
            targetSessionID: sessionID,
          },
        })!
        await SessionPromptState.release(sessionID)
        await settlement.finished

        expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID).startReservations).toBe(1)
        expect(() => SessionPromptState.start(sessionID, directory)).toThrow(
          expect.objectContaining({ name: "BusyError" }),
        )
        reservation[Symbol.dispose]()

        expect(SessionPromptState.start(sessionID, directory)).toBeInstanceOf(AbortSignal)
        await SessionPromptState.release(sessionID)
      },
    })
  })
})

describe("TZID recurrence absolute-time selection", () => {
  test("returns the same future occurrences under different host time zones", async () => {
    const script = [
      `import { Recurrence } from "./src/scheduler/recurrence.ts"`,
      `const winter = Recurrence.nextRun("DTSTART;TZID=America/New_York:20260808T090000\\nRRULE:FREQ=DAILY", Date.parse("2026-08-08T12:30:00Z"))`,
      `const daylightTransition = Recurrence.nextRun("DTSTART;TZID=America/New_York:20260308T090000\\nRRULE:FREQ=DAILY", Date.parse("2026-03-08T12:30:00Z"))`,
      `const utc = Recurrence.nextRun("DTSTART:20260808T090000Z\\nRRULE:FREQ=DAILY", Date.parse("2026-08-08T08:30:00Z"))`,
      `console.log(JSON.stringify([winter, daylightTransition, utc]))`,
    ].join(";")
    const run = async (timeZone: string) => {
      const process = Bun.spawn([Bun.which("bun")!, "-e", script], {
        cwd: import.meta.dir.replace(/[\\/]test$/, ""),
        env: { ...Bun.env, TZ: timeZone },
        stdout: "pipe",
        stderr: "pipe",
      })
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
        process.exited,
      ])
      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
      return JSON.parse(stdout.trim()) as number[]
    }

    const expected = [
      Date.parse("2026-08-08T13:00:00Z"),
      Date.parse("2026-03-08T13:00:00Z"),
      Date.parse("2026-08-08T09:00:00Z"),
    ]
    expect(await run("UTC")).toEqual(expected)
    expect(await run("America/Los_Angeles")).toEqual(expected)
    expect(await run("Asia/Tokyo")).toEqual(expected)
  })
})
