import { expect, test } from "bun:test"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

test("a real Fire commit followed by process exit recovers its exact accepted set and original receipt", async () => {
  const root = await createManagedTemporaryDirectory(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "event-source-restart-")
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
    const result = { child, stdout: new Response(child.stdout).text(), stderr: new Response(child.stderr).text() }
    children.push(result)
    return result
  }
  async function output(entry: ReturnType<typeof spawn>) {
    const [exit, stdout, stderr] = await Promise.all([entry.child.exited, entry.stdout, entry.stderr])
    return { exit, stderr, result: stdout.trim() ? JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) : undefined }
  }
  try {
    expect((await output(spawn("event-prepare"))).exit).toBe(23)
    const first = await output(spawn("event-resume"))
    expect(first.exit, first.stderr).toBe(0)
    expect(first.result.fires).toEqual(first.result.originalFires)
    expect(first.result.projected).toEqual([{ id: first.result.fires[0].id, status: "succeeded", disposition: null }])
    expect(first.result.receipts).toContainEqual({ subscriber: "scheduler.event-service", outcome: "succeeded" })
    const reopened = await output(spawn("event-resume"))
    expect(reopened.exit, reopened.stderr).toBe(0)
    expect(reopened.result).toEqual(first.result)
  } finally {
    for (const { child } of children) {
      if (child.exitCode === null) child.kill()
      await child.exited
    }
    await removeManagedDirectoryTree(root)
  }
}, 90000)
