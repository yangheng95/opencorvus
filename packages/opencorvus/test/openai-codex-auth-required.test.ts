import { describe, expect, test } from "bun:test"
import { resolveOpenAICodexOAuthCredential } from "@/plugin/openai/codex"
import { ProviderAuthRequiredError } from "@/provider/auth-required-error"
import { Message } from "@/session/message"

describe("OpenAI Codex credential authority", () => {
  test("maps a missing OAuth credential to the typed Provider auth contract", async () => {
    let error: unknown
    try {
      await resolveOpenAICodexOAuthCredential({
        getAuth: async () => undefined,
        setAuth: async () => undefined,
      })
    } catch (cause) {
      error = cause
    }
    expect(error).toBeInstanceOf(ProviderAuthRequiredError)
    expect(Message.fromError(error, { providerID: "openai" })).toMatchObject({
      name: "ProviderAuthError",
      data: {
        providerID: "openai",
        message: "OpenAI Codex OAuth credential is required",
      },
    })
  })
})
