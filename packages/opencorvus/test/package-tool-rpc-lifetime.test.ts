import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PackageToolBundle } from "../src/expert-squad/package-tool-bundle"
import { executePackageToolInCapsule, runPackageToolRpc } from "../src/expert-squad/package-tool-capsule"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { Process } from "../src/util/process"
import { which } from "../src/util/which"
import { createPluginToolFilesHost } from "../src/tool/plugin-tool-files-host"
import { withTaskScopedPluginToolHost } from "../src/tool/plugin-tool-host"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"
import type { ToolHost } from "@opencorvus-ai/plugin"
import { createServer } from "node:http"
import { PhysicalOperationScope } from "../src/util/physical-operation-scope"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

test("real package worker joins a finite admitted Host effect before returning external cancellation", async () => {
  await runEffectCase("abort")
})

test("real package worker reports a premature terminal protocol error after joining its admitted Host effect", async () => {
  await runEffectCase("premature")
})

async function runEffectCase(mode: "abort" | "premature") {
  await withRpcTask(async ({ project, taskID, session }) => {
    const sourcePath = path.join(project.path, "tools", "effect.ts")
    await fs.mkdir(path.dirname(sourcePath), { recursive: true })
    await fs.writeFile(
      sourcePath,
      `import { tool } from "@opencorvus-ai/plugin"
export default tool({ description: "Physical Host effect", args: {}, async execute(_args, context) {
  ${mode === "abort" ? "await" : "void"} context.host.engineArtifacts.publish({} as any)
  return "worker-result"
} })`,
    )
    const prepared = await PackageToolBundle.prepare({
      packageID: "lifetime",
      packageRoot: project.path,
      ref: "lifetime/shared/effect",
      owner: "shared",
      sourcePath,
    })
    const events: string[] = []
    let started!: () => void
    const entered = new Promise<void>((resolve) => {
      started = resolve
    })
    let release!: () => void
    const barrier = new Promise<void>((resolve) => {
      release = resolve
    })
    const marker = path.join(project.path, "effect.txt")
    let effect!: Promise<void>
    let fenceError: unknown
    const files = createPluginToolFilesHost((operation) => operation(), { taskID })
    const controller = new AbortController()
    const invocation = executePackageToolInCapsule({
      prepared,
      taskID,
      cwd: project.path,
      args: {},
      abort: controller.signal,
      context: {
        sessionID: session.id,
        messageID: Identifier.ascending("message"),
        agent: "probe",
        directory: project.path,
        worktree: project.path,
        configuration: {},
      },
      host: {
        kind: "task",
        engineArtifacts: {
          publish() {
            effect = (async () => {
              events.push("entered")
              started()
              await barrier
              await fs.writeFile(marker, "settled")
              events.push("effect")
              try {
                await files.writeFile(path.join(project.path, "next.txt"), "new effect")
              } catch (error) {
                fenceError = error
              }
            })()
            return effect
          },
        },
      } as never,
    }).then(
      (value) => {
        events.push("terminal")
        return { value, error: undefined }
      },
      (error: Error) => {
        events.push("terminal")
        return { value: undefined, error }
      },
    )
    await entered
    if (mode === "abort") {
      events.push("abort")
      controller.abort(new Error("operator cancellation"))
    }
    const timer = setTimeout(release, 300)
    try {
      const outcome = await invocation
      await effect
      expect(events).toEqual(
        mode === "abort" ? ["entered", "abort", "effect", "terminal"] : ["entered", "effect", "terminal"],
      )
      expect(await fs.readFile(marker, "utf8")).toBe("settled")
      expect(outcome.error?.message).toBe(
        mode === "abort"
          ? "operator cancellation"
          : "Package tool lifetime/shared/effect sent a terminal RPC response with 1 active Host call(s)",
      )
      expect((fenceError as Error).message).toBe(outcome.error!.message)
    } finally {
      clearTimeout(timer)
      release()
      await invocation
      await effect
    }
  })
}

type RpcTask = {
  project: Awaited<ReturnType<typeof memoryProject>>
  taskID: string
  session: ReturnType<typeof Session.prepareRootNext>
}

async function withRpcTask(operation: (task: RpcTask) => Promise<void>) {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await operation(await prepareRpcTask(project))
    },
  })
}

