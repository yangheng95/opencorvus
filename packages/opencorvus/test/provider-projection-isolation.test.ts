import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Provider.resetAll()
  await resetMemoryDatabase()
})

function declaration(): ModelsDev.Provider {
  return {
    id: "projection-isolation",
    name: "Projection isolation",
    env: ["CATALOG_TOKEN"],
    npm: "@ai-sdk/openai-compatible",
    api: "https://projection.invalid/v1",
    models: {
      reasoning: {
        id: "reasoning",
        name: "Reasoning",
        release_date: "2026-10-20",
        attachment: false,
        reasoning: true,
        temperature: false,
        tool_call: true,
        modalities: { input: ["text"], output: ["text"] },
        interleaved: { field: "reasoning_content" },
        limit: { context: 10000, output: 1000 },
        headers: { "x-scope": "catalog" },
        options: { metadata: { tags: ["catalog"], tuning: { budget: 11 } } },
      },
    },
  }
}

function values(provider: Pick<Provider.Info, "env" | "models">) {
  const model = provider.models.reasoning
  return {
    env: provider.env,
    headers: model.headers,
    options: model.options,
    interleaved: model.capabilities.interleaved,
  }
}

const originalValues = {
  env: ["CATALOG_TOKEN"],
  headers: { "x-scope": "catalog" },
  options: { metadata: { tags: ["catalog"], tuning: { budget: 11 } } },
  interleaved: { field: "reasoning_content" },
}

function customize(provider: Provider.Info) {
  provider.env.push("PROJECT_TOKEN")
  const model = provider.models.reasoning
  model.headers["x-scope"] = "project"
  model.options.metadata.tags.push("project")
  model.options.metadata.tuning.budget = 22
  if (!model.capabilities.interleaved || typeof model.capabilities.interleaved !== "object")
    throw new Error("Declared interleaved capability required")
  model.capabilities.interleaved.field = "reasoning_details"
}

test("empty model option defaults produce independent authored values for each projection", () => {
  const source = declaration()
  source.models.reasoning.options = {}
  const first = Provider.fromModelsDevProvider(source)
  const second = Provider.fromModelsDevProvider(source)
  first.models.reasoning.options.scope = "first"
  second.models.reasoning.options.scope = "second"
  const third = Provider.fromModelsDevProvider(source)
  expect({
    first: first.models.reasoning.options,
    second: second.models.reasoning.options,
    third: third.models.reasoning.options,
    source: source.models.reasoning.options,
  }).toEqual({ first: { scope: "first" }, second: { scope: "second" }, third: {}, source: {} })
})

test("initial reasoning variants retain their source values and each projection owns later edits", () => {
  const source = declaration()
  source.npm = "@ai-sdk/anthropic"
  const first = Provider.fromModelsDevProvider(source)
  const second = Provider.fromModelsDevProvider(source)
  const model = first.models.reasoning
  model.api.npm = "@ai-sdk/openai-compatible"
  model.capabilities.reasoning = false
  model.limit.output = 10
  expect(model.variants).toEqual({
    high: { thinking: { type: "enabled", budgetTokens: 499 } },
    max: { thinking: { type: "enabled", budgetTokens: 999 } },
  })
  model.variants.high.thinking.budgetTokens = 77
  expect({
    first: model.variants.high.thinking.budgetTokens,
    second: second.models.reasoning.variants.high.thinking.budgetTokens,
  }).toEqual({ first: 77, second: 499 })
})

test("authored reasoning variants serialize and clone as the model's current writable value", () => {
  const projection = Provider.fromModelsDevProvider(declaration())
  projection.models.reasoning.variants = { authored: { budget: 32 } }
  projection.models.reasoning.variants.authored.budget = 64
  expect({
    json: JSON.parse(JSON.stringify(projection)).models.reasoning.variants,
    clone: structuredClone(projection).models.reasoning.variants,
  }).toEqual({ json: { authored: { budget: 64 } }, clone: { authored: { budget: 64 } } })
  projection.models.reasoning.variants = { next: { budget: 128 } }
  expect(projection.models.reasoning.variants).toEqual({ next: { budget: 128 } })
})

