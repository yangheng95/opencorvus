import fs from "node:fs/promises"
import type { Hooks } from "@opencorvus-ai/plugin"
import { ProviderAuth } from "@/provider/auth"
import { ProviderCredentialExchange } from "@/provider/credential-exchange"
import { Auth } from "@/auth"

const providerID = process.argv[2]
const marker = process.argv[3]
const mode = process.argv[4] ?? "authorization"
const boundary = process.argv[5] ?? "ready"
if (!providerID || !marker) throw new Error("provider-oauth-exchange-worker requires provider ID and marker path")

const hooks: Hooks[] = [
  {
    auth: {
      provider: providerID,
      methods: [
        {
          type: "oauth",
          label: "Killed exchange fixture",
          authorize: async () => ({
            url: "https://auth.example.test/killed-exchange",
            instructions: "fixture",
            method: "code" as const,
            callback: async () => ({ type: "success" as const, key: "new-key-that-must-not-be-persisted" }),
          }),
        },
      ],
    },
  },
]

const block = async ({ flowID }: { flowID: string }) => {
  await fs.writeFile(marker, flowID, "utf8")
  await new Promise<void>(() => undefined)
}
if (boundary === "write") ProviderCredentialExchange.TestHooks.afterCredentialWrite = block
else ProviderCredentialExchange.TestHooks.afterCredentialReady = block

if (mode === "refresh") {
  const current = await Auth.get(providerID)
  if (current?.type !== "oauth") throw new Error("refresh fixture requires an OAuth credential")
  await ProviderCredentialExchange.refresh({
    providerID,
    current,
    exchange: async () => ({ type: "oauth", access: "new-access", refresh: "new-refresh", expires: 999 }),
  })
} else {
  using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(hooks)
  const authorization = await ProviderAuth.authorize({ providerID, method: 0, scope: "global" })
  await ProviderAuth.callback({
    providerID,
    method: 0,
    code: "accepted-code",
    flowID: authorization.flowID,
    scope: "global",
  })
}