async function prepareRpcTask(project: RpcTask["project"]): Promise<RpcTask> {
  const session = Session.prepareRootNext({ kind: "root", directory: project.path, title: "RPC lifetime" })
  const taskID = Identifier.ascending("task"),
    now = Date.now(),
    digest = "a".repeat(64)
  persistEstablishedTask({
    taskID,
    rootSession: session,
    now,
    title: "RPC lifetime",
    request: "Settle admitted effects",
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision: {
      scope: "project",
      projectID: Instance.project.id,
      namespace: "test",
      id: "lifetime",
      version: "1.0.0",
      packageDigest: digest,
    },
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: project.path,
      packageRevisionSHA256: digest,
      timeCreated: now,
    }),
  })
  return { project, taskID, session }
}

const rpcPrefix = "\u001eopencorvus-package-tool-rpc-v1:"

async function runRpc(
  task: RpcTask,
  host: ToolHost,
  options: { inactivityMs?: number; tail?: string; abort?: AbortSignal } = {},
) {
  const handle = await ProcessSupervisor.spawnTaskCommand(
    { taskID: task.taskID, cwd: task.project.path },
    {
      executable: which("node")!,
      args: [
        "-e",
        `
const readline = require("node:readline");
const prefix = ${JSON.stringify(rpcPrefix)};
const lines = readline.createInterface({ input: process.stdin });
let started = false;
lines.on("line", (line) => {
  if (!started) {
    started = true;
    process.stdout.write(prefix + JSON.stringify({ kind: "host_call", id: "1", path: ["engineArtifacts", "publish"], args: [] }) + "\\n");
    ${options.tail ?? ""}
  } else {
    const response = JSON.parse(line);
    process.stdout.write(prefix + JSON.stringify(response.kind === "host_result" ? { kind: "result", value: response.value } : { kind: "failure", error: response.error }) + "\\n");
    lines.close(); process.stdin.pause(); process.stdin.unref();
  }
});`,
      ],
      stdin: "pipe",
      owner: "rpc-lifetime-test",
    },
  )
  const result = runPackageToolRpc({
    handle,
    ref: "lifetime/probe",
    inactivityMs: options.inactivityMs ?? 1500,
    host,
    abort: options.abort,
    start: {},
  })
  return result
}

function publisher(operation: () => Promise<unknown>): ToolHost {
  return { kind: "task", engineArtifacts: { publish: operation } } as never
}

test("nested Task process bytes keep the real RPC owner active across idle windows", async () => {
  await withRpcTask(async (task) => {
    const result = await runRpc(
      task,
      publisher(async () => {
        const result = await Process.runTask(
          { taskID: task.taskID, cwd: task.project.path },
          [
            which("node")!,
            "-e",
            'let i=0;const timer=setInterval(()=>{process.stdout.write(String(++i)+"\\n");if(i===8)clearInterval(timer)},300)',
          ],
          { inactivityTimeoutMs: 1500 },
        )
        return result.stdout.toString()
      }),
    )
    expect(result).toBe("1\n2\n3\n4\n5\n6\n7\n8\n")
  })
})

test("genuinely quiet nested Task process returns the idle error after physical settlement", async () => {
  await withRpcTask(async (task) => {
    let nested: Process.Result | undefined
    await expect(
      runRpc(
        task,
        publisher(async () => {
          nested = await Process.runTask(
            { taskID: task.taskID, cwd: task.project.path },
            [which("node")!, "-e", "setInterval(()=>{},1000)"],
            { nothrow: true },
          )
          return nested.code
        }),
      ),
    ).rejects.toThrow("Package tool lifetime/probe produced no process or RPC activity for 1500ms")
    expect(typeof nested?.code).toBe("number")
  })
})

test("completed Host file operations keep a serial RPC active", async () => {
  await withRpcTask(async (task) => {
    const files = createPluginToolFilesHost((operation) => operation(), { taskID: task.taskID })
    const result = await runRpc(
      task,
      publisher(async () => {
        for (let index = 0; index < 8; index++) {
          await new Promise((resolve) => setTimeout(resolve, 300))
          await files.writeFile(path.join(task.project.path, "progress.txt"), String(index))
        }
        return files.readFile(path.join(task.project.path, "progress.txt"), "utf8")
      }),
    )
    expect(result).toBe("7")
  })
})

