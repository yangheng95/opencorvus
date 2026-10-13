import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { Instance } from "../src/project/instance"
import { FileRoutes } from "../src/server/routes/file"
import { serverErrorResponse } from "../src/server/error-handler"
import { hostGit } from "../src/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

type Action = "copy" | "move" | "delete"
const actions: Action[] = ["copy", "move", "delete"]
const marker = "Owned root mutation contract — 资料\n"

async function ownedProject(seed: string) {
  const project = await memoryProject(seed)
  const owner = await fs.realpath(process.env.OPENCORVUS_TEST_PROCESS_ROOT!)
  const relative = path.relative(owner, project.path)
  if (path.isAbsolute(relative) || !relative.startsWith(`fixtures${path.sep}memory-`)) {
    throw new Error("Root mutation tests require a newly owned managed fixture")
  }
  expect(await fs.readFile(path.join(project.path, ".opencorvus-test-project-identity"), "utf8")).toBe(seed)
  await fs.writeFile(path.join(project.path, "root-marker.md"), marker)
  await fs.mkdir(path.join(project.path, "folder"))
  return project
}

async function rootIdentity(directory: string) {
  const stat = await fs.stat(directory, { bigint: true })
  return { directory: stat.isDirectory(), device: String(stat.dev), inode: String(stat.ino) }
}

async function retainedRoot(directory: string, identity: Awaited<ReturnType<typeof rootIdentity>>) {
  expect(await rootIdentity(directory)).toEqual(identity)
  expect(await fs.readFile(path.join(directory, "root-marker.md"), "utf8")).toBe(marker)
}

async function linkNode(target: string, link: string) {
  await fs.symlink(target, link, process.platform === "win32" ? "junction" : "dir")
  return {
    path: link,
    async [Symbol.asyncDispose]() {
      await fs.unlink(link)
    },
  }
}

async function api(directory: string) {
  const scope = await Instance.provide({
    directory,
    fn: async () => ({ directory: Instance.directory, worktree: Instance.worktree }),
  })
  const app = new Hono().onError(serverErrorResponse).route("/", FileRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => Instance.provide({ directory, fn: () => app.fetch(request) }),
  })
  return {
    scope,
    async mutate(action: Action, source: string, target = "root-result") {
      const route =
        action === "delete"
          ? `/file/item?${new URLSearchParams({ path: source })}`
          : action === "copy"
            ? "/file/item/copy"
            : "/file/item"
      const response = await fetch(new URL(route, server.url), {
        method: action === "delete" ? "DELETE" : action === "copy" ? "POST" : "PATCH",
        ...(action === "delete"
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ path: source, newPath: target }),
            }),
        signal: AbortSignal.timeout(20_000),
      })
      const result = { status: response.status, body: await response.json() }
      console.log("[root mutation HTTP]", JSON.stringify({ scope, action, source, target, result }))
      return result
    },
    async [Symbol.asyncDispose]() {
      await server.stop(true)
    },
  }
}

function rootError(action: Action, source: string) {
  return {
    status: 400,
    body: {
      name: "FileInvalidPathError",
      data: { path: source, message: `Cannot ${action} the project root from the file browser` },
    },
  }
}

async function scopedDirectory(root: string) {
  const directory = path.join(root, "scoped-project")
  await fs.mkdir(directory)
  await fs.writeFile(path.join(directory, ".git"), `gitdir: ${path.join(root, ".git").replaceAll("\\", "/")}\n`)
  const result = await hostGit(["config", "core.worktree", root], { cwd: root })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return directory
}

test.each(actions)(
  "%s maps all directory-root aliases to the exact root error and retained physical root",
  async (action) => {
    for (const [index, source] of ["", ".", "./", "folder/..", "missing/.."].entries()) {
      await using project = await ownedProject(`root-contract-${action}-${index}`)
      const identity = await rootIdentity(project.path)
      await using http = await api(project.path)
      expect(http.scope).toEqual({ directory: project.path, worktree: project.path })
      expect(await http.mutate(action, source)).toEqual(rootError(action, source))
      await retainedRoot(project.path, identity)
    }
  },
  120_000,
)

test.each(actions)(
  "%s protects the distinct worktree and directory roots within a child scope",
  async (action) => {
    for (const [index, source] of ["..", "../folder/..", "."].entries()) {
      await using project = await ownedProject(`worktree-root-${action}-${index}`)
      const directory = await scopedDirectory(project.path)
      const identity = await rootIdentity(project.path)
      const directoryIdentity = await rootIdentity(directory)
      await using http = await api(directory)
      expect(http.scope).toEqual({ directory, worktree: project.path })
      expect(await http.mutate(action, source)).toEqual(rootError(action, source))
      await retainedRoot(project.path, identity)
      expect(await rootIdentity(directory)).toEqual(directoryIdentity)
    }
  },
  90_000,
)

