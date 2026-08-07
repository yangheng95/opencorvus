import { settingsStore } from "../store/settings"
import { formatErrorDetails } from "../utils/error-details"
import { reportWarning } from "./diagnostics"
import { getHostTransport } from "./host-transport-runtime"
import { loadMailbox, type MailboxItem, type MailboxPage, type MailboxView } from "./mailbox"

type HostPermission = "granted" | "denied" | "default" | "unsupported"

const MAILBOX_NOTIFICATION_PAGE_SIZE = 100

let permissionRequestPending: Promise<HostPermission> | undefined

function reportDesktopNotificationFailure(title: string, error: unknown): void {
  reportWarning({
    id: "system:desktop-notification",
    title,
    message: title,
    details: formatErrorDetails(error),
  })
}

async function readHostPermission(): Promise<HostPermission> {
  const transport = getHostTransport()
  if (!transport.capabilities.nativeCommands["notification.permission"]) return "unsupported"
  try {
    return (await transport.native({ kind: "notification.permission" })) as HostPermission
  } catch (error) {
    reportDesktopNotificationFailure("Desktop notification permission check failed", error)
    throw error
  }
}

async function requestHostPermission(): Promise<HostPermission> {
  const transport = getHostTransport()
  if (!transport.capabilities.nativeCommands["notification.requestPermission"]) return "unsupported"
  try {
    return (await transport.native({ kind: "notification.requestPermission" })) as HostPermission
  } catch (error) {
    reportDesktopNotificationFailure("Desktop notification permission request failed", error)
    throw error
  }
}

type ProjectionOwnership = () => boolean
type NotificationDelivery = "delivered" | "deferred"

async function sendHostNotification(item: MailboxItem): Promise<NotificationDelivery> {
  const transport = getHostTransport()
  if (!transport.capabilities.nativeCommands["notification.send"]) return "deferred"
  if (!settingsStore.desktopNotifications) return "deferred"
  try {
    const accepted = await transport.native({
      kind: "notification.send",
      title: item.subject,
      body: item.body,
      tag: `oc:agent-mailbox:${item.id}`,
    })
    return accepted === true ? "delivered" : "deferred"
  } catch (error) {
    reportDesktopNotificationFailure("Desktop notification send failed", error)
    throw error
  }
}

async function setMailboxBadge(count: number): Promise<void> {
  const transport = getHostTransport()
  if (!transport.capabilities.nativeCommands["badge.set"]) return
  try {
    await transport.native({ kind: "badge.set", count })
  } catch (error) {
    reportDesktopNotificationFailure("Agent mailbox badge update failed", error)
    throw error
  }
}

export function requestNotificationPermission(): Promise<HostPermission> {
  if (permissionRequestPending) return permissionRequestPending
  const request = requestHostPermission().finally(() => {
    if (permissionRequestPending === request) permissionRequestPending = undefined
  })
  permissionRequestPending = request
  return request
}

export async function ensureDesktopNotificationPermission(): Promise<HostPermission> {
  if (!settingsStore.desktopNotifications) return "denied"
  const state = await readHostPermission()
  if (!settingsStore.desktopNotifications) return "denied"
  if (state === "granted" || state === "denied" || state === "unsupported") return state
  const requested = await requestNotificationPermission()
  return settingsStore.desktopNotifications ? requested : "denied"
}

export function isMailboxNotification(item: MailboxItem): boolean {
  return item.archivedAt === undefined && item.readAt === undefined
}

interface MailboxNotificationProjectionDependencies {
  setBadge: (count: number) => Promise<void>
  sendNotification: (item: MailboxItem) => Promise<NotificationDelivery>
  canSendNotification: () => Promise<boolean>
}

export class MailboxNotificationProjector {
  private seen: Set<string> | undefined
  private presented = new Set<string>()
  private projectionTail = Promise.resolve()

  constructor(private readonly dependencies: MailboxNotificationProjectionDependencies) {}

  async project(
    items: MailboxItem[],
    ownsProjection: ProjectionOwnership,
    presentNotification?: (item: MailboxItem) => void,
  ): Promise<void> {
    await this.runSerialized(() => this.projectOwned(items, ownsProjection, presentNotification))
  }

