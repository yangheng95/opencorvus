import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { resolveSessionExecutionAuthority } from "../src/engine/task-session-lineage"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Config } from "../src/config/config"
import { PrimaryAssistantRegistry } from "../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../src/agent/session-agent-runtime"
import { materializeUserMessage, preparedUserMessageFromPreflight } from "../src/session/prompt/parts"
import { BashTool } from "../src/tool/bash"
import { GlobTool } from "../src/tool/glob"
import { SearchCodeTool } from "../src/tool/grep"
import { ListTool } from "../src/tool/ls"
import { ReadTool } from "../src/tool/read"
import { Tool } from "../src/tool/tool"
import { executeWebFetch } from "../src/tool/webfetch"
import { WriteTool } from "../src/tool/write"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("conversation Tool execution authority", () => {
  test("materializes a Task-owned worker bootstrap message with its verified occurrence authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskSession = await Session.create({ kind: "root", title: "Task authority bootstrap root" })
        const workerSession = await Session.create({
          kind: "assistant",
          title: "Task authority bootstrap worker",
          parentID: taskSession.id,
        })
        const taskID = Identifier.ascending("task")
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.08.1",
          packageDigest: "b".repeat(64),
        }
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: taskSession.id,
          now,
          title: "Task authority bootstrap",
          request: "Materialize the exact Task-owned worker input",
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
        const prompt = {
          sessionID: workerSession.id,
          messageID: Identifier.ascending("message"),
          author: "orchestrator",
          agent: "coding",
          model: { providerID: "test", modelID: "task-bootstrap-model" },
          parts: [{ type: "text" as const, text: "Materialize the Task-owned bootstrap occurrence." }],
        }
        const config = await Config.get()
        const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
        const prepared = preparedUserMessageFromPreflight({
          prompt,
          config,
          session: workerSession,
          identity: { agentID: "coding", baseRole: "coding", runtime },
          modelPreflight: { model: prompt.model },
        })
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: workerSession.id,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          expected: { kind: "task", taskID },
        })
        const materialized = await materializeUserMessage(prompt, { prepared, executionAuthority })

        expect({
          authority: executionAuthority,
          message: {
            id: materialized.info.id,
            sessionID: materialized.info.sessionID,
            author: materialized.info.author,
            agent: materialized.info.agent,
          },
          parts: materialized.parts.map((part) =>
            part.type === "text"
              ? { type: part.type, text: part.text, sessionID: part.sessionID, messageID: part.messageID }
              : { type: part.type },
          ),
        }).toEqual({
          authority: {
            kind: "task",
            sessionID: workerSession.id,
            projectID: Instance.project.id,
            taskID,
            rootDirectory: project.path,
          },
          message: {
            id: prompt.messageID,
            sessionID: workerSession.id,
            author: "orchestrator",
            agent: "coding",
          },
          parts: [
            {
              type: "text",
              text: "Materialize the Task-owned bootstrap occurrence.",
              sessionID: workerSession.id,
              messageID: prompt.messageID,
            },
          ],
        })
      },
    })
  })

  test("executes project file, search, process, and network effects without an engine Task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Conversation execution authority" })
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: session.id,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          expected: { kind: "conversation" },
        })
        const abort = new AbortController().signal
        const context: Tool.Context = {
          sessionID: session.id,
          messageID: "message_conversation_authority",
          callID: "tool_conversation_authority",
          agent: "coding",
          abort,
          messages: [],
          executionAuthority,
          executionSurface: Tool.executionSurface(
            ["write", "read", "glob", "search_code", "list", "bash", "webfetch"],
            [],
          ),
          metadata() {},
          async ask() {},
        }

        const file = path.join(project.path, "authority-fixture.txt")
        await WriteTool.init().then((tool) =>
          tool.execute({ filePath: file, content: "conversation-authority-value\n" }, context),
        )
        const read = await ReadTool.init().then((tool) => tool.execute({ filePath: file }, context))
        const glob = await GlobTool.init().then((tool) =>
          tool.execute({ pattern: "authority-fixture.txt", path: project.path }, context),
        )
        const search = await SearchCodeTool.init().then((tool) =>
          tool.execute({ pattern: "conversation-authority-value", path: project.path }, context),
        )
        const listed = await ListTool.init().then((tool) => tool.execute({ path: project.path }, context))
        const executable = JSON.stringify(process.execPath)
        const bash = await BashTool.init().then((tool) =>
          tool.execute({ command: `${executable} --version`, description: "Report fixture runtime version" }, context),
        )

        const server = Bun.serve({
          port: 0,
          fetch: () => new Response("conversation-network-value", { headers: { "content-type": "text/plain" } }),
        })
        try {
          const fetched = await executeWebFetch(
            { url: `http://127.0.0.1:${server.port}/authority`, format: "text" },
            context,
          )
          expect({
            authority: executionAuthority,
            persisted: await fs.readFile(file, "utf8"),
            read: read.output.includes("conversation-authority-value"),
            glob: glob.output.includes(file),
            search: search.output.includes("conversation-authority-value"),
            list: listed.output.includes("authority-fixture.txt"),
            bash: bash.metadata.exit,
            fetch: fetched.output.includes("conversation-network-value"),
          }).toEqual({
            authority: {
              kind: "conversation",
              sessionID: session.id,
              projectID: Instance.project.id,
              rootDirectory: project.path,
            },
            persisted: "conversation-authority-value\n",
            read: true,
            glob: true,
            search: true,
            list: true,
            bash: 0,
            fetch: true,
          })
        } finally {
          server.stop(true)
        }
      },
    })
  }, 30_000)
})
