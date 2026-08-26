import { afterEach, describe, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { McpAuth } from "@/mcp/auth"
import { McpOAuthProvider } from "@/mcp/oauth-provider"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const SERVER = "single-use-server"
const URL = "https://single-use.example.invalid/mcp"

async function durableFlow(): Promise<{ authKey: string; revision: string }> {
  const authKey = McpAuth.scopedKey({ projectID: Instance.project.id, mcpName: SERVER })
  const identity = McpOAuthProvider.credentialIdentity(URL, {
    clientId: "single-use-client",
    clientSecret: undefined,
    scope: undefined,
  })
  const revision = await McpAuth.beginCredentialLease(authKey, URL, identity)
  await McpAuth.updateOAuthState(authKey, "single-use-state", revision, URL, identity)
  return { authKey, revision }
}

describe("an OAuth state is spendable exactly once", () => {
  test("the first spender gets the state and every later one is refused", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { authKey, revision } = await durableFlow()

        const first = await McpAuth.spendOAuthState(authKey, "single-use-state", revision)
        const second = await McpAuth.spendOAuthState(authKey, "single-use-state", revision)

        expect({ first, second, remaining: await McpAuth.getOAuthState(authKey) }).toEqual({
          first: true,
          second: false,
          remaining: undefined,
        })
      },
    })
  }, 60_000)

  test("concurrent spenders of one state admit exactly one", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { authKey, revision } = await durableFlow()

        // The shape a duplicate callback takes: several finishers racing for
        // the same state, each ready to redeem the same authorization code.
        const outcomes = await Promise.all(
          Array.from({ length: 8 }, () => McpAuth.spendOAuthState(authKey, "single-use-state", revision)),
        )

        expect(outcomes.filter(Boolean).length).toBe(1)
      },
    })
  }, 60_000)

  test("a revoked lease answers 'not current' instead of escaping as an untyped failure", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { authKey, revision } = await durableFlow()

        // Credentials revoked between authorize and callback. The question the
        // spend asks is "is this state still current?", and the answer is no —
        // which is a typed refusal, not an unknown server failure.
        await McpAuth.invalidate(authKey)

        expect(await McpAuth.spendOAuthState(authKey, "single-use-state", revision)).toBe(false)
      },
    })
  }, 60_000)

  test("a state that does not match the stored flow is refused and leaves the flow intact", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { authKey, revision } = await durableFlow()

        const spent = await McpAuth.spendOAuthState(authKey, "some-other-state", revision)

        expect({ spent, remaining: await McpAuth.getOAuthState(authKey) }).toEqual({
          spent: false,
          remaining: "single-use-state",
        })
      },
    })
  }, 60_000)
})
