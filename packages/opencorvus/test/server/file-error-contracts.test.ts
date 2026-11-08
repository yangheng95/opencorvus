import { afterEach, expect, spyOn, test } from "bun:test"
import Ajv2020 from "ajv/dist/2020.js"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { hostGit } from "../../src/util/git"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

type Document = Awaited<ReturnType<typeof Server.openapi>>

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

function operation(document: Document, id: string) {
  for (const [route, methods] of Object.entries(document.paths ?? {})) {
    for (const [method, value] of Object.entries(methods)) {
      if (value && typeof value === "object" && "operationId" in value && value.operationId === id) {
        return { route, method: method.toUpperCase(), value }
      }
    }
  }
  throw new Error(`Runtime document did not publish operation ${id}`)
}

function conforms(document: Document, id: string, actual: { status: number; body: unknown }) {
  const published = operation(document, id).value
  const schema = published.responses?.[String(actual.status)]?.content?.["application/json"]?.schema
  if (!schema) throw new Error(`${id} did not publish its HTTP ${actual.status} JSON response`)
  const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile({
    ...schema,
    components: document.components,
  })
  expect({ valid: validate(actual.body), errors: validate.errors }).toEqual({ valid: true, errors: null })
}

async function documentFor(directory: string) {
  const actual = await request(directory, "GET", "/doc")
  expect(actual.status).toBe(200)
  return actual.body as Document
}

test.each([
  { kind: "lexical file", operation: "file.read", route: "/file/content", directory: false, lexical: true },
  { kind: "lexical directory", operation: "file.list", route: "/file", directory: true, lexical: true },
  { kind: "file link", operation: "file.read", route: "/file/content", directory: false, lexical: false },
  { kind: "directory link", operation: "file.list", route: "/file", directory: true, lexical: false },
])("project read publishes its existing named path-denial response for $kind", async (entry) => {
  await using project = await memoryProject("read-path-response")
  await using outside = await memoryProject("outside-read-path-response")
  const content = "owned outside original\r\n资料\r\n"
  const original = "owned project original\r\n"
  await fs.mkdir(path.join(outside.path, "folder"))
  await fs.writeFile(path.join(outside.path, "notes.txt"), content)
  await fs.writeFile(path.join(project.path, "notes.txt"), original)
  const physical = path.join(outside.path, entry.directory ? "folder" : "notes.txt")
  const target = entry.lexical
    ? path.relative(project.path, physical)
    : entry.directory ? "outside-folder" : "outside.txt"
  if (!entry.lexical) {
    await fs.symlink(physical, path.join(project.path, target), entry.directory ? process.platform === "win32" ? "junction" : "dir" : "file")
  }
  const document = await documentFor(project.path)
  const actual = await request(project.path, "GET", `${entry.route}?path=${encodeURIComponent(target)}`)
  expect(actual).toEqual({
    status: 400,
    body: { name: "FileInvalidPathError", data: { path: target, message: "Access denied: path escapes project directory" } },
  })
  conforms(document, entry.operation, actual)
  expect(await fs.readFile(path.join(outside.path, "notes.txt"), "utf8")).toBe(content)
  expect(await fs.readFile(path.join(project.path, "notes.txt"), "utf8")).toBe(original)
}, 60_000)

test("project read publishes exact ordinary and in-scope link content under its existing authority", async () => {
  await using project = await memoryProject("read-path-success-response")
  const content = "owned scoped original\r\n资料\r\n"
  await fs.mkdir(path.join(project.path, "folder"))
  await fs.writeFile(path.join(project.path, "folder", "notes.txt"), content)
  await fs.symlink(path.join(project.path, "folder", "notes.txt"), path.join(project.path, "inside.txt"), "file")
  const document = await documentFor(project.path)
  for (const target of ["folder/notes.txt", "inside.txt"]) {
    const actual = await request(project.path, "GET", `/file/content?path=${encodeURIComponent(target)}`)
    expect(actual).toMatchObject({ status: 200, body: { type: "text", content } })
    expect(typeof actual.body.revision).toBe("string")
    conforms(document, "file.read", actual)
  }
  const listing = await request(project.path, "GET", "/file?path=folder")
  expect(listing).toEqual({
    status: 200,
    body: [{ name: "notes.txt", path: path.join("folder", "notes.txt"), absolute: path.join(project.path, "folder", "notes.txt"), type: "file", ignored: false, directoryTarget: false }],
  })
  conforms(document, "file.list", listing)
  expect(await fs.readFile(path.join(project.path, "folder", "notes.txt"), "utf8")).toBe(content)
}, 60_000)

