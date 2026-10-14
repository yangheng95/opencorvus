import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { Bus } from "../src/bus"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { FileRoutes } from "../src/server/routes/file"
import { serverErrorResponse } from "../src/server/error-handler"
import { hostGit } from "../src/util/git"
import { readFileEntry } from "../src/util/file-entry"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)
const marker = "LINK CONTRACT original 资料\r\n"
const replacement = "LINK CONTRACT retarget 新目标\r\n"
type Action = "move" | "copy" | "delete"
type LinkKind = "file" | "dir" | "junction"

async function project(seed: string) {
  const fixture = await memoryProject(seed)
  const owner = await fs.realpath(process.env.OPENCORVUS_TEST_PROCESS_ROOT!)
  const relative = path.relative(owner, fixture.path)
  if (path.isAbsolute(relative) || !relative.startsWith(`fixtures${path.sep}memory-`))
    throw new Error("Link contracts require a new managed project fixture")
  expect(await fs.readFile(path.join(fixture.path, ".opencorvus-test-project-identity"), "utf8")).toBe(seed)
  await fs.writeFile(path.join(fixture.path, "root-marker.md"), marker)
  return fixture
}

async function identity(full: string) {
  const entry = await fs.lstat(full, { bigint: true })
  return {
    directory: entry.isDirectory(),
    file: entry.isFile(),
    link: entry.isSymbolicLink(),
    device: String(entry.dev),
    inode: String(entry.ino),
  }
}

async function linkIdentity(full: string) {
  const result = { entry: await identity(full), text: await fs.readlink(full) }
  console.log("[link entry identity]", JSON.stringify({ path: full, ...result }))
  return result
}

async function exactBytes(full: string, text = marker) {
  const actual = await fs.readFile(full)
  console.log(
    "[link target bytes]",
    JSON.stringify({ path: full, bytes: actual.length, content: actual.toString("utf8") }),
  )
  expect(actual).toEqual(Buffer.from(text, "utf8"))
}

async function link(text: string, full: string, kind: LinkKind) {
  await fs.symlink(text, full, kind === "junction" && process.platform !== "win32" ? "dir" : kind)
}

function node(directory: string, full: string, ignored = false, type = "file") {
  return { name: path.basename(full), path: path.relative(directory, full), absolute: full, type, ignored }
}

async function api(directory: string) {
  const edited: { file: string; processAuthority: unknown }[] = []
  const editWaiters = new Set<() => void>()
  const { scope, unsubscribe } = await Instance.provide({
    directory,
    fn: () => ({
      scope: { directory: Instance.directory, worktree: Instance.worktree, projectID: Instance.project.id },
      unsubscribe: Bus.subscribe(File.Event.Edited, ({ properties }) => {
        edited.push(properties)
        for (const notify of editWaiters) notify()
      }),
    }),
  })
  const app = new Hono().onError(serverErrorResponse).route("/", FileRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => Instance.provide({ directory, fn: () => app.fetch(request) }),
  })
  const request = async (method: string, route: string, input?: unknown) => {
    const response = await fetch(new URL(route, server.url), {
      method,
      ...(input === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
      signal: AbortSignal.timeout(20_000),
    })
    const result = { status: response.status, body: await response.json() }
    console.log(
      "[link entry HTTP]",
      JSON.stringify({
        scope,
        method,
        route,
        input,
        requestID: response.headers.get("x-opencorvus-request-id"),
        result,
      }),
    )
    return result
  }
  return {
    scope,
    waitForEdits(files: string[]): Promise<typeof edited> {
      return new Promise((resolve, reject) => {
        const notify = () => {
          if (!files.every((file) => edited.some((event) => event.file === file))) return
          clearTimeout(timer)
          editWaiters.delete(notify)
          resolve(edited)
        }
        const timer = setTimeout(() => {
          editWaiters.delete(notify)
          reject(new Error(`Timed out observing committed file events: ${files.join(", ")}`))
        }, 20_000)
        editWaiters.add(notify)
        notify()
      })
    },
    request,
    mutate(action: Action, source: string, target = "result") {
      if (action === "delete") return request("DELETE", `/file/item?${new URLSearchParams({ path: source })}`)
      return request(action === "copy" ? "POST" : "PATCH", action === "copy" ? "/file/item/copy" : "/file/item", {
        path: source,
        newPath: target,
      })
    },
    list(file = "") {
      return request("GET", `/file?${new URLSearchParams({ path: file })}`)
    },
    content(file: string) {
      return request("GET", `/file/content?${new URLSearchParams({ path: file })}`)
    },
    async [Symbol.asyncDispose]() {
      await server.stop(true)
      unsubscribe()
    },
  }
}

function published(
  result: { status: number; body: any },
  action: "move" | "copy",
  source: string,
  target: string,
  item: ReturnType<typeof node>,
) {
  expect(result).toEqual({
    status: 200,
    body: { ...(action === "copy" ? { sourcePath: source } : { previousPath: source }), path: target, node: item },
  })
}

function missing(result: { status: number; body: any }, file: string) {
  expect(result).toMatchObject({ status: 404, body: { name: "FileNotFoundError", data: { path: file } } })
}

function invalid(result: { status: number; body: any }, file: string) {
  expect(result).toMatchObject({ status: 400, body: { name: "FileInvalidPathError", data: { path: file } } })
}

async function textContent(http: Awaited<ReturnType<typeof api>>, file: string, text = marker) {
  expect(await http.content(file)).toMatchObject({
    status: 200,
    body: { type: "text", content: text, revision: expect.any(String) },
  })
}

