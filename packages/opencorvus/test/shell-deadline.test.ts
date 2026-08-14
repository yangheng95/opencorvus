import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createServer } from "node:net"
import { runGuardedHostCommand } from "../src/shell/guarded-command"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { Shell } from "../src/shell/shell"
import { which } from "../src/util/which"

describe("Shell absolute deadline authority", () => {
  test("times out a real Windows descendant only after its listening port is reclaimed", async () => {
    if (process.platform !== "win32") return
    const node = which("node")
    if (!node) throw new Error("Node.js is required for the managed descendant timeout contract")
    const warmup = await ProcessSupervisor.spawnHostCommand({
      executable: node,
      args: ["-e", "process.exit(0)"],
      owner: "shell-deadline-native-helper-warmup",
    })
    await warmup.settled
    await ProcessSupervisor.disposeAndWaitForExit(warmup, "shell deadline native helper warmup")
    const project = await mkdtemp(path.join(os.tmpdir(), "opencorvus-job-timeout-"))
    const reservation = createServer()
    await new Promise<void>((resolve, reject) => {
      reservation.once("error", reject)
      reservation.listen(0, "127.0.0.1", resolve)
    })
    const address = reservation.address()
    if (!address || typeof address === "string") throw new Error("failed to reserve a TCP port")
    const port = address.port
    await new Promise<void>((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())))
    try {
      await writeFile(
        path.join(project, "child.js"),
        "const net=require('node:net');const port=Number(process.argv[2]);net.createServer().listen(port,'127.0.0.1',()=>console.log(`CHILD_READY ${process.pid} ${port}`))",
      )
      await writeFile(
        path.join(project, "parent.js"),
        "const {spawn}=require('node:child_process');spawn(process.execPath,['child.js',process.argv[2]],{stdio:'inherit'});setInterval(()=>{},1000)",
      )
      const result = await runGuardedHostCommand({
        command: `"${node.replaceAll("\\", "/")}" parent.js ${port}`,
        projectDir: project,
        timeoutMs: 5_000,
      })
      const descendant = result.match(/CHILD_READY (\d+) (\d+)/)
      if (!descendant) throw new Error(`managed descendant did not publish its identity:\n${result}`)
      const rebound = createServer()
      await new Promise<void>((resolve, reject) => {
        rebound.once("error", reject)
        rebound.listen(port, "127.0.0.1", resolve)
      })
      const reboundAddress = rebound.address()
      await new Promise<void>((resolve, reject) => rebound.close((error) => (error ? reject(error) : resolve())))
      expect({
        timedOut: result.includes("timeout_ms: 5000"),
        descendantPid: Number(descendant?.[1]),
        descendantPort: Number(descendant?.[2]),
        reboundPort: typeof reboundAddress === "object" && reboundAddress ? reboundAddress.port : 0,
      }).toEqual({
        timedOut: true,
        descendantPid: expect.any(Number),
        descendantPort: port,
        reboundPort: port,
      })
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  })

  test("settles a timed-out command through physical exit and output closure", async () => {
    let resolveExit!: (code: number) => void
    let resolveOutput!: () => void
    const exited = new Promise<number>((resolve) => (resolveExit = resolve))
    const outputSettled = new Promise<void>((resolve) => (resolveOutput = resolve))
    const restore = ProcessSupervisor.setFactoryForTest(async () => ({
      pid: 42_000,
      stdin: null,
      stdout: null,
      stderr: null,
      exited,
      outputSettled,
      async terminate() {
        resolveExit(143)
        resolveOutput()
      },
      async dispose() {
        resolveExit(143)
        resolveOutput()
      },
      unref() {},
    }))
    try {
      const startedAt = performance.now()
      const result = await Shell.runHost("deadline-contract", { timeoutMs: 200 })
      expect({
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        elapsedUnderOneSecond: performance.now() - startedAt < 1_000,
      }).toEqual({
        exitCode: 143,
        timedOut: true,
        elapsedUnderOneSecond: true,
      })
    } finally {
      resolveExit?.(143)
      resolveOutput?.()
      restore()
    }
  })

  test("applies the deadline while preparing an isolated guarded workspace", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "opencorvus-guarded-deadline-"))
    try {
      const fixtures = path.join(project, "fixtures")
      await mkdir(fixtures)
      await Promise.all(
        Array.from({ length: 200 }, (_, index) => writeFile(path.join(fixtures, `${index}.txt`), "deadline\n")),
      )
      const startedAt = performance.now()
      let outcome: unknown
      try {
        await runGuardedHostCommand({
          command: `${JSON.stringify(process.execPath)} -e "process.stdout.write('command-ran')"`,
          projectDir: project,
          timeoutMs: 1,
        })
      } catch (error) {
        outcome = error
      }
      expect({
        errorName: outcome instanceof Error ? outcome.name : "",
        elapsedUnderOneSecond: performance.now() - startedAt < 1_000,
      }).toEqual({ errorName: "TimeoutError", elapsedUnderOneSecond: true })
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  })

  test("executes a real relative .venv Scripts Python from the isolated workspace", async () => {
    if (process.platform !== "win32") return
    const python = which("python")
    if (!python) throw new Error("Python is required for the relative virtual-environment contract")
    const project = await mkdtemp(path.join(os.tmpdir(), "opencorvus-relative-venv-"))
    try {
      const creation = Bun.spawn([python, "-m", "venv", path.join(project, ".venv")], {
        cwd: project,
        stdout: "pipe",
        stderr: "pipe",
      })
      const creationCode = await creation.exited
      const creationError = await new Response(creation.stderr).text()
      if (creationCode !== 0) {
        throw new Error(`virtual environment creation failed with exit code ${creationCode}:\n${creationError}`)
      }
      const output = await runGuardedHostCommand({
        command: `.venv/Scripts/python.exe -c "print('relative-venv-executed')"`,
        projectDir: project,
        timeoutMs: 30_000,
      })
      expect({
        exitCode: output.match(/^exit_code: (\d+)$/m)?.[1],
        stdout: output.match(/stdout:\n([^\n]+)/)?.[1]?.trim(),
      }).toEqual({ exitCode: "0", stdout: "relative-venv-executed" })
    } finally {
      await rm(project, { recursive: true, force: true })
    }
  })
})
