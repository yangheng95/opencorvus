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
