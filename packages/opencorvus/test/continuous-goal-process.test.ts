import { expect, test } from "bun:test"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { memoryProject } from "./fixture/memory"

test("independent processes converge on one goal reservation and restore the paused revision", async () => {
  await using project = await memoryProject()
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw new Error("Goal process test requires isolated repository runner.")
  const runtime = await createManagedTemporaryDirectory(root, "goal-facts-")
  const worker = path.join(import.meta.dir, "fixture", "continuous-goal-process-worker.ts")
  const run = async (mode: string, sessionID?: string) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "--config=" + path.join(import.meta.dir, "empty-bunfig.toml"),
        worker,
        mode,
        project.path,
        ...(sessionID ? [sessionID] : []),
      ],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: { ...process.env, OPENCORVUS_HOME: runtime },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (code !== 0) throw new Error("Goal worker failed: " + stderr + stdout)
    const line = stdout.split(/\r?\n/).findLast((line) => line.startsWith("[goal-result]"))
    if (!line) throw new Error("Goal worker did not return its fact result.")
    return JSON.parse(line.slice("[goal-result]".length))
  }
  try {
    const created = await run("create")
    const race = await Promise.all([run("admit", created.sessionID), run("admit", created.sessionID)])
    expect(race.map((entry) => entry.request.id)).toEqual([race[0].request.id, race[0].request.id])
    expect(race.map((entry) => entry.goal.turnsAccepted)).toEqual([1, 1])
    const paused = await run("pause", created.sessionID)
    const restored = await run("read", created.sessionID)
    expect(restored).toEqual(paused)
    expect(restored).toMatchObject({ id: created.goal.id, turnsAccepted: 1, status: "paused", turnBudget: 2 })
  } finally {
    await removeManagedDirectoryTree(runtime)
  }
}, 120_000)