test("streaming local HTTP bytes refresh idle and a stalled body is cancelled and joined", async () => {
  await withRpcTask(async (task) => {
    const closed: string[] = []
    const server = createServer((request, response) => {
      request.on("close", () => closed.push(request.url!))
      if (request.url === "/headers") return
      response.writeHead(200, { "content-type": "text/plain" })
      response.flushHeaders()
      if (request.url === "/stall") return
      let index = 0
      const timer = setInterval(() => {
        response.write(String(++index))
        if (index === 8) {
          clearInterval(timer)
          response.end()
        }
      }, 300)
      response.on("close", () => clearInterval(timer))
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address() as { port: number }
    const scope = {
      taskID: task.taskID,
      projectID: Instance.project.id,
      projectDirectory: task.project.path,
      taskRuntimeDirectory: task.project.path,
    } as TaskToolExecutionScope
    try {
      await withTaskScopedPluginToolHost(scope, async (host) => {
        const value = await runRpc(
          task,
          publisher(() => host.fetch(`http://127.0.0.1:${address.port}/active`)),
        )
        const response = value as Response
        expect(await response.text()).toBe("12345678")
        await expect(
          runRpc(
            task,
            publisher(() => host.fetch(`http://127.0.0.1:${address.port}/stall`)),
          ),
        ).rejects.toThrow("produced no process or RPC activity for 1500ms")
        await expect(
          runRpc(
            task,
            publisher(() => host.fetch(`http://127.0.0.1:${address.port}/headers`)),
          ),
        ).rejects.toThrow("produced no process or RPC activity for 1500ms")
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        server.closeAllConnections()
      })
    }
    expect(closed.sort()).toEqual(["/active", "/headers", "/stall"])
  })
})

test("the production command Host propagates real output and returns a settled cancellation receipt", async () => {
  await withRpcTask(async (task) => {
    const scope = {
      taskID: task.taskID,
      projectID: Instance.project.id,
      projectDirectory: task.project.path,
      taskRuntimeDirectory: task.project.path,
    } as TaskToolExecutionScope
    await withTaskScopedPluginToolHost(scope, async (host) => {
      const command = {
        executable: which("node")!,
        cwd: task.project.path,
        inactiveTimeoutMs: 10_000,
        args: [
          "-e",
          "let i=0;const timer=setInterval(()=>{process.stdout.write(String(++i));if(i===8)clearInterval(timer)},300)",
        ],
      }
      const result = await runRpc(
        task,
        publisher(() => host.runCommand(command)),
      )
      expect(result).toMatchObject({ exitCode: 0, stdout: "12345678", aborted: false, timedOut: false, error: null })
      let receipt: unknown
      await expect(
        runRpc(
          task,
          publisher(async () => {
            receipt = await host.runCommand({ ...command, args: ["-e", "setInterval(()=>{},1000)"] })
            return receipt
          }),
        ),
      ).rejects.toThrow("produced no process or RPC activity for 1500ms")
      expect(receipt).toMatchObject({ aborted: true, timedOut: false, error: null })
    })
  })
})

test("worker exit, worker failure and protocol failure revoke then join real finite Host effects", async () => {
  await withRpcTask(async (task) => {
    const cases = [
      {
        name: "exit",
        tail: "setTimeout(()=>process.exit(7),150)",
        message: "Capsule exited 7 without a terminal RPC response",
      },
      {
        name: "failure",
        tail: `setTimeout(()=>process.stdout.write(prefix+JSON.stringify({kind:"failure",error:{message:"worker failed"}})+"\\n"),150)`,
        message: "worker failed",
      },
      {
        name: "protocol",
        tail: `setTimeout(()=>process.stdout.write(prefix+JSON.stringify({kind:"host_call",id:"2",path:4,args:[]})+"\\n"),150)`,
        message: "Invalid package tool Host RPC call",
      },
    ]
    for (const item of cases) {
      const events: string[] = []
      const outcome = await runRpc(
        task,
        publisher(async () => {
          events.push("entered")
          PhysicalOperationScope.current()!.signal.addEventListener("abort", () => events.push("revoke"), {
            once: true,
          })
          await new Promise((resolve) => setTimeout(resolve, 400))
          await fs.writeFile(path.join(task.project.path, `${item.name}.txt`), "effect settled")
          events.push("effect")
        }),
        { tail: item.tail },
      ).then(
        () => "success",
        (error: Error) => {
          events.push("terminal")
          return error.message
        },
      )
      expect(outcome).toContain(item.message)
      expect(events).toEqual(["entered", "revoke", "effect", "terminal"])
      expect(await fs.readFile(path.join(task.project.path, `${item.name}.txt`), "utf8")).toBe("effect settled")
    }
  })
})

test("concurrent Projects and subsequent calls own independent physical scopes", async () => {
  await using firstProject = await memoryProject()
  await using secondProject = await memoryProject()
  const first = await Instance.provide({ directory: firstProject.path, fn: () => prepareRpcTask(firstProject) })
  const second = await Instance.provide({ directory: secondProject.path, fn: () => prepareRpcTask(secondProject) })
  const cancelled = Instance.provide({
    directory: firstProject.path,
    fn: () =>
      runRpc(
        first,
        publisher(async () => {
          const result = await Process.runTask(
            { taskID: first.taskID, cwd: first.project.path },
            [which("node")!, "-e", "setInterval(()=>{},1000)"],
            { nothrow: true },
          )
          return result.code
        }),
      ).then(
        () => "success",
        (error: Error) => error.message,
      ),
  })
  const active = Instance.provide({
    directory: secondProject.path,
    fn: () =>
      runRpc(
        second,
        publisher(async () => {
          const result = await Process.runTask({ taskID: second.taskID, cwd: second.project.path }, [
            which("node")!,
            "-e",
            'let i=0;const timer=setInterval(()=>{process.stdout.write("peer");if(++i===8)clearInterval(timer)},300)',
          ])
          return result.stdout.toString()
        }),
      ),
  })
  const results = await Promise.all([cancelled, active])
  expect(results).toEqual([
    "Package tool lifetime/probe produced no process or RPC activity for 1500ms",
    "peer".repeat(8),
  ])
  expect(
    await Instance.provide({
      directory: firstProject.path,
      fn: () =>
        runRpc(
          first,
          publisher(async () => "next occurrence"),
        ),
    }),
  ).toBe("next occurrence")
})

test("a premature result joins every parallel admitted Host call", async () => {
  await withRpcTask(async (task) => {
    let count = 0
    const events: string[] = []
    const outcome = await runRpc(
      task,
      publisher(async () => {
        const index = ++count
        await new Promise((resolve) => setTimeout(resolve, index * 400))
        await fs.writeFile(path.join(task.project.path, `parallel-${index}.txt`), `effect-${index}`)
        events.push(`effect-${index}`)
        return index
      }),
      {
        tail: `setTimeout(()=>process.stdout.write(prefix+JSON.stringify({kind:"host_call",id:"2",path:["engineArtifacts","publish"],args:[]})+"\\n"),100)`,
      },
    ).then(
      () => "success",
      (error: Error) => {
        events.push("terminal")
        return error.message
      },
    )
    expect(outcome).toBe("Package tool lifetime/probe sent a terminal RPC response with 1 active Host call(s)")
    expect(events).toEqual(["effect-1", "effect-2", "terminal"])
    expect(await fs.readFile(path.join(task.project.path, "parallel-2.txt"), "utf8")).toBe("effect-2")
  })
})

test("the terminal error preserves worker failure and an injected diagnostic after real process cleanup", async () => {
  await withRpcTask(async (task) => {
    const cleanupError = new Error("process cleanup observer failed")
    const outcome = await runRpc(
      task,
      publisher(async () => {
        const handle = await ProcessSupervisor.spawnTaskCommand(
          { taskID: task.taskID, cwd: task.project.path },
          {
            executable: which("node")!,
            args: ["-e", "setInterval(()=>{},1000)"],
            owner: "rpc-cleanup-error-test",
          },
        )
        PhysicalOperationScope.current()!.own(handle.settled, async () => {
          await ProcessSupervisor.disposeAndWaitForExit(handle, "actual cleanup before diagnostic failure")
          throw cleanupError
        })
        return await handle.exited
      }),
      {
        tail: `setTimeout(()=>process.stdout.write(prefix+JSON.stringify({kind:"failure",error:{message:"original worker error"}})+"\\n"),500)`,
      },
    ).then(
      () => undefined,
      (error: AggregateError) => error,
    )
    expect(outcome).toBeInstanceOf(AggregateError)
    expect(outcome!.errors.map((error: Error) => error.message)).toEqual([
      "original worker error",
      cleanupError.message,
    ])
  })
})
