import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { Instance } from "../src/project/instance"
import { FileRoutes } from "../src/server/routes/file"
import { serverErrorResponse, publicUnknownErrorMessage } from "../src/server/error-handler"
import { hostGit } from "../src/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)
const bytes = "Exact scoped note 资料\r\n"

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory, timeoutProfile: "default" })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || `Git exited ${result.exitCode}`)
}

async function project(seed: string) {
  const fixture = await memoryProject(seed)
  const owner = await fs.realpath(process.env.OPENCORVUS_TEST_PROCESS_ROOT!)
  if (!path.relative(owner, fixture.path).startsWith(`fixtures${path.sep}memory-`))
    throw new Error("File tests require a new managed fixture")
  expect(await fs.readFile(path.join(fixture.path, ".opencorvus-test-project-identity"), "utf8")).toBe(seed)
  return fixture
}

async function child(root: string) {
  const directory = path.join(root, "scoped-project")
  await fs.mkdir(directory)
  await fs.writeFile(path.join(directory, ".git"), `gitdir: ${path.join(root, ".git").replaceAll("\\", "/")}\n`)
  await git(root, ["config", "core.worktree", root])
  return directory
}

async function api(directory: string) {
  const scope = await Instance.provide({
    directory,
    fn: async () => ({
      directory: Instance.directory,
      worktree: Instance.worktree,
      projectWorktree: Instance.project.worktree,
      projectID: Instance.project.id,
    }),
  })
  const app = new Hono().onError(serverErrorResponse).route("/", FileRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => Instance.provide({ directory, fn: () => app.fetch(request) }),
  })
  return {
    scope,
    async request(method: string, route: string, body?: unknown) {
      const response = await fetch(new URL(route, server.url), {
        method,
        ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
      })
      const result = { status: response.status, body: await response.json() }
      console.log("[ignore coordinate HTTP]", JSON.stringify({ scope, method, route, input: body, result }))
      return result
    },
    async list(file = "") {
      return this.request("GET", `/file?${new URLSearchParams({ path: file })}`)
    },
    async [Symbol.asyncDispose]() {
      await server.stop(true)
    },
  }
}

function node(directory: string, full: string, ignored: boolean, type = "file") {
  return { name: path.basename(full), path: path.relative(directory, full), absolute: full, type, ignored }
}
function listed(result: { status: number; body: any }, nodes: ReturnType<typeof node>[]) {
  expect(result).toMatchObject({
    status: 200,
    body: expect.arrayContaining(nodes.map((item) => expect.objectContaining(item))),
  })
}
async function alias(target: string, location: string) {
  await fs.symlink(target, location, process.platform === "win32" ? "junction" : "dir")
  return {
    path: location,
    async [Symbol.asyncDispose]() {
      await fs.unlink(location)
    },
  }
}

test("scoped root rules retain original filenames, directory hints and dot-alias node identities", async () => {
  await using fixture = await project("ignore-scoped-list")
  const directory = await child(fixture.path)
  await fs.writeFile(
    path.join(fixture.path, ".gitignore"),
    "/root-only.md\n/scoped-project/anchored 资料.md\n/scoped-project/keep.md\n/scoped-project/dirs/\n/scoped-project/ Source 资料\\[1\\].md\n\\#note.md\n\\!note.md\n",
  )
  await fs.writeFile(path.join(fixture.path, ".ignore"), "!/scoped-project/keep.md\n/scoped-project/extra.md\n")
  const names = [
    "root-only.md",
    "anchored 资料.md",
    "keep.md",
    "extra.md",
    " Source 资料[1].md",
    "#note.md",
    "!note.md",
  ]
  for (const base of [fixture.path, directory])
    for (const name of names) await fs.writeFile(path.join(base, name), bytes)
  await fs.mkdir(path.join(directory, "dirs"))
  await using http = await api(directory)
  expect(http.scope).toMatchObject({ directory, worktree: fixture.path })
  const expected = names.map((name) =>
    node(directory, path.join(directory, name), name !== "root-only.md" && name !== "keep.md"),
  )
  expected.push(node(directory, path.join(directory, "dirs"), true, "directory"))
  for (const input of ["", ".", "./", "missing/..", "dirs/.."]) listed(await http.list(input), expected)
  listed(await http.list(".."), [
    node(directory, path.join(fixture.path, "root-only.md"), true),
    node(directory, path.join(fixture.path, "anchored 资料.md"), false),
  ])
  expect(await fs.readFile(path.join(directory, " Source 资料[1].md"), "utf8")).toBe(bytes)
}, 120_000)

