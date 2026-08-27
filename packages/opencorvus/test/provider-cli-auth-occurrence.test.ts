import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import type { Hooks } from "@opencorvus-ai/plugin"
import { Auth } from "@/auth"
import { handlePluginAuth } from "@/cli/cmd/auth"
import { Global } from "@/global"
import { ProviderAuth } from "@/provider/auth"
import { ProviderOAuthFlowStore } from "@/provider/oauth-flow-store"
import { ProviderCredentialExchange } from "@/provider/credential-exchange"
import { Server } from "@/server/server"

const PROVIDER = "cli-flow-provider"
const CREDENTIAL_PROVIDER = "cli-flow-credential-provider"

function promptRuntime(input: { password?: string; text?: string; events: string[] }) {
  return {
    select: async () => "0",
    text: async () => input.text ?? "prompt-value",
    password: async () => input.password ?? "entered-key",
    isCancel: () => false,
    log: {
      info(message: string) {
        input.events.push(`info:${message}`)
      },
      success(message: string) {
        input.events.push(`success:${message}`)
      },
      error(message: string) {
        input.events.push(`error:${message}`)
      },
      warn(message: string) {
        input.events.push(`warn:${message}`)
      },
    },
    spinner: () => ({
      start(message: string) {
        input.events.push(`spinner-start:${message}`)
      },
      stop(message: string) {
        input.events.push(`spinner-stop:${message}`)
      },
    }),
    outro(message: string) {
      input.events.push(`outro:${message}`)
    },
  } as never
}

afterEach(async () => {
  ProviderCredentialExchange.TestHooks.beforeAuthorizationBegin = undefined
  ProviderCredentialExchange.TestHooks.afterExchangeStarted = undefined
  await Auth.remove(PROVIDER)
  await Auth.remove(CREDENTIAL_PROVIDER)
  await fs.rm(path.join(Global.Path.data, "provider-oauth-flows.json"), { force: true })
})

