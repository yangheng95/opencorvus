import { describe, expect, test } from "bun:test"
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

function audio(reads: { count: number }): AudioSource {
  return {
    mime: "audio/ogg",
    size: 12,
    async read() {
      reads.count += 1
      return Buffer.alloc(12)
    },
  }
}

describe("channel runtime STT handling", () => {
  test("does not read audio when STT is disabled", async () => {
    const adapter = new FakeAdapter()
    const runtime = new ChannelRuntime()
    const reads = { count: 0 }
    runtime.register(adapter)

    await runtime.handleMessage({
      platform: "fake",
      channel: "C1",
      thread: "T1",
      user: "U1",
      text: "",
      audio: audio(reads),
    })

    expect(reads.count).toBe(0)
    expect(adapter.sent).toHaveLength(1)
    expect(adapter.sent[0].text).toContain("no STT provider configured")
  })

  test("does not submit text-only fallback after STT failure", async () => {
    const adapter = new FakeAdapter()
    const runtime = new ChannelRuntime()
    runtime.register(adapter)
    runtime.setSTT({
      isAvailable: true,
      transcribe: async (): Promise<STTResult> => {
        throw new Error("audio too large")
      },
    } as any)

    await runtime.handleMessage({
      platform: "fake",
      channel: "C1",
      thread: "T1",
      user: "U1",
      text: "typed fallback",
      audio: audio({ count: 0 }),
    })

    expect(adapter.sent).toHaveLength(1)
    expect(adapter.sent[0].text).toContain("Failed to transcribe voice message")
  })
})
