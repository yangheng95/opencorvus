import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Global } from "@/global"
import { McpAuth } from "@/mcp/auth"
import { McpOAuthCallback } from "@/mcp/oauth-callback"
import { McpOAuthProvider } from "@/mcp/oauth-provider"
import { Filesystem } from "@/util/filesystem"
import { auth } from "@modelcontextprotocol/sdk/client/auth.js"

const worker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-broker-worker.ts")
const stallingWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-stalling-broker-worker.ts")
const terminalWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-terminal-worker.ts")
const oneShotWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-one-shot-worker.ts")
const finishingWorker = path.join(import.meta.dir, "../fixture/mcp-oauth-callback-finishing-worker.ts")

afterEach(async () => {
  await McpOAuthCallback.stop()
})

async function temporaryRoot(label: string) {
  return mkdtemp(path.join(os.tmpdir(), `opencorvus-mcp-broker-${label}-`))
}

async function waitForJson<T>(filepath: string, timeout = 10_000): Promise<T> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await readFile(filepath, "utf8")) as T
    } catch {
      await Bun.sleep(25)
    }
  }
  throw new Error(`Timed out waiting for broker worker output ${filepath}`)
}

function spawnHolder(root: string, output: string) {
  return Bun.spawn([process.execPath, worker, root, output], {
    cwd: path.join(import.meta.dir, "../.."),
    stdout: "pipe",
    stderr: "pipe",
  })
}

function spawnStallingHolder(
  root: string,
  output: string,
  stallTrigger: string,
  stallStarted: string,
  stallRecovered: string,
  stallDurationMs: number,
) {
  return Bun.spawn(
    [
      process.execPath,
      stallingWorker,
      root,
      output,
      stallTrigger,
      stallStarted,
      stallRecovered,
      String(stallDurationMs),
    ],
    {
      cwd: path.join(import.meta.dir, "../.."),
      stdout: "pipe",
      stderr: "pipe",
    },
  )
}

async function proofAvailable(redirectUrl: string): Promise<boolean> {
  const callback = new URL(redirectUrl)
  try {
    const response = await fetch(
      `${callback.origin}/mcp/oauth/broker-proof?challenge=${encodeURIComponent(crypto.randomUUID())}`,
      { signal: AbortSignal.timeout(750) },
    )
    return response.ok
  } catch {
    return false
  }
}

async function stopChild(child: ReturnType<typeof spawnHolder>) {
  if (child.exitCode === null) child.kill()
  await child.exited
}

