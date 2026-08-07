import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { BunProc } from "../src/bun"
import { LSPClient } from "../src/lsp/client"
import { LSP } from "../src/lsp"
import { LSPServer } from "../src/lsp/server"
import { Instance } from "../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { afterAll } from "bun:test"
import { SessionContext } from "../src/session/context"
import { Session } from "../src/session"
import { Identifier } from "../src/id/id"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { ProcessSupervisor } from "../src/shell/process-supervisor"

afterAll(resetMemoryDatabase)

describe("Language Server Protocol initialization lifecycle", () => {
  test("binds Task and Host clients to separate process owners and reclaims the Task client at checkpoint", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = path.join(project.path, "authority.ts")
        const serverScript = path.join(project.path, "lsp-authority-server.mjs")
        await writeFile(source, "export const authority = true\n")
        await writeFile(
          serverScript,
          [
            "let bytes=Buffer.alloc(0);",
            "const send=(value)=>{const body=Buffer.from(JSON.stringify(value));process.stdout.write(`Content-Length: ${body.length}\\r\\n\\r\\n`);process.stdout.write(body)};",
            "process.stdin.on('data',(chunk)=>{bytes=Buffer.concat([bytes,chunk]);for(;;){const split=bytes.indexOf('\\r\\n\\r\\n');if(split<0)return;const header=bytes.subarray(0,split).toString();const match=/Content-Length: (\\d+)/i.exec(header);if(!match)throw new Error('missing content length');const length=Number(match[1]);if(bytes.length<split+4+length)return;const message=JSON.parse(bytes.subarray(split+4,split+4+length).toString());bytes=bytes.subarray(split+4+length);if(message.method==='initialize')send({jsonrpc:'2.0',id:message.id,result:{capabilities:{textDocumentSync:1}}});else if(message.method==='shutdown')send({jsonrpc:'2.0',id:message.id,result:null});else if(message.method==='exit')process.exit(0)}});",
          ].join("\n"),
        )
        const session = await Session.create({ kind: "root", title: "Task LSP authority" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.07.1",
          packageDigest: "a".repeat(64),
        }
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now,
          title: "Task LSP authority",
          request: "Start the exact Task-owned language server",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          queue: false,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const processes: LSPServer.OwnedChildProcess[] = []
        const restoreServers = await LSP.TestHooks.replaceServers({
          "authority-test-server": {
            id: "authority-test-server",
            extensions: [".ts"],
            root: async () => project.path,
            async spawn(root, stdio) {
              const child = await stdio(process.execPath, [serverScript], { cwd: root })
              processes.push(child)
              return { process: child }
            },
          },
        })
        try {
          await SessionContext.provide(session, () =>
            LSP.touchFile(source, false, { kind: "task", taskID, cwd: project.path }),
          )
          await LSP.Host.touchFile(source, false)
          expect({ processes: processes.length, lifecycle: await LSP.TestHooks.lifecycle() }).toEqual({
            processes: 2,
            lifecycle: { spawning: 0, broken: 0, clients: 2 },
          })
          await ProcessSupervisor.withTaskCheckpointLease(taskID, async () => {})
          expect({ taskExit: typeof processes[0]!.exitCode, hostExit: processes[1]!.exitCode }).toEqual({
            taskExit: "number",
            hostExit: null,
          })
        } finally {
          restoreServers()
          await Promise.allSettled(processes.map((child) => child.opencorvusDispose?.()))
        }
      },
    })
  }, 0)

  test("returns a typed terminal error and reclaims an owned server that never initializes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-lsp-initialize-"))
    const source = path.join(root, "sample.ts")
    await writeFile(source, "export const value = 1\n")
    const process = LSPServer.spawnHostStdio(BunProc.which(), ["-e", "process.stdin.resume()"], { cwd: root })
    const terminalDisposition = new Promise<{ kind: "exit" | "signal"; value: number | NodeJS.Signals }>(
      (resolve, reject) => {
        process.once("error", reject)
        process.once("exit", (code, signal) => {
          if (code !== null) resolve({ kind: "exit", value: code })
          else if (signal !== null) resolve({ kind: "signal", value: signal })
          else reject(new Error("Language Server Protocol process exited without a terminal disposition"))
        })
      },
    )
    const restoreTimeout = LSPClient.setInitializeTimeoutForTest(50)
    try {
      let result: unknown
      try {
        result = await LSPClient.create({
          serverID: "nonresponsive-test-server",
          server: { process },
          root,
        })
      } catch (error) {
        result = error
      }
      expect(result).toMatchObject({ name: "LSPInitializeError" })
      const disposition = await terminalDisposition
      expect(disposition).toMatchObject({
        kind: expect.stringMatching(/^(exit|signal)$/),
        value: expect.anything(),
      })
    } finally {
      restoreTimeout()
      await process.opencorvusDispose?.().catch(() => undefined)
      await rm(root, { recursive: true, force: true })
    }
  })

  test("settles the spawn occurrence and gives the next diagnostics touch a terminal result", async () => {
    await using project = await memoryProject()
    const source = path.join(project.path, "sample.ts")
    await writeFile(source, "export const value = 2\n")
    let process: LSPServer.OwnedChildProcess | undefined
    let terminalDisposition: Promise<{ kind: "exit" | "signal"; value: number | NodeJS.Signals }> | undefined
    const restoreTimeout = LSPClient.setInitializeTimeoutForTest(50)
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const restoreServers = await LSP.TestHooks.replaceServers({
            "nonresponsive-test-server": {
              id: "nonresponsive-test-server",
              extensions: [".ts"],
              root: async () => project.path,
              async spawn() {
                process = LSPServer.spawnHostStdio(BunProc.which(), ["-e", "process.stdin.resume()"], {
                  cwd: project.path,
                })
                terminalDisposition = new Promise((resolve, reject) => {
                  process!.once("error", reject)
                  process!.once("exit", (code, signal) => {
                    if (code !== null) resolve({ kind: "exit", value: code })
                    else if (signal !== null) resolve({ kind: "signal", value: signal })
                    else reject(new Error("Language Server Protocol process exited without a terminal disposition"))
                  })
                })
                return { process }
              },
            },
          })
          try {
            await SessionContext.provide({ id: "host-lsp-lifecycle" } as never, async () => {
              await LSP.Host.touchFile(source, false)
              expect(await LSP.TestHooks.lifecycle()).toEqual({ spawning: 0, broken: 1, clients: 0 })
              await LSP.Host.touchFile(source, true)
              expect(await LSP.TestHooks.lifecycle()).toEqual({ spawning: 0, broken: 1, clients: 0 })
            })
          } finally {
            restoreServers()
          }
        },
      })
      if (!terminalDisposition) throw new Error("Language Server Protocol server did not spawn")
      const disposition = await terminalDisposition
      expect(disposition).toMatchObject({
        kind: expect.stringMatching(/^(exit|signal)$/),
        value: expect.anything(),
      })
    } finally {
      restoreTimeout()
      await process?.opencorvusDispose?.().catch(() => undefined)
    }
  })
})
