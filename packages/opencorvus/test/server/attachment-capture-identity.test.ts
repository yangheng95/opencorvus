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

async function configure(directory: string) {
  const config = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ model: "offline-attachment-provider/model" }))
}

async function request(directory: string, route: string, init?: RequestInit) {
  await Instance.disposeAll()
  const headers = new Headers(init?.headers)
  headers.set("x-opencorvus-directory", directory)
  return await runOutsideInstanceContext(() =>
    Server.App().request(route, {
      ...init,
      headers,
    }),
  )
}

test("cold attachment capture returns each project's exact bytes and original filename", async () => {
  await using first = await memoryProject("attachment-capture-first")
  await using second = await memoryProject("attachment-capture-second")
  const filename = "验收说明（原件）.txt"
  for (const [directory, content] of [
    [first.path, "first original\r\n"],
    [second.path, "second original\n"],
  ] as const) {
    await configure(directory)
    const bytes = Buffer.from(content)
    const upload = () =>
      request(directory, `/attachment?${new URLSearchParams({ filename })}`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: bytes,
      })
    const response = await upload()
    expect(response.status).toBe(200)
    const reference = await response.json()
    expect(reference).toMatchObject({ filename, mime: "text/plain", size: bytes.byteLength })
    const original = await request(directory, reference.url)
    expect(original.status).toBe(200)
    expect(Buffer.from(await original.arrayBuffer())).toEqual(bytes)
    const repeated = await upload()
    expect(repeated.status).toBe(200)
    expect(await repeated.json()).toEqual(reference)
  }
}, 30_000)

test("cold directory capture returns the canonical local-directory manifest", async () => {
  await using project = await memoryProject("directory-capture-identity")
  await configure(project.path)
  const directory = path.join(project.path, "选择目录（原件）")
  await fs.mkdir(directory)
  const canonical = await fs.realpath(directory)
  const response = await request(project.path, "/attachment/directory-reference", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: directory }),
  })
  expect(response.status).toBe(200)
  const reference = await response.json()
  expect(reference).toMatchObject({ kind: "folder", path: canonical, filename: path.basename(canonical) })
  const manifest = await request(project.path, reference.url)
  expect(manifest.status).toBe(200)
  expect(await manifest.json()).toEqual({ version: 1, kind: "directory", path: canonical })
})

test("executable conversation creation retains its explicit unavailable-model error", async () => {
  await using project = await memoryProject("attachment-execution-admission")
  await configure(project.path)
  const response = await request(project.path, "/coding/chat/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({
    name: "ProviderModelNotFoundError",
    data: { providerID: "offline-attachment-provider", modelID: "model" },
  })
})
