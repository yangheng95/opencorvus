import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { expect, test } from "bun:test"
import { BrowserRuntime } from "../src/browser/runtime"
import { Config } from "../src/config/config"
import { authenticatedProxyUrl, proxiedFetchInit, resolveNetworkProxy } from "../src/util/network-proxy"

// Public, invented test identities only. No operator credentials are read.
const identities = [
  { name: "outer spaces", username: " sample-user ", password: " sample-password " },
  { name: "nonempty spaces", username: "  ", password: "   " },
  { name: "literal percent", username: "sample%user", password: "sample%password" },
  { name: "escape-looking text", username: "sample%20user", password: "sample%2Fpassword" },
  { name: "reserved characters", username: "sample/@?#[]!$&'()*+,;=", password: "sample:/@?#[]!$&'()*+,;=" },
]

test.each(identities)("proxy schema preserves $name in both identity fields", (identity) => {
  const result = Config.NetworkProxy.safeParse({
    url: "http://127.0.0.1:23456",
    username: identity.username,
    password: identity.password,
  })
  expect({
    accepted: result.success,
    usernameMatches: result.success && result.data.username === identity.username,
    passwordMatches: result.success && result.data.password === identity.password,
  }).toEqual({ accepted: true, usernameMatches: true, passwordMatches: true })
})

test.each(identities)("the browser proxy parser restores $name from the canonical URL", (identity) => {
  const proxy = BrowserRuntime.resolveBrowserProxyConfig({
    env: {},
    proxyServer: authenticatedProxyUrl("http://127.0.0.1:23456", identity.username, identity.password),
  })
  expect({
    serverMatches: proxy?.server === "http://127.0.0.1:23456",
    usernameMatches: proxy?.username === identity.username,
    passwordMatches: proxy?.password === identity.password,
  }).toEqual({ serverMatches: true, usernameMatches: true, passwordMatches: true })
})

test.each(identities)("Bun transmits $name through the configured authenticated proxy", async (identity) => {
  const expectedAuthentication = `Basic ${Buffer.from(`${identity.username}:${identity.password}`).toString("base64")}`
  const body = "proxy credential contract: first:second"
  let authenticationMatches = false
  let targetMatches = false
  const origin = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response(body, { status: 201 }),
  })
  const target = new URL("/credential-contract", origin.url).href
  const proxy = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      authenticationMatches = request.headers.get("proxy-authorization") === expectedAuthentication
      targetMatches = request.url === target
      if (!authenticationMatches) return new Response("Proxy authentication required", { status: 407 })
      return fetch(target, { signal: AbortSignal.timeout(5_000) })
    },
  })
  try {
    const config = Config.Info.parse({
      network: {
        proxy: { llmProvider: true, url: proxy.url.href, username: identity.username, password: identity.password },
      },
    })
    const response = await fetch(
      target,
      proxiedFetchInit(
        { signal: AbortSignal.timeout(5_000) },
        resolveNetworkProxy(config, "llmProvider"),
        "llmProvider",
      ),
    )
    expect({
      status: response.status,
      bodyMatches: (await response.text()) === body,
      authenticationMatches,
      targetMatches,
    }).toEqual({ status: 201, bodyMatches: true, authenticationMatches: true, targetMatches: true })
  } finally {
    await proxy.stop(true)
    await origin.stop(true)
  }
})

test.each(identities)(
  "Node transmits $name through the configured authenticated CONNECT proxy",
  async (identity) => {
    const config = Config.Info.parse({
      network: {
        proxy: {
          webResearch: true,
          url: "http://127.0.0.1:23456",
          username: identity.username,
          password: identity.password,
        },
      },
    })
    const result = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        "node",
        [
          "--experimental-transform-types",
          fileURLToPath(new URL("./fixture/network-proxy-credentials.mjs", import.meta.url)),
        ],
        { timeout: 15_000 },
        (error, stdout) => {
          if (error) reject(new Error(`Node proxy contract process failed with code ${error.code ?? "unknown"}`))
          else resolve(stdout)
        },
      )
      child.stdin!.end(
        JSON.stringify({
          proxyUrl: resolveNetworkProxy(config, "webResearch"),
          username: identity.username,
          password: identity.password,
        }),
      )
    })
    expect(JSON.parse(result)).toEqual({
      status: 201,
      bodyMatches: true,
      authenticationMatches: true,
      targetMatches: true,
      disposed: true,
    })
  },
  20_000,
)
