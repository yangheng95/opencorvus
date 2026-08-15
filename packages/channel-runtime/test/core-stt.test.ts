import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ChannelRuntime } from "../src/core"
import type { ChannelAdapter, MessageHandler } from "../src/adapter"
import type { AudioSource, STTResult } from "../src/stt/types"

class FakeAdapter implements ChannelAdapter {
  readonly platform = "fake"
  sent: Array<{ channel: string; thread: string; text: string }> = []
  handler?: MessageHandler

  async start() {}

  async stop() {}

  async sendMessage(channel: string, thread: string, text: string): Promise<void> {
    this.sent.push({ channel, thread, text })
  }

  async uploadImage(): Promise<void> {}

  onMessage(handler: MessageHandler): void {
    this.handler = handler
  }
}

function audio(): AudioSource {
  return {
    mime: "audio/ogg",
    size: 12,
    async read() {
      return Buffer.alloc(12)
    },
  }
}

async function startedRuntime(adapter: FakeAdapter): Promise<{ runtime: ChannelRuntime; directory: string }> {
  const directory = await mkdtemp(join(tmpdir(), "opencorvus-channel-stt-"))
  const runtime = new ChannelRuntime({ baseUrl: "http://127.0.0.1:1", directory })
  runtime.register(adapter)
  await runtime.start()
  return { runtime, directory }
}

describe("channel runtime STT handling", () => {
  test("returns the configured-provider notice for an unsupported voice message", async () => {
    const adapter = new FakeAdapter()
    const { runtime, directory } = await startedRuntime(adapter)
    try {
      await adapter.handler!({
        id: "fake-voice-event-1",
        platform: "fake",
        channel: "C1",
        thread: "T1",
        user: "U1",
        text: "",
        audio: audio(),
      })

      expect(adapter.sent).toEqual([
        {
          channel: "C1",
          thread: "T1",
          text: "Voice messages are not supported (no STT provider configured).",
        },
      ])
    } finally {
      await runtime.stop()
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("returns the transcription error notice when voice decoding fails", async () => {
    const adapter = new FakeAdapter()
    const { runtime, directory } = await startedRuntime(adapter)
    runtime.setSTT({
      isAvailable: true,
      transcribe: async (): Promise<STTResult> => {
        throw new Error("audio too large")
      },
    } as any)

    try {
      await adapter.handler!({
        id: "fake-voice-event-2",
        platform: "fake",
        channel: "C1",
        thread: "T1",
        user: "U1",
        text: "typed fallback",
        audio: audio(),
      })

      expect(adapter.sent).toEqual([
        {
          channel: "C1",
          thread: "T1",
          text: "Failed to transcribe voice message: Error: audio too large",
        },
      ])
    } finally {
      await runtime.stop()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
