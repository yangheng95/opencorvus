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
  const taskSession = await Session.create({ kind: "root", title: "Bounded search Task root" })
  const workerSession = await Session.create({
    kind: "assistant",
    title: "Bounded search Task worker",
    parentID: taskSession.id,
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
    sessionID: taskSession.id,
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
        const restore = ProcessSupervisor.setCommandFactoryForTest(async () => ({
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
        }))
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
          liveProcesses: ProcessSupervisor.metricsSnapshot().live,
        }).toEqual({
          error: { name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true },
          terminationCount: 1,
          liveProcesses: liveBefore,
        })
      },
    })
  })
})
