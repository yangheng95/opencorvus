import { afterAll, describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { LSP } from "../src/lsp"
import { Instance } from "../src/project/instance"
import { ReadTool } from "../src/tool/read"
import { Tool } from "../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Session } from "../src/session"
import { Identifier } from "../src/id/id"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { ensureGitignore } from "../src/engine/git"
import { resolveSessionExecutionAuthority } from "../src/engine/task-session-lineage"
import { Bus } from "../src/bus"
import { GlobalBus } from "../src/bus/global"

afterAll(resetMemoryDatabase)

describe("Read tool Language Server Protocol warm-up", () => {
  test("returns the complete file result while the optional warm-up completes independently", async () => {
    await using project = await memoryProject()
    const source = path.join(project.path, "sample.ts")
    await writeFile(source, "export const exactValue = 42\n")

    let finishWarmup: (() => void) | undefined
    let completeWarmup: (() => void) | undefined
    const warmupCompleted = new Promise<void>((resolve) => {
      completeWarmup = resolve
    })
    let warmupProjectID: string | undefined
    const globalEvents: Array<{ directory?: string; payload: { type?: string } }> = []
    const onGlobalEvent = (event: { directory?: string; payload: { type?: string } }) => globalEvents.push(event)
    GlobalBus.on("event", onGlobalEvent)
    const restoreWarmup = LSP.setWarmFileTouchForTest(async () => {
      await new Promise<void>((resolve) => {
        finishWarmup = resolve
      })
      warmupProjectID = Instance.project.id
      await Bus.publish(LSP.Event.Updated, {})
      completeWarmup?.()
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await ensureGitignore()
          const session = await Session.create({ kind: "root", title: "Read warm-up authority" })
          const taskID = Identifier.ascending("task")
          const now = Date.now()
          const packageDigest = "a".repeat(64)
          persistQueuedTask({
            taskID,
            sessionID: session.id,
            now,
            title: "Read warm-up authority",
            request: "Read the exact source file",
            productPillar: "code",
            source: "test",
            priority: "normal",
            metadata: {},
            projectID: Instance.project.id,
            queue: true,
            packageRevision: {
              scope: "built_in",
              projectID: null,
              namespace: "builtin",
              id: "base",
              version: "2026.08.07.1",
              packageDigest,
            },
            executionCapsuleBinding: await prepareTaskProcessBinding({
              mode: "native",
              taskID,
              projectID: Instance.project.id,
              rootDirectory: project.path,
              packageRevisionSHA256: packageDigest,
              timeCreated: now,
            }),
          })
          const executionAuthority = await resolveSessionExecutionAuthority({
            sessionID: session.id,
            projectID: Instance.project.id,
            expected: { kind: "task", taskID },
          })
          const tool = await ReadTool.init()
          const result = await tool.execute(
            { filePath: "sample.ts" },
            {
              sessionID: session.id,
              messageID: "message-read-warmup",
              callID: "call-read-warmup",
              agent: "build",
              abort: new AbortController().signal,
              messages: [],
              executionAuthority,
              executionSurface: Tool.executionSurface(["read"], []),
              metadata: () => {},
              ask: async () => {},
            },
          )
          expect(result).toMatchObject({
            title: "sample.ts",
            metadata: {
              truncated: false,
              lines: 1,
              totalLines: 1,
            },
          })
          expect(result.output).toContain("export const exactValue = 42")
        },
      })
      finishWarmup?.()
      await warmupCompleted
      expect(warmupProjectID).toBeDefined()
      expect(
        globalEvents.filter((event) => event.payload.type === LSP.Event.Updated.type).map((event) => event.directory),
      ).toEqual([project.path])
    } finally {
      finishWarmup?.()
      restoreWarmup()
      GlobalBus.off("event", onGlobalEvent)
    }
  })
})
