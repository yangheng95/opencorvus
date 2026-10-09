import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { validateConfigCandidate } from "@/config/candidate-validation"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await ExpertSquadRegistry.invalidateAvailable()
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

function errorFact(error: unknown, depth = 0): unknown {
  if (!error || typeof error !== "object") return { name: typeof error }
  const record = error as { name?: unknown; message?: unknown; code?: unknown; errno?: unknown; syscall?: unknown; path?: unknown; cause?: unknown; data?: unknown }
  return {
    name: record.name, message: typeof record.message === "string" ? record.message.slice(0, 4096) : null,
    code: record.code ?? null, errno: record.errno ?? null, syscall: record.syscall ?? null, path: record.path ?? null,
    cause: depth < 3 && record.cause ? errorFact(record.cause, depth + 1) : null,
  }
}
async function observe<T>(action: () => Promise<T>) {
  try { return { kind: "value" as const, value: await action() } }
  catch (error) { return { kind: "error" as const, error: errorFact(error) } }
}
const profile = "reader-provenance97"
const definition: ExpertSquadPackageDefinition = {
  manifest: { schema_version: 2, namespace: "reader97", id: profile, label: "Reader provenance", description: "Owned physical reader measurement", version: "2026.10.07.1", product_pillars: ["code"], readme: "README.md", selector: { summary: "Reader measurement", selection_guidance: "Inspect the actual package", instructions: "selector.md" }, capability_sets: {}, capability_projection: { scheduler: { base_role: "orchestrator", capability_refs: [] }, agents: {}, virtual_workflows: {} } },
  files: { "README.md": "# Reader provenance97\n", "selector.md": "# Reader measurement\n" },
}

async function cold(directory: string) {
  await Instance.disposeAll()
  await ExpertSquadRegistry.invalidateAvailable()
  Server.resetProjectRoutesAppForTest()
  return observe(() => runOutsideInstanceContext(async () => {
    const response = await Server.App().request(`/session/status?directory=${encodeURIComponent(directory)}`, { headers: { "x-opencorvus-directory": directory } })
    return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json() }
  }))
}

