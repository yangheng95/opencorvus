import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Config } from "@/config/config"
import { ConfigCandidateValidationError } from "@/config/candidate-validation"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Plugin } from "@/plugin"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const providerID = "candidate-plugin"
const globalFile = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
const baseline = {
  $schema: "https://opencorvus.ai/config.json",
  prompt_profile: { active: "base" },
  permission_mode: "ask",
}
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

for (const modelReference of ["configured", "unspecified"] as const) {
  test(`a failed candidate factory returns the validation error before project publication with ${modelReference} model`, async () => {
    await using project = await memoryProject()
    const config = configuration()
    if (modelReference === "unspecified") delete config.model
    await projectConfig(project.path, config)
    const file = path.join(project.path, "failed-candidate.ts")
    await fs.writeFile(file, 'export default async () => { throw new Error("Candidate factory failed") }\n')
    const selected = pathToFileURL(file).href
    const actual = await Instance.provideProjectIdentity({
      directory: project.path,
      fn: async () => {
        const error = await Config.updateProjectPatch({ plugin: [selected] }).then(
          () => ({ name: "accepted", message: "" }),
          (failure) => ({
            name: failure.name,
            message: failure.data?.message ?? failure.message,
            typed: failure instanceof ConfigCandidateValidationError,
          }),
        )
        const saved = JSON.parse(
          await fs.readFile(path.join(project.path, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME), "utf8"),
        )
        return { error, saved }
      },
    })
    expect(actual).toEqual({
      error: {
        name: "ConfigCandidateValidationError",
        message: `config.plugin: Plugin module load failed for ${selected}: Candidate factory failed`,
        typed: true,
      },
      saved: config,
    })
  })
}

test("a failed candidate factory preserves the global source while validating a registered Project", async () => {
  await using project = await memoryProject()
  await projectConfig(project.path, configuration())
  await Instance.provideProjectIdentity({ directory: project.path, fn: () => undefined })
  const file = path.join(project.path, "failed-global-candidate.ts")
  await fs.writeFile(file, 'export default async () => { throw new Error("Global candidate factory failed") }\n')
  const selected = pathToFileURL(file).href
  const original = JSON.parse(await fs.readFile(globalFile, "utf8"))
  const failure = await Config.updateGlobalPatch({ plugin: [selected] }).then(
    () => ({ name: "accepted", message: "" }),
    (error) => ({ name: error.name, message: error.data?.message ?? error.message }),
  )
  expect({ failure, saved: JSON.parse(await fs.readFile(globalFile, "utf8")) }).toEqual({
    failure: {
      name: "ConfigCandidateValidationError",
      message: `global config.plugin: Plugin module load failed for ${selected}: Global candidate factory failed`,
    },
    saved: original,
  })
})

test("the runtime catalog retains its structured plugin issue and a readable standard model", async () => {
  await using project = await memoryProject()
  await projectConfig(project.path, configuration())
  const file = path.join(project.path, "partial-catalog.ts")
  await fs.writeFile(file, 'export default async () => { throw new Error("Readable catalog failure") }\n')
  const selected = pathToFileURL(file).href
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const catalog = await Provider.catalog({ config: configuration([selected]) })
      return {
        issue: catalog.issues.find((issue) => issue.phase === "plugin.catalog"),
        readable: Provider.getModelFromCatalog(catalog, providerID, "base").name,
      }
    },
  })
  expect(actual).toEqual({
    issue: {
      phase: "plugin.catalog",
      message: `Plugin module load failed for ${selected}: Readable catalog failure`,
    },
    readable: "Catalog base",
  })
})

test("a retained catalog resolves its original model after a newer catalog publication", async () => {
  await using project = await memoryProject()
  await projectConfig(project.path, configuration())
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const before = await Provider.catalog({ config: configuration() })
      const source = (await ModelsDev.get())[providerID].models.base
      await ModelsDev.replaceProviderModels(providerID, { base: { ...source, name: "Published next base" } })
      await Provider.resetAll()
      const after = await Provider.catalog({ config: configuration() })
      return {
        retained: Provider.getModelFromCatalog(before, providerID, "base").name,
        current: Provider.getModelFromCatalog(after, providerID, "base").name,
      }
    },
  })
  expect(actual).toEqual({ retained: "Catalog base", current: "Published next base" })
})

test("catalog model resolution retains typed provider and model suggestions", async () => {
  await using project = await memoryProject()
  await projectConfig(project.path, configuration())
  const failures = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const catalog = await Provider.catalog({ config: configuration() })
      return [
        { provider: "candidate-plugn", model: "base" },
        { provider: providerID, model: "bas" },
      ].map((ref) => {
        try {
          Provider.getModelFromCatalog(catalog, ref.provider, ref.model)
          throw new Error("Expected typed lookup error")
        } catch (error) {
          if (!(error instanceof Provider.ModelNotFoundError)) throw error
          return { name: error.name, ...error.data }
        }
      })
    },
  })
  expect(failures).toEqual([
    { name: "ProviderModelNotFoundError", providerID: "candidate-plugn", modelID: "base", suggestions: [providerID] },
    { name: "ProviderModelNotFoundError", providerID, modelID: "bas", suggestions: ["base"] },
  ])
})

test("one candidate can publish standard and plugin model references together", async () => {
  await using project = await memoryProject()
  await projectConfig(project.path, configuration())
  const selected = await plugin(project.path, "small", "Candidate small")
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({
        plugin: [selected],
        model: `${providerID}/base`,
        small_model: `${providerID}/small`,
      })
      const config = await Config.get()
      const catalog = await Provider.catalog({ config })
      return {
        primary: Provider.getModelFromCatalog(catalog, providerID, "base").name,
        small: Provider.getModelFromCatalog(catalog, providerID, "small").name,
        selected: config.small_model,
      }
    },
  })
  expect(actual).toEqual({ primary: "Catalog base", small: "Candidate small", selected: `${providerID}/small` })
})

test("a repaired file plugin at the same selection accepts a fresh candidate retry", async () => {
  await using project = await memoryProject()
  await projectConfig(project.path, configuration())
  const file = path.join(project.path, "repairable.ts")
  await fs.writeFile(file, 'export default async()=>{throw new Error("Repairable factory failure")}\n')
  const selected = pathToFileURL(file).href
  const actual = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const first = await Config.updateProjectPatch({ plugin: [selected] }).catch((error) => error)
      if (!(first instanceof ConfigCandidateValidationError)) throw first ?? new Error("Expected first candidate error")
      await fs.writeFile(
        file,
        `export default async()=>({provider:{id:${JSON.stringify(providerID)},models(provider){return {...provider.models,base:{...provider.models.base,name:"Repaired base"}}}}})`,
      )
      await Config.updateProjectPatch({ plugin: [selected] })
      const saved = await Config.get()
      return { first: first.name, selected: saved.plugin, model: (await Provider.getModel(providerID, "base")).name }
    },
  })
  expect(actual).toEqual({ first: "ConfigCandidateValidationError", selected: [selected], model: "Repaired base" })
})
