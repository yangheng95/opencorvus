import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

let temporaryDirectory = ""
let sourcePath = ""

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-source-content-"))
  sourcePath = path.join(temporaryDirectory, "cited-source.ts")
  await writeFile(sourcePath, "export const cited = 42\n", "utf8")
})

afterAll(async () => {
  await resetMemoryDatabase()
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test("reads the exact absolute file represented by a source citation", async () => {
  await using project = await memoryProject("source-content")
  await Instance.provide({ directory: project.path, fn: async () => {
    expect(await File.readSource(sourcePath)).toEqual({
      type: "text",
      content: "export const cited = 42\n",
    })
  } })
})
