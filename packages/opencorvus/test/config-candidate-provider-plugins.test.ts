import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Plugin } from "@/plugin"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const providerID = "candidate-plugin"
const globalFile = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
const baseline = { prompt_profile: { active: "base" }, permission_mode: "ask" }
let originalCatalog: Buffer

beforeEach(async () => {
  originalCatalog = await fs.readFile(ModelsDev.catalogPath())
  await fs.mkdir(Global.Path.config, { recursive: true })
  await fs.writeFile(globalFile, JSON.stringify(baseline))
  await fs.writeFile(
    ModelsDev.catalogPath(),
    JSON.stringify(
      ModelsDev.withLocalProviders({
        [providerID]: {
          id: providerID,
          name: "Candidate plugin",
          env: [],
          npm: "@ai-sdk/openai-compatible",
          api: "https://candidate.invalid/v1",
          models: {
            base: {
              id: "base",
              name: "Catalog base",
              release_date: "2026-10-20",
              attachment: false,
              reasoning: false,
              temperature: false,
              tool_call: true,
              limit: { context: 10000, output: 1000 },
              modalities: { input: ["text"], output: ["text"] },
            },
          },
        },
      }),
    ),
  )
  ModelsDev.Data.reset()
  Config.global.reset()
  await Config.state.resetAll()
  await Provider.resetAll()
})

afterEach(async () => {
  await fs.writeFile(ModelsDev.catalogPath(), originalCatalog)
  ModelsDev.Data.reset()
  await Provider.resetAll()
  await resetMemoryDatabase()
})

function configuration(plugin: string[] = [], model = "base") {
  return Config.Info.parse({
    ...baseline,
    plugin,
    model: `${providerID}/${model}`,
    enabled_providers: [providerID],
    provider: { [providerID]: { options: { apiKey: "fixture-candidate" } } },
  })
}

async function plugin(directory: string, modelID: string, name: string) {
  const file = path.join(directory, `${modelID}.ts`)
  await fs.writeFile(
    file,
    `export default async () => ({provider:{id:${JSON.stringify(providerID)},models(provider){
      const model={...provider.models.base,id:${JSON.stringify(modelID)},name:${JSON.stringify(name)}};
      return {...provider.models,[${JSON.stringify(modelID)}]:model};
    }}})`,
  )
  return pathToFileURL(file).href
}

async function projectConfig(directory: string, config: Config.Info) {
  const file = path.join(directory, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(config))
}

test("a complete candidate snapshot projects the newly selected file plugin before publication", async () => {
  await using project = await memoryProject()
  const selected = await plugin(project.path, "next", "Candidate next")
  await projectConfig(project.path, configuration())
  const candidate = configuration([selected], "next")
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: () => Provider.getModel(providerID, "next", { config: candidate }),
  })
  expect({ id: actual.id, name: actual.name, providerID: actual.providerID }).toEqual({
    id: "next",
    name: "Candidate next",
    providerID,
  })
})

test("the real project writer publishes a replacement plugin and its selected model together", async () => {
  await using project = await memoryProject()
  const old = await plugin(project.path, "old", "Current old")
  const next = await plugin(project.path, "next", "Committed next")
  await projectConfig(project.path, configuration([old], "old"))
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const before = await Provider.getModel(providerID, "old")
      await Config.updateProjectPatch({ plugin: [next], model: `${providerID}/next` })
      const saved = await Config.get()
      const model = await Provider.getModel(providerID, "next")
      return { before: before.name, plugin: saved.plugin, model: saved.model, name: model.name }
    },
  })
  expect(actual).toEqual({
    before: "Current old",
    plugin: [next],
    model: `${providerID}/next`,
    name: "Committed next",
  })
})