test("CLI OAuth opens and consumes the canonical durable flow before reporting login success", async () => {
  let callbackFlowID: string | undefined
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "CLI OAuth",
            credentialProvider: CREDENTIAL_PROVIDER,
            authorize: async () => ({
              url: "https://auth.example.test/cli",
              instructions: "Authorize the CLI",
              method: "auto" as const,
              callback: async () => {
                callbackFlowID = (await ProviderOAuthFlowStore.TestHooks.exchangeFor(PROVIDER, "project"))?.id
                return {
                  type: "success" as const,
                  refresh: "issued-cli-refresh",
                  access: "issued-cli-access",
                  expires: 123_456,
                  accountId: "cli-account",
                }
              },
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installProjectAuthHooksForTest(hooks)
  const events: string[] = []

  await expect(ProviderAuth.execute({ providerID: PROVIDER, method: 0 })).rejects.toThrow(
    ProviderAuth.MethodExecutionTypeMismatch,
  )
  expect(await handlePluginAuth({ auth: hooks[0]!.auth! }, PROVIDER, promptRuntime({ events }))).toBe(true)
  expect({
    flow: await ProviderOAuthFlowStore.get(callbackFlowID!),
    credential: await Auth.get(CREDENTIAL_PROVIDER),
  }).toEqual({
    flow: expect.objectContaining({
      id: callbackFlowID,
      providerID: PROVIDER,
      scope: "project",
      method: 0,
      state: "consumed",
    }),
    credential: {
      type: "oauth",
      refresh: "issued-cli-refresh",
      access: "issued-cli-access",
      expires: 123_456,
      accountId: "cli-account",
    },
  })
  expect(events).toEqual([
    "info:Go to: https://auth.example.test/cli",
    "info:Authorize the CLI",
    "spinner-start:Waiting for authorization...",
    "spinner-stop:Login successful",
    "outro:Done",
  ])
})

test("CLI plugin API auth delegates alias and merged prompt metadata to ProviderAuth", async () => {
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "api",
            label: "CLI API",
            prompts: [{ type: "text", key: "tenant", message: "Tenant" }],
            authorize: async (inputs) => ({
              type: "success" as const,
              provider: CREDENTIAL_PROVIDER,
              key: inputs!.key,
              metadata: { region: "test-region" },
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installProjectAuthHooksForTest(hooks)
  const events: string[] = []

  expect(
    await handlePluginAuth(
      { auth: hooks[0]!.auth! },
      PROVIDER,
      promptRuntime({ events, text: "test-tenant", password: "entered-cli-key" }),
    ),
  ).toBe(true)
  expect(await Auth.get(CREDENTIAL_PROVIDER)).toEqual({
    type: "api",
    key: "entered-cli-key",
    metadata: { tenant: "test-tenant", region: "test-region" },
  })
  expect(events).toEqual(["success:Login successful", "outro:Done"])
})

test("global OAuth authorize returns typed public refusals for provider, method, and method kind", async () => {
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [{ type: "api", label: "API only" }],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const request = (providerID: string, method: number) =>
    Server.App().request(`/global/providers/${providerID}/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    })

  const responses = await Promise.all([request("missing-provider", 0), request(PROVIDER, 2), request(PROVIDER, 0)])
  expect(
    await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: await response.json(),
      })),
    ),
  ).toEqual([
    {
      status: 400,
      body: { name: "ProviderAuthProviderNotFound", data: { providerID: "missing-provider" } },
    },
    {
      status: 400,
      body: { name: "ProviderAuthMethodNotFound", data: { providerID: PROVIDER, method: 2 } },
    },
    {
      status: 400,
      body: {
        name: "ProviderAuthMethodAuthorizationTypeMismatch",
        data: { providerID: PROVIDER, method: 0, expected: "oauth", actual: "api" },
      },
    },
  ])
})

test("global OAuth authorize returns the typed active-exchange conflict", async () => {
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "Active OAuth",
            authorize: async () => ({
              url: "https://auth.example.test/active",
              instructions: "fixture",
              method: "code" as const,
              callback: async () => ({ type: "success" as const, key: "unused" }),
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const observed = await Auth.observe(PROVIDER)
  const flow = await ProviderOAuthFlowStore.open({
    providerID: PROVIDER,
    expectedCredentialGeneration: observed.generation,
    ownerID: "active-owner",
    scope: "global",
    method: 0,
    inputsDigest: ProviderOAuthFlowStore.digestInputs(undefined),
  })
  const active = await ProviderOAuthFlowStore.beginExchange({ id: flow.id, ownerID: "active-owner" })
  if (!active?.exchangeLeaseExpiresAt) throw new Error("Active OAuth fixture did not acquire its exchange lease")

  const response = await Server.App().request(`/global/providers/${PROVIDER}/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: 0 }),
  })
  expect({ status: response.status, body: await response.json() }).toEqual({
    status: 409,
    body: {
      name: "ProviderAuthOAuthExchangeActiveError",
      data: {
        providerID: PROVIDER,
        scope: "global",
        flowID: flow.id,
        leaseExpiresAt: active.exchangeLeaseExpiresAt,
      },
    },
  })
})

test("global OAuth authorize returns the typed saved-Auth read failure", async () => {
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "Auth-read OAuth",
            authorize: async () => ({
              url: "https://auth.example.test/read",
              instructions: "fixture",
              method: "code" as const,
              callback: async () => ({ type: "success" as const, key: "unused" }),
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const authPath = path.join(Global.Path.data, "auth.json")
  await fs.writeFile(authPath, '{"malformed":', { mode: 0o600 })
  try {
    const response = await Server.App().request(`/global/providers/${PROVIDER}/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: 0 }),
    })
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 503,
      body: {
        name: "AuthReadError",
        data: {
          operation: "read_saved_credentials",
          reason: "malformed_json",
          message: "Saved Provider credentials contain malformed JSON",
        },
      },
    })
  } finally {
    await fs.rm(authPath, { force: true })
  }
})

test("global OAuth callback returns the typed credential-generation conflict", async () => {
  let disposals = 0
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "Generation-bound OAuth",
            authorize: async () => ({
              url: "https://auth.example.test/generation",
              instructions: "fixture",
              method: "code" as const,
              dispose: async () => {
                disposals++
              },
              callback: async () => ({ type: "success" as const, key: "callback-key" }),
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
  await Auth.set(PROVIDER, { type: "api", key: "operator-key" })

  const response = await Server.App().request(`/global/providers/${PROVIDER}/oauth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: 0, code: "accepted-code", flowID: authorization.flowID }),
  })
  expect({
    status: response.status,
    body: await response.json(),
    credential: await Auth.get(PROVIDER),
    disposals,
  }).toEqual({
    status: 409,
    body: {
      name: "ProviderCredentialExchangeReplacedError",
      data: { providerID: PROVIDER, flowID: authorization.flowID },
    },
    credential: { type: "api", key: "operator-key" },
    disposals: 1,
  })
})

test("global OAuth callback returns the typed uncertain-exchange conflict when its owner expires", async () => {
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "Expiring OAuth",
            authorize: async () => ({
              url: "https://auth.example.test/expiring",
              instructions: "fixture",
              method: "code" as const,
              callback: async () => {
                const active = await ProviderOAuthFlowStore.TestHooks.exchangeFor(PROVIDER, "global")
                if (!active) throw new Error("Expected the callback exchange occurrence")
                await ProviderOAuthFlowStore.TestHooks.expireExchange(active.id)
                return { type: "success" as const, key: "uncommitted-key" }
              },
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })

  const response = await Server.App().request(`/global/providers/${PROVIDER}/oauth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: 0, code: "accepted-code", flowID: authorization.flowID }),
  })
  expect({
    status: response.status,
    body: await response.json(),
    occurrence: await ProviderOAuthFlowStore.get(authorization.flowID),
  }).toEqual({
    status: 409,
    body: {
      name: "ProviderAuthOAuthExchangeUncertainError",
      data: { providerID: PROVIDER, flowID: authorization.flowID },
    },
    occurrence: expect.objectContaining({ state: "exchange_uncertain" }),
  })
})

test("global OAuth callback projects a fixed typed failure when the endpoint exception contains credential fields", async () => {
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "Secret-bearing failure OAuth",
            authorize: async () => ({
              url: "https://auth.example.test/failure",
              instructions: "fixture",
              method: "code" as const,
              callback: async () => {
                throw new Error('{"access_token":"fixture-access","client_secret":"fixture-secret"}')
              },
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })

  const response = await Server.App().request(`/global/providers/${PROVIDER}/oauth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: 0, code: "accepted-code", flowID: authorization.flowID }),
  })
  expect({
    status: response.status,
    body: await response.json(),
    occurrence: await ProviderOAuthFlowStore.get(authorization.flowID),
  }).toEqual({
    status: 409,
    body: {
      name: "ProviderCredentialExchangeFailedError",
      data: { providerID: PROVIDER, flowID: authorization.flowID },
    },
    occurrence: expect.objectContaining({
      state: "failed",
      error: "Provider credential exchange failed before producing a credential",
    }),
  })
})

