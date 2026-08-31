import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { IntentBundle } from "@/intent/bundle"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject } from "./fixture/memory"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { hostGit } from "@/util/git"
import { EngineService } from "@/task-api"

describe("committed Task intent projection", () => {
  test("projects and recovers the canonical Project bundle for an alternate execution directory", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Intent projection test requires the repository test runtime")
    await using project = await memoryProject()
    const executionDirectory = await createManagedTemporaryDirectory(processRoot, "intent-execution-directory-")
    try {
      const initialized = await hostGit(["init"], { cwd: executionDirectory, timeoutProfile: "default" })
      if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString().trim() || "git init failed")
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const taskID = Identifier.ascending("task")
          const now = Date.now()
          const request = "Project one committed Task intent into its canonical owner directory"
          const packageRevision = {
            scope: "built_in" as const,
            projectID: null,
            namespace: "builtin",
            id: "base",
            version: "2026.08.31.1",
            packageDigest: "a".repeat(64),
          }
          const rootSession = Session.prepareRootNext({
            kind: "root",
            directory: executionDirectory,
            title: "Alternate-directory intent projection",
          })
          persistEstablishedTask({
            taskID,
            rootSession,
            now,
            title: "Alternate-directory intent projection",
            request,
            productPillar: "code",
            source: "test",
            metadata: { actor: "user" },
            projectID: Instance.project.id,
            packageRevision,
            executionCapsuleBinding: await prepareTaskProcessBinding({
              mode: "native",
              taskID,
              projectID: Instance.project.id,
              rootDirectory: executionDirectory,
              packageRevisionSHA256: packageRevision.packageDigest,
              timeCreated: now,
            }),
          })

          const canonical = ProjectRuntimePaths.intentPaths(project.path, taskID).absolute
          const first = await IntentBundle.ensure(taskID)
          expect({
            projection: path.resolve(first),
            canonical: path.resolve(canonical),
            request: await fs.readFile(first, "utf8"),
            executionDirectory: path.resolve(rootSession.directory),
          }).toEqual({
            projection: path.resolve(canonical),
            canonical: path.resolve(canonical),
            request: expect.stringContaining(request),
            executionDirectory: path.resolve(executionDirectory),
          })

          await fs.rm(first)
          const recovered = await IntentBundle.ensure(taskID)
          expect({
            projection: path.resolve(recovered),
            request: await fs.readFile(recovered, "utf8"),
          }).toEqual({
            projection: path.resolve(canonical),
            request: expect.stringContaining(request),
          })

          const deleted = await EngineService.deleteSession(rootSession.id, {
            deleteTasks: true,
            projectID: Instance.project.id,
            cancellationOrigin: {
              actor: "user",
              source: "session.delete",
              surface: "api",
              requestID: `delete-${taskID}`,
              reason: "verify committed intent projection retention",
            },
          })
          const projectionState = await fs.stat(recovered).then(
            () => "present" as const,
            (error: NodeJS.ErrnoException) => error.code === "ENOENT" ? "removed" as const : Promise.reject(error),
          )
          expect({ deleted, projectionState }).toEqual({ deleted: true, projectionState: "removed" })

          // Model one committed cleanup failure by restoring only the derived
          // residue. Repeating the same tombstoned deletion must converge it.
          await fs.mkdir(path.dirname(recovered), { recursive: true })
          await fs.writeFile(recovered, "stale committed projection")
          expect(
            await EngineService.deleteSession(rootSession.id, {
              deleteTasks: true,
              projectID: Instance.project.id,
            }),
          ).toBe(true)
          await expect(fs.stat(recovered)).rejects.toMatchObject({ code: "ENOENT" })
        },
      })
    } finally {
      await removeManagedDirectoryTree(executionDirectory)
    }
  }, 30_000)
})
