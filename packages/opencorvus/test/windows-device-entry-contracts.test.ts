import { afterAll, expect, test } from "bun:test"
import path from "node:path"
import { z } from "zod"
import { TaskArtifactPortableSegmentSchema } from "@opencorvus-ai/plugin/task-artifact"
import { AuthorOfficeDocumentInput, AuthorOfficeSpreadsheetInput } from "../src/work-artifact/office-document"
import { SkillMarket } from "../src/skill/market"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { scenarioFixturePath } from "../script/runtime-e2e-scenario"
import { assertNativeArchiveClosure } from "../../../script/package-native-binary"
import { resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const aliases = ["COM¹", "com²", "COM³", "LPT¹", "lpt²", "LPT³"]

test.each(aliases)("new Office inputs return the validation error for device alias %s", (name) => {
  expect(() =>
    AuthorOfficeDocumentInput.parse({
      profile: "office.document@1",
      filename: `${name}.docx`,
      paragraphs: [{ kind: "paragraph", text: "Original content" }],
    }),
  ).toThrow(z.ZodError)
  expect(() =>
    AuthorOfficeSpreadsheetInput.parse({
      profile: "office.spreadsheet@1",
      filename: `${name}.xlsx`,
      sheets: [{ name: "Overview", columns: ["Entry"], rows: [["Original content"]] }],
    }),
  ).toThrow(z.ZodError)
})

test.each(aliases)("Windows archive listing returns its path error for device alias %s", (name) => {
  expect(() =>
    assertNativeArchiveClosure({
      archive: "metadata-only.tar.gz",
      listing: `-rw-r--r-- user/group 1 2026-11-09 00:00 ./safe/${name}.txt`,
      platform: "win32",
    }),
  ).toThrow(`Native archive metadata-only.tar.gz contains an unsafe Windows entry path: safe/${name}.txt`)
})

test.each(aliases)("scenario fixture naming returns its portable-path error for device alias %s", (name) => {
  expect(() => scenarioFixturePath(path.resolve("metadata-only"), `notes/${name}.md`)).toThrow(
    "Scenario fixture requires a relative portable file path",
  )
})

test.each(aliases)("upstream Skill bundle parsing returns its named error for device alias %s", async (name) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    Response.json({
      files: [
        { path: "SKILL.md", contents: "# Original root skill\n" },
        { path: `notes/${name}.md`, contents: "Original note\n" },
      ],
    })) as typeof fetch
  try {
    await expect(SkillMarket.download("example/project/safe")).rejects.toMatchObject({
      name: "SkillMarketUpstreamError",
      data: {
        operation: "download",
        endpoint: "https://skills.sh/api/download/example/project/safe",
        message: "Skill Market download returned an invalid response.",
      },
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test.each(aliases)("portable record segments retain their existing explicit ASCII validation for %s", (name) => {
  expect(() => TaskArtifactPortableSegmentSchema.parse(name)).toThrow(z.ZodError)
})

test("ordinary author inputs and runtime identities retain their exact public outputs", () => {
  expect(
    AuthorOfficeDocumentInput.parse({
      profile: "office.document@1",
      filename: "报告-25.docx",
      paragraphs: [{ kind: "paragraph", text: "原始资料" }],
    }),
  ).toEqual({
    profile: "office.document@1",
    filename: "报告-25.docx",
    locale: "en-US",
    paragraphs: [{ kind: "paragraph", text: "原始资料" }],
  })
  expect(TaskArtifactPortableSegmentSchema.parse("artifact-25")).toBe("artifact-25")
  const project = path.resolve("metadata-only")
  expect(ProjectRuntimePaths.missionRoot(project, "mission-25")).toBe(
    path.join(project, ".opencorvus", ".r", "missions", "mission-25"),
  )
  expect(() => ProjectRuntimePaths.missionRoot(project, "COM¹")).toThrow(
    "ProjectRuntimePaths: invalid identity segment COM¹",
  )
})

test("upstream ordinary Unicode note metadata retains its exact path and bytes", async () => {
  const originalFetch = globalThis.fetch
  const files = [
    { path: "SKILL.md", contents: "# Original root skill\n" },
    { path: "notes/资料-25.md", contents: "原始资料\r\n" },
  ]
  globalThis.fetch = (async () => Response.json({ files })) as typeof fetch
  try {
    const result = await SkillMarket.download("example/project/safe")
    expect({ id: result.id, source: result.source, skillID: result.skill_id, files: result.files }).toEqual({
      id: "example/project/safe",
      source: "example/project",
      skillID: "safe",
      files: files.map((file) => ({ path: file.path, content: file.contents })),
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