test.each(["file", "dir", "junction"] as const)(
  "absolute %s links retain one entry contract through copy, move, listing and notifications",
  async (kind) => {
    await using fixture = await project(`link-absolute-${kind}`)
    const target = path.join(fixture.path, kind === "file" ? "target.md" : "target-dir")
    if (kind !== "file") await fs.mkdir(target)
    const contentPath = kind === "file" ? target : path.join(target, "marker.md")
    await fs.writeFile(contentPath, marker)
    await fs.writeFile(path.join(fixture.path, ".gitignore"), "/moved/\n/copied/\n")
    await link(target, path.join(fixture.path, "source"), kind)
    const original = await linkIdentity(path.join(fixture.path, "source"))
    const targetIdentity = await identity(target)
    await using http = await api(fixture.path)
    published(
      await http.mutate("copy", "source", "copied"),
      "copy",
      "source",
      "copied",
      node(fixture.path, path.join(fixture.path, "copied")),
    )
    expect(await linkIdentity(path.join(fixture.path, "source"))).toEqual(original)
    expect(await fs.readlink(path.join(fixture.path, "copied"))).toBe(original.text)
    expect(await identity(path.join(fixture.path, "copied"))).toMatchObject({
      link: true,
      directory: false,
      file: false,
    })
    published(
      await http.mutate("move", "source", "moved"),
      "move",
      "source",
      "moved",
      node(fixture.path, path.join(fixture.path, "moved")),
    )
    expect(await linkIdentity(path.join(fixture.path, "moved"))).toEqual(original)
    expect(await http.list()).toMatchObject({
      status: 200,
      body: expect.arrayContaining([
        node(fixture.path, path.join(fixture.path, "copied")),
        node(fixture.path, path.join(fixture.path, "moved")),
      ]),
    })
    for (const name of ["copied", "moved"]) {
      if (kind !== "file")
        expect(await http.list(name)).toMatchObject({
          status: 200,
          body: expect.arrayContaining([node(fixture.path, path.join(fixture.path, name, "marker.md"), true)]),
        })
      await textContent(http, kind === "file" ? name : `${name}/marker.md`)
    }
    expect(await identity(target)).toEqual(targetIdentity)
    await exactBytes(contentPath)
    missing(await http.mutate("move", "source", "retry"), "source")
    expect(await http.waitForEdits(["source", "copied", "moved"])).toEqual(
      expect.arrayContaining(
        ["source", "copied", "moved"].map((file) => ({ file, processAuthority: { kind: "host", cwd: fixture.path } })),
      ),
    )
  },
  60_000,
)

test.each(["file", "dir"] as const)(
  "relative %s moves publish their actual entry when the new target is missing",
  async (kind) => {
    await using fixture = await project(`link-relative-missing-${kind}`)
    await fs.mkdir(path.join(fixture.path, "source"))
    const targetName = kind === "file" ? "target.md" : "target-dir"
    const target = path.join(fixture.path, "source", targetName)
    if (kind === "dir") await fs.mkdir(target)
    const originalContent = kind === "file" ? target : path.join(target, "marker.md")
    await fs.writeFile(originalContent, marker)
    await link(targetName, path.join(fixture.path, "source", "link"), kind)
    const original = await linkIdentity(path.join(fixture.path, "source", "link"))
    await using http = await api(fixture.path)
    await textContent(http, kind === "file" ? "source/link" : "source/link/marker.md")
    const source = "./source/link"
    const destination = "missing/../moved"
    published(
      await http.mutate("move", source, destination),
      "move",
      source,
      destination,
      node(fixture.path, path.join(fixture.path, "moved")),
    )
    expect(await linkIdentity(path.join(fixture.path, "moved"))).toEqual(original)
    expect(await http.list()).toMatchObject({
      status: 200,
      body: expect.arrayContaining([node(fixture.path, path.join(fixture.path, "moved"))]),
    })
    const contentPath = kind === "file" ? "moved" : "moved/marker.md"
    missing(await http.content(contentPath), contentPath)
    missing(await http.mutate("move", source, "retry"), source)
    await exactBytes(originalContent)
  },
  60_000,
)

test.each(["file", "dir"] as const)(
  "relative %s moves retain their text while content reads follow the new real target",
  async (kind) => {
    await using fixture = await project(`link-retarget-${kind}`)
    await fs.mkdir(path.join(fixture.path, "source"))
    const targetName = kind === "file" ? "target.md" : "target-dir"
    for (const [base, text] of [
      [path.join(fixture.path, "source"), marker],
      [fixture.path, replacement],
    ]) {
      if (kind === "dir") await fs.mkdir(path.join(base, targetName))
      await fs.writeFile(path.join(base, targetName, ...(kind === "dir" ? ["marker.md"] : [])), text)
    }
    await link(targetName, path.join(fixture.path, "source", "link"), kind)
    const original = await linkIdentity(path.join(fixture.path, "source", "link"))
    await using http = await api(fixture.path)
    published(
      await http.mutate("move", "source/link", "moved"),
      "move",
      "source/link",
      "moved",
      node(fixture.path, path.join(fixture.path, "moved")),
    )
    expect(await linkIdentity(path.join(fixture.path, "moved"))).toEqual(original)
    await textContent(http, kind === "file" ? "moved" : "moved/marker.md", replacement)
    await exactBytes(path.join(fixture.path, "source", targetName, ...(kind === "dir" ? ["marker.md"] : [])))
    await exactBytes(path.join(fixture.path, targetName, ...(kind === "dir" ? ["marker.md"] : [])), replacement)
  },
  60_000,
)

