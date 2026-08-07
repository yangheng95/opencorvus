export interface VisionAnalysis {
  description: string
  model: string
  tokens: { prompt: number; completion: number }
}

export interface VisionPipelineOptions {
  apiKey: string
  baseURL?: string
  model?: string
}

export class VisionPipeline {
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(opts: VisionPipelineOptions) {
    this.apiKey = opts.apiKey
    this.baseURL = (opts.baseURL ?? "").replace(/\/$/, "")
    this.model = opts.model ?? ""
  }

  async analyze(imageBase64: string, prompt?: string): Promise<VisionAnalysis> {
    // Guard: skip if base64 payload is too large for the vision API
    const base64MB = imageBase64.length / (1024 * 1024)
    if (base64MB > 10) {
      throw new Error(`Vision skipped: base64 payload too large (${base64MB.toFixed(1)}MB)`)
    }

    const userPrompt =
      prompt ?? "Describe what you see on this screen. Focus on the main content, UI state, and any notable elements."

    const body = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
      max_tokens: 512,
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    try {
      const url = `${this.baseURL}/chat/completions`
      const fetchOpts: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }

      const res = await fetch(url, fetchOpts)

      if (!res.ok) {
        const text = await res.text().catch((e: unknown) => {
          console.warn("[vision] failed to read error response body:", e)
          return ""
        })
        throw new Error(`Vision API ${res.status}: ${text.slice(0, 200)}`)
      }

      const data: any = await res.json()
      const choice = data.choices?.[0]
      const usage = data.usage ?? {}

      return {
        description: choice?.message?.content ?? "(no description)",
        model: data.model ?? this.model,
        tokens: {
          prompt: usage.prompt_tokens ?? 0,
          completion: usage.completion_tokens ?? 0,
        },
      }
    } catch (err) {
      // Re-throw with more context for diagnosis
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Vision API aborted (timeout or SSL handshake failure). URL: ${this.baseURL}.`)
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }
}
