import { beforeEach, describe, expect, mock, test } from "bun:test"

let promptResponse: unknown = []
let apiCalls: Array<{ path: string; body: any }> = []

mock.module("../src/services/api", () => ({
  apiJson: async (path: string, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
    apiCalls.push({ path, body })
    const route = path.split("?", 1)[0] || path
    if (route.endsWith("/auth/prompts")) return promptResponse
    if (route.endsWith("/auth/execute")) return true
    if (route.endsWith("/oauth/authorize")) {
      return { url: "https://auth.openai.com/oauth/authorize", method: "code", instructions: "Sign in" }
    }
    if (route.endsWith("/oauth/callback")) return true
    throw new Error(`unexpected api path ${path}`)
  },
}))

const { setAppStore } = await import("../src/store/app")
const { setLocaleData } = await import("../src/utils/i18n")
const {
  authenticateSelectedProvider,
  authorizeProvider,
  connectedModelOptions,
  providerAuthInputs,
  runProviderAuthMethod,
} = await import("../src/services/llm")
type AuthDialogCallbacks = import("../src/services/llm").AuthDialogCallbacks

function authCallbacks(overrides: Partial<AuthDialogCallbacks> = {}): AuthDialogCallbacks {
  return {
    nativePrompt: async () => null,
    nativeSelect: async () => null,
    nativeConfirm: async () => false,
    nativeOpen: async () => false,
    externalUrlNeedsUserGesture: false,
    showLlmNotice: () => undefined,
    onAuthCancelled: () => undefined,
    ...overrides,
  }
}