test.each(["move", "copy", "delete"] as const)(
  "%s handles already broken in-scope file, directory and junction entries",
  async (action) => {
    await using fixture = await project(`link-broken-${action}`)
    await fs.mkdir(path.join(fixture.path, "source"))
    await using http = await api(fixture.path)
    for (const kind of ["file", "dir", "junction"] as const) {
      const source = `source/${kind}`
      const target = `result-${kind}`
      const declared =
        kind === "junction" ? path.join(fixture.path, "missing-junction-target") : `missing-${kind}-target`
      await link(declared, path.join(fixture.path, source), kind)
      const original = await linkIdentity(path.join(fixture.path, source))
      const result = await http.mutate(action, source, target)
      if (action === "delete") {
        expect(result).toEqual({ status: 200, body: { path: source } })
        missing(await http.mutate("delete", source), source)
      } else {
        published(result, action, source, target, node(fixture.path, path.join(fixture.path, target)))
        expect(await fs.readlink(path.join(fixture.path, target))).toBe(original.text)
        expect(await identity(path.join(fixture.path, target))).toMatchObject({
          link: true,
          directory: false,
          file: false,
        })
        if (action === "move") expect(await linkIdentity(path.join(fixture.path, target))).toEqual(original)
        if (action === "copy") expect(await linkIdentity(path.join(fixture.path, source))).toEqual(original)
        missing(await http.content(target), target)
        expect(await http.list()).toMatchObject({
          status: 200,
          body: expect.arrayContaining([node(fixture.path, path.join(fixture.path, target))]),
        })
      }
    }
    await exactBytes(path.join(fixture.path, "root-marker.md"))
  },
  90_000,
)

test.each(["copy", "move"] as const)(
  "%s of a real directory preserves complete files and every link text",
  async (action) => {
    await using fixture = await project(`link-tree-${action}`)
    const source = path.join(fixture.path, "source")
    await fs.mkdir(path.join(source, "folder"), { recursive: true })
    await fs.writeFile(path.join(source, "note.md"), marker)
    await fs.writeFile(path.join(source, "folder", "marker.md"), replacement)
    for (const [name, target, kind] of [
      ["file-link", "note.md", "file"],
      ["dir-link", "folder", "dir"],
      ["broken-file", "missing.md", "file"],
      ["broken-dir", "missing-folder", "dir"],
    ] as const)
      await link(target, path.join(source, name), kind)
    const names = (await fs.readdir(source)).toSorted()
    const links = await Promise.all(
      ["file-link", "dir-link", "broken-file", "broken-dir"].map(async (name) => ({
        name,
        original: await linkIdentity(path.join(source, name)),
      })),
    )
    const sourceIdentity = await identity(source)
    await using http = await api(fixture.path)
    const target = path.join(fixture.path, "result")
    published(
      await http.mutate(action, "source", "result"),
      action,
      "source",
      "result",
      node(fixture.path, target, false, "directory"),
    )
    expect((await fs.readdir(target)).toSorted()).toEqual(names)
    if (action === "move") expect(await identity(target)).toEqual(sourceIdentity)
    for (const entry of links) {
      expect(await fs.readlink(path.join(target, entry.name))).toBe(entry.original.text)
      expect(await identity(path.join(target, entry.name))).toMatchObject({ link: true, directory: false, file: false })
      if (action === "move") expect(await linkIdentity(path.join(target, entry.name))).toEqual(entry.original)
      if (action === "copy") expect(await linkIdentity(path.join(source, entry.name))).toEqual(entry.original)
    }
    await exactBytes(path.join(target, "note.md"))
    await exactBytes(path.join(target, "folder", "marker.md"), replacement)
    await textContent(http, "result/file-link")
    await textContent(http, "result/dir-link/marker.md", replacement)
    missing(await http.content("result/broken-file"), "result/broken-file")
    missing(await http.content("result/broken-dir/marker.md"), "result/broken-dir/marker.md")
    expect(await http.list("result")).toMatchObject({
      status: 200,
      body: expect.arrayContaining(links.map((entry) => node(fixture.path, path.join(target, entry.name)))),
    })
    if (action === "copy") await exactBytes(path.join(source, "note.md"))
    if (action === "move") missing(await http.mutate("move", "source", "retry"), "source")
  },
  90_000,
)

test("copying an independent terminal root link publishes a link and retains the physical root", async () => {
  await using fixture = await project("link-copy-root-entry")
  await link(fixture.path, path.join(fixture.path, "root-link"), "junction")
  const rootIdentity = await identity(fixture.path)
  const original = await linkIdentity(path.join(fixture.path, "root-link"))
  await using http = await api(fixture.path)
  published(
    await http.mutate("copy", "root-link", "copied-root-link"),
    "copy",
    "root-link",
    "copied-root-link",
    node(fixture.path, path.join(fixture.path, "copied-root-link")),
  )
  expect(await identity(fixture.path)).toEqual(rootIdentity)
  expect(await linkIdentity(path.join(fixture.path, "root-link"))).toEqual(original)
  expect(await fs.readlink(path.join(fixture.path, "copied-root-link"))).toBe(original.text)
  expect(await identity(path.join(fixture.path, "copied-root-link"))).toMatchObject({
    link: true,
    directory: false,
    file: false,
  })

  await exactBytes(path.join(fixture.path, "root-marker.md"))
  await textContent(http, "copied-root-link/root-marker.md")
}, 60_000)

