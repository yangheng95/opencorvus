import type { AudioBuffer, STTProvider, STTResult } from "../types"

export class DeepgramProvider implements STTProvider {
  readonly name = "deepgram"
  private apiKey?: string
  private model: string
  private baseURL: string

  constructor(opts: { apiKey?: string; model?: string; baseURL?: string }) {
    this.apiKey = opts.apiKey
    this.model = opts.model ?? ""
    this.baseURL = opts.baseURL ?? ""
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && !!this.model && !!this.baseURL
  }

  async transcribe(audio: AudioBuffer, options?: { language?: string; prompt?: string }): Promise<STTResult> {
    const start = performance.now()

    const params = new URLSearchParams({ model: this.model })
    if (options?.language) params.set("language", options.language)

    const res = await fetch(`${this.baseURL}/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": audio.mime,
      },
      body: new Uint8Array(audio.data),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Deepgram API ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as {
      results: {
        channels: Array<{
          alternatives: Array<{ transcript: string }>
          detected_language?: string
        }>
      }
    }

    const channel = json.results.channels[0]
    const transcript = channel?.alternatives[0]?.transcript ?? ""
    return {
      text: transcript,
      provider: this.name,
      language: channel?.detected_language,
      durationMs: Math.round(performance.now() - start),
    }
  }
}
