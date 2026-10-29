import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { ConfigPaths } from "../../src/config/paths"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { Plugin } from "../../src/plugin"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function configure(directory: string, config: Record<string, unknown> = {}) {
  const target = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(
    target,
    JSON.stringify({
      model: "missing-file-writer/model",
      small_model: "missing-file-writer/model",
      ...config,
    }),
  )
}

async function request(directory: string, method: string, route: string, body?: unknown) {
  const response = await runOutsideInstanceContext(() =>
    Server.App().request(route, {
      method,
      headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}

async function read(directory: string, filename: string) {
  return request(directory, "GET", `/file/content?${new URLSearchParams({ path: filename })}`)
}

test.skipIf(process.platform !== "win32").each(["file", "directory", "junction"] as const)(
  "case-only %s rename returns the current entry name and retains its physical identity",
  async (kind) => {
    await using project = await memoryProject(`file-case-${kind}`)
    await configure(project.path)
    const original = kind === "file" ? "note.txt" : kind === "directory" ? "folder" : "linked"
    const renamed = kind === "file" ? "Note.txt" : kind === "directory" ? "Folder" : "Linked"
    const marker = `Exact ${kind} bytes — 资料\r\n`
    if (kind === "file") await fs.writeFile(path.join(project.path, original), marker)
    else {
      const directory = kind === "junction" ? "target" : original
      await fs.mkdir(path.join(project.path, directory))
      await fs.writeFile(path.join(project.path, directory, "note.txt"), marker)
      if (kind === "junction")
        await fs.symlink(path.join(project.path, directory), path.join(project.path, original), "junction")
    }
    const before = await fs.lstat(path.join(project.path, original), { bigint: true })
    const identity = (stat: typeof before) => [stat.dev, stat.ino, stat.birthtimeNs, stat.mode & 0o170000n]
    for (const [from, to] of [[original, renamed], [renamed, original]] as const) {
      expect(await request(project.path, "PATCH", "/file/item", { path: from, newPath: to })).toMatchObject({
        status: 200,
        body: { previousPath: from, path: to, node: { name: to, path: to } },
      })
      expect(await fs.readdir(project.path)).toContain(to)
      expect(identity(await fs.lstat(path.join(project.path, to), { bigint: true }))).toEqual(identity(before))
      const file = kind === "file" ? to : `${to}/note.txt`
      expect(await read(project.path, file)).toMatchObject({ status: 200, body: { content: marker } })
      expect(await fs.readFile(path.join(project.path, file), "utf8")).toBe(marker)
    }
  },
  60_000,
)

test.each(["distinct", "hardlink", "same-name"] as const)(
  "%s rename destination returns the exact entry conflict and retained contents",
  async (kind) => {
    await using project = await memoryProject(`file-rename-conflict-${kind}`)
    await configure(project.path)
    await fs.writeFile(path.join(project.path, "source.txt"), "source bytes\n")
    const target = kind === "same-name" ? "source.txt" : "destination.txt"
    if (kind === "hardlink") await fs.link(path.join(project.path, "source.txt"), path.join(project.path, target))
    if (kind === "distinct") await fs.writeFile(path.join(project.path, target), "destination bytes\n")
    expect(await request(project.path, "PATCH", "/file/item", { path: "source.txt", newPath: target })).toEqual({
      status: 409,
      body: { name: "FileConflictError", data: { path: target, message: `File destination already exists: ${target}` } },
    })
    expect(await fs.readFile(path.join(project.path, "source.txt"), "utf8")).toBe("source bytes\n")
    expect(await fs.readFile(path.join(project.path, target), "utf8")).toBe(
      kind === "distinct" ? "destination bytes\n" : "source bytes\n",
    )
  },
  60_000,
)

test("cold file mutation routes commit exact Project-local bytes with unavailable execution models", async () => {
  await using first = await memoryProject("file-writer-first")
  await using second = await memoryProject("file-writer-second")
  for (const [index, project] of [first, second].entries()) {
    await configure(project.path)
    const original = `Project ${index} original\r\n`,
      changed = `Project ${index} changed\r\n`
    await fs.writeFile(path.join(project.path, "edit.txt"), original)
    await Instance.disposeAll()
    const loaded = await read(project.path, "edit.txt")
    expect(structuredClone(loaded)).toMatchObject({
      status: 200,
      body: { content: original, revision: expect.any(String) },
    })
    const saved = await request(project.path, "PATCH", "/file/content", {
      path: "edit.txt",
      content: changed,
      expectedRevision: loaded.body.revision,
    })
    expect(structuredClone(saved)).toMatchObject({
      status: 200,
      body: { content: changed, revision: expect.any(String) },
    })
    expect(await fs.readFile(path.join(project.path, "edit.txt"), "utf8")).toBe(changed)

    const created = await request(project.path, "POST", "/file/item", {
      path: "created.txt",
      type: "file",
      content: changed,
    })
    expect(created).toMatchObject({ status: 200, body: { name: "created.txt", path: "created.txt", type: "file" } })
    const directory = await request(project.path, "POST", "/file/item", { path: "destination", type: "directory" })
    expect(directory).toMatchObject({ status: 200, body: { path: "destination", type: "directory" } })
    const bytes = Buffer.from([index, 0, 127, 128, 255])
    const uploaded = await request(project.path, "POST", "/file/upload", {
      targetDir: "destination",
      files: [{ name: "原件.bin", contentBase64: bytes.toString("base64") }],
    })
    expect(uploaded).toEqual({
      status: 200,
      body: [{ name: "原件.bin", path: path.join("destination", "原件.bin"), bytes: bytes.length }],
    })
    expect(await fs.readFile(path.join(project.path, "destination/原件.bin"))).toEqual(bytes)
    const copied = await request(project.path, "POST", "/file/item/copy", {
      path: "created.txt",
      newPath: "destination/copied.txt",
    })
    expect(copied).toMatchObject({
      status: 200,
      body: { sourcePath: "created.txt", path: "destination/copied.txt", node: { type: "file" } },
    })
    expect(await fs.readFile(path.join(project.path, "destination/copied.txt"), "utf8")).toBe(changed)
    const moved = await request(project.path, "PATCH", "/file/item", {
      path: "created.txt",
      newPath: "destination/moved.txt",
    })
    expect(moved).toMatchObject({
      status: 200,
      body: { previousPath: "created.txt", path: "destination/moved.txt", node: { type: "file" } },
    })
    expect(await fs.readFile(path.join(project.path, "destination/moved.txt"), "utf8")).toBe(changed)
    const removed = await request(project.path, "DELETE", "/file/item?path=destination%2Fmoved.txt")
    expect(removed).toEqual({ status: 200, body: { path: "destination/moved.txt" } })
    expect(await read(project.path, "destination/moved.txt")).toMatchObject({
      status: 404,
      body: { name: "FileNotFoundError" },
    })
    expect((await fs.readdir(path.join(project.path, "destination"))).sort()).toEqual(["copied.txt", "原件.bin"])
  }
  expect(await fs.readFile(path.join(first.path, "edit.txt"), "utf8")).toBe("Project 0 changed\r\n")
}, 60_000)

test("model-independent mutations retain path, overwrite and loaded-revision errors", async () => {
  await using project = await memoryProject("file-writer-errors")
  await configure(project.path)
  await fs.writeFile(path.join(project.path, "edit.txt"), "original\n")
  const loaded = await read(project.path, "edit.txt")
  await fs.writeFile(path.join(project.path, "edit.txt"), "external\n")
  expect(
    await request(project.path, "PATCH", "/file/content", {
      path: "edit.txt",
      content: "draft\n",
      expectedRevision: loaded.body.revision,
    }),
  ).toMatchObject({ status: 409, body: { name: "FileWriteConflictError", data: { path: "edit.txt" } } })
  expect(await fs.readFile(path.join(project.path, "edit.txt"), "utf8")).toBe("external\n")
  expect(await request(project.path, "POST", "/file/item", { path: "../outside.txt", type: "file" })).toMatchObject({
    status: 400,
    body: { name: "FileInvalidPathError" },
  })
  expect(await request(project.path, "POST", "/file/item", { path: "edit.txt", type: "file" })).toMatchObject({
    status: 409,
    body: { name: "FileConflictError" },
  })
  expect(await request(project.path, "DELETE", "/file/item?path=")).toMatchObject({
    status: 400,
    body: { name: "FileInvalidPathError" },
  })
}, 30_000)

test("cold saves return actual native formatter bytes and the next usable revision", async () => {
  await using project = await memoryProject("file-writer-format")
  const node = Bun.which("node")
  if (!node) throw new Error("The formatter contract requires the installed Node.js runtime")
  const prettier = path.resolve(import.meta.dir, "../../../../node_modules/prettier/bin/prettier.cjs")
  await configure(project.path, {
    formatter: { prettier: { command: [node, prettier, "--write", "$FILE"], extensions: [".js"] } },
  })
  await fs.writeFile(path.join(project.path, ".prettierrc.json"), JSON.stringify({ semi: false }))
  await fs.writeFile(path.join(project.path, "editor.js"), "const seed = 0\n")
  const loaded = await read(project.path, "editor.js")
  const first = await request(project.path, "PATCH", "/file/content", {
    path: "editor.js",
    content: "const value={a:1}\n",
    expectedRevision: loaded.body.revision,
  })
  expect(structuredClone(first)).toMatchObject({
    status: 200,
    body: { content: "const value = { a: 1 }\n", revision: expect.any(String) },
  })
  expect(await fs.readFile(path.join(project.path, "editor.js"), "utf8")).toBe(first.body.content)
  const next = await request(project.path, "PATCH", "/file/content", {
    path: "editor.js",
    content: "const next={b:2}\n",
    expectedRevision: first.body.revision,
  })
  expect(structuredClone(next)).toMatchObject({
    status: 200,
    body: { content: "const next = { b: 2 }\n", revision: expect.any(String) },
  })
  expect(await read(project.path, "editor.js")).toEqual(next)
}, 30_000)

test("concurrent saves settle one original revision and its explicit conflict", async () => {
  await using project = await memoryProject("file-writer-concurrent")
  await configure(project.path)
  await fs.writeFile(path.join(project.path, "shared.txt"), "original\n")
  const loaded = await read(project.path, "shared.txt")
  const results = await Promise.all(
    ["first\n", "second\n"].map((content) =>
      request(project.path, "PATCH", "/file/content", {
        path: "shared.txt",
        content,
        expectedRevision: loaded.body.revision,
      }),
    ),
  )
  expect(results.map((result) => result.status).sort()).toEqual([200, 409])
  const committed = results.find((result) => result.status === 200)!
  const conflict = results.find((result) => result.status === 409)!
  expect(conflict.body).toMatchObject({ name: "FileWriteConflictError", data: { path: "shared.txt" } })
  expect(await fs.readFile(path.join(project.path, "shared.txt"), "utf8")).toBe(committed.body.content)
  expect(await read(project.path, "shared.txt")).toEqual(committed)
}, 30_000)

test("cold and initialized runtime writes share one configured plugin event lifecycle", async () => {
  await using project = await memoryProject("file-writer-plugin")
  const plugin = path.join(project.path, "file-events.mjs")
  await fs.writeFile(
    plugin,
    `import fs from "node:fs/promises"\nimport path from "node:path"\nexport default async ({directory}) => ({
    config: async () => fs.appendFile(path.join(directory,"config-events.txt"),"configured\\n"),
    event: async ({event}) => { if (event.type === "file.edited") await fs.appendFile(path.join(directory,"file-events.txt"),event.properties.file+"\\n") }
  })\n`,
  )
  const config = ConfigPaths.projectFile(project.path)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(config, JSON.stringify({ plugin: [pathToFileURL(plugin).href] }))
  await fs.writeFile(path.join(project.path, "edited.txt"), "seed\n")
  const loaded = await read(project.path, "edited.txt")
  expect(
    await request(project.path, "PATCH", "/file/content", {
      path: "edited.txt",
      content: "cold\n",
      expectedRevision: loaded.body.revision,
    }),
  ).toMatchObject({ status: 200, body: { content: "cold\n" } })
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: () => Promise.all([Plugin.init(), Plugin.init()]),
  })
  await Instance.provide({ directory: project.path, init: InstanceBootstrap, fn: async () => undefined })
  expect(
    await request(project.path, "POST", "/file/item", { path: "created.txt", type: "file", content: "warm\n" }),
  ).toMatchObject({ status: 200, body: { path: "created.txt" } })
  expect(await fs.readFile(path.join(project.path, "config-events.txt"), "utf8")).toBe("configured\n")
  expect(await fs.readFile(path.join(project.path, "file-events.txt"), "utf8")).toBe("edited.txt\ncreated.txt\n")
}, 30_000)