test.each(["move", "copy"] as const)(
  "%s rejects a terminal link's physical shallow destination outside scope",
  async (action) => {
    await using fixture = await project(`relocation-physical-${action}`)
    await using external = await project(`relocation-physical-external-${action}`)
    const externalName = path.basename(external.path)
    await fs.mkdir(path.join(fixture.path, "deep"))
    await fs.mkdir(path.join(fixture.path, externalName))
    await fs.mkdir(path.join(fixture.path, "aliases", externalName), { recursive: true })
    await fs.writeFile(path.join(fixture.path, externalName, "marker.md"), marker)
    await fs.writeFile(path.join(fixture.path, "aliases", externalName, "marker.md"), replacement)
    await fs.writeFile(path.join(external.path, "marker.md"), replacement)
    await link(`../${externalName}`, path.join(fixture.path, "deep/link"), "dir")
    await link(fixture.path, path.join(fixture.path, "aliases/root-back"), "junction")
    const original = await linkIdentity(path.join(fixture.path, "deep/link"))
    await using http = await api(fixture.path)
    await using externalHTTP = await api(external.path)
    await textContent(http, "deep/link/marker.md")
    invalid(await http.mutate(action, "deep/link", "aliases/root-back/result"), "deep/link")
    expect(await linkIdentity(path.join(fixture.path, "deep/link"))).toEqual(original)
    await textContent(http, "deep/link/marker.md")
    await textContent(externalHTTP, "marker.md", replacement)
    await exactBytes(path.join(fixture.path, "aliases", externalName, "marker.md"), replacement)
  },
  90_000,
)

test.each(process.platform === "win32" ? (["move", "copy"] as const) : [])(
  "%s checks an unpublished internal junction chain in its final namespace",
  async (action) => {
    await using fixture = await project(`relocation-junction-tree-${action}`)
    await using external = await project(`relocation-junction-external-${action}`)
    const externalName = path.basename(external.path)
    for (const directory of ["deep/tree", "data/nested", externalName])
      await fs.mkdir(path.join(fixture.path, directory), { recursive: true })
    await fs.writeFile(path.join(fixture.path, externalName, "marker.md"), marker)
    await fs.writeFile(path.join(external.path, "marker.md"), replacement)
    await link(`../../../${externalName}`, path.join(fixture.path, "data/nested/r"), "dir")
    await link(path.join(fixture.path, "data/nested"), path.join(fixture.path, "deep/tree/p"), "junction")
    await link("p/r", path.join(fixture.path, "deep/tree/u"), "dir")
    const original = await linkIdentity(path.join(fixture.path, "deep/tree/u"))
    const sourceIdentity = await identity(path.join(fixture.path, "deep/tree"))
    await using http = await api(fixture.path)
    await textContent(http, "deep/tree/u/marker.md")
    invalid(await http.mutate(action, "deep/tree", "result"), path.join("deep/tree", "u"))
    expect(await identity(path.join(fixture.path, "deep/tree"))).toEqual(sourceIdentity)
    expect(await linkIdentity(path.join(fixture.path, "deep/tree/u"))).toEqual(original)
    await textContent(http, "deep/tree/u/marker.md")
    await exactBytes(path.join(external.path, "marker.md"), replacement)
  },
  90_000,
)

test.each(process.platform === "win32" ? (["move", "copy"] as const) : [])(
  "%s retains a fixed absolute symbolic namespace over an independent junction",
  async (action) => {
    await using fixture = await project(`relocation-fixed-namespace-${action}`)
    for (const directory of ["deep/tree", "data/nested", "goal"])
      await fs.mkdir(path.join(fixture.path, directory), { recursive: true })
    await fs.writeFile(path.join(fixture.path, "goal/marker.md"), marker)
    await link("../../goal", path.join(fixture.path, "data/nested/r"), "dir")
    await link(path.join(fixture.path, "data/nested"), path.join(fixture.path, "deep/pivot"), "junction")
    await link(path.join(fixture.path, "deep/pivot"), path.join(fixture.path, "deep/tree/p"), "dir")
    await link("p/r", path.join(fixture.path, "deep/tree/u"), "dir")
    const original = await linkIdentity(path.join(fixture.path, "deep/tree/u"))
    await using http = await api(fixture.path)
    await textContent(http, "deep/tree/u/marker.md")
    published(
      await http.mutate(action, "deep/tree", "result"),
      action,
      "deep/tree",
      "result",
      node(fixture.path, path.join(fixture.path, "result"), false, "directory"),
    )
    await textContent(http, "result/u/marker.md")
    expect(await fs.readlink(path.join(fixture.path, "result/u"))).toBe(original.text)
    await exactBytes(path.join(fixture.path, "goal/marker.md"))
  },
  90_000,
)

test.each(["move", "copy"] as const)(
  "%s observes the retained or retired old absolute tree",
  async (action) => {
    await using fixture = await project(`relocation-old-tree-${action}`)
    await fs.mkdir(path.join(fixture.path, "source-tree"))
    await fs.writeFile(path.join(fixture.path, "source-tree/note.md"), marker)
    await link(path.join(fixture.path, "source-tree/note.md"), path.join(fixture.path, "source-tree/old"), "file")
    const original = await linkIdentity(path.join(fixture.path, "source-tree/old"))
    await using http = await api(fixture.path)
    published(
      await http.mutate(action, "source-tree", "renamed-tree"),
      action,
      "source-tree",
      "renamed-tree",
      node(fixture.path, path.join(fixture.path, "renamed-tree"), false, "directory"),
    )
    expect(await fs.readlink(path.join(fixture.path, "renamed-tree/old"))).toBe(original.text)
    await exactBytes(path.join(fixture.path, "renamed-tree/note.md"))
    if (action === "move") missing(await http.content("renamed-tree/old"), "renamed-tree/old")
    else await textContent(http, "renamed-tree/old")
  },
  90_000,
)

