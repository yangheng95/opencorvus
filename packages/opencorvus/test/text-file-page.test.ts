import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../src/project/instance"
import { Skill } from "../src/skill/skill"
import { SkillTool, MissionSkillTool } from "../src/tool/skill"
import { Tool } from "../src/tool/tool"
import { readTextFilePage, readTextFilePageContent, renderTextFilePage } from "../src/tool/text-file"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)
const longLines = Array.from({ length: 300 }, (_, index) => `${index + 1}:` + "x".repeat(1990))
const lines = [...longLines, "END-OF-SUPPORT"]

test("byte-capped file pages retain the full total and continue from the next contiguous line", async () => {
  await using project = await memoryProject()
  const file = path.join(project.path, "support.txt")
  const content = lines.join("\n")
  await fs.writeFile(file, content)
  for (const page of [await readTextFilePage(file, {}), readTextFilePageContent(content, {})]) {
    expect(page).toMatchObject({
      raw: lines.slice(0, 25),
      offset: 1,
      lines: 25,
      totalLines: 301,
      lastReadLine: 25,
      nextOffset: 26,
      truncated: true,
      truncatedByBytes: true,
    })
    expect(renderTextFilePage(page)).toEndWith(
      "(Output capped at 50 KB. Showing lines 1-25. Use offset=26 to continue.)",
    )
  }
  const next = await readTextFilePage(file, { offset: 26, limit: 2 })
  expect(next).toMatchObject({ raw: lines.slice(25, 27), lines: 2, totalLines: 301, nextOffset: 28, truncated: true })
  expect(renderTextFilePage(next)).toEndWith("(Showing lines 26-27 of 301. Use offset=28 to continue.)")
  const last = await readTextFilePage(file, { offset: 301 })
  expect(last).toMatchObject({ raw: ["END-OF-SUPPORT"], lines: 1, totalLines: 301, nextOffset: 302, truncated: false })
  expect(renderTextFilePage(last)).toBe("301: END-OF-SUPPORT\n\n(End of file - total 301 lines)")
}, 30_000)

test.each([
  ["empty", "", []],
  ["blank", "\n", [""]],
  ["lf", "one\ntwo\n\n", ["one", "two", ""]],
  ["crlf", "one\r\ntwo\r\n", ["one", "two"]],
  ["cr", "one\rtwo\r", ["one", "two"]],
  ["mixed", "one\r\ntwo\rthree\nfour", ["one", "two", "three", "four"]],
] as const)(
  "file and content readers expose the same %s lines",
  async (name, content, raw) => {
    await using project = await memoryProject()
    const file = path.join(project.path, name)
    await fs.writeFile(file, content)
    const actual = await readTextFilePage(file, {})
    expect(actual).toMatchObject({ raw, lines: raw.length, totalLines: raw.length, truncated: false })
    expect(readTextFilePageContent(content, {})).toEqual(actual)
  },
  30_000,
)

test("UTF-8 byte bounds and line-length clipping share one page contract", async () => {
  await using project = await memoryProject()
  const file = path.join(project.path, "unicode.txt")
  const content = Array.from({ length: 40 }, () => "中".repeat(2200)).join("\n")
  await fs.writeFile(file, content)
  const expected = "中".repeat(2000) + "... (line truncated to 2000 chars)"
  for (const page of [await readTextFilePage(file, {}), readTextFilePageContent(content, {})]) {
    expect(page).toMatchObject({
      raw: Array(8).fill(expected),
      lines: 8,
      totalLines: 40,
      nextOffset: 9,
      truncatedByBytes: true,
    })
  }
}, 30_000)

test("out-of-range errors report the actual complete file length", async () => {
  await using project = await memoryProject()
  const file = path.join(project.path, "range.txt")
  const content = lines.join("\n")
  await fs.writeFile(file, content)
  await expect(readTextFilePage(file, { offset: 302 })).rejects.toThrow(
    "Offset 302 is out of range for this file (301 lines)",
  )
  expect(() => readTextFilePageContent(content, { offset: 302 })).toThrow(
    "Offset 302 is out of range for this file (301 lines)",
  )
}, 30_000)

test.each(["production", "mission"] as const)(
  "%s Skill tool publishes actual file totals and tail content",
  async (family) => {
    await using project = await memoryProject()
    const directory = path.join(
      project.path,
      family === "mission" ? ".opencorvus/mission-skills/page-contract" : ".opencorvus/skills/page-contract",
    )
    await fs.mkdir(directory, { recursive: true })
    const location = path.join(directory, "SKILL.md")
    await fs.writeFile(location, "---\nname: page-contract\ndescription: Text page contract\n---\nRead support.txt.\n")
    await fs.writeFile(path.join(directory, "support.txt"), lines.join("\n"))
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const skill = Skill.Info.parse({
          name: "page-contract",
          description: "Text page contract",
          location,
          content: "Read support.txt.",
        })
        const id = family === "mission" ? "mission_skill" : "skill"
        const base = {
          agent: family === "mission" ? "mission" : "work",
          base_role: "general",
          scope: "project" as const,
          tool_available: true,
          unmounted_pool_count: 0,
          skills: [{ ...skill, enabled: true, skill }],
        }
        const tool = await (family === "mission"
          ? MissionSkillTool.init({ skillSurface: { ...base, family, tool_id: "mission_skill" } })
          : SkillTool.init({ skillSurface: { ...base, family, tool_id: "skill" } }))
        const context: Tool.Context = {
          sessionID: "page-contract",
          messageID: "page-contract",
          agent: base.agent,
          abort: new AbortController().signal,
          messages: [],
          executionSurface: Tool.executionSurface([id], []),
          metadata() {},
        }
        const first = await tool.execute({ name: skill.name, file: "support.txt" }, context)
        expect(first.metadata).toMatchObject({ file: "support.txt", lines: 25, totalLines: 301, truncated: true })
        const tail = await tool.execute({ name: skill.name, file: "support.txt", offset: 301 }, context)
        expect(tail.metadata).toMatchObject({ lines: 1, totalLines: 301, truncated: false })
        expect(tail.output).toContain("301: END-OF-SUPPORT\n\n(End of file - total 301 lines)")
      },
    })
  },
  30_000,
)
