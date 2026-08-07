// Upstream source: anomalyco/opencode packages/opencode/src/plugin/azure.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import type { Hooks, PluginInput } from "@opencorvus-ai/plugin"

export async function AzureAuthPlugin(_input: PluginInput): Promise<Hooks> {
  const prompts: Array<{
    type: "text"
    key: string
    message: string
    placeholder: string
  }> = []
  if (!process.env.AZURE_RESOURCE_NAME) {
    prompts.push({
      type: "text" as const,
      key: "resourceName",
      message: "Enter Azure Resource Name",
      placeholder: "e.g. my-models",
    })
  }
  return {
    auth: {
      provider: "azure",
      methods: [
        {
          type: "api",
          label: "API key",
          prompts,
        },
      ],
    },
  }
}