test.skipIf(process.platform !== "win32")("actual exclusive README lock measures declaration, physical reader and candidate provenance then releases", async () => {
  await using project = await memoryProject("candidate-reader97")
  const sourceDirectory = path.join(project.path, "source")
  await writeExpertSquadPackage({ directory: sourceDirectory, definition })
  const setup = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const config = { ...await Config.get(), prompt_profile: { active: profile } }
    const receipt = await ExpertSquadPackageManager.importDirectory({ projectDirectory: project.path, sourceDirectory, installationScope: "project" })
    return { config, receipt, project: { ...Instance.project } }
  } })
  const root = setup.receipt.after.targetRoot
  const readme = path.join(root, "README.md")
  const file = ConfigPaths.projectFile(project.path)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(setup.config))
  await ExpertSquadRegistry.invalidateAvailable()
  const before = await ExpertSquadRegistry.loadPackage(root)
  const barriers = path.join(project.path, "lock-barriers")
  await fs.mkdir(barriers)
  const ready = path.join(barriers, "ready")
  const release = path.join(barriers, "release")
  const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'"
  const script = `$ErrorActionPreference='Stop'; $held=$null; try { $held=[IO.File]::Open(${quote(readme)},[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None); [IO.File]::WriteAllText(${quote(ready)},'ready'); Write-Output 'LOCK_READY'; $until=[DateTime]::UtcNow.AddSeconds(45); while(-not [IO.File]::Exists(${quote(release)})) { if([DateTime]::UtcNow -ge $until){throw 'Owned lock release deadline exceeded'}; Start-Sleep -Milliseconds 20 } } finally { if($held){$held.Dispose()}; Write-Output 'LOCK_RELEASED' }`
  const handle = await ProcessSupervisor.spawnHostCommand({ executable: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], cwd: project.path, env: process.env, owner: "candidate-reader97-exclusive-readme" })
  let stdout = "", stderr = ""
  handle.stdout?.setEncoding("utf8")
  handle.stderr?.setEncoding("utf8")
  handle.stdout?.on("data", chunk => { stdout += String(chunk) })
  handle.stderr?.on("data", chunk => { stderr += String(chunk) })
  let exited = false
  void handle.exited.then(() => { exited = true }, () => { exited = true })
  let locked: unknown
  let exitCode: number | undefined
  try {
    const deadline = Date.now() + 15000
    while (true) {
      const state = await fs.readFile(ready, "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error })
      if (state === "ready") break
      if (exited || Date.now() >= deadline) throw new Error("Owned README lock failed to establish readiness", { cause: { pid: handle.pid, stdout, stderr } })
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    await ExpertSquadRegistry.invalidateAvailable()
    const declaration = await observe(() => ExpertSquadRegistry.discoverAvailable(project.path))
    const direct = await observe(() => ExpertSquadRegistry.loadPackage(root))
    const resolver = await observe(() => PromptProfileResolver.assertKnownProfileID({ projectDirectory: project.path, profileID: profile, config: setup.config }))
    const candidate = await Instance.provideProjectIdentity({ directory: project.path, fn: () => observe(() => validateConfigCandidate({ config: setup.config, root: "config", projectDirectory: project.path, projectOwnedCapabilities: true })) })
    const http = await cold(project.path)
    locked = { declaration, direct, resolver, candidate, http }
    console.log("reader97 locked", JSON.stringify({ sourceDirectory, definition, setup, root, readme, file, owner: { pid: handle.pid, ready, release }, before: { id: before.id, namespace: before.namespace, version: before.version }, locked }))
    if (declaration.kind === "value") {
      expect(declaration.value.items.map(item => ({ id: item.id, namespace: item.namespace, root: item.root }))).toEqual([{ id: profile, namespace: "reader97", root }])
    } else throw new Error("Locked README declaration eligibility is unqualified", { cause: declaration.error })
    if (direct.kind === "error") {
      const physical = direct.error as { name?: unknown; code?: unknown; syscall?: unknown; path?: unknown }
      expect({ name: physical.name, codeType: typeof physical.code, syscallType: typeof physical.syscall, path: physical.path }).toEqual({ name: "Error", codeType: "string", syscallType: "string", path: readme })
      expect(candidate).toMatchObject({ kind: "error", error: { name: "ConfigCandidateValidationError" } })
    } else {
      console.log("reader97 qualification", JSON.stringify({ kind: "exclusive_lock_did_not_produce_read_error", pid: handle.pid }))
      expect({ id: direct.value.id, namespace: direct.value.namespace }).toEqual({ id: profile, namespace: "reader97" })
    }
  } finally {
    await fs.writeFile(release, "release")
    const deadline = Date.now() + 5000
    while (!exited && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
    if (!exited) await ProcessSupervisor.terminateAndWaitForExit(handle, "Reader97 lock cleanup")
    exitCode = await handle.exited
    await handle.outputSettled
    await handle.settled
    await handle.dispose()
    console.log("reader97 physical", JSON.stringify({ pid: handle.pid, exitCode, terminal: await handle.terminalFact, stdout, stderr }))
  }
  await ExpertSquadRegistry.invalidateAvailable()
  const recovered = await ExpertSquadRegistry.loadPackage(root)
  const recoveredCandidate = await Instance.provideProjectIdentity({ directory: project.path, fn: () => observe(() => validateConfigCandidate({ config: setup.config, root: "config", projectDirectory: project.path, projectOwnedCapabilities: true })) })
  const recoveredHTTP = await cold(project.path)
  console.log("reader97 recovered", JSON.stringify({ identity: { id: recovered.id, namespace: recovered.namespace, version: recovered.version }, recoveredCandidate, recoveredHTTP, locked }))
  expect(exitCode).toBe(0)
  expect({ id: recovered.id, namespace: recovered.namespace, version: recovered.version }).toEqual({ id: profile, namespace: "reader97", version: "2026.10.07.1" })
  expect(recoveredCandidate).toEqual({ kind: "value", value: undefined })
  expect(recoveredHTTP).toMatchObject({ kind: "value", value: { status: 200, body: {} } })
}, 90000)

test("genuine malformed owned builtin declaration retains current semantic candidate response", async () => {
  await using project = await memoryProject("candidate-reader97-semantic")
  const config = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
  const root = path.join(project.path, ".opencorvus", "expert-squads", "reader97", "base")
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, "expert-squad.jsonc"), "{}")
  await fs.writeFile(ConfigPaths.projectFile(project.path), JSON.stringify({ ...config, prompt_profile: { active: "base" } }))
  const result = await cold(project.path)
  console.log("reader97 semantic", JSON.stringify({ project: project.path, root, config, result }))
  expect(result).toMatchObject({ kind: "value", value: { status: 400, body: { name: "ConfigCandidateValidationError", data: { message: 'External expert squad package id "base" collides with a built-in expert squad id.' } } } })
})
