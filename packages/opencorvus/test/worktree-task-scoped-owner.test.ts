import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "../src/id/id"
import { Ownership } from "../src/engine/ownership"
import { Instance } from "../src/project/instance"
import { ProjectDirectoryAdmission } from "../src/project/directory-admission"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { Session } from "../src/session"
import { SessionPromptState } from "../src/session/prompt/state"
import { Worktree } from "../src/worktree"
import { releaseManagedWorktreeSessionOwner } from "../src/worktree/managed-session-owner"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("a first Task-scoped worktree keeps exact typed directory identities through owner and Session settlement", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      let taskID = Identifier.ascending("task"),
        sessionID = Identifier.ascending("session")
      while (!/[A-Z]/.test(taskID)) taskID = Identifier.ascending("task")
      while (!/[A-Z]/.test(sessionID)) sessionID = Identifier.ascending("session")
      const requested = ProjectRuntimePaths.worktreeDir(project.path, taskID, sessionID)
      const before = await ProjectDirectoryAdmission.resolve(requested)
      const created = await Worktree.create({
        name: "scoped-owner",
        taskID,
        sessionID,
        startCommand: "echo scoped-effect >> startup.txt",
      })
      expect({
        directory: created.directory,
        taskNames: await fs.readdir(ProjectRuntimePaths.taskCollectionRoot(project.path)),
        sessionNames: await fs.readdir(path.dirname(ProjectRuntimePaths.sessionRoot(project.path, taskID, sessionID))),
        key: await ProjectDirectoryAdmission.key(created.directory),
        effect: await fs.readFile(path.join(created.directory, "startup.txt"), "utf8"),
      }).toEqual({
        directory: before.physicalPath,
        taskNames: [taskID],
        sessionNames: [sessionID],
        key: before.directoryKey,
        effect: expect.stringContaining("scoped-effect"),
      })
      const snapshot = await Ownership.Worktree.snapshot(project.path)
      expect({
        integrity: snapshot.integrity,
        markers: snapshot.entries.map((entry) => (entry.status === "valid" ? entry.marker : entry)),
      }).toEqual({
        integrity: { status: "complete" },
        markers: [expect.objectContaining({ taskID, sessionID, cwd: created.directory })],
      })
      await Worktree.renewManagedWorktreeOwner({ directory: created.directory, taskID, sessionID })
      const released = await releaseManagedWorktreeSessionOwner({
        projectID: Instance.project.id,
        primaryWorktreeDir: project.path,
        directory: created.directory,
        sessionID,
      })
      expect(released).toEqual({
        released: [{ taskID, sessionID, worktreeDir: created.directory }],
        integrity: { status: "complete" },
      })
      await Worktree.renewManagedWorktreeOwner({ directory: created.directory, taskID, sessionID })
      await Session.createNext({
        id: sessionID,
        kind: "assistant",
        directory: created.directory,
        title: "Case-preserving scoped owner",
      })
      const owner = SessionPromptState.start(sessionID, created.directory)
      expect(owner).toBeInstanceOf(AbortSignal)
      await SessionPromptState.release(sessionID)
      const proof = await Ownership.Worktree.proveOwnerless({
        primaryWorktreeDir: project.path,
        worktreeDir: created.directory,
      })
      expect({
        status: proof.status,
        integrity: proof.status === "ownerless" ? proof.snapshot.integrity : undefined,
      }).toEqual({ status: "ownerless", integrity: { status: "complete" } })
    },
  })
}, 120_000)
