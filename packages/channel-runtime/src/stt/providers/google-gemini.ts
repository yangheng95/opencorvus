import type { AudioBuffer, STTProvider, STTResult } from "../types"

export class GoogleGeminiProvider implements STTProvider {
  readonly name = "google-gemini"
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

    const base64Data = audio.data.toString("base64")
    const langHint = options?.language ? ` The audio is in ${options.language}.` : ""

    const res = await fetch(`${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: audio.mime,
                  data: base64Data,
                },
              },
              {
                text: `Transcribe the audio exactly as spoken. Output ONLY the transcription text, nothing else.${langHint}`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> }
      }>
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    return {
      text,
      provider: this.name,
      durationMs: Math.round(performance.now() - start),
    }
  }
}
