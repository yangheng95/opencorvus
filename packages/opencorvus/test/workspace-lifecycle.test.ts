import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ensureGitProjectMetadata } from "@/engine/git"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import { deleteProject, ProjectDeleteTestHooks } from "@/project/delete"
import { ProjectWorktreeDeletion } from "@/project/worktree-deletion"
import { Workspace } from "@/workspace/workspace"
import { WorkspaceLifecycle } from "@/workspace/lifecycle"
import { Worktree } from "@/worktree"
import { Filesystem } from "@/util/filesystem"
import { Server } from "@/server/server"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { currentTestChildEnvironment } from "./fixture/current-test-child-environment"
import { setDurablePublicationTestCutHook } from "@opencorvus-ai/util/durable-publication"
import { observeRuntimeProcessOccurrence } from "@/runtime/process-occurrence"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function git(directory: string, args: string[]): Promise<string> {
  const child = Bun.spawn(["git", ...args], { cwd: directory, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || `git ${args.join(" ")} failed`)
  return stdout.trim()
}

async function freezeMetadata(directory: string): Promise<void> {
  await git(directory, ["config", "core.autocrlf", "true"])
  await ensureGitProjectMetadata(directory)
  await git(directory, ["add", ".gitattributes", ".gitignore"])
  await git(directory, ["commit", "-m", "freeze workspace lifecycle fixture"])
}

async function createWorkspaceInPeer(directory: string, id: string): Promise<Workspace.Info> {
  const child = Bun.spawn(
    [process.execPath, path.join(import.meta.dir, "fixture", "workspace-lifecycle-process-worker.ts"), directory, id],
    {
      cwd: path.join(import.meta.dir, ".."),
      env: currentTestChildEnvironment(),
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || `Workspace peer exited ${exitCode}`)
  return Workspace.Info.parse(JSON.parse(stdout.trim()))
}

async function waitForPath(target: string): Promise<void> {
  const deadline = Date.now() + 30_000
  for (;;) {
    if (await Filesystem.exists(target)) return
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe("Workspace durable lifecycle", () => {
  test("startup recovery creates the frozen named Workspace after an intent-only crash cut", async () => {
    await using project = await memoryProject()
    const id = Identifier.ascending("workspace")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        setDurablePublicationTestCutHook((cut, kind) => {
          if (kind.startsWith("workspace-lifecycle-") && cut === "occurrence-published") {
            throw new Error("crash after Workspace intent publication")
          }
        })
        try {
          await expect(Workspace.create({ id, projectID: Instance.project.id })).rejects.toThrow(
            "crash after Workspace intent publication",
          )
        } finally {
          setDurablePublicationTestCutHook()
        }
        const plan = await Worktree.planNamed(`workspace-${id}`)
        expect({ row: await Workspace.get(id), directory: await Filesystem.exists(plan.info.directory) }).toEqual({
          row: undefined,
          directory: false,
        })
      },
    })

    const recovery = await Workspace.recoverOpenLifecycles()
    expect({ recovery, row: await Workspace.get(id), admissions: WorkspaceLifecycle.listCreateAdmissions() }).toEqual({
      recovery: { recovered: 1, retainedProjectDeletion: 0, failures: [] },
      row: expect.objectContaining({ id }),
      admissions: [],
    })
  }, 180_000)

  test("startup recovery publishes the same ready Workspace after a pre-row crash cut", async () => {
    await using project = await memoryProject()
    const id = Identifier.ascending("workspace")
    let plannedDirectory = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        using cut = Workspace.TestHooks.installBeforeRowPublication((info) => {
          plannedDirectory = info.config.directory
          throw new Error("crash before Workspace row publication")
        })
        await expect(Workspace.create({ id, projectID: Instance.project.id })).rejects.toThrow(
          "crash before Workspace row publication",
        )
        expect({ row: await Workspace.get(id), directory: await Filesystem.exists(plannedDirectory) }).toEqual({
          row: undefined,
          directory: true,
        })
      },
    })

    const recovery = await Workspace.recoverOpenLifecycles()
    const recovered = await Workspace.get(id)
    expect({ recovery, recovered, admissions: WorkspaceLifecycle.listCreateAdmissions() }).toEqual({
      recovery: { recovered: 1, retainedProjectDeletion: 0, failures: [] },
      recovered: expect.objectContaining({ id, config: { type: "worktree", directory: plannedDirectory } }),
      admissions: [],
    })
  }, 180_000)

  test("Project-scoped Workspace recovery reads only that Project current frontier", async () => {
    await using firstProject = await memoryProject()
    await using secondProject = await memoryProject()
    const pending = async (directory: string) => {
      let projectID = ""
      let workspaceDirectory = ""
      await Instance.provide({
        directory,
        fn: async () => {
          await freezeMetadata(directory)
          projectID = Instance.project.id
          using cut = Workspace.TestHooks.installBeforeRowPublication((info) => {
            workspaceDirectory = info.config.directory
            throw new Error("hold current Workspace frontier")
          })
          await expect(
            Workspace.create({ id: Identifier.ascending("workspace"), projectID: Instance.project.id }),
          ).rejects.toThrow("hold current Workspace frontier")
        },
      })
      return { projectID, workspaceDirectory }
    }
    const first = await pending(firstProject.path)
    await pending(secondProject.path)
    const observed: Array<{ projectID?: string; frontierCount: number }> = []
    using query = WorkspaceLifecycle.TestHooks.installAfterCurrentFrontierQuery((input) => observed.push(input))

    const directories = await Workspace.lifecycleDirectories(first.projectID)

    expect({ directories, observed }).toEqual({
      directories: [first.workspaceDirectory],
      observed: [{ projectID: first.projectID, frontierCount: 1 }],
    })
  }, 240_000)

  test("publishes one deterministic ready Workspace and retires its exact Git child", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const id = Identifier.ascending("workspace")
        const created = await Workspace.create({ id, projectID: Instance.project.id })
        const replay = await Workspace.create({ id, projectID: Instance.project.id })

        expect({ replay, rows: Workspace.list(Instance.project) }).toEqual({ replay: created, rows: [created] })
        expect(
          (await Worktree.listRegisteredWorktrees(project.path)).some(
            (entry) => Project.samePath(entry.path, created.config.directory) && entry.branch === created.branch,
          ),
        ).toBe(true)

        const removed = await Workspace.remove({ id, projectID: Instance.project.id })
        expect({
          removed,
          row: await Workspace.get(id),
          directory: await Filesystem.exists(created.config.directory),
        }).toEqual({
          removed: created,
          row: undefined,
          directory: false,
        })
        expect(
          await git(project.path, ["show-ref", "--verify", `refs/heads/${created.branch}`]).catch(() => "missing"),
        ).toBe("missing")
      },
    })
  }, 180_000)

  test("removes an ownerless GC worktree without manufacturing Project sandbox authority", async () => {
    await using project = await memoryProject()
    const result = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const managed = await Worktree.create({ name: `gc-ownerless-${Date.now()}` })
        await Project.removeSandbox(Instance.project.id, managed.directory)
        const removal = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: managed.directory,
        })
        return {
          managed,
          removal,
          sandboxes: Project.get(Instance.project.id)?.sandboxes,
          directory: await Filesystem.exists(managed.directory),
          branch: await git(project.path, ["show-ref", "--verify", `refs/heads/${managed.branch}`]).catch(
            () => "missing",
          ),
        }
      },
    })

    expect(result).toEqual({
      managed: expect.objectContaining({ directory: expect.any(String), branch: expect.any(String) }),
      removal: expect.objectContaining({ removed: true, proof: "ownerless" }),
      sandboxes: [],
      directory: false,
      branch: "missing",
    })
  }, 180_000)

  test("the public Workspace route replays the caller-supplied identity and returns its exact delete receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: () => freezeMetadata(project.path) })
    const id = Identifier.ascending("workspace")
    const createRequest = () =>
      Server.App().request(`/experimental/workspace/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
        body: "{}",
      })
    const first = await createRequest()
    const firstBody = await first.json()
    const replay = await createRequest()
    const replayBody = await replay.json()
    expect({ firstStatus: first.status, replayStatus: replay.status, replayBody }).toEqual({
      firstStatus: 200,
      replayStatus: 200,
      replayBody: firstBody,
    })

    const removed = await Server.App().request(`/experimental/workspace/${id}`, {
      method: "DELETE",
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: removed.status, body: await removed.json(), row: await Workspace.get(id) }).toEqual({
      status: 200,
      body: firstBody,
      row: undefined,
    })
  }, 180_000)

  test("two backends converge one caller-supplied Workspace occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: () => freezeMetadata(project.path) })
    await Instance.disposeAll()
    const id = Identifier.ascending("workspace")
    const [first, second] = await Promise.all([
      createWorkspaceInPeer(project.path, id),
      createWorkspaceInPeer(project.path, id),
    ])
    const registered = await Instance.provideProjectIdentity({
      directory: project.path,
      fn: () => ({
        rows: Workspace.list(Instance.project),
        registered: Worktree.listRegisteredWorktrees(project.path),
      }),
    })
    const matchingRegistrations = (await registered.registered).filter((entry) =>
      Project.samePath(entry.path, first.config.directory),
    )
    expect({
      first,
      second,
      rows: registered.rows,
      matchingRegistrationCount: matchingRegistrations.length,
      branch: matchingRegistrations[0]?.branch,
    }).toEqual({
      first: second,
      second,
      rows: [second],
      matchingRegistrationCount: 1,
      branch: second.branch,
    })
  }, 180_000)

  test("startup takes over one open Workspace journal after its real backend dies", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: () => freezeMetadata(project.path) })
    await Instance.disposeAll()
    const id = Identifier.ascending("workspace")
    const barrier = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, `workspace-dead-${id}.published`)
    const release = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, `workspace-dead-${id}.release`)
    const child = Bun.spawn(
      [
        process.execPath,
        path.join(import.meta.dir, "fixture", "workspace-lifecycle-process-worker.ts"),
        project.path,
        id,
        barrier,
        release,
      ],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: currentTestChildEnvironment(),
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    await waitForPath(barrier)
    child.kill()
    const [exitCode] = await Promise.all([child.exited, new Response(child.stderr).text()])
    if (exitCode === 0) throw new Error("Workspace crash fixture exited normally")

    const recovery = await Workspace.recoverOpenLifecycles(observeRuntimeProcessOccurrence)
    expect({
      recovery,
      workspace: await Workspace.get(id),
      admissions: WorkspaceLifecycle.listCreateAdmissions(),
    }).toEqual({
      recovery: { recovered: 1, retainedProjectDeletion: 0, failures: [] },
      workspace: expect.objectContaining({ id, projectID: expect.any(String) }),
      admissions: [],
    })
  }, 240_000)

  test("public removal takes over a dead registration admission for the exact physical occurrence", async () => {
    await using project = await memoryProject()
    const managed = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        return Worktree.create({ name: `dead-registration-${Date.now()}` })
      },
    })
    await Instance.disposeAll()
    const barrier = path.join(
      process.env.OPENCORVUS_TEST_PROCESS_ROOT!,
      `worktree-dead-registration-${Date.now()}.admitted`,
    )
    const child = Bun.spawn(
      [
        process.execPath,
        path.join(import.meta.dir, "fixture", "worktree-registration-process-worker.ts"),
        project.path,
        managed.directory,
        barrier,
      ],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: currentTestChildEnvironment(),
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    await waitForPath(barrier)
    child.kill()
    const exitCode = await child.exited
    if (exitCode === 0) throw new Error("Registration crash fixture exited normally")

    const result = await Instance.provideProjectIdentity({
      directory: project.path,
      fn: async () => ({
        removal: await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: managed.directory,
          releaseSandboxOwnership: true,
        }),
        projectID: Instance.project.id,
      }),
    })
    expect({
      removal: result.removal,
      directory: await Filesystem.exists(managed.directory),
      sandboxes: Project.get(result.projectID)?.sandboxes,
    }).toEqual({
      removal: expect.objectContaining({ removed: true, proof: "ownerless" }),
      directory: false,
      sandboxes: [],
    })
  }, 240_000)

  test("Project deletion cannot cross a peer Workspace creation admitted before its journal", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: () => freezeMetadata(project.path) })
    await Instance.disposeAll()
    const id = Identifier.ascending("workspace")
    const barrier = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, `workspace-create-${id}.published`)
    const release = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, `workspace-create-${id}.release`)
    const child = Bun.spawn(
      [
        process.execPath,
        path.join(import.meta.dir, "fixture", "workspace-lifecycle-process-worker.ts"),
        project.path,
        id,
        barrier,
        release,
      ],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: currentTestChildEnvironment(),
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    await waitForPath(barrier)
    const current = Project.list().find((candidate) => candidate.worktree === project.path)
    if (!current) throw new Error("Project fixture was not registered")
    try {
      await expect(
        deleteProject(current, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_project_delete_during_workspace_create",
          reason: "Prove Workspace creation admission precedes Project deletion",
        }),
      ).rejects.toMatchObject({ name: "WorkspaceLifecycleAdmissionConflictError" })
    } finally {
      await fs.writeFile(release, "release")
    }
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || `Workspace peer exited ${exitCode}`)
    const created = Workspace.Info.parse(JSON.parse(stdout.trim()))

    const committed = await deleteProject(Project.get(current.id)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_project_delete_after_workspace_create",
      reason: "Delete Project after the admitted Workspace is fully published",
    })
    expect({
      committed,
      project: Project.get(current.id),
      directory: await Filesystem.exists(created.config.directory),
    }).toEqual({
      committed: expect.objectContaining({ ok: true, status: "committed", projectID: current.id }),
      project: undefined,
      directory: false,
    })
  }, 240_000)

  test("replays the frozen branch identity after a prune cut and preserves a replacement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const id = Identifier.ascending("workspace")
        const created = await Workspace.create({ id, projectID: Instance.project.id })
        const originalTarget = await git(project.path, ["rev-parse", `${created.branch}^{commit}`])
        let cut = true
        using hook = Worktree.TestHooks.installBeforeBranchRemoval(() => {
          if (!cut) return
          cut = false
          throw new Error("crash after registry prune")
        })
        await expect(Workspace.remove({ id, projectID: Instance.project.id })).rejects.toThrow(
          "crash after registry prune",
        )
        expect({ row: await Workspace.get(id), directory: await Filesystem.exists(created.config.directory) }).toEqual({
          row: created,
          directory: false,
        })

        await fs.writeFile(path.join(project.path, "replacement.txt"), "replacement")
        await git(project.path, ["add", "replacement.txt"])
        await git(project.path, ["commit", "-m", "replacement branch target"])
        const replacementTarget = await git(project.path, ["rev-parse", "HEAD"])
        await git(project.path, ["branch", "-f", created.branch!, replacementTarget])

        await expect(Workspace.remove({ id, projectID: Instance.project.id })).rejects.toThrow(
          "Refusing to delete replaced worktree branch",
        )
        expect(await git(project.path, ["rev-parse", `${created.branch}^{commit}`])).toBe(replacementTarget)

        await git(project.path, ["branch", "-f", created.branch!, originalTarget])
        expect(await Workspace.remove({ id, projectID: Instance.project.id })).toEqual(created)
        expect(await Workspace.get(id)).toBeUndefined()
      },
    })
  }, 180_000)

  test("startup recovery completes the exact public delete after a post-prune crash cut", async () => {
    await using project = await memoryProject()
    let created: Awaited<ReturnType<typeof Workspace.create>> | undefined
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        created = await Workspace.create({
          id: Identifier.ascending("workspace"),
          projectID: Instance.project.id,
        })
        using cut = Worktree.TestHooks.installBeforeBranchRemoval(() => {
          throw new Error("crash before public Workspace branch settlement")
        })
        await expect(Workspace.remove({ id: created.id, projectID: Instance.project.id })).rejects.toThrow(
          "crash before public Workspace branch settlement",
        )
      },
    })
    if (!created) throw new Error("Workspace fixture was not created")

    const recovery = await Workspace.recoverOpenLifecycles()
    expect({
      recovery,
      row: await Workspace.get(created.id),
      directory: await Filesystem.exists(created.config.directory),
      branch: await git(project.path, ["show-ref", "--verify", `refs/heads/${created.branch}`]).catch(() => "missing"),
    }).toEqual({
      recovery: { recovered: 1, retainedProjectDeletion: 0, failures: [] },
      row: undefined,
      directory: false,
      branch: "missing",
    })
  }, 180_000)

  test("Project deletion settles every Workspace Git child before aggregate cascade", async () => {
    await using project = await memoryProject()
    const children = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const workspaces = await Promise.all(
          [Identifier.ascending("workspace"), Identifier.ascending("workspace")].map((id) =>
            Workspace.create({ id, projectID: Instance.project.id }),
          ),
        )
        const managed = await Worktree.create({ name: `project-child-${Date.now()}` })
        return { workspaces, managed }
      },
    })
    const current = Project.list().find((candidate) => candidate.worktree === project.path)
    if (!current) throw new Error("Project fixture was not registered")
    const result = await deleteProject(current, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_workspace_lifecycle_project_delete",
      reason: "Delete Project after settling Workspace children",
    })

    expect({ result, project: Project.get(current.id), rows: Workspace.list(current) }).toEqual({
      result: expect.objectContaining({ ok: true, status: "committed", projectID: current.id }),
      project: undefined,
      rows: [],
    })
    for (const workspace of children.workspaces) {
      expect(await Filesystem.exists(workspace.config.directory)).toBe(false)
      expect(
        await git(project.path, ["show-ref", "--verify", `refs/heads/${workspace.branch}`]).catch(() => "missing"),
      ).toBe("missing")
    }
    expect(await Filesystem.exists(children.managed.directory)).toBe(false)
    expect(
      await git(project.path, ["show-ref", "--verify", `refs/heads/${children.managed.branch}`]).catch(() => "missing"),
    ).toBe("missing")
  }, 240_000)

  test("Project deletion rolls forward a partially settled Workspace child set on retry", async () => {
    await using project = await memoryProject()
    const workspaces = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const first = await Workspace.create({
          id: Identifier.ascending("workspace"),
          projectID: Instance.project.id,
        })
        const second = await Workspace.create({
          id: Identifier.ascending("workspace"),
          projectID: Instance.project.id,
        })
        return [first, second]
      },
    })
    const current = Project.list().find((candidate) => candidate.worktree === project.path)
    if (!current) throw new Error("Project fixture was not registered")
    let branchCuts = 0
    {
      using cut = Worktree.TestHooks.installBeforeBranchRemoval(() => {
        branchCuts += 1
        if (branchCuts === 2) throw new Error("crash on second Project Workspace child")
      })
      await expect(
        deleteProject(current, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_workspace_project_delete_partial",
          reason: "Exercise partial Workspace child settlement",
        }),
      ).rejects.toThrow("ProjectDeletePendingError")
    }
    const retainedRows = Workspace.list(current)
    expect({
      project: Project.get(current.id),
      retainedRows,
      firstDirectory: await Filesystem.exists(workspaces[0]!.config.directory),
      secondDirectory: await Filesystem.exists(workspaces[1]!.config.directory),
    }).toEqual({
      project: expect.objectContaining({ id: current.id }),
      retainedRows: [workspaces[1]],
      firstDirectory: false,
      secondDirectory: false,
    })

    const retry = await deleteProject(Project.get(current.id)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_workspace_project_delete_partial_retry",
      reason: "Resume the exact partial Workspace child set",
    })
    expect({ retry, project: Project.get(current.id), rows: Workspace.list(current) }).toEqual({
      retry: expect.objectContaining({ ok: true, status: "committed", projectID: current.id }),
      project: undefined,
      rows: [],
    })
  }, 300_000)

  test("Project deletion resumes a retained Workspace frontier after row retirement", async () => {
    await using project = await memoryProject()
    const workspace = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        return Workspace.create({
          id: Identifier.ascending("workspace"),
          projectID: Instance.project.id,
        })
      },
    })
    const current = Project.list().find((candidate) => candidate.worktree === project.path)
    if (!current) throw new Error("Project fixture was not registered")
    {
      using cut = Workspace.TestHooks.installBeforeDeleteCommit(() => {
        throw new Error("crash after Workspace row retirement")
      })
      await expect(
        deleteProject(current, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_workspace_row_retirement_cut",
          reason: "Exercise retained Workspace frontier recovery",
        }),
      ).rejects.toThrow("ProjectDeletePendingError")
    }
    const retained = await WorkspaceLifecycle.currentEntries(current.id)
    expect({
      project: Project.get(current.id),
      workspace: await Workspace.get(workspace.id),
      retained: retained.map((entry) => ({
        workspaceID: entry.workspaceID,
        lifecycle: entry.lifecycle,
        terminal: entry.terminal,
      })),
    }).toEqual({
      project: expect.objectContaining({ id: current.id }),
      workspace: undefined,
      retained: [{ workspaceID: workspace.id, lifecycle: "deleting", terminal: false }],
    })

    const retry = await deleteProject(Project.get(current.id)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_workspace_row_retirement_retry",
      reason: "Resume the retained Workspace frontier before Project cascade",
    })
    expect({ retry, project: Project.get(current.id) }).toEqual({
      retry: expect.objectContaining({ ok: true, status: "committed", projectID: current.id }),
      project: undefined,
    })
  }, 240_000)

  test("Project deletion resumes a frozen managed-worktree child after branch settlement is interrupted", async () => {
    await using project = await memoryProject()
    const managed = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        return Worktree.create({ name: `project-journal-${Date.now()}` })
      },
    })
    const current = Project.list().find((candidate) => candidate.worktree === project.path)
    if (!current) throw new Error("Project fixture was not registered")
    {
      using cut = Worktree.TestHooks.installBeforeBranchRemoval(() => {
        throw new Error("crash before managed Project child branch settlement")
      })
      await expect(
        deleteProject(current, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_managed_project_child_partial",
          reason: "Exercise managed Project child handoff",
        }),
      ).rejects.toThrow("ProjectDeletePendingError")
    }
    expect({
      project: Project.get(current.id),
      directory: await Filesystem.exists(managed.directory),
      branch: await git(project.path, ["rev-parse", `${managed.branch}^{commit}`]),
    }).toEqual({
      project: expect.objectContaining({ id: current.id }),
      directory: false,
      branch: expect.any(String),
    })

    const retry = await deleteProject(Project.get(current.id)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_managed_project_child_partial_retry",
      reason: "Resume the exact managed Project child handoff",
    })
    expect({
      retry,
      project: Project.get(current.id),
      branch: await git(project.path, ["show-ref", "--verify", `refs/heads/${managed.branch}`]).catch(() => "missing"),
    }).toEqual({
      retry: expect.objectContaining({ ok: true, status: "committed", projectID: current.id }),
      project: undefined,
      branch: "missing",
    })
  }, 240_000)

  test("Project deletion finds the frozen managed-child journal after its junction alias is removed", async () => {
    await using project = await memoryProject()
    const managed = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        const created = await Worktree.create({ name: `project-alias-journal-${Date.now()}` })
        const alias = path.join(path.dirname(created.directory), `${path.basename(created.directory)}-alias`)
        await fs.symlink(created.directory, alias, process.platform === "win32" ? "junction" : "dir")
        Database.use((db) =>
          db
            .update(ProjectTable)
            .set({ sandboxes: [alias], time_updated: Date.now() })
            .where(eq(ProjectTable.id, Instance.project.id))
            .run(),
        )
        return { ...created, alias }
      },
    })
    const current = Project.list().find((candidate) => candidate.worktree === project.path)
    if (!current) throw new Error("Project fixture was not registered")
    {
      using cut = ProjectWorktreeDeletion.TestHooks.installBeforeCommit(() => {
        throw new Error("crash after managed-child alias settlement")
      })
      await expect(
        deleteProject(current, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_managed_project_alias_partial",
          reason: "Exercise frozen managed-child alias journal lookup",
        }),
      ).rejects.toThrow("ProjectDeletePendingError")
    }
    expect({
      project: Project.get(current.id),
      directory: await Filesystem.exists(managed.directory),
      alias: await fs.lstat(managed.alias).then(
        () => "present",
        () => "missing",
      ),
      branch: await git(project.path, ["show-ref", "--verify", `refs/heads/${managed.branch}`]).catch(() => "missing"),
    }).toEqual({
      project: expect.objectContaining({ id: current.id }),
      directory: false,
      alias: "missing",
      branch: "missing",
    })

    const retry = await deleteProject(Project.get(current.id)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_managed_project_alias_partial_retry",
      reason: "Resume the frozen managed-child alias journal",
    })
    expect({ retry, project: Project.get(current.id) }).toEqual({
      retry: expect.objectContaining({ ok: true, status: "committed", projectID: current.id }),
      project: undefined,
    })
  }, 240_000)

  test("Project deletion advances the managed-child journal chain when the same path has a new occurrence", async () => {
    await using project = await memoryProject()
    const name = `project-recreated-child-${Date.now()}`
    const first = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await freezeMetadata(project.path)
        return Worktree.create({ name })
      },
    })
    const current = Project.list().find((candidate) => candidate.worktree === project.path)
    if (!current) throw new Error("Project fixture was not registered")
    {
      using cut = ProjectDeleteTestHooks.replaceBeforeDatabaseCommit(() => {
        throw new Error("crash after first managed-child terminal receipt")
      })
      await expect(
        deleteProject(current, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_project_recreated_child_first",
          reason: "Settle the first physical child occurrence",
        }),
      ).rejects.toThrow("ProjectDeletePendingError")
    }
    expect(await Filesystem.exists(first.directory)).toBe(false)

    const second = await Instance.provideProjectIdentity({
      directory: project.path,
      fn: () => Worktree.create({ name }),
    })
    const secondOccurrence = await fs.stat(second.directory)
    {
      using cut = ProjectDeleteTestHooks.replaceBeforeDatabaseCommit(() => {
        throw new Error("crash after second managed-child terminal receipt")
      })
      await expect(
        deleteProject(Project.get(current.id)!, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_project_recreated_child_second",
          reason: "Settle the replacement physical child occurrence",
        }),
      ).rejects.toThrow("ProjectDeletePendingError")
    }
    expect(await Filesystem.exists(second.directory)).toBe(false)

    let replayedOccurrence: { device: number; inode: number; birthtimeMs: number } | undefined
    let frontierCount = 0
    using observe = ProjectWorktreeDeletion.TestHooks.installBeforeCommit((entry) => {
      replayedOccurrence = {
        device: entry.removal.device,
        inode: entry.removal.inode,
        birthtimeMs: entry.removal.birthtimeMs,
      }
    })
    using frontier = ProjectWorktreeDeletion.TestHooks.installAfterFrontierQuery((query) => {
      if (Project.samePath(query.directory, second.directory)) frontierCount = query.frontierCount
    })
    const retry = await deleteProject(Project.get(current.id)!, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_project_recreated_child_retry",
      reason: "Resume the head of the physical child occurrence chain",
    })
    expect({ retry, project: Project.get(current.id), replayedOccurrence, frontierCount }).toEqual({
      retry: expect.objectContaining({ ok: true, status: "committed", projectID: current.id }),
      project: undefined,
      replayedOccurrence: {
        device: secondOccurrence.dev,
        inode: secondOccurrence.ino,
        birthtimeMs: secondOccurrence.birthtimeMs,
      },
      frontierCount: 1,
    })
  }, 360_000)
})