test.each(["move", "copy"] as const)(
  "%s returns the precise contract for a future internal cycle",
  async (action) => {
    await using fixture = await project(`relocation-future-cycle-${action}`)
    await fs.mkdir(path.join(fixture.path, "source"))
    await fs.writeFile(path.join(fixture.path, "source/note.md"), marker)
    await link("../result/link", path.join(fixture.path, "source/link"), "dir")
    const original = await linkIdentity(path.join(fixture.path, "source/link"))
    await using http = await api(fixture.path)
    const result = await http.mutate(action, "source", "result")
    invalid(result, path.join("source", "link"))
    expect(result.body.data.message).toBe(`Cannot relocate recursive symlink target: ${path.join("source", "link")}`)
    expect(await linkIdentity(path.join(fixture.path, "source/link"))).toEqual(original)
    await exactBytes(path.join(fixture.path, "source/note.md"))
  },
  90_000,
)

test.each(["move", "copy"] as const)(
  "%s admits finite repeated directory access states",
  async (action) => {
    await using fixture = await project(`relocation-finite-access-${action}`)
    await fs.mkdir(path.join(fixture.path, "source"))
    await fs.writeFile(path.join(fixture.path, "source/marker.md"), marker)
    await link(".", path.join(fixture.path, "source/p"), "dir")
    await link("p/p", path.join(fixture.path, "source/u"), "dir")
    await using http = await api(fixture.path)
    published(
      await http.mutate(action, "source", "result"),
      action,
      "source",
      "result",
      node(fixture.path, path.join(fixture.path, "result"), false, "directory"),
    )
    await textContent(http, "result/u/marker.md")
    await exactBytes(path.join(fixture.path, "result/marker.md"))
  },
  90_000,
)

function dependentDestination(result: { status: number; body: any }, target: string) {
  expect(result).toEqual({
    status: 400,
    body: {
      name: "FileInvalidPathError",
      data: { path: target, message: `Destination parent depends on the source entry being moved: ${target}` },
    },
  })
}

test.each(process.platform === "win32" ? (["move", "copy"] as const) : [])(
  "%s uses actual short entry spellings in the complete future tree",
  async (action) => {
    await using fixture = await project(`relocation-short-tree-${action}`)
    await using external = await project(`relocation-short-external-${action}`)
    const externalName = path.basename(external.path)
    for (const directory of ["deep/tree", "data/nested", externalName])
      await fs.mkdir(path.join(fixture.path, directory), { recursive: true })
    await fs.writeFile(path.join(fixture.path, externalName, "marker.md"), marker)
    await fs.writeFile(path.join(external.path, "marker.md"), replacement)
    await link(`../../../${externalName}`, path.join(fixture.path, "data/nested/r"), "dir")
    for (const name of ["junction-alpha-link", "junction-alpine-link"])
      await link(path.join(fixture.path, "data/nested"), path.join(fixture.path, "deep/tree", name), "junction")
    await fs.mkdir(path.join(fixture.path, "deep/tree/junction-altar-folder/r"), { recursive: true })
    await fs.writeFile(path.join(fixture.path, "deep/tree/junction-altar-folder/r/marker.md"), replacement)
    const entry = await readFileEntry(path.join(fixture.path, "deep/tree/junction-alpha-link"))
    expect(typeof entry.shortName).toBe("string")
    expect((await readFileEntry(path.join(fixture.path, "deep/tree", entry.shortName!))).address).toBe(entry.address)
    console.log("[link entry actual spelling]", JSON.stringify({ path: entry.address, shortName: entry.shortName }))
    await link(`${entry.shortName}/r`, path.join(fixture.path, "deep/tree/u"), "dir")
    const original = await linkIdentity(path.join(fixture.path, "deep/tree/u"))
    await using http = await api(fixture.path)
    await textContent(http, "deep/tree/u/marker.md")
    const result = await http.mutate(action, "deep/tree", "result")
    if (action === "move") {
      invalid(result, path.join("deep/tree", "u"))
      expect(await linkIdentity(path.join(fixture.path, "deep/tree/u"))).toEqual(original)
      await textContent(http, "deep/tree/u/marker.md")
    } else {
      published(
        result,
        "copy",
        "deep/tree",
        "result",
        node(fixture.path, path.join(fixture.path, "result"), false, "directory"),
      )
      await textContent(http, "result/u/marker.md", replacement)
      expect(await fs.readlink(path.join(fixture.path, "result/u"))).toBe(original.text)
      const alias = await readFileEntry(path.join(fixture.path, "result", entry.shortName!))
      expect(alias.stat.isDirectory()).toBe(true)
      expect(alias.address).toBe((await readFileEntry(path.join(fixture.path, "result/junction-altar-folder"))).address)
      await exactBytes(path.join(fixture.path, "result/junction-altar-folder/r/marker.md"), replacement)
    }
    await exactBytes(path.join(external.path, "marker.md"), replacement)
  },
  90_000,
)

test.each(
  process.platform === "win32"
    ? ([
        { kind: "junction", broken: false },
        { kind: "junction", broken: true },
        { kind: "dir", broken: false },
        { kind: "dir", broken: true },
      ] as const)
    : [],
)(
  "Windows Copy retains $kind creation type with broken=$broken",
  async ({ kind, broken }) => {
    await using fixture = await project(`link-copy-creation-${kind}-${broken}`)
    const target = path.join(fixture.path, "target")
    if (!broken) {
      await fs.mkdir(target)
      await fs.writeFile(path.join(target, "marker.md"), marker)
    }
    await link(kind === "junction" ? target : "target", path.join(fixture.path, "source"), kind)
    const original = await linkIdentity(path.join(fixture.path, "source"))
    await using http = await api(fixture.path)
    published(
      await http.mutate("copy", "source", "copied"),
      "copy",
      "source",
      "copied",
      node(fixture.path, path.join(fixture.path, "copied")),
    )
    expect((await readFileEntry(path.join(fixture.path, "copied"))).link).toBe(kind)
    expect(await fs.readlink(path.join(fixture.path, "copied"))).toBe(original.text)
    expect(await linkIdentity(path.join(fixture.path, "source"))).toEqual(original)
    if (broken) {
      missing(await http.content("copied/marker.md"), "copied/marker.md")
      await fs.mkdir(target)
      await fs.writeFile(path.join(target, "marker.md"), marker)
    }
    await textContent(http, "copied/marker.md")
    await exactBytes(path.join(target, "marker.md"))
  },
  60_000,
)

