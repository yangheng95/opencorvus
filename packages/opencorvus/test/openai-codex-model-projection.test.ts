import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { CodexAuthPlugin } from "@/plugin/openai/codex"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { ModelsDev } from "@/provider/models"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const credential = {
  type: "oauth" as const,
  access: "fictional-model-projection-access",
  refresh: "fictional-model-projection-refresh",
  expires: Date.now() + 3_600_000,
}
const limits = { context: 256_000, input: 240_000, output: 16_000 }
const declaration = (id: string): ModelsDev.Model => ({
  id,
  name: id,
  release_date: "2026-10-14",
  attachment: false,
  reasoning: true,
  temperature: false,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
  cost: { input: 1, output: 2 },
  limit: limits,
  options: {},
})

afterEach(async () => {
  await Auth.remove("openai")
  await Provider.resetAll()
  await resetMemoryDatabase()
})

test("Codex OAuth projects declared integer-major and multi-digit-minor identities with their catalog metadata", async () => {
  const ids = [
    "gpt-6-luna",
    "gpt-6-sol",
    "gpt-6-astra",
    "gpt-6.1-sol",
    "gpt-5.6-luna",
    "gpt-5.10-fixture",
    "gpt-5.4-mini",
  ]
  const provider = Provider.fromModelsDevProvider({
    id: "openai",
    name: "Projection fixture",
    env: [],
    npm: "@ai-sdk/openai",
    api: "https://example.invalid/v1",
    models: Object.fromEntries(ids.map((id) => [id, declaration(id)])),
  })
  const hooks = await CodexAuthPlugin({} as never)
  const projected = await hooks.provider!.models!(provider, { auth: credential })
  expect(Object.keys(projected)).toEqual(ids)
  for (const id of ids)
    expect(projected[id]).toMatchObject({ id, api: { id }, limit: limits, capabilities: { toolcall: true } })
})

test("global and Project Provider resolution preserve exact gpt-6-luna under OAuth", async () => {
  await Auth.set("openai", credential)
  const catalog = await ModelsDev.get()
  const original = await fs.readFile(ModelsDev.catalogPath())
  try {
    await fs.writeFile(
      ModelsDev.catalogPath(),
      JSON.stringify({
        ...catalog,
        openai: { ...catalog.openai, models: { "gpt-6-luna": declaration("gpt-6-luna") } },
      }),
    )
    ModelsDev.Data.reset()
    const config = Config.Info.parse({ model: "openai/gpt-6-luna", enabled_providers: ["openai"] })
    const global = await Provider.getModelGlobal("openai", "gpt-6-luna", config)
    await using project = await memoryProject()
    const scoped = await Instance.provide({
      directory: project.path,
      fn: () => Provider.getModel("openai", "gpt-6-luna", { config }),
    })
    for (const model of [global, scoped])
      expect(model).toMatchObject({
        id: "gpt-6-luna",
        providerID: "openai",
        api: { id: "gpt-6-luna" },
        limit: limits,
      })
  } finally {
    await fs.writeFile(ModelsDev.catalogPath(), original)
    ModelsDev.Data.reset()
  }
})
