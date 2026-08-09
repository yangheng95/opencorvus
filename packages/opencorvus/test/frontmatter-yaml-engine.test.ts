import { afterEach, describe, expect, test } from "bun:test"
import path from "node:path"
import { discoverBuiltinSkills } from "../script/generate-builtin-skill-payload"
import { ConfigMarkdown } from "../src/config/markdown"
import { Instance } from "../src/project/instance"
import { Skill } from "../src/skill/skill"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("frontmatter YAML engine", () => {
  test("parses and stringifies YAML frontmatter through the shared parser", () => {
    const parsed = ConfigMarkdown.parseText("---\nname: demo\ndescription: Demo Skill\n---\nBody\n", "inline")

    expect(parsed.data).toMatchObject({
      name: "demo",
      description: "Demo Skill",
    })
    expect(parsed.content.trim()).toBe("Body")

    const serialized = ConfigMarkdown.stringify(parsed.content, parsed.data)
    const reparsed = ConfigMarkdown.parseText(serialized, "serialized")

    expect(reparsed.data).toMatchObject({
      name: "demo",
      description: "Demo Skill",
    })
    expect(reparsed.content.trim()).toBe("Body")
  })

  test("loads the built-in Skill catalog with the shared YAML engine", async () => {
    await using project = await memoryProject()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const skills = await Skill.all()

        expect(skills.some((skill) => skill.builtin && skill.name.length > 0 && skill.description.length > 0)).toBe(
          true,
        )
      },
    })
  })

  test("generates the built-in Skill payload catalog with the shared YAML engine", async () => {
    const repoRoot = path.resolve(import.meta.dir, "../../..")
    const skills = await discoverBuiltinSkills(repoRoot)

    expect(skills.some((skill) => skill.name === "design-taste-frontend")).toBe(true)
  })
})