describe("the durable MCP OAuth callback broker", () => {
  test("a peer waiter observes the exact durable terminal published by the finishing process", async () => {
    const root = await temporaryRoot("terminal")
    try {
      const authKey = "project_terminal:server"
      const oauthState = "cross-process-terminal-state"
      const revision = await Global.provideRoot(root, async () => {
        const binding = await McpOAuthCallback.ensureRunning()
        const current = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(
          authKey,
          oauthState,
          current,
          undefined,
          undefined,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "cross-process-verifier", current)
        expect(
          await McpAuth.spendOAuthState(authKey, oauthState, current, "cross-process-owner", Date.now() + 60_000),
        ).toBe(true)
        return current
      })
      const settlement = Global.provideRoot(root, () =>
        McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "cross-process-terminal"),
      )
      const publisher = Bun.spawn([process.execPath, terminalWorker, root, authKey, oauthState, revision], {
        cwd: path.join(import.meta.dir, "../.."),
        stdout: "pipe",
        stderr: "pipe",
      })
      const publisherExit = await publisher.exited
      if (publisherExit !== 0) {
        throw new Error(`Terminal publisher failed (${publisherExit}): ${await new Response(publisher.stderr).text()}`)
      }
      expect(await Promise.race([settlement, Bun.sleep(5_000).then(() => "timeout" as const)])).toEqual({
        status: "fulfilled",
        result: { status: "connected" },
      })
    } finally {
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("an unreferenced broker does not keep a one-shot process alive", async () => {
    const root = await temporaryRoot("one-shot")
    const output = path.join(root, "binding.json")
    const child = Bun.spawn([process.execPath, oneShotWorker, root, output], {
      cwd: path.join(import.meta.dir, "../.."),
      stdout: "pipe",
      stderr: "pipe",
    })
    try {
      const binding = await waitForJson<{ redirectUrl: string; generation: string }>(output)
      expect(await Promise.race([child.exited, Bun.sleep(5_000).then(() => "timeout" as const)])).toBe(0)
      expect(await proofAvailable(binding.redirectUrl)).toBe(false)
    } finally {
      if (child.exitCode === null) await stopChild(child)
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("a durable port-zero broker identity is a typed malformed-identity refusal", async () => {
    const root = await temporaryRoot("malformed-port-zero")
    const authKey = "project_malformed_broker:server"
    const oauthState = "malformed-broker-state"
    try {
      const identityPath = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey)
        await McpAuth.updateOAuthState(
          authKey,
          oauthState,
          current,
          undefined,
          undefined,
          "malformed-generation",
          "http://127.0.0.1:19876/mcp/oauth/callback",
        )
        const filepath = path.join(Global.Path.data, "mcp-oauth-callback-broker.json")
        await Filesystem.writeAtomic(
          filepath,
          JSON.stringify({
            protocol: 1,
            port: 0,
            generation: "malformed-generation",
            secret: "00".repeat(32),
          }),
          0o600,
        )
        return filepath
      })
      const refusal = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning()).catch((error) => error)
      const entry = await Global.provideRoot(root, () => McpAuth.get(authKey))
      expect({
        identityPath,
        error: refusal instanceof Error ? refusal.name : refusal,
        issue: (refusal as { issues?: Array<{ code?: string; path?: unknown[]; minimum?: number }> }).issues?.[0],
        flow: { state: entry?.oauthState, generation: entry?.callbackGeneration },
      }).toEqual({
        identityPath: expect.stringContaining("mcp-oauth-callback-broker.json"),
        error: "ZodError",
        issue: expect.objectContaining({ code: "too_small", path: ["port"], minimum: 0 }),
        flow: { state: oauthState, generation: "malformed-generation" },
      })
    } finally {
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("two same-root backends share one callback identity and the peer takes over after owner exit", async () => {
    const root = await temporaryRoot("takeover")
    const ownerOutput = path.join(root, "owner.json")
    const peerOutput = path.join(root, "peer.json")
    const owner = spawnHolder(root, ownerOutput)
    let peer: ReturnType<typeof spawnHolder> | undefined
    try {
      const ownerBinding = await waitForJson<{ redirectUrl: string; generation: string }>(ownerOutput)
      peer = spawnHolder(root, peerOutput)
      const peerBinding = await waitForJson<{ redirectUrl: string; generation: string }>(peerOutput)
      expect(peerBinding).toEqual(ownerBinding)
      expect(await proofAvailable(ownerBinding.redirectUrl)).toBe(true)

      await stopChild(owner)
      const deadline = Date.now() + 10_000
      while (!(await proofAvailable(peerBinding.redirectUrl))) {
        if (Date.now() >= deadline) throw new Error("Same-root peer did not take over the durable callback URI")
        await Bun.sleep(100)
      }

      expect({ peerAlive: peer.exitCode === null, binding: peerBinding }).toEqual({
        peerAlive: true,
        binding: ownerBinding,
      })
    } finally {
      if (owner.exitCode === null) await stopChild(owner)
      if (peer) await stopChild(peer)
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test("peer monitoring admits only one proof and takeover attempt at a time", async () => {
    const root = await temporaryRoot("monitor-single-flight")
    const owner = spawnHolder(root, path.join(root, "owner.json"))
    let active = 0
    let maximum = 0
    let calls = 0
    try {
      const ownerBinding = await waitForJson<{ redirectUrl: string; generation: string }>(path.join(root, "owner.json"))
      McpOAuthCallback.TestHooks.setBeforeBrokerProbe(async () => {
        calls++
        active++
        maximum = Math.max(maximum, active)
        await Bun.sleep(700)
        active--
      })
      expect(await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())).toEqual(ownerBinding)
      await Bun.sleep(1_800)
      expect({ maximum, monitorProbed: calls >= 2 }).toEqual({ maximum: 1, monitorProbed: true })
    } finally {
      McpOAuthCallback.TestHooks.setBeforeBrokerProbe(undefined)
      await McpOAuthCallback.stop()
      await stopChild(owner)
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("a peer monitor survives an unreachable owner stall and later takes over automatically", async () => {
    const root = await temporaryRoot("monitor-stall-takeover")
    const ownerOutput = path.join(root, "owner.json")
    const stallTrigger = path.join(root, "stall.trigger")
    const stallStarted = path.join(root, "stall-started.json")
    const stallRecovered = path.join(root, "stall-recovered.json")
    const refusalObserved = Promise.withResolvers<void>()
    const owner = spawnStallingHolder(root, ownerOutput, stallTrigger, stallStarted, stallRecovered, 4_000)
    try {
      const binding = await waitForJson<{ redirectUrl: string; generation: string }>(ownerOutput)
      expect(await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())).toEqual(binding)
      McpOAuthCallback.TestHooks.setAfterUnreachableTakeoverRefusal(async () => refusalObserved.resolve())

      await writeFile(stallTrigger, "stall", "utf8")
      await waitForJson<{ started: true }>(stallStarted)
      await Promise.race([
        refusalObserved.promise,
        Bun.sleep(5_000).then(() => {
          throw new Error("Peer monitor did not observe an unreachable takeover refusal during the owner stall")
        }),
      ])
      await waitForJson<{ recovered: true }>(stallRecovered)
      expect(await proofAvailable(binding.redirectUrl)).toBe(true)

      await stopChild(owner)
      const deadline = Date.now() + 10_000
      while (!(await proofAvailable(binding.redirectUrl))) {
        if (Date.now() >= deadline) throw new Error("Peer monitor did not take over after the recovered owner exited")
        await Bun.sleep(100)
      }
      expect(await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())).toEqual(binding)
    } finally {
      McpOAuthCallback.TestHooks.setAfterUnreachableTakeoverRefusal(undefined)
      if (owner.exitCode === null) await stopChild(owner)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test("stop retires a broker startup that is still probing its persisted identity", async () => {
    const root = await temporaryRoot("stop-startup-barrier")
    let releaseProbe!: () => void
    let observedProbe!: () => void
    const probeEntered = new Promise<void>((resolve) => {
      observedProbe = resolve
    })
    const probeGate = new Promise<void>((resolve) => {
      releaseProbe = resolve
    })
    let portOwner: ReturnType<typeof Bun.serve> | undefined
    try {
      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      await McpOAuthCallback.stop()
      McpOAuthCallback.TestHooks.setBeforeBrokerProbe(async () => {
        observedProbe()
        await probeGate
      })

      const startup = Global.provideRoot(root, () => McpOAuthCallback.ensureRunning()).catch((error) => error)
      await probeEntered
      const stopping = McpOAuthCallback.stop()
      const concurrentStop = McpOAuthCallback.stop()
      const duringStop = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning()).catch((error) => error)
      releaseProbe()
      const [startupResult] = await Promise.all([startup, stopping, concurrentStop])
      const restarted = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      await McpOAuthCallback.stop()
      const port = Number(new URL(binding.redirectUrl).port)
      portOwner = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response("retired") })

      expect({
        startup: startupResult instanceof Error ? startupResult.message : startupResult,
        duringStop: duringStop instanceof Error ? duringStop.message : duringStop,
        restarted,
        running: McpOAuthCallback.isRunning(),
        reboundPort: portOwner.port,
      }).toEqual({
        startup: "MCP OAuth callback broker startup was retired by stop",
        duringStop: "MCP OAuth callback brokers are stopping",
        restarted: binding,
        running: false,
        reboundPort: port,
      })
    } finally {
      releaseProbe?.()
      McpOAuthCallback.TestHooks.setBeforeBrokerProbe(undefined)
      portOwner?.stop(true)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("a verified peer identity handoff retires the previous local server handle", async () => {
    const localRoot = await temporaryRoot("local-handoff")
    const peerRoot = await temporaryRoot("peer-handoff")
    const peer = spawnHolder(peerRoot, path.join(peerRoot, "binding.json"))
    let oldPortOwner: ReturnType<typeof Bun.serve> | undefined
    try {
      const localBinding = await Global.provideRoot(localRoot, () => McpOAuthCallback.ensureRunning())
      const peerBinding = await waitForJson<{ redirectUrl: string; generation: string }>(
        path.join(peerRoot, "binding.json"),
      )
      const peerIdentityPath = Global.provideRoot(peerRoot, () =>
        path.join(Global.Path.data, "mcp-oauth-callback-broker.json"),
      )
      const localIdentityPath = Global.provideRoot(localRoot, () =>
        path.join(Global.Path.data, "mcp-oauth-callback-broker.json"),
      )
      const peerIdentity = await readFile(peerIdentityPath, "utf8")
      await Filesystem.writeAtomic(localIdentityPath, peerIdentity, 0o600)

      expect(await Global.provideRoot(localRoot, () => McpOAuthCallback.ensureRunning())).toEqual(peerBinding)
      oldPortOwner = Bun.serve({
        hostname: "127.0.0.1",
        port: Number(new URL(localBinding.redirectUrl).port),
        fetch: () => new Response("old local port is free"),
      })
      expect({
        oldPortRebound: oldPortOwner.port,
        peerStillAvailable: await proofAvailable(peerBinding.redirectUrl),
      }).toEqual({
        oldPortRebound: Number(new URL(localBinding.redirectUrl).port),
        peerStillAvailable: true,
      })
    } finally {
      oldPortOwner?.stop(true)
      await McpOAuthCallback.stop()
      await stopChild(peer)
      await Promise.all([
        rm(localRoot, { recursive: true, force: true }),
        rm(peerRoot, { recursive: true, force: true }),
      ])
    }
  }, 15_000)

  test("independent data roots own distinct authenticated callback identities", async () => {
    const firstRoot = await temporaryRoot("root-a")
    const secondRoot = await temporaryRoot("root-b")
    const first = spawnHolder(firstRoot, path.join(firstRoot, "binding.json"))
    const second = spawnHolder(secondRoot, path.join(secondRoot, "binding.json"))
    try {
      const [firstBinding, secondBinding] = await Promise.all([
        waitForJson<{ redirectUrl: string; generation: string }>(path.join(firstRoot, "binding.json")),
        waitForJson<{ redirectUrl: string; generation: string }>(path.join(secondRoot, "binding.json")),
      ])
      expect({
        generationsDiffer: firstBinding.generation !== secondBinding.generation,
        redirectUrlsDiffer: firstBinding.redirectUrl !== secondBinding.redirectUrl,
        firstProof: await proofAvailable(firstBinding.redirectUrl),
        secondProof: await proofAvailable(secondBinding.redirectUrl),
      }).toEqual({
        generationsDiffer: true,
        redirectUrlsDiffer: true,
        firstProof: true,
        secondProof: true,
      })
    } finally {
      await Promise.all([stopChild(first), stopChild(second)])
      await Promise.all([
        rm(firstRoot, { recursive: true, force: true }),
        rm(secondRoot, { recursive: true, force: true }),
      ])
    }
  }, 30_000)

  test("same-state callback waiters and cancellation remain isolated by data root", async () => {
    const firstRoot = await temporaryRoot("waiter-root-a")
    const secondRoot = await temporaryRoot("waiter-root-b")
    const authKey = "project_shared:server"
    const oauthState = "same-process-same-state"
    try {
      const firstWaiter = Global.provideRoot(firstRoot, () =>
        McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "root-a-waiter"),
      )
      const secondWaiter = Global.provideRoot(secondRoot, () =>
        McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "root-b-waiter"),
      )
      Global.provideRoot(secondRoot, () => McpOAuthCallback.cancelPending(authKey))

      const secondSettlement = await secondWaiter
      await Global.provideRoot(firstRoot, async () => {
        const revision = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(authKey, oauthState, revision)
        await McpAuth.updateCodeVerifier(authKey, "root-a-verifier", revision)
        const ownerID = "root-a-owner"
        expect(await McpAuth.spendOAuthState(authKey, oauthState, revision, ownerID, Date.now() + 60_000)).toBe(true)
        await McpAuth.publishOAuthCallbackTerminal(authKey, oauthState, "connected", revision, ownerID)
      })
      const firstSettlement = await Promise.race([
        firstWaiter,
        Bun.sleep(5_000).then(() => ({ status: "timeout" as const })),
      ])

      expect({ firstSettlement, secondSettlement }).toEqual({
        firstSettlement: { status: "fulfilled", result: { status: "connected" } },
        secondSettlement: {
          status: "rejected",
          error: expect.objectContaining({ message: "Authorization cancelled" }),
        },
      })
    } finally {
      await McpOAuthCallback.stop()
      await Promise.all([
        rm(firstRoot, { recursive: true, force: true }),
        rm(secondRoot, { recursive: true, force: true }),
      ])
    }
  }, 15_000)

  test("callback identity rotation settles only callback-bound facts and preserves committed tokens", async () => {
    const root = await temporaryRoot("rotation")
    let unrelated: ReturnType<typeof Bun.serve> | undefined
    const refreshRequests: Record<string, string>[] = []
    const authorizationServer = Bun.serve({
      port: 0,
      fetch: async (request, server) => {
        const url = new URL(request.url)
        const base = `http://127.0.0.1:${server.port}`
        if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
          return Response.json({ resource: `${base}/mcp`, authorization_servers: [base] })
        }
        if (url.pathname.startsWith("/.well-known/oauth-authorization-server")) {
          return Response.json({
            issuer: base,
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
          })
        }
        if (url.pathname === "/token" && request.method === "POST") {
          refreshRequests.push(Object.fromEntries(new URLSearchParams(await request.text()).entries()))
          return Response.json({ access_token: "rotated-refresh-access", token_type: "Bearer", expires_in: 3600 })
        }
        return new Response("not found", { status: 404 })
      },
    })
    try {
      const first = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const authKey = "project_rotation:server"
      const serverUrl = `http://127.0.0.1:${authorizationServer.port}/mcp`
      const credentialIdentity = McpOAuthProvider.credentialIdentity(serverUrl, {})
      await Global.provideRoot(root, async () => {
        const revision = await McpAuth.beginCredentialLease(authKey, serverUrl, credentialIdentity)
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "callback-bound-client" },
          undefined,
          revision,
          undefined,
          first.generation,
          first.redirectUrl,
        )
        await McpAuth.updateTokens(
          authKey,
          { accessToken: "committed-token", refreshToken: "refresh-token" },
          serverUrl,
          revision,
          credentialIdentity,
        )
        await McpAuth.updateOAuthState(
          authKey,
          "open-state",
          revision,
          undefined,
          undefined,
          first.generation,
          first.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "open-verifier", revision)
      })
      await McpOAuthCallback.stop()

      const oldPort = Number(new URL(first.redirectUrl).port)
      unrelated = Bun.serve({
        hostname: "127.0.0.1",
        port: oldPort,
        fetch: () => Response.json({ generation: "foreign", proof: "00" }),
      })
      const replacement = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const entry = await Global.provideRoot(root, () => McpAuth.get(authKey))
      const refresh = await Global.provideRoot(root, async () => {
        if (!entry?.revision) throw new Error("Rotated refresh did not retain its credential revision")
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "future-authorization-client" },
          serverUrl,
          entry.revision,
          credentialIdentity,
          replacement.generation,
          replacement.redirectUrl,
        )
        const provider = new McpOAuthProvider(
          "server",
          authKey,
          serverUrl,
          {},
          "connection",
          replacement,
          { onRedirect: () => {} },
          entry?.revision,
        )
        const client = await provider.clientInformation()
        const result = await auth(provider, { serverUrl: new URL(serverUrl) })
        return { client, result, entry: await McpAuth.get(authKey) }
      })
      const retirement = await Global.provideRoot(root, async () => {
        const revision = refresh.entry?.revision
        if (!revision) throw new Error("Rotated refresh did not retain its credential revision")
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "future-authorization-client" },
          serverUrl,
          revision,
          credentialIdentity,
          replacement.generation,
          replacement.redirectUrl,
        )
        const oauthState = "post-retirement-authorization-state"
        await McpAuth.updateOAuthState(
          authKey,
          oauthState,
          revision,
          serverUrl,
          credentialIdentity,
          replacement.generation,
          replacement.redirectUrl,
        )
        let authorizationUrl: URL | undefined
        const provider = new McpOAuthProvider(
          "server",
          authKey,
          serverUrl,
          {},
          "authorization",
          replacement,
          { onRedirect: (url) => (authorizationUrl = url) },
          revision,
          undefined,
          oauthState,
        )
        const client = await provider.clientInformation()
        const result = await auth(provider, { serverUrl: new URL(serverUrl) })
        await McpAuth.invalidateCredentials(authKey, "tokens", revision)
        const retired = await McpAuth.get(authKey)
        return {
          tokenState: retired?.tokens ? "active" : "retired",
          tokenClientState: retired?.tokenClientInfo ? "active" : "retired",
          client,
          authorization: {
            result,
            clientId: authorizationUrl?.searchParams.get("client_id"),
            state: authorizationUrl?.searchParams.get("state"),
          },
        }
      })

      expect({
        generationChanged: replacement.generation !== first.generation,
        redirectChanged: replacement.redirectUrl !== first.redirectUrl,
        entry,
      }).toEqual({
        generationChanged: true,
        redirectChanged: true,
        entry: expect.objectContaining({ tokens: expect.objectContaining({ accessToken: "committed-token" }) }),
      })
      expect({
        clientInfo: entry?.clientInfo,
        oauthState: entry?.oauthState,
        codeVerifier: entry?.codeVerifier,
        callbackGeneration: entry?.callbackGeneration,
        callbackRedirectUrl: entry?.callbackRedirectUrl,
        clientCallbackGeneration: entry?.clientCallbackGeneration,
        clientCallbackRedirectUrl: entry?.clientCallbackRedirectUrl,
        tokenClientInfo: entry?.tokenClientInfo,
        refresh,
        refreshRequest: refreshRequests[0],
        refreshRequestCount: refreshRequests.length,
        retirement,
      }).toEqual({
        clientInfo: undefined,
        oauthState: undefined,
        codeVerifier: undefined,
        callbackGeneration: undefined,
        callbackRedirectUrl: undefined,
        clientCallbackGeneration: undefined,
        clientCallbackRedirectUrl: undefined,
        tokenClientInfo: { clientId: "callback-bound-client" },
        refresh: {
          client: { client_id: "callback-bound-client", client_secret: undefined },
          result: "AUTHORIZED",
          entry: expect.objectContaining({
            clientInfo: { clientId: "future-authorization-client" },
            tokens: expect.objectContaining({
              accessToken: "rotated-refresh-access",
              refreshToken: "refresh-token",
            }),
            tokenClientInfo: { clientId: "callback-bound-client" },
          }),
        },
        refreshRequest: expect.objectContaining({
          grant_type: "refresh_token",
          refresh_token: "refresh-token",
          client_id: "callback-bound-client",
        }),
        refreshRequestCount: 1,
        retirement: {
          tokenState: "retired",
          tokenClientState: "retired",
          client: { client_id: "future-authorization-client", client_secret: undefined },
          authorization: {
            result: "REDIRECT",
            clientId: "future-authorization-client",
            state: "post-retirement-authorization-state",
          },
        },
      })
    } finally {
      unrelated?.stop(true)
      authorizationServer.stop(true)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test("authorization-code exchange uses its current callback client while an old token client coexists", async () => {
    const root = await temporaryRoot("authorization-client-binding")
    const tokenRequests: Record<string, string>[] = []
    const authorizationServer = Bun.serve({
      port: 0,
      fetch: async (request, server) => {
        const url = new URL(request.url)
        const base = `http://127.0.0.1:${server.port}`
        if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
          return Response.json({ resource: `${base}/mcp`, authorization_servers: [base] })
        }
        if (url.pathname.startsWith("/.well-known/oauth-authorization-server")) {
          return Response.json({
            issuer: base,
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
          })
        }
        if (url.pathname === "/token" && request.method === "POST") {
          tokenRequests.push(Object.fromEntries(new URLSearchParams(await request.text()).entries()))
          return Response.json({
            access_token: "current-code-access",
            token_type: "Bearer",
            refresh_token: "current-code-refresh",
          })
        }
        return new Response("not found", { status: 404 })
      },
    })
    try {
      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const authKey = "project_authorization_client:server"
      const serverUrl = `http://127.0.0.1:${authorizationServer.port}/mcp`
      const credentialIdentity = McpOAuthProvider.credentialIdentity(serverUrl, {})
      const { revision, ownerID, oauthState } = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey, serverUrl, credentialIdentity)
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "old-token-client" },
          serverUrl,
          current,
          credentialIdentity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateTokens(
          authKey,
          { accessToken: "old-access", refreshToken: "old-refresh" },
          serverUrl,
          current,
          credentialIdentity,
        )
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "current-code-client" },
          serverUrl,
          current,
          credentialIdentity,
          binding.generation,
          binding.redirectUrl,
        )
        const state = "current-code-state"
        await McpAuth.updateOAuthState(
          authKey,
          state,
          current,
          serverUrl,
          credentialIdentity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "current-code-verifier", current)
        const owner = "current-code-owner"
        expect(await McpAuth.spendOAuthState(authKey, state, current, owner, Date.now() + 60_000)).toBe(true)
        return { revision: current, ownerID: owner, oauthState: state }
      })

      const result = await Global.provideRoot(root, async () => {
        const provider = new McpOAuthProvider(
          "server",
          authKey,
          serverUrl,
          {},
          "authorization",
          binding,
          { onRedirect: () => {} },
          revision,
          undefined,
          oauthState,
          "current-code-correlation",
          ownerID,
        )
        const exchange = await auth(provider, {
          serverUrl: new URL(serverUrl),
          authorizationCode: "current-client-code",
        })
        await McpAuth.publishOAuthCallbackTerminal(authKey, oauthState, "connected", revision, ownerID)
        return { exchange, entry: await McpAuth.get(authKey) }
      })

      expect({ request: tokenRequests[0], requestCount: tokenRequests.length, result }).toEqual({
        request: expect.objectContaining({
          grant_type: "authorization_code",
          code: "current-client-code",
          code_verifier: "current-code-verifier",
          client_id: "current-code-client",
          redirect_uri: binding.redirectUrl,
        }),
        requestCount: 1,
        result: {
          exchange: "AUTHORIZED",
          entry: expect.objectContaining({
            clientInfo: { clientId: "current-code-client" },
            tokenClientInfo: { clientId: "current-code-client" },
            tokens: expect.objectContaining({ accessToken: "current-code-access" }),
            oauthCallbackTerminals: {
              [oauthState]: expect.objectContaining({ outcome: "connected" }),
            },
          }),
        },
      })
    } finally {
      authorizationServer.stop(true)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test("a superseded finishing provider cannot read the next occurrence client or verifier", async () => {
    const root = await temporaryRoot("authorization-occurrence-crossover")
    const tokenRequests: Record<string, string>[] = []
    const authorizationServer = Bun.serve({
      port: 0,
      fetch: async (request, server) => {
        const url = new URL(request.url)
        const base = `http://127.0.0.1:${server.port}`
        if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
          return Response.json({ resource: `${base}/mcp`, authorization_servers: [base] })
        }
        if (url.pathname.startsWith("/.well-known/oauth-authorization-server")) {
          return Response.json({
            issuer: base,
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
          })
        }
        if (url.pathname === "/token" && request.method === "POST") {
          tokenRequests.push(Object.fromEntries(new URLSearchParams(await request.text()).entries()))
          return Response.json({ access_token: "next-access", token_type: "Bearer" })
        }
        return new Response("not found", { status: 404 })
      },
    })
    try {
      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const authKey = "project_authorization_crossover:server"
      const serverUrl = `http://127.0.0.1:${authorizationServer.port}/mcp`
      const identity = McpOAuthProvider.credentialIdentity(serverUrl, {})
      const old = await Global.provideRoot(root, async () => {
        const revision = await McpAuth.beginCredentialLease(authKey, serverUrl, identity)
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "old-occurrence-client" },
          serverUrl,
          revision,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateOAuthState(
          authKey,
          "old-occurrence-state",
          revision,
          serverUrl,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "old-occurrence-verifier", revision)
        const ownerID = "old-occurrence-owner"
        await McpAuth.spendOAuthState(authKey, "old-occurrence-state", revision, ownerID, Date.now() + 60_000)
        return { revision, ownerID }
      })
      const staleProvider = new McpOAuthProvider(
        "server",
        authKey,
        serverUrl,
        {},
        "authorization",
        binding,
        { onRedirect: () => {} },
        old.revision,
        undefined,
        "old-occurrence-state",
        "old-occurrence-correlation",
        old.ownerID,
      )
      const next = await Global.provideRoot(root, async () => {
        await McpAuth.remove(authKey)
        const revision = await McpAuth.beginCredentialLease(authKey, serverUrl, identity)
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "next-occurrence-client" },
          serverUrl,
          revision,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateOAuthState(
          authKey,
          "next-occurrence-state",
          revision,
          serverUrl,
          identity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateCodeVerifier(authKey, "next-occurrence-verifier", revision)
        const ownerID = "next-occurrence-owner"
        await McpAuth.spendOAuthState(authKey, "next-occurrence-state", revision, ownerID, Date.now() + 60_000)
        return { revision, ownerID }
      })
      const staleClient = await Global.provideRoot(root, () => staleProvider.clientInformation()).catch(
        (error) => error,
      )
      const staleExchange = await Global.provideRoot(root, () =>
        auth(staleProvider, { serverUrl: new URL(serverUrl), authorizationCode: "old-code" }),
      ).catch((error) => error)
      const nextExchange = await Global.provideRoot(root, () =>
        auth(
          new McpOAuthProvider(
            "server",
            authKey,
            serverUrl,
            {},
            "authorization",
            binding,
            { onRedirect: () => {} },
            next.revision,
            undefined,
            "next-occurrence-state",
            "next-occurrence-correlation",
            next.ownerID,
          ),
          { serverUrl: new URL(serverUrl), authorizationCode: "next-code" },
        ),
      )

      expect({
        staleClient: staleClient instanceof Error ? staleClient.message : staleClient,
        staleExchange: staleExchange instanceof Error ? staleExchange.message : staleExchange,
        nextExchange,
        requests: tokenRequests,
      }).toEqual({
        staleClient: `MCP OAuth authorization occurrence is no longer current: ${authKey}`,
        staleExchange: `MCP OAuth authorization occurrence is no longer current: ${authKey}`,
        nextExchange: "AUTHORIZED",
        requests: [
          expect.objectContaining({
            code: "next-code",
            code_verifier: "next-occurrence-verifier",
            client_id: "next-occurrence-client",
          }),
        ],
      })
    } finally {
      authorizationServer.stop(true)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test("one refresh attempt never mixes client and token snapshots across a callback commit", async () => {
    const root = await temporaryRoot("refresh-snapshot-barrier")
    const refreshRequests: Record<string, string>[] = []
    const authorizationServer = Bun.serve({
      port: 0,
      fetch: async (request, server) => {
        const url = new URL(request.url)
        const base = `http://127.0.0.1:${server.port}`
        if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
          return Response.json({ resource: `${base}/mcp`, authorization_servers: [base] })
        }
        if (url.pathname.startsWith("/.well-known/oauth-authorization-server")) {
          return Response.json({
            issuer: base,
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
          })
        }
        if (url.pathname === "/token" && request.method === "POST") {
          const fields = Object.fromEntries(new URLSearchParams(await request.text()).entries())
          refreshRequests.push(fields)
          return Response.json({
            access_token: `access-for-${fields.refresh_token}`,
            token_type: "Bearer",
            refresh_token: fields.refresh_token,
          })
        }
        return new Response("not found", { status: 404 })
      },
    })
    let clientRead: ReturnType<typeof spyOn> | undefined
    try {
      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const authKey = "project_refresh_barrier:server"
      const serverUrl = `http://127.0.0.1:${authorizationServer.port}/mcp`
      const credentialIdentity = McpOAuthProvider.credentialIdentity(serverUrl, {})
      const revision = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey, serverUrl, credentialIdentity)
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "old-refresh-client" },
          serverUrl,
          current,
          credentialIdentity,
          binding.generation,
          binding.redirectUrl,
        )
        await McpAuth.updateTokens(
          authKey,
          { accessToken: "old-access", refreshToken: "old-refresh" },
          serverUrl,
          current,
          credentialIdentity,
        )
        return current
      })
      const staleProvider = new McpOAuthProvider(
        "server",
        authKey,
        serverUrl,
        {},
        "connection",
        binding,
        { onRedirect: () => {} },
        revision,
      )
      const originalClientInformation = staleProvider.clientInformation.bind(staleProvider)
      let publishWinner = true
      clientRead = spyOn(staleProvider, "clientInformation").mockImplementation(async () => {
        const selected = await originalClientInformation()
        if (publishWinner) {
          publishWinner = false
          await Global.provideRoot(root, async () => {
            await McpAuth.updateClientInfo(
              authKey,
              { clientId: "winner-client" },
              serverUrl,
              revision,
              credentialIdentity,
              binding.generation,
              binding.redirectUrl,
            )
            await McpAuth.updateTokens(
              authKey,
              { accessToken: "winner-access", refreshToken: "winner-refresh" },
              serverUrl,
              revision,
              credentialIdentity,
            )
          })
        }
        return selected
      })
      const staleResult = await Global.provideRoot(root, () =>
        auth(staleProvider, { serverUrl: new URL(serverUrl) }),
      ).catch((error) => error)
      clientRead.mockRestore()
      clientRead = undefined
      const afterStale = await Global.provideRoot(root, () => McpAuth.get(authKey))

      const freshResult = await Global.provideRoot(root, async () => {
        const provider = new McpOAuthProvider(
          "server",
          authKey,
          serverUrl,
          {},
          "connection",
          binding,
          { onRedirect: () => {} },
          revision,
        )
        const result = await auth(provider, { serverUrl: new URL(serverUrl) })
        return { result, entry: await McpAuth.get(authKey) }
      })
      const sameValueProvider = new McpOAuthProvider(
        "server",
        authKey,
        serverUrl,
        {},
        "connection",
        binding,
        { onRedirect: () => {} },
        revision,
      )
      await Global.provideRoot(root, () => sameValueProvider.clientInformation())
      const nextRevision = await Global.provideRoot(root, () =>
        McpAuth.beginCredentialLease(authKey, serverUrl, credentialIdentity),
      )
      const sameValueStale = await Global.provideRoot(root, () =>
        auth(sameValueProvider, { serverUrl: new URL(serverUrl) }),
      ).catch((error) => error)
      const sameValueFresh = await Global.provideRoot(root, async () => {
        const provider = new McpOAuthProvider(
          "server",
          authKey,
          serverUrl,
          {},
          "connection",
          binding,
          { onRedirect: () => {} },
          nextRevision,
        )
        return auth(provider, { serverUrl: new URL(serverUrl) })
      })

      let canonicalConfigCurrent = true
      const staleConfigProvider = new McpOAuthProvider(
        "server",
        authKey,
        serverUrl,
        {},
        "connection",
        binding,
        { onRedirect: () => {} },
        nextRevision,
        async () => {
          if (!canonicalConfigCurrent) throw new Error("canonical MCP configuration changed")
        },
      )
      await Global.provideRoot(root, () => staleConfigProvider.clientInformation())
      canonicalConfigCurrent = false
      const staleConfigResult = await Global.provideRoot(root, () =>
        auth(staleConfigProvider, { serverUrl: new URL(serverUrl) }),
      ).catch((error) => error)
      expect({
        staleResult: staleResult instanceof Error ? staleResult.message : staleResult,
        requests: refreshRequests.map((request) => ({
          client: request.client_id,
          refresh: request.refresh_token,
        })),
        afterStale: {
          accessToken: afterStale?.tokens?.accessToken,
          refreshToken: afterStale?.tokens?.refreshToken,
          tokenClient: afterStale?.tokenClientInfo?.clientId,
        },
        freshResult: {
          result: freshResult.result,
          accessToken: freshResult.entry?.tokens?.accessToken,
          refreshToken: freshResult.entry?.tokens?.refreshToken,
          tokenClient: freshResult.entry?.tokenClientInfo?.clientId,
        },
        sameValueRevision: {
          stale: sameValueStale instanceof Error ? sameValueStale.message : sameValueStale,
          fresh: sameValueFresh,
        },
        staleConfig: staleConfigResult instanceof Error ? staleConfigResult.message : staleConfigResult,
      }).toEqual({
        staleResult: "MCP OAuth credential snapshot changed; retry connection",
        requests: [
          { client: "winner-client", refresh: "winner-refresh" },
          { client: "winner-client", refresh: "winner-refresh" },
        ],
        afterStale: {
          accessToken: "winner-access",
          refreshToken: "winner-refresh",
          tokenClient: "winner-client",
        },
        freshResult: {
          result: "AUTHORIZED",
          accessToken: "access-for-winner-refresh",
          refreshToken: "winner-refresh",
          tokenClient: "winner-client",
        },
        sameValueRevision: {
          stale: "MCP OAuth credential snapshot changed; retry connection",
          fresh: "AUTHORIZED",
        },
        staleConfig: "canonical MCP configuration changed",
      })
    } finally {
      clientRead?.mockRestore()
      authorizationServer.stop(true)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test("a reachable foreign listener rotates the broker and settles the obsolete callback generation", async () => {
    const root = await temporaryRoot("foreign-malformed-proof")
    let stalled: ReturnType<typeof Bun.serve> | undefined
    try {
      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const authKey = "project_unreachable:server"
      const revision = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(
          authKey,
          "still-open-state",
          current,
          undefined,
          undefined,
          binding.generation,
          binding.redirectUrl,
        )
        return current
      })
      await McpOAuthCallback.stop()
      expect(await proofAvailable(binding.redirectUrl)).toBe(false)
      stalled = Bun.serve({
        hostname: "127.0.0.1",
        port: Number(new URL(binding.redirectUrl).port),
        reusePort: false,
        fetch: () => new Response("malformed proof", { headers: { Connection: "close" } }),
      })
      const callback = new URL(binding.redirectUrl)
      const stalledProof = await fetch(
        `${callback.origin}/mcp/oauth/broker-proof?challenge=${encodeURIComponent(crypto.randomUUID())}`,
        { headers: { Connection: "close" } },
      )
      expect(await stalledProof.text()).toBe("malformed proof")
      const rotated = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const entry = await Global.provideRoot(root, () => McpAuth.get(authKey))
      expect({
        bindingDisposition: rotated.redirectUrl === binding.redirectUrl ? "reused" : "rotated",
        proof: await proofAvailable(rotated.redirectUrl),
        terminal: entry?.oauthCallbackTerminals?.["still-open-state"]?.outcome,
        revisionDisposition: entry?.revision === revision ? "retained" : "replaced",
      }).toEqual({
        bindingDisposition: "rotated",
        proof: true,
        terminal: "broker_rotated",
        revisionDisposition: "replaced",
      })

      stalled.stop(true)
      stalled = undefined
      expect(await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())).toEqual(rotated)
    } finally {
      stalled?.stop(true)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("terminal history survives a new lease and a replaced pending flow publishes its own terminal", async () => {
    const root = await temporaryRoot("terminal-history")
    try {
      const authKey = "project_history:server"
      const firstState = "completed-state"
      const pendingState = "pending-state"
      const facts = await Global.provideRoot(root, async () => {
        const first = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(authKey, firstState, first)
        await McpAuth.updateCodeVerifier(authKey, "first-verifier", first)
        const ownerID = "terminal-history-owner"
        expect(await McpAuth.spendOAuthState(authKey, firstState, first, ownerID, Date.now() + 60_000)).toBe(true)
        await McpAuth.publishOAuthCallbackTerminal(authKey, firstState, "connected", first, ownerID)

        const second = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(authKey, pendingState, second)
        await McpAuth.updateCodeVerifier(authKey, "second-verifier", second)
        const third = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        return { first, second, third, entry: await McpAuth.get(authKey) }
      })

      expect(facts).toEqual({
        first: expect.any(String),
        second: expect.any(String),
        third: expect.any(String),
        entry: expect.objectContaining({
          revision: facts.third,
          oauthCallbackTerminals: {
            [firstState]: expect.objectContaining({ outcome: "connected" }),
            [pendingState]: expect.objectContaining({ outcome: "superseded" }),
          },
        }),
      })
      expect(new Set([facts.first, facts.second, facts.third]).size).toBe(3)
    } finally {
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("credential retirement terminalizes pending and finishing waiters before retaining terminal-only tombstones", async () => {
    const root = await temporaryRoot("credential-retirement")
    try {
      const pendingKey = "project_retirement:pending"
      const finishingKey = "project_retirement:finishing"
      const pendingState = "retired-pending-state"
      const finishingState = "retired-finishing-state"
      const facts = await Global.provideRoot(root, async () => {
        const pendingRevision = await McpAuth.beginCredentialLease(pendingKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(pendingKey, pendingState, pendingRevision)
        await McpAuth.updateCodeVerifier(pendingKey, "pending-retirement-verifier", pendingRevision)
        const finishingRevision = await McpAuth.beginCredentialLease(finishingKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(finishingKey, finishingState, finishingRevision)
        await McpAuth.updateCodeVerifier(finishingKey, "finishing-retirement-verifier", finishingRevision)
        expect(
          await McpAuth.spendOAuthState(
            finishingKey,
            finishingState,
            finishingRevision,
            "retired-finishing-owner",
            Date.now() + 60_000,
          ),
        ).toBe(true)
        const pendingWaiter = McpOAuthCallback.waitForCallbackSettlement(
          pendingState,
          pendingKey,
          "retired-pending-waiter",
        )
        const finishingWaiter = McpOAuthCallback.waitForCallbackSettlement(
          finishingState,
          finishingKey,
          "retired-finishing-waiter",
        )
        await McpAuth.removeMany([pendingKey, finishingKey])
        return {
          pendingWaiter: await pendingWaiter,
          finishingWaiter: await finishingWaiter,
          pending: await McpAuth.get(pendingKey),
          finishing: await McpAuth.get(finishingKey),
        }
      })

      expect(facts).toEqual({
        pendingWaiter: {
          status: "rejected",
          error: expect.objectContaining({ message: "MCP OAuth authorization was revoked before completion" }),
        },
        finishingWaiter: {
          status: "rejected",
          error: expect.objectContaining({ message: "MCP OAuth exchange outcome is uncertain and cannot be replayed" }),
        },
        pending: expect.objectContaining({
          oauthCallbackTerminals: {
            [pendingState]: expect.objectContaining({ outcome: "revoked" }),
          },
        }),
        finishing: expect.objectContaining({
          oauthCallbackTerminals: {
            [finishingState]: expect.objectContaining({ outcome: "exchange_uncertain" }),
          },
        }),
      })
      expect({
        pendingMaterial: facts.pending ? McpAuth.hasCredentialOrFlowMaterial(facts.pending) : true,
        finishingMaterial: facts.finishing ? McpAuth.hasCredentialOrFlowMaterial(facts.finishing) : true,
      }).toEqual({ pendingMaterial: false, finishingMaterial: false })
    } finally {
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("a pre-rename retirement retry rotates the terminal tombstone before stale-writer admission", async () => {
    const root = await temporaryRoot("retirement-pre-rename")
    const authKey = "project_retirement_retry:server"
    const oauthState = "retirement-retry-state"
    let write: ReturnType<typeof spyOn> | undefined
    try {
      const revision = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey)
        await McpAuth.updateOAuthState(authKey, oauthState, current)
        await McpAuth.abandonOAuthState(authKey, oauthState, current, "provider_rejected")
        return current
      })
      write = spyOn(Filesystem, "writeAtomic").mockImplementation(async () => {
        throw new Error("retirement write failed before rename")
      })
      const first = await Global.provideRoot(root, () => McpAuth.removeMany([authKey])).catch((error) => error)
      write.mockRestore()
      write = undefined

      await Global.provideRoot(root, () => McpAuth.removeMany([authKey]))
      const stale = await Global.provideRoot(root, () =>
        McpAuth.updateTokens(authKey, { accessToken: "stale-token" }, undefined, revision),
      ).catch((error) => error)
      const current = await Global.provideRoot(root, () => McpAuth.get(authKey))
      expect({
        first: first instanceof Error ? first.message : first,
        stale: stale instanceof Error ? stale.message : stale,
        terminal: current?.oauthCallbackTerminals?.[oauthState],
      }).toEqual({
        first: "retirement write failed before rename",
        stale: `MCP auth lease was revoked: ${authKey}`,
        terminal: expect.objectContaining({ outcome: "provider_rejected" }),
      })
    } finally {
      write?.mockRestore()
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("a killed finishing owner converges to a retained non-replayable uncertain terminal", async () => {
    const root = await temporaryRoot("killed-finishing")
    const output = path.join(root, "finishing.json")
    const authKey = "project_killed:server"
    const oauthState = "killed-finishing-state"
    let child: ReturnType<typeof Bun.spawn> | undefined
    try {
      const revision = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(authKey, oauthState, current)
        await McpAuth.updateCodeVerifier(authKey, "killed-verifier", current)
        return current
      })
      child = Bun.spawn([process.execPath, finishingWorker, root, authKey, oauthState, revision, output, "300"], {
        cwd: path.join(import.meta.dir, "../.."),
        stdout: "pipe",
        stderr: "pipe",
      })
      expect(await waitForJson<{ spent: boolean }>(output)).toEqual({ spent: true })
      const waiter = Global.provideRoot(root, () =>
        McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, "killed-finishing-waiter"),
      )
      await stopChild(child)
      child = undefined
      await Bun.sleep(350)

      expect(await Promise.race([waiter, Bun.sleep(2_000).then(() => "timeout" as const)])).toEqual({
        status: "rejected",
        error: expect.objectContaining({ message: "MCP OAuth exchange outcome is uncertain and cannot be replayed" }),
      })

      const settled = await Global.provideRoot(root, async () => {
        const nextRevision = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        return { nextRevision, entry: await McpAuth.get(authKey) }
      })
      expect(settled).toEqual({
        nextRevision: expect.any(String),
        entry: expect.objectContaining({
          revision: settled.nextRevision,
          oauthCallbackTerminals: {
            [oauthState]: expect.objectContaining({ outcome: "exchange_uncertain" }),
          },
        }),
      })
      expect(settled.nextRevision).not.toBe(revision)
      expect({ pending: settled.entry?.oauthState, finishing: settled.entry?.oauthFinishing }).toEqual({
        pending: undefined,
        finishing: undefined,
      })
    } finally {
      if (child) await stopChild(child)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("an ambiguous terminal write reconciles from the exact committed occurrence", async () => {
    const root = await temporaryRoot("terminal-ambiguity")
    const authKey = "project_ambiguity:server"
    const oauthState = "ambiguous-terminal-state"
    let write: ReturnType<typeof spyOn> | undefined
    try {
      const { revision, ownerID } = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(authKey, oauthState, current)
        await McpAuth.updateCodeVerifier(authKey, "ambiguity-verifier", current)
        const currentOwner = "ambiguous-terminal-owner"
        expect(await McpAuth.spendOAuthState(authKey, oauthState, current, currentOwner, Date.now() + 60_000)).toBe(
          true,
        )
        return { revision: current, ownerID: currentOwner }
      })
      const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
      let inject = true
      write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
        await originalWrite(...args)
        if (inject) {
          inject = false
          throw new Error("ambiguous write after rename")
        }
      })

      await Global.provideRoot(root, () =>
        McpAuth.publishOAuthCallbackTerminal(authKey, oauthState, "connected", revision, ownerID),
      )
      expect(await Global.provideRoot(root, () => McpAuth.getOAuthCallbackTerminal(authKey, oauthState))).toEqual(
        expect.objectContaining({ outcome: "connected" }),
      )
    } finally {
      write?.mockRestore()
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("ambiguous finishing admission and renewal retain the exact owner fence", async () => {
    const root = await temporaryRoot("finishing-ambiguity")
    const authKey = "project_finishing_ambiguity:server"
    const oauthState = "ambiguous-finishing-state"
    let write: ReturnType<typeof spyOn> | undefined
    try {
      const revision = await Global.provideRoot(root, async () => {
        const current = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateOAuthState(authKey, oauthState, current)
        await McpAuth.updateCodeVerifier(authKey, "ambiguous-finishing-verifier", current)
        return current
      })
      const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
      let ambiguousWrites = 2
      write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
        await originalWrite(...args)
        if (ambiguousWrites > 0) {
          ambiguousWrites--
          throw new Error("ambiguous finishing write after rename")
        }
      })
      const ownerID = "ambiguous-finishing-owner"
      const firstExpiry = Date.now() + 30_000
      expect(
        await Global.provideRoot(root, () =>
          McpAuth.spendOAuthState(authKey, oauthState, revision, ownerID, firstExpiry),
        ),
      ).toBe(true)
      const renewedExpiry = firstExpiry + 30_000
      expect(
        await Global.provideRoot(root, () =>
          McpAuth.renewOAuthFinishing(authKey, oauthState, revision, ownerID, renewedExpiry),
        ),
      ).toBe(true)
      expect(await Global.provideRoot(root, () => McpAuth.get(authKey))).toEqual(
        expect.objectContaining({
          revision,
          oauthFinishing: { oauthState, ownerID, leaseExpiresAt: renewedExpiry },
        }),
      )
    } finally {
      write?.mockRestore()
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("the live finishing occurrence is the exclusive writer of credential and flow facts", async () => {
    const root = await temporaryRoot("finishing-exclusive-writer")
    const authKey = "project_finishing_writer:server"
    const oauthState = "exclusive-finishing-state"
    const ownerID = "exclusive-finishing-owner"
    try {
      const result = await Global.provideRoot(root, async () => {
        const revision = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid", "identity-a")
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "client-a" },
          undefined,
          revision,
          undefined,
          "generation-a",
          "http://127.0.0.1:31234/mcp/oauth/callback",
        )
        await McpAuth.updateOAuthState(
          authKey,
          oauthState,
          revision,
          undefined,
          undefined,
          "generation-a",
          "http://127.0.0.1:31234/mcp/oauth/callback",
        )
        await McpAuth.updateCodeVerifier(authKey, "verifier-a", revision)
        expect(await McpAuth.spendOAuthState(authKey, oauthState, revision, ownerID, Date.now() + 60_000)).toBe(true)

        const ordinaryWrites = await Promise.allSettled([
          McpAuth.updateTokens(authKey, { accessToken: "foreign-token" }, undefined, revision),
          McpAuth.updateClientInfo(authKey, { clientId: "foreign-client" }, undefined, revision),
          McpAuth.invalidateCredentials(authKey, "all", revision),
          McpAuth.updateCodeVerifier(authKey, "foreign-verifier", revision),
          McpAuth.updateOAuthState(authKey, "foreign-state", revision),
          McpAuth.set(authKey, { tokens: { accessToken: "foreign-set-token" } }, undefined, revision),
          McpAuth.stageStaticCredential(authKey, "foreign-secret", "https://foreign.invalid", "foreign-identity"),
        ])
        await McpAuth.updateTokens(authKey, { accessToken: "owner-token" }, undefined, revision, undefined, {
          oauthState,
          ownerID,
        })
        return { ordinaryWrites, entry: await McpAuth.get(authKey) }
      })

      expect(
        result.ordinaryWrites.map((outcome) =>
          outcome.status === "rejected" && outcome.reason instanceof Error ? outcome.reason.message : outcome,
        ),
      ).toEqual(Array.from({ length: 7 }, () => `MCP OAuth finishing occurrence is not current: ${authKey}`))
      expect(result.entry).toEqual(
        expect.objectContaining({
          tokens: { accessToken: "owner-token" },
          clientInfo: { clientId: "client-a" },
          codeVerifier: "verifier-a",
          callbackGeneration: "generation-a",
          callbackRedirectUrl: "http://127.0.0.1:31234/mcp/oauth/callback",
          oauthFinishing: expect.objectContaining({ oauthState, ownerID }),
        }),
      )
    } finally {
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("an ambiguous generation-settlement write reconciles every obsolete callback fact", async () => {
    const root = await temporaryRoot("generation-ambiguity")
    const authKey = "project_generation_ambiguity:server"
    let write: ReturnType<typeof spyOn> | undefined
    try {
      await Global.provideRoot(root, async () => {
        const revision = await McpAuth.beginCredentialLease(authKey, "https://mcp.invalid")
        await McpAuth.updateClientInfo(
          authKey,
          { clientId: "obsolete-client" },
          undefined,
          revision,
          undefined,
          "obsolete-generation",
          "http://127.0.0.1:31234/mcp/oauth/callback",
        )
        await McpAuth.updateOAuthState(
          authKey,
          "obsolete-state",
          revision,
          undefined,
          undefined,
          "obsolete-generation",
          "http://127.0.0.1:31234/mcp/oauth/callback",
        )
        await McpAuth.updateCodeVerifier(authKey, "obsolete-verifier", revision)
      })
      const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
      let inject = true
      write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
        await originalWrite(...args)
        if (inject) {
          inject = false
          throw new Error("ambiguous generation settlement after rename")
        }
      })

      await Global.provideRoot(root, () => McpAuth.settleCallbackGeneration("current-generation"))
      const entry = await Global.provideRoot(root, () => McpAuth.get(authKey))
      expect(entry).toEqual(
        expect.objectContaining({
          oauthCallbackTerminals: {
            "obsolete-state": expect.objectContaining({ outcome: "broker_rotated" }),
          },
        }),
      )
      expect({ state: entry?.oauthState, verifier: entry?.codeVerifier, client: entry?.clientInfo }).toEqual({
        state: undefined,
        verifier: undefined,
        client: undefined,
      })
    } finally {
      write?.mockRestore()
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("broker startup retries generation settlement after identity publication", async () => {
    const root = await temporaryRoot("identity-settlement")
    const originalSettle = McpAuth.settleCallbackGeneration.bind(McpAuth)
    let calls = 0
    const settle = spyOn(McpAuth, "settleCallbackGeneration").mockImplementation(async (...args) => {
      calls++
      if (calls === 1) throw new Error("settlement interrupted after identity publication")
      return originalSettle(...args)
    })
    try {
      const first = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning()).catch((error) => error)
      const identityPath = Global.provideRoot(root, () => path.join(Global.Path.data, "mcp-oauth-callback-broker.json"))
      const committedIdentity = await waitForJson<{ port: number; generation: string }>(identityPath)
      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())

      expect({ first, calls, binding }).toEqual({
        first: expect.any(Error),
        calls: 2,
        binding: {
          generation: committedIdentity.generation,
          redirectUrl: `http://127.0.0.1:${committedIdentity.port}/mcp/oauth/callback`,
        },
      })
      expect(await proofAvailable(binding.redirectUrl)).toBe(true)
    } finally {
      settle.mockRestore()
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("broker startup accepts an exact identity committed by an ambiguous atomic rename", async () => {
    const root = await temporaryRoot("identity-ambiguity")
    const identityPath = await Global.provideRoot(root, () =>
      path.join(Global.Path.data, "mcp-oauth-callback-broker.json"),
    )
    const originalWrite = Filesystem.writeAtomic.bind(Filesystem)
    let injectedIdentity: { port: number; generation: string } | undefined
    const write = spyOn(Filesystem, "writeAtomic").mockImplementation(async (...args) => {
      await originalWrite(...args)
      if (String(args[0]) !== identityPath || injectedIdentity) return
      injectedIdentity = JSON.parse(String(args[1])) as { port: number; generation: string }
      throw new Error("ambiguous broker identity write after rename")
    })
    try {
      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const committed = await waitForJson<{ port: number; generation: string }>(identityPath)
      expect({ binding, injectedIdentity, committed, proof: await proofAvailable(binding.redirectUrl) }).toEqual({
        binding: {
          generation: committed.generation,
          redirectUrl: `http://127.0.0.1:${committed.port}/mcp/oauth/callback`,
        },
        injectedIdentity: committed,
        committed,
        proof: true,
      })
    } finally {
      write.mockRestore()
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)

  test("terminal polling converts repeated durable read failures into one observed waiter error", async () => {
    const read = spyOn(McpAuth, "getOAuthCallbackTerminal").mockRejectedValue(
      new Error("injected durable read failure"),
    )
    try {
      const settlement = McpOAuthCallback.waitForCallbackSettlement(
        "terminal-read-state",
        "project_read:server",
        "terminal-read-correlation",
      )
      expect(await Promise.race([settlement, Bun.sleep(2_000).then(() => "timeout" as const)])).toEqual({
        status: "rejected",
        error: expect.objectContaining({ message: "MCP OAuth callback terminal could not be read durably" }),
      })
    } finally {
      read.mockRestore()
    }
  }, 5_000)

  test("the first broker generation terminalizes legacy callback-bound facts", async () => {
    const root = await temporaryRoot("legacy")
    const refreshRequests: Record<string, string>[] = []
    const authorizationServer = Bun.serve({
      port: 0,
      fetch: async (request, server) => {
        const url = new URL(request.url)
        const base = `http://127.0.0.1:${server.port}`
        if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
          return Response.json({ resource: `${base}/mcp`, authorization_servers: [base] })
        }
        if (url.pathname.startsWith("/.well-known/oauth-authorization-server")) {
          return Response.json({
            issuer: base,
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
          })
        }
        if (url.pathname === "/token" && request.method === "POST") {
          const fields = Object.fromEntries(new URLSearchParams(await request.text()).entries())
          refreshRequests.push(fields)
          return Response.json({
            access_token: "legacy-refreshed-access",
            token_type: "Bearer",
            refresh_token: fields.refresh_token,
          })
        }
        return new Response("not found", { status: 404 })
      },
    })
    try {
      const authKey = "project_legacy:server"
      const serverUrl = `http://127.0.0.1:${authorizationServer.port}/mcp`
      const credentialIdentity = McpOAuthProvider.credentialIdentity(serverUrl, {})
      await Global.provideRoot(root, async () => {
        const revision = await McpAuth.beginCredentialLease(authKey, serverUrl, credentialIdentity)
        await McpAuth.set(
          authKey,
          {
            tokens: { accessToken: "legacy-token", refreshToken: "legacy-refresh" },
            clientInfo: { clientId: "legacy-client" },
            oauthState: "legacy-open-state",
            codeVerifier: "legacy-verifier",
          },
          serverUrl,
          revision,
          credentialIdentity,
        )
      })

      const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
      const entry = await Global.provideRoot(root, () => McpAuth.get(authKey))
      if (!entry?.revision) throw new Error("Legacy broker settlement did not retain a credential revision")
      const refresh = await Global.provideRoot(root, async () => {
        const provider = new McpOAuthProvider(
          "server",
          authKey,
          serverUrl,
          {},
          "connection",
          binding,
          { onRedirect: () => {} },
          entry.revision,
        )
        const result = await auth(provider, { serverUrl: new URL(serverUrl) })
        return { result, entry: await McpAuth.get(authKey) }
      })
      expect({
        settled: {
          accessToken: entry.tokens?.accessToken,
          refreshToken: entry.tokens?.refreshToken,
          tokenClient: entry.tokenClientInfo?.clientId,
          terminal: entry.oauthCallbackTerminals?.["legacy-open-state"]?.outcome,
          oauthState: entry.oauthState,
          codeVerifier: entry.codeVerifier,
          clientInfo: entry.clientInfo,
        },
        refreshRequest: refreshRequests[0],
        refreshRequestCount: refreshRequests.length,
        refresh: {
          result: refresh.result,
          accessToken: refresh.entry?.tokens?.accessToken,
          refreshToken: refresh.entry?.tokens?.refreshToken,
          tokenClient: refresh.entry?.tokenClientInfo?.clientId,
        },
      }).toEqual({
        settled: {
          accessToken: "legacy-token",
          refreshToken: "legacy-refresh",
          tokenClient: "legacy-client",
          terminal: "broker_rotated",
          oauthState: undefined,
          codeVerifier: undefined,
          clientInfo: undefined,
        },
        refreshRequest: expect.objectContaining({
          grant_type: "refresh_token",
          refresh_token: "legacy-refresh",
          client_id: "legacy-client",
        }),
        refreshRequestCount: 1,
        refresh: {
          result: "AUTHORIZED",
          accessToken: "legacy-refreshed-access",
          refreshToken: "legacy-refresh",
          tokenClient: "legacy-client",
        },
      })
    } finally {
      authorizationServer.stop(true)
      await McpOAuthCallback.stop()
      await rm(root, { recursive: true, force: true })
    }
  }, 15_000)
})
