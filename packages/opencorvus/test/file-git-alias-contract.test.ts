import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { FileRoutes } from "../src/server/routes/file"
import { serverErrorResponse, publicUnknownErrorMessage } from "../src/server/error-handler"
import { hostGit } from "../src/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory, timeoutProfile: "default" })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || `git exited ${result.exitCode}`)
  return result.text()
}

async function reader(directory: string) {
  await Instance.provide({ directory, fn: async () => undefined })
  const app = new Hono().onError(serverErrorResponse).route("/", FileRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => Instance.provide({ directory, fn: () => app.fetch(request) }),
  })
  return {
    async read(file: string) {
      const response = await fetch(new URL(`/file/content?${new URLSearchParams({ path: file })}`, server.url), {
        signal: AbortSignal.timeout(15_000),
      })
      return {
        status: response.status,
        body: await response.json(),
        requestID: response.headers.get("x-opencorvus-request-id"),
      }
    },
    async [Symbol.asyncDispose]() {
      await server.stop(true)
    },
  }
}

function replacementPatch(file: string, next: string) {
  return {
    oldFileName: file,
    newFileName: file,
    oldHeader: "old",
    newHeader: "new",
    hunks: [
      { oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: ["-original-first", `+${next}`, " common-second"] },
    ],
  }
}

function addedPatch(file: string, first: string) {
  return {
    oldFileName: file,
    newFileName: file,
    oldHeader: "old",
    newHeader: "new",
    hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 2, lines: [`+${first}`, "+common-second"] }],
  }
}

test("real Git HTTP reads share dot-alias content and physical revision with exact staged and unstaged hunks", async () => {
  await using project = await memoryProject("file-git-dot-aliases")
  const files = [
    "README.md",
    "资料/ Source note.md",
    ...(process.platform === "win32" ? [] : ["资料/file\\name.md \n"]),
  ]
  await fs.mkdir(path.join(project.path, "folder"))
  await fs.mkdir(path.join(project.path, "资料"))
  for (const file of files) await fs.writeFile(path.join(project.path, file), "original-first\ncommon-second\n")
  console.info("file-git-alias-fixture", JSON.stringify({ phase: "written", names: await fs.readdir(path.join(project.path, "资料")) }))
  await git(project.path, ["--literal-pathspecs", "add", "--", ...files])
  await git(project.path, ["commit", "-m", "exact text baselines"])
  console.info("file-git-alias-fixture", JSON.stringify({ phase: "committed", names: await fs.readdir(path.join(project.path, "资料")), index: await git(project.path, ["ls-files", "-z"]) }))
  await using http = await reader(project.path)
  console.info("file-git-alias-fixture", JSON.stringify({ phase: "opened", names: await fs.readdir(path.join(project.path, "资料")) }))
  for (const wave of ["staged-first", "unstaged-first"]) {
    for (const file of files) await fs.writeFile(path.join(project.path, file), `${wave}\ncommon-second\n`)
    if (wave === "staged-first") await git(project.path, ["--literal-pathspecs", "add", "--", ...files])
    for (const file of files) {
      const full = path.join(project.path, file)
      const physical = await fs.realpath(full).catch(async error => {
        console.info("file-git-alias-physical-failure", JSON.stringify({
          file, full, names: await fs.readdir(path.dirname(full)),
          stat: await fs.lstat(full).then(info => ({ size: info.size, file: info.isFile() }), error => ({ code: error.code })),
          content: await fs.readFile(full, "utf8").catch(error => ({ code: error.code })),
        }))
        throw error
      })
      expect(physical).toBe(full)
      expect(await fs.readFile(physical, "utf8")).toBe(`${wave}\ncommon-second\n`)
      const direct = await Instance.provide({ directory: project.path, fn: () => File.read(file) })
      expect(direct).toEqual(expect.objectContaining({
        type: "text", content: `${wave}\ncommon-second\n`, revision: expect.any(String),
      }))
      const loaded = await http.read(file)
      expect(loaded).toMatchObject({
        status: 200,
        body: { type: "text", content: `${wave}\ncommon-second\n`, revision: expect.any(String) },
      })
      for (const alias of [file, `./${file}`, `folder/../${file}`, `missing/../${file}`]) {
        const result = await http.read(alias)
        expect({
          status: result.status,
          type: result.body.type,
          content: result.body.content,
          revision: result.body.revision,
        }).toEqual({
          status: 200,
          type: "text",
          content: `${wave}\ncommon-second\n`,
          revision: loaded.body.revision,
        })
        expect(result.body.patch).toEqual(replacementPatch(alias, wave))
      }
      expect(await fs.readFile(path.join(project.path, file), "utf8")).toBe(`${wave}\ncommon-second\n`)
    }
  }
}, 120_000)

