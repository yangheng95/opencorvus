import type { IconName } from "../components/ui/Icon"

const STATUS_ICON_NAME: Record<string, IconName> = {
  idle: "status-idle",
  pending: "status-idle",
  queued: "status-queued",
  active: "status-active",
  running: "status-active",
  completed: "status-completed",
  failed: "status-failed",
  error: "status-failed",
  cancelled: "status-cancelled",
  skipped: "status-cancelled",
}

export function statusIconName(status: string): IconName {
  const iconName = STATUS_ICON_NAME[status]
  if (!iconName) {
    throw new Error(`Unsupported status icon mapping: ${status}`)
  }
  return iconName
}

const TODO_STATUS_ICON_NAME: Record<string, IconName> = {
  completed: "status-completed",
  in_progress: "status-active",
  cancelled: "status-cancelled",
  pending: "status-idle",
}

export function todoStatusIconName(status: string): IconName {
  const iconName = TODO_STATUS_ICON_NAME[status]
  if (!iconName) {
    throw new Error(`Unsupported todo status icon mapping: ${status}`)
  }
  return iconName
}
