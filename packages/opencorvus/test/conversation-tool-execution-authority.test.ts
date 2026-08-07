import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { resolveSessionExecutionAuthority } from "../src/engine/task-session-lineage"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
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
