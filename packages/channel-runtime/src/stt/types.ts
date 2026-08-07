export interface AudioSource {
  mime: string // "audio/ogg", "audio/webm", etc.
  filename?: string
  size?: number
  duration?: number // seconds, filled when platform provides it
  read(maxFileSizeBytes: number): Promise<Buffer>
}

export interface AudioBuffer {
  data: Buffer
  mime: string // "audio/ogg", "audio/webm", etc.
  filename?: string
  size: number
  duration?: number // seconds, filled when platform provides it
}

export interface STTResult {
  text: string
  provider: string // "openai-whisper", "groq", etc.
  language?: string
  durationMs: number // transcription latency
}

export interface STTProvider {
  readonly name: string
  isAvailable(): Promise<boolean>
  transcribe(audio: AudioBuffer, options?: { language?: string; prompt?: string }): Promise<STTResult>
}

export interface STTConfig {
  provider: string // single speech-to-text provider name
  language?: string // default language hint
  maxFileSizeBytes?: number // default 25MB
}
