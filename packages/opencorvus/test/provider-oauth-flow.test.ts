import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Global } from "@/global"
import { ProviderAuth } from "@/provider/auth"
import { ProviderOAuthFlowStore } from "@/provider/oauth-flow-store"

const PROVIDER = "flow-test-provider"

function oauthHook(input: { onCallback: (code?: string) => Promise<unknown> }) {
  return [
    {
      auth: {
        provider: PROVIDER,
      methods: [
        {
          type: "oauth",
          label: "Test OAuth",
          authorize: async () => ({
            url: "https://auth.example.test/flow",
            instructions: "open the URL",
            method: "code" as const,
            callback: (code: string) => input.onCallback(code),
          }),
        },
        {
          type: "oauth",
          label: "Second method",
          authorize: async () => ({
            url: "https://auth.example.test/other",
            instructions: "open the URL",
            method: "code" as const,
            callback: (code: string) => input.onCallback(code),
          }),
        },
        ],
      },
    },
  ] as never
}

afterEach(async () => {
  await Auth.remove(PROVIDER)
  await fs.rm(path.join(Global.Path.data, "provider-oauth-flows.json"), { force: true })
})

describe("Provider OAuth flow occurrence", () => {
  test("a finished flow consumes its exact occurrence once and writes the credential", async () => {
    const codes: string[] = []
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onCallback: async (code) => {
          codes.push(code ?? "")
          return { type: "success", key: "issued-key" }
        },
      }),
    )

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    expect(authorization).toMatchObject({ url: "https://auth.example.test/flow", method: "code" })
    const flowID = authorization!.flowID
    expect((await ProviderOAuthFlowStore.get(flowID))?.state).toBe("pending")

    await ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "abc", flowID, scope: "global" })
    expect(codes).toEqual(["abc"])
    expect((await ProviderOAuthFlowStore.get(flowID))?.state).toBe("consumed")
    expect(await Auth.get(PROVIDER)).toMatchObject({ type: "api", key: "issued-key" })

    // The occurrence is single-shot: finishing it again is an exact refusal,
    // not a second credential write.
    await expect(
      ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "abc", flowID, scope: "global" }),
    ).rejects.toThrow(ProviderAuth.OauthFlowAlreadySettled)
  })

  test("a second authorize supersedes the first flow as a durable fact, not a silent replacement", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "issued-key" }) }),
    )

    const first = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    const second = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    expect(second!.flowID).not.toBe(first!.flowID)
    expect((await ProviderOAuthFlowStore.get(first!.flowID))?.state).toBe("superseded")

    // The superseded flow's code cannot finish anything.
    await expect(
      ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "stale", flowID: first!.flowID, scope: "global" }),
    ).rejects.toThrow(ProviderAuth.OauthMissing)

    // The live flow still finishes.
    await ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "live", flowID: second!.flowID, scope: "global" })
    expect((await ProviderOAuthFlowStore.get(second!.flowID))?.state).toBe("consumed")
  })

  test("the callback binds the method to the occurrence instead of matching only the provider", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "issued-key" }) }),
    )

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 1, scope: "global" })
    await expect(
      ProviderAuth.callback({
        providerID: PROVIDER,
        method: 0,
        code: "abc",
        flowID: authorization!.flowID,
        scope: "global",
      }),
    ).rejects.toThrow(ProviderAuth.OauthFlowMismatch)
    // The mismatch settles nothing: the flow is still finishable by the
    // method that actually opened it.
    expect((await ProviderOAuthFlowStore.get(authorization!.flowID))?.state).toBe("pending")
  })

  test("a durable occurrence whose executor lived in a dead process fails with that exact fact", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "issued-key" }) }),
    )

    // Another process opened this flow: the occurrence is durable, the plugin
    // closure is not.
    const foreign = await ProviderOAuthFlowStore.open({
      providerID: PROVIDER,
      scope: "global",
      method: 0,
      inputsDigest: ProviderOAuthFlowStore.digestInputs(undefined),
    })

    await expect(
      ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "abc", flowID: foreign.id, scope: "global" }),
    ).rejects.toThrow(ProviderAuth.OauthFlowNotExecutable)
  })

  test("a failing plugin callback settles the occurrence as failed with the plugin's error", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onCallback: async () => {
          throw new Error("token endpoint rejected the code")
        },
      }),
    )

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await expect(
      ProviderAuth.callback({
        providerID: PROVIDER,
        method: 0,
        code: "abc",
        flowID: authorization!.flowID,
        scope: "global",
      }),
    ).rejects.toThrow("token endpoint rejected the code")
    expect(await ProviderOAuthFlowStore.get(authorization!.flowID)).toMatchObject({
      state: "failed",
      error: "token endpoint rejected the code",
    })
  })
})
