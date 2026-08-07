import { normalizeVisualQaReferenceRegionKey } from "./reference-region-key"

export type VisualQaDispatchContext = {
  appUrl?: string
  previewCommand?: string
  referenceParityRequired?: boolean
  requiredReferenceRegions?: string[]
}

export function normalizeVisualQaDispatchContext(input: VisualQaDispatchContext): VisualQaDispatchContext {
  return {
    ...(input.appUrl?.trim() ? { appUrl: input.appUrl.trim() } : {}),
    ...(input.previewCommand?.trim() ? { previewCommand: input.previewCommand.trim() } : {}),
    ...(input.referenceParityRequired ? { referenceParityRequired: true } : {}),
    ...(input.requiredReferenceRegions?.length
      ? {
          requiredReferenceRegions: input.requiredReferenceRegions.map((region, index) =>
            normalizeVisualQaReferenceRegionKey(
              region,
              `VisualQaDispatchContext.requiredReferenceRegions[${index}]`,
            ),
          ),
        }
      : {}),
  }
}

export function renderVisualQaDispatchContext(context: VisualQaDispatchContext | undefined): string | undefined {
  if (!context) return undefined
  const lines = [
    context.appUrl ? `- app URL: ${context.appUrl}` : "",
    context.previewCommand ? `- preview command: ${context.previewCommand}` : "",
    context.referenceParityRequired ? "- reference parity required: true" : "",
    context.requiredReferenceRegions?.length
      ? `- required reference regions: ${context.requiredReferenceRegions.join(", ")}`
      : "",
  ].filter(Boolean)
  return lines.length > 0 ? ["## Visual QA dispatch facts", "", ...lines].join("\n") : undefined
}
