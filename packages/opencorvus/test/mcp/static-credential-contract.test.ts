import { describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { McpAuth } from "../../src/mcp/auth"
import { MCP } from "../../src/mcp"

describe("remote MCP static credential contract", () => {
  test("accepts query, bearer, and custom-header descriptors with OAuth disabled", () => {
    expect(
      Config.Mcp.parse({
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.example.com/connect",
        oauth: false,
        credential: { type: "query", name: "token" },
      }),
    ).toEqual({
      type: "remote",
      transport: "streamable-http",
      url: "https://mcp.example.com/connect",
      oauth: false,
      credential: { type: "query", name: "token" },
    })
    expect(
      Config.Mcp.parse({
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.example.com/connect",
        oauth: false,
        credential: { type: "bearer" },
      }),
    ).toMatchObject({ credential: { type: "bearer" }, oauth: false })
    expect(
      Config.Mcp.parse({
        type: "remote",
        transport: "sse",
        url: "https://mcp.example.com/events",
        oauth: false,
        credential: { type: "header", name: "X-API-Key" },
      }),
    ).toMatchObject({ credential: { type: "header", name: "X-API-Key" }, oauth: false })
  })

  test("materializes query, bearer, and custom-header runtime requests", () => {
    const projectConfig = {
      type: "remote" as const,
      transport: "streamable-http" as const,
      url: "https://mcp.zapier.com/api/v1/connect",
      oauth: false as const,
      credential: { type: "query" as const, name: "token" },
    }
    const materialized = MCP.materializeRemoteRequest(projectConfig, { signal: AbortSignal.timeout(1_000) }, "secret")

    expect(projectConfig).toEqual({
      type: "remote",
      transport: "streamable-http",
      url: "https://mcp.zapier.com/api/v1/connect",
      oauth: false,
      credential: { type: "query", name: "token" },
    })
    expect(materialized.url.toString()).toBe("https://mcp.zapier.com/api/v1/connect?token=secret")

    const bearer = MCP.materializeRemoteRequest(
      {
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.example.com/connect",
        oauth: false,
        credential: { type: "bearer" },
      },
      undefined,
      "bearer-secret",
    )
    expect(new Headers(bearer.requestInit?.headers).get("Authorization")).toBe("Bearer bearer-secret")

    const header = MCP.materializeRemoteRequest(
      {
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.example.com/connect",
        oauth: false,
        credential: { type: "header", name: "X-API-Key" },
      },
      undefined,
      "header-secret",
    )
    expect(new Headers(header.requestInit?.headers).get("X-API-Key")).toBe("header-secret")
  })

  test("persists rotation in the user-owned auth entry", async () => {
    const authKey = `static-credential-contract:${crypto.randomUUID()}`
    const serverUrl = "https://mcp.zapier.com/api/v1/connect"
    const credentialIdentity = "query-token-identity"
    try {
      await McpAuth.setStaticCredential(authKey, "initial-secret", serverUrl, credentialIdentity)
      expect(await McpAuth.getForUrl(authKey, serverUrl, credentialIdentity)).toEqual({
        staticCredential: { secret: "initial-secret" },
        serverUrl,
        credentialIdentity,
        // The durable mutation counter is part of the stored entry: it is what
        // makes a revoke performed by another backend visible here.
        revision: 1,
      })

      await McpAuth.setStaticCredential(authKey, "rotated-secret", serverUrl, credentialIdentity)
      expect(await McpAuth.getForUrl(authKey, serverUrl, credentialIdentity)).toEqual({
        staticCredential: { secret: "rotated-secret" },
        serverUrl,
        credentialIdentity,
        revision: 2,
      })
    } finally {
      await McpAuth.remove(authKey)
    }
  })

  test("parses the complete configure route contract", () => {
    expect(
      MCP.ConfigureInput.parse({
        name: "zapier",
        config: {
          type: "remote",
          transport: "streamable-http",
          url: "https://mcp.zapier.com/api/v1/connect",
          oauth: false,
          credential: { type: "query", name: "token" },
        },
        credentialSecret: "software-secret",
      }),
    ).toEqual({
      name: "zapier",
      config: {
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.zapier.com/api/v1/connect",
        oauth: false,
        credential: { type: "query", name: "token" },
      },
      credentialSecret: "software-secret",
    })

    const missingSecret = MCP.ConfigureInput.safeParse({
      name: "zapier",
      config: {
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.zapier.com/api/v1/connect",
        oauth: false,
        credential: { type: "query", name: "token" },
      },
    })
    expect(missingSecret.error?.issues.map((issue) => issue.message)).toEqual([
      "Static MCP credential secret is required",
    ])
  })
})
