import { describe, expect, test } from "bun:test"
import { createConfiguredSTT } from "../src/stt/setup"
import { STTPipeline } from "../src/stt/pipeline"
import type { AudioBuffer, AudioSource, STTProvider, STTResult } from "../src/stt/types"

function audio(): AudioSource {
  return {
    mime: "audio/ogg",
    size: 5,
    async read() {
      return Buffer.from("audio")
    },
  }
}

function source(opts?: { size?: number; read?: () => Promise<Buffer> }): AudioSource {
  return {
    mime: "audio/ogg",
    size: opts?.size ?? 5,
    read: opts?.read ?? (async () => Buffer.from("audio")),
  }
}

function provider(
  name: string,
  opts: { available?: boolean; fail?: boolean; calls: { transcribe: number } },
): STTProvider {
  return {
    name,
    async isAvailable() {
      return opts.available ?? true
    },
    async transcribe(_audio: AudioBuffer): Promise<STTResult> {
      opts.calls.transcribe += 1
      if (opts.fail) throw new Error(`${name} failed`)
      return {
        text: `${name} transcript`,
        provider: name,
        durationMs: 1,
      }
    },
  }
}

describe("STT pipeline", () => {
  test("rejects retired provider-order env", async () => {
    await expect(createConfiguredSTT({ STT_PROVIDERS: "groq,openai-whisper" })).rejects.toThrow("retired")
  })

  test("is disabled when no single provider is configured", async () => {
    expect(await createConfiguredSTT({})).toBeUndefined()
  })

  test("uses only the configured provider and does not try another provider after failure", async () => {
    const first = { transcribe: 0 }
    const second = { transcribe: 0 }
    const pipeline = new STTPipeline({ provider: "first" })
      .register(provider("first", { fail: true, calls: first }))
      .register(provider("second", { calls: second }))

    await pipeline.init()
    await expect(pipeline.transcribe(audio())).rejects.toThrow("first failed")

    expect(first.transcribe).toBe(1)
    expect(second.transcribe).toBe(0)
  })

  test("rejects unavailable configured providers instead of selecting another registered provider", async () => {
    const first = { transcribe: 0 }
    const second = { transcribe: 0 }
    const pipeline = new STTPipeline({ provider: "first" })
      .register(provider("first", { available: false, calls: first }))
      .register(provider("second", { calls: second }))

    await expect(pipeline.init()).rejects.toThrow('Provider "first" is not available')

    expect(first.transcribe).toBe(0)
    expect(second.transcribe).toBe(0)
  })

  test("rejects oversized source metadata before opening the source or calling the provider", async () => {
    const calls = { transcribe: 0 }
    const reads = { count: 0 }
    const pipeline = new STTPipeline({ provider: "first", maxFileSizeBytes: 4 }).register(provider("first", { calls }))

    await pipeline.init()
    await expect(
      pipeline.transcribe(
        source({
          size: 5,
          read: async () => {
            reads.count += 1
            return Buffer.from("audio")
          },
        }),
      ),
    ).rejects.toThrow("Audio too large")

    expect(reads.count).toBe(0)
    expect(calls.transcribe).toBe(0)
  })
})
