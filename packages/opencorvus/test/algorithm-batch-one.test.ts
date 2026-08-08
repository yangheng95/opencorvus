import { describe, expect, spyOn, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { WorktreeOwnershipCriticalSection } from "../src/worktree/ownership-critical-section"
import { SessionPromptState } from "../src/session/prompt/state"
import { SessionStatus } from "../src/session/status"
import { ProjectGitLock } from "../src/worktree/git-lock"
import { Ownership } from "../src/engine/ownership"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { memoryProject } from "./fixture/memory"
import { Instance } from "../src/project/instance"
import { Worktree } from "../src/worktree"

describe("ascending identifier logical clock", () => {
  test("emits a strict total order across counter overflow and wall-clock rollback", () => {
    const lowerBoundary = 2 ** 36 - 1
    const upperBoundary = 2 ** 36
    const lowerBoundaryID = Identifier.create("message", false, lowerBoundary)
    const upperBoundaryID = Identifier.create("message", false, upperBoundary)
    expect(Identifier.timestamp(lowerBoundaryID)).toBe(lowerBoundary)
    expect(Identifier.timestamp(upperBoundaryID)).toBe(upperBoundary)
    expect(lowerBoundaryID < upperBoundaryID).toBe(true)
    expect(Identifier.timestamp(Identifier.create("plan_node", false, upperBoundary + 1))).toBe(upperBoundary + 1)
    const canonicalAscending = Identifier.create("message", false, upperBoundary + 2)
    const canonicalDescending = Identifier.create("message", true, upperBoundary + 2)
    const legacyAscending = `msg_ffffffffffff${"z".repeat(14)}`
    const legacyDescending = `msg_000000000000${"0".repeat(14)}`
    expect(legacyAscending < canonicalAscending).toBe(true)
    expect(canonicalDescending < legacyDescending).toBe(true)

    const timestamp = Date.now() + 60_000
    const ids = Array.from({ length: 4_100 }, () => Identifier.create("message", false, timestamp))
    ids.push(Identifier.create("message", false, timestamp - 10_000))

    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
    const encodedSequence = (id: string) => BigInt(`0x${id.split("_").at(-1)!.slice(13, 25)}`)
    expect(encodedSequence(ids[4_096]) - encodedSequence(ids[0])).toBe(4_096n)
    expect(Identifier.timestamp(ids.at(-1)!)).toBe(timestamp)
  })
})

describe("worktree ownership critical section", () => {
  test("reports durable ownership while acquisition and proof share the removal boundary", async () => {
    const directory = `${import.meta.dir}/owned-worktree-contract`
    const acquisition = WorktreeOwnershipCriticalSection.acquire(directory)
    const active = await WorktreeOwnershipCriticalSection.remove({
      directory,
      proveOwnerless: () => true,
      remove: async () => "removed",
    })
    acquisition[Symbol.dispose]()
    expect(active).toEqual({ status: "owned" })

    const durable = await WorktreeOwnershipCriticalSection.remove({
      directory,
      proveOwnerless: () => false,
      remove: async () => "removed",
    })
    expect(durable).toEqual({ status: "owned" })

    const ownerless = await WorktreeOwnershipCriticalSection.remove({
      directory,
      proveOwnerless: () => true,
      remove: async () => "removed",
    })
    expect(ownerless).toEqual({ status: "removed", value: "removed" })

    let durableOwnerRecorded = true
    await expect(
      WorktreeOwnershipCriticalSection.remove({
        directory,
        proveOwnerless: () => durableOwnerRecorded,
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
      expect(await Ownership.Worktree.hasLiveOwner({ primaryWorktreeDir: root, worktreeDir })).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
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
          isPidAlive: () => false,
          canReleaseDeadOwner: () => false,
        }),
      ).toEqual({ released: 0, preserved: 1 })
      expect((await Ownership.Worktree.list(root)).map((entry) => entry.marker.sessionID)).toEqual([sessionID])

      expect(
        await Ownership.Worktree.reconcileOrphans({
          primaryWorktreeDir: root,
          isPidAlive: () => false,
          canReleaseDeadOwner: () => true,
        }),
      ).toEqual({ released: 1, preserved: 0 })
      expect(await Ownership.Worktree.list(root)).toEqual([])

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
          isPidAlive: () => true,
          canReleaseDeadOwner: () => false,
        }),
      ).toEqual({ released: 1, preserved: 0 })
      expect(await Ownership.Worktree.list(root)).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("renews and releases exact managed-worktree owners through the production lock path", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
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
          (await Ownership.Worktree.list(Instance.project.worktree))
            .filter((entry) => entry.marker.cwd === worktree.directory)
            .map((entry) => entry.marker.sessionID)
            .sort(),
        ).toEqual([firstSessionID, secondSessionID].sort())
        await Worktree.releaseManagedWorktreeSessionOwner({
          directory: worktree.directory,
          sessionID: firstSessionID,
        })
        expect(
          (await Ownership.Worktree.list(Instance.project.worktree))
            .filter((entry) => entry.marker.cwd === worktree.directory)
            .map((entry) => entry.marker.sessionID),
        ).toEqual([secondSessionID])
        await Worktree.remove({ directory: worktree.directory })
        expect(
          (await Ownership.Worktree.list(Instance.project.worktree)).filter(
            (entry) => entry.marker.cwd === worktree.directory,
          ),
        ).toEqual([])
        await Ownership.Worktree.record({
          primaryWorktreeDir: Instance.project.worktree,
          worktreeDir: worktree.directory,
          taskID,
          sessionID: secondSessionID,
        })
        expect(await Worktree.reconcileOrphanWorktreeOwners()).toBe(1)
        expect(
          (await Ownership.Worktree.list(Instance.project.worktree)).filter(
            (entry) => entry.marker.cwd === worktree.directory,
          ),
        ).toEqual([])
      },
    })
  })
})

describe("prompt ownership termination", () => {
  test("releases the complete prompt resource set idempotently", () => {
    const sessionID = Identifier.ascending("session")
    SessionPromptState.start(sessionID, `${import.meta.dir}/prompt-owner-contract`)
    expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID)).toEqual({
      promptOwners: 1,
      messageOwnerRegistries: 1,
      startReservations: 0,
      cancellationReceipts: 0,
    })
    SessionPromptState.release(sessionID)
    SessionPromptState.release(sessionID)
    expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID)).toEqual({
      promptOwners: 0,
      messageOwnerRegistries: 0,
      startReservations: 0,
      cancellationReceipts: 0,
    })
  })

  test("releases ownership and side tables when status termination fails", () => {
    const sessionID = Identifier.ascending("session")
    SessionPromptState.start(sessionID, `${import.meta.dir}/prompt-owner-status-failure`)
    const status = spyOn(SessionStatus, "finishPromptGeneration").mockImplementation(() => {
      throw new Error("status termination failed")
    })
    try {
      expect(() => SessionPromptState.release(sessionID)).toThrow("status termination failed")
    } finally {
      status.mockRestore()
    }
    expect(SessionPromptState.TestHooks.promptResourceSnapshot(sessionID)).toEqual({
      promptOwners: 0,
      messageOwnerRegistries: 0,
      startReservations: 0,
      cancellationReceipts: 0,
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
