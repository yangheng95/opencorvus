import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { fileURLToPath } from "node:url"
import { Process } from "../src/util/process"

const backend = createRequire(new URL("../package.json", import.meta.url))

test("the SDK's actual compressed HTTP parser returns its body and typed malformed-body response then serves health", async () => {
  const result = await Process.runHost(
    [
      "node",
      fileURLToPath(new URL("./fixture/ci-compressed-request.mjs", import.meta.url)),
      backend.resolve("@modelcontextprotocol/sdk/server/streamableHttp.js"),
    ],
    { inactivityTimeoutMs: 10_000 },
  )
  const data = JSON.parse(result.stdout.toString())
  expect(data).toEqual({
    valid: { status: 200, body: "local-compressed-body" },
    trailing: { status: 400, body: "Z_DATA_ERROR" },
    health: { status: 200, body: "healthy" },
  })
})

test("the Azure SQL identity parent constructs the current MSAL client through its installed dependency", () => {
  const orm = createRequire(backend.resolve("drizzle-orm"))
  const sql = createRequire(orm.resolve("mssql"))
  const driver = createRequire(sql.resolve("tedious"))
  const identity = createRequire(driver.resolve("@azure/identity"))
  const msal = identity("@azure/msal-node")
  const clientID = "00000000-0000-4000-8000-000000000001"
  const client = new msal.PublicClientApplication({ auth: { clientId: clientID } })
  expect(client.constructor.name).toBe("PublicClientApplication")
  const { ClientSecretCredential } = driver("@azure/identity")
  const credential = new ClientSecretCredential("00000000-0000-4000-8000-000000000002", clientID, "local-fixture-value")
  expect(credential.constructor.name).toBe("ClientSecretCredential")
})

test("the original BiDi parser returns command data and its typed invalid-argument error with current Zod", async () => {
  const cjs = pathToFileURL(backend.resolve("chromium-bidi/lib/cjs/protocol-parser/protocol-parser.js"))
  const paths = [cjs, new URL("../../esm/protocol-parser/protocol-parser.js", cjs)]
  for (const location of paths) {
    const parser = await import(location.href)
    expect(parser.Browser.parseRemoveUserContextParameters({ userContext: "owned-context" })).toEqual({
      userContext: "owned-context",
    })
    let error: any
    try {
      parser.Browser.parseRemoveUserContextParameters({})
    } catch (cause) {
      error = cause
    }
    expect(error.constructor.name).toBe("InvalidArgumentException")
    expect(error.message).toContain("userContext")
  }
})

test("GitLab direct access validates and returns actual local HTTP token headers with current Zod", async () => {
  const { GitLabDirectAccessClient } = backend("gitlab-ai-provider")
  const requests: Array<{ method: string; path: string }> = []
  const receipt = { token: "local-fixture-token", headers: { "x-local-contract": "owned" } }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      requests.push({ method: request.method, path: new URL(request.url).pathname })
      return Response.json(receipt)
    },
  })
  try {
    const client = new GitLabDirectAccessClient({ instanceUrl: server.url.origin, getHeaders: () => ({}), fetch })
    expect(await client.getDirectAccessToken()).toEqual(receipt)
    expect(requests).toEqual([{ method: "POST", path: "/api/v4/ai/third_party_agents/direct_access" }])
  } finally {
    await server.stop(true)
  }
})
