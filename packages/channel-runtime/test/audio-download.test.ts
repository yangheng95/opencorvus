import { afterEach, describe, expect, mock, test } from "bun:test"
import { downloadAudioBuffer } from "../src/adapters/audio-download"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("audio download", () => {
  test("rejects oversized metadata before fetch", async () => {
    const fetchCalls = { count: 0 }
    globalThis.fetch = mock(async () => {
      fetchCalls.count += 1
      return new Response("audio")
    }) as unknown as typeof fetch

    await expect(
      downloadAudioBuffer({
        url: "https://audio.example/voice.ogg",
        metadataSize: 11,
        maxFileSizeBytes: 10,
      }),
    ).rejects.toThrow("Audio too large")

    expect(fetchCalls.count).toBe(0)
  })

  test("rejects oversized Content-Length before reading the body", async () => {
    const getReaderCalls = { count: 0 }
    globalThis.fetch = mock(async () => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "11" }),
        body: {
          getReader() {
            getReaderCalls.count += 1
            return {
              read: async () => ({ done: true, value: undefined }),
              cancel: async () => undefined,
              releaseLock: () => undefined,
            }
          },
        },
      } as unknown as Response
    }) as unknown as typeof fetch

    await expect(
      downloadAudioBuffer({
        url: "https://audio.example/voice.ogg",
        maxFileSizeBytes: 10,
      }),
    ).rejects.toThrow("Audio too large")

    expect(getReaderCalls.count).toBe(0)
  })

  test("cancels streamed responses as soon as accumulated bytes exceed the limit", async () => {
    const pulls: number[] = []
    const cancelled = { value: false }
    globalThis.fetch = mock(async () => {
      const chunks = [new Uint8Array(6), new Uint8Array(5), new Uint8Array(100)]
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        body: {
          getReader() {
            return {
              read: async () => {
                const next = chunks.shift()
                pulls.push(next?.byteLength ?? 0)
                return next ? { done: false, value: next } : { done: true, value: undefined }
              },
              cancel: async () => {
                cancelled.value = true
              },
              releaseLock: () => undefined,
            }
          },
        },
      } as unknown as Response
    }) as unknown as typeof fetch

    await expect(
      downloadAudioBuffer({
        url: "https://audio.example/voice.ogg",
        maxFileSizeBytes: 10,
      }),
    ).rejects.toThrow("Audio too large")

    expect(cancelled.value).toBe(true)
    expect(pulls).toEqual([6, 5])
  })
})