test.each(["missing-dir", "notes.txt", "notes.txt/child"])(
  "directory listing publishes its named missing-entry response for %s",
  async (target) => {
    await using project = await memoryProject("directory-missing-response")
    const content = "original directory input\r\n资料\r\n"
    await fs.writeFile(path.join(project.path, "notes.txt"), content)
    const document = await documentFor(project.path)
    const actual = await request(project.path, "GET", `/file?path=${encodeURIComponent(target)}`)
    expect(actual).toEqual({
      status: 404,
      body: {
        name: "FileNotFoundError",
        data: { path: target, message: `Directory entry not found: ${target}` },
      },
    })
    conforms(document, "file.list", actual)
    expect(await fs.readFile(path.join(project.path, "notes.txt"), "utf8")).toBe(content)
  },
  60_000,
)

test("directory listing publishes exact ordinary and empty directory outputs", async () => {
  await using project = await memoryProject("directory-success-response")
  await fs.mkdir(path.join(project.path, "folder", "empty"), { recursive: true })
  const content = "ordinary directory original\r\n资料\r\n"
  await fs.writeFile(path.join(project.path, "folder", "资料.txt"), content)
  const document = await documentFor(project.path)
  const actual = await request(project.path, "GET", "/file?path=folder")
  expect(actual).toEqual({
    status: 200,
    body: [
      { name: "empty", path: path.join("folder", "empty"), absolute: path.join(project.path, "folder", "empty"), type: "directory", ignored: false, directoryTarget: true },
      { name: "资料.txt", path: path.join("folder", "资料.txt"), absolute: path.join(project.path, "folder", "资料.txt"), type: "file", ignored: false, directoryTarget: false },
    ],
  })
  conforms(document, "file.list", actual)
  const empty = await request(project.path, "GET", "/file?path=folder%2Fempty")
  expect(empty).toEqual({ status: 200, body: [] })
  conforms(document, "file.list", empty)
  expect(await fs.readFile(path.join(project.path, "folder", "资料.txt"), "utf8")).toBe(content)
}, 60_000)

test.each(["EACCES", "EIO"])("directory listing publishes the existing internal-error response for %s", async (code) => {
  await using project = await memoryProject("directory-io-response")
  const target = path.join(project.path, "io-probe")
  await fs.mkdir(target)
  const document = await documentFor(project.path)
  const original = fs.readdir
  let observed = 0
  const probe = spyOn(fs, "readdir").mockImplementation(((input: unknown, ...args: unknown[]) => {
    if (path.resolve(String(input)) === target) {
      observed += 1
      return Promise.reject(Object.assign(new Error(`Directory read probe: ${code}`), { code }))
    }
    return Reflect.apply(original, fs, [input, ...args])
  }) as typeof fs.readdir)
  try {
    const actual = await request(project.path, "GET", "/file?path=io-probe")
    expect(actual).toEqual({
      status: 500,
      body: { name: "UnknownError", data: { message: "Internal server error. See x-opencorvus-request-id for diagnostics." } },
    })
    expect(observed).toBe(1)
    conforms(document, "file.list", actual)
  } finally {
    probe.mockRestore()
  }
}, 60_000)

