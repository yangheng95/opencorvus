import { expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { memoryProject } from "../fixture/memory"
import { Server } from "../../src/server/server"
import { Instance } from "../../src/project/instance"
import { Config } from "../../src/config/config"
import { Session } from "../../src/session"

const suffix = (length: number) => `\n[truncated; original length: ${length} characters]`

test("obsolete manifests report the current schema and replacement action", () => {
  expect(() => ExpertSquadRegistry.parseManifestText('{"schema_version":1}', "obsolete")).toThrow(
    "Unsupported Expert Squad schema version 1; expected 2. Replace this installed package with its current version.",
  )
})

async function installBroken(root: string, id: string) {
  const directory = path.join(root, "diagnostic-test", id)
  await mkdir(directory, { recursive: true })
  const manifest = {
    namespace: "diagnostic-test",
    id,
    version: "2026.09.08.1",
    schema_version: 2,
    capability_projection: {
      scheduler: {},
      agents: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`worker-${i}`, {}])),
    },
  }
  const text = JSON.stringify(manifest)
  await writeFile(path.join(directory, ExpertSquadRegistry.MANIFEST), text)
  await writeFile(path.join(directory, "README.md"), "# Invalid declaration fixture\n")
  return { directory, text }
}

for (const scope of ["project", "global"] as const) {
  test(`${scope} discovery returns bounded package diagnostics and a usable built-in profile`, async () => {
    await using project = await memoryProject()
    const root = ExpertSquadPackageLocations.resolve(scope, project.path).packagesRoot
    try {
      const broken = await installBroken(root, "oversized")
      let original = ""
      try {
        await ExpertSquadRegistry.loadCatalogDeclaration(broken.directory)
      } catch (error) {
        original = (error as Error).message
      }
      expect(original.length).toBeGreaterThan(4096)
      const result =
        scope === "global"
          ? await ExpertSquadRegistry.discoverGlobalAvailable()
          : await ExpertSquadRegistry.discoverAvailable(project.path)
      const issue = result.issues.find((entry) => entry.id === "oversized")!
      const ending = suffix(original.length)
      expect(issue).toEqual({
        phase: "package.catalog",
        location: broken.directory,
        namespace: "diagnostic-test",
        id: "oversized",
        message: original.slice(0, 4096 - ending.length) + ending,
      })
      expect(ExpertSquadRegistry.DiscoveryIssue.parse(issue).message.length).toBe(4096)
      await expect(
        PromptProfileResolver.assertKnownProfileID({ projectDirectory: project.path, profileID: "oversized" }),
      ).rejects.toThrow(issue.message)
      await PromptProfileResolver.assertKnownProfileID({ projectDirectory: project.path, profileID: "base" })
      const catalog = await PromptProfileResolver.searchCatalog({ projectDirectory: project.path, limit: 20 })
      expect(catalog.entries.find((entry) => entry.id === "base")).toMatchObject({ id: "base", built_in: true })
    } finally {
      await ExpertSquadRegistry.invalidateAvailable()
      if (scope === "global") await removeManagedDirectoryTree(path.join(root, "diagnostic-test"))
    }
  }, 60_000)
}

test("discovery preserves short catalog errors and bounds malformed JSON identity errors", async () => {
  await using project = await memoryProject()
  const root = path.join(ExpertSquadPackageLocations.project(project.path).packagesRoot, "diagnostic-test")
  const short = path.join(root, "short")
  const malformed = path.join(root, "malformed")
  await mkdir(short, { recursive: true })
  await mkdir(malformed, { recursive: true })
  await writeFile(
    path.join(short, ExpertSquadRegistry.MANIFEST),
    JSON.stringify({ namespace: "diagnostic-test", id: "short" }),
  )
  await writeFile(path.join(malformed, ExpertSquadRegistry.MANIFEST), `[${",".repeat(1000)}]`)
  try {
    const result = await ExpertSquadRegistry.discoverAvailable(project.path)
    expect(result.issues.find((issue) => issue.id === "short")).toMatchObject({
      phase: "package.catalog",
      message: "expert squad package root: missing README.md",
    })
    const issue = result.issues.find((issue) => issue.id === "malformed")!
    expect(issue).toMatchObject({
      phase: "package.identity",
      location: path.join(malformed, ExpertSquadRegistry.MANIFEST),
    })
    expect(issue.message.length).toBe(4096)
    expect(issue.message).toMatch(/\[truncated; original length: \d+ characters\]$/)
    expect(ExpertSquadRegistry.DiscoveryIssue.parse(issue)).toEqual(issue)
  } finally {
    await ExpertSquadRegistry.invalidateAvailable()
  }
})