test.each(["create", "copy", "move"] as const)(
  "%s returns exact scoped and parent success receipts with published bytes",
  async (action) => {
    await using fixture = await project(`ignore-receipt-${action}`)
    const directory = await child(fixture.path)
    await fs.writeFile(path.join(fixture.path, ".gitignore"), "/scoped-project/result.md\n/parent-result.md\n")
    await using http = await api(directory)
    for (const target of ["../parent-result.md", "missing/../result.md"]) {
      await fs.writeFile(path.join(directory, "note.md"), bytes)
      const source = "./note.md"
      const result = await http.request(
        action === "move" ? "PATCH" : "POST",
        action === "copy" ? "/file/item/copy" : "/file/item",
        action === "create" ? { path: target, type: "file", content: bytes } : { path: source, newPath: target },
      )
      const actual = await fs.readFile(path.join(directory, target), "utf8")
      console.log("[ignore receipt published bytes]", JSON.stringify({ action, target, actual }))
      expect(actual).toBe(bytes)
      const item = node(directory, path.join(directory, target), true)
      expect(result).toEqual({
        status: 200,
        body:
          action === "create"
            ? item
            : { ...(action === "copy" ? { sourcePath: source } : { previousPath: source }), path: target, node: item },
      })
      listed(await http.list(target.startsWith("../") ? ".." : ""), [item])
    }
  },
  60_000,
)

test("independent normal and child Projects project current rule edits within their own scopes", async () => {
  await using first = await project("ignore-independent-first")
  await using second = await project("ignore-independent-second")
  for (const [fixture, rules] of [
    [first, "/note.md\n"],
    [second, "/scoped-project/note.md\n"],
  ] as const) {
    const directory = await child(fixture.path)
    await fs.writeFile(path.join(fixture.path, ".gitignore"), rules)
    for (const base of [fixture.path, directory]) await fs.writeFile(path.join(base, "note.md"), bytes)
  }
  await using firstRoot = await api(first.path)
  await using firstChild = await api(path.join(first.path, "scoped-project"))
  await using secondRoot = await api(second.path)
  await using secondChild = await api(path.join(second.path, "scoped-project"))
  expect(new Set([firstRoot.scope.projectID, secondRoot.scope.projectID]).size).toBe(2)
  const readers = [firstRoot, firstChild, secondRoot, secondChild]
  const flags = [true, false, false, true]
  const results = await Promise.all(readers.map((reader) => reader.list()))
  for (let index = 0; index < readers.length; index++)
    listed(results[index]!, [
      node(readers[index]!.scope.directory, path.join(readers[index]!.scope.directory, "note.md"), flags[index]!),
    ])
  await fs.writeFile(path.join(first.path, ".ignore"), "!/note.md\n/scoped-project/note.md\n")
  listed(await firstRoot.list(), [node(first.path, path.join(first.path, "note.md"), false)])
  listed(await firstChild.list(), [
    node(firstChild.scope.directory, path.join(firstChild.scope.directory, "note.md"), true),
  ])
  listed(await secondChild.list(), [
    node(secondChild.scope.directory, path.join(secondChild.scope.directory, "note.md"), true),
  ])
}, 120_000)

test("internal junctions preserve logical entries even after outward and inward traversal", async () => {
  await using fixture = await project("ignore-internal-links")
  await fs.mkdir(path.join(fixture.path, "sub"))
  await fs.writeFile(path.join(fixture.path, "sub", "note.md"), bytes)
  const back = `back-link/${path.basename(fixture.path)}/sub`
  await fs.writeFile(path.join(fixture.path, ".gitignore"), `/alias-child/note.md\n/${back}/note.md\n`)
  await fs.symlink(
    path.join(fixture.path, "sub"),
    path.join(fixture.path, "alias-child"),
    process.platform === "win32" ? "junction" : "dir",
  )
  await fs.symlink(
    path.dirname(fixture.path),
    path.join(fixture.path, "back-link"),
    process.platform === "win32" ? "junction" : "dir",
  )
  await using http = await api(fixture.path)
  for (const input of ["alias-child", back])
    listed(await http.list(input), [node(fixture.path, path.join(fixture.path, input, "note.md"), true)])
  listed(await http.list("sub"), [node(fixture.path, path.join(fixture.path, "sub", "note.md"), false)])
  expect(await fs.readFile(path.join(fixture.path, back, "note.md"), "utf8")).toBe(bytes)
}, 60_000)

