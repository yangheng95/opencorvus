import fs from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { BUNDLED_PROVIDERS } from "@/provider/bundled"
import { Provider } from "@/provider/provider"

const [mode, projectDirectory, barrierDirectory, apiURL, label = "worker"] = process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory || !apiURL) {
  throw new Error("Provider capacity worker requires mode, project, barrier, api URL and label")
}

const providerID = "provider-capacity-process"
const modelID = "stream-model"

async function waitFor(name: string): Promise<void> {
  const target = path.join(barrierDirectory, name)
  while (!(await fs.stat(target).catch(() => undefined))) await Bun.sleep(10)
}

const result = await Instance.provide({
  directory: projectDirectory,
  fn: async () => {
    if (mode === "seed") {
      await Config.updateGlobalPatch({ execution_capacity: { provider: 1 } })
      await Config.updateProjectPatch({
        enabled_providers: [providerID],
        provider: {
          [providerID]: {
            name: "Cross-process Provider capacity fixture",
            npm: "@ai-sdk/openai-compatible",
            api: apiURL,
            models: { [modelID]: { name: "Cross-process stream model" } },
          },
        },
      })
      await Auth.set(providerID, { type: "api", key: "provider-capacity-process-key" })
      return {
        mode,
        providerID,
        modelID,
        configuredProviders: Object.keys((await Config.get()).provider ?? {}),
      }
    }

    const originalFactory = BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
    let providerFetch: ((input: string, init?: RequestInit) => Promise<Response>) | undefined
    BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = (options: Record<string, unknown>) => {
      providerFetch = options.fetch as typeof providerFetch
      return { languageModel: (id: string) => ({ modelId: id }) as never }
    }
    try {
      const config = await Config.get()
      const catalog = await Provider.catalog({ config })
      if (!catalog.providers[providerID]) {
        const auth = await Auth.inspect(providerID)
        throw new Error(
          `Provider process fixture catalog is missing: ${JSON.stringify({
            enabledProviders: config.enabled_providers,
            configuredProviders: Object.keys(config.provider ?? {}),
            configuredModels: Object.keys(config.provider?.[providerID]?.models ?? {}),
            databaseProviders: Object.keys(catalog.database),
            databaseModels: Object.keys(catalog.database[providerID]?.models ?? {}),
            auth: auth ? { generation: auth.generation, type: auth.info?.type } : null,
            issues: catalog.issues,
          })}`,
        )
      }
      await Provider.getLanguage(await Provider.getModel(providerID, modelID, { config }), { config })
      if (!providerFetch) throw new Error("Provider process fixture did not bind the production fetch boundary")
      await fs.writeFile(path.join(barrierDirectory, `${label}.ready`), "ready")
      await waitFor(`${label}.start`)
      const response = await providerFetch(`${apiURL}/stream/${label}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
        signal: AbortSignal.timeout(30_000),
      })
      return { mode, label, status: response.status, body: await response.text() }
    } finally {
      if (originalFactory) BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = originalFactory
      else delete BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
      await Provider.resetAll()
    }
  },
})

await Instance.disposeAll()
process.stdout.write(JSON.stringify(result))
