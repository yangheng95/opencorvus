import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import type { Hooks } from "@opencorvus-ai/plugin"
import { Auth } from "@/auth"
import { handlePluginAuth } from "@/cli/cmd/auth"
import { Global } from "@/global"
import { ProviderAuth } from "@/provider/auth"
import { ProviderOAuthFlowStore } from "@/provider/oauth-flow-store"
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
            authorize: async () => ({
              url: "https://auth.example.test/cli",
              instructions: "Authorize the CLI",
              method: "auto" as const,
              callback: async () => {
                callbackFlowID = (await ProviderOAuthFlowStore.TestHooks.pendingFor(PROVIDER, "project"))?.id
                return {
                  type: "success" as const,
                  provider: CREDENTIAL_PROVIDER,
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