test("literal Git file identity projects the exact bracket filename while its matching sibling changes", async () => {
  await using project = await memoryProject("file-git-literal-path")
  const file = "note[1].md"
  const sibling = "note1.md"
  const original = "original-first\ncommon-second\n"
  for (const name of [file, sibling]) await fs.writeFile(path.join(project.path, name), original)
  await git(project.path, ["--literal-pathspecs", "add", "--", file, sibling])
  await git(project.path, ["commit", "-m", "literal file identities"])
  await fs.writeFile(path.join(project.path, sibling), "sibling-first\ncommon-second\n")
  await using http = await reader(project.path)
  expect(await http.read(file)).toMatchObject({
    status: 200,
    body: { type: "text", content: original, revision: expect.any(String) },
  })
  const direct = await Instance.provide({ directory: project.path, fn: () => File.read(file) })
  expect(direct).toEqual({ type: "text", content: original, revision: expect.any(String) })
  await fs.writeFile(path.join(project.path, file), "literal-first\ncommon-second\n")
  expect((await http.read(file)).body.patch).toEqual(replacementPatch(file, "literal-first"))
}, 60_000)

test("staged additions have a proven empty HEAD path baseline including the first commit", async () => {
  await using project = await memoryProject("file-git-addition")
  const first = path.join(project.path, "first-repository")
  await fs.mkdir(first)
  await git(first, ["init"])
  for (const directory of [project.path, first]) {
    const file = " New 资料.md"
    await fs.writeFile(path.join(directory, file), "added-first\ncommon-second\n")
    await git(directory, ["--literal-pathspecs", "add", "--", file])
    await using http = await reader(directory)
    const result = await http.read(`./${file}`)
    expect(result).toMatchObject({
      status: 200,
      body: { type: "text", content: "added-first\ncommon-second\n", revision: expect.any(String) },
    })
    expect(result.body.patch).toEqual(addedPatch(`./${file}`, "added-first"))
  }
}, 60_000)

test("renamed files retain their current HEAD path baseline through the exact single-file status query", async () => {
  await using project = await memoryProject("file-git-rename")
  const original = "# branch.oid (initial).md"
  const renamed = "资料/ Renamed note.md"
  await fs.mkdir(path.join(project.path, "资料"))
  await fs.writeFile(path.join(project.path, original), "original-first\ncommon-second\n")
  await git(project.path, ["--literal-pathspecs", "add", "--", original])
  await git(project.path, ["commit", "-m", "rename source"])
  await git(project.path, ["--literal-pathspecs", "mv", "--", original, renamed])
  await fs.writeFile(path.join(project.path, renamed), "renamed-first\ncommon-second\n")
  const state = await git(project.path, [
    "--literal-pathspecs",
    "status",
    "--porcelain=v2",
    "--branch",
    "-z",
    "--untracked-files=no",
    "--",
    renamed,
  ])
  console.log("[file Git rename records]", JSON.stringify(state.split("\0")))
  await using http = await reader(project.path)
  const result = await http.read(`./${renamed}`)
  expect(result).toMatchObject({
    status: 200,
    body: { type: "text", content: "renamed-first\ncommon-second\n", revision: expect.any(String) },
  })
  expect(result.body.patch).toEqual(addedPatch(`./${renamed}`, "renamed-first"))
}, 60_000)