test("frozen models retain readable defaults and sealed models retain their authored reasoning value", () => {
  const source = declaration()
  source.npm = "@ai-sdk/anthropic"
  const frozen = Object.freeze(Provider.fromModelsDevProvider(source).models.reasoning)
  expect(structuredClone(frozen).variants.high.thinking.budgetTokens).toBe(499)
  const sealed = Object.seal(Provider.fromModelsDevProvider(source).models.reasoning)
  sealed.variants = { authored: { budget: 256 } }
  expect(sealed.variants).toEqual({ authored: { budget: 256 } })
})

test("each Provider projection owns its mutable metadata and preserves the current source declaration", () => {
  const source = declaration()
  const first = Provider.fromModelsDevProvider(source)
  customize(first)
  const second = Provider.fromModelsDevProvider(source)
  expect({
    first: values(first),
    second: values(second),
    source: {
      env: source.env,
      headers: source.models.reasoning.headers,
      options: source.models.reasoning.options,
      interleaved: source.models.reasoning.interleaved,
    },
  }).toEqual({
    first: {
      env: ["CATALOG_TOKEN", "PROJECT_TOKEN"],
      headers: { "x-scope": "project" },
      options: { metadata: { tags: ["catalog", "project"], tuning: { budget: 22 } } },
      interleaved: { field: "reasoning_details" },
    },
    second: originalValues,
    source: originalValues,
  })
})

test("a production Project plugin customizes its own Provider while another Project and global catalog retain their declarations", async () => {
  const original = await fs.readFile(ModelsDev.catalogPath())
  await using first = await memoryProject()
  await using second = await memoryProject()
  const source = declaration()
  const config = Config.Info.parse({
    enabled_providers: [source.id],
    provider: { [source.id]: { options: { apiKey: "fixture-projection" } } },
  })
  try {
    await fs.writeFile(ModelsDev.catalogPath(), JSON.stringify({ ...(await ModelsDev.get()), [source.id]: source }))
    ModelsDev.Data.reset()
    await Provider.resetAll()
    const plugin = path.join(first.path, "customize.ts")
    await fs.writeFile(
      plugin,
      `export default async () => ({provider:{id:"${source.id}",models(provider){
      provider.env.push("PROJECT_TOKEN");
      const model=provider.models.reasoning;
      model.headers["x-scope"]="project";
      model.options.metadata.tags.push("project");
      model.options.metadata.tuning.budget=22;
      model.capabilities.interleaved.field="reasoning_details";
      return provider.models;
    }}})`,
    )
    await fs.mkdir(path.join(first.path, ".opencorvus"), { recursive: true })
    await fs.writeFile(
      path.join(first.path, ".opencorvus", "opencorvus.jsonc"),
      JSON.stringify({ plugin: [pathToFileURL(plugin).href] }),
    )
    const global = await Provider.catalogGlobal(config)
    const customized = await Instance.provide({ directory: first.path, fn: () => Provider.catalog({ config }) })
    const isolated = await Instance.provide({ directory: second.path, fn: () => Provider.catalog({ config }) })
    const current = (await ModelsDev.get())[source.id]
    expect({
      customized: values(customized.database[source.id]),
      isolated: values(isolated.database[source.id]),
      global: values(global.database[source.id]),
      source: {
        env: current.env,
        headers: current.models.reasoning.headers,
        options: current.models.reasoning.options,
        interleaved: current.models.reasoning.interleaved,
      },
    }).toEqual({
      customized: {
        env: ["CATALOG_TOKEN", "PROJECT_TOKEN"],
        headers: { "x-scope": "project" },
        options: { metadata: { tags: ["catalog", "project"], tuning: { budget: 22 } } },
        interleaved: { field: "reasoning_details" },
      },
      isolated: originalValues,
      global: originalValues,
      source: originalValues,
    })
  } finally {
    await fs.writeFile(ModelsDev.catalogPath(), original)
    ModelsDev.Data.reset()
  }
})

