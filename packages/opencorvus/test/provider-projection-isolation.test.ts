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
