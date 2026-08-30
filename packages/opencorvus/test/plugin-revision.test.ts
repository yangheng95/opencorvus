import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Plugin } from "../src/plugin"
import { Instance } from "../src/project/instance"

afterEach(async () => {
  Plugin.TestHooks.afterModuleArtifactBuilt = undefined
  await Instance.disposeAll()
})

async function writeProjectPluginConfig(root: string, plugin: string) {
  const directory = path.join(root, ".opencorvus")
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, "opencorvus.jsonc"), JSON.stringify({ plugin: [plugin] }))
}

async function loadedToolDefinition(root: string) {
  return Instance.provide({
    directory: root,
    fn: async () => {
      const revision = await Plugin.revision()
      const output = { description: "unset", parameters: {} }
      await Plugin.trigger("tool.definition", { toolID: "revision_probe" }, output as any)
      return { revision, description: output.description }
    },
  })
}

describe("Plugin materialization revision", () => {
  test("changes when only a transitive module in the deployment artifact changes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-revision-"))
    try {
      const nested = path.join(root, "lib")
      await mkdir(nested)
      const entry = path.join(root, "index.ts")
      const dependency = path.join(nested, "behavior.ts")
      await writeFile(entry, 'export { behavior } from "./lib/behavior"\n')
      await writeFile(dependency, 'export const behavior = "first"\n')
      const specifier = pathToFileURL(entry).href
      const before = await Plugin.TestHooks.moduleRevision(specifier)
      await writeFile(dependency, 'export const behavior = "second"\n')
      const after = await Plugin.TestHooks.moduleRevision(specifier)

      expect(after).not.toBe(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("tracks a symlinked package dependency without hashing unrelated project files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-package-revision-"))
    try {
      const pluginRoot = path.join(root, "node_modules", "revision-plugin")
      const dependencyTarget = path.join(root, "external", "revision-dependency")
      const dependencyLink = path.join(root, "node_modules", "revision-dependency")
      await Promise.all([mkdir(pluginRoot, { recursive: true }), mkdir(dependencyTarget, { recursive: true })])
      await writeFile(
        path.join(pluginRoot, "package.json"),
        JSON.stringify({
          name: "revision-plugin",
          version: "1.0.0",
          dependencies: { "revision-dependency": "1.0.0" },
        }),
      )
      const entry = path.join(pluginRoot, "index.js")
      await writeFile(entry, 'export { behavior } from "revision-dependency"\n')
      await writeFile(
        path.join(dependencyTarget, "package.json"),
        JSON.stringify({ name: "revision-dependency", version: "1.0.0" }),
      )
      const dependencyEntry = path.join(dependencyTarget, "index.js")
      await writeFile(dependencyEntry, 'export const behavior = "first"\n')
      await symlink(dependencyTarget, dependencyLink, "junction")

      const specifier = pathToFileURL(entry).href
      const before = await Plugin.TestHooks.moduleRevision(specifier)
      await writeFile(path.join(root, "unrelated-project-file.txt"), "must not affect Plugin revision\n")
      expect(await Plugin.TestHooks.moduleRevision(specifier)).toBe(before)

      await writeFile(dependencyEntry, 'export const behavior = "second"\n')
      expect(await Plugin.TestHooks.moduleRevision(specifier)).not.toBe(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("tracks an ancestor-installed dependency imported by a direct-file Plugin", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-direct-file-revision-"))
    try {
      const pluginDirectory = path.join(root, "plugins")
      const dependencyRoot = path.join(root, "node_modules", "direct-file-dependency")
      await Promise.all([mkdir(pluginDirectory, { recursive: true }), mkdir(dependencyRoot, { recursive: true })])
      await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "direct-file-project",
          version: "1.0.0",
          dependencies: { "direct-file-dependency": "1.0.0" },
        }),
      )
      await writeFile(
        path.join(dependencyRoot, "package.json"),
        JSON.stringify({ name: "direct-file-dependency", version: "1.0.0" }),
      )
      const dependencyEntry = path.join(dependencyRoot, "index.js")
      await writeFile(dependencyEntry, 'export const behavior = "first"\n')
      const entry = path.join(pluginDirectory, "plugin.ts")
      await writeFile(entry, 'export { behavior } from "direct-file-dependency"\n')
      const specifier = pathToFileURL(entry).href
      const before = await Plugin.TestHooks.moduleRevision(specifier)

      await writeFile(dependencyEntry, 'export const behavior = "second"\n')
      expect(await Plugin.TestHooks.moduleRevision(specifier)).not.toBe(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("allows an absent optional peer that the Plugin does not import", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-optional-peer-"))
    try {
      await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "optional-peer-plugin",
          version: "1.0.0",
          peerDependencies: { "absent-optional-peer": "1.0.0" },
          peerDependenciesMeta: { "absent-optional-peer": { optional: true } },
        }),
      )
      const entry = path.join(root, "index.js")
      await writeFile(entry, "export const plugin = true\n")
      await expect(Plugin.TestHooks.moduleRevision(pathToFileURL(entry).href)).resolves.toMatch(/^[a-f0-9]{64}$/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("uses Bun loader semantics for inline type-only imports and .js-to-.ts substitution", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-bun-loader-revision-"))
    try {
      const entry = path.join(root, "index.ts")
      const dependency = path.join(root, "behavior.ts")
      await writeFile(
        entry,
        [
          'import { type Missing } from "absent-inline-type-package"',
          'export { type AlsoMissing } from "another-absent-inline-type-package"',
          'export { behavior } from "./behavior.js"',
        ].join("\n"),
      )
      await writeFile(dependency, 'export const behavior = "first"\n')
      const specifier = pathToFileURL(entry).href
      const before = await Plugin.TestHooks.moduleRevision(specifier)
      await writeFile(dependency, 'export const behavior = "second"\n')
      expect(await Plugin.TestHooks.moduleRevision(specifier)).not.toBe(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("resolves an escaped local module dependency from that module's own node_modules", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-importer-resolution-"))
    try {
      const pluginRoot = path.join(root, "plugin")
      const sharedRoot = path.join(root, "shared")
      const nestedDependency = path.join(sharedRoot, "node_modules", "importer-dependency")
      const rootDependency = path.join(root, "node_modules", "importer-dependency")
      await Promise.all([
        mkdir(pluginRoot, { recursive: true }),
        mkdir(nestedDependency, { recursive: true }),
        mkdir(rootDependency, { recursive: true }),
      ])
      const manifest = (version: string) => JSON.stringify({ name: "importer-dependency", version })
      await Promise.all([
        writeFile(path.join(nestedDependency, "package.json"), manifest("2.0.0")),
        writeFile(path.join(rootDependency, "package.json"), manifest("1.0.0")),
        writeFile(path.join(rootDependency, "index.js"), 'export const owner = "root"\n'),
      ])
      const nestedEntry = path.join(nestedDependency, "index.js")
      await writeFile(nestedEntry, 'export const owner = "nested-first"\n')
      await writeFile(path.join(sharedRoot, "module.ts"), 'export { owner } from "importer-dependency"\n')
      const entry = path.join(pluginRoot, "index.ts")
      await writeFile(entry, 'export { owner } from "../shared/module"\n')
      const specifier = pathToFileURL(entry).href
      const before = await Plugin.TestHooks.moduleRevision(specifier)

      await writeFile(path.join(rootDependency, "index.js"), 'export const owner = "root-changed"\n')
      expect(await Plugin.TestHooks.moduleRevision(specifier)).toBe(before)
      await writeFile(nestedEntry, 'export const owner = "nested-second"\n')
      expect(await Plugin.TestHooks.moduleRevision(specifier)).not.toBe(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("loads the same content-addressed Bun artifact whose bytes own the revision across cache reload", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-loaded-artifact-"))
    try {
      const entry = path.join(root, "plugin.ts")
      const dependency = path.join(root, "behavior.ts")
      await writeFile(
        entry,
        [
          'import { behavior } from "./behavior"',
          "export default async function revisionPlugin() {",
          '  return { "tool.definition": async (_input, output) => { output.description = behavior } }',
          "}",
        ].join("\n"),
      )
      await writeFile(dependency, 'export const behavior = "first-loaded-artifact"\n')
      await writeProjectPluginConfig(root, pathToFileURL(entry).href)

      Plugin.TestHooks.afterModuleArtifactBuilt = async ({ specifier }) => {
        if (specifier !== pathToFileURL(entry).href) return
        Plugin.TestHooks.afterModuleArtifactBuilt = undefined
        await writeFile(dependency, 'export const behavior = "second-loaded-artifact"\n')
      }
      const before = await loadedToolDefinition(root)
      await Instance.disposeAll()
      const after = await loadedToolDefinition(root)

      expect(before.description).toBe("first-loaded-artifact")
      expect(after.description).toBe("second-loaded-artifact")
      expect(after.revision).not.toBe(before.revision)
    } finally {
      Plugin.TestHooks.afterModuleArtifactBuilt = undefined
      await Instance.disposeAll()
      await rm(root, { recursive: true, force: true })
    }
  })

  test("binds manifest hooks to selected resource snapshots and advances Plugin.revision for resource bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "opencorvus-plugin-resource-artifact-"))
    try {
      const backend = path.join(root, "backend.ts")
      const resource = path.join(root, "behavior.txt")
      const manifestPath = path.join(root, "plugin.json")
      await writeFile(
        backend,
        [
          "export default async function resourcePlugin(input) {",
          '  const resourcePath = input.resources.get("behavior").absolutePath',
          "  return {",
          '    "tool.definition": async (_input, output) => { output.description = await Bun.file(resourcePath).text() },',
          '    service: async () => ({ id: "revision-resource-service", app: { fetch: async () => new Response("ok") } }),',
          "  }",
          "}",
        ].join("\n"),
      )
      await writeFile(resource, "first-resource-snapshot")
      await writeFile(
        manifestPath,
        JSON.stringify({
          packageSpecifier: pathToFileURL(root).href,
          serviceID: "revision-resource-service",
          backendExport: "./backend.ts",
          overlayExport: "unused",
          resources: [{ id: "behavior", kind: "asset", path: "behavior.txt" }],
        }),
      )
      await writeProjectPluginConfig(root, pathToFileURL(manifestPath).href)

      const first = await Instance.provide({
        directory: root,
        fn: async () => {
          const revision = await Plugin.revision()
          await writeFile(resource, "second-resource-snapshot")
          const output = { description: "unset", parameters: {} }
          await Plugin.trigger("tool.definition", { toolID: "resource_probe" }, output as any)
          return { revision, description: output.description }
        },
      })
      await Instance.disposeAll()
      const second = await loadedToolDefinition(root)

      expect(first.description).toBe("first-resource-snapshot")
      expect(second.description).toBe("second-resource-snapshot")
      expect(second.revision).not.toBe(first.revision)
    } finally {
      await Instance.disposeAll()
      await rm(root, { recursive: true, force: true })
    }
  })
})
