/**
 * Project command-discovery inputs.
 *
 * Acceptance judgment and report aggregates do not belong here. Discovery
 * only projects executable commands from the task and project files; Host
 * observations are persisted by the tools that actually execute them.
 */
export type ProjectCheckCommand = {
  command: string
  cwd?: string
}

export type CommandGroup = {
  name: string
  label?: string
  family?: string
  commands: ProjectCheckCommand[]
}

export type CheckDiscoveryTask = {
  taskID?: string
  request?: string
  metadata?: Record<string, unknown>
}

const MAX_OUTPUT = 12000

export function clip(input: string, maxLength?: number): string {
  const value = input.trim()
  const limit = maxLength ?? MAX_OUTPUT
  if (value.length <= limit) return value
  return value.slice(0, limit) + "\n...[truncated]"
}
