import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { assertTaskProcessBindingCreation, prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"

const packageRoot = path.resolve(import.meta.dir, "..")

async function bootProcessMode(mode?: string) {
  const env = { ...process.env }
  if (mode === undefined) delete env.OPENCORVUS_TASK_PROCESS_MODE
  else env.OPENCORVUS_TASK_PROCESS_MODE = mode

  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      [
        'import { installProcessShims } from "./src/runtime/shims.ts"',
        'import { configuredTaskProcessMode } from "./src/engine/task-execution-capsule-binding.ts"',
        "installProcessShims()",
        "process.stdout.write(configuredTaskProcessMode())",
      ].join(";"),
    ],
    {
      cwd: packageRoot,
      env,
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(`Process bootstrap failed with exit ${exitCode}: ${stderr}`)
  expect(exitCode).toBe(0)
  return stdout
}

test("shared production bootstrap declares native Task execution", async () => {
  expect(await bootProcessMode()).toBe("native")
})

test("shared production bootstrap preserves explicit Capsule Task execution", async () => {
  expect(await bootProcessMode("capsule")).toBe("capsule")
})

test("native Task creation recognizes a platform alias of the same physical root", async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-task-root-alias-"))
  const physical = path.join(fixture, "physical")
  const alias = path.join(fixture, "alias")
  try {
    await fs.mkdir(physical)
    await fs.writeFile(path.join(physical, "source.txt"), "physical task root\n")
    for (const args of [["init"], ["add", "source.txt"]]) {
      const result = Bun.spawnSync(["git", ...args], { cwd: physical, stdout: "pipe", stderr: "pipe" })
      expect(result.exitCode, result.stderr.toString()).toBe(0)
    }
    await fs.symlink(physical, alias, process.platform === "win32" ? "junction" : "dir")
    const timeCreated = Date.now()
    const payload = await prepareTaskProcessBinding({
      mode: "native",
      taskID: "task-root-alias",
      projectID: "project-root-alias",
      rootDirectory: alias,
      packageRevisionSHA256: "a".repeat(64),
      timeCreated,
    })
    expect(() =>
      assertTaskProcessBindingCreation({
        payload,
        taskID: "task-root-alias",
        projectID: "project-root-alias",
        rootDirectory: alias,
        packageRevisionSHA256: "a".repeat(64),
        timeCreated,
      }),
    ).not.toThrow()
    expect(payload).toMatchObject({ workspace_root: await fs.realpath(physical) })
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
})
