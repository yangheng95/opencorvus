import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "../../src/global"
import { McpAuth } from "../../src/mcp/auth"

const AUTH_KEY = "project-durable:remote-server"

async function storePath(): Promise<string> {
  return path.join(Global.Path.data, "mcp-auth.json")
}

afterEach(async () => {
  await fs.rm(await storePath(), { force: true })
})

describe("MCP credential revocation generation", () => {
  test("one captured generation stays valid across every write of its own flow", async () => {
    const held = await McpAuth.revision(AUTH_KEY)

    // An OAuth exchange is several store writes under one captured revision:
    // client registration, the state, the verifier, then the tokens. Every one
    // of them must pass with the generation the flow captured at its start.
    await McpAuth.updateClientInfo(AUTH_KEY, { clientId: "client-1" }, "https://example.test", held)
    await McpAuth.updateOAuthState(AUTH_KEY, "state-1", held)
    await McpAuth.updateCodeVerifier(AUTH_KEY, "verifier-1", held)
    await McpAuth.updateTokens(AUTH_KEY, { accessToken: "token-1" }, "https://example.test", held)
    await McpAuth.clearCodeVerifier(AUTH_KEY, held)

    const entry = await McpAuth.get(AUTH_KEY)
    expect(entry?.tokens?.accessToken).toBe("token-1")
    expect(await McpAuth.revision(AUTH_KEY)).toBe(held)
  })

  test("a revoke mints a durable generation that refuses the old holder and admits the new one", async () => {
    await McpAuth.set(AUTH_KEY, { tokens: { accessToken: "first" } }, "https://example.test")
    const held = await McpAuth.revision(AUTH_KEY)

    await McpAuth.invalidate(AUTH_KEY)
    const current = await McpAuth.revision(AUTH_KEY)
    expect(current).not.toBe(held)

    await expect(McpAuth.updateCodeVerifier(AUTH_KEY, "stale-flow", held)).rejects.toThrow(
      `MCP auth lease was revoked: ${AUTH_KEY}`,
    )

    await McpAuth.updateCodeVerifier(AUTH_KEY, "current-flow", current)
    expect((await McpAuth.get(AUTH_KEY))?.codeVerifier).toBe("current-flow")
    // The holder's own write did not consume its generation.
    expect(await McpAuth.revision(AUTH_KEY)).toBe(current)
  })

  test("a peer's revoke through the shared store is visible to a later reader", async () => {
    await McpAuth.set(AUTH_KEY, { tokens: { accessToken: "first" } }, "https://example.test")
    const held = await McpAuth.revision(AUTH_KEY)

    // A different backend on the same data root revokes by writing the store
    // directly. Nothing in this process was told; the generation has to come
    // from the file.
    const target = await storePath()
    const peer = JSON.parse(await fs.readFile(target, "utf8")) as Record<string, Record<string, unknown>>
    peer[AUTH_KEY] = { ...peer[AUTH_KEY], revision: "peer-generation" }
    await fs.writeFile(target, JSON.stringify(peer, null, 2))

    expect(await McpAuth.revision(AUTH_KEY)).toBe("peer-generation")
    await expect(McpAuth.updateCodeVerifier(AUTH_KEY, "stale", held)).rejects.toThrow(
      `MCP auth lease was revoked: ${AUTH_KEY}`,
    )
  })

  test("a generation minted before removal never matches one minted after recreation", async () => {
    await McpAuth.set(AUTH_KEY, { tokens: { accessToken: "first" } }, "https://example.test")
    await McpAuth.invalidate(AUTH_KEY)
    const preRemoval = await McpAuth.revision(AUTH_KEY)

    await McpAuth.remove(AUTH_KEY)
    await McpAuth.set(AUTH_KEY, { tokens: { accessToken: "recreated" } }, "https://example.test")
    await McpAuth.invalidate(AUTH_KEY)

    const recreated = await McpAuth.revision(AUTH_KEY)
    expect(recreated).not.toBe(preRemoval)
    await expect(McpAuth.updateCodeVerifier(AUTH_KEY, "stale", preRemoval)).rejects.toThrow(
      `MCP auth lease was revoked: ${AUTH_KEY}`,
    )
  })
})