test.skipIf(process.platform !== "win32")(
  "Copy retains an internal junction's relative context at the same tree depth",
  async () => {
    await using fixture = await project("link-copy-internal-junction-context")
    await using external = await project("link-copy-internal-junction-external")
    expect(path.dirname(fixture.path)).toBe(path.dirname(external.path))
    const externalName = path.basename(external.path)
    for (const relative of ["deep/tree", "data/nested", externalName])
      await fs.mkdir(path.join(fixture.path, relative), { recursive: true })
    await fs.writeFile(path.join(fixture.path, externalName, "marker.md"), marker)
    await fs.writeFile(path.join(external.path, "marker.md"), replacement)
    await link(`../../../${externalName}`, path.join(fixture.path, "data/nested/r"), "dir")
    await link(path.join(fixture.path, "data/nested"), path.join(fixture.path, "deep/tree/p"), "junction")
    await link("p", path.join(fixture.path, "deep/tree/q"), "dir")
    await link("q/r", path.join(fixture.path, "deep/tree/u"), "dir")
    const original = await linkIdentity(path.join(fixture.path, "deep/tree/p"))
    await using http = await api(fixture.path)
    await textContent(http, "deep/tree/u/marker.md")
    published(
      await http.mutate("copy", "deep/tree", "deep/copied"),
      "copy",
      "deep/tree",
      "deep/copied",
      node(fixture.path, path.join(fixture.path, "deep/copied"), false, "directory"),
    )
    await textContent(http, "deep/copied/u/marker.md")
    expect((await readFileEntry(path.join(fixture.path, "deep/copied/p"))).link).toBe("junction")
    expect(await fs.readlink(path.join(fixture.path, "deep/copied/p"))).toBe(original.text)
    expect(await linkIdentity(path.join(fixture.path, "deep/tree/p"))).toEqual(original)
    await exactBytes(path.join(fixture.path, externalName, "marker.md"))
    await exactBytes(path.join(external.path, "marker.md"), replacement)
  },
  90_000,
)

test.each(["junction", "dir", "indirect", ...(process.platform === "win32" ? ["uppercase"] : [])] as const)(
  "%s destination dependency returns 400 and the retained source can move through an independent alias",
  async (mode) => {
    await using fixture = await project(`link-move-dependency-${mode}`)
    const data = path.join(fixture.path, "data")
    await fs.mkdir(data)
    await fs.mkdir(path.join(fixture.path, "context"))
    await fs.writeFile(path.join(data, "marker.md"), marker)
    const source = "Source-Link"
    const kind = mode === "dir" ? "dir" : "junction"
    await link(data, path.join(fixture.path, source), kind)
    await link(data, path.join(fixture.path, "alias"), kind)
    await link(`../${source}`, path.join(fixture.path, "context", "indirect"), "dir")
    const original = await linkIdentity(path.join(fixture.path, source))
    const independent = await linkIdentity(path.join(fixture.path, "alias"))
    const target =
      mode === "indirect" ? "context/indirect/moved" : `${mode === "uppercase" ? source.toUpperCase() : source}/moved`
    await using http = await api(fixture.path)
    dependentDestination(await http.mutate("move", source, target), target)
    expect(await linkIdentity(path.join(fixture.path, source))).toEqual(original)
    await textContent(http, `${source}/marker.md`)
    await exactBytes(path.join(data, "marker.md"))
    const admitted = "alias/moved"
    published(
      await http.mutate("move", source, admitted),
      "move",
      source,
      admitted,
      node(fixture.path, path.join(fixture.path, admitted)),
    )
    expect(await linkIdentity(path.join(fixture.path, admitted))).toEqual(original)
    expect(await linkIdentity(path.join(fixture.path, "alias"))).toEqual(independent)
    await textContent(http, "alias/moved/marker.md")
    expect(await http.waitForEdits([source, admitted])).toEqual(
      expect.arrayContaining(
        [source, admitted].map((file) => ({ file, processAuthority: { kind: "host", cwd: fixture.path } })),
      ),
    )
  },
  60_000,
)

test.each(["junction", "dir"] as const)(
  "mixed %s ancestors preserve the real relative namespace during Move admission",
  async (kind) => {
    await using fixture = await project(`link-move-mixed-${kind}`)
    for (const name of ["context", "D/data", "output"])
      await fs.mkdir(path.join(fixture.path, name), { recursive: true })
    await fs.writeFile(path.join(fixture.path, "output", "marker.md"), marker)
    await link(path.join(fixture.path, "output"), path.join(fixture.path, "context", "goal"), "dir")
    await link(path.join(fixture.path, "output"), path.join(fixture.path, "D", "goal"), "dir")
    await link(path.join(fixture.path, "D", "data"), path.join(fixture.path, "context", "inner"), kind)
    await link(path.join(fixture.path, "context", "inner"), path.join(fixture.path, "S"), "dir")
    await link("../goal", path.join(fixture.path, "D", "data", "r"), "dir")
    const source = "context/goal",
      target = "S/r/moved"
    const original = await linkIdentity(path.join(fixture.path, source))
    await using http = await api(fixture.path)
    const result = await http.mutate("move", source, target)
    if (process.platform === "win32" && kind === "junction") {
      dependentDestination(result, target)
      expect(await linkIdentity(path.join(fixture.path, source))).toEqual(original)
    } else {
      published(result, "move", source, target, node(fixture.path, path.join(fixture.path, target)))
      expect(await linkIdentity(path.join(fixture.path, target))).toEqual(original)
      await textContent(http, `${target}/marker.md`)
    }
    await exactBytes(path.join(fixture.path, "output", "marker.md"))
  },
  60_000,
)

