import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { memoryProject } from "./fixture/memory"

describe("Task creation channel identity cross-process convergence", () => {
  test("the real project HTTP surface returns one winner and a typed changed-payload conflict", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Task channel process test requires the repository test runtime")
    await using project = await memoryProject()
    await using otherProject = await memoryProject("distinct cross-project identity")
    const runtime = await createManagedTemporaryDirectory(processRoot, "task-channel-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "task-channel-barrier-")
    const worker = path.join(import.meta.dir, "fixture", "task-creation-channel-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime, OPENCORVUS_TEST_PROCESS_ROOT: processRoot }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (
      mode: string,
      requestID: string,
      label?: string,
      revision = 1,
      projectDirectory = project.path,
      channelOccurrence = requestID,
    ) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          barrier,
          projectDirectory,
          requestID,
          label ?? "",
          String(revision),
          channelOccurrence,
        ],
        { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
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
      const line = stdout.trim().split(/\r?\n/).findLast((candidate) => candidate.startsWith("{"))
      if (!line) throw new Error(`Task channel worker returned no JSON: ${stderr || stdout}`)
      return JSON.parse(line) as any
    }
    try {
      expect(await read(spawn("init", "initialization"))).toEqual({ initialized: true })
      const requestID = "task-channel-cross-process"
      const first = spawn("race", requestID, "first")
      const second = spawn("race", requestID, "second")
      const deadline = Date.now() + 30_000
      while (
        (await fs.readdir(barrier)).filter((entry) => entry.startsWith(`${requestID}-`) && entry.endsWith(".ready"))
          .length < 2
      ) {
        if (Date.now() >= deadline) throw new Error("Task channel workers did not reach the race barrier")
        await Bun.sleep(5)
      }
      await fs.writeFile(path.join(barrier, `${requestID}.go`), "go")
      const raced = await Promise.all([read(first), read(second)])
      expect(raced.map((result) => result.status), JSON.stringify(raced)).toEqual([202, 202])
      expect(raced[0].body.task_id).toBe(raced[1].body.task_id)

      const conflict = await read(spawn("request", requestID, undefined, 2))
      expect(conflict).toMatchObject({
        status: 409,
        body: { name: "TaskCreationIdentityConflictError" },
      })
      expect(await read(spawn("inspect", requestID))).toEqual({
        tasks: [{ id: raced[0].body.task_id, sessionID: expect.any(String) }],
        contracts: [{ taskID: raced[0].body.task_id }],
        bindings: [{ taskID: raced[0].body.task_id, payload: { revision: 1 } }],
        ingresses: [{ taskID: raced[0].body.task_id }],
        rootSessions: [{ id: expect.any(String) }],
      })

      const crossProjectChannel = "task-channel-cross-project"
      expect(
        await read(spawn("register-project", "registered-other-project", undefined, 1, otherProject.path)),
      ).toMatchObject({ registered: true, projectID: expect.any(String) })
      const crossFirst = spawn("race", "cross-project-request-a", "first", 1, project.path, crossProjectChannel)
      const crossSecond = spawn(
        "race",
        "cross-project-request-b",
        "second",
        1,
        otherProject.path,
        crossProjectChannel,
      )
      const crossDeadline = Date.now() + 30_000
      while (
        (await fs.readdir(barrier)).filter(
          (entry) => entry.startsWith(`${crossProjectChannel}-`) && entry.endsWith(".ready"),
        ).length < 2
      ) {
        if (Date.now() >= crossDeadline) throw new Error("Cross-Project channel workers did not reach the race barrier")
        await Bun.sleep(5)
      }
      await fs.writeFile(path.join(barrier, `${crossProjectChannel}.go`), "go")
      const crossResults = await Promise.all([read(crossFirst), read(crossSecond)])
      expect(crossResults.map((result) => result.status).sort(), JSON.stringify(crossResults)).toEqual([202, 409])
      expect(crossResults.find((result) => result.status === 409)).toMatchObject({
        body: { name: "TaskChannelBindingProjectConflictError" },
      })
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill()
      await Promise.allSettled(children.map((child) => child.exited))
      await removeManagedDirectoryTree(runtime)
      await removeManagedDirectoryTree(barrier)
    }
  }, 120_000)
})
