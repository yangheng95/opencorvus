import { describe, expect, test } from "bun:test"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { SessionContext } from "../src/session/context"
import { Ripgrep } from "../src/file/ripgrep"
import { sampledSkillSupportingFilePaths } from "../src/tool/skill"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import net from "node:net"
import { pathToFileURL } from "node:url"
import { currentRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Global } from "@/global"

describe("ProcessSupervisor control-plane authority", () => {
  test("reclaims a descendant listener after the exact Windows owner process dies", async () => {
    if (process.platform !== "win32") return
    const reservation = net.createServer()
    await new Promise<void>((resolve, reject) => reservation.listen(0, "127.0.0.1", resolve).once("error", reject))
    const port = (reservation.address() as net.AddressInfo).port
    await new Promise<void>((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())))
    const supervisorURL = pathToFileURL(path.resolve(import.meta.dir, "../src/shell/process-supervisor.ts")).href
    const descendant = `Bun.serve({ hostname: "127.0.0.1", port: ${port}, fetch() { return new Response("owned") } }); await new Promise(() => {})`
    const target = `Bun.spawn([process.execPath, "-e", ${JSON.stringify(descendant)}], { stdout: "inherit", stderr: "inherit" }); await new Promise(() => {})`
    const ownerScript = `
      import net from "node:net";
      import { ProcessSupervisor } from ${JSON.stringify(supervisorURL)};
      await ProcessSupervisor.spawnHostCommand({ executable: process.execPath, args: ["-e", ${JSON.stringify(target)}], owner: "parent-death-contract" });
      const deadline = Date.now() + 10000;
      while (true) {
        const connected = await new Promise((resolve) => {
          const socket = net.createConnection({ host: "127.0.0.1", port: ${port} });
          socket.once("connect", () => { socket.destroy(); resolve(true); });
          socket.once("error", () => resolve(false));
        });
        if (connected) break;
        if (Date.now() > deadline) throw new Error("descendant listener did not start");
        await Bun.sleep(20);
      }
      process.stdout.write("OWNER_READY\\n");
      await new Promise(() => {});
    `
    const owner = spawn(process.execPath, ["-e", ownerScript], {
      cwd: path.resolve(import.meta.dir, ".."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    owner.stdout.setEncoding("utf8")
    owner.stderr.setEncoding("utf8")
    const ownerReady = new Promise<void>((resolve, reject) => {
      owner.stdout.on("data", (chunk) => {
        stdout += String(chunk)
        if (stdout.includes("OWNER_READY")) resolve()
      })
      owner.once("error", reject)
      owner.once("exit", () => reject(new Error("owner exited before publishing readiness")))
    })
    owner.stderr.on("data", (chunk) => (stderr += String(chunk)))
    const ownerExited = new Promise<number>((resolve, reject) => {
      owner.once("error", reject)
      owner.once("exit", (code) => resolve(code ?? 1))
    })
    await ownerReady
    const requestDirectories = await readdir(Global.Path.temporary, { withFileTypes: true })
    let ownedRequest: { directory: string; requestID: string; runtimeOccurrenceID: string } | undefined
    for (const entry of requestDirectories) {
      if (!entry.isDirectory() || !entry.name.startsWith("supervisor-")) continue
      const directory = path.join(Global.Path.temporary, entry.name)
      const request = JSON.parse(await readFile(path.join(directory, "request.json"), "utf8")) as Record<
        string,
        unknown
      >
      if (request.owner_pid !== owner.pid) continue
      ownedRequest = {
        directory,
        requestID: String(request.request_id),
        runtimeOccurrenceID: String(request.runtime_occurrence_id),
      }
      break
    }
    expect(ownedRequest).toEqual({
      directory: expect.any(String),
      requestID: expect.any(String),
      runtimeOccurrenceID: expect.any(String),
    })
    owner.kill("SIGKILL")
    const ownerExit = await ownerExited
    expect({ ownerExit, stdout: stdout.trim(), stderr: stderr.trim() }).toEqual({
      ownerExit: 1,
      stdout: "OWNER_READY",
      stderr: "",
    })
    const deadline = Date.now() + 10_000
    let reclaimed: net.Server | undefined
    while (!reclaimed && Date.now() <= deadline) {
      const candidate = net.createServer()
      const bound = await new Promise<boolean>((resolve) => {
        candidate.once("error", () => resolve(false))
        candidate.listen(port, "127.0.0.1", () => resolve(true))
      })
      if (bound) reclaimed = candidate
      else {
        await Bun.sleep(20)
      }
    }
    expect(reclaimed?.address()).toMatchObject({ address: "127.0.0.1", port })
    await new Promise<void>((resolve, reject) => reclaimed!.close((error) => (error ? reject(error) : resolve())))
    const settlementDeadline = Date.now() + 10_000
    let settlement: Record<string, unknown> | undefined
    while (!settlement && Date.now() <= settlementDeadline) {
      settlement = await readFile(path.join(ownedRequest!.directory, "settled.json"), "utf8")
        .then((text) => JSON.parse(text) as Record<string, unknown>)
        .catch(() => undefined)
      if (!settlement) await Bun.sleep(20)
    }
    expect(settlement).toMatchObject({
      request_id: ownedRequest!.requestID,
      runtime_occurrence_id: ownedRequest!.runtimeOccurrenceID,
      active_processes: 0,
    })
    const recovery = await ProcessSupervisor.recoverOrphanedWindowsRequests({
      currentOccurrenceID: currentRuntimeProcessOccurrence().occurrenceID,
    })
    expect(recovery.removed).toBeGreaterThanOrEqual(1)
  }, 60_000)

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

  test("retains the exact live owner until output settlement finishes", async () => {
    let resolveExit!: (code: number) => void
    let resolveOutput!: () => void
    const exited = new Promise<number>((resolve) => (resolveExit = resolve))
    const outputSettled = new Promise<void>((resolve) => (resolveOutput = resolve))
    const owner = "process-supervisor-settlement-registry-contract"
    const restore = ProcessSupervisor.setFactoryForTest(async () => ({
      pid: 41_002,
      stdin: null,
      stdout: null,
      stderr: null,
      exited,
      outputSettled,
      async terminate() {},
      async dispose() {},
      unref() {},
    }))
    try {
      const handle = await ProcessSupervisor.spawnHostShell({ command: "registry", shell: "test", owner })
      resolveExit(0)
      await exited
      expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toEqual({ count: 1, pids: [41_002] })
      resolveOutput()
      await handle.settled
      await Bun.sleep(0)
      expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toBeUndefined()
    } finally {
      resolveExit?.(0)
      resolveOutput?.()
      restore()
    }
  })

  test("keeps physical ownership after an early output control failure", async () => {
    let resolveExit!: (code: number) => void
    const exited = new Promise<number>((resolve) => (resolveExit = resolve))
    const outputSettled = Promise.reject(new Error("deterministic early output control failure"))
    void outputSettled.catch(() => undefined)
    const owner = "process-supervisor-control-failure-physical-contract"
    const restore = ProcessSupervisor.setFactoryForTest(async () => ({
      pid: 41_003,
      stdin: null,
      stdout: null,
      stderr: null,
      exited,
      outputSettled,
      async terminate() {},
      async dispose() {},
      unref() {},
    }))
    try {
      const handle = await ProcessSupervisor.spawnHostShell({ command: "control-failure", shell: "test", owner })
      await Bun.sleep(10)
      expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toEqual({ count: 1, pids: [41_003] })
      resolveExit(0)
      await expect(handle.settled).rejects.toThrow("deterministic early output control failure")
      expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toBeUndefined()
    } finally {
      resolveExit?.(0)
      restore()
    }
  })

  test("retains shutdown ownership when physical settlement proof is unavailable", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-unknown-physical-settlement-"))
    const owner = "process-supervisor-unknown-physical-settlement-contract"
    const exited = Promise.reject<number>(new Error("missing exact physical settlement marker"))
    void exited.catch(() => undefined)
    const restore = ProcessSupervisor.setCommandFactoryForTest(async () => ({
      pid: 41_004,
      stdin: null,
      stdout: null,
      stderr: null,
      exited,
      outputSettled: Promise.resolve(),
      async terminate() {},
      async dispose() {},
      unref() {},
    }))
    let handle: ProcessSupervisor.Handle | undefined
    try {
      handle = await ProcessSupervisor.spawnHostCommand({
        executable: "unknown-physical-settlement",
        args: [],
        cwd: directory,
        detached: true,
        owner,
      })
      await expect(handle.settled).rejects.toThrow("missing exact physical settlement marker")
      expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toEqual({ count: 1, pids: [41_004] })
      await expect(ProcessSupervisor.disposeLiveProcessesUnder(directory)).rejects.toThrow(
        "missing exact physical settlement marker",
      )
      expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toEqual({ count: 1, pids: [41_004] })
    } finally {
      handle?.unref()
      restore()
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("retains the exact durable request when the Windows helper exits before settlement proof", async () => {
    if (process.platform !== "win32") return
    let request: Record<string, unknown> | undefined
    const restore = ProcessSupervisor.setWindowsRequestObserverForTest((value) => {
      request = value
    })
    let handle: ProcessSupervisor.Handle | undefined
    let requestDirectory: string | undefined
    try {
      handle = await ProcessSupervisor.spawnHostCommand({
        executable: process.execPath,
        args: ["-e", "await new Promise(() => {})"],
        owner: "process-supervisor-marker-missing-recovery-contract",
      })
      const readyPath = String(request?.ready_file)
      requestDirectory = path.dirname(readyPath)
      const ready = JSON.parse(await readFile(readyPath, "utf8")) as { helper_pid: number }
      process.kill(ready.helper_pid, "SIGKILL")

      await expect(handle.settled).rejects.toThrow("exited without a physical settlement marker")
      expect(await readdir(requestDirectory)).toEqual(expect.arrayContaining(["ready.json", "request.json"]))
      await expect(
        ProcessSupervisor.recoverOrphanedWindowsRequests({
          currentOccurrenceID: "successor-runtime-occurrence",
          timeoutMilliseconds: 50,
          observeProcessOccurrence: () => "dead_or_reused",
        }),
      ).rejects.toBeInstanceOf(ProcessSupervisor.WindowsOrphanRequestRecoveryBlockedError)
    } finally {
      handle?.unref()
      restore()
      if (requestDirectory) await rm(requestDirectory, { recursive: true, force: true })
    }
  }, 30_000)

  test("settles a Windows command that fails before target creation with explicit active-process-zero evidence", async () => {
    if (process.platform !== "win32") return
    let request: Record<string, unknown> | undefined
    const restore = ProcessSupervisor.setWindowsRequestObserverForTest((value) => {
      request = value
    })
    const missingCwd = path.join(os.tmpdir(), `opencorvus-pre-target-missing-${randomUUID()}`)
    try {
      await expect(
        ProcessSupervisor.spawnHostCommand({
          executable: process.execPath,
          args: ["-e", "process.exit(0)"],
          cwd: missingCwd,
          owner: "process-supervisor-pre-target-settlement-contract",
        }),
      ).rejects.toThrow("CreateProcessW failed")
      expect(String(request?.launch_failed_file)).toEndWith("launch-failed.json")
      expect(
        await ProcessSupervisor.recoverOrphanedWindowsRequests({
          currentOccurrenceID: "successor-runtime-occurrence",
          timeoutMilliseconds: 50,
          observeProcessOccurrence: () => "dead_or_reused",
        }),
      ).toEqual({ inspected: 0, removed: 0, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 0 })
    } finally {
      restore()
    }
  }, 30_000)

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
        await ProcessSupervisor.requestDisposeAndWaitForPhysicalExit(
          handle,
          "already-exited process with delayed auxiliary cleanup",
          {
            exitTimeoutMs: 20,
          },
        ),
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

  test("inherits the target environment without serializing it into the Windows request", async () => {
    if (process.platform !== "win32") return
    let request: Readonly<Record<string, unknown>> | undefined
    const restore = ProcessSupervisor.setWindowsRequestObserverForTest((value) => {
      request = value
    })
    const marker = `environment-${Date.now()}`
    let handle: ProcessSupervisor.Handle | undefined
    try {
      handle = await ProcessSupervisor.spawnHostCommand({
        executable: process.execPath,
        args: ["-e", "process.stdout.write(process.env.OPENCORVUS_SUPERVISOR_ENV_CONTRACT ?? '')"],
        env: { ...process.env, OPENCORVUS_SUPERVISOR_ENV_CONTRACT: marker },
        owner: "process-supervisor-environment-inheritance-contract",
      })
      let stdout = ""
      handle.stdout?.setEncoding("utf8")
      handle.stdout?.on("data", (chunk) => (stdout += String(chunk)))
      expect(await handle.exited).toBe(0)
      await handle.settled
      expect({ stdout, requestKeys: Object.keys(request ?? {}).sort() }).toEqual({
        stdout: marker,
        requestKeys: [
          "args",
          "cancel_file",
          "cwd",
          "detached",
          "executable",
          "kind",
          "launch_failed_file",
          "owner_pid",
          "owner_process_instance_id",
          "ready_file",
          "request_id",
          "runtime_occurrence_id",
          "settled_file",
        ],
      })
    } finally {
      restore()
      if (handle) await ProcessSupervisor.disposeAndWaitForExit(handle, "environment inheritance contract")
    }
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
