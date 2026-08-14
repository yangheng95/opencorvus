import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

describe("native conversation capability routes", () => {
  test("reads the project-owned Work capability assignment from the production route", async () => {
    await using project = await memoryProject()
    const response = await Server.App().request("/work/capability", {
      headers: { "x-opencorvus-directory": project.path },
    })

    expect(response.status).toBe(200)
    const settings = (await response.json()) as {
      scope: { kind: string; directory: string }
      agent_id: string
      tools: { declared: string[] }
      skills: { assigned_refs: string[]; installed: Array<{ name: string }> }
      mcp: { assigned_server_refs: string[]; configured_server_refs: string[] }
    }
    expect(settings).toMatchObject({
      scope: { kind: "project", directory: project.path },
      agent_id: "work",
      skills: { assigned_refs: ["work-artifacts"] },
      mcp: { assigned_server_refs: [] },
    })
    expect(settings.skills.installed.map((skill) => skill.name)).toContain("work-artifacts")
    expect(settings.mcp.configured_server_refs).toEqual(expect.arrayContaining(["browser", "computer"]))
    expect(settings.tools.declared).toEqual(
      expect.arrayContaining([
        "skill",
        "work_artifact_inspect",
        "work_artifact_author",
        "work_artifact_validate",
        "work_artifact_deliver",
      ]),
    )
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
