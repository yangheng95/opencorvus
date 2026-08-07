import { Config } from "../config/config"
import { Auth } from "../auth"
import { Env } from "../env"
import { iife } from "@/util/iife"
import { Installation } from "../installation"
import os from "os"
import { GoogleAuth } from "google-auth-library"
import type { AmazonBedrockProviderSettings } from "@ai-sdk/amazon-bedrock"
import { createGitLab, VERSION as GITLAB_PROVIDER_VERSION } from "gitlab-ai-provider"
import type { ProviderInfo } from "./model-schema"

// Provider loader semantics synchronized from anomalyco/opencode
// packages/opencode/src/provider/provider.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.

export type CustomModelLoader = (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
export type CustomLoader = (
  provider: ProviderInfo,
  context?: { config: Config.Info },
) => Promise<{
  autoload: boolean
  getModel?: CustomModelLoader
  options?: Record<string, any>
}>

function googleVertexAnthropicBaseURL(project: string | undefined, location: string | undefined) {
  if (!project || (location !== "eu" && location !== "us")) return
  return `https://aiplatform.${location}.rep.googleapis.com/v1/projects/${project}/locations/${location}/publishers/anthropic/models`
}

export const CUSTOM_LOADERS: Record<string, CustomLoader> = {
  async anthropic() {
    return {
      autoload: false,
      options: {
        headers: {
          "anthropic-beta":
            "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
        },
      },
    }
  },
  openai: async () => {
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
        return sdk.responses(modelID)
      },
      options: {},
    }
  },
  azure: async (provider) => {
    const auth = await Auth.get(provider.id)
    const resourceName = [
      provider.options?.resourceName,
      auth?.type === "api" ? auth.metadata?.resourceName : undefined,
      Env.get("AZURE_RESOURCE_NAME"),
    ].find((value) => typeof value === "string" && value.trim() !== "")
    if (!resourceName && !provider.options?.baseURL) {
      return {
        autoload: false,
        async getModel() {
          throw new Error(
            "AZURE_RESOURCE_NAME is missing; set it with the environment or reconnect Azure with a resource name",
          )
        },
      }
    }
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
        if (options?.["useCompletionUrls"]) {
          return sdk.chat(modelID)
        } else {
          return sdk.responses(modelID)
        }
      },
      options: { resourceName },
    }
  },
  "azure-cognitive-services": async () => {
    const resourceName = Env.get("AZURE_COGNITIVE_SERVICES_RESOURCE_NAME")
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
        if (options?.["useCompletionUrls"]) {
          return sdk.chat(modelID)
        } else {
          return sdk.responses(modelID)
        }
      },
      options: {
        baseURL: resourceName ? `https://${resourceName}.cognitiveservices.azure.com/openai` : undefined,
      },
    }
  },
  "amazon-bedrock": async (_input, context) => {
    const config = context?.config ?? (await Config.get())
    const providerConfig = config.provider?.["amazon-bedrock"]

    const auth = await Auth.get("amazon-bedrock")

    const configRegion = providerConfig?.options?.region
    const envRegion = Env.get("AWS_REGION")
    const defaultRegion = configRegion ?? envRegion ?? "us-east-1"

    const configProfile = providerConfig?.options?.profile
    const envProfile = Env.get("AWS_PROFILE")
    const profile = configProfile ?? envProfile

    const awsAccessKeyId = Env.get("AWS_ACCESS_KEY_ID")

    const awsBearerToken = iife(() => {
      const envToken = process.env.AWS_BEARER_TOKEN_BEDROCK
      if (envToken) return envToken
      if (auth?.type === "api") return auth.key
      return undefined
    })

    const awsWebIdentityTokenFile = Env.get("AWS_WEB_IDENTITY_TOKEN_FILE")

    const containerCreds = Boolean(
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
    )

    if (!profile && !awsAccessKeyId && !awsBearerToken && !awsWebIdentityTokenFile && !containerCreds)
      return { autoload: false }

    const providerOptions: AmazonBedrockProviderSettings = {
      region: defaultRegion,
    }

    if (awsBearerToken) {
      providerOptions.apiKey = awsBearerToken
    } else {
      const credentialProviderOptions = profile ? { profile } : {}
      const { fromNodeProviderChain } = await import("@aws-sdk/credential-providers")

      providerOptions.credentialProvider = fromNodeProviderChain(credentialProviderOptions)
    }

    const endpoint = providerConfig?.options?.endpoint ?? providerConfig?.options?.baseURL
    if (endpoint) {
      providerOptions.baseURL = endpoint
    }

    return {
      autoload: true,
      options: providerOptions,
      async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
        const crossRegionPrefixes = ["global.", "us.", "eu.", "jp.", "apac.", "au."]
        if (crossRegionPrefixes.some((prefix) => modelID.startsWith(prefix))) {
          return sdk.languageModel(modelID)
        }

        const region = options?.region ?? defaultRegion

        let regionPrefix = region.split("-")[0]

        switch (regionPrefix) {
          case "us": {
            const modelRequiresPrefix = [
              "nova-micro",
              "nova-lite",
              "nova-pro",
              "nova-premier",
              "nova-2",
              "claude",
              "deepseek",
            ].some((m) => modelID.includes(m))
            const isGovCloud = region.startsWith("us-gov")
            if (modelRequiresPrefix && !isGovCloud) {
              modelID = `${regionPrefix}.${modelID}`
            }
            break
          }
          case "eu": {
            const regionRequiresPrefix = [
              "eu-west-1",
              "eu-west-2",
              "eu-west-3",
              "eu-north-1",
              "eu-central-1",
              "eu-south-1",
              "eu-south-2",
            ].some((r) => region.includes(r))
            const modelRequiresPrefix = ["claude", "nova-lite", "nova-micro", "llama3", "pixtral"].some((m) =>
              modelID.includes(m),
            )
            if (regionRequiresPrefix && modelRequiresPrefix) {
              modelID = `${regionPrefix}.${modelID}`
            }
            break
          }
          case "ap": {
            const isAustraliaRegion = ["ap-southeast-2", "ap-southeast-4"].includes(region)
            const isTokyoRegion = region === "ap-northeast-1"
            if (
              isAustraliaRegion &&
              ["anthropic.claude-sonnet-4-5", "anthropic.claude-haiku"].some((m) => modelID.includes(m))
            ) {
              regionPrefix = "au"
              modelID = `${regionPrefix}.${modelID}`
            } else if (isTokyoRegion) {
              const modelRequiresPrefix = ["claude", "nova-lite", "nova-micro", "nova-pro"].some((m) =>
                modelID.includes(m),
              )
              if (modelRequiresPrefix) {
                regionPrefix = "jp"
                modelID = `${regionPrefix}.${modelID}`
              }
            } else {
              const modelRequiresPrefix = ["claude", "nova-lite", "nova-micro", "nova-pro"].some((m) =>
                modelID.includes(m),
              )
              if (modelRequiresPrefix) {
                regionPrefix = "apac"
                modelID = `${regionPrefix}.${modelID}`
              }
            }
            break
          }
        }

        return sdk.languageModel(modelID)
      },
    }
  },
  openrouter: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "HTTP-Referer": "https://opencorvus.ai/",
          "X-Title": "opencorvus",
        },
      },
    }
  },
  llmgateway: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "HTTP-Referer": "https://opencorvus.ai/",
          "X-Title": "opencorvus",
          "X-Source": "opencorvus",
        },
      },
    }
  },
  nvidia: async (_provider, context) => {
    const config = context?.config ?? (await Config.get())
    return {
      autoload: Boolean(config.provider?.nvidia),
      options: {
        headers: {
          "HTTP-Referer": "https://opencorvus.ai/",
          "X-Title": "opencorvus",
          "X-BILLING-INVOKE-ORIGIN": "OpenCorvus",
        },
      },
    }
  },
  vercel: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "http-referer": "https://opencorvus.ai/",
          "x-title": "opencorvus",
        },
      },
    }
  },
  "google-vertex": async (provider) => {
    const project =
      provider.options?.project ??
      Env.get("GOOGLE_VERTEX_PROJECT") ??
      Env.get("GOOGLE_CLOUD_PROJECT") ??
      Env.get("GCP_PROJECT") ??
      Env.get("GCLOUD_PROJECT")

    const location =
      provider.options?.location ??
      Env.get("GOOGLE_VERTEX_LOCATION") ??
      Env.get("GOOGLE_CLOUD_LOCATION") ??
      Env.get("VERTEX_LOCATION") ??
      "us-central1"

    const autoload = Boolean(project)
    if (!autoload) return { autoload: false }
    return {
      autoload: true,
      options: {
        project,
        location,
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
          const client = await auth.getClient()
          const token = await client.getAccessToken()

          const headers = new Headers(init?.headers)
          headers.set("Authorization", `Bearer ${token.token}`)

          return fetch(input, { ...init, headers })
        },
      },
      async getModel(sdk: any, modelID: string) {
        const id = String(modelID).trim()
        return sdk.languageModel(id)
      },
    }
  },
  "google-vertex-anthropic": async () => {
    const project =
      Env.get("GOOGLE_VERTEX_PROJECT") ??
      Env.get("GOOGLE_CLOUD_PROJECT") ??
      Env.get("GCP_PROJECT") ??
      Env.get("GCLOUD_PROJECT")
    const location =
      Env.get("GOOGLE_VERTEX_LOCATION") ?? Env.get("GOOGLE_CLOUD_LOCATION") ?? Env.get("VERTEX_LOCATION") ?? "global"
    const autoload = Boolean(project)
    if (!autoload) return { autoload: false }
    return {
      autoload: true,
      options: {
        project,
        location,
        baseURL: googleVertexAnthropicBaseURL(project, location),
      },
      async getModel(sdk: any, modelID) {
        const id = String(modelID).trim()
        return sdk.languageModel(id)
      },
    }
  },
  "sap-ai-core": async () => {
    const auth = await Auth.get("sap-ai-core")
    const envServiceKey = iife(() => {
      const envAICoreServiceKey = process.env.AICORE_SERVICE_KEY
      if (envAICoreServiceKey) return envAICoreServiceKey
      if (auth?.type === "api") return auth.key
      return undefined
    })
    const deploymentId = process.env.AICORE_DEPLOYMENT_ID
    const resourceGroup = process.env.AICORE_RESOURCE_GROUP

    return {
      autoload: !!envServiceKey,
      options: envServiceKey ? { apiKey: envServiceKey, deploymentId, resourceGroup } : {},
      async getModel(sdk: any, modelID: string) {
        return sdk(modelID)
      },
    }
  },
  zenmux: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "HTTP-Referer": "https://opencorvus.ai/",
          "X-Title": "opencorvus",
        },
      },
    }
  },
  gitlab: async (input, context) => {
    const instanceUrl = Env.get("GITLAB_INSTANCE_URL") || "https://gitlab.com"

    const auth = await Auth.get(input.id)
    const apiKey = await (async () => {
      if (auth?.type === "oauth") return auth.access
      if (auth?.type === "api") return auth.key
      return Env.get("GITLAB_TOKEN")
    })()

    const config = context?.config ?? (await Config.get())
    const providerConfig = config.provider?.["gitlab"]

    const aiGatewayHeaders = {
      "User-Agent": `opencorvus/${Installation.VERSION} gitlab-ai-provider/${GITLAB_PROVIDER_VERSION} (${os.platform()} ${os.release()}; ${os.arch()})`,
      ...(providerConfig?.options?.aiGatewayHeaders || {}),
    }

    return {
      autoload: !!apiKey,
      options: {
        instanceUrl,
        apiKey,
        aiGatewayHeaders,
        featureFlags: {
          duo_agent_platform_agentic_chat: true,
          duo_agent_platform: true,
          ...(providerConfig?.options?.featureFlags || {}),
        },
      },
      async getModel(sdk: ReturnType<typeof createGitLab>, modelID: string) {
        return sdk.agenticChat(modelID, {
          aiGatewayHeaders,
          featureFlags: {
            duo_agent_platform_agentic_chat: true,
            duo_agent_platform: true,
            ...(providerConfig?.options?.featureFlags || {}),
          },
        })
      },
    }
  },
  "cloudflare-workers-ai": async (input) => {
    if (input.options?.baseURL) return { autoload: false }

    const auth = await Auth.get(input.id)
    const accountId =
      Env.get("CLOUDFLARE_ACCOUNT_ID") || (auth?.type === "api" ? auth.metadata?.accountId : undefined)
    if (!accountId) {
      return {
        autoload: false,
        async getModel() {
          throw new Error(
            "CLOUDFLARE_ACCOUNT_ID is missing. Set it in the environment or reconnect Cloudflare Workers AI.",
          )
        },
      }
    }

    const apiKey = iife(() => {
      const envToken = Env.get("CLOUDFLARE_API_KEY")
      if (envToken) return envToken
      if (auth?.type === "api") return auth.key
      return undefined
    })

    return {
      autoload: !!apiKey,
      options: {
        apiKey,
        headers: {
          "User-Agent": `opencorvus/${Installation.VERSION} cloudflare-workers-ai (${os.platform()} ${os.release()}; ${os.arch()})`,
        },
      },
      async getModel(sdk: any, modelID: string) {
        return sdk.languageModel(modelID)
      },
    }
  },
  "cloudflare-ai-gateway": async (input) => {
    if (input.options?.baseURL) return { autoload: false }

    const auth = await Auth.get(input.id)
    const accountId =
      Env.get("CLOUDFLARE_ACCOUNT_ID") || (auth?.type === "api" ? auth.metadata?.accountId : undefined)
    const gateway =
      Env.get("CLOUDFLARE_GATEWAY_ID") || (auth?.type === "api" ? auth.metadata?.gatewayId : undefined)

    if (!accountId || !gateway) {
      const missing = [!accountId ? "CLOUDFLARE_ACCOUNT_ID" : undefined, !gateway ? "CLOUDFLARE_GATEWAY_ID" : undefined]
        .filter((value): value is string => Boolean(value))
        .join(" and ")
      return {
        autoload: false,
        async getModel() {
          throw new Error(`${missing} missing. Set them in the environment or reconnect Cloudflare AI Gateway.`)
        },
      }
    }

    const apiToken = await (async () => {
      const envToken = Env.get("CLOUDFLARE_API_TOKEN") || Env.get("CF_AIG_TOKEN")
      if (envToken) return envToken
      if (auth?.type === "api") return auth.key
      return undefined
    })()

    if (!apiToken) {
      throw new Error(
        "CLOUDFLARE_API_TOKEN (or CF_AIG_TOKEN) is required for Cloudflare AI Gateway. " +
          "Set it via environment variable or run `opencorvus auth cloudflare-ai-gateway`.",
      )
    }

    const { createAiGateway } = await import("ai-gateway-provider")
    const { createUnified } = await import("ai-gateway-provider/providers/unified")

    const metadata = input.options?.metadata
    const options = {
      metadata,
      cacheTtl: input.options?.cacheTtl,
      cacheKey: input.options?.cacheKey,
      skipCache: input.options?.skipCache,
      collectLog: input.options?.collectLog,
      headers: {
        "User-Agent": `opencorvus/${Installation.VERSION} cloudflare-ai-gateway (${os.platform()} ${os.release()}; ${os.arch()})`,
      },
    }
    const aigateway = createAiGateway({
      accountId,
      gateway,
      apiKey: apiToken,
      ...(Object.values(options).some((value) => value !== undefined) ? { options } : {}),
    })
    const unified = createUnified({ apiKey: apiToken })

    return {
      autoload: true,
      async getModel(_sdk: any, modelID: string, _options?: Record<string, any>) {
        return aigateway(unified(modelID))
      },
      options: {},
    }
  },
  "snowflake-cortex": async (input, context) => {
    const auth = await Auth.get(input.id)
    const account =
      Env.get("SNOWFLAKE_ACCOUNT") ??
      (auth?.type === "api" ? auth.metadata?.account : undefined) ??
      (auth?.type === "oauth" ? auth.accountId : undefined) ??
      input.options?.account
    const environmentToken = Env.get("SNOWFLAKE_CORTEX_TOKEN") ?? Env.get("SNOWFLAKE_CORTEX_PAT")
    const apiKeyToken = auth?.type === "api" ? auth.key : undefined
    const oauthToken = auth?.type === "oauth" ? auth.access : undefined
    const configToken = input.options?.token ?? input.options?.apiKey
    const token = environmentToken ?? apiKeyToken ?? oauthToken ?? configToken

    if (!account || !token) {
      const missing = [!account ? "SNOWFLAKE_ACCOUNT" : undefined, !token ? "SNOWFLAKE_CORTEX_TOKEN" : undefined]
        .filter((value): value is string => Boolean(value))
        .join(", ")
      return {
        autoload: false,
        async getModel() {
          throw new Error(`Snowflake Cortex is missing credentials: ${missing}`)
        },
      }
    }

    const options: Record<string, any> = {
      baseURL: `https://${account}.snowflakecomputing.com/api/v2/cortex/v1`,
      apiKey: token,
    }
    const useOAuthHandler =
      oauthToken !== undefined &&
      environmentToken === undefined &&
      apiKeyToken === undefined &&
      configToken === undefined

    if (!useOAuthHandler) {
      options.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        let request = init
        if (init?.body && typeof init.body === "string") {
          const body = JSON.parse(init.body)
          if ("max_tokens" in body) {
            body.max_completion_tokens = body.max_tokens
            delete body.max_tokens
            request = { ...init, body: JSON.stringify(body) }
          }
        }

        const response = await fetch(url, request)
        if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) return response

        const reader = response.body.getReader()
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        const stream = new ReadableStream({
          async pull(controller) {
            const { done, value } = await reader.read()
            if (done) {
              controller.close()
              return
            }
            const text = decoder.decode(value, { stream: true })
            controller.enqueue(encoder.encode(text.replace(/"role"\s*:\s*""/g, '"role":"assistant"')))
          },
          cancel(reason) {
            return reader.cancel(reason)
          },
        })
        return new Response(stream, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        })
      }
    }

    const config = context?.config ?? (await Config.get())
    return {
      autoload: Boolean(config.provider?.["snowflake-cortex"]),
      options,
    }
  },
  cerebras: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "X-Cerebras-3rd-Party-Integration": "opencorvus",
        },
      },
    }
  },
  kilo: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "HTTP-Referer": "https://opencorvus.ai/",
          "X-Title": "opencorvus",
        },
      },
    }
  },
}

export function smallModelPriority(_providerID: string, _region?: string): string[] {
  return [
    "claude-haiku-4-5",
    "claude-haiku-4.5",
    "3-5-haiku",
    "3.5-haiku",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gpt-5-nano",
  ]
}
