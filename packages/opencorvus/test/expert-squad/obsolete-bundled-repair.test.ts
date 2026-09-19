import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Global } from "../../src/global"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const source = payloadPackageSources.find((item) => item.id === "equity-research")!

async function writeInstallation(
  projectDirectory: string,
  scope: "project" | "global",
  schemaVersion: number,
  namespace = source.namespace,
  id = source.id,
) {
  const root = path.join(ExpertSquadPackageLocations.resolve(scope, projectDirectory).packagesRoot, namespace, id)
  for (const [name, content] of Object.entries(source.files)) {
    const file = path.join(root, ...name.split("/"))
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, ExpertSquadRegistry.embeddedPackageFileBytes(content))
  }
  const manifest = structuredClone(
    ExpertSquadRegistry.parseManifestText(
      ExpertSquadRegistry.embeddedPackageFileBytes(source.files[ExpertSquadRegistry.MANIFEST]!).toString("utf8"),
      "fixture",
    ),
  ) as Record<string, unknown>
  manifest.namespace = namespace
  manifest.id = id
  manifest.schema_version = schemaVersion
  if (schemaVersion !== 2) {
    manifest.version = "2026.08.05.1"
    delete manifest.capability_sets
    manifest.capability_projection = {
      scheduler: {
        base_role: "orchestrator",
        inherit_base_tools: true,
        built_in_tool_ids: ["read"],
        package_skill_refs: [],
      },
      agents: {},
    }
  }
  await fs.writeFile(path.join(root, ExpertSquadRegistry.MANIFEST), JSON.stringify(manifest, null, 2))
  await fs.appendFile(path.join(root, "README.md"), `\nOperator ${scope} customization.\n`)
  await ExpertSquadRegistry.invalidateAvailable()
  return {
    root,
    digest: await ExpertSquadRegistry.installedPackageDigest(root),
    readme: await fs.readFile(path.join(root, "README.md"), "utf8"),
  }
}

afterAll(async () => {
  await resetMemoryDatabase()
})

