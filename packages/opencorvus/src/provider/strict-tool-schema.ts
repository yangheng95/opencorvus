import type { ProviderModel } from "./model-schema"

export function requiresOpenAIStrictToolSchema(model: ProviderModel): boolean {
  if (model.api.npm === "@ai-sdk/openai" || model.api.npm === "@ai-sdk/azure") return true
  if (model.api.npm !== "@ai-sdk/openai-compatible") return false
  const id = `${model.id} ${model.api.id}`.toLowerCase()
  return /(^|[\/\s])(?:chatgpt-[\w.-]+|gpt-[\w.-]+|o\d(?:[-.\s]|$))/.test(id)
}
