import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { FileRoutes } from "../src/server/routes/file"
import { serverErrorResponse } from "../src/server/error-handler"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

async function populate(directory: string) {
  const files: string[] = []
  const directories: string[] = []
  for (let group = 11; group >= 0; group--) {
    const name = `group-${String(group).padStart(2, "0")}`
    directories.push(`${name}/`)
    await fs.mkdir(path.join(directory, name))
    for (let entry = 7; entry >= 0; entry--) {
      const file = path.join(name, `entry-${String(entry).padStart(2, "0")}.txt`)
      files.push(file)
      await fs.writeFile(path.join(directory, file), `${name}: ${entry}\n`)
    }
  }
  return { files: files.sort(), directories: directories.sort() }
}

test("publishes the canonical complete file index and directory identities", async () => {
  await using project = await memoryProject("file-search-index-order")
  const created = await populate(project.path)
  await Instance.provide({ directory: project.path, fn: async () => {
    const files = await File.search({ query: "", type: "file", limit: 200 })
    expect(files).toEqual([...files].sort())
    expect(files.filter((file) => file.startsWith("group-"))).toEqual(created.files)
    const directories = await File.search({ query: "", type: "directory", limit: 200 })
    expect(directories.filter((directory) => directory.startsWith("group-"))).toEqual(created.directories)
    expect(await File.search({ query: "group-03/entry-05.txt", type: "file", limit: 10 }))
      .toEqual([path.join("group-03", "entry-05.txt")])
  } })
})

test("returns the same fuzzy file and directory windows through scans and instance recreation", async () => {
  await using project = await memoryProject("file-search-window-order")
  const created = await populate(project.path)
  const windows = () => Instance.provide({ directory: project.path, fn: async () => ({
    files: await File.search({ query: "entry-", type: "file", limit: 10 }),
    directories: await File.search({ query: "group-", type: "directory", limit: 5 }),
    all: await File.search({ query: "group-", limit: 5 }),
  }) })
  const first = await windows()
  expect(first).toEqual({
    files: created.files.slice(0, 10),
    directories: created.directories.slice(0, 5),
    all: created.directories.slice(0, 5),
  })
  const expanded = await Instance.provide({ directory: project.path, fn: () => File.search({ query: "entry-", type: "file", limit: 11 }) })
  expect(expanded.slice(0, 10)).toEqual(first.files)
  for (let iteration = 0; iteration < 4; iteration++) expect(await windows()).toEqual(first)
  await Instance.disposeAll()
  expect(await windows()).toEqual(first)
})

async function api(directory: string) {
  const app = new Hono().onError(serverErrorResponse).route("/", FileRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => Instance.provide({ directory, fn: () => app.fetch(request) }),
  })
  return {
    async search(query: string) {
      const response = await fetch(new URL(`/find/file?${new URLSearchParams({ query, type: "file", limit: "10" })}`, server.url), {
        signal: AbortSignal.timeout(20_000),
      })
      expect(response.status).toBe(200)
      return response.json()
    },
    async [Symbol.asyncDispose]() { await server.stop(true) },
  }
}

test("serves each project's exact original file paths through the public search route", async () => {
  await using left = await memoryProject("file-search-left")
  await using right = await memoryProject("file-search-right")
  await fs.mkdir(path.join(left.path, "left"))
  await fs.mkdir(path.join(right.path, "right"))
  await fs.writeFile(path.join(left.path, "left", "entry.txt"), "left original\n")
  await fs.writeFile(path.join(right.path, "right", "entry.txt"), "right original\n")
  await using leftAPI = await api(left.path)
  await using rightAPI = await api(right.path)
  const expected = [[path.join("left", "entry.txt")], [path.join("right", "entry.txt")]]
  expect(await Promise.all([leftAPI.search("entry.txt"), rightAPI.search("entry.txt")])).toEqual(expected)
  expect(await Promise.all([leftAPI.search("left/entry.txt"), rightAPI.search("right/entry.txt")])).toEqual(expected)
})