test("real repair HTTP replaces both obsolete scopes and preserves exact backup bytes and unrelated revisions", async () => {
  await using project = await memoryProject()
  const global = await writeInstallation(project.path, "global", 1)
  const local = await writeInstallation(project.path, "project", 1)
  const custom = await writeInstallation(project.path, "project", 1, "operator", "custom-equity")
  const future = await writeInstallation(project.path, "project", 3, "builtin", "cloud-platform-architecture")
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: Server.App().fetch, idleTimeout: 0 })
  const call = async (route: string, body?: unknown) => {
    const response = await fetch(`http://${server.hostname}:${server.port}/expert-squad/${route}`, {
      headers: { "x-opencorvus-directory": project.path, "content-type": "application/json" },
      ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    })
    return { status: response.status, body: (await response.json()) as any }
  }
  try {
    const market = await call("market?query=equity-research&availability=installed")
    expect(market.status).toBe(200)
    expect(market.body.entries.find((item: any) => item.id === source.id)).toMatchObject({
      installation_scopes: ["project", "global"],
    })
    const detail = await call(`market/detail?id=${source.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.installations).toEqual([
      {
        installation_scope: "project",
        installed_version: "2026.08.05.1",
        installed_package_digest: local.digest,
        update_available: true,
      },
      {
        installation_scope: "global",
        installed_version: "2026.08.05.1",
        installed_package_digest: global.digest,
        update_available: true,
      },
    ])
    const stale = await call("update", {
      id: source.id,
      source: "builtin",
      installationScope: "project",
      expectedCurrentPackageDigest: "a".repeat(64),
    })
    expect(stale).toMatchObject({
      status: 409,
      body: { name: "ExpertSquadPackageMutationConflictError", data: { actualCurrentPackageDigest: local.digest } },
    })
    const attempts = await Promise.all([call("repair-bundled", {}), call("repair-bundled", {})])
    const repaired = attempts.find((attempt) => attempt.body.repaired.length === 2)!
    expect(attempts.map((attempt) => ({ status: attempt.status, failures: attempt.body.failures.length }))).toEqual([
      { status: 200, failures: 0 },
      { status: 200, failures: 0 },
    ])
    expect(repaired.status).toBe(200)
    expect(
      repaired.body.repaired.map((receipt: any) => ({
        operation: receipt.operation,
        scope: receipt.after.installationScope,
        before: receipt.before.packageDigest,
      })),
    ).toEqual([
      { operation: "replaced", scope: "global", before: global.digest },
      { operation: "replaced", scope: "project", before: local.digest },
    ])
    for (const prior of [global, local]) {
      const installed = await ExpertSquadRegistry.loadPackage(prior.root)
      expect(installed.manifest.schema_version).toBe(2)
      expect(installed.packageDigest).toBe(detail.body.package_digest)
      expect(
        await fs.readFile(
          path.join(Global.Path.data, "expert-squad-package-revisions", "v1", prior.digest, "README.md"),
          "utf8",
        ),
      ).toBe(prior.readme)
    }
    for (const retained of [custom, future])
      expect(await ExpertSquadRegistry.installedPackageDigest(retained.root)).toBe(retained.digest)
    const repeat = await call("repair-bundled", {})
    expect({
      status: repeat.status,
      receipts: repeat.body.repaired.length,
      installed: (await ExpertSquadRegistry.loadPackage(local.root)).packageDigest,
    }).toEqual({
      status: 200,
      receipts: 0,
      installed: detail.body.package_digest,
    })
    const next = await call(`market/detail?id=${source.id}`)
    expect(next.body.installations.map((item: any) => item.installed_package_digest)).toEqual([
      detail.body.package_digest,
      detail.body.package_digest,
    ])
  } finally {
    server.stop(true)
    await Instance.disposeAll()
    await fs.rm(global.root, { recursive: true, force: true })
    await ExpertSquadRegistry.invalidateAvailable()
  }
}, 120_000)

test("current-schema bundled customizations remain the installed revision", async () => {
  await using project = await memoryProject()
  const prior = await writeInstallation(project.path, "project", 2)
  const result = await ExpertSquadPackageManager.repairObsoleteBundledPackages({ projectDirectory: project.path })
  expect({
    receipts: result.repaired.length,
    digest: await ExpertSquadRegistry.installedPackageDigest(prior.root),
  }).toEqual({ receipts: 0, digest: prior.digest })
})

test("repair returns an exact package failure while completing the healthy obsolete peer", async () => {
  await using project = await memoryProject()
  const damaged = await writeInstallation(project.path, "project", 1, "builtin", "cloud-platform-architecture")
  const retainedFile = path.join(damaged.root, "operator-canary.txt")
  await fs.writeFile(retainedFile, "Operator content requiring manual handling")
  const prior = await writeInstallation(project.path, "project", 1)
  const result = await ExpertSquadPackageManager.repairObsoleteBundledPackages({ projectDirectory: project.path })
  expect(result.repaired[0]).toMatchObject({
    operation: "replaced",
    before: { packageDigest: prior.digest },
    after: { id: source.id },
  })
  expect(result.failures).toEqual([
    {
      id: "cloud-platform-architecture",
      installationScope: "project",
      message: 'expert squad package root: unknown top-level entry "operator-canary.txt"',
    },
  ])
  expect(await fs.readFile(retainedFile, "utf8")).toBe("Operator content requiring manual handling")
})

for (const stage of ["before-install", "after-install"] as const) {
  test(`obsolete revision is restored by durable recovery after ${stage} interruption`, async () => {
    await using project = await memoryProject()
    const prior = await writeInstallation(project.path, "project", 1)
    const restore =
      stage === "before-install"
        ? ExpertSquadPackageManager.TestHooks.interruptAfterTargetMoveBeforeInstallOnce()
        : ExpertSquadPackageManager.TestHooks.interruptAfterTargetInstallBeforeBackupCleanupOnce()
    try {
      await expect(
        ExpertSquadPackageManager.updatePackage({
          projectDirectory: project.path,
          id: source.id,
          installationScope: "project",
          source: "builtin",
          expectedCurrentPackageDigest: prior.digest,
        }),
      ).rejects.toThrow("Injected abrupt expert squad package mutation termination")
    } finally {
      restore()
    }
    await ExpertSquadPackageManager.reconcilePendingPackageMutations(project.path)
    expect(await ExpertSquadRegistry.readInstalledPackageRevision(prior.root)).toMatchObject({
      packageDigest: prior.digest,
      schemaVersion: 1,
    })
    expect(await fs.readFile(path.join(prior.root, "README.md"), "utf8")).toBe(prior.readme)
    const retried = await ExpertSquadPackageManager.repairObsoleteBundledPackages({ projectDirectory: project.path })
    expect(retried.repaired[0]).toMatchObject({
      operation: "replaced",
      before: { packageDigest: prior.digest },
      after: { id: source.id },
    })
    expect((await ExpertSquadRegistry.loadPackage(prior.root)).manifest.schema_version).toBe(2)
  }, 120_000)
}
