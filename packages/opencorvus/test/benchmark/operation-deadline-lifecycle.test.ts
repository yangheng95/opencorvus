import { expect, test } from "bun:test"
import path from "node:path"
import { awaitBenchmarkOperationDeadline } from "../../script/benchmark/external-agent/contract"

test("a completed benchmark operation cancels its long deadline and the worker exits naturally", async () => {
  const child = Bun.spawn(
    [process.execPath, path.resolve(import.meta.dir, "../fixture/benchmark-operation-deadline-worker.ts")],
    { stdout: "pipe", stderr: "pipe" },
  )
  try {
    const [exitCode, stdout, stderr] = await Promise.race([
      Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]),
      Bun.sleep(5_000).then(() => {
        throw new Error("benchmark operation worker retained its completed deadline")
      }),
    ])
    expect({ exitCode, stderr, response: JSON.parse(stdout) }).toEqual({
      exitCode: 0,
      stderr: "",
      response: { with_signal: "bridge-ready", cleanup: "cleanup-settled" },
    })
  } finally {
    child.kill()
  }
})

test("benchmark operation deadline returns its exact timeout error", async () => {
  await expect(
    awaitBenchmarkOperationDeadline({
      operation: new Promise<never>(() => undefined),
      signal: new AbortController().signal,
      timeoutMs: 1,
      timeoutMessage: "bridge ready deadline expired",
    }),
  ).rejects.toThrow("bridge ready deadline expired")
})

test("benchmark operation deadline returns the exact abort reason", async () => {
  const controller = new AbortController()
  const reason = new Error("benchmark termination requested")
  controller.abort(reason)
  await expect(
    awaitBenchmarkOperationDeadline({
      operation: Promise.resolve("ready"),
      signal: controller.signal,
      timeoutMs: 600_000,
      timeoutMessage: "bridge ready deadline expired",
    }),
  ).rejects.toBe(reason)
})
