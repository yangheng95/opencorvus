import { afterEach, describe, expect, test } from "bun:test"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const temporaryDirectories: string[] = []
const children = new Set<ChildProcessWithoutNullStreams>()

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode !== null) continue
    child.stdin.end()
    await new Promise<void>((resolve) => child.once("exit", () => resolve()))
  }
  children.clear()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

function startBackend(home: string) {
  const fixture = path.join(import.meta.dir, "fixtures", "shared-database-backend-process.ts")
  const child = spawn(process.execPath, [fixture], {
    env: { ...process.env, OPENCORVUS_TEST_HOME: home, OPENCORVUS_HOME: path.join(home, "runtime") },
    stdio: ["pipe", "pipe", "pipe"],
  })
  children.add(child)
  return child
}

async function ready(child: ChildProcessWithoutNullStreams) {
  return new Promise<{
    status: string
    url: string
    port: number
    database: string
    schemaTables: number
    occurrenceID: string
  }>((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk) => (stderr += String(chunk)))
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.startsWith('{"status":"ready"')) continue
        resolve(JSON.parse(line))
        return
      }
    })
    child.once("error", reject)
    child.once("exit", (code) => reject(new Error(`backend exited ${code}: ${stderr}`)))
  })
}

async function command(
  child: ChildProcessWithoutNullStreams,
  input: { command: string; projectID?: string; directory?: string },
) {
  const id = crypto.randomUUID()
  return await new Promise<{ ok: boolean; name?: string; message?: string }>((resolve, reject) => {
    let buffered = ""
    const onData = (chunk: Buffer | string) => {
      buffered += String(chunk)
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("{")) continue
        const response = JSON.parse(line) as { status: string; id: string; ok: boolean; name?: string; message?: string }
        if (response.status !== "response" || response.id !== id) continue
        child.stdout.off("data", onData)
        resolve(response)
        return
      }
    }
    child.stdout.on("data", onData)
    child.once("error", reject)
    child.stdin.write(`${JSON.stringify({ id, ...input })}\n`)
  })
}

describe("shared SQLite backend startup", () => {
  test("keeps two independent backend processes healthy on one database", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-shared-database-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await mkdir(home)

    const first = startBackend(home)
    const firstReady = await ready(first)
    const second = startBackend(home)
    const secondReady = await ready(second)

    const [firstHealth, secondHealth] = await Promise.all([
      fetch(new URL("/global/health", firstReady.url)).then((response) => response.json()),
      fetch(new URL("/global/health", secondReady.url)).then((response) => response.json()),
    ]) as Array<{ healthy: boolean; paths: { database: string } }>

    expect({
      first: {
        port: firstReady.port,
        database: firstReady.database,
        schemaTables: firstReady.schemaTables,
        occurrenceID: firstReady.occurrenceID,
        health: firstHealth,
      },
      second: {
        port: secondReady.port,
        database: secondReady.database,
        schemaTables: secondReady.schemaTables,
        occurrenceID: secondReady.occurrenceID,
        health: secondHealth,
      },
    }).toEqual({
      first: {
        port: expect.any(Number),
        database: secondReady.database,
        schemaTables: expect.any(Number),
        occurrenceID: expect.any(String),
        health: { healthy: true, paths: expect.objectContaining({ database: firstReady.database }), version: expect.any(String) },
      },
      second: {
        port: expect.any(Number),
        database: firstReady.database,
        schemaTables: expect.any(Number),
        occurrenceID: expect.any(String),
        health: { healthy: true, paths: expect.objectContaining({ database: secondReady.database }), version: expect.any(String) },
      },
    })
    expect(firstReady.port).not.toBe(secondReady.port)
    expect(firstReady.schemaTables).toBeGreaterThan(0)
    expect(secondReady.schemaTables).toBe(firstReady.schemaTables)
    expect(firstReady.occurrenceID).not.toBe(secondReady.occurrenceID)

    const projectID = "prj_sharedfence"
    const directory = path.join(root, "project")
    expect(await command(first, { command: "seed-project", projectID, directory })).toEqual({
      status: "response",
      id: expect.any(String),
      ok: true,
    })
    expect(await command(first, { command: "close-project-admission", projectID })).toEqual({
      status: "response",
      id: expect.any(String),
      ok: true,
    })
    expect(await command(second, { command: "assert-project-admission", projectID })).toEqual({
      status: "response",
      id: expect.any(String),
      ok: false,
      name: "ProjectDurableAdmissionClosedError",
      message: expect.stringContaining(`Project ${projectID} durable admission is closed during deletion`),
    })
    expect(await command(first, { command: "release-project-admission" })).toEqual({
      status: "response",
      id: expect.any(String),
      ok: true,
    })
    expect(await command(second, { command: "assert-project-admission", projectID })).toEqual({
      status: "response",
      id: expect.any(String),
      ok: true,
    })

    await command(first, { command: "close-project-admission", projectID })
    first.stdin.write(`${JSON.stringify({ id: crypto.randomUUID(), command: "exit-without-release" })}\n`)
    await new Promise<void>((resolve) => first.once("exit", () => resolve()))
    const replacement = startBackend(home)
    await ready(replacement)
    expect(await command(second, { command: "assert-project-admission", projectID })).toEqual({
      status: "response",
      id: expect.any(String),
      ok: true,
    })
  }, 120_000)
})
