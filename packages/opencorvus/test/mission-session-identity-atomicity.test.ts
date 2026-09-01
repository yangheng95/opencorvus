import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Bus } from "@/bus"
import { ensureMissionSession, MissionSessionTestHooks } from "@/mission/session"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { SessionDeletionFenceError } from "@/session/deletion-cleanup"
import { SessionTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import path from "node:path"

afterEach(async () => {
  await Instance.disposeAll()
  await Bus.TestHooks.disposeOwnedState().catch(() => undefined)
  await resetMemoryDatabase()
})

describe("Mission Session atomic identity", () => {
  test("retained deletion fences deterministic Mission replay before runtime materialization", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = {
          missionID: "retained-mission-replay",
          defaultCwd: project.path,
          productPillar: "code" as const,
          heldExpertSquadIDs: ["base"] as [string, ...string[]],
        }
        const session = await ensureMissionSession(input)
        const missionRoot = ProjectRuntimePaths.missionRoot(project.path, input.missionID)
        expect((await fs.stat(missionRoot)).isDirectory()).toBe(true)

        await fs.rm(missionRoot, { recursive: true, force: true })
        const admitted = Promise.withResolvers<void>()
        const release = Promise.withResolvers<void>()
        await using _materializationCut = MissionSessionTestHooks.installBeforeRuntimeMaterialization(
          async ({ sessionID }) => {
            if (sessionID !== session.id) return
            admitted.resolve()
            await release.promise
          },
        )
        const replayPromise = ensureMissionSession(input).catch((error) => error)
        await admitted.promise
        const deletion = await EngineService.deleteSession(session.id, { projectID: session.projectID })
        release.resolve()
        const replay = await replayPromise

        expect({
          deletion,
          replayFenced: replay instanceof SessionDeletionFenceError,
          runtimeRoot: await fs.stat(missionRoot).then(
            () => "present" as const,
            (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
          ),
        }).toEqual({
          deletion: {
            ok: true,
            status: "tombstoned",
            sessionID: session.id,
            sessionHistoryRetained: true,
            authorizationAuditRetained: true,
            residue: [],
          },
          replayFenced: true,
          runtimeRoot: "missing",
        })
      },
    })
  })

  test("restarts after the post-commit runtime-directory cut with the same complete Session and Created fact", async () => {
    await using project = await memoryProject()
    const input = {
      missionID: "atomic-mission-restart",
      defaultCwd: project.path,
      productPillar: "code" as const,
      heldExpertSquadIDs: ["base"] as [string, ...string[]],
    }
    const missionRoot = ProjectRuntimePaths.missionRoot(project.path, input.missionID)
    await fs.mkdir(ProjectRuntimePaths.missionRoot(project.path, "placeholder-mission"), { recursive: true })
    await fs.writeFile(missionRoot, "block Mission directory creation")
    const expectedRuntimeFailure = `EEXIST: file already exists, mkdir '${missionRoot}'`

    let committedSessionID = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        using _publicationCut = Bus.TestHooks.suppressAutomaticDurableDrain()
        try {
          await ensureMissionSession(input)
          throw new Error("Expected Mission runtime-directory materialization to fail")
        } catch (error) {
          expect(error).toMatchObject({ code: "EEXIST", path: missionRoot })
          expect((error as Error).message).toBe(expectedRuntimeFailure)
        }

        const rows = Database.use((db) =>
          db
            .select()
            .from(SessionTable)
            .where(eq(SessionTable.kind, "mission"))
            .all()
            .map(Session.fromRow),
        )
        expect(rows).toHaveLength(1)
        committedSessionID = rows[0]!.id
        const canonicalMetadata = {
          mission: {
            id: input.missionID,
            channelKey: `mission:${input.missionID}`,
            cwd: project.path,
            productPillar: input.productPillar,
            visibleExpertSquadIDs: input.heldExpertSquadIDs,
          },
        }
        expect(rows[0]).toMatchObject({
          id: committedSessionID,
          kind: "mission",
          directory: project.path,
          metadata: canonicalMetadata,
        })
        expect(
          Bus.TestHooks.outbox()
            .filter((row) => row.event_type === Session.Event.Created.type)
            .map((row) => row.properties),
        ).toEqual([
          {
            info: expect.objectContaining({
              id: committedSessionID,
              kind: "mission",
              directory: project.path,
              metadata: canonicalMetadata,
            }),
          },
        ])
      },
    })

    await Instance.disposeAll()
    await fs.rm(missionRoot)

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const resumed = await ensureMissionSession(input)
        expect(resumed).toMatchObject({
          id: committedSessionID,
          missionID: input.missionID,
          productPillar: input.productPillar,
          metadata: {
            mission: {
              id: input.missionID,
              visibleExpertSquadIDs: input.heldExpertSquadIDs,
            },
          },
        })
        expect(
          Database.use((db) =>
            db.select({ id: SessionTable.id }).from(SessionTable).where(eq(SessionTable.kind, "mission")).all(),
          ),
        ).toEqual([{ id: committedSessionID }])
        expect((await fs.stat(missionRoot)).isDirectory()).toBe(true)
      },
    })
  })

  test("serializes independent processes and recovers an exited post-commit creator", async () => {
    await using project = await memoryProject()
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Mission process test requires the repository test runtime")
    const sharedRuntime = await createManagedTemporaryDirectory(processRoot, "mission-process-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "mission-process-barrier-")
    const worker = path.join(import.meta.dir, "fixture", "mission-session-process-worker.ts")
    const environment = {
      ...process.env,
      OPENCORVUS_HOME: sharedRuntime,
      OPENCORVUS_TEST_PROCESS_ROOT: processRoot,
    }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: "init" | "race" | "cut" | "recover") => {
      const child = Bun.spawn([process.execPath, `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`, worker, mode, project.path, barrier], {
        cwd: path.join(import.meta.dir, ".."),
        env: environment,
        stdout: "pipe",
        stderr: "pipe",
      })
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as Record<string, unknown>
    }
    const waitForReady = async (children: ReturnType<typeof spawn>[]) => {
      const deadline = Date.now() + 30_000
      while ((await fs.readdir(barrier)).filter((entry) => entry.endsWith(".ready")).length < children.length) {
        for (const child of children) {
          if (child.exitCode !== null) {
            const [stdout, stderr] = await Promise.all([
              new Response(child.stdout).text(),
              new Response(child.stderr).text(),
            ])
            throw new Error(`Mission race worker exited before barrier (${child.exitCode}): ${stderr || stdout}`)
          }
        }
        if (Date.now() >= deadline) throw new Error("Mission race workers did not reach the barrier within 30 seconds")
        await Bun.sleep(5)
      }
    }

    try {
      expect(await read(spawn("init"))).toEqual({ initialized: true })
      const first = spawn("race")
      const second = spawn("race")
      await waitForReady([first, second])
      await fs.writeFile(path.join(barrier, "go"), "go")
      const raced = await Promise.all([read(first), read(second)])
      expect(raced[0]!.id).toBe(raced[1]!.id)

      await removeManagedDirectoryTree(sharedRuntime)
      await fs.mkdir(sharedRuntime, { recursive: true })
      const cutProcess = spawn("cut")
      const [cutStderr, cutExitCode] = await Promise.all([
        new Response(cutProcess.stderr).text(),
        cutProcess.exited,
      ])
      expect(cutExitCode, cutStderr).toBe(86)
      const cut = JSON.parse(await fs.readFile(path.join(barrier, "cut.json"), "utf8")) as Record<string, unknown>
      expect(cut.metadata).toEqual({
        mission: {
          id: "cross-process-cut",
          channelKey: "mission:cross-process-cut",
          cwd: project.path,
          productPillar: "code",
          visibleExpertSquadIDs: ["base"],
        },
      })
      expect(cut.created).toEqual({ info: expect.objectContaining({ id: cut.id, metadata: cut.metadata }) })
      const recovered = await read(spawn("recover"))
      expect(recovered).toEqual({ id: cut.id, rows: [{ id: cut.id }], runtimeDirectory: true })
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill()
      }
      await Promise.allSettled(children.map((child) => child.exited))
      await removeManagedDirectoryTree(sharedRuntime)
      await removeManagedDirectoryTree(barrier)
    }
  }, 90_000)

  test("enforces complete immutable launch identity while permitting exact relocation and mutable state", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const launch = {
          id: "storage-mission",
          channelKey: "mission:storage-mission",
          cwd: project.path,
          productPillar: "code",
          visibleExpertSquadIDs: ["base"],
        }
        const complete = await Session.createNext({
          directory: project.path,
          kind: "mission",
          metadata: { mission: launch },
        })
        expect(await Session.get(complete.id)).toMatchObject({
          kind: "mission",
          metadata: { mission: launch },
        })

        for (const field of ["channelKey", "cwd", "productPillar", "visibleExpertSquadIDs"] as const) {
          const incompleteLaunch: Partial<typeof launch> = { ...launch }
          delete incompleteLaunch[field]
          const incomplete = await Session.prepareNext({
            directory: project.path,
            kind: "mission",
            metadata: { mission: incompleteLaunch },
          })
          try {
            Session.persistPreparedNext(incomplete)
            throw new Error(`Expected incomplete Mission ${field} rejection`)
          } catch (error) {
            expect((error as Error).message).toBe("session: mission identity metadata is incomplete")
          }
        }

        const duplicate = await Session.prepareNext({
          directory: project.path,
          kind: "mission",
          metadata: { mission: launch },
        })
        try {
          Session.persistPreparedNext(duplicate)
          throw new Error("Expected duplicate Mission identity rejection")
        } catch (error) {
          expect((error as Error).message).toBe(
            "UNIQUE constraint failed: index 'session_mission_identity_idx'",
          )
        }

        const withPendingState = await Session.mergeMetadata({
          sessionID: complete.id,
          patch: { mission: { ...launch, pendingPrompt: { text: "Continue" } } },
        })
        expect(withPendingState.metadata).toEqual({
          mission: { ...launch, pendingPrompt: { text: "Continue" } },
        })

        for (const launchPatch of [
          { channelKey: "mission:different" },
          { productPillar: "work" },
          { visibleExpertSquadIDs: ["different"] },
          { cwd: path.join(project.path, "different") },
        ]) {
          try {
            await Session.mergeMetadata({
              sessionID: complete.id,
              patch: { mission: { ...launch, ...launchPatch } },
            })
            throw new Error("Expected immutable Mission launch identity rejection")
          } catch (error) {
            expect((error as Error).message).toBe("session: mission identity metadata is immutable")
          }
        }

        const relocatedDirectory = path.join(project.path, "relocated")
        Database.transaction((db) =>
          Session.relocateProject(
            {
              projectID: Instance.project.id,
              sourceDirectory: project.path,
              destinationDirectory: relocatedDirectory,
            },
            db,
          ),
        )
        expect(await Session.get(complete.id)).toMatchObject({
          directory: relocatedDirectory,
          metadata: { mission: { ...launch, cwd: relocatedDirectory, pendingPrompt: { text: "Continue" } } },
        })
      },
    })
  })
})
