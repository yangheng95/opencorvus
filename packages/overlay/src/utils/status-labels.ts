import { t } from "./i18n"

export const TASK_LIFECYCLE_STATUSES = ["queued", "active", "completed", "failed", "cancelled"] as const
export type TaskLifecycleStatus = (typeof TASK_LIFECYCLE_STATUSES)[number]

const taskLifecycleStatusSet = new Set<string>(TASK_LIFECYCLE_STATUSES)

export class UnsupportedStatusLabelError extends Error {
  constructor(
    readonly domain: "task lifecycle",
    readonly status: string,
  ) {
    super(`Unsupported ${domain} status label: ${status || "(empty)"}`)
    this.name = "UnsupportedStatusLabelError"
  }
}

export function isTaskLifecycleStatus(status: string): status is TaskLifecycleStatus {
  return taskLifecycleStatusSet.has(status)
}

function normalizedStatus(status: string): string {
  return String(status).trim()
}

export function taskLifecycleStatusLabel(status: TaskLifecycleStatus): string {
  return t(`task.status.${status}`)
}

export function taskLifecycleStatusLabelFromString(status: string): string {
  const normalized = normalizedStatus(status)
  if (!isTaskLifecycleStatus(normalized)) {
    throw new UnsupportedStatusLabelError("task lifecycle", normalized)
  }
  return taskLifecycleStatusLabel(normalized)
}

export function taskLifecycleStatusOrIdleLabel(status: string | null | undefined): string {
  const normalized = normalizedStatus(status ?? "")
  if (!normalized) return t("task.status.idle")
  return taskLifecycleStatusLabelFromString(normalized)
}