test("real file mutation errors satisfy each published operation response", async () => {
  await using project = await memoryProject("file-error-responses")
  await fs.writeFile(path.join(project.path, "notes.txt"), "original note\r\n资料\r\n")
  await fs.writeFile(path.join(project.path, "source.txt"), "source bytes\n")
  await fs.writeFile(path.join(project.path, "revision.txt"), "loaded revision\n")
  const document = await documentFor(project.path)
  const loaded = await request(project.path, "GET", "/file/content?path=revision.txt")
  expect(loaded).toMatchObject({ status: 200, body: { type: "text", content: "loaded revision\n" } })
  const revision = loaded.body.revision
  expect(revision).toEqual(expect.any(String))
  await fs.writeFile(path.join(project.path, "revision.txt"), "current revision\n")
  const cases = [
    {
      id: "file.create",
      body: { path: "notes.txt", type: "file" },
      status: 409,
      name: "FileConflictError",
      data: { path: "notes.txt" },
    },
    {
      id: "file.create",
      body: { path: "../outside.txt", type: "file" },
      status: 400,
      name: "FileInvalidPathError",
      data: { path: "../outside.txt" },
    },
    {
      id: "file.create",
      body: { path: "missing-parent/child.txt", type: "file" },
      status: 400,
      name: "FileInvalidPathError",
      data: { path: "missing-parent/child.txt" },
    },
    {
      id: "file.copy",
      body: { path: "source.txt", newPath: "notes.txt" },
      status: 409,
      name: "FileConflictError",
      data: { path: "notes.txt" },
    },
    {
      id: "file.copy",
      body: { path: "source.txt", newPath: "../outside.txt" },
      status: 400,
      name: "FileInvalidPathError",
    },
    {
      id: "file.copy",
      body: { path: "missing.txt", newPath: "copied.txt" },
      status: 404,
      name: "FileNotFoundError",
      data: { path: "missing.txt" },
    },
    {
      id: "file.move",
      body: { path: "source.txt", newPath: "notes.txt" },
      status: 409,
      name: "FileConflictError",
      data: { path: "notes.txt" },
    },
    {
      id: "file.move",
      body: { path: "source.txt", newPath: "../outside.txt" },
      status: 400,
      name: "FileInvalidPathError",
    },
    {
      id: "file.move",
      body: { path: "missing.txt", newPath: "moved.txt" },
      status: 404,
      name: "FileNotFoundError",
      data: { path: "missing.txt" },
    },
    { id: "file.delete", query: "path=.", status: 400, name: "FileInvalidPathError" },
    {
      id: "file.delete",
      query: "path=missing.txt",
      status: 404,
      name: "FileNotFoundError",
      data: { path: "missing.txt" },
    },
    {
      id: "file.write",
      body: { path: "revision.txt", content: "draft\n", expectedRevision: revision },
      status: 409,
      name: "FileWriteConflictError",
      data: { path: "revision.txt" },
    },
    {
      id: "file.write",
      body: { path: "missing.txt", content: "draft\n", expectedRevision: revision },
      status: 404,
      name: "FileNotFoundError",
      data: { path: "missing.txt" },
    },
    {
      id: "file.write",
      body: { path: "../outside.txt", content: "draft\n", expectedRevision: revision },
      status: 400,
      name: "FileInvalidPathError",
    },
    {
      id: "file.upload",
      body: { targetDir: "missing-upload-target", files: [{ name: "upload.bin", contentBase64: "YQ==" }] },
      status: 400,
      name: "FileUploadInvalidTargetError",
      data: { targetDir: "missing-upload-target" },
    },
    {
      id: "file.upload",
      body: { targetDir: "", files: [{ name: "../upload.bin", contentBase64: "YQ==" }] },
      status: 400,
      name: "FileUploadInvalidNameError",
      data: { name: "../upload.bin" },
    },
    {
      id: "file.upload",
      body: { targetDir: "", files: [{ name: "invalid.bin", contentBase64: "%%%" }] },
      status: 400,
      name: "FileUploadInvalidContentError",
      data: { name: "invalid.bin" },
    },
    {
      id: "file.upload",
      body: { targetDir: "", files: [{ name: "notes.txt", contentBase64: "YQ==" }] },
      status: 409,
      name: "FileUploadConflictError",
      data: { path: "notes.txt" },
    },
  ]
  for (const entry of cases) {
    const published = operation(document, entry.id)
    const route = "query" in entry ? `${published.route}?${entry.query}` : published.route
    const actual = await request(project.path, published.method, route, "body" in entry ? entry.body : undefined)
    expect(actual).toMatchObject({
      status: entry.status,
      body: { name: entry.name, ...(entry.data ? { data: entry.data } : {}) },
    })
    conforms(document, entry.id, actual)
  }
  expect(await fs.readFile(path.join(project.path, "notes.txt"), "utf8")).toBe("original note\r\n资料\r\n")
  expect(await fs.readFile(path.join(project.path, "source.txt"), "utf8")).toBe("source bytes\n")
  expect(await fs.readFile(path.join(project.path, "revision.txt"), "utf8")).toBe("current revision\n")
}, 120_000)

