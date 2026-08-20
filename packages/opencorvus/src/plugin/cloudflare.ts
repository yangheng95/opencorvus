// Upstream source: anomalyco/opencode packages/opencode/src/plugin/cloudflare.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import type { Hooks, PluginInput } from "@opencorvus-ai/plugin"
import type { PhysicalProviderHooks } from "@/plugin"

export async function CloudflareWorkersAuthPlugin(_input: PluginInput): Promise<Hooks> {
  const prompts = !process.env.CLOUDFLARE_ACCOUNT_ID
      ? [
          {
            type: "text" as const,
            key: "accountId",
            message: "Enter your Cloudflare Account ID",
            placeholder: "e.g. 1234567890abcdef1234567890abcdef",
          },
        ]
      : []

  return {
    auth: {
      provider: "cloudflare-workers-ai",
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

export async function CloudflareAIGatewayAuthPlugin(_input: PluginInput): Promise<Hooks & PhysicalProviderHooks> {
  const prompts = [
    ...(!process.env.CLOUDFLARE_ACCOUNT_ID
      ? [
          {
            type: "text" as const,
            key: "accountId",
            message: "Enter your Cloudflare Account ID",
            placeholder: "e.g. 1234567890abcdef1234567890abcdef",
          },
        ]
      : []),
    ...(!process.env.CLOUDFLARE_GATEWAY_ID
      ? [
          {
            type: "text" as const,
            key: "gatewayId",
            message: "Enter your Cloudflare AI Gateway ID",
            placeholder: "e.g. my-gateway",
          },
        ]
      : []),
  ]

  return {
    auth: {
      provider: "cloudflare-ai-gateway",
      methods: [
        {
          type: "api",
          label: "Gateway API token",
          prompts,
        },
      ],
    },
    "provider.chat.params": async (input, output) => {
      if (input.model.providerID !== "cloudflare-ai-gateway") return
      if (!input.model.api.id.toLowerCase().startsWith("openai/")) return
      if (!input.model.capabilities.reasoning) return
      output.maxOutputTokens = undefined
    },
  }
}
