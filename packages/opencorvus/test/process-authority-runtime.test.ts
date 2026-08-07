import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PassThrough } from "node:stream"
import { TextReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { runHostBrowserNodeSidecar, runTaskBrowserNodeSidecar } from "../src/browser/runtime/node-executor"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { MCP } from "../src/mcp"
import {
  authorOfficeArtifact,
  defaultOfficeArtifactDependencies,
  type OfficeArtifactDependencies,
} from "../src/office-artifact/presentation"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { runFormatterProcess } from "../src/format/process"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { which } from "../src/util/which"
import { resolveSessionProcessAuthority } from "../src/engine/task-session-lineage"
import { ProcessSupervisor } from "../src/shell/process-supervisor"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "a".repeat(64),
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function minimalPresentationBytes() {
  const output = new Uint8ArrayWriter()
  const zip = new ZipWriter(output)
  await zip.add("[Content_Types].xml", new TextReader("<Types/>"))
  await zip.add("_rels/.rels", new TextReader("<Relationships/>"))
  await zip.add("ppt/presentation.xml", new TextReader("<p:presentation xmlns:p=\"urn:p\"/>"))
  await zip.add("ppt/slides/slide1.xml", new TextReader("<p:sld xmlns:p=\"urn:p\"/>"))
  await zip.close()
  return Buffer.from(output.getData())
}

async function writeMcpFixture(file: string) {
  await fs.writeFile(
    file,
    [
      "import readline from 'node:readline';",
      "const rl=readline.createInterface({input:process.stdin});",
      "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
      "rl.on('line',(line)=>{const request=JSON.parse(line); if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'authority-fixture',version:'1'}}}); if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:[{name:'authority_echo',description:'Echo process authority cwd',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}}); if(request.method==='tools/call') return send({jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:process.cwd()}]}});});",
    ].join("\n"),
    { flag: "wx" },
  )
}

describe("explicit Host and Task process authority", () => {
  test("runs Formatter, Browser, MCP, and Office through one durable Task lineage", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Process authority contract" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now,
          title: "Process authority contract",
          request: "Execute exact Host and Task process contracts",
          productPillar: "code",
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
        const hostSession = await Session.create({ kind: "assistant", title: "Host authority contract" })
        const hostDirectory = path.join(project.path, "host-control")
        await fs.mkdir(hostDirectory)
        const taskAuthority = await resolveSessionProcessAuthority({
          sessionID: session.id,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          cwd: project.path,
          runtimeTaskID: taskID,
        })
        const hostAuthority = await resolveSessionProcessAuthority({
          sessionID: hostSession.id,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          cwd: hostDirectory,
        })
        if (taskAuthority.kind !== "task" || hostAuthority.kind !== "host") {
          throw new Error("Session process authority contract resolved an unexpected owner")
        }

        const formatterScript = "process.stdout.write(process.cwd())"
        const taskFormatter = await runFormatterProcess(
          taskAuthority,
          { command: [process.execPath, "-e", formatterScript], timeoutMs: 10_000, captureOutput: true },
        )
        const hostFormatter = await runFormatterProcess(
          hostAuthority,
          { command: [process.execPath, "-e", formatterScript], timeoutMs: 10_000, captureOutput: true },
        )
        expect([taskFormatter, hostFormatter]).toEqual([
          { exitCode: 0, stdout: project.path, stderr: "" },
          { exitCode: 0, stdout: hostDirectory, stderr: "" },
        ])

        const browserInput = {
          runtime: {
            nodeExecutable: which("node") ?? (() => { throw new Error("Node runtime is required") })(),
            playwrightRequirePath: process.execPath,
            packaged: false,
          },
          script: "const value=JSON.parse(Buffer.from(process.argv[2],'base64').toString('utf8'));process.stdout.write(JSON.stringify({cwd:process.cwd(),value}));",
          payload: { authority: "exact" },
          inactivityTimeoutMs: 10_000,
          label: "process authority browser protocol",
        }
        const taskBrowser = await runTaskBrowserNodeSidecar<{ cwd: string; value: { authority: string } }>(
          taskAuthority,
          browserInput,
        )
        const hostBrowser = await runHostBrowserNodeSidecar<{ cwd: string; value: { authority: string } }>(
          hostAuthority.cwd,
          browserInput,
        )
        expect([taskBrowser.result, hostBrowser.result]).toEqual([
          { cwd: project.path, value: { authority: "exact" } },
          { cwd: hostDirectory, value: { authority: "exact" } },
        ])

        const mcpFixture = path.join(project.path, "authority-mcp.mjs")
        await writeMcpFixture(mcpFixture)
        const mcp = { type: "local" as const, command: [process.execPath, mcpFixture], timeout: 10_000 }
        const owner = MCP.createScopedConnectionOwner("authority-owner")
        try {
          const taskResult = await MCP.callScopedTool({
            key: "authority-fixture",
            mcp,
            cwd: project.path,
            connectionOwner: owner,
            connectionIdentity: "shared-logical-server",
            processAuthority: MCP.taskProcessAuthority(taskAuthority.taskID, taskAuthority.cwd),
            toolName: "authority_echo",
            args: {},
          })
          const hostResult = await MCP.callScopedTool({
            key: "authority-fixture",
            mcp,
            cwd: hostDirectory,
            connectionOwner: owner,
            connectionIdentity: "shared-logical-server",
            processAuthority: MCP.hostProcessAuthority(hostAuthority.cwd),
            toolName: "authority_echo",
            args: {},
          })
          expect([taskResult.content, hostResult.content]).toEqual([
            [{ type: "text", text: project.path }],
            [{ type: "text", text: hostDirectory }],
          ])
        } finally {
          await owner.close()
        }

        const officeCalls: Array<{ taskID: string; cwd: string; operation: string }> = []
        const officeDependencies: OfficeArtifactDependencies = {
          async officeCliPath() {
            return process.execPath
          },
          async runtimeIdentity() {
            throw new Error("Office runtime identity is not part of authoring")
          },
          async runOfficeCli(input) {
            officeCalls.push({ taskID: input.taskID, cwd: input.cwd, operation: input.args[0]! })
            if (input.args[0] === "create") await fs.writeFile(input.args[1]!, await minimalPresentationBytes())
            return { code: 0, stdout: Buffer.from('{"success":true,"data":{}}'), stderr: Buffer.alloc(0) }
          },
        }
        const office = await authorOfficeArtifact({
          raw: {
            format: "presentation",
            filename: "authority.pptx",
            locale: "en-US",
            aspect_ratio: "16:9",
            slides: [{ title: "Authority", background: "#FFFFFF", elements: [] }],
          },
          taskID,
          sessionID: session.id,
          abort: new AbortController().signal,
          dependencies: officeDependencies,
        })
        expect({
          slideTitles: office.slideTitles,
          operations: officeCalls.map((call) => call.operation),
          taskIDs: officeCalls.map((call) => call.taskID),
          workspaceParent: officeCalls.map((call) => path.dirname(call.cwd)),
        }).toEqual({
          slideTitles: ["Authority"],
          operations: ["create", "batch"],
          taskIDs: [taskID, taskID],
          workspaceParent: [path.dirname(officeCalls[0]!.cwd), path.dirname(officeCalls[0]!.cwd)],
        })

        const officeCliExecutable = path.join(project.path, "officecli-authority")
        const defaultOfficeSpawns: Array<{ cwd?: string; executable: string; args: string[] }> = []
        const originalOfficeCliPath = defaultOfficeArtifactDependencies.officeCliPath
        const restoreProcessFactory = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
          defaultOfficeSpawns.push({ cwd: options.cwd, executable: options.executable, args: options.args })
          const stdout = new PassThrough()
          const stderr = new PassThrough()
          stdout.end('{"success":true,"data":{"authority":"task"}}')
          stderr.end()
          return {
            pid: 43210,
            stdin: null,
            stdout,
            stderr,
            exited: Promise.resolve(0),
            async terminate() {},
            async dispose() {},
            unref() {},
          }
        })
        defaultOfficeArtifactDependencies.officeCliPath = async () => officeCliExecutable
        try {
          const defaultOfficeResult = await defaultOfficeArtifactDependencies.runOfficeCli({
            taskID,
            args: ["validate", "authority.pptx", "--json"],
            cwd: project.path,
            abort: new AbortController().signal,
          })
          expect({
            exitCode: defaultOfficeResult.code,
            payload: JSON.parse(defaultOfficeResult.stdout.toString()),
            spawns: defaultOfficeSpawns,
          }).toEqual({
            exitCode: 0,
            payload: { success: true, data: { authority: "task" } },
            spawns: [{
              cwd: project.path,
              executable: officeCliExecutable,
              args: ["validate", "authority.pptx", "--json"],
            }],
          })
        } finally {
          defaultOfficeArtifactDependencies.officeCliPath = originalOfficeCliPath
          restoreProcessFactory()
        }

        let nextPID = 44000
        const restoreCheckpointFactory = ProcessSupervisor.setCommandFactoryForTest(async () => {
          let finish!: (code: number) => void
          const exited = new Promise<number>((resolve) => (finish = resolve))
          let disposed = false
          return {
            pid: nextPID++,
            stdin: null,
            stdout: new PassThrough(),
            stderr: new PassThrough(),
            exited,
            async terminate() {
              if (!disposed) finish(0)
              disposed = true
            },
            async dispose() {
              if (!disposed) finish(0)
              disposed = true
            },
            unref() {},
          }
        })
        try {
          const first = await ProcessSupervisor.spawnTaskCommand(
            { taskID, cwd: project.path },
            { executable: process.execPath, args: ["--version"] },
          )
          let enterFirst!: () => void
          const firstEntered = new Promise<void>((resolve) => (enterFirst = resolve))
          let releaseFirst!: () => void
          const firstReleased = new Promise<void>((resolve) => (releaseFirst = resolve))
          const order: string[] = []
          const checkpointA = ProcessSupervisor.withTaskCheckpointLease(taskID, async () => {
            order.push("checkpoint-a")
            enterFirst()
            await firstReleased
          })
          await firstEntered
          const secondSpawn = ProcessSupervisor.spawnTaskCommand(
            { taskID, cwd: project.path },
            { executable: process.execPath, args: ["--version"] },
          )
          const checkpointB = ProcessSupervisor.withTaskCheckpointLease(taskID, async () => {
            order.push("checkpoint-b")
          })
          releaseFirst()
          const second = await secondSpawn
          await Promise.all([checkpointA, checkpointB])
          await second.dispose()
          expect({ order, firstExit: await first.exited, secondExit: await second.exited }).toEqual({
            order: ["checkpoint-a", "checkpoint-b"],
            firstExit: 0,
            secondExit: 0,
          })
        } finally {
          restoreCheckpointFactory()
        }
      },
    })
  })
})