test("file validators publish their actual structured bad-request responses", async () => {
  await using project = await memoryProject("file-validator-responses")
  const document = await documentFor(project.path)
  for (const id of [
    "find.text",
    "find.files",
    "file.list",
    "file.read",
    "file.download",
    "file.readSource",
    "file.write",
    "file.create",
    "file.copy",
    "file.move",
    "file.delete",
    "file.upload",
  ]) {
    const published = operation(document, id)
    const actual = await request(
      project.path,
      published.method,
      published.route,
      published.method === "GET" || published.method === "DELETE" ? undefined : {},
    )
    expect(actual).toMatchObject({ status: 400, body: { success: false } })
    expect(typeof actual.body.data.message).toBe("string")
    expect(Array.isArray(actual.body.error)).toBe(true)
    expect(actual.body.error.length).toBeGreaterThan(0)
    conforms(document, id, actual)
  }
}, 120_000)

test("file status publishes its real indexed linked-ancestor error", async () => {
  await using project = await memoryProject("file-status-error-response")
  const document = await documentFor(project.path)
  const tracked = path.join(project.path, "tracked")
  const target = path.join(project.path, "target")
  await fs.mkdir(tracked)
  await fs.mkdir(target)
  await fs.writeFile(path.join(tracked, "child.txt"), "indexed source\n")
  const staged = await hostGit(["add", "--", "tracked/child.txt"], { cwd: project.path })
  expect(staged.exitCode).toBe(0)
  await fs.rm(tracked, { recursive: true })
  await fs.symlink(target, tracked, process.platform === "win32" ? "junction" : "dir")
  const actual = await request(project.path, "GET", "/file/status")
  expect(actual).toMatchObject({
    status: 500,
    body: {
      name: "GitSourceEnumerationError",
      data: { reason: "linked_ancestor", path: "tracked/child.txt" },
    },
  })
  expect(typeof actual.body.data.message).toBe("string")
  conforms(document, "file.status", actual)
}, 60_000)

test("file success schemas retain exact create, copy, move, delete and upload results", async () => {
  await using project = await memoryProject("file-success-responses")
  const document = await documentFor(project.path)
  const content = "created body — 资料\r\n"
  const created = await request(project.path, "POST", "/file/item", { path: "created.txt", type: "file", content })
  expect(created).toMatchObject({ status: 200, body: { path: "created.txt", name: "created.txt", type: "file" } })
  conforms(document, "file.create", created)
  const read = await request(project.path, "GET", "/file/content?path=created.txt")
  expect(read).toMatchObject({ status: 200, body: { type: "text", content } })
  conforms(document, "file.read", read)
  const copied = await request(project.path, "POST", "/file/item/copy", { path: "created.txt", newPath: "copied.txt" })
  expect(copied).toMatchObject({ status: 200, body: { path: "copied.txt" } })
  conforms(document, "file.copy", copied)
  const moved = await request(project.path, "PATCH", "/file/item", { path: "copied.txt", newPath: "moved.txt" })
  expect(moved).toMatchObject({ status: 200, body: { path: "moved.txt" } })
  conforms(document, "file.move", moved)
  expect(await fs.readFile(path.join(project.path, "moved.txt"), "utf8")).toBe(content)
  const deleted = await request(project.path, "DELETE", "/file/item?path=moved.txt")
  expect(deleted).toEqual({ status: 200, body: { path: "moved.txt" } })
  conforms(document, "file.delete", deleted)
  const bytes = Buffer.from([0, 255, 1, 128, 13, 10])
  const uploaded = await request(project.path, "POST", "/file/upload", {
    targetDir: "",
    files: [{ name: "uploaded.bin", contentBase64: bytes.toString("base64") }],
  })
  expect(uploaded).toEqual({ status: 200, body: [{ name: "uploaded.bin", path: "uploaded.bin", bytes: 6 }] })
  conforms(document, "file.upload", uploaded)
  expect(await fs.readFile(path.join(project.path, "created.txt"), "utf8")).toBe(content)
  expect(await fs.readFile(path.join(project.path, "uploaded.bin"))).toEqual(bytes)
}, 120_000)
