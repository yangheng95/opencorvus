import { beforeEach, describe, expect, mock, test } from "bun:test"
import { DEFAULT_STT_MAX_FILE_SIZE_BYTES } from "../src/stt/limits"

let lastBot: FakeTelegramBot | undefined

class FakeTelegramBot {
  handlers = new Map<string, (ctx: any) => Promise<void> | void>()
  botInfo = { id: 99 }
  getFileCalls = 0
  api = {
    getFile: async (_fileId: string) => {
      this.getFileCalls += 1
      return { file_path: "voice.ogg" }
    },
    sendMessage: async () => undefined,
    sendPhoto: async () => undefined,
  }

  constructor() {
    lastBot = this
  }

  on(name: string, handler: (ctx: any) => Promise<void> | void) {
    this.handlers.set(name, handler)
  }

  start() {}

  stop() {}

  async emit(name: string, ctx: any) {
    await this.handlers.get(name)?.(ctx)
  }
}

class FakeInputFile {
  constructor(
    public buffer: Buffer,
    public filename: string,
  ) {}
}

mock.module("grammy", () => ({ Bot: FakeTelegramBot, InputFile: FakeInputFile }))

const { TelegramAdapter } = await import("../src/adapters/telegram")

const originalFetch = globalThis.fetch

beforeEach(() => {
  lastBot = undefined
  globalThis.fetch = originalFetch
})

describe("telegram adapter audio source", () => {
  test("emits voice metadata without getFile or file download before STT reads", async () => {
    const fetchCalls = { count: 0 }
    globalThis.fetch = mock(async () => {
      fetchCalls.count += 1
      return new Response("audio")
    }) as unknown as typeof fetch

    const adapter = new TelegramAdapter({ token: "telegram-token" })
    const seen: any[] = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })

    await adapter.start()
    await lastBot?.emit("message:voice", {
      from: { id: 1 },
      chat: { id: 2 },
      message: {
        message_id: 3,
        caption: "",
        voice: {
          file_id: "voice-file",
          duration: 4,
          file_size: DEFAULT_STT_MAX_FILE_SIZE_BYTES + 1,
        },
      },
    })

    expect(seen).toHaveLength(1)
    expect(seen[0].audio).toMatchObject({
      mime: "audio/ogg",
      size: DEFAULT_STT_MAX_FILE_SIZE_BYTES + 1,
      duration: 4,
    })
    expect(lastBot?.getFileCalls).toBe(0)
    expect(fetchCalls.count).toBe(0)
    await expect(seen[0].audio.read(DEFAULT_STT_MAX_FILE_SIZE_BYTES)).rejects.toThrow("Audio too large")
    expect(lastBot?.getFileCalls).toBe(0)
    expect(fetchCalls.count).toBe(0)
  })
})
