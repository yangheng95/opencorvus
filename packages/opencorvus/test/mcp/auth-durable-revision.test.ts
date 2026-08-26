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

describe("MCP credential lease generation", () => {
  test("one established lease stays valid across every write of its own flow", async () => {
    const held = await McpAuth.beginCredentialLease(AUTH_KEY)

    // An OAuth exchange is several store writes under one established lease:
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

  test("beginning a new lease refuses the previous holder and admits the new one, in one store write", async () => {
    const first = await McpAuth.beginCredentialLease(AUTH_KEY, "https://example.test")
    await McpAuth.updateTokens(AUTH_KEY, { accessToken: "first" }, "https://example.test", first)

    const second = await McpAuth.beginCredentialLease(AUTH_KEY)
    expect(second).not.toBe(first)

    await expect(McpAuth.updateCodeVerifier(AUTH_KEY, "stale-flow", first)).rejects.toThrow(
      `MCP auth lease was revoked: ${AUTH_KEY}`,
    )

    await McpAuth.updateCodeVerifier(AUTH_KEY, "current-flow", second)
    expect((await McpAuth.get(AUTH_KEY))?.codeVerifier).toBe("current-flow")
    // The holder's own write did not consume its lease.
    expect(await McpAuth.revision(AUTH_KEY)).toBe(second)
  })

  test("a peer's revoke through the shared store is visible to a later reader", async () => {
    const held = await McpAuth.beginCredentialLease(AUTH_KEY, "https://example.test")
    await McpAuth.updateTokens(AUTH_KEY, { accessToken: "first" }, "https://example.test", held)

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

  test("a lease held before removal never matches anything after recreation", async () => {
    const preRemoval = await McpAuth.beginCredentialLease(AUTH_KEY, "https://example.test")
    await McpAuth.updateTokens(AUTH_KEY, { accessToken: "first" }, "https://example.test", preRemoval)

    await McpAuth.remove(AUTH_KEY)
    await McpAuth.stageStaticCredential(AUTH_KEY, "brand-new-secret", "https://example.test", "identity-2")
        await McpAuth.promoteStagedStaticCredential(AUTH_KEY, { serverUrl: "https://example.test", credentialIdentity: "identity-2" })

    await expect(McpAuth.updateTokens(AUTH_KEY, { accessToken: "stale" }, "https://example.test", preRemoval)).rejects.toThrow(
      `MCP auth lease was revoked: ${AUTH_KEY}`,
    )
    expect((await McpAuth.get(AUTH_KEY))?.staticCredential?.secret).toBe("brand-new-secret")
  })

  test("the empty generation is never a lease: a write presenting it is refused outright", async () => {
    // A recreated entry that no flow has leased reads as the initial
    // generation. A holder presenting that value skipped establishing a lease,
    // and admitting it is what let a value captured before a removal write
    // into a recreated credential.
    await McpAuth.stageStaticCredential(AUTH_KEY, "configured-secret", "https://example.test", "identity-1")
        await McpAuth.promoteStagedStaticCredential(AUTH_KEY, { serverUrl: "https://example.test", credentialIdentity: "identity-1" })
    expect(await McpAuth.revision(AUTH_KEY)).toBe("")

    await expect(McpAuth.updateTokens(AUTH_KEY, { accessToken: "stale" }, "https://example.test", "")).rejects.toThrow(
      `MCP auth write presented an unestablished lease: ${AUTH_KEY}`,
    )
    expect((await McpAuth.get(AUTH_KEY))?.staticCredential?.secret).toBe("configured-secret")
  })
})
