import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PassThrough } from "node:stream"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { ProcessSupervisor } from "../../src/shell/process-supervisor"
import { SEARCH_CODE_MAX_OUTPUT_BYTES, SearchCodeExecutionError, SearchCodeTool } from "../../src/tool/grep"
import { Tool } from "../../src/tool/tool"
import { Ripgrep } from "../../src/file/ripgrep"
import { persistEstablishedTask as persistTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

async function conversationContext(session: Session.Info): Promise<Tool.Context> {
  const executionAuthority = await resolveSessionExecutionAuthority({
    sessionID: session.id,
    projectID: Instance.project.id,
    expected: { kind: "conversation" },
  })
  return {
    sessionID: session.id,
    messageID: "message_search_code_bounded_execution",
    callID: "tool_search_code_bounded_execution",
    agent: "coding",
    abort: new AbortController().signal,
    messages: [],
    executionAuthority,
    executionSurface: Tool.executionSurface(["search_code"], []),
    metadata() {},
  }
}

async function taskContext(projectPath: string): Promise<Tool.Context> {
  const taskSession = Session.prepareRootNext({
    kind: "root",
    title: "Bounded search Task root",
    directory: projectPath,
  })
  const taskID = Identifier.ascending("task")
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.26.1",
    packageDigest: "b".repeat(64),
  }
  const now = Date.now()
  persistTask({
    taskID,
    rootSession: taskSession,
    now,
    title: "Bounded search Task",
    request: "Verify bounded search execution",
    productPillar: "code",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: projectPath,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const workerSession = await Session.create({
    kind: "assistant",
    title: "Bounded search Task worker",
    parentID: taskSession.id,
  })
  const executionAuthority = await resolveSessionExecutionAuthority({
    sessionID: workerSession.id,
    projectID: Instance.project.id,
    expected: { kind: "task", taskID },
  })
  return {
    sessionID: workerSession.id,
    messageID: "message_search_code_task_bounded_execution",
    callID: "tool_search_code_task_bounded_execution",
    agent: "coding",
    abort: new AbortController().signal,
    messages: [],
    executionAuthority,
    executionSurface: Tool.executionSurface(["search_code"], []),
    metadata() {},
  }
}

function completedHandle(input: {
  pid: number
  code: number
  stdoutText: string
  stderrText: string
  onSettled?: () => void
}): ProcessSupervisor.Handle {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  let resolveExit!: (code: number) => void
  let resolveOutput!: () => void
  let resolveSettlement!: () => void
  const exited = new Promise<number>((resolve) => (resolveExit = resolve))
  const outputSettled = new Promise<void>((resolve) => (resolveOutput = resolve))
  const settled = new Promise<void>((resolve) => (resolveSettlement = resolve))
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    stdout.end(input.stdoutText)
    stderr.end(input.stderrText)
    resolveExit(input.code)
    resolveOutput()
    resolveSettlement()
    input.onSettled?.()
  }
  setTimeout(close, 0)
  return {
    pid: input.pid,
    stdin: new PassThrough(),
    stdout,
    stderr,
    exited,
    outputSettled,
    settled,
    async terminate() {
      close()
    },
    async dispose() {
      close()
    },
    unref() {},
  }
}

describe("search_code bounded execution", () => {
  test("keeps repository ignore boundaries when include is broad", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const marker = "search-code-visible-contract-20260826"
        const visible = path.join(project.path, "visible.ts")
        const ignored = path.join(project.path, "ignored", "decoy.ts")
        const gitMetadata = path.join(project.path, ".git", "objects", "search-code-decoy.ts")
        await fs.mkdir(path.dirname(ignored), { recursive: true })
        await fs.mkdir(path.dirname(gitMetadata), { recursive: true })
        await Promise.all([
          fs.writeFile(path.join(project.path, ".ignore"), "ignored/\n"),
          fs.writeFile(visible, `${marker}\n`),
          fs.writeFile(ignored, `${marker}\n`),
          fs.writeFile(gitMetadata, `${marker}\n`),
        ])
        const context = await taskContext(project.path)

        const result = await SearchCodeTool.init().then((tool) =>
          tool.execute({ pattern: marker, path: project.path, include: "*" }, context),
        )

        expect(result).toEqual({
          title: marker,
          metadata: { matches: 1, truncated: false },
          output: [`Found 1 matches`, `${visible}:`, `  Line 1: ${marker}`].join("\n"),
        })
      },
    })
  })

  test("filters ignored-aware candidates before narrow content searches consume the shared output budget", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const marker = "search-code-narrow-contract-20260826"
        const rootTypeScript = path.join(project.path, "root.ts")
        const nestedTypeScript = path.join(project.path, "src", "nested.ts")
        const largeJavaScript = path.join(project.path, "large.js")
        await fs.mkdir(path.dirname(nestedTypeScript), { recursive: true })
        await Promise.all([
          fs.writeFile(rootTypeScript, `${marker}\n`),
          fs.writeFile(nestedTypeScript, `${marker}\n`),
          fs.writeFile(
            largeJavaScript,
            `${marker}\n`.repeat(Math.ceil((SEARCH_CODE_MAX_OUTPUT_BYTES + 1) / (marker.length + 1))),
          ),
        ])
        await fs.utimes(rootTypeScript, new Date("2026-08-26T00:00:00Z"), new Date("2026-08-26T00:00:00Z"))
        await fs.utimes(nestedTypeScript, new Date("2026-08-26T00:01:00Z"), new Date("2026-08-26T00:01:00Z"))
        const session = await Session.create({ kind: "assistant", title: "Narrow search candidate contract" })
        const context = await conversationContext(session)
        const tool = await SearchCodeTool.init()

        const allTypeScript = await tool.execute({ pattern: marker, path: project.path, include: "*.ts" }, context)
        const nestedTypeScriptOnly = await tool.execute(
          { pattern: marker, path: project.path, include: "src/*.ts" },
          context,
        )

        expect({ allTypeScript, nestedTypeScriptOnly }).toEqual({
          allTypeScript: {
            title: marker,
            metadata: { matches: 2, truncated: false },
            output: [
              `Found 2 matches`,
              `${nestedTypeScript}:`,
              `  Line 1: ${marker}`,
              "",
              `${rootTypeScript}:`,
              `  Line 1: ${marker}`,
            ].join("\n"),
          },
          nestedTypeScriptOnly: {
            title: marker,
            metadata: { matches: 1, truncated: false },
            output: [`Found 1 matches`, `${nestedTypeScript}:`, `  Line 1: ${marker}`].join("\n"),
          },
        })
      },
    })
  })

  test("preserves partial enumeration results across argument batches under one deadline and output budget", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Ripgrep.filepath()
        const marker = "search-code-batch-contract-20260826"
        const visible = path.join(project.path, "visible.ts")
        await fs.writeFile(visible, `${marker}\n`)
        const candidates = [visible]
        let candidateCharacters = visible.length + 3
        for (let index = 0; candidateCharacters < 30_000; index++) {
          const candidate = path.join(
            project.path,
            "generated",
            `${String(index).padStart(4, "0")}-${"x".repeat(120)}.ts`,
          )
          candidates.push(candidate)
          candidateCharacters += candidate.length + 3
        }
        const enumerationOutput = `${candidates.join("\n")}\n`
        const enumerationError = "one path was inaccessible\n"
        const matchOutput = `${visible}|1|${marker}\n`
        const spawned: ProcessSupervisor.CommandSpawnOptions[] = []
        let settledCount = 0
        const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
          const callIndex = spawned.push(options) - 1
          return completedHandle({
            pid: 992000 + callIndex,
            code: callIndex === 0 ? 2 : callIndex === 1 ? 0 : 1,
            stdoutText: callIndex === 0 ? enumerationOutput : callIndex === 1 ? matchOutput : "",
            stderrText: callIndex === 0 ? enumerationError : "",
            onSettled: () => settledCount++,
          })
        })
        const session = await Session.create({ kind: "assistant", title: "Search batch budget contract" })
        const context = await conversationContext(session)
        try {
          const result = await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: marker, path: project.path, include: "*.ts" }, context),
          )
          const contentCalls = spawned.slice(1)

          expect({
            result,
            multipleContentBatches: contentCalls.length > 1,
            argumentBounds: contentCalls.map(
              (call) =>
                call.executable.length + call.args.reduce((total, value) => total + value.length + 3, 0) <= 12_000,
            ),
            owners: spawned.map((call) => call.owner),
            settledCount,
          }).toEqual({
            result: {
              title: marker,
              metadata: { matches: 1, truncated: false },
              output: [
                `Found 1 matches`,
                `${visible}:`,
                `  Line 1: ${marker}`,
                "",
                "(Some paths were inaccessible and skipped)",
              ].join("\n"),
            },
            multipleContentBatches: true,
            argumentBounds: contentCalls.map(() => true),
            owners: spawned.map(() => "search-code"),
            settledCount: spawned.length,
          })
        } finally {
          restore()
        }
      },
    })
  })

  test("shares one retained-output budget across enumeration and successive content batches", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Ripgrep.filepath()
        const candidates: string[] = []
        let candidateCharacters = 0
        for (let index = 0; candidateCharacters < 30_000; index++) {
          const candidate = path.join(
            project.path,
            "generated",
            `${String(index).padStart(4, "0")}-${"x".repeat(120)}.ts`,
          )
          candidates.push(candidate)
          candidateCharacters += candidate.length + 3
        }
        const enumerationOutput = `${candidates.join("\n")}\n`
        const remainingAfterEnumeration = SEARCH_CODE_MAX_OUTPUT_BYTES - Buffer.byteLength(enumerationOutput)
        const firstContentOutput = "x".repeat(Math.floor(remainingAfterEnumeration / 2))
        const secondContentOutput = "y".repeat(remainingAfterEnumeration - Buffer.byteLength(firstContentOutput) + 1)
        const spawned: ProcessSupervisor.CommandSpawnOptions[] = []
        const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
          const callIndex = spawned.push(options) - 1
          return completedHandle({
            pid: 993000 + callIndex,
            code: 0,
            stdoutText:
              callIndex === 0 ? enumerationOutput : callIndex === 1 ? firstContentOutput : secondContentOutput,
            stderrText: "",
          })
        })
        const session = await Session.create({ kind: "assistant", title: "Search shared output budget contract" })
        const context = await conversationContext(session)
        let observed: unknown
        try {
          await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: "batch-budget", path: project.path, include: "*.ts" }, context),
          )
        } catch (error) {
          observed = error
        } finally {
          restore()
        }

        expect({
          error:
            observed instanceof SearchCodeExecutionError
              ? { name: observed.name, code: observed.code, cause: observed.cause instanceof Error }
              : observed,
          calls: spawned.length,
          owners: spawned.map((call) => call.owner),
        }).toEqual({
          error: { name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true },
          calls: 3,
          owners: spawned.map(() => "search-code"),
        })
      },
    })
  })

  test("returns a typed regex failure even when include selects no candidates", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Search regex validation contract" })
        const context = await conversationContext(session)
        let observed: unknown
        try {
          await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: "[", path: project.path, include: "*.missing" }, context),
          )
        } catch (error) {
          observed = error
        }

        expect(
          observed instanceof SearchCodeExecutionError
            ? { name: observed.name, code: observed.code, cause: observed.cause instanceof Error }
            : observed,
        ).toEqual({ name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true })
      },
    })
  })

  test("rejects include complexity that cannot be matched completely", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Search include complexity contract" })
        const context = await conversationContext(session)
        const tool = await SearchCodeTool.init()
        const patterns = [
          `{${Array.from({ length: 257 }, (_, index) => `f${index}`).join(",")}}.ts`,
          `${Array.from({ length: 33 }, () => "**").join("/")}/*.ts`,
          "x".repeat(4097),
        ]
        const errors: Array<{ name: string; code: string; cause: boolean }> = []
        for (const include of patterns) {
          try {
            await tool.execute({ pattern: "include-complexity", path: project.path, include }, context)
          } catch (error) {
            if (error instanceof SearchCodeExecutionError) {
              errors.push({ name: error.name, code: error.code, cause: error.cause instanceof Error })
            }
          }
        }

        expect(errors).toEqual(
          patterns.map(() => ({
            name: "SearchCodeExecutionError",
            code: "SEARCH_CODE_EXECUTION_FAILED",
            cause: true,
          })),
        )
      },
    })
  })

  test("returns typed incomplete errors when partial enumeration cannot establish a match", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Ripgrep.filepath()
        const session = await Session.create({ kind: "assistant", title: "Search partial zero-result contract" })
        const context = await conversationContext(session)
        const scenarios = [
          { candidate: path.join(project.path, "visible.js"), include: "*.ts" },
          { candidate: path.join(project.path, "visible.ts"), include: "*.ts" },
        ]
        const results: Array<{
          error: { name: string; code: string; cause: boolean } | unknown
          partialEnumerationFact: boolean
          calls: number
          owners: Array<string | undefined>
        }> = []
        for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex++) {
          const scenario = scenarios[scenarioIndex]!
          const spawned: ProcessSupervisor.CommandSpawnOptions[] = []
          const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
            const callIndex = spawned.push(options) - 1
            return completedHandle({
              pid: 994000 + scenarioIndex * 10 + callIndex,
              code: callIndex === 0 ? 2 : 1,
              stdoutText: callIndex === 0 ? `${scenario.candidate}\n` : "",
              stderrText: callIndex === 0 ? "enumeration incomplete\n" : "",
            })
          })
          let observed: unknown
          try {
            await SearchCodeTool.init().then((tool) =>
              tool.execute({ pattern: "partial-zero", path: project.path, include: scenario.include }, context),
            )
          } catch (error) {
            observed = error
          } finally {
            restore()
          }
          results.push({
            error:
              observed instanceof SearchCodeExecutionError
                ? { name: observed.name, code: observed.code, cause: observed.cause instanceof Error }
                : observed,
            partialEnumerationFact:
              observed instanceof SearchCodeExecutionError &&
              observed.message.includes("enumeration incomplete") &&
              observed.cause instanceof Error &&
              observed.cause.message.includes("enumeration incomplete"),
            calls: spawned.length,
            owners: spawned.map((call) => call.owner),
          })
        }

        expect(results).toEqual(
          scenarios.map(() => ({
            error: { name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true },
            partialEnumerationFact: true,
            calls: 2,
            owners: ["search-code", "search-code"],
          })),
        )
      },
    })
  })

  test("terminates and settles an over-budget command with a typed execution error", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Ripgrep.filepath()
        const session = await Session.create({ kind: "assistant", title: "Bounded search output contract" })
        const context = await conversationContext(session)
        const liveBefore = ProcessSupervisor.metricsSnapshot().live
        const stdout = new PassThrough()
        const stderr = new PassThrough()
        let resolveExit!: (code: number) => void
        let resolveOutput!: () => void
        let resolveSettlement!: () => void
        const exited = new Promise<number>((resolve) => (resolveExit = resolve))
        const outputSettled = new Promise<void>((resolve) => (resolveOutput = resolve))
        const settled = new Promise<void>((resolve) => (resolveSettlement = resolve))
        let terminationCount = 0
        let observedOwner: string | undefined
        let closed = false
        const close = () => {
          if (closed) return
          closed = true
          stdout.end()
          stderr.end()
          resolveExit(1)
          resolveOutput()
          resolveSettlement()
        }
        const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
          observedOwner = options.owner
          return {
            pid: 991026,
            stdin: null,
            stdout,
            stderr,
            exited,
            outputSettled,
            settled,
            async terminate() {
              terminationCount++
              close()
            },
            async dispose() {
              close()
            },
            unref() {},
          }
        })
        const emit = setTimeout(() => stdout.write(Buffer.alloc(SEARCH_CODE_MAX_OUTPUT_BYTES + 1, "x")), 0)
        let observed: unknown
        try {
          await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: "bounded-output", path: project.path }, context),
          )
        } catch (error) {
          observed = error
        } finally {
          clearTimeout(emit)
          restore()
        }
        await Promise.resolve()

        expect({
          error:
            observed instanceof SearchCodeExecutionError
              ? { name: observed.name, code: observed.code, cause: observed.cause instanceof Error }
              : observed,
          terminationCount,
          owner: observedOwner,
          liveProcesses: ProcessSupervisor.metricsSnapshot().live,
        }).toEqual({
          error: { name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true },
          terminationCount: 1,
          owner: "search-code",
          liveProcesses: liveBefore,
        })
      },
    })
  })
})