test("a candidate's empty plugin selection resolves the standard catalog model", async () => {
  await using project = await memoryProject()
  const current = await plugin(project.path, "base", "Current customized base")
  await projectConfig(project.path, configuration([current]))
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => ({
      current: (await Provider.getModel(providerID, "base")).name,
      candidate: (await Provider.getModel(providerID, "base", { config: configuration() })).name,
    }),
  })
  expect(actual).toEqual({ current: "Current customized base", candidate: "Catalog base" })
})

test("an explicit selection matching the loaded modules retains their original hook identity", async () => {
  await using project = await memoryProject()
  const selected = await plugin(project.path, "base", "Owned base")
  await projectConfig(project.path, configuration([selected]))
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const current = (await Plugin.list()).find((hook) => hook.provider?.id === providerID)
      const explicit = (await Plugin.list([selected])).find((hook) => hook.provider?.id === providerID)
      expect(explicit).toBe(current)
      expect((await Provider.getModel(providerID, "base", { config: configuration([selected]) })).name).toBe(
        "Owned base",
      )
    },
  })
})

test("the loaded specifiers remain authoritative when the saved config has moved to another plugin", async () => {
  await using project = await memoryProject()
  const old = await plugin(project.path, "old", "Loaded old")
  const next = await plugin(project.path, "next", "Saved next")
  await projectConfig(project.path, configuration([old], "old"))
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const before = (await Provider.getModel(providerID, "old")).name
      await projectConfig(project.path, configuration([next], "next"))
      await Config.state.reset()
      const saved = await Config.get()
      const after = await Provider.getModel(providerID, "next", { config: saved })
      return { before, configured: saved.plugin, after: after.name }
    },
  })
  expect(actual).toEqual({ before: "Loaded old", configured: [next], after: "Saved next" })
})

test("one selected plugin receives each real Project's input while global keeps its declared model", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  const file = path.join(first.path, "project-input.ts")
  await fs.writeFile(
    file,
    `export default async input => ({provider:{id:${JSON.stringify(providerID)},models(provider){
      return {...provider.models,base:{...provider.models.base,name:input.directory}};
    }}})`,
  )
  const config = configuration([pathToFileURL(file).href])
  const names = await Promise.all(
    [first, second].map((project) =>
      Instance.provideProjectIdentity({
        directory: project.path,
        fn: async () => (await Provider.getModel(providerID, "base", { config })).name,
      }),
    ),
  )
  const global = await Provider.getModelGlobal(providerID, "base", config)
  expect({ names, global: global.name }).toEqual({ names: [first.path, second.path], global: "Catalog base" })
})

test("the project writer can replace a broken current plugin with an explicit empty selection", async () => {
  await using project = await memoryProject()
  const file = path.join(project.path, "broken.ts")
  await fs.writeFile(file, 'throw new Error("Broken current plugin")\n')
  await projectConfig(project.path, configuration([pathToFileURL(file).href]))
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ plugin: [] })
      return { plugin: (await Config.get()).plugin, name: (await Provider.getModel(providerID, "base")).name }
    },
  })
  expect(actual).toEqual({ plugin: [], name: "Catalog base" })
})

test("an invalid candidate model reports its typed contract and preserves the current working selection", async () => {
  await using project = await memoryProject()
  const selected = await plugin(project.path, "next", "Valid next")
  await projectConfig(project.path, configuration())
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      let failure: unknown
      try {
        await Config.updateProjectPatch({ plugin: [selected], model: `${providerID}/missing` })
      } catch (error) {
        failure = error
      }
      if (!(failure instanceof Provider.ModelNotFoundError)) throw failure ?? new Error("Expected typed model error")
      return {
        failure: { name: failure.name, providerID: failure.data.providerID, modelID: failure.data.modelID },
        saved: (await Config.get()).model,
        working: (await Provider.getModel(providerID, "base")).name,
      }
    },
  })
  expect(actual).toEqual({
    failure: { name: "ProviderModelNotFoundError", providerID, modelID: "missing" },
    saved: `${providerID}/base`,
    working: "Catalog base",
  })
})