test.skipIf(process.platform !== "win32")(
  "Windows folds cancelled relative components before observing ordinary, symbolic, junction and broken entries",
  async () => {
    for (const kind of ["directory", "dir", "junction", "broken"] as const) {
      await using fixture = await project(`link-move-folded-dot-${kind}`)
      const tree = path.join(fixture.path, "tree"),
        data = path.join(fixture.path, "data")
      await fs.mkdir(tree)
      await fs.mkdir(data)
      await fs.writeFile(path.join(data, "marker.md"), marker)
      if (kind === "directory") {
        await fs.mkdir(path.join(tree, "v"))
        await fs.writeFile(path.join(tree, "v", "note.md"), replacement)
      } else
        await link(
          kind === "broken" ? path.join(fixture.path, "missing") : data,
          path.join(tree, "v"),
          kind === "junction" ? "junction" : "dir",
        )
      await link(data, path.join(tree, "goal"), "dir")
      await link("v/../goal", path.join(tree, "u"), "dir")
      const original = await identity(path.join(tree, "v"))
      const originalText = kind === "directory" ? undefined : await fs.readlink(path.join(tree, "v"))
      await using http = await api(fixture.path)
      const source = "tree/v",
        target = "tree/u/moved"
      published(
        await http.mutate("move", source, target),
        "move",
        source,
        target,
        node(fixture.path, path.join(fixture.path, target), false, kind === "directory" ? "directory" : "file"),
      )
      expect(await identity(path.join(fixture.path, target))).toEqual(original)
      if (originalText !== undefined) expect(await fs.readlink(path.join(fixture.path, target))).toBe(originalText)
      if (kind === "directory") await exactBytes(path.join(fixture.path, target, "note.md"), replacement)
      else if (kind === "broken") missing(await http.content(`${target}/marker.md`), `${target}/marker.md`)
      else await textContent(http, `${target}/marker.md`)
      await exactBytes(path.join(data, "marker.md"))
    }
  },
  90_000,
)

test("Move rejects an ordinary directory's retiring parent and admits finite independent root aliases", async () => {
  await using fixture = await project("link-move-directory-dependency")
  const source = "tree"
  await fs.mkdir(path.join(fixture.path, source, "sub"), { recursive: true })
  await fs.writeFile(path.join(fixture.path, source, "note.md"), marker)
  const original = await identity(path.join(fixture.path, source))
  await using http = await api(fixture.path)
  const dependent = "tree/sub/moved"
  dependentDestination(await http.mutate("move", source, dependent), dependent)
  expect(await identity(path.join(fixture.path, source))).toEqual(original)
  await exactBytes(path.join(fixture.path, source, "note.md"))
  await link(fixture.path, path.join(fixture.path, "root-link"), "junction")
  const target = "root-link/root-link/moved"
  published(
    await http.mutate("move", source, target),
    "move",
    source,
    target,
    node(fixture.path, path.join(fixture.path, target), false, "directory"),
  )
  expect(await identity(path.join(fixture.path, target))).toEqual(original)
  await textContent(http, `${target}/note.md`)
}, 60_000)

test.each(["healthy", "dangling"] as const)(
  "Move returns entry conflict for an existing %s destination through its source",
  async (kind) => {
    await using fixture = await project(`link-move-conflict-dependent-${kind}`)
    const data = path.join(fixture.path, "data")
    await fs.mkdir(data)
    await link(data, path.join(fixture.path, "source"), "junction")
    const target = "source/existing"
    if (kind === "healthy") await fs.writeFile(path.join(data, "existing"), replacement)
    else await link("missing", path.join(data, "existing"), "file")
    const originalSource = await linkIdentity(path.join(fixture.path, "source"))
    const originalTarget = await identity(path.join(data, "existing"))
    await using http = await api(fixture.path)
    expect(await http.mutate("move", "source", target)).toEqual({
      status: 409,
      body: {
        name: "FileConflictError",
        data: { path: target, message: `File destination already exists: ${target}` },
      },
    })
    expect(await linkIdentity(path.join(fixture.path, "source"))).toEqual(originalSource)
    expect(await identity(path.join(data, "existing"))).toEqual(originalTarget)
    if (kind === "healthy") await exactBytes(path.join(data, "existing"), replacement)
    else expect(await fs.readlink(path.join(data, "existing"))).toBe("missing")
  },
  60_000,
)

test("healthy external link targets retain the existing 400 source authority contract for every action", async () => {
  await using fixture = await project("link-external-source")
  await using external = await project("link-external-source-target")
  await link(path.join(external.path, "root-marker.md"), path.join(fixture.path, "link"), "file")
  const original = await linkIdentity(path.join(fixture.path, "link"))
  const targetIdentity = await identity(path.join(external.path, "root-marker.md"))
  await using http = await api(fixture.path)
  for (const action of ["copy", "move", "delete"] as const) {
    invalid(await http.mutate(action, "link", "result"), "link")
    expect(await linkIdentity(path.join(fixture.path, "link"))).toEqual(original)
    expect(await identity(path.join(external.path, "root-marker.md"))).toEqual(targetIdentity)
    await exactBytes(path.join(external.path, "root-marker.md"))
  }
}, 60_000)

