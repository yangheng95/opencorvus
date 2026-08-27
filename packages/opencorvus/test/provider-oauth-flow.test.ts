import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { Auth } from "@/auth"
import { Global } from "@/global"
import { ProviderAuth } from "@/provider/auth"
import { ProviderOAuthFlowStore } from "@/provider/oauth-flow-store"
import { ProviderCredentialExchange } from "@/provider/credential-exchange"
import { GitlabAuthPlugin, GitlabAuthTestHooks } from "@/plugin/gitlab"
import { ManagedOAuthListenerOwner } from "@/plugin/oauth-lifecycle"

const PROVIDER = "flow-test-provider"
const ALIAS_PROVIDER = "flow-test-credential-alias"

function oauthHook(input: {
  onCallback: (code?: string) => Promise<unknown>
  onDispose?: () => void | Promise<void>
  provider?: string
}) {
  return [
    {
      auth: {
        provider: PROVIDER,
        methods: [
          {
            type: "oauth",
            label: "Test OAuth",
            credentialProvider: input.provider,
            authorize: async () => {
              return {
                url: "https://auth.example.test/flow",
                instructions: "open the URL",
                method: "code" as const,
                dispose: input.onDispose
                  ? async () => {
                      await input.onDispose?.()
                    }
                  : undefined,
                callback: (code: string) => input.onCallback(code),
              }
            },
          },
          {
            type: "oauth",
            label: "Second method",
            credentialProvider: input.provider,
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
  ProviderCredentialExchange.TestHooks.beforeAuthorizationBegin = undefined
  ProviderCredentialExchange.TestHooks.afterExchangeStarted = undefined
  ProviderCredentialExchange.TestHooks.afterCredentialReady = undefined
  ProviderCredentialExchange.TestHooks.afterCredentialCommit = undefined
  ProviderCredentialExchange.TestHooks.afterCredentialWrite = undefined
  ProviderCredentialExchange.TestHooks.exchangeRenewalIntervalMs = undefined
  ProviderAuth.TestHooks.pendingRenewalIntervalMs = undefined
  ProviderOAuthFlowStore.TestHooks.beforeRenewPending = undefined
  ProviderOAuthFlowStore.TestHooks.beforeFailPending = undefined
  ProviderOAuthFlowStore.TestHooks.beforeRenewExchange = undefined
  GitlabAuthTestHooks.oauthPort = undefined
  GitlabAuthTestHooks.callbackTimeoutMs = undefined
  GitlabAuthTestHooks.openBrowser = undefined
  GitlabAuthTestHooks.beforeListenerStop = undefined
  GitlabAuthTestHooks.exchangeToken = undefined
  await Auth.remove(PROVIDER)
  await Auth.remove(ALIAS_PROVIDER)
  await Auth.remove("gitlab")
  await fs.rm(path.join(Global.Path.data, "provider-oauth-flows.json"), { force: true })
})

async function waitForFile(filepath: string): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const value = await fs.readFile(filepath, "utf8").catch(() => undefined)
    if (value) return value.trim()
    await Bun.sleep(25)
  }
  throw new Error(`Timed out waiting for ${filepath}`)
}

class FakeOAuthListener {
  listening = true
  closeCalls = 0
  private closeResults: Array<Error | "pending" | undefined>
  private pendingClose: ((error?: Error) => void) | undefined

  constructor(...closeResults: Array<Error | "pending" | undefined>) {
    this.closeResults = closeResults
  }

  once(_event: "error", _listener: (error: Error) => void) {}
  removeListener(_event: "error", _listener: (error: Error) => void) {}

  close(callback?: (error?: Error) => void) {
    this.closeCalls++
    const result = this.closeResults.shift()
    if (result === "pending") {
      this.pendingClose = callback
      return
    }
    if (!result) this.listening = false
    queueMicrotask(() => callback?.(result))
  }

  finishPendingClose() {
    this.listening = false
    const callback = this.pendingClose
    this.pendingClose = undefined
    callback?.()
  }
}

describe.serial("Provider OAuth flow occurrence", () => {
  test("a listener close failure retains its exact owner for retry before a fresh listener starts", async () => {
    const owner = new ManagedOAuthListenerOwner<FakeOAuthListener>()
    const first = new FakeOAuthListener(new Error("transient close failure"), undefined)
    await owner.start(
      () => first,
      (_server, ready) => ready(),
    )
    const firstLease = owner.acquire()

    await expect(owner.stop(firstLease)).rejects.toThrow("transient close failure")
    await owner.stop(firstLease)

    const second = new FakeOAuthListener(undefined)
    const started = await owner.start(
      () => second,
      (_server, ready) => ready(),
    )
    const secondLease = owner.acquire()
    await owner.stop(secondLease)

    expect({ firstCloseCalls: first.closeCalls, started, secondCloseCalls: second.closeCalls }).toEqual({
      firstCloseCalls: 2,
      started: second,
      secondCloseCalls: 1,
    })
  })

  test("concurrent exact-lease listener disposal callers converge on one close", async () => {
    const owner = new ManagedOAuthListenerOwner<FakeOAuthListener>()
    const listener = new FakeOAuthListener("pending")
    await owner.start(
      () => listener,
      (_server, ready) => ready(),
    )
    const lease = owner.acquire()

    const first = owner.stop(lease)
    const second = owner.stop(lease)
    expect(listener.closeCalls).toBe(1)
    const replacement = new FakeOAuthListener(undefined)
    const starting = owner.start(
      () => replacement,
      (_server, ready) => ready(),
    )
    listener.finishPendingClose()
    await Promise.all([first, second])
    const started = await starting
    const replacementLease = owner.acquire()
    await owner.stop(replacementLease)

    expect({ closeCalls: listener.closeCalls, listening: listener.listening, started }).toEqual({
      closeCalls: 1,
      listening: false,
      started: replacement,
    })
  })

  test("a finished flow consumes its exact occurrence once and writes the credential", async () => {
    const codes: string[] = []
    const phases: Array<{ hook: string; state: string; credential?: Auth.Info }> = []
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onCallback: async (code) => {
          codes.push(code ?? "")
          return { type: "success", key: "issued-key" }
        },
      }),
    )
    ProviderCredentialExchange.TestHooks.afterExchangeStarted = async ({ flowID }) => {
      phases.push({ hook: "exchange-started", state: (await ProviderOAuthFlowStore.get(flowID))!.state })
    }
    ProviderCredentialExchange.TestHooks.afterCredentialReady = async ({ flowID }) => {
      phases.push({ hook: "credential-ready", state: (await ProviderOAuthFlowStore.get(flowID))!.state })
    }
    ProviderCredentialExchange.TestHooks.afterCredentialWrite = async ({ flowID }) => {
      phases.push({
        hook: "credential-written",
        state: (await ProviderOAuthFlowStore.get(flowID))!.state,
        credential: await Auth.get(PROVIDER),
      })
    }

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    expect(authorization).toMatchObject({ url: "https://auth.example.test/flow", method: "code" })
    const flowID = authorization!.flowID
    expect((await ProviderOAuthFlowStore.get(flowID))?.state).toBe("pending")

    await ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "abc", flowID, scope: "global" })
    expect(codes).toEqual(["abc"])
    expect((await ProviderOAuthFlowStore.get(flowID))?.state).toBe("consumed")
    expect(await Auth.get(PROVIDER)).toMatchObject({ type: "api", key: "issued-key" })
    expect(phases).toEqual([
      { hook: "exchange-started", state: "exchanging" },
      { hook: "credential-ready", state: "credential_ready" },
      {
        hook: "credential-written",
        state: "credential_ready",
        credential: { type: "api", key: "issued-key" },
      },
    ])

    // The occurrence is single-shot: finishing it again is an exact refusal,
    // not a second credential write.
    await expect(
      ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "abc", flowID, scope: "global" }),
    ).rejects.toThrow(ProviderAuth.OauthFlowAlreadySettled)
  })

  test("a pending authorization retains its exact executor owner until callback settlement", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "issued-key" }) }),
    )

    const first = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await expect(ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })).rejects.toThrow(
      ProviderOAuthFlowStore.ExchangeActiveError,
    )
    expect(await ProviderOAuthFlowStore.get(first.flowID)).toMatchObject({
      state: "pending",
      exchangeOwnerID: expect.any(String),
      exchangeLeaseExpiresAt: expect.any(Number),
    })

    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "live",
      flowID: first.flowID,
      scope: "global",
    })
    expect((await ProviderOAuthFlowStore.get(first.flowID))?.state).toBe("consumed")
  })

  test("a code flow remains pending after a typed missing-code response and succeeds with the same occurrence", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async (code) => ({ type: "success", key: `issued-${code}` }) }),
    )

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await expect(
      ProviderAuth.callback({ providerID: PROVIDER, method: 0, flowID: authorization.flowID, scope: "global" }),
    ).rejects.toThrow(ProviderAuth.OauthCodeMissing)
    expect(await ProviderOAuthFlowStore.get(authorization.flowID)).toMatchObject({
      state: "pending",
      exchangeOwnerID: expect.any(String),
    })

    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "retry-code",
      flowID: authorization.flowID,
      scope: "global",
    })
    expect({
      credential: await Auth.get(PROVIDER),
      occurrence: await ProviderOAuthFlowStore.get(authorization.flowID),
    }).toEqual({
      credential: { type: "api", key: "issued-retry-code" },
      occurrence: expect.objectContaining({ state: "consumed" }),
    })
  })

  test("a pending executor retries a transient renewal fault and settles through its same owner", async () => {
    ProviderAuth.TestHooks.pendingRenewalIntervalMs = 5
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "renewed-owner-key" }) }),
    )
    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    let renewalAttempts = 0
    ProviderOAuthFlowStore.TestHooks.beforeRenewPending = async () => {
      renewalAttempts++
      if (renewalAttempts === 1) throw new Error("transient shared-file observation fault")
    }
    for (let attempt = 0; renewalAttempts < 2 && attempt < 100; attempt++) await Bun.sleep(5)

    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "renewed",
      flowID: authorization.flowID,
      scope: "global",
    })
    expect({ renewalAttempts, flow: await ProviderOAuthFlowStore.get(authorization.flowID) }).toEqual({
      renewalAttempts: expect.any(Number),
      flow: expect.objectContaining({ state: "consumed" }),
    })
    expect(renewalAttempts).toBeGreaterThanOrEqual(2)
  })

  test("authorization preparation tolerates a transient immediate owner-renewal observation", async () => {
    let renewalAttempts = 0
    ProviderOAuthFlowStore.TestHooks.beforeRenewPending = async () => {
      renewalAttempts++
      if (renewalAttempts === 1) throw new Error("transient immediate renewal observation fault")
    }
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "prepared-key" }) }),
    )

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "prepared",
      flowID: authorization.flowID,
      scope: "global",
    })
    expect({ renewalAttempts, occurrence: await ProviderOAuthFlowStore.get(authorization.flowID) }).toEqual({
      renewalAttempts: expect.any(Number),
      occurrence: expect.objectContaining({ state: "consumed" }),
    })
    expect(renewalAttempts).toBeGreaterThanOrEqual(1)
  })

  test("authorization preparation always disposes its plugin result when durable settlement also fails", async () => {
    let disposalAttempts = 0
    let failedFlowID: string | undefined
    ProviderOAuthFlowStore.TestHooks.beforeRenewPending = async ({ id }) => {
      failedFlowID = id
      await ProviderOAuthFlowStore.TestHooks.expirePending(id)
    }
    ProviderOAuthFlowStore.TestHooks.beforeFailPending = async () => {
      throw new Error("transient pending settlement fault")
    }
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onDispose: () => disposalAttempts++,
        onCallback: async () => ({ type: "success", key: "replacement-key" }),
      }),
    )

    await expect(ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })).rejects.toThrow(
      AggregateError,
    )
    expect({ disposalAttempts, occurrence: await ProviderOAuthFlowStore.get(failedFlowID!) }).toEqual({
      disposalAttempts: 1,
      occurrence: expect.objectContaining({ state: "pending", id: failedFlowID }),
    })

    ProviderOAuthFlowStore.TestHooks.beforeRenewPending = undefined
    ProviderOAuthFlowStore.TestHooks.beforeFailPending = undefined
    const replacement = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "replacement",
      flowID: replacement.flowID,
      scope: "global",
    })
    expect((await ProviderOAuthFlowStore.get(replacement.flowID))?.state).toBe("consumed")
  })

  test("Project Provider-auth disposal settles its pending owner and admits the next occurrence", async () => {
    let disposals = 0
    using _hooks = ProviderAuth.TestHooks.installProjectAuthHooksForTest(
      oauthHook({
        onDispose: () => disposals++,
        onCallback: async () => ({ type: "success", key: "next-owner-key" }),
      }),
    )
    const first = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "project" })
    await ProviderAuth.TestHooks.disposeProjectAuthStateForTest()
    const second = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "project" })

    expect({
      disposals,
      first: await ProviderOAuthFlowStore.get(first.flowID),
      second: await ProviderOAuthFlowStore.get(second.flowID),
    }).toEqual({
      disposals: 1,
      first: expect.objectContaining({
        state: "failed",
        error: "Provider OAuth executor owner ended with its Project Instance",
      }),
      second: expect.objectContaining({ state: "pending", exchangeOwnerID: expect.any(String) }),
    })
    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "next",
      flowID: second.flowID,
      scope: "project",
    })
    expect((await ProviderOAuthFlowStore.get(second.flowID))?.state).toBe("consumed")
  })

  test("expired pending-owner cleanup retries a transient executor disposal fault", async () => {
    ProviderAuth.TestHooks.pendingRenewalIntervalMs = 5
    let disposalAttempts = 0
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onDispose: () => {
          disposalAttempts++
          if (disposalAttempts === 1) throw new Error("transient executor disposal fault")
        },
        onCallback: async () => ({ type: "success", key: "replacement-key" }),
      }),
    )
    const expired = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await ProviderOAuthFlowStore.TestHooks.expirePending(expired.flowID)
    for (let attempt = 0; disposalAttempts < 2 && attempt < 100; attempt++) await Bun.sleep(5)
    const replacement = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })

    expect({
      disposalAttempts,
      expired: await ProviderOAuthFlowStore.get(expired.flowID),
      replacement: await ProviderOAuthFlowStore.get(replacement.flowID),
    }).toEqual({
      disposalAttempts: 2,
      expired: expect.objectContaining({
        state: "failed",
        error: "Provider OAuth executor owner expired before callback",
      }),
      replacement: expect.objectContaining({ state: "pending", exchangeOwnerID: expect.any(String) }),
    })
    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "replacement",
      flowID: replacement.flowID,
      scope: "global",
    })
  })

  test("concurrent expired-owner cleanup and replacement admission share one executor disposal", async () => {
    ProviderAuth.TestHooks.pendingRenewalIntervalMs = 5
    let disposalAttempts = 0
    let releaseDisposal!: () => void
    const disposalGate = new Promise<void>((resolve) => {
      releaseDisposal = resolve
    })
    let observeDisposal!: () => void
    const disposalStarted = new Promise<void>((resolve) => {
      observeDisposal = resolve
    })
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onDispose: async () => {
          disposalAttempts++
          observeDisposal()
          await disposalGate
        },
        onCallback: async () => ({ type: "success", key: "replacement-key" }),
      }),
    )
    const expired = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await ProviderOAuthFlowStore.TestHooks.expirePending(expired.flowID)
    await disposalStarted

    const replacementAdmission = ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await Bun.sleep(20)
    expect(disposalAttempts).toBe(1)
    releaseDisposal()
    const replacement = await replacementAdmission
    expect({
      disposalAttempts,
      expired: await ProviderOAuthFlowStore.get(expired.flowID),
      replacement: await ProviderOAuthFlowStore.get(replacement.flowID),
    }).toEqual({
      disposalAttempts: 1,
      expired: expect.objectContaining({ state: "failed" }),
      replacement: expect.objectContaining({ state: "pending", exchangeOwnerID: expect.any(String) }),
    })
    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "replacement",
      flowID: replacement.flowID,
      scope: "global",
    })
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
    const observed = await Auth.observe(PROVIDER)
    const foreign = await ProviderOAuthFlowStore.open({
      providerID: PROVIDER,
      expectedCredentialGeneration: observed.generation,
      ownerID: "foreign-owner",
      scope: "global",
      method: 0,
      inputsDigest: ProviderOAuthFlowStore.digestInputs(undefined),
    })

    await expect(
      ProviderAuth.callback({ providerID: PROVIDER, method: 0, code: "abc", flowID: foreign.id, scope: "global" }),
    ).rejects.toThrow(ProviderAuth.OauthFlowNotExecutable)
  })

  test("a failing plugin callback settles the occurrence with a safe durable diagnostic", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onCallback: async () => {
          throw new Error('{"refresh_token":"fixture-credential"}')
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
    ).rejects.toThrow(ProviderCredentialExchange.FailedError)
    expect(await ProviderOAuthFlowStore.get(authorization!.flowID)).toMatchObject({
      state: "failed",
      error: "Provider credential exchange failed before producing a credential",
    })
  })

  test("a callback disposer failure retains its exact executor for replacement-admission retry", async () => {
    let disposalAttempts = 0
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onDispose: () => {
          disposalAttempts++
          if (disposalAttempts === 1) throw new Error("transient callback disposer fault")
        },
        onCallback: async () => ({ type: "success", key: "callback-key" }),
      }),
    )
    const first = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await expect(
      ProviderAuth.callback({
        providerID: PROVIDER,
        method: 0,
        code: "first",
        flowID: first.flowID,
        scope: "global",
      }),
    ).rejects.toThrow("transient callback disposer fault")
    const replacement = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    expect({
      disposalAttempts,
      first: await ProviderOAuthFlowStore.get(first.flowID),
      replacement: await ProviderOAuthFlowStore.get(replacement.flowID),
    }).toEqual({
      disposalAttempts: 2,
      first: expect.objectContaining({ state: "consumed" }),
      replacement: expect.objectContaining({ state: "pending" }),
    })
    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "replacement",
      flowID: replacement.flowID,
      scope: "global",
    })
  })

  test("a live exchange lease rejects a replacement until the exact callback consumes it", async () => {
    let releaseExchange!: () => void
    const exchangeGate = new Promise<void>((resolve) => {
      releaseExchange = resolve
    })
    let resolveExchangeStarted!: () => void
    const exchangeStarted = new Promise<void>((resolve) => {
      resolveExchangeStarted = resolve
    })
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onCallback: async () => {
          resolveExchangeStarted()
          await exchangeGate
          return { type: "success", key: "leased-key" }
        },
      }),
    )

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    const callback = ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "leased-code",
      flowID: authorization.flowID,
      scope: "global",
    })
    try {
      await exchangeStarted
      await expect(ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })).rejects.toThrow(
        ProviderOAuthFlowStore.ExchangeActiveError,
      )
      releaseExchange()
      await callback
      const replacement = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
      expect({
        settled: (await ProviderOAuthFlowStore.get(authorization.flowID))?.state,
        credential: await Auth.get(PROVIDER),
        replacement: await ProviderOAuthFlowStore.get(replacement.flowID),
      }).toEqual({
        settled: "consumed",
        credential: { type: "api", key: "leased-key" },
        replacement: expect.objectContaining({ id: replacement.flowID, state: "pending" }),
      })
    } finally {
      releaseExchange()
      await callback.catch(() => undefined)
    }
  })

  test("a runtime refresh uses the same durable phases and returns the committed OAuth credential", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "old-refresh",
      expires: 1,
    }
    const phases: string[] = []
    await Auth.set(PROVIDER, current)
    ProviderCredentialExchange.TestHooks.afterExchangeStarted = async ({ flowID }) => {
      phases.push((await ProviderOAuthFlowStore.get(flowID))!.state)
    }
    ProviderCredentialExchange.TestHooks.afterCredentialReady = async ({ flowID }) => {
      phases.push((await ProviderOAuthFlowStore.get(flowID))!.state)
    }
    ProviderCredentialExchange.TestHooks.afterCredentialWrite = async ({ flowID }) => {
      phases.push((await ProviderOAuthFlowStore.get(flowID))!.state)
    }

    const refreshed = await ProviderCredentialExchange.refresh({
      providerID: PROVIDER,
      current,
      exchange: async () => ({
        type: "oauth",
        access: "new-access",
        refresh: "new-refresh",
        expires: 123,
      }),
    })
    const occurrence = await ProviderOAuthFlowStore.TestHooks.latestFor(PROVIDER, "refresh")

    expect({ refreshed, stored: await Auth.get(PROVIDER), occurrence, phases }).toEqual({
      refreshed: { type: "oauth", access: "new-access", refresh: "new-refresh", expires: 123 },
      stored: { type: "oauth", access: "new-access", refresh: "new-refresh", expires: 123 },
      occurrence: expect.objectContaining({
        providerID: PROVIDER,
        scope: "runtime",
        operation: "refresh",
        state: "consumed",
      }),
      phases: ["exchanging", "credential_ready", "credential_ready"],
    })
  })

  test("the bundled GitLab loader refreshes an expired OAuth credential through the central occurrence", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-gitlab-access",
      refresh: "old-gitlab-refresh",
      expires: 1,
      enterpriseUrl: "https://gitlab.example.test",
    }
    await Auth.set("gitlab", current)
    const exchanges: Array<{ instanceUrl: string; input: Record<string, string> }> = []
    GitlabAuthTestHooks.exchangeToken = async (instanceUrl, input) => {
      exchanges.push({ instanceUrl, input })
      return { access_token: "new-gitlab-access", refresh_token: "new-gitlab-refresh", expires_in: 3600 }
    }
    const hook = await GitlabAuthPlugin({
      credentials: {
        refresh: ProviderCredentialExchange.refresh,
        updateApiMetadata: async () => undefined,
      },
    } as never)

    const options = await hook.auth!.loader!(() => Auth.get("gitlab") as never, {} as never)
    const occurrence = await ProviderOAuthFlowStore.TestHooks.latestFor("gitlab", "refresh")
    expect({ exchanges, options, credential: await Auth.get("gitlab"), occurrence }).toEqual({
      exchanges: [
        {
          instanceUrl: "https://gitlab.example.test",
          input: { refresh_token: "old-gitlab-refresh", grant_type: "refresh_token" },
        },
      ],
      options: {
        apiKey: "new-gitlab-access",
        instanceUrl: "https://gitlab.example.test",
        clientId: expect.any(String),
      },
      credential: {
        type: "oauth",
        access: "new-gitlab-access",
        refresh: "new-gitlab-refresh",
        expires: expect.any(Number),
        enterpriseUrl: "https://gitlab.example.test",
      },
      occurrence: expect.objectContaining({ operation: "refresh", state: "consumed" }),
    })
  })

  test("the bundled GitLab callback returns its credential to the central authorization commit", async () => {
    GitlabAuthTestHooks.oauthPort = 0
    GitlabAuthTestHooks.openBrowser = async () => undefined
    const exchanges: Array<{ instanceUrl: string; input: Record<string, string> }> = []
    GitlabAuthTestHooks.exchangeToken = async (instanceUrl, input) => {
      exchanges.push({ instanceUrl, input })
      return { access_token: "gitlab-access", refresh_token: "gitlab-refresh", expires_in: 3600 }
    }
    const hook = await GitlabAuthPlugin({
      credentials: {
        refresh: ProviderCredentialExchange.refresh,
        updateApiMetadata: async () => undefined,
      },
    } as never)
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest([hook] as never)

    const authorization = await ProviderAuth.authorize({
      providerID: "gitlab",
      method: 0,
      inputs: { instanceUrl: "https://gitlab.example.test" },
      scope: "global",
    })
    const authorizeUrl = new URL(authorization.url)
    const redirectUri = authorizeUrl.searchParams.get("redirect_uri")!
    const state = authorizeUrl.searchParams.get("state")!
    const callback = ProviderAuth.callback({
      providerID: "gitlab",
      method: 0,
      flowID: authorization.flowID,
      scope: "global",
    })
    const unrelated = await fetch(`${redirectUri}?code=unrelated-code&state=unrelated-state`)
    const redirect = await fetch(`${redirectUri}?code=accepted-code&state=${encodeURIComponent(state)}`)
    await callback

    expect({
      unrelatedStatus: unrelated.status,
      redirectStatus: redirect.status,
      exchanges,
      credential: await Auth.get("gitlab"),
      occurrence: await ProviderOAuthFlowStore.get(authorization.flowID),
    }).toEqual({
      unrelatedStatus: 400,
      redirectStatus: 200,
      exchanges: [
        {
          instanceUrl: "https://gitlab.example.test",
          input: expect.objectContaining({
            code: "accepted-code",
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code_verifier: expect.any(String),
          }),
        },
      ],
      credential: {
        type: "oauth",
        access: "gitlab-access",
        refresh: "gitlab-refresh",
        expires: expect.any(Number),
        enterpriseUrl: "https://gitlab.example.test",
      },
      occurrence: expect.objectContaining({ operation: "authorization", state: "consumed" }),
    })
  })

  test("disposing a pending bundled GitLab authorization drains its callback and admits a fresh listener", async () => {
    GitlabAuthTestHooks.oauthPort = 0
    GitlabAuthTestHooks.openBrowser = async () => undefined
    const hook = await GitlabAuthPlugin({
      credentials: {
        refresh: ProviderCredentialExchange.refresh,
        updateApiMetadata: async () => undefined,
      },
    } as never)
    using _hooks = ProviderAuth.TestHooks.installProjectAuthHooksForTest([hook] as never)

    const first = await ProviderAuth.authorize({ providerID: "gitlab", method: 0, scope: "project" })
    await ProviderAuth.TestHooks.disposeProjectAuthStateForTest()
    const second = await ProviderAuth.authorize({ providerID: "gitlab", method: 0, scope: "project" })

    expect({ first: await ProviderOAuthFlowStore.get(first.flowID), second }).toEqual({
      first: expect.objectContaining({ state: "failed" }),
      second: expect.objectContaining({ flowID: expect.any(String), method: "auto" }),
    })
    await ProviderAuth.TestHooks.disposeProjectAuthStateForTest()
  })

  test("a GitLab listener cleanup retry preserves the remotely exchanged credential occurrence", async () => {
    GitlabAuthTestHooks.oauthPort = 0
    GitlabAuthTestHooks.openBrowser = async () => undefined
    let stopAttempts = 0
    GitlabAuthTestHooks.beforeListenerStop = () => {
      stopAttempts++
      if (stopAttempts === 1) throw new Error("transient GitLab listener cleanup fault")
    }
    GitlabAuthTestHooks.exchangeToken = async () => ({
      access_token: "cleanup-safe-access",
      refresh_token: "cleanup-safe-refresh",
      expires_in: 3600,
    })
    const hook = await GitlabAuthPlugin({
      credentials: {
        refresh: ProviderCredentialExchange.refresh,
        updateApiMetadata: async () => undefined,
      },
    } as never)
    using _hooks = ProviderAuth.TestHooks.installProjectAuthHooksForTest([hook] as never)

    const authorization = await ProviderAuth.authorize({ providerID: "gitlab", method: 0, scope: "project" })
    const authorizeUrl = new URL(authorization.url)
    const redirectUri = authorizeUrl.searchParams.get("redirect_uri")!
    const state = authorizeUrl.searchParams.get("state")!
    const callback = ProviderAuth.callback({
      providerID: "gitlab",
      method: 0,
      flowID: authorization.flowID,
      scope: "project",
    })
    await fetch(`${redirectUri}?code=cleanup-safe-code&state=${encodeURIComponent(state)}`)
    await expect(callback).rejects.toThrow("transient GitLab listener cleanup fault")

    expect({
      credential: await Auth.get("gitlab"),
      occurrence: await ProviderOAuthFlowStore.get(authorization.flowID),
      stopAttempts,
    }).toEqual({
      credential: {
        type: "oauth",
        access: "cleanup-safe-access",
        refresh: "cleanup-safe-refresh",
        expires: expect.any(Number),
        enterpriseUrl: "https://gitlab.com",
      },
      occurrence: expect.objectContaining({ state: "consumed" }),
      stopAttempts: 1,
    })

    const replacement = await ProviderAuth.authorize({ providerID: "gitlab", method: 0, scope: "project" })
    expect({ replacement, stopAttempts }).toEqual({
      replacement: expect.objectContaining({ flowID: expect.any(String), method: "auto" }),
      stopAttempts: 2,
    })
    await ProviderAuth.TestHooks.disposeProjectAuthStateForTest()
  })

  test("a timed-out bundled GitLab callback settles and its listener admits a fresh authorization", async () => {
    GitlabAuthTestHooks.oauthPort = 0
    GitlabAuthTestHooks.callbackTimeoutMs = 5
    GitlabAuthTestHooks.openBrowser = async () => undefined
    const hook = await GitlabAuthPlugin({
      credentials: {
        refresh: ProviderCredentialExchange.refresh,
        updateApiMetadata: async () => undefined,
      },
    } as never)
    using _hooks = ProviderAuth.TestHooks.installProjectAuthHooksForTest([hook] as never)

    const first = await ProviderAuth.authorize({ providerID: "gitlab", method: 0, scope: "project" })
    await Bun.sleep(25)
    await ProviderAuth.TestHooks.disposeProjectAuthStateForTest()
    const second = await ProviderAuth.authorize({ providerID: "gitlab", method: 0, scope: "project" })
    expect({ first: await ProviderOAuthFlowStore.get(first.flowID), second }).toEqual({
      first: expect.objectContaining({ state: "failed" }),
      second: expect.objectContaining({ flowID: expect.any(String), method: "auto" }),
    })
    await ProviderAuth.TestHooks.disposeProjectAuthStateForTest()
  })

  test("a slow runtime refresh retries a transient exchange-renewal fault before committing", async () => {
    ProviderCredentialExchange.TestHooks.exchangeRenewalIntervalMs = 5
    let renewalAttempts = 0
    ProviderOAuthFlowStore.TestHooks.beforeRenewExchange = async () => {
      renewalAttempts++
      if (renewalAttempts === 1) throw new Error("transient exchange renewal observation fault")
    }
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "old-refresh",
      expires: 1,
    }
    await Auth.set(PROVIDER, current)

    const refreshed = await ProviderCredentialExchange.refresh({
      providerID: PROVIDER,
      current,
      exchange: async () => {
        for (let attempt = 0; renewalAttempts < 2 && attempt < 100; attempt++) await Bun.sleep(5)
        return { type: "oauth", access: "new-access", refresh: "new-refresh", expires: 2 }
      },
    })
    const occurrence = await ProviderOAuthFlowStore.TestHooks.latestFor(PROVIDER, "refresh")
    expect({ renewalAttempts, refreshed, occurrence }).toEqual({
      renewalAttempts: expect.any(Number),
      refreshed: { type: "oauth", access: "new-access", refresh: "new-refresh", expires: 2 },
      occurrence: expect.objectContaining({ state: "consumed" }),
    })
    expect(renewalAttempts).toBeGreaterThanOrEqual(2)
  })

  test("an authorization commit preserves the ordinary credential writer that advanced the generation", async () => {
    const replacement: Auth.Info = { type: "api", key: "operator-key" }
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "exchanged-key" }) }),
    )
    ProviderCredentialExchange.TestHooks.afterExchangeStarted = async () => {
      await Auth.set(PROVIDER, replacement)
    }

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await expect(
      ProviderAuth.callback({
        providerID: PROVIDER,
        method: 0,
        code: "abc",
        flowID: authorization.flowID,
        scope: "global",
      }),
    ).rejects.toThrow(ProviderCredentialExchange.ReplacedError)

    expect({
      credential: await Auth.get(PROVIDER),
      occurrence: await ProviderOAuthFlowStore.get(authorization.flowID),
    }).toEqual({
      credential: replacement,
      occurrence: expect.objectContaining({
        state: "exchange_uncertain",
        error: "Provider credential generation changed before exchanged credential commit",
      }),
    })
  })

  test("authorization generation binding settles a pre-callback credential replacement before remote exchange", async () => {
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        onCallback: async () => ({ type: "success", key: "exchanged-key" }),
      }),
    )
    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    const replacement: Auth.Info = { type: "api", key: "operator-key" }
    await Auth.set(PROVIDER, replacement)

    await expect(
      ProviderAuth.callback({
        providerID: PROVIDER,
        method: 0,
        code: "abc",
        flowID: authorization.flowID,
        scope: "global",
      }),
    ).rejects.toThrow(ProviderCredentialExchange.ReplacedError)
    expect({
      credential: await Auth.get(PROVIDER),
      flow: await ProviderOAuthFlowStore.get(authorization.flowID),
    }).toEqual({
      credential: replacement,
      flow: expect.objectContaining({
        state: "failed",
        error: "Provider credential generation changed after authorization started",
      }),
    })
  })

  test("a missing credential keeps a durable generation across value-to-tombstone ABA", async () => {
    let before!: Auth.Observation
    let after!: Auth.Observation
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "exchanged-key" }) }),
    )
    ProviderCredentialExchange.TestHooks.afterCredentialReady = async () => {
      before = (await Auth.inspect(PROVIDER))!
      await Auth.set(PROVIDER, { type: "api", key: "intermediate-key" })
      await Auth.remove(PROVIDER)
      after = (await Auth.inspect(PROVIDER))!
    }

    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await expect(
      ProviderAuth.callback({
        providerID: PROVIDER,
        method: 0,
        code: "abc",
        flowID: authorization.flowID,
        scope: "global",
      }),
    ).rejects.toThrow(ProviderCredentialExchange.ReplacedError)

    expect({
      generations: new Set([before.generation, after.generation]).size,
      occurrence: await ProviderOAuthFlowStore.get(authorization.flowID),
    }).toEqual({
      generations: 2,
      occurrence: expect.objectContaining({ state: "exchange_uncertain" }),
    })
  })

  test("a refresh generation CAS preserves an ABA credential transition as the current winner", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "old-refresh",
      expires: 1,
    }
    await Auth.set(PROVIDER, current)
    ProviderCredentialExchange.TestHooks.afterCredentialReady = async () => {
      await Auth.set(PROVIDER, { type: "api", key: "intermediate-key" })
      await Auth.set(PROVIDER, current)
    }

    await expect(
      ProviderCredentialExchange.refresh({
        providerID: PROVIDER,
        current,
        exchange: async () => ({
          type: "oauth",
          access: "stale-access",
          refresh: "stale-refresh",
          expires: 999,
        }),
      }),
    ).rejects.toThrow(ProviderCredentialExchange.ReplacedError)
    const occurrence = await ProviderOAuthFlowStore.TestHooks.latestFor(PROVIDER, "refresh")
    expect({ credential: await Auth.get(PROVIDER), occurrence }).toEqual({
      credential: current,
      occurrence: expect.objectContaining({ state: "exchange_uncertain" }),
    })
  })

  test("an ambiguous commit result reconciles from its exact generation and digest", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "old-refresh",
      expires: 1,
    }
    const committed: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "new-access",
      refresh: "new-refresh",
      expires: 999,
    }
    await Auth.set(PROVIDER, current)
    ProviderCredentialExchange.TestHooks.afterCredentialCommit = async () => {
      throw new Error("shared credential lock release was compromised")
    }

    const result = await ProviderCredentialExchange.refresh({
      providerID: PROVIDER,
      current,
      exchange: async () => committed,
    })
    const occurrence = await ProviderOAuthFlowStore.TestHooks.latestFor(PROVIDER, "refresh")
    expect({ result, credential: await Auth.get(PROVIDER), occurrence }).toEqual({
      result: committed,
      credential: committed,
      occurrence: expect.objectContaining({ state: "consumed" }),
    })
  })

  test("API metadata updates bind to the observed key and preserve the current credential winner", async () => {
    const observed: Extract<Auth.Info, { type: "api" }> = {
      type: "api",
      key: "observed-key",
      metadata: { routers: "old" },
    }
    await Auth.set(PROVIDER, observed)
    await Auth.updateApiMetadata(PROVIDER, observed, { routers: "current", routers_fetched_at: "123" })
    const updated = await Auth.get(PROVIDER)

    const replacement: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "replacement-access",
      refresh: "replacement-refresh",
      expires: 999,
    }
    await Auth.set(PROVIDER, replacement)
    await Auth.updateApiMetadata(PROVIDER, observed, { routers: "stale" })

    expect({ updated, current: await Auth.get(PROVIDER) }).toEqual({
      updated: {
        type: "api",
        key: "observed-key",
        metadata: { routers: "current", routers_fetched_at: "123" },
      },
      current: replacement,
    })
  })

  test("concurrent runtime refresh callers converge on one exchange occurrence and committed credential", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "rotating-refresh",
      expires: 1,
    }
    await Auth.set(PROVIDER, current)
    let exchangeCount = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let started!: () => void
    const exchangeStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    const refresh = () =>
      ProviderCredentialExchange.refresh({
        providerID: PROVIDER,
        current,
        exchange: async () => {
          exchangeCount++
          started()
          await gate
          return { type: "oauth", access: "shared-access", refresh: "shared-refresh", expires: 456 }
        },
      })

    const first = refresh()
    await exchangeStarted
    const second = refresh()
    await Bun.sleep(50)
    release()
    const credentials = await Promise.all([first, second])
    const occurrence = await ProviderOAuthFlowStore.TestHooks.latestFor(PROVIDER, "refresh")

    expect({ exchangeCount, credentials, stored: await Auth.get(PROVIDER), occurrence }).toEqual({
      exchangeCount: 1,
      credentials: [
        { type: "oauth", access: "shared-access", refresh: "shared-refresh", expires: 456 },
        { type: "oauth", access: "shared-access", refresh: "shared-refresh", expires: 456 },
      ],
      stored: { type: "oauth", access: "shared-access", refresh: "shared-refresh", expires: 456 },
      occurrence: expect.objectContaining({ operation: "refresh", state: "consumed" }),
    })
  })

  test("an expired refresh owner exposes the exact uncertain recovery occurrence", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "uncertain-refresh",
      expires: 1,
    }
    await Auth.set(PROVIDER, current)
    const observed = await Auth.observe(PROVIDER)
    const interrupted = await ProviderOAuthFlowStore.openRefresh({
      providerID: PROVIDER,
      expectedCredentialGeneration: observed.generation,
      inputsDigest: ProviderOAuthFlowStore.digestInputs({
        generation: observed.generation,
        credentialDigest: ProviderOAuthFlowStore.digestCredential(current),
      }),
      ownerID: "dead-owner",
    })
    await ProviderOAuthFlowStore.TestHooks.expireExchange(interrupted.id)

    await expect(
      ProviderCredentialExchange.refresh({
        providerID: PROVIDER,
        current,
        exchange: async () => ({ type: "oauth", access: "unsafe", refresh: "unsafe", expires: 999 }),
      }),
    ).rejects.toThrow(ProviderOAuthFlowStore.ExchangeUncertainError)
    expect(await ProviderOAuthFlowStore.get(interrupted.id)).toMatchObject({
      operation: "refresh",
      state: "exchange_uncertain",
      error: "Provider OAuth exchange owner expired before credential settlement",
    })
  })

  test("a refresh uncertainty fence survives retention while its credential generation remains current", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "rotating-refresh",
      expires: 1,
    }
    await Auth.set(PROVIDER, current)
    await expect(
      ProviderCredentialExchange.refresh({
        providerID: PROVIDER,
        current,
        exchange: async () => {
          throw new Error("token response connection closed")
        },
      }),
    ).rejects.toThrow(ProviderOAuthFlowStore.ExchangeUncertainError)
    const occurrence = await ProviderOAuthFlowStore.TestHooks.latestFor(PROVIDER, "refresh")
    expect(occurrence).toMatchObject({
      operation: "refresh",
      state: "exchange_uncertain",
      error: "Provider credential exchange returned an uncertain result",
    })
    await ProviderOAuthFlowStore.TestHooks.ageSettlement(occurrence!.id, 25 * 60 * 60 * 1000)
    const aliasCredential: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "alias-access",
      refresh: "alias-refresh",
      expires: 1,
    }
    await Auth.set(ALIAS_PROVIDER, aliasCredential)
    const aliasObserved = await Auth.observe(ALIAS_PROVIDER)
    await ProviderOAuthFlowStore.openRefresh({
      providerID: ALIAS_PROVIDER,
      expectedCredentialGeneration: aliasObserved.generation,
      inputsDigest: ProviderOAuthFlowStore.digestInputs({
        generation: aliasObserved.generation,
        credentialDigest: ProviderOAuthFlowStore.digestCredential(aliasCredential),
      }),
      ownerID: "unrelated-writer",
    })
    await expect(
      ProviderCredentialExchange.refresh({
        providerID: PROVIDER,
        current,
        exchange: async () => ({ type: "oauth", access: "unsafe", refresh: "unsafe", expires: 999 }),
      }),
    ).rejects.toThrow(ProviderOAuthFlowStore.ExchangeUncertainError)
  })

  test("one Provider-wide owner fences Project and global authorization scopes", async () => {
    const observed = await Auth.observe(PROVIDER)
    const project = await ProviderOAuthFlowStore.open({
      providerID: PROVIDER,
      expectedCredentialGeneration: observed.generation,
      ownerID: "project-owner",
      scope: "project",
      method: 0,
      inputsDigest: ProviderOAuthFlowStore.digestInputs(undefined),
    })
    await ProviderOAuthFlowStore.beginExchange({ id: project.id, ownerID: "project-owner" })

    await expect(
      ProviderOAuthFlowStore.open({
        providerID: PROVIDER,
        expectedCredentialGeneration: observed.generation,
        ownerID: "global-owner",
        scope: "global",
        method: 0,
        inputsDigest: ProviderOAuthFlowStore.digestInputs(undefined),
      }),
    ).rejects.toThrow(ProviderOAuthFlowStore.ExchangeActiveError)
    expect(await ProviderOAuthFlowStore.get(project.id)).toMatchObject({
      scope: "project",
      state: "exchanging",
      exchangeOwnerID: "project-owner",
    })
  })

  test("an OAuth credential alias is fenced by its target Provider before callback exchange", async () => {
    const targetCredential: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "target-access",
      refresh: "target-refresh",
      expires: 1,
    }
    await Auth.set(ALIAS_PROVIDER, targetCredential)
    const observed = await Auth.observe(ALIAS_PROVIDER)
    const target = await ProviderOAuthFlowStore.openRefresh({
      providerID: ALIAS_PROVIDER,
      expectedCredentialGeneration: observed.generation,
      inputsDigest: ProviderOAuthFlowStore.digestInputs({
        generation: observed.generation,
        credentialDigest: ProviderOAuthFlowStore.digestCredential(targetCredential),
      }),
      ownerID: "target-owner",
    })
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({
        provider: ALIAS_PROVIDER,
        onCallback: async () => ({ type: "success", key: "alias-key" }),
      }),
    )
    await expect(ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })).rejects.toThrow(
      ProviderOAuthFlowStore.ExchangeActiveError,
    )
    expect({ target, credential: await Auth.get(ALIAS_PROVIDER) }).toEqual({
      target: expect.objectContaining({ providerID: ALIAS_PROVIDER, state: "exchanging" }),
      credential: targetCredential,
    })
  })

  test("a pending authorization owner is the typed runtime-refresh admission authority", async () => {
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "old-access",
      refresh: "old-refresh",
      expires: 1,
    }
    await Auth.set(PROVIDER, current)
    using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
      oauthHook({ onCallback: async () => ({ type: "success", key: "authorized-key" }) }),
    )
    const authorization = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
    await expect(
      ProviderCredentialExchange.refresh({
        providerID: PROVIDER,
        current,
        exchange: async () => ({ type: "oauth", access: "new-access", refresh: "new-refresh", expires: 123 }),
      }),
    ).rejects.toThrow(ProviderOAuthFlowStore.ExchangeActiveError)
    await ProviderAuth.callback({
      providerID: PROVIDER,
      method: 0,
      code: "authorization-code",
      flowID: authorization.flowID,
      scope: "global",
    })
    expect({
      flow: await ProviderOAuthFlowStore.get(authorization.flowID),
      credential: await Auth.get(PROVIDER),
    }).toEqual({
      flow: expect.objectContaining({ state: "consumed", credentialProviderID: PROVIDER }),
      credential: { type: "api", key: "authorized-key" },
    })
  })

  test("a killed runtime refresh owner leaves durable uncertainty and requires explicit reauthorization", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-provider-refresh-exchange-"))
    const marker = path.join(temp, "credential-ready.txt")
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "previous-access",
      refresh: "previous-refresh",
      expires: 1,
    }
    await Auth.set(PROVIDER, current)
    const worker = Bun.spawn(
      [
        "bun",
        "run",
        path.join(import.meta.dir, "fixture", "provider-oauth-exchange-worker.ts"),
        PROVIDER,
        marker,
        "refresh",
      ],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const stdout = new Response(worker.stdout).text()
    const stderr = new Response(worker.stderr).text()

    try {
      const flowID = await waitForFile(marker)
      worker.kill()
      await worker.exited
      expect({ occurrence: await ProviderOAuthFlowStore.get(flowID), credential: await Auth.get(PROVIDER) }).toEqual({
        occurrence: expect.objectContaining({
          id: flowID,
          operation: "refresh",
          scope: "runtime",
          state: "credential_ready",
          credentialProviderID: PROVIDER,
        }),
        credential: current,
      })

      await ProviderOAuthFlowStore.TestHooks.expireExchange(flowID)
      await expect(
        ProviderCredentialExchange.refresh({
          providerID: PROVIDER,
          current,
          exchange: async () => ({ type: "oauth", access: "unsafe", refresh: "unsafe", expires: 999 }),
        }),
      ).rejects.toThrow(ProviderOAuthFlowStore.ExchangeUncertainError)

      using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
        oauthHook({ onCallback: async () => ({ type: "success", key: "replacement-key" }) }),
      )
      const replacement = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
      expect({ interrupted: await ProviderOAuthFlowStore.get(flowID), replacement }).toEqual({
        interrupted: expect.objectContaining({
          operation: "refresh",
          state: "exchange_uncertain",
          error: "Provider OAuth exchange owner expired before credential settlement",
        }),
        replacement: expect.objectContaining({ flowID: expect.any(String), method: "code" }),
      })
    } finally {
      if (worker.exitCode === null) worker.kill()
      await worker.exited
      await Promise.all([stdout, stderr])
      await fs.rm(temp, { recursive: true, force: true })
    }
  }, 30_000)

  test("an expired owner after credential commit converges its durable refresh occurrence to consumed", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-provider-refresh-commit-"))
    const marker = path.join(temp, "credential-written.txt")
    const current: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "previous-access",
      refresh: "previous-refresh",
      expires: 1,
    }
    const committed: Extract<Auth.Info, { type: "oauth" }> = {
      type: "oauth",
      access: "new-access",
      refresh: "new-refresh",
      expires: 999,
    }
    await Auth.set(PROVIDER, current)
    const worker = Bun.spawn(
      [
        "bun",
        "run",
        path.join(import.meta.dir, "fixture", "provider-oauth-exchange-worker.ts"),
        PROVIDER,
        marker,
        "refresh",
        "write",
      ],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const stdout = new Response(worker.stdout).text()
    const stderr = new Response(worker.stderr).text()

    try {
      const flowID = await waitForFile(marker)
      worker.kill()
      await worker.exited
      expect({ occurrence: await ProviderOAuthFlowStore.get(flowID), credential: await Auth.get(PROVIDER) }).toEqual({
        occurrence: expect.objectContaining({
          operation: "refresh",
          state: "credential_ready",
          credentialDigest: ProviderOAuthFlowStore.digestCredential(committed),
        }),
        credential: committed,
      })

      await ProviderOAuthFlowStore.TestHooks.expireExchange(flowID)
      const recovered = await ProviderCredentialExchange.refresh({
        providerID: PROVIDER,
        current,
        exchange: async () => ({ type: "oauth", access: "unused", refresh: "unused", expires: 1_000 }),
      })
      expect({ recovered, occurrence: await ProviderOAuthFlowStore.get(flowID) }).toEqual({
        recovered: committed,
        occurrence: expect.objectContaining({ operation: "refresh", state: "consumed" }),
      })
    } finally {
      if (worker.exitCode === null) worker.kill()
      await worker.exited
      await Promise.all([stdout, stderr])
      await fs.rm(temp, { recursive: true, force: true })
    }
  }, 30_000)

  test("a killed owner leaves credential-ready evidence before a replacement records uncertainty", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-provider-oauth-exchange-"))
    const marker = path.join(temp, "credential-ready.txt")
    await Auth.set(PROVIDER, { type: "api", key: "previous-key" })
    const worker = Bun.spawn(
      ["bun", "run", path.join(import.meta.dir, "fixture", "provider-oauth-exchange-worker.ts"), PROVIDER, marker],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const stdout = new Response(worker.stdout).text()
    const stderr = new Response(worker.stderr).text()

    try {
      const flowID = await waitForFile(marker)
      const ready = await ProviderOAuthFlowStore.get(flowID)
      worker.kill()
      const exitCode = await worker.exited
      expect({
        exitCode,
        ready,
        preservedCredential: await Auth.get(PROVIDER),
      }).toEqual({
        exitCode: expect.any(Number),
        ready: expect.objectContaining({
          id: flowID,
          providerID: PROVIDER,
          scope: "global",
          state: "credential_ready",
          credentialProviderID: PROVIDER,
          exchangeOwnerID: expect.any(String),
          exchangeLeaseExpiresAt: expect.any(Number),
        }),
        preservedCredential: { type: "api", key: "previous-key" },
      })

      await ProviderOAuthFlowStore.TestHooks.expireExchange(flowID)
      using _hooks = ProviderAuth.TestHooks.installGlobalAuthHooksForTest(
        oauthHook({ onCallback: async () => ({ type: "success", key: "replacement-key" }) }),
      )
      const replacement = await ProviderAuth.authorize({ providerID: PROVIDER, method: 0, scope: "global" })
      expect({
        interrupted: await ProviderOAuthFlowStore.get(flowID),
        replacement: await ProviderOAuthFlowStore.get(replacement.flowID),
      }).toEqual({
        interrupted: expect.objectContaining({
          id: flowID,
          state: "exchange_uncertain",
          credentialProviderID: PROVIDER,
          timeSettled: expect.any(Number),
          error: "Provider OAuth exchange owner expired before credential settlement",
        }),
        replacement: expect.objectContaining({ id: replacement.flowID, state: "pending" }),
      })
    } finally {
      if (worker.exitCode === null) worker.kill()
      await worker.exited
      await Promise.all([stdout, stderr])
      await fs.rm(temp, { recursive: true, force: true })
    }
  }, 30_000)
})
