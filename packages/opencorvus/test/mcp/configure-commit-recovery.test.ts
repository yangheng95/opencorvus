import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

afterEach(async () => {
  Config.TestHooks.beforeProjectRuntimeSettlement = undefined
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a real post-persist failure retains the committed definition and promotes its staged credential", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const name = "post-persist-recovery"
      const definition = {
        type: "remote" as const,
        transport: "streamable-http" as const,
        url: "https://audit.invalid/unreachable",
        oauth: false as const,
        credential: { type: "bearer" as const },
        enabled: false,
      }
      Config.TestHooks.beforeProjectRuntimeSettlement = async () => {
        throw new Error("owned post-persist interruption")
      }
      let failure: unknown
      try {
        await MCP.configure(name, definition, "AUDIT_SYNTHETIC_NOT_A_CREDENTIAL")
      } catch (error) {
        failure = error
      }
      Config.TestHooks.beforeProjectRuntimeSettlement = undefined
      const entry = await McpAuth.get(`${Instance.project.id}:${name}`)
      expect({
        name: failure instanceof Error ? failure.name : null,
        causes: failure instanceof AggregateError ? failure.errors.map((error) => error.message) : [],
        definition: (await Config.getProject()).mcp?.[name],
        credentialAvailable: !!entry?.staticCredential,
      }).toEqual({
        name: "ProjectConfigCommittedReconcileError",
        causes: ["owned post-persist interruption"],
        definition,
        credentialAvailable: true,
      })
    },
  })
}, 60000)

async function processCase() {
  const root = await fs.mkdtemp(path.join(Global.Path.temporary, "mcp-commit-process-"))
  const env = { ...process.env, OPENCORVUS_HOME: root }
  delete env.OPENCORVUS_TEST_HOME
  delete env.OPENCORVUS_TEST_PROCESS_ROOT
  const children: ReturnType<typeof Bun.spawn>[] = []
  const logs = new Map<ReturnType<typeof Bun.spawn>, { action: string; stdout: string; stderr: string }>()
  const deadlineMilliseconds = 60_000
  function spawn(action: string, directory = "-") {
    const stdout = path.join(root, `${children.length}-${action}.stdout.log`)
    const stderr = path.join(root, `${children.length}-${action}.stderr.log`)
    const child = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "../fixture/mcp-config-recovery-child.ts"), action, directory],
      { cwd: path.join(import.meta.dir, "../.."), env, stdout: Bun.file(stdout), stderr: Bun.file(stderr) },
    )
    children.push(child)
    logs.set(child, { action, stdout, stderr })
    return child
  }
  async function diagnostics() {
    return JSON.stringify(await Promise.all(children.map(async (child) => {
      const files = logs.get(child)!
      const tail = async (file: string) => fs.readFile(file, "utf8").then(
        (text) => text.slice(-8192), (error) => String(error),
      )
      return { action: files.action, pid: child.pid, exit: child.exitCode,
        stdout: await tail(files.stdout), stderr: await tail(files.stderr) }
    })))
  }
  async function output(child: ReturnType<typeof spawn>) {
    const timeout = Promise.withResolvers<"timeout">()
    const timer = setTimeout(() => timeout.resolve("timeout"), deadlineMilliseconds)
    const exit = await Promise.race([child.exited, timeout.promise]).finally(() => clearTimeout(timer))
    if (exit === "timeout") throw new Error(`MCP backend exit timed out: ${await diagnostics()}`)
    const files = logs.get(child)!
    const [stdout, stderr] = await Promise.all([fs.readFile(files.stdout, "utf8"), fs.readFile(files.stderr, "utf8")])
    return { exit, stderr, result: exit === 0 && stdout.trim() ? JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) : null }
  }
  async function wait(name: string) {
    const deadline = Date.now() + deadlineMilliseconds
    while (Date.now() < deadline) {
      try {
        await fs.stat(path.join(root, name))
        return
      } catch {}
      const failed = children.find((child) => child.exitCode !== null && child.exitCode !== 0)
      if (failed) {
        throw new Error(`MCP barrier ${name} lost its backend: ${await diagnostics()}`)
      }
      await Bun.sleep(10)
    }
    throw new Error(`MCP barrier timed out at ${name}: ${await diagnostics()}`)
  }
  async function close(passed: boolean) {
    for (const child of children) if (child.exitCode === null) child.kill()
    await Promise.all(children.map((child) => child.exited))
    if (passed) await removeManagedDirectoryTree(root)
  }
  const setup = await output(spawn("setup"))
  if (setup.exit !== 0) throw new Error(setup.stderr)
  return { root, spawn, output, wait, close, directory: setup.result.directory as string }
}

test("a successor process promotes the actual stage left after a committed configure exits", async () => {
  const p = await processCase()
  let passed = false
  try {
    expect((await p.output(p.spawn("exit", p.directory))).exit).toBe(23)
    const reopened = await p.output(p.spawn("inspect", p.directory))
    expect({
      exit: reopened.exit,
      available: reopened.result.available,
      matchesA: reopened.result.matchesA,
      type: reopened.result.definition.credential.type,
    }).toEqual({ exit: 0, available: true, matchesA: true, type: "bearer" })
    passed = true
  } finally {
    await p.close(passed)
  }
}, 120000)

test("two warm backend processes preserve each configure's complete credential effect", async () => {
  const p = await processCase()
  let passed = false
  try {
    const second = p.spawn("b", p.directory)
    await p.wait("b-ready")
    const first = p.spawn("a", p.directory)
    await p.wait("a-ready")
    await fs.writeFile(path.join(p.root, "b-start"), "start")
    await p.wait("b-attempt")
    await fs.writeFile(path.join(p.root, "a-release"), "resume")
    const [a, b] = await Promise.all([p.output(first), p.output(second)])
    expect({
      a: { exit: a.exit, available: a.result?.available, matchesA: a.result?.matchesA },
      b: { exit: b.exit, available: b.result?.available, matchesB: b.result?.matchesB },
    }).toEqual({ a: { exit: 0, available: true, matchesA: true }, b: { exit: 0, available: true, matchesB: true } })
    const successor = await p.output(p.spawn("inspect", p.directory))
    expect({
      available: successor.result.available,
      matchesB: successor.result.matchesB,
      credential: successor.result.definition.credential,
    }).toEqual({ available: true, matchesB: true, credential: { type: "header", name: "X-Audit-Only" } })
    passed = true
  } finally {
    await p.close(passed)
  }
}, 120000)