test("broken externally declared sources return exact authority errors while retaining their entries", async () => {
  await using fixture = await project("link-broken-external")
  await using external = await project("link-broken-external-target")
  await link(path.join(external.path, "missing.md"), path.join(fixture.path, "link"), "file")
  const original = await linkIdentity(path.join(fixture.path, "link"))
  await using http = await api(fixture.path)
  for (const action of ["copy", "move"] as const) {
    invalid(await http.mutate(action, "link", "result"), "link")
    expect(await linkIdentity(path.join(fixture.path, "link"))).toEqual(original)
  }
  await exactBytes(path.join(external.path, "root-marker.md"))
}, 60_000)

test("relocated external declarations return 400 and retain both real targets", async () => {
  await using fixture = await project("link-relocation-external")
  await using external = await project("link-relocation-external-target")
  const base = path.basename(external.path)
  await fs.mkdir(path.join(fixture.path, "source"))
  await fs.mkdir(path.join(fixture.path, base))
  await fs.writeFile(path.join(fixture.path, base, "root-marker.md"), replacement)
  await link(`../${base}/root-marker.md`, path.join(fixture.path, "source", "link"), "file")
  const original = await linkIdentity(path.join(fixture.path, "source", "link"))
  await using http = await api(fixture.path)
  for (const action of ["copy", "move"] as const) {
    invalid(await http.mutate(action, "source/link", "result"), "source/link")
    expect(await linkIdentity(path.join(fixture.path, "source", "link"))).toEqual(original)
    await exactBytes(path.join(fixture.path, base, "root-marker.md"), replacement)
    await exactBytes(path.join(external.path, "root-marker.md"))
  }
}, 60_000)

test.each(["copy", "move"] as const)(
  "%s to an existing dangling destination returns 409 and retains both entries",
  async (action) => {
    await using fixture = await project(`link-destination-conflict-${action}`)
    await fs.writeFile(path.join(fixture.path, "source.md"), marker)
    await link("missing.md", path.join(fixture.path, "destination"), "file")
    const original = await linkIdentity(path.join(fixture.path, "destination"))
    const sourceIdentity = await identity(path.join(fixture.path, "source.md"))
    await using http = await api(fixture.path)
    expect(await http.mutate(action, "source.md", "destination")).toMatchObject({
      status: 409,
      body: { name: "FileConflictError", data: { path: "destination" } },
    })
    expect(await linkIdentity(path.join(fixture.path, "destination"))).toEqual(original)
    expect(await identity(path.join(fixture.path, "source.md"))).toEqual(sourceIdentity)
    await exactBytes(path.join(fixture.path, "source.md"))
  },
  60_000,
)

test("parallel project mutations retain independent entry metadata, notifications and rules", async () => {
  await using first = await project("link-parallel-first")
  await using second = await project("link-parallel-second")
  for (const [fixture, rules] of [
    [first, "/copied\n/moved\n"],
    [second, "/copied/\n/moved/\n"],
  ] as const) {
    await fs.writeFile(path.join(fixture.path, ".gitignore"), rules)
    await link(path.join(fixture.path, "root-marker.md"), path.join(fixture.path, "source"), "file")
  }
  await using firstHttp = await api(first.path)
  await using secondHttp = await api(second.path)
  expect(new Set([firstHttp.scope.projectID, secondHttp.scope.projectID]).size).toBe(2)
  await Promise.all(
    (
      [
        [first, firstHttp, true],
        [second, secondHttp, false],
      ] as const
    ).map(async ([owned, client, ignored]) => {
      for (const action of ["copy", "move"] as const) {
        const target = action === "copy" ? "copied" : "moved"
        published(
          await client.mutate(action, "source", target),
          action,
          "source",
          target,
          node(owned.path, path.join(owned.path, target), ignored),
        )
        await textContent(client, target)
      }
      expect(await client.list()).toMatchObject({
        status: 200,
        body: expect.arrayContaining([
          node(owned.path, path.join(owned.path, "copied"), ignored),
          node(owned.path, path.join(owned.path, "moved"), ignored),
        ]),
      })
      expect(await client.waitForEdits(["source", "copied", "moved"])).toEqual(
        expect.arrayContaining(
          ["source", "copied", "moved"].map((file) => ({ file, processAuthority: { kind: "host", cwd: owned.path } })),
        ),
      )
    }),
  )
}, 90_000)

test("child-scope copies and moves publish parent entry identities using the worktree rules", async () => {
  await using fixture = await project("link-child-scope")
  const directory = path.join(fixture.path, "scoped-project")
  await fs.mkdir(directory)
  await fs.writeFile(path.join(directory, ".git"), `gitdir: ${path.join(fixture.path, ".git").replaceAll("\\", "/")}\n`)
  const git = await hostGit(["config", "core.worktree", fixture.path], { cwd: fixture.path })
  expect(git.exitCode).toBe(0)
  await fs.writeFile(path.join(fixture.path, ".gitignore"), "/copied\n/moved\n")
  await link(path.join(fixture.path, "root-marker.md"), path.join(directory, "link"), "file")
  const original = await linkIdentity(path.join(directory, "link"))
  await using http = await api(directory)
  expect(http.scope).toMatchObject({ directory, worktree: fixture.path })
  for (const action of ["copy", "move"] as const) {
    const target = action === "copy" ? "../copied" : "../moved"
    published(
      await http.mutate(action, "./link", target),
      action,
      "./link",
      target,
      node(directory, path.join(directory, target), true),
    )
    expect(await fs.readlink(path.join(directory, target))).toBe(original.text)
    if (action === "move") expect(await linkIdentity(path.join(directory, target))).toEqual(original)
    await textContent(http, target)
  }
  expect(await http.list("..")).toMatchObject({
    status: 200,
    body: expect.arrayContaining([
      node(directory, path.join(fixture.path, "copied"), true),
      node(directory, path.join(fixture.path, "moved"), true),
    ]),
  })
  await exactBytes(path.join(fixture.path, "root-marker.md"))
}, 60_000)
