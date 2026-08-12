import { describe, expect, test } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { SkillManager } from "@/skill/manager"
import { SkillRoutes } from "@/server/routes/skill"
import { GlobalRoutes } from "@/server/routes/global"

const expectedCatalog = [
  { id: "openai-skills", provider: "OpenAI", trust: "official" },
  { id: "anthropic-skills", provider: "Anthropic", trust: "official" },
  { id: "skills-sh", provider: "skills.sh", trust: "curated" },
  { id: "skillstore", provider: "Skillstore", trust: "curated" },
  { id: "skills-pub", provider: "skills.pub", trust: "community" },
]

describe("Skill market builtin authority", () => {
  test("projects the same typed builtin catalog through manager and both public routes", async () => {
    const before = await Config.getGlobal()
    const installedDirectory = path.join(SkillManager.managedRoot(), "github.com-openai-skills")
    await mkdir(installedDirectory, { recursive: true })
    try {
      await Config.writeGlobal({
        ...before,
        skills: {
          ...before.skills,
          paths: [installedDirectory],
        },
      })

      const managerEntries = await SkillManager.market()
      expect(
        managerEntries.map((entry) => ({
          id: entry.id,
          provider: entry.provider,
          trust: entry.trust,
        })),
      ).toEqual(expectedCatalog)
      expect(managerEntries.find((entry) => entry.id === "openai-skills")?.installed).toBe(true)
      expect(managerEntries.find((entry) => entry.id === "anthropic-skills")?.installed).toBe(false)

      const app = new Hono().route("/skill", SkillRoutes()).route("/global", GlobalRoutes())
      const [projectResponse, globalResponse] = await Promise.all([
        app.request("/skill/market"),
        app.request("/global/skill/market"),
      ])
      expect(projectResponse.status).toBe(200)
      expect(globalResponse.status).toBe(200)
      expect(await projectResponse.json()).toEqual(managerEntries)
      expect(await globalResponse.json()).toEqual(managerEntries)
    } finally {
      await Config.writeGlobal(before)
      await rm(installedDirectory, { recursive: true, force: true })
    }
  })
})
