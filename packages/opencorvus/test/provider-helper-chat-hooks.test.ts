import { expect, test } from "bun:test"
import { CodexAuthPlugin } from "../src/plugin/openai/codex"
import { LLM } from "../src/session/llm"
import { Plugin } from "../src/plugin"

test("OpenAI Codex OAuth owns the physical output-token request rule", async () => {
  const hooks = await CodexAuthPlugin({} as never)
  const output = {
    temperature: undefined,
    topP: undefined,
    topK: undefined,
    maxOutputTokens: 128_000,
    options: {},
  }
  await hooks["provider.chat.params"]!(
    {
      sessionID: "helper-session",
      requestID: "memory-run-1",
      agent: "memory",
      model: { providerID: "openai" } as never,
      provider: { id: "openai" } as never,
    },
    output,
  )
  expect(output).toEqual({
    temperature: undefined,
    topP: undefined,
    topK: undefined,
    maxOutputTokens: undefined,
    options: {},
  })
})

test("a helper occurrence applies physical Provider hooks through the production request assembly", async () => {
  const calls: Array<{ name: string; requestID: string; agent: string }> = []
  const physical = (async (name: string, input: Record<string, any>, output: Record<string, any>) => {
    calls.push({ name, requestID: input.requestID, agent: input.agent })
    if (name === "provider.chat.params") output.maxOutputTokens = undefined
    if (name === "provider.chat.headers") output.headers.originator = "opencorvus"
    return output
  }) as typeof Plugin.triggerPhysicalProvider

  const result = await LLM.applyRequestHooks(
    {
      sessionID: "helper-session",
      requestID: "memory-run-1",
      agentID: "memory",
      model: { providerID: "openai" } as never,
      provider: { id: "openai" } as never,
    },
    {
      temperature: undefined,
      topP: undefined,
      topK: undefined,
      maxOutputTokens: 128_000,
      options: {},
    },
    { message: Plugin.trigger, physical },
  )

  expect(result).toEqual({
    params: {
      temperature: undefined,
      topP: undefined,
      topK: undefined,
      maxOutputTokens: undefined,
      options: {},
    },
    headers: { originator: "opencorvus" },
  })
  expect(calls).toEqual([
    { name: "provider.chat.params", requestID: "memory-run-1", agent: "memory" },
    { name: "provider.chat.headers", requestID: "memory-run-1", agent: "memory" },
  ])
})

test("a user occurrence preserves message hooks before physical Provider rules converge the request", async () => {
  const calls: Array<{ name: string; requestID?: string; agent: string; messageID?: string }> = []
  const record = async (name: string, input: Record<string, any>, output: Record<string, any>) => {
    calls.push({ name, requestID: input.requestID, agent: input.agent, messageID: input.message?.id })
    if (name === "chat.params") output.maxOutputTokens = 4096
    if (name === "chat.headers") output.headers.originator = "project-plugin"
    if (name === "provider.chat.params") output.maxOutputTokens = undefined
    if (name === "provider.chat.headers") output.headers.originator = "opencorvus"
    return output
  }
  const message = record as typeof Plugin.trigger
  const physical = record as typeof Plugin.triggerPhysicalProvider

  const result = await LLM.applyRequestHooks(
    {
      sessionID: "conversation-session",
      requestID: "message-1",
      agentID: "title",
      model: { providerID: "openai" } as never,
      provider: { id: "openai" } as never,
      message: { id: "message-1", sessionID: "conversation-session" } as never,
    },
    {
      temperature: undefined,
      topP: undefined,
      topK: undefined,
      maxOutputTokens: 128_000,
      options: {},
    },
    { message, physical },
  )

  expect(result.params.maxOutputTokens).toBeUndefined()
  expect(result.headers).toEqual({ originator: "opencorvus" })
  expect(calls).toEqual([
    { name: "chat.params", requestID: undefined, agent: "title", messageID: "message-1" },
    { name: "chat.headers", requestID: undefined, agent: "title", messageID: "message-1" },
    { name: "provider.chat.params", requestID: "message-1", agent: "title", messageID: "message-1" },
    { name: "provider.chat.headers", requestID: "message-1", agent: "title", messageID: "message-1" },
  ])
})

test("physical Provider execution accepts only internal Provider owners", async () => {
  const output = await Plugin.applyPhysicalProviderHooks(
    "provider.chat.params",
    {
      sessionID: "conversation-session",
      requestID: "message-1",
      agent: "title",
      model: { providerID: "openai" } as never,
      provider: { id: "openai" } as never,
    },
    {
      temperature: undefined,
      topP: undefined,
      topK: undefined,
      maxOutputTokens: 128_000,
      options: {},
    },
    [
      {
        owner: "internal",
        specifier: "internal:codex",
        hook: {
          "provider.chat.params": async (_input, params) => {
            params.maxOutputTokens = undefined
          },
        },
      },
      {
        owner: "project",
        specifier: "file:///project/plugin.ts",
        hook: {
          "provider.chat.params": async (_input, params) => {
            params.maxOutputTokens = 4096
          },
        },
      },
    ] as never,
  )
  expect(output.maxOutputTokens).toBeUndefined()
})