test("concurrent global OAuth callbacks publish one success and one typed settlement conflict", async () => {
  const hooks: Hooks[] = [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "Concurrent OAuth",
            authorize: async () => ({
              url: "https://auth.example.test/concurrent",
              instructions: "fixture",
              method: "code" as const,
              callback: async () => ({ type: "success" as const, key: "winner-key" }),
            }),
          },
        ],
      },
    },
  ]
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
  let arrivals = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  ProviderCredentialExchange.TestHooks.beforeAuthorizationBegin = async () => {
    arrivals++
    if (arrivals === 2) release()
    await gate
  }
  const callbackRequest = () =>
    Server.App().request(`/global/providers/${PROVIDER}/oauth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: 0, code: "accepted-code", flowID: authorization.flowID }),
    })

  const responses = await Promise.all([callbackRequest(), callbackRequest()])
  const projected = await Promise.all(
    responses.map(async (response) => ({ status: response.status, body: await response.json() })),
  )
  projected.sort((left, right) => left.status - right.status)
  expect({ projected, credential: await Auth.get(PROVIDER) }).toEqual({
    projected: [
      { status: 200, body: { ok: true, issues: [] } },
      {
        status: 409,
        body: {
          name: "ProviderCredentialExchangeFailedError",
          data: { providerID: PROVIDER, flowID: authorization.flowID },
        },
      },
    ],
    credential: { type: "api", key: "winner-key" },
  })
})
