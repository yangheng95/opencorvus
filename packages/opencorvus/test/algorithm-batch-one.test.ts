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
import { Session } from "../src/session"
import { terminateOwnedSessionPromptInScope } from "../src/engine/cancellation-scope"
import { createExecutionCancellationOrigin } from "../src/session/prompt/cancellation"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { Bus } from "../src/bus"

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
      `console.log(JSON.stringify({ lower: Identifier.timestamp(lowerID), upper: Identifier.timestamp(upperID), plan: Identifier.timestamp(planID), ordered: lowerID < upperID, legacyAscendingOrdered: "msg_ffffffffffffzzzzzzzzzzzzzz" < ascendingID, legacyDescendingOrdered: descendingID < "msg_00000000000000000000000000" }))`,
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
      legacyAscendingOrdered: true,
      legacyDescendingOrdered: true,
    })

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
          projectID: Instance.project.id,
          primaryWorktreeDir: Instance.project.worktree,
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
        SessionPromptState.start(sessionID, managedWorktreeDir)
      },
    })

    await SessionPromptState.release(sessionID)

    expect(
      (await Ownership.Worktree.list(primaryWorktreeDir)).filter(
        (entry) => entry.marker.cwd === managedWorktreeDir && entry.marker.sessionID === sessionID,
      ),
    ).toEqual([])
  })

  test("releases the complete prompt resource set idempotently", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = Identifier.ascending("session")
        SessionPromptState.start(sessionID, `${import.meta.dir}/prompt-owner-contract`)
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
        SessionPromptState.start(sessionID, `${import.meta.dir}/prompt-owner-status-failure`)
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
        await SessionStatus.set(session.id, { type: "streaming" }, {
          publish: false,
          inputMessageID: input.id,
          promptGenerationOwner: owner,
        })

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
          ).toBe(true)
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