test("real project HTTP bootstrap serves VCS and skill mounts alongside an invalid package", async () => {
  await using project = await memoryProject()
  await installBroken(ExpertSquadPackageLocations.project(project.path).packagesRoot, "oversized")
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: Server.App().fetch, idleTimeout: 0 })
  try {
    const origin = `http://${server.hostname}:${server.port}`
    for (const route of ["/vcs", "/skill/mounts"]) {
      const response = await fetch(`${origin}${route}`, { headers: { "x-opencorvus-directory": project.path } })
      const body = await response.json()
      expect({ route, status: response.status, body }).toMatchObject({ route, status: 200 })
      if (route === "/vcs") expect(body).toMatchObject({ branch: expect.any(String) })
      else expect(body).toMatchObject({ active_profile: "dynamic", agents: expect.any(Array), skills: expect.any(Array) })
    }
  } finally {
    server.stop(true)
    await Instance.disposeAll()
    await ExpertSquadRegistry.invalidateAvailable()
  }
}, 60_000)

test("serves catalog inspection and skill assignment while a required project MCP connection is disabled", async () => {
  await using project = await memoryProject()
  const session = await Instance.provide({
    directory: project.path,
    async fn() {
      await Config.updateProjectPatch({ mcp: { browser: { enabled: false } } })
      return Session.create({ kind: "assistant", title: "Disabled Browser settings" })
    },
  })
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: Server.App().fetch, idleTimeout: 0 })
  const origin = `http://${server.hostname}:${server.port}`
  const headers = { "x-opencorvus-directory": project.path, "Content-Type": "application/json" }
  const agentID = "dynamic-builder"
  const skillRef = "default/skill/grill-me"
  try {
    const catalog = await fetch(`${origin}/expert-squad/catalog?sessionID=${session.id}`, { headers })
    expect(catalog.status).toBe(200)
    expect(await catalog.json()).toMatchObject({
      active: { effective: "dynamic" },
      scope: { kind: "session", sessionID: session.id },
      disabled_default_mcp_servers: ["browser"],
      active_agent_projection: {
        agents: expect.arrayContaining([expect.objectContaining({ agent_id: agentID })]),
      },
    })

    const mount = await fetch(`${origin}/skill/mount`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        scope: "project", expertSquadID: "dynamic", agentID, defaultSkillRef: skillRef, override: true,
      }),
    })
    expect(mount.status).toBe(200)
    expect(await mount.json()).toMatchObject({ scope: "project", disabled_default_mcp_servers: ["browser"] })

    const persisted = await fetch(`${origin}/skill/mounts?sessionID=${session.id}`, { headers })
    expect(persisted.status).toBe(200)
    expect(await persisted.json()).toMatchObject({
      scope: "session",
      disabled_default_mcp_servers: ["browser"],
      matrix: expect.arrayContaining([expect.objectContaining({
        agent_id: agentID,
        grants: expect.arrayContaining([expect.objectContaining({
          ref: skillRef, project_override: true, effective: true,
        })]),
      })]),
    })

    await Instance.provide({
      directory: project.path,
      async fn() {
        await expect(PromptProfileResolver.resolveSchedulerTurnProjection({
          projectDirectory: project.path, config: await Config.get(),
        })).rejects.toThrow("Active expert squad projects default MCP server default/mcp/browser, which configuration has disabled.")
      },
    })
  } finally {
    server.stop(true)
    await Instance.disposeAll()
  }
}, 60_000)
