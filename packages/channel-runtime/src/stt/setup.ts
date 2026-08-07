import { STTPipeline } from "./pipeline"
import { DeepgramProvider } from "./providers/deepgram"
import { GoogleGeminiProvider } from "./providers/google-gemini"
import { GroqProvider } from "./providers/groq"
import { LocalCLIProvider } from "./providers/local-cli"
import { OpenAIWhisperProvider } from "./providers/openai-whisper"

type Env = Record<string, string | undefined>

export async function createConfiguredSTT(env: Env): Promise<STTPipeline | undefined> {
  const retiredProviders = env.STT_PROVIDERS?.trim()
  if (retiredProviders) {
    throw new Error("STT_PROVIDERS is retired. Set STT_PROVIDER to one speech-to-text provider.")
  }

  const provider = env.STT_PROVIDER?.trim()
  if (!provider) return undefined

  const pipeline = new STTPipeline({
    provider,
    language: env.STT_LANGUAGE,
  })
  pipeline.register(
    new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: env.STT_GROQ_MODEL,
      baseURL: env.STT_GROQ_BASE_URL,
    }),
  )
  pipeline.register(
    new OpenAIWhisperProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.STT_OPENAI_MODEL,
      baseURL: env.STT_OPENAI_BASE_URL,
    }),
  )
  pipeline.register(
    new DeepgramProvider({
      apiKey: env.DEEPGRAM_API_KEY,
      model: env.STT_DEEPGRAM_MODEL,
      baseURL: env.STT_DEEPGRAM_BASE_URL,
    }),
  )
  pipeline.register(
    new GoogleGeminiProvider({
      apiKey: env.GOOGLE_API_KEY,
      model: env.STT_GOOGLE_MODEL,
      baseURL: env.STT_GOOGLE_BASE_URL,
    }),
  )
  pipeline.register(new LocalCLIProvider({ command: env.STT_LOCAL_COMMAND }))
  await pipeline.init()
  return pipeline
}
