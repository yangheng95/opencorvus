import type { ProviderModel } from "./model-schema"

export function requiresSerializedOpenAIToolCalls(model: ProviderModel): boolean {
  return model.api.npm === "@ai-sdk/openai" || model.api.npm === "@ai-sdk/azure"
}
