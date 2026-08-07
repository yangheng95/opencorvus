export interface ComposerRunControlState {
  parallelism: number | null
  unattended: boolean | null
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function composerRunControlState(config: unknown): ComposerRunControlState {
  const root = objectValue(config)
  const assistant = objectValue(root?.assistant)
  const experimental = objectValue(root?.experimental)
  const parallelismValue = assistant?.max_executor_groups
  const proposedTaskValue = experimental?.auto_confirm_proposed_tasks
  const questionValue = experimental?.auto_question

  return {
    parallelism:
      typeof parallelismValue === "number" && Number.isInteger(parallelismValue) && parallelismValue >= 1
        ? parallelismValue
        : null,
    unattended:
      typeof proposedTaskValue === "boolean" && typeof questionValue === "boolean"
        ? proposedTaskValue && questionValue
        : null,
  }
}

export function parallelismConfigPatch(value: number): Record<string, unknown> {
  if (!Number.isInteger(value) || value < 1) throw new Error("Parallelism must be a positive integer")
  return { assistant: { max_executor_groups: value } }
}

export function unattendedConfigPatch(enabled: boolean): Record<string, unknown> {
  return {
    experimental: {
      auto_confirm_proposed_tasks: enabled,
      auto_question: enabled,
    },
  }
}