test("published catalogs retain their original model generation across a canonical catalog update", async () => {
  const original = await fs.readFile(ModelsDev.catalogPath())
  const source = declaration()
  try {
    await fs.writeFile(ModelsDev.catalogPath(), JSON.stringify({ ...(await ModelsDev.get()), [source.id]: source }))
    ModelsDev.Data.reset()
    const config = Config.Info.parse({ enabled_providers: [] })
    const before = await Provider.catalogGlobal(config)
    await ModelsDev.replaceProviderModels(source.id, {
      reasoning: { ...source.models.reasoning, name: "Updated reasoning", limit: { context: 20000, output: 2000 } },
    })
    await Provider.resetAll()
    const after = await Provider.catalogGlobal(config)
    const modelValues = (catalog: typeof before) => {
      const model = catalog.database[source.id].models.reasoning
      return { name: model.name, context: model.limit.context, output: model.limit.output, options: model.options }
    }
    expect({ before: modelValues(before), after: modelValues(after) }).toEqual({
      before: {
        name: "Reasoning",
        context: 10000,
        output: 1000,
        options: { metadata: { tags: ["catalog"], tuning: { budget: 11 } } },
      },
      after: {
        name: "Updated reasoning",
        context: 20000,
        output: 2000,
        options: { metadata: { tags: ["catalog"], tuning: { budget: 11 } } },
      },
    })
  } finally {
    await fs.writeFile(ModelsDev.catalogPath(), original)
    ModelsDev.Data.reset()
  }
})

test("frozen published Providers serialize complete models and sealed Providers retain authored models", async () => {
  const original = await fs.readFile(ModelsDev.catalogPath())
  const source = declaration()
  try {
    await fs.writeFile(ModelsDev.catalogPath(), JSON.stringify({ ...(await ModelsDev.get()), [source.id]: source }))
    ModelsDev.Data.reset()
    const config = Config.Info.parse({ enabled_providers: [] })
    const first = (await Provider.catalogGlobal(config)).database[source.id]
    Object.freeze(first)
    const expected = Provider.fromModelsDevProvider(source).models
    expect({ json: JSON.parse(JSON.stringify(first)).models, cloned: structuredClone(first).models }).toEqual({
      json: expected,
      cloned: expected,
    })
    await Provider.resetAll()
    const second = Object.seal((await Provider.catalogGlobal(config)).database[source.id])
    const authored = Provider.fromModelsDevProvider(source).models
    authored.reasoning.name = "Authored sealed value"
    second.models = authored
    expect({
      name: second.models.reasoning.name,
      source: (await ModelsDev.get())[source.id].models.reasoning.name,
    }).toEqual({
      name: "Authored sealed value",
      source: "Reasoning",
    })
  } finally {
    await fs.writeFile(ModelsDev.catalogPath(), original)
    ModelsDev.Data.reset()
  }
})

test.each([
  {
    label: "ordinary single declaration",
    api: "https://projection.invalid/v1",
    env: ["PROJECTION_ENV_A"],
    own: "declared-key",
    selected: "declared-key",
  },
  {
    label: "DashScope single declaration",
    api: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    env: ["PROJECTION_ENV_A"],
    own: "declared-key",
    selected: "declared-key",
  },
  {
    label: "DashScope common credential",
    api: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    env: ["PROJECTION_ENV_A"],
    own: "",
    selected: "common-key",
  },
  {
    label: "DashScope multiple declarations",
    api: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    env: ["PROJECTION_ENV_A", "PROJECTION_ENV_B"],
    own: "first-declared-key",
    selected: "first-declared-key",
  },
])("environment selection preserves the selected key for $label", async (input) => {
  const original = await fs.readFile(ModelsDev.catalogPath())
  const variables = ["PROJECTION_ENV_A", "PROJECTION_ENV_B", "DASHSCOPE_API_KEY"]
  const environment = variables.map((name) => [name, process.env[name]] as const)
  const source = { ...declaration(), api: input.api, env: input.env }
  try {
    process.env.PROJECTION_ENV_A = input.own
    process.env.PROJECTION_ENV_B = "second-declared-key"
    process.env.DASHSCOPE_API_KEY = "common-key"
    await fs.writeFile(ModelsDev.catalogPath(), JSON.stringify({ ...(await ModelsDev.get()), [source.id]: source }))
    ModelsDev.Data.reset()
    const catalog = await Provider.catalogGlobal(Config.Info.parse({ enabled_providers: [source.id] }))
    const provider = catalog.providers[source.id]
    expect({ key: provider.key, model: provider.models.reasoning.name }).toEqual({
      key: input.selected,
      model: "Reasoning",
    })
  } finally {
    for (const [name, value] of environment) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    await fs.writeFile(ModelsDev.catalogPath(), original)
    ModelsDev.Data.reset()
  }
})
