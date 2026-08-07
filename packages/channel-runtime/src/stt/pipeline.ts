import type { AudioBuffer, AudioSource, STTConfig, STTProvider, STTResult } from "./types"
import { assertSTTAudioSize, DEFAULT_STT_MAX_FILE_SIZE_BYTES } from "./limits"

export class STTPipeline {
  private config: STTConfig
  private registry = new Map<string, STTProvider>()
  private provider?: STTProvider

  constructor(config: STTConfig) {
    this.config = config
  }

  register(provider: STTProvider): this {
    this.registry.set(provider.name, provider)
    return this
  }

  /** Probe the configured provider and fail if it is unavailable. */
  async init(): Promise<void> {
    this.provider = undefined
    const name = this.config.provider.trim()
    if (!name) {
      throw new Error("[STT] STT_PROVIDER must name one provider.")
    }
    const provider = this.registry.get(name)
    if (!provider) {
      throw new Error(`[STT] Provider "${name}" is not registered.`)
    }
    if (!(await provider.isAvailable())) {
      throw new Error(`[STT] Provider "${name}" is not available.`)
    }
    this.provider = provider
    console.log(`[STT] Pipeline initialized: ${provider.name}`)
  }

  get isAvailable(): boolean {
    return Boolean(this.provider)
  }

  /** Transcribe audio with the configured provider. */
  async transcribe(audio: AudioSource): Promise<STTResult> {
    if (!this.provider) {
      throw new Error("[STT] Pipeline is not initialized.")
    }
    const maxSize = this.config.maxFileSizeBytes ?? DEFAULT_STT_MAX_FILE_SIZE_BYTES
    if (audio.size !== undefined) {
      assertSTTAudioSize(audio.size, maxSize)
    }
    const data = await audio.read(maxSize)
    const audioBuffer: AudioBuffer = {
      data,
      mime: audio.mime,
      filename: audio.filename,
      size: data.length,
      duration: audio.duration,
    }
    assertSTTAudioSize(audioBuffer.size, maxSize)

    const result = await this.provider.transcribe(audioBuffer, { language: this.config.language })
    console.log(`[STT] "${this.provider.name}" transcribed in ${result.durationMs}ms: "${result.text.slice(0, 80)}"`)
    return result
  }
}
