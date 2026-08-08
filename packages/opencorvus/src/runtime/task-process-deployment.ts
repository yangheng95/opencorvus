export const TASK_PROCESS_MODE_ENV = "OPENCORVUS_TASK_PROCESS_MODE" as const

export function declareNativeTaskProcessDeployment(): void {
  if (process.env[TASK_PROCESS_MODE_ENV] === undefined) process.env[TASK_PROCESS_MODE_ENV] = "native"
}
