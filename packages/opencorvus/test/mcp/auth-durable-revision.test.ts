import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
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

describe("MCP credential revision durability", () => {
  test("the mutation counter lives in the store, so a peer's write is visible to a later reader", async () => {
    expect(await McpAuth.revision(AUTH_KEY)).toBe(0)

    await McpAuth.set(AUTH_KEY, { tokens: { accessToken: "first" } }, "https://example.test")
    const afterFirst = await McpAuth.revision(AUTH_KEY)
    expect(afterFirst).toBe(1)

    // A different backend on the same data root writes the store directly.
    // Nothing in this process was told; the counter has to come from the file.
    const target = await storePath()
    const peer = JSON.parse(await fs.readFile(target, "utf8")) as Record<string, Record<string, unknown>>
    peer[AUTH_KEY] = { ...peer[AUTH_KEY], revision: 7 }
    await fs.writeFile(target, JSON.stringify(peer, null, 2))

    expect(await McpAuth.revision(AUTH_KEY)).toBe(7)
  })

  test("a holder that presents a superseded revision is refused, and the current one is accepted", async () => {
    await McpAuth.set(AUTH_KEY, { tokens: { accessToken: "first" } }, "https://example.test")
    const held = await McpAuth.revision(AUTH_KEY)

    await McpAuth.invalidate(AUTH_KEY)
    const current = await McpAuth.revision(AUTH_KEY)
    expect(current).toBe(held + 1)

    await expect(
      McpAuth.updateCodeVerifier(AUTH_KEY, "verifier-from-stale-flow", held),
    ).rejects.toThrow(`MCP auth lease was revoked: ${AUTH_KEY}`)

    await McpAuth.updateCodeVerifier(AUTH_KEY, "verifier-from-current-flow", current)
    expect((await McpAuth.get(AUTH_KEY))?.codeVerifier).toBe("verifier-from-current-flow")
    expect(await McpAuth.revision(AUTH_KEY)).toBe(current + 1)
  })

  test("a removed credential reads as revision zero, so every outstanding lease is refused", async () => {
    await McpAuth.set(AUTH_KEY, { tokens: { accessToken: "first" } }, "https://example.test")
    const held = await McpAuth.revision(AUTH_KEY)
    expect(held).toBe(1)

    await McpAuth.remove(AUTH_KEY)

    expect(await McpAuth.revision(AUTH_KEY)).toBe(0)
    await expect(McpAuth.updateCodeVerifier(AUTH_KEY, "verifier", held)).rejects.toThrow(
      `MCP auth lease was revoked: ${AUTH_KEY}`,
    )
  })
})
