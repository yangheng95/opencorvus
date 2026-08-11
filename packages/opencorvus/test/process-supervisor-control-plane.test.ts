import { describe, expect, test } from "bun:test"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { SessionContext } from "../src/session/context"
import { Ripgrep } from "../src/file/ripgrep"
import { sampledSkillSupportingFilePaths } from "../src/tool/skill"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"

describe("ProcessSupervisor control-plane authority", () => {
  test("returns strict disposal only after physical exit and output settlement", async () => {
    let releaseOutput!: () => void
    const outputSettled = new Promise<void>((resolve) => (releaseOutput = resolve))
    const handle: ProcessSupervisor.Handle = {
      pid: 41_000,
      stdin: null,
      stdout: null,
      stderr: null,
      exited: Promise.resolve(0),
      outputSettled,
      async terminate() {},
      async dispose() {},
      unref() {},
    }
    setTimeout(releaseOutput, 30)
    const startedAt = performance.now()
    expect(await ProcessSupervisor.disposeAndWaitForExit(handle, "delayed output settlement")).toBe(0)
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(20)
  })

  test("accepts proven process exit even when auxiliary disposal settlement is delayed", async () => {
    let releaseDisposal!: () => void
    const disposal = new Promise<void>((resolve) => (releaseDisposal = resolve))
    const handle: ProcessSupervisor.Handle = {
      pid: 41_001,
      stdin: null,
      stdout: null,
      stderr: null,
      exited: Promise.resolve(0),
      async terminate() {},
      async dispose() {
        await disposal
      },
      unref() {},
    }
    try {
      expect(
        await ProcessSupervisor.requestDisposeAndWaitForPhysicalExit(handle, "already-exited process with delayed auxiliary cleanup", {
          exitTimeoutMs: 20,
        }),
      ).toBe(0)
    } finally {
      releaseDisposal()
    }
  })

  test("returns a fast command's real nonzero exit after the native readiness handshake", async () => {
    const handle = await ProcessSupervisor.spawnHostCommand({
      executable: process.execPath,
      args: ["-e", "process.exit(7)"],
      owner: "process-supervisor-fast-exit-contract",
    })
    expect(await handle.exited).toBe(7)
    await ProcessSupervisor.disposeAndWaitForExit(handle, "fast nonzero control-plane process")
  })

  test("executes a control-plane process while the Task Capsule runtime is configured", async () => {
    const previousDescriptor = process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-host-ripgrep-"))
    await writeFile(path.join(directory, "host-control.txt"), "host control plane\n")
    await writeFile(path.join(directory, "SKILL.md"), "# Host-owned projected Skill\n")
    await mkdir(path.join(directory, "references"))
    await writeFile(path.join(directory, "references", "contract.md"), "projected Skill supporting evidence\n")
    process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR = "/configured/task-capsule-runtime.json"
    try {
      const nonTaskSession = { id: "mission-control-session" } as Parameters<typeof SessionContext.provide>[0]
      const handle = await SessionContext.provide(nonTaskSession, () =>
        ProcessSupervisor.spawnHostCommand({
          executable: process.execPath,
          args: ["-e", "process.stdout.write('host-control-plane')"],
          owner: "process-supervisor-control-plane-contract",
        }),
      )
      let stdout = ""
      handle.stdout?.setEncoding("utf8")
      handle.stdout?.on("data", (chunk) => (stdout += String(chunk)))
      const exitCode = await handle.exited
      await handle.outputSettled
      await ProcessSupervisor.disposeAndWaitForExit(handle, "control-plane contract process")
      const files: string[] = []
      for await (const file of Ripgrep.filesForHost({ cwd: directory })) files.push(file)
      const sampledSkillFiles = await sampledSkillSupportingFilePaths(directory)

      expect({
        exitCode,
        stdout,
        files: files.map((file) => file.replaceAll("\\", "/")).sort(),
        sampledSkillFiles,
      }).toEqual({
        exitCode: 0,
        stdout: "host-control-plane",
        files: ["SKILL.md", "host-control.txt", "references/contract.md"],
        sampledSkillFiles: ["host-control.txt", "references/contract.md"],
      })
    } finally {
      if (previousDescriptor === undefined) delete process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR
      else process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR = previousDescriptor
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("bounds a live Windows ripgrep stream without an unhandled output-settlement rejection", async () => {
    if (process.platform !== "win32") return
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-ripgrep-truncation-"))
    try {
      await Promise.all(
        Array.from({ length: 160 }, (_, index) =>
          writeFile(path.join(directory, `file-${String(index).padStart(3, "0")}.txt`), `${index}\n`),
        ),
      )
      const files: string[] = []
      for await (const file of Ripgrep.filesForHost({ cwd: directory })) {
        files.push(file)
        if (files.length === 101) break
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(files).toHaveLength(101)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("observes ripgrep stderr rejection before a bounded consumer exits", async () => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    let resolveExit!: (code: number) => void
    const exited = new Promise<number>((resolve) => (resolveExit = resolve))
    let terminated = false
    const restore = ProcessSupervisor.setCommandFactoryForTest(async () => {
      setTimeout(() => {
        stdout.write("one.txt\n")
        stderr.destroy(new Error("deterministic ripgrep stderr abort"))
      }, 0)
      return {
        pid: 41_001,
        stdin: null,
        stdout,
        stderr,
        exited,
        outputSettled: Promise.resolve(),
        async terminate() {
          if (terminated) return
          terminated = true
          stdout.end()
          resolveExit(0)
        },
        async dispose() {},
        unref() {},
      }
    })
    try {
      const files: string[] = []
      for await (const file of Ripgrep.filesForHost({ cwd: process.cwd() })) {
        files.push(file)
        await Bun.sleep(20)
        break
      }
      expect(files).toEqual(["one.txt"])
      expect(terminated).toBe(true)
    } finally {
      restore()
    }
  })

  test("observes a deterministic Windows output-stream rejection at handle creation", async () => {
    if (process.platform !== "win32") return
    const unhandled: unknown[] = []
    const onUnhandled = (error: unknown) => unhandled.push(error)
    process.on("unhandledRejection", onUnhandled)
    let injected = false
    ProcessSupervisor.setWindowsOutputObserverForTest((stdout) => {
      stdout.once("data", () => {
        injected = true
        const failure = Object.assign(new Error("deterministic Windows output abort"), { code: "ABORT_ERR" })
        stdout.emit("error", failure)
      })
    })
    let handle: ProcessSupervisor.Handle | undefined
    try {
      handle = await ProcessSupervisor.spawnHostCommand({
        executable: process.execPath,
        args: ["-e", "await Bun.sleep(300); console.log('trigger'); await Bun.sleep(1000)"],
        owner: "process-supervisor-deterministic-output-failure",
      })
      await Bun.sleep(500)
      expect(injected).toBe(true)
      await expect(handle.outputSettled).rejects.toThrow("deterministic Windows output abort")
      await Bun.sleep(20)
      expect(unhandled).toEqual([])
    } finally {
      ProcessSupervisor.setWindowsOutputObserverForTest(undefined)
      process.off("unhandledRejection", onUnhandled)
      if (handle) {
        await ProcessSupervisor.terminateAndWaitForExit(handle, "deterministic output failure test").catch(() => undefined)
        await handle.outputSettled?.catch(() => undefined)
        await handle.dispose().catch(() => undefined)
      }
    }
  })
})