test("replacing a HEAD directory with a text file returns its proven new-file hunk", async () => {
  await using project = await memoryProject("file-git-directory-transition")
  const file = "section"
  await fs.mkdir(path.join(project.path, file))
  await fs.writeFile(path.join(project.path, file, "note.md"), "old directory child\n")
  await git(project.path, ["add", "--", file])
  await git(project.path, ["commit", "-m", "directory before file"])
  await fs.rename(path.join(project.path, file), path.join(project.path, "retired-section"))
  await fs.writeFile(path.join(project.path, file), "new-file-first\ncommon-second\n")
  await git(project.path, ["add", "--all", "--", file])
  const state = await git(project.path, [
    "--literal-pathspecs",
    "status",
    "--porcelain=v2",
    "--branch",
    "-z",
    "--untracked-files=no",
    "--",
    file,
  ])
  const tree = await git(project.path, ["--literal-pathspecs", "ls-tree", "-z", "--full-tree", "HEAD", "--", file])
  console.log("[file Git directory transition]", JSON.stringify({ records: state.split("\0"), tree: tree.split("\0") }))
  await using http = await reader(project.path)
  const result = await http.read(file)
  expect(result).toMatchObject({
    status: 200,
    body: { type: "text", content: "new-file-first\ncommon-second\n", revision: expect.any(String) },
  })
  expect(result.body.patch).toEqual(addedPatch(file, "new-file-first"))
}, 60_000)

test("replacing a real HEAD gitlink with a text file returns its proven new-file hunk", async () => {
  await using project = await memoryProject("file-git-gitlink-transition")
  const file = "linked-project"
  const linked = path.join(project.path, file)
  await fs.mkdir(linked)
  await git(linked, ["init"])
  await git(linked, ["config", "user.name", "OpenCorvus Test"])
  await git(linked, ["config", "user.email", "opencorvus-test@example.invalid"])
  await fs.writeFile(path.join(linked, "README.md"), "linked project\n")
  await git(linked, ["add", "--", "README.md"])
  await git(linked, ["commit", "-m", "local gitlink commit"])
  await git(project.path, ["add", "--", file])
  await git(project.path, ["commit", "-m", "gitlink before file"])
  await fs.rename(linked, path.join(project.path, "retired-linked-project"))
  await fs.writeFile(linked, "new-link-file-first\ncommon-second\n")
  await git(project.path, ["rm", "--cached", "--", file])
  await git(project.path, ["add", "--", file])
  const tree = await git(project.path, ["--literal-pathspecs", "ls-tree", "-z", "--full-tree", "HEAD", "--", file])
  console.log("[file Git gitlink transition]", JSON.stringify({ tree: tree.split("\0") }))
  await using http = await reader(project.path)
  const result = await http.read(file)
  expect(result).toMatchObject({
    status: 200,
    body: { type: "text", content: "new-link-file-first\ncommon-second\n", revision: expect.any(String) },
  })
  expect(result.body.patch).toEqual(addedPatch(file, "new-link-file-first"))
}, 60_000)

test("a missing Git baseline blob returns the existing HTTP error contract with its authored bytes intact", async () => {
  await using project = await memoryProject("file-git-blob-error")
  const file = "README.md"
  await fs.writeFile(path.join(project.path, file), "original-first\ncommon-second\n")
  await git(project.path, ["add", "--", file])
  await git(project.path, ["commit", "-m", "baseline blob before failure"])
  const object = (await git(project.path, ["rev-parse", `HEAD:${file}`])).trim()
  await using http = await reader(project.path)
  await fs.unlink(path.join(project.path, ".git", "objects", object.slice(0, 2), object.slice(2)))
  const content = "authored-first\ncommon-second\n"
  await fs.writeFile(path.join(project.path, file), content)
  const result = await http.read(file)
  expect(result).toEqual({
    status: 500,
    body: { name: "UnknownError", data: { message: publicUnknownErrorMessage() } },
    requestID: expect.any(String),
  })
  expect(await fs.readFile(path.join(project.path, file), "utf8")).toBe(content)
}, 60_000)

test("a real Git index read failure returns the existing HTTP error contract with its file bytes intact", async () => {
  await using project = await memoryProject("file-git-read-error")
  const file = "README.md"
  const content = "original-first\ncommon-second\n"
  await fs.writeFile(path.join(project.path, file), content)
  await git(project.path, ["add", "--", file])
  await git(project.path, ["commit", "-m", "file before Git failure"])
  await using http = await reader(project.path)
  await fs.writeFile(path.join(project.path, ".git", "index"), Buffer.from("broken-index"))
  const result = await http.read(file)
  expect(result).toEqual({
    status: 500,
    body: { name: "UnknownError", data: { message: publicUnknownErrorMessage() } },
    requestID: expect.any(String),
  })
  expect(await fs.readFile(path.join(project.path, file), "utf8")).toBe(content)
}, 60_000)
