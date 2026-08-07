import { renderPromptSections } from "@/agent/prompt-projection"

export interface BuildPromptOverlayContext {
  contextSections?: readonly string[]
}

export interface BuildPromptOverlayResult {
  sections: string[]
}

export function renderBuildPromptOverlays(context: BuildPromptOverlayContext | undefined): BuildPromptOverlayResult {
  const sections: string[] = []
  const referencedFacts = renderPromptSections(context?.contextSections)
  if (referencedFacts) sections.push(referencedFacts)
  return { sections }
}