  async replaceScope(ownsProjection: ProjectionOwnership): Promise<void> {
    await this.runSerialized(async () => {
      if (!ownsProjection()) return
      await this.dependencies.setBadge(0)
    })
  }

  private async runSerialized(effect: () => Promise<void>): Promise<void> {
    const previous = this.projectionTail
    let release!: () => void
    this.projectionTail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      await effect()
    } finally {
      release()
    }
  }

  private async projectOwned(
    items: MailboxItem[],
    ownsProjection: ProjectionOwnership,
    presentNotification: ((item: MailboxItem) => void) | undefined,
  ): Promise<void> {
    if (!ownsProjection()) return
    const current = items.filter(isMailboxNotification)
    await this.dependencies.setBadge(current.length)
    if (!ownsProjection()) return

    const currentIDs = new Set(current.map((item) => item.id))
    const seen = this.seen
    if (!seen) {
      this.seen = currentIDs
      this.presented = new Set(currentIDs)
      return
    }

    for (const item of current) {
      if (this.presented.has(item.id)) continue
      if (!ownsProjection()) return
      presentNotification?.(item)
      this.presented.add(item.id)
    }

    const added = current.filter((item) => !seen.has(item.id))
    if (!ownsProjection()) return
    if (added.length === 0) return
    for (const item of added) {
      if (!ownsProjection()) return
      const canSend = await this.dependencies.canSendNotification()
      if (!ownsProjection() || !canSend) return
      const delivery = await this.dependencies.sendNotification(item)
      if (delivery === "deferred") return
      const delivered = new Set(this.seen ?? seen)
      delivered.add(item.id)
      this.seen = delivered
    }
  }
}

async function canSendDesktopNotification(): Promise<boolean> {
  if (!settingsStore.desktopNotifications) return false
  const transport = getHostTransport()
  if (!transport.capabilities.nativeCommands["notification.send"]) return false
  if (!transport.capabilities.ui.desktopNotificationsRequirePermission) return true
  const permission = await ensureDesktopNotificationPermission()
  return settingsStore.desktopNotifications && permission === "granted"
}

export function createDesktopMailboxNotificationProjector(): MailboxNotificationProjector {
  return new MailboxNotificationProjector({
    setBadge: setMailboxBadge,
    sendNotification: sendHostNotification,
    canSendNotification: canSendDesktopNotification,
  })
}

const projector = createDesktopMailboxNotificationProjector()

export async function projectMailboxNotificationScopeReplacement(input: { signal: AbortSignal }): Promise<void> {
  try {
    await projector.replaceScope(() => !input.signal.aborted)
  } catch (error) {
    if (!input.signal.aborted) reportDesktopNotificationFailure("Agent mailbox badge reset failed", error)
  }
}

async function loadAllActiveMailboxItems(
  initialPage: MailboxPage | undefined,
  initialView: MailboxView,
  signal: AbortSignal,
): Promise<MailboxItem[]> {
  let page = initialView === "active" ? initialPage : undefined
  if (!page) {
    page = await loadMailbox({ view: "active", limit: MAILBOX_NOTIFICATION_PAGE_SIZE, signal })
  }
  const items = [...page.items]
  let cursor = page.nextCursor
  while (cursor) {
    page = await loadMailbox({
      view: "active",
      limit: MAILBOX_NOTIFICATION_PAGE_SIZE,
      cursor,
      signal,
    })
    items.push(...page.items)
    cursor = page.nextCursor
  }
  return items
}

export async function projectMailboxNotifications(input: {
  directory: string
  view: MailboxView
  page: MailboxPage
  signal: AbortSignal
  onNotification?: (item: MailboxItem) => void
}): Promise<void> {
  try {
    const items = await loadAllActiveMailboxItems(input.page, input.view, input.signal)
    if (input.signal.aborted) return
    await projector.project(items, () => !input.signal.aborted, input.onNotification)
  } catch (error) {
    if (!input.signal.aborted) reportDesktopNotificationFailure("Agent mailbox notification projection failed", error)
  }
}
