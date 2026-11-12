import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { Instance } from "../../src/project/instance"
import { Config } from "../../src/config/config"
import { ConversationCapability } from "../../src/conversation/capability"
import { HostSessionMcpRuntime } from "../../src/mcp/host-session-runtime"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { prepareConversationMcpCatalog } from "../fixture/conversation-mcp"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

describe("native conversation capability routes", () => {
  test("separates configured MCP inventory from default native Chat and Work assignments", async () => {
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
      mcp: { assigned_server_refs: [] },
    })
    expect(chatSettings).toMatchObject({
      agent_id: "chat",
      mcp: { assigned_server_refs: [] },
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
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = await Config.get()
        const payloads = await Promise.all(
          (["chat", "work"] as const).map(async (agentID) => {
            const catalog = await prepareConversationMcpCatalog(config, agentID, `default-${agentID}-catalog`)
            return {
              agentID,
              toolNames: catalog.names,
            }
          }),
        )
        expect(payloads).toEqual([
          { agentID: "chat", toolNames: [] },
          { agentID: "work", toolNames: [] },
        ])
      },
    })
  }, 90_000)

  test("persists explicit project-owned Work MCP assignments", async () => {
    await using project = await memoryProject()
    const headers = {
      "content-type": "application/json",
      "x-opencorvus-directory": project.path,
    }
    for (const ref of ["browser", "computer"]) {
      const update = await Server.App().request("/work/capability", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ kind: "mcp_server", ref, assigned: true }),
      })
      expect(update.status).toBe(200)
    }

    const read = await Server.App().request("/work/capability", { headers })
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual(
      expect.objectContaining({
        agent_id: "work",
        mcp: expect.objectContaining({ assigned_server_refs: ["browser", "computer"] }),
      }),
    )
  }, 90_000)

  test("validates native MCP assignments against the original connection reference", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: () => Config.updateProjectPatch({
        mcp: {
          "review-tools": { enabled: false },
          " review-tools ": { enabled: false },
          "": { enabled: false },
        },
      }),
    })
    const headers = {
      "content-type": "application/json",
      "x-opencorvus-directory": project.path,
    }
    const update = (experience: "chat" | "work", ref: string) => Server.App().request(`/${experience}/capability`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ kind: "mcp_server", ref, assigned: true }),
    })
    for (const experience of ["chat", "work"] as const) {
      const padded = await update(experience, " review-tools ")
      expect(padded.status).toBe(400)
      expect(await padded.json()).toEqual({
        success: false,
        data: { message: "Request validation failed" },
        error: [{
          code: "custom",
          path: ["ref"],
          message: "An MCP assignment requires a connection name without leading or trailing whitespace.",
        }],
      })

      const empty = await update(experience, "")
      expect(empty.status).toBe(400)
      expect(await empty.json()).toMatchObject({
        success: false,
        error: [{ code: "too_small", path: ["ref"] }],
      })

      const exact = await update(experience, "review-tools")
      expect(exact.status).toBe(200)
      expect(await exact.json()).toMatchObject({
        agent_id: experience,
        mcp: {
          assigned_server_refs: ["review-tools"],
          configured_server_refs: ["", " review-tools ", "browser", "computer", "review-tools"],
        },
      })
    }
  }, 90_000)

  test("projects explicitly assigned Browser and Computer tool catalogs into Work", async () => {
    await using project = await memoryProject()
    const headers = {
      "content-type": "application/json",
      "x-opencorvus-directory": project.path,
    }
    for (const ref of ["browser", "computer"]) {
      const update = await Server.App().request("/work/capability", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ kind: "mcp_server", ref, assigned: true }),
      })
      expect(update.status).toBe(200)
    }
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessionID = "default-browser-computer-catalog"
        try {
          const catalog = await prepareConversationMcpCatalog(await Config.get(), "work", sessionID)
          const toolNames = catalog.names
          const browserToolNames = toolNames.filter((name) => name.startsWith(`${BrowserMCPBuiltin.ServerName}_`))
          const computerToolNames = toolNames.filter((name) => name.startsWith(`${ComputerMCPBuiltin.ServerName}_`))
          expect({ total: toolNames.length, browser: browserToolNames.length, computer: computerToolNames }).toEqual({
            total: 46 + ComputerMCPBuiltin.ImportableToolNames.length,
            browser: 46,
            computer: ComputerMCPBuiltin.ImportableToolNames.map((name) => `computer_${name}`).sort(),
          })
          expect(toolNames.length).toBeGreaterThan(0)
        } finally {
          await HostSessionMcpRuntime.dispose(sessionID)
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
