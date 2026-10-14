import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { ChannelAdapter, MessageHandler } from "../src/adapter"

// Local adapter/SDK-boundary qualification, not a real external channel or model.
let globalCalls: string[] = []
let permissionReads: unknown[] = []
let runtimeDirectory: string | undefined
let permissionMode = false
let emitReady = Promise.withResolvers<void>()
let sent = Promise.withResolvers<void>()
const current = { id: "per_current", projectID: "project-public", sessionID: "session_contract", messageID: "message-public",
  toolCallID: "call-public", mode: "ask", policyRevision: "captured", providerKind: "builtin", providerID: "builtin",
  providerDigest: "fixture", toolName: "write", effectClass: "write_local", scopeVersion: "2", scope: { resource: { paths: ["public.txt"] } },
  fingerprint: "captured", projectGrantEligible: false, choices: ["allow_once", "deny"], summary: "Canonical public scope", timeCreated: 1 }
async function* eventStream() {
  yield { directory: runtimeDirectory, payload: { type: "server.connected", properties: {} } }
  if (!permissionMode) return
  await emitReady.promise
  yield { directory: runtimeDirectory, payload: { type: "permission.asked", properties: { ...current, id: "per_settled", summary: "Old scope" } } }
  yield { directory: runtimeDirectory, payload: { type: "permission.asked", properties: { ...current, summary: "Earlier display observation" } } }
}
function stubClient() {
  return {
    global: { event: async () => { globalCalls.push("global.event"); return { stream: eventStream() } } },
    permission: { list: async (input: unknown, options: unknown) => { permissionReads.push({ input, options }); return { data: [current] } } },
    session: {
      create: async () => ({ data: { id: current.sessionID } }),
      message: async () => ({ data: { parts: [] } }),
      prompt: async () => ({ data: { parts: [] } }),
    },
  }
}
mock.module("@opencorvus-ai/sdk", () => ({
  createOpenCorvus: async () => ({ client: stubClient(), server: { url: "http://127.0.0.1:0", close() {} } }),
  createOpenCorvusClient: () => stubClient(),
}))
const { ChannelRuntime } = await import("../src/core")
beforeEach(() => { globalCalls = []; permissionReads = []; permissionMode = false; emitReady = Promise.withResolvers<void>(); sent = Promise.withResolvers<void>() })
afterEach(async () => {
  if (runtimeDirectory) { await rm(runtimeDirectory, { recursive: true, force: true }); runtimeDirectory = undefined }
})

describe("Channel runtime canonical pending projection", () => {
  test("server-only embedding opens the cross-instance event stream and returns its actual channel receipt", async () => {
    runtimeDirectory = await mkdtemp(join(tmpdir(), "opencorvus-channel-global-event-"))
    const runtime = new ChannelRuntime({ directory: runtimeDirectory })
    try {
      expect(await runtime.start()).toEqual({ channels: [], failedChannels: [] })
      expect(globalCalls).toEqual(["global.event"])
    } finally { await runtime.stop() }
  })

  test("a real bound adapter receives the complete current pending notice after SDK revalidation", async () => {
    runtimeDirectory = await mkdtemp(join(tmpdir(), "opencorvus-channel-current-permission-"))
    permissionMode = true
    let receive: MessageHandler | undefined
    const messages: Array<{ channel: string; thread: string; text: string }> = []
    const adapter: ChannelAdapter = {
      platform: "slack", async start() {}, async stop() {},
      async sendMessage(channel, thread, text) { messages.push({ channel, thread, text }); sent.resolve() },
      async uploadImage() {}, onMessage(handler) { receive = handler },
    }
    const runtime = new ChannelRuntime({ directory: runtimeDirectory, channelProtocol: false, sharedMode: false })
    runtime.register(adapter)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      expect(await runtime.start()).toEqual({ channels: ["slack"], failedChannels: [] })
      await receive!({ id: "public-input", platform: "slack", channel: "public-channel", thread: "public-thread", user: "public-user", text: "Public input" })
      emitReady.resolve()
      await Promise.race([sent.promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("Current adapter notice exceeded 5000ms")), 5000) })])
      expect(messages).toEqual([{ channel: "public-channel", thread: "public-thread",
        text: "Permission requested: write — Canonical public scope. Waiting for operator reply." }])
      expect(permissionReads).toEqual([
        { input: { directory: runtimeDirectory }, options: { throwOnError: true } },
        { input: { directory: runtimeDirectory }, options: { throwOnError: true } },
      ])
    } finally { if (timer) clearTimeout(timer); emitReady.resolve(); await runtime.stop() }
  }, 10000)
})