test("external root and ancestor junctions map rules while preserving original node identities", async () => {
  await using fixture = await project("ignore-external-links")
  const directory = await child(fixture.path)
  await fs.writeFile(path.join(fixture.path, ".gitignore"), "/root.md\n/scoped-project/note.md\n")
  await fs.writeFile(path.join(fixture.path, "root.md"), bytes)
  await fs.writeFile(path.join(directory, "note.md"), bytes)
  await using rootAlias = await alias(fixture.path, `${fixture.path}-root-alias`)
  await using ancestor = await alias(path.dirname(fixture.path), `${fixture.path}-ancestor`)
  const aliasedChild = path.join(ancestor.path, path.basename(fixture.path), "scoped-project")
  await using rootHttp = await api(rootAlias.path)
  await using childHttp = await api(aliasedChild)
  await using physicalHttp = await api(fixture.path)
  expect(rootHttp.scope).toMatchObject({ directory: rootAlias.path, worktree: rootAlias.path })
  expect(childHttp.scope).toMatchObject({ directory: aliasedChild, worktree: fixture.path })
  listed(await rootHttp.list("."), [node(rootAlias.path, path.join(rootAlias.path, "root.md"), true)])
  listed(await childHttp.list("."), [node(aliasedChild, path.join(aliasedChild, "note.md"), true)])
  listed(await childHttp.list(".."), [
    node(aliasedChild, path.join(ancestor.path, path.basename(fixture.path), "root.md"), true),
  ])
  listed(await physicalHttp.list(path.relative(fixture.path, aliasedChild)), [
    node(fixture.path, path.join(aliasedChild, "note.md"), true),
  ])
  expect(await fs.readFile(path.join(aliasedChild, "note.md"), "utf8")).toBe(bytes)
}, 90_000)

test("terminal links retain their names and one entry-based directory hint across receipts and lists", async () => {
  await using fixture = await project("ignore-terminal-links")
  await fs.mkdir(path.join(fixture.path, "target"))
  await fs.writeFile(path.join(fixture.path, "target", "note.md"), bytes)
  await fs.writeFile(path.join(fixture.path, ".gitignore"), "/target/\n/moved-terminal/\n")
  await fs.symlink(
    path.join(fixture.path, "target"),
    path.join(fixture.path, "terminal-dir"),
    process.platform === "win32" ? "junction" : "dir",
  )
  await fs.symlink(path.join(fixture.path, "target", "note.md"), path.join(fixture.path, "terminal-file.md"), "file")
  await using http = await api(fixture.path)
  listed(await http.list(), [
    node(fixture.path, path.join(fixture.path, "terminal-dir"), false),
    node(fixture.path, path.join(fixture.path, "terminal-file.md"), false),
  ])
  expect(await http.request("PATCH", "/file/item", { path: "terminal-dir", newPath: "moved-terminal" })).toEqual({
    status: 200,
    body: {
      previousPath: "terminal-dir",
      path: "moved-terminal",
      node: node(fixture.path, path.join(fixture.path, "moved-terminal"), false),
    },
  })
  listed(await http.list(), [node(fixture.path, path.join(fixture.path, "moved-terminal"), false)])
  expect((await fs.lstat(path.join(fixture.path, "moved-terminal"))).isSymbolicLink()).toBe(true)
  expect(await fs.readFile(path.join(fixture.path, "terminal-file.md"), "utf8")).toBe(bytes)
}, 60_000)

