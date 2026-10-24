import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

test("two real processes fence the original terminal receipt inside delivery lease acquisition", async () => {
  const root = await createManagedTemporaryDirectory(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "bus-terminal-lease-")
  const children: ReturnType<typeof spawn>[] = []
  function spawn(mode: string) {
    const child = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "fixture/bus-delivery-lease-child.ts"), mode, root],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: { ...process.env, OPENCORVUS_HOME: path.join(root, "runtime") },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const entry = { child, stdout: new Response(child.stdout).text(), stderr: new Response(child.stderr).text() }
    children.push(entry)
    return entry
  }
  async function settled(entry: ReturnType<typeof spawn>) {
    const [exit, stdout, stderr] = await Promise.all([entry.child.exited, entry.stdout, entry.stderr])
    expect(exit, stderr).toBe(0)
    return stdout.trim() ? JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) : undefined
  }
  try {
    await settled(spawn("prepare"))
    const paused = spawn("paused")
    const deadline = Date.now() + 30000
    while (
      !(await fs.stat(path.join(root, "paused.ready")).then(
        () => true,
        () => false,
      ))
    ) {
      if (Date.now() > deadline) throw new Error("owned worker did not reach its original terminal read")
      await Bun.sleep(10)
    }
    const winner = await settled(spawn("winner"))
    await fs.writeFile(path.join(root, "release"), "winner source receipt actually committed")
    const resumed = await settled(paused)
    expect([winner.title, resumed.title]).toEqual(["Completed original title", "Completed original title"])
    expect([winner.receipt, resumed.receipt]).toEqual([[{ outcome: "succeeded" }], [{ outcome: "succeeded" }]])
    const callbacks = (await fs.readFile(path.join(root, "actual-callbacks.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line))
    expect(callbacks.map((row) => ({ owner: row.mode, title: row.title }))).toEqual([
      { owner: "winner", title: "Completed original title" },
    ])
  } finally {
    for (const { child } of children) {
      if (child.exitCode === null) child.kill()
      await child.exited
    }
    await removeManagedDirectoryTree(root)
  }
}, 60000)