test.each(actions)(
  "%s protects both authority roots reached through an ancestor link",
  async (action) => {
    for (const scope of ["project", "directory", "worktree"]) {
      await using project = await ownedProject(`ancestor-root-${action}-${scope}`)
      const identity = await rootIdentity(project.path)
      const directory = scope === "project" ? project.path : await scopedDirectory(project.path)
      const directoryIdentity = await rootIdentity(directory)
      const physicalRoot = scope === "directory" ? directory : project.path
      await using ancestor = await linkNode(path.dirname(project.path), `${project.path}-ancestor`)
      const throughAncestor = path.join(
        ancestor.path,
        path.basename(project.path),
        scope === "directory" ? "scoped-project" : "",
      )
      const source = path.relative(directory, throughAncestor)
      const full = path.join(directory, source)
      expect((await fs.lstat(full)).isDirectory()).toBe(true)
      expect(await fs.realpath(full)).toBe(physicalRoot)
      await using http = await api(directory)
      expect(http.scope).toEqual({ directory, worktree: project.path })
      expect(await http.mutate(action, source)).toEqual(rootError(action, source))
      await retainedRoot(project.path, identity)
      expect(await rootIdentity(directory)).toEqual(directoryIdentity)
    }
  },
  120_000,
)

test.each(actions)(
  "%s protects a lexical scope root when the scope itself is a link",
  async (action) => {
    await using project = await ownedProject(`linked-scope-root-${action}`)
    const identity = await rootIdentity(project.path)
    await using scopeLink = await linkNode(project.path, `${project.path}-scope`)
    await using http = await api(scopeLink.path)
    expect(http.scope.directory).toBe(scopeLink.path)
    expect(await fs.realpath(http.scope.worktree)).toBe(project.path)
    const source = "folder/.."
    expect(await http.mutate(action, source)).toEqual(rootError(action, source))
    await retainedRoot(project.path, identity)
  },
  60_000,
)

test.each(["move", "delete"] as const)(
  "%s preserves independent terminal links and the host's trailing-separator entry semantics",
  async (action) => {
    for (const suffix of ["", "/"]) {
      await using project = await ownedProject(`terminal-link-${action}-${suffix.length}`)
      const identity = await rootIdentity(project.path)
      await fs.symlink(
        project.path,
        path.join(project.path, "root-link"),
        process.platform === "win32" ? "junction" : "dir",
      )
      const source = `root-link${suffix}`
      const full = path.join(project.path, source)
      const stat = await fs.lstat(full)
      console.log(
        "[terminal link entry]",
        JSON.stringify({
          full,
          directory: stat.isDirectory(),
          symlink: stat.isSymbolicLink(),
          physical: await fs.realpath(full),
        }),
      )
      await using http = await api(project.path)
      const result = await http.mutate(action, source, "changed-link")
      if (stat.isSymbolicLink()) {
        expect(result).toEqual(
          action === "delete"
            ? { status: 200, body: { path: source } }
            : {
                status: 200,
                body: {
                  previousPath: source,
                  path: "changed-link",
                  node: {
                    name: "changed-link",
                    path: "changed-link",
                    absolute: path.join(project.path, "changed-link"),
                    type: "file",
                    ignored: false,
                  },
                },
              },
        )
        if (action === "move") {
          expect((await fs.lstat(path.join(project.path, "changed-link"))).isSymbolicLink()).toBe(true)
          expect(await fs.realpath(path.join(project.path, "changed-link"))).toBe(project.path)
        }
      } else {
        expect(result).toEqual(rootError(action, source))
      }
      await retainedRoot(project.path, identity)
    }
  },
  90_000,
)

test("ordinary child files publish exact copy, move and delete receipts through root-directory destinations", async () => {
  await using project = await ownedProject("ordinary-root-destination")
  const identity = await rootIdentity(project.path)
  const content = "Child note 资料\n"
  await fs.writeFile(path.join(project.path, "folder", "note.md"), content)
  await using http = await api(project.path)
  for (const [action, target, name] of [
    ["copy", "./copy.md", "copy.md"],
    ["move", "folder/../moved.md", "moved.md"],
  ] as const) {
    const source = "folder/note.md"
    expect(await http.mutate(action, source, target)).toEqual({
      status: 200,
      body: {
        ...(action === "copy" ? { sourcePath: source } : { previousPath: source }),
        path: target,
        node: { name, path: name, absolute: path.join(project.path, name), type: "file", ignored: false },
      },
    })
    expect(await fs.readFile(path.join(project.path, name), "utf8")).toBe(content)
    await retainedRoot(project.path, identity)
  }
  expect(await http.mutate("delete", "./moved.md")).toEqual({ status: 200, body: { path: "./moved.md" } })
  expect(await fs.readFile(path.join(project.path, "copy.md"), "utf8")).toBe(content)
  await retainedRoot(project.path, identity)
}, 60_000)

test.each(actions)(
  "%s retains raw-empty, absolute, null-byte, permission and missing-source error contracts",
  async (action) => {
    await using project = await ownedProject(`source-path-contract-${action}`)
    const identity = await rootIdentity(project.path)
    await using http = await api(project.path)
    expect(await http.mutate(action, "", "")).toEqual(rootError(action, ""))
    for (const [source, message] of [
      [project.path, `File path must be project-relative: ${project.path}`],
      ["folder/\0note.md", "File path contains a null byte: folder/\0note.md"],
      ["../outside-owned-project.md", "Access denied: path escapes project directory"],
    ]) {
      expect(await http.mutate(action, source!)).toEqual({
        status: 400,
        body: { name: "FileInvalidPathError", data: { path: source, message } },
      })
      await retainedRoot(project.path, identity)
    }
    expect(await http.mutate(action, "missing.md")).toEqual({
      status: 404,
      body: { name: "FileNotFoundError", data: { path: "missing.md", message: "File entry not found: missing.md" } },
    })
    await retainedRoot(project.path, identity)
  },
  60_000,
)