describe("provider auth select source", () => {
  beforeEach(() => {
    promptResponse = []
    apiCalls = []
    setLocaleData("en-US", {
      common: { cancel: "Cancel", ok: "OK", submit: "Submit" },
      llm: {
        title: "Provider authentication",
        auth_choose_method: "Choose auth method",
        auth_method: "Auth method",
        auth_type_api: "API",
        auth_type_oauth: "OAuth",
        status: {
          connected: "Connected",
          available: "Available",
        },
        detail: {
          connected: "Connected",
          available: "Available",
        },
      },
      provider: {
        api_key: {
          label: "API Key",
          placeholder_empty: "Paste a provider API key",
        },
      },
    })
    setAppStore({
      providerCatalog: {
        all: [
          { id: "custom-api", name: "Custom API" },
          { id: "mixed-provider", name: "Mixed Provider" },
          { id: "openai", name: "OpenAI" },
          { id: "xai", name: "xAI" },
        ],
        connected: [],
        default: {},
      },
      providerAuth: {},
    })
  })

  test("connected model choices come from the canonical connected catalog and expose only real variants", () => {
    setAppStore({
      providerCatalog: {
        all: [
          {
            id: "connected",
            name: "Connected Provider",
            models: {
              zeta: { id: "zeta", name: "Zeta", variants: { high: {}, low: {} } },
              alpha: { id: "alpha", name: "Alpha" },
            },
          },
          {
            id: "disconnected",
            name: "Disconnected Provider",
            models: { hidden: { id: "hidden", name: "Hidden" } },
          },
        ],
        connected: ["connected"],
        default: {},
      },
    })

    expect(connectedModelOptions()).toEqual([
      {
        value: "connected/alpha",
        providerID: "connected",
        providerLabel: "Connected Provider",
        modelID: "alpha",
        modelLabel: "Alpha",
        variants: [],
      },
      {
        value: "connected/zeta",
        providerID: "connected",
        providerLabel: "Connected Provider",
        modelID: "zeta",
        modelLabel: "Zeta",
        variants: ["high", "low"],
      },
    ])
  })

  test("provider auth select prompts reject missing selectValue before native select opens", async () => {
    promptResponse = [
      {
        type: "select",
        key: "region",
        message: "Region",
        options: [
          { label: "Europe", value: "eu" },
          { label: "United States", value: "us" },
        ],
      },
    ]
    let selectCalls = 0

    await expect(
      providerAuthInputs("custom-api", 0, {
        nativePrompt: async () => null,
        nativeSelect: async () => {
          selectCalls += 1
          return null
        },
      }),
    ).rejects.toThrow("requires selectValue")
    expect(selectCalls).toBe(0)
  })

  test("provider auth select prompts reject invalid selectValue before native select opens", async () => {
    promptResponse = [
      {
        type: "select",
        key: "region",
        message: "Region",
        selectValue: "apac",
        options: [
          { label: "Europe", value: "eu" },
          { label: "United States", value: "us" },
        ],
      },
    ]
    let selectCalls = 0

    await expect(
      providerAuthInputs("custom-api", 0, {
        nativePrompt: async () => null,
        nativeSelect: async () => {
          selectCalls += 1
          return null
        },
      }),
    ).rejects.toThrow("is not in options")
    expect(selectCalls).toBe(0)
  })

  test("provider auth select prompts pass the protocol selectValue to native select", async () => {
    promptResponse = [
      {
        type: "select",
        key: "region",
        message: "Region",
        selectValue: "us",
        options: [
          { label: "Europe", value: "eu" },
          { label: "United States", value: "us" },
        ],
      },
    ]

    const inputs = await providerAuthInputs("custom-api", 0, {
      nativePrompt: async () => null,
      nativeSelect: async (_message, opts) => {
        expect(opts.selectValue).toBe("us")
        return opts.selectValue
      },
    })

    expect(inputs).toEqual({ region: "us" })
    expect(apiCalls[1]?.body?.inputs).toEqual({ region: "us" })
  })

  test("API auth collects provider metadata then sends the separately prompted key in one execute request", async () => {
    promptResponse = [{ type: "text", key: "resourceName", message: "Azure resource" }]
    const answers = ["project-models", "azure-secret"]
    const promptTypes: Array<string | undefined> = []

    const result = await runProviderAuthMethod(
      "custom-api",
      { index: 0, type: "api", label: "API key", preferred: false },
      authCallbacks({
        nativePrompt: async (_message, opts) => {
          promptTypes.push(opts.inputType)
          return answers.shift() ?? null
        },
      }),
    )

    expect(result).toBe(true)
    expect(promptTypes).toEqual([undefined, "password"])
    expect(apiCalls.at(-1)).toMatchObject({
      path: "global/providers/custom-api/auth/execute",
      body: { method: 0, inputs: { key: "azure-secret", resourceName: "project-models" } },
    })
  })

  test("multiple auth methods use the explicit preferred method as selectValue", async () => {
    setAppStore("providerAuth", {
      "mixed-provider": [
        { type: "api", label: "API key" },
        { type: "oauth", label: "Browser OAuth", preferred: true },
      ],
    })
    const selections: string[] = []

    const ok = await authenticateSelectedProvider(
      "mixed-provider",
      authCallbacks({
        nativeSelect: async (_message, opts) => {
          selections.push(opts.selectValue)
          return null
        },
      }),
    )

    expect(ok).toBe(false)
    expect(selections).toEqual(["1"])
  })

  test("multiple auth methods without a preferred marker use upstream declaration order", async () => {
    setAppStore("providerAuth", {
      "mixed-provider": [
        { type: "api", label: "API key" },
        { type: "oauth", label: "Browser OAuth" },
      ],
    })
    const selections: string[] = []

    const ok = await authenticateSelectedProvider(
      "mixed-provider",
      authCallbacks({
        nativeSelect: async (_message, opts) => {
          selections.push(opts.selectValue)
          return null
        },
      }),
    )

    expect(ok).toBe(false)
    expect(selections).toEqual(["0"])
  })

  test.each([
    [
      "openai",
      [
        { type: "oauth", label: "ChatGPT Plus/Pro" },
        { type: "oauth", label: "ChatGPT Plus/Pro (Headless)" },
        { type: "api", label: "Manually enter API Key" },
      ],
    ],
    [
      "xai",
      [
        { type: "oauth", label: "xAI Grok OAuth (SuperGrok Subscription)" },
        { type: "oauth", label: "xAI Grok OAuth (Headless / Remote / VPS)" },
        { type: "api", label: "Manually enter API Key" },
      ],
    ],
  ])("%s exposes every upstream method and selects the first declared method", async (providerID, methods) => {
    setAppStore("providerAuth", { [providerID]: methods })
    let observed: Parameters<AuthDialogCallbacks["nativeSelect"]>[1] | undefined

    const ok = await authenticateSelectedProvider(
      providerID,
      authCallbacks({
        nativeSelect: async (_message, opts) => {
          observed = opts
          return null
        },
      }),
    )

    expect(ok).toBe(false)
    expect(observed?.selectValue).toBe("0")
    expect(observed?.options.map((option) => option.label)).toEqual(methods.map((method) => method.label))
  })

  test("OpenAI manual API method prompts for a masked key and executes the upstream method index", async () => {
    setAppStore("providerAuth", {
      openai: [
        { type: "oauth", label: "ChatGPT Plus/Pro" },
        { type: "oauth", label: "ChatGPT Plus/Pro (Headless)" },
        { type: "api", label: "Manually enter API Key" },
      ],
    })
    let promptType: string | undefined

    const ok = await authenticateSelectedProvider(
      "openai",
      authCallbacks({
        nativeSelect: async () => "2",
        nativePrompt: async (_message, opts) => {
          promptType = opts.inputType
          return "sk-openai-test"
        },
      }),
    )

    expect(ok).toBe(true)
    expect(promptType).toBe("password")
    expect(apiCalls.at(-1)).toMatchObject({
      path: "global/providers/openai/auth/execute",
      body: { method: 2, inputs: { key: "sk-openai-test" } },
    })
  })

  test("global OAuth authorize and callback never inject a project directory", async () => {
    setAppStore("providerAuth", {
      openai: [{ type: "oauth", label: "ChatGPT Pro/Plus (browser)" }],
    })
    const opened: string[] = []

    const ok = await authorizeProvider(
      "openai",
      0,
      authCallbacks({
        nativeOpen: async (url) => {
          opened.push(url)
          return true
        },
        nativePrompt: async () => "global-oauth-code",
      }),
    )

    expect(ok).toBe(true)
    expect(opened).toEqual(["https://auth.openai.com/oauth/authorize"])
    expect(apiCalls.map((call) => call.path)).toEqual([
      "global/providers/openai/auth/prompts",
      "global/providers/openai/oauth/authorize",
      "global/providers/openai/oauth/callback",
    ])
  })

  test("an explicit project directory retains project-scoped auth routes", async () => {
    const ok = await runProviderAuthMethod(
      "custom-api",
      { index: 0, type: "api", label: "API key" },
      authCallbacks({ nativePrompt: async () => "project-api-key" }),
      { directory: "D:/repo/project" },
    )

    expect(ok).toBe(true)
    expect(apiCalls.map((call) => call.path)).toEqual([
      "provider/custom-api/auth/prompts?directory=D%3A%2Frepo%2Fproject",
      "provider/custom-api/auth/execute?directory=D%3A%2Frepo%2Fproject",
    ])
  })
})
