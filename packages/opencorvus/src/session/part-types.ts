export const VISIBLE_PART_TYPE = {
  text: "text",
  partError: "part-error",
  reasoning: "reasoning",
  file: "file",
  interactiveArtifact: "interactive-artifact",
  tool: "tool",
  stepStart: "step-start",
  stepFinish: "step-finish",
  snapshot: "snapshot",
  patch: "patch",
  retry: "retry",
  compaction: "compaction",
} as const

export const VISIBLE_PART_TYPES = Object.values(VISIBLE_PART_TYPE)