test("permitted directory entries outside the worktree have explicitly inapplicable root rules", async () => {
  await using repository = await project("ignore-outside-repository")
  await using owner = await project("ignore-outside-directory")
  const directory = path.join(owner.path, "outside-scope")
  await fs.mkdir(directory)
  await fs.writeFile(
    path.join(directory, ".git"),
    `gitdir: ${path.join(repository.path, ".git").replaceAll("\\", "/")}\n`,
  )
  await git(repository.path, ["config", "core.worktree", repository.path])
  await fs.writeFile(path.join(repository.path, ".gitignore"), "/report.md\n/copied.md\n")
  await fs.writeFile(path.join(repository.path, "report.md"), "Worktree content\n")
  await fs.writeFile(path.join(directory, "report.md"), bytes)
  await using http = await api(directory)
  expect(http.scope).toMatchObject({ directory, worktree: repository.path })
  listed(await http.list(), [node(directory, path.join(directory, "report.md"), false)])
  expect(await http.request("POST", "/file/item/copy", { path: "report.md", newPath: "copied.md" })).toEqual({
    status: 200,
    body: {
      sourcePath: "report.md",
      path: "copied.md",
      node: node(directory, path.join(directory, "copied.md"), false),
    },
  })
  expect(await fs.readFile(path.join(directory, "copied.md"), "utf8")).toBe(bytes)
  listed(await http.list(path.relative(directory, repository.path)), [
    node(directory, path.join(repository.path, "report.md"), true),
  ])
}, 90_000)

test("linked checkout rules use the current sandbox while sharing their registered Project", async () => {
  await using fixture = await project("ignore-linked-checkout")
  const linked = path.join(fixture.path, "linked-checkout")
  await git(fixture.path, ["worktree", "add", "--detach", linked])
  await fs.writeFile(path.join(fixture.path, ".gitignore"), "/main-only.md\n")
  await fs.writeFile(path.join(linked, ".gitignore"), "/linked-only.md\n")
  for (const directory of [fixture.path, linked])
    for (const name of ["main-only.md", "linked-only.md"]) await fs.writeFile(path.join(directory, name), bytes)
  await using mainHttp = await api(fixture.path)
  await using linkedHttp = await api(linked)
  expect(linkedHttp.scope).toMatchObject({
    directory: linked,
    worktree: linked,
    projectWorktree: fixture.path,
    projectID: mainHttp.scope.projectID,
  })
  listed(await mainHttp.list(), [
    node(fixture.path, path.join(fixture.path, "main-only.md"), true),
    node(fixture.path, path.join(fixture.path, "linked-only.md"), false),
  ])
  listed(await linkedHttp.list(), [
    node(linked, path.join(linked, "main-only.md"), false),
    node(linked, path.join(linked, "linked-only.md"), true),
  ])
}, 90_000)

test("the worktree container has a neutral rule result within a permitted parent directory", async () => {
  await using fixture = await project("ignore-root-container")
  const checkout = path.join(fixture.path, "checkout")
  await fs.mkdir(checkout)
  await git(fixture.path, ["config", "core.worktree", checkout])
  await fs.writeFile(path.join(checkout, ".gitignore"), "/checkout/\n")
  await using http = await api(fixture.path)
  expect(http.scope).toMatchObject({ directory: fixture.path, worktree: checkout })
  listed(await http.list(), [node(fixture.path, checkout, false, "directory")])
}, 60_000)

test("a junction worktree container keeps its neutral rule result when listing its physical parent", async () => {
  await using fixture = await project("ignore-junction-root-container")
  await fs.writeFile(path.join(fixture.path, ".gitignore"), "/checkout-alias\n")
  await using checkout = await alias(fixture.path, path.join(fixture.path, "checkout-alias"))
  await using http = await api(checkout.path)
  expect(http.scope).toMatchObject({ directory: checkout.path, worktree: checkout.path })
  listed(await http.list(".."), [node(checkout.path, checkout.path, false)])
}, 60_000)

test("actual rule-read errors retain the public HTTP error and authored file bytes", async () => {
  await using fixture = await project("ignore-read-failure")
  await fs.writeFile(path.join(fixture.path, "note.md"), bytes)
  await using http = await api(fixture.path)
  const rules = path.join(fixture.path, ".gitignore")
  await fs.unlink(rules)
  await fs.mkdir(rules)
  expect(await http.list()).toEqual({
    status: 500,
    body: { name: "UnknownError", data: { message: publicUnknownErrorMessage() } },
  })
  expect(await fs.readFile(path.join(fixture.path, "note.md"), "utf8")).toBe(bytes)
}, 60_000)
