import { expect, test } from "bun:test"
import path from "node:path"

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
