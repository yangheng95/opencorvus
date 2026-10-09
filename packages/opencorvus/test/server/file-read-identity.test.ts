import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "../../src/config/paths"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function configure(directory: string, content: string) {
  await fs.writeFile(path.join(directory, "README.md"), content)
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "missing-file-reader/model", small_model: "missing-file-reader/model" }))
}

async function read(directory: string, route: string) {
  await Instance.disposeAll()
  const response = await runOutsideInstanceContext(() =>
    Server.App().request(route, { headers: { "x-opencorvus-directory": directory } }),
  )
  return { status: response.status, body: await response.json() }
}

test("cold file readers use exact Project file facts with unavailable execution models", async () => {
  await using first = await memoryProject("file-reader-first")
  await using second = await memoryProject("file-reader-second")
  const firstContent = "FileReaderMarker-FIRST\n"
  const secondContent = "FileReaderMarker-SECOND\n"
  await configure(first.path, firstContent)
  await configure(second.path, secondContent)

  for (const [directory, content] of [[first.path, firstContent], [second.path, secondContent]]) {
    const relative = await read(directory!, "/file/content?path=README.md")
    expect(relative).toMatchObject({ status: 200, body: { type: "text", content, revision: expect.any(String) } })
    const absolute = await read(directory!, `/file/source-content?${new URLSearchParams({ path: path.join(directory!, "README.md") })}`)
    expect(absolute).toMatchObject({ status: 200, body: { type: "text", content } })
    const listing = await read(directory!, "/file?path=")
    expect(listing).toMatchObject({ status: 200, body: expect.arrayContaining([
      { name: "README.md", path: "README.md", absolute: path.join(directory!, "README.md"), type: "file", ignored: false },
    ]) })
    const files = await read(directory!, "/find/file?query=README&dirs=false&type=file")
    expect(files).toEqual({ status: 200, body: ["README.md"] })
    const matches = await read(directory!, `/find?${new URLSearchParams({ pattern: content!.trim() })}`)
    expect(matches).toMatchObject({ status: 200, body: expect.arrayContaining([
      expect.objectContaining({ path: { text: "README.md" }, lines: { text: content }, line_number: 1 }),
    ]) })
    const status = await read(directory!, "/file/status")
    expect(status).toMatchObject({ status: 200, body: expect.arrayContaining([
      { path: "README.md", added: 2, removed: 0, status: "added" },
    ]) })
  }
}, 30_000)

test("source readers retain explicit path and missing-file error contracts", async () => {
  await using project = await memoryProject("file-reader-errors")
  await configure(project.path, "FileReaderMarker\n")
  expect(await read(project.path, "/file/source-content?path=README.md")).toMatchObject({
    status: 400,
    body: { name: "FileInvalidPathError", data: { path: "README.md", message: "Source file path must be absolute: README.md" } },
  })
  const missing = path.join(project.path, "missing.md")
  expect(await read(project.path, `/file/source-content?${new URLSearchParams({ path: missing })}`)).toMatchObject({
    status: 404,
    body: { name: "FileNotFoundError", data: { path: missing } },
  })
}, 30_000)

test("file writes retain the execution model error contract", async () => {
  await using project = await memoryProject("file-reader-write-runtime")
  await configure(project.path, "FileReaderMarker\n")
  const loaded = await read(project.path, "/file/content?path=README.md")
  const response = await runOutsideInstanceContext(() => Server.App().request("/file/content", {
    method: "PATCH",
    headers: { "x-opencorvus-directory": project.path, "content-type": "application/json" },
    body: JSON.stringify({ path: "README.md", content: "New content\n", expectedRevision: loaded.body.revision }),
  }))
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 400,
    body: { name: "ProviderModelNotFoundError", data: { providerID: "missing-file-reader", modelID: "model" } },
  })
}, 30_000)
