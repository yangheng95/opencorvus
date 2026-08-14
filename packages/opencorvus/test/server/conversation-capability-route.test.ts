import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { Instance } from "../../src/project/instance"
import { Config } from "../../src/config/config"
import { ConversationCapability } from "../../src/conversation/capability"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { SessionLoop } from "../../src/session/loop"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

describe("native conversation capability routes", () => {
  test("reads default Browser and Computer assignments for native Chat and Work", async () => {
    await using project = await memoryProject()
    const headers = { "x-opencorvus-directory": project.path }
    const [workResponse, chatResponse] = await Promise.all([
      Server.App().request("/work/capability", { headers }),
      Server.App().request("/chat/capability", { headers }),
    ])

    expect(workResponse.status).toBe(200)
    expect(chatResponse.status).toBe(200)
    const workSettings = (await workResponse.json()) as {
      scope: { kind: string; directory: string }
      agent_id: string
      tools: { declared: string[] }
      skills: { assigned_refs: string[]; installed: Array<{ name: string }> }
      mcp: { assigned_server_refs: string[]; configured_server_refs: string[] }
    }
    const chatSettings = (await chatResponse.json()) as {
      agent_id: string
      mcp: { assigned_server_refs: string[]; configured_server_refs: string[] }
    }
    expect(workSettings).toMatchObject({
      scope: { kind: "project", directory: project.path },
      agent_id: "work",
      skills: { assigned_refs: ["work-artifacts"] },
      mcp: { assigned_server_refs: ["browser", "computer"] },
    })
    expect(chatSettings).toMatchObject({
      agent_id: "chat",
      mcp: { assigned_server_refs: ["browser", "computer"] },
    })
    expect(workSettings.skills.installed.map((skill) => skill.name)).toContain("work-artifacts")
    expect(workSettings.mcp.configured_server_refs).toEqual(expect.arrayContaining(["browser", "computer"]))
    expect(chatSettings.mcp.configured_server_refs).toEqual(expect.arrayContaining(["browser", "computer"]))
    expect(workSettings.tools.declared).toEqual(
      expect.arrayContaining([
        "skill",
        "work_artifact_inspect",
        "work_artifact_author",
        "work_artifact_validate",
        "work_artifact_deliver",
      ]),
    )
  }, 90_000)

  test("persists an explicit project-owned Work MCP assignment", async () => {
    await using project = await memoryProject()
    const headers = {
      "content-type": "application/json",
      "x-opencorvus-directory": project.path,
    }
    for (const ref of ["browser", "computer"]) {
      const update = await Server.App().request("/work/capability", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ kind: "mcp_server", ref, assigned: false }),
      })
      expect(update.status).toBe(200)
    }

    const read = await Server.App().request("/work/capability", { headers })
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual(
      expect.objectContaining({
        agent_id: "work",
        mcp: expect.objectContaining({ assigned_server_refs: [] }),
      }),
    )
  }, 90_000)

  test("projects the default Browser and Computer tool catalogs into Work", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = "default-browser-computer-catalog"
        try {
          const tools = await ConversationCapability.runtimeMcpTools(await Config.get(), "work", sessionID)
          const toolNames = Object.keys(tools)
          expect(toolNames).toEqual(expect.arrayContaining(["browser_navigate", "browser_observe"]))
          expect(toolNames).toEqual(
            expect.arrayContaining(ComputerMCPBuiltin.ImportableToolNames.map((name) => `computer_${name}`)),
          )
          const schemaChars = SessionLoop.estimateToolPayloadChars(tools)
          expect(schemaChars).toBeGreaterThan(0)
        } finally {
          await ConversationCapability.disposeRuntimeMcp(sessionID)
        }
      },
    })
  }, 90_000)

  test("updates the project-owned Work Skill assignment through the production route", async () => {
    await using project = await memoryProject()
    const headers = {
      "content-type": "application/json",
      "x-opencorvus-directory": project.path,
    }
    const update = await Server.App().request("/work/capability", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ kind: "skill", ref: "research-report", assigned: true }),
    })

    expect(update.status).toBe(200)
    const updated = (await update.json()) as { agent_id: string; skills: { assigned_refs: string[] } }
    expect(updated).toEqual(
      expect.objectContaining({
        agent_id: "work",
        skills: expect.objectContaining({ assigned_refs: ["work-artifacts", "research-report"] }),
      }),
    )

    const read = await Server.App().request("/work/capability", { headers })
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual(
      expect.objectContaining({
        agent_id: "work",
        skills: expect.objectContaining({ assigned_refs: ["work-artifacts", "research-report"] }),
      }),
    )
  }, 90_000)
})
