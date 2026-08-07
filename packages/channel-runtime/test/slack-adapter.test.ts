import { beforeEach, describe, expect, mock, test } from "bun:test"
import { DEFAULT_STT_MAX_FILE_SIZE_BYTES } from "../src/stt/limits"

let lastApp: FakeSlackApp | undefined

class FakeSlackApp {
  messageHandler?: (input: { message: any }) => Promise<void> | void
  eventHandler?: (input: { event: any }) => Promise<void> | void
  client = {
    auth: {
      test: async () => ({ user_id: "bot-user" }),
    },
    chat: {
      postMessage: async () => ({ ts: "thread-1" }),
    },
    filesUploadV2: async () => undefined,
  }

  constructor() {
    lastApp = this
  }

  event(_name: string, handler: (input: { event: any }) => Promise<void> | void) {
    this.eventHandler = handler
  }

  message(handler: (input: { message: any }) => Promise<void> | void) {
    this.messageHandler = handler
  }

  async start() {}

  async stop() {}

  async emitMessage(message: any) {
    await this.messageHandler?.({ message })
  }
}

mock.module("@slack/bolt", () => ({ App: FakeSlackApp }))

const { SlackAdapter } = await import("../src/adapters/slack")

const originalFetch = globalThis.fetch

beforeEach(() => {
  lastApp = undefined
  globalThis.fetch = originalFetch
})

describe("slack adapter audio source", () => {
  test("retries the same provider message after a transient handler failure", async () => {
    const adapter = new SlackAdapter({ token: "xoxb-token", appToken: "xapp-token" })
    const ids: Array<string | undefined> = []
    let attempts = 0
    adapter.onMessage(async (msg) => {
      attempts += 1
      ids.push(msg.id)
      if (attempts === 1) throw new Error("transient ingress failure")
    })

    await adapter.start()
    const message = {
      user: "user-1",
      channel: "C1",
      ts: String(Math.floor(Date.now() / 1000) + 10),
      text: "retry me",
    }

    await expect(lastApp?.emitMessage(message)).rejects.toThrow("transient ingress failure")
    await expect(lastApp?.emitMessage(message)).resolves.toBeUndefined()

    expect(attempts).toBe(2)
    expect(ids).toEqual([message.ts, message.ts])
  })

  test("emits audio metadata without downloading Slack file content", async () => {
    const fetchCalls = { count: 0 }
    globalThis.fetch = mock(async () => {
      fetchCalls.count += 1
      return new Response("audio")
    }) as unknown as typeof fetch

    const adapter = new SlackAdapter({ token: "xoxb-token", appToken: "xapp-token" })
    const seen: any[] = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })

    await adapter.start()
    await lastApp?.emitMessage({
      subtype: "file_share",
      user: "user-1",
      channel: "C1",
      ts: String(Math.floor(Date.now() / 1000) + 10),
      text: "",
      files: [
        {
          mimetype: "audio/ogg",
          url_private: "https://slack.example/audio.ogg",
          name: "voice.ogg",
          size: DEFAULT_STT_MAX_FILE_SIZE_BYTES + 1,
          duration_ms: 2000,
        },
      ],
    })

    expect(seen).toHaveLength(1)
    expect(seen[0].audio).toMatchObject({
      mime: "audio/ogg",
      filename: "voice.ogg",
      size: DEFAULT_STT_MAX_FILE_SIZE_BYTES + 1,
      duration: 2,
    })
    expect(fetchCalls.count).toBe(0)
    await expect(seen[0].audio.read(DEFAULT_STT_MAX_FILE_SIZE_BYTES)).rejects.toThrow("Audio too large")
    expect(fetchCalls.count).toBe(0)
  })
})
