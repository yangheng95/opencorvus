import { afterEach, describe, expect, test } from "bun:test"
import {
  MailboxNotificationProjector,
  createDesktopMailboxNotificationProjector,
  ensureDesktopNotificationPermission,
  isMailboxNotification,
  projectMailboxNotificationScopeReplacement,
  projectMailboxNotifications,
  requestNotificationPermission,
} from "../src/services/desktop-notifications"
import { HOST_CAPABILITIES, type HostTransport, type NativeCommand } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { MailboxItem } from "../src/services/mailbox"
import { setSettingsStore } from "../src/store/settings"

function mailboxItem(overrides: Partial<MailboxItem> = {}): MailboxItem {
  return {
    id: "message-1",
    eventType: "mailbox.message",
    category: "notification",
    attention: false,
    subject: "Agent notice",
    body: "Agent work changed",
    evidenceLocators: [],
    sourceAgentID: "build",
    taskID: "task-1",
    taskTitle: "Task one",
    taskDirectory: "/workspace",
    orderKey: "1",
    createdAt: 1,
    ...overrides,
  }
}

function nativeTransport(
  run: (command: NativeCommand) => Promise<unknown>,
  capabilities = HOST_CAPABILITIES.tauri,
): HostTransport {
  return {
    kind: "tauri",
    capabilities,
    async request() {
      throw new Error("desktop notification native test does not issue HTTP requests")
    },
    openStream() {
      throw new Error("desktop notification native test does not open streams")
    },
    native: run,
  }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
  setSettingsStore("desktopNotifications", true)
})

describe("Mailbox notification projection", () => {
  test("accepts every unread active backend-owned Mailbox item", () => {
    expect(isMailboxNotification(mailboxItem())).toBe(true)
    expect(isMailboxNotification(mailboxItem({ eventType: "task.failed" }))).toBe(true)
    expect(isMailboxNotification(mailboxItem({ eventType: "goal.failed" }))).toBe(true)
    expect(
      isMailboxNotification(mailboxItem({ eventType: "interaction.requested", category: "status", attention: true })),
    ).toBe(true)
    expect(isMailboxNotification(mailboxItem({ eventType: "agent.coordination.requested" }))).toBe(true)
    expect(isMailboxNotification(mailboxItem({ eventType: "task.completed", category: "status" }))).toBe(true)
    expect(isMailboxNotification(mailboxItem({ category: "progress", attention: false }))).toBe(true)
    expect(isMailboxNotification(mailboxItem({ readAt: 2 }))).toBe(false)
    expect(isMailboxNotification(mailboxItem({ archivedAt: 2 }))).toBe(false)
  })

  test("seeds without historical popups, then sends each new agent notification once", async () => {
    const badges: number[] = []
    const sent: string[] = []
    const projector = new MailboxNotificationProjector({
      setBadge: async (count) => {
        badges.push(count)
      },
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => true,
    })

    await projector.project([mailboxItem()], () => true)
    expect(badges).toEqual([1])
    expect(sent).toEqual([])

    const added = mailboxItem({ id: "message-2", createdAt: 2 })
    await projector.project([added, mailboxItem()], () => true)
    await projector.project([added, mailboxItem()], () => true)
    expect(badges).toEqual([1, 2, 2])
    expect(sent).toEqual(["message-2"])
  })

  test("keeps one global delivery baseline when the selected project directory changes", async () => {
    const sent: string[] = []
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => true,
    })
    const initial = mailboxItem({ id: "initial", taskDirectory: "/project-a" })
    const added = mailboxItem({ id: "added", taskDirectory: "/project-b", createdAt: 2 })

    await projector.project([initial], () => true)
    await projector.project([added, initial], () => true)
    await projector.project([added, initial], () => true)

    expect(sent).toEqual([added.id])
  })

  test("presents each new canonical notification once while deferred host delivery remains retryable", async () => {
    const presented: string[] = []
    const sent: string[] = []
    let canSend = false
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => canSend,
    })
    const initial = mailboxItem({ id: "initial" })
    const added = mailboxItem({ id: "added", createdAt: 2 })
    const present = (item: MailboxItem) => presented.push(item.id)

    await projector.project([initial], () => true, present)
    await projector.project([initial, added], () => true, present)
    await projector.project([initial, added], () => true, present)
    expect(presented).toEqual([added.id])
    expect(sent).toEqual([])

    canSend = true
    await projector.project([initial, added], () => true, present)
    await projector.project([initial, added], () => true, present)
    expect(presented).toEqual([added.id])
    expect(sent).toEqual([added.id])
  })

  test("does not redeliver the same Mailbox item after it leaves and returns to the active projection", async () => {
    const sent: string[] = []
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => true,
    })
    const restored = mailboxItem({ id: "restored-message" })

    await projector.project([], () => true)
    await projector.project([restored], () => true)
    await projector.project([], () => true)
    await projector.project([restored], () => true)

    expect(sent).toEqual([restored.id])
  })

  test("badge remains active when desktop popups are disabled", async () => {
    const badges: number[] = []
    const sent: string[] = []
    let canSend = false
    const projector = new MailboxNotificationProjector({
      setBadge: async (count) => {
        badges.push(count)
      },
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => canSend,
    })

    await projector.project([], () => true)
    await projector.project([mailboxItem()], () => true)
    canSend = true
    await projector.project([mailboxItem()], () => true)
    await projector.project([mailboxItem()], () => true)
    expect(badges).toEqual([0, 1, 1, 1])
    expect(sent).toEqual(["message-1"])
  })

  test("a denied permission retains undelivered messages for the next eligible projection", async () => {
    const sent: string[] = []
    let canSend = false
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => canSend,
    })

    await projector.project([], () => true)
    await projector.project([mailboxItem()], () => true)
    expect(sent).toEqual([])
    canSend = true
    await projector.project([mailboxItem()], () => true)
    await projector.project([mailboxItem()], () => true)
    expect(sent).toEqual(["message-1"])
  })

  test("a deferred send is retried until the host confirms delivery", async () => {
    const attempts: string[] = []
    let defer = true
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      async sendNotification(item) {
        attempts.push(item.id)
        if (defer) {
          defer = false
          return "deferred"
        }
        return "delivered"
      },
      canSendNotification: async () => true,
    })

    await projector.project([], () => true)
    await projector.project([mailboxItem()], () => true)
    await projector.project([mailboxItem()], () => true)
    await projector.project([mailboxItem()], () => true)

    expect(attempts).toEqual(["message-1", "message-1"])
  })

  test("rechecks delivery eligibility between items in one notification batch", async () => {
    let deliveryEnabled = true
    let firstSendStarted!: () => void
    let releaseFirstSend!: () => void
    const firstSendStart = new Promise<void>((resolve) => {
      firstSendStarted = resolve
    })
    const firstSendRelease = new Promise<void>((resolve) => {
      releaseFirstSend = resolve
    })
    const sent: string[] = []
    const first = mailboxItem({ id: "batch-first" })
    const second = mailboxItem({ id: "batch-second", createdAt: 2 })
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      async sendNotification(item) {
        if (item.id === first.id && sent.length === 0) {
          firstSendStarted()
          await firstSendRelease
        }
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => deliveryEnabled,
    })

    await projector.project([], () => true)
    const pendingBatch = projector.project([first, second], () => true)
    await firstSendStart
    deliveryEnabled = false
    releaseFirstSend()
    await pendingBatch
    expect(sent).toEqual([first.id])

    deliveryEnabled = true
    await projector.project([first, second], () => true)
    await projector.project([first, second], () => true)
    expect(sent).toEqual([first.id, second.id])
  })

  test("serializes native badge effects so a superseded result cannot land after the current badge", async () => {
    let ownsOldProjection = true
    let releaseBadge!: () => void
    let badgeStarted!: () => void
    const badgeStart = new Promise<void>((resolve) => {
      badgeStarted = resolve
    })
    const badgeRelease = new Promise<void>((resolve) => {
      releaseBadge = resolve
    })
    const badges: number[] = []
    const sent: string[] = []
    const projector = new MailboxNotificationProjector({
      async setBadge(count) {
        badgeStarted()
        await badgeRelease
        badges.push(count)
      },
      async sendNotification(item) {
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => true,
    })

    const superseded = projector.project([mailboxItem()], () => ownsOldProjection)
    await badgeStart
    ownsOldProjection = false
    const current = projector.project([mailboxItem(), mailboxItem({ id: "message-2", createdAt: 2 })], () => true)
    releaseBadge()
    await superseded
    await current
    expect(badges).toEqual([1, 2])
    expect(sent).toEqual([])
  })

  test("serializes a replacement scope zero badge after the previous native badge effect", async () => {
    let releaseOldBadge!: () => void
    let oldBadgeStarted!: () => void
    const oldBadgeStart = new Promise<void>((resolve) => {
      oldBadgeStarted = resolve
    })
    const oldBadgeRelease = new Promise<void>((resolve) => {
      releaseOldBadge = resolve
    })
    const badges: number[] = []
    let firstBadge = true
    const projector = new MailboxNotificationProjector({
      async setBadge(count) {
        if (firstBadge) {
          firstBadge = false
          oldBadgeStarted()
          await oldBadgeRelease
        }
        badges.push(count)
      },
      sendNotification: async () => "delivered",
      canSendNotification: async () => false,
    })

    const oldProjection = projector.project([mailboxItem()], () => true)
    await oldBadgeStart
    const replacement = projector.replaceScope(() => true)
    releaseOldBadge()
    await Promise.all([oldProjection, replacement])

    expect(badges).toEqual([1, 0])
  })

  test("an empty scope replacement queued behind native work cannot overwrite its successor", async () => {
    let releaseOldBadge!: () => void
    let oldBadgeStarted!: () => void
    const oldBadgeStart = new Promise<void>((resolve) => {
      oldBadgeStarted = resolve
    })
    const oldBadgeRelease = new Promise<void>((resolve) => {
      releaseOldBadge = resolve
    })
    const badges: number[] = []
    let firstBadge = true
    const projector = new MailboxNotificationProjector({
      async setBadge(count) {
        if (firstBadge) {
          firstBadge = false
          oldBadgeStarted()
          await oldBadgeRelease
        }
        badges.push(count)
      },
      sendNotification: async () => "delivered",
      canSendNotification: async () => false,
    })

    const oldProjection = projector.project([mailboxItem()], () => true)
    await oldBadgeStart
    const emptyScope = new AbortController()
    const emptyReplacement = projector.replaceScope(() => !emptyScope.signal.aborted)
    emptyScope.abort()
    const currentProjection = projector.project([mailboxItem(), mailboxItem({ id: "message-2" })], () => true)
    releaseOldBadge()
    await Promise.all([oldProjection, emptyReplacement, currentProjection])

    expect(badges).toEqual([1, 2])
  })

  test("projects a replacement scope zero through the native badge command", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(
      nativeTransport(async (command) => {
        commands.push(command)
        return undefined
      }),
    )

    await projectMailboxNotificationScopeReplacement({ signal: new AbortController().signal })

    expect(commands).toEqual([{ kind: "badge.set", count: 0 }])
  })

  test("concurrent permission callers share the exact pending native request", async () => {
    let releasePermission!: () => void
    const permissionRelease = new Promise<void>((resolve) => {
      releasePermission = resolve
    })
    const commands: NativeCommand[] = []
    __setHostTransportForTest(
      nativeTransport(async (command) => {
        commands.push(command)
        if (command.kind === "notification.requestPermission") await permissionRelease
        return "granted"
      }),
    )

    const first = requestNotificationPermission()
    const second = requestNotificationPermission()
    expect(second).toBe(first)
    expect(commands).toEqual([{ kind: "notification.requestPermission" }])
    releasePermission()
    await expect(first).resolves.toBe("granted")
    await expect(second).resolves.toBe("granted")
  })

  test("disabling notifications during permission inspection does not request permission", async () => {
    let permissionStarted!: () => void
    let releasePermission!: () => void
    const permissionStart = new Promise<void>((resolve) => {
      permissionStarted = resolve
    })
    const permissionRelease = new Promise<void>((resolve) => {
      releasePermission = resolve
    })
    const commands: NativeCommand[] = []
    setSettingsStore("desktopNotifications", true)
    __setHostTransportForTest(
      nativeTransport(async (command) => {
        commands.push(command)
        if (command.kind === "notification.permission") {
          permissionStarted()
          await permissionRelease
          return "default"
        }
        return "granted"
      }),
    )

    const permission = ensureDesktopNotificationPermission()
    await permissionStart
    setSettingsStore("desktopNotifications", false)
    releasePermission()

    await expect(permission).resolves.toBe("denied")
    expect(commands).toEqual([{ kind: "notification.permission" }])
  })

  test("a permission request that resolves after notifications are disabled does not retain the old grant", async () => {
    let requestStarted!: () => void
    let releaseRequest!: () => void
    const requestStart = new Promise<void>((resolve) => {
      requestStarted = resolve
    })
    const requestRelease = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    setSettingsStore("desktopNotifications", true)
    __setHostTransportForTest(
      nativeTransport(async (command) => {
        if (command.kind === "notification.permission") return "default"
        if (command.kind === "notification.requestPermission") {
          requestStarted()
          await requestRelease
          return "granted"
        }
        return undefined
      }),
    )

    const permission = ensureDesktopNotificationPermission()
    await requestStart
    setSettingsStore("desktopNotifications", false)
    releaseRequest()

    await expect(permission).resolves.toBe("denied")
  })

  test("requests permission and sends one system notification for a new task-completed status item", async () => {
    const commands: NativeCommand[] = []
    let permission: "default" | "granted" = "default"
    const directory = "/default-permission"
    const initial = mailboxItem({ id: "initial", category: "progress" })
    const added = mailboxItem({ id: "added", category: "status", eventType: "task.completed", createdAt: 2 })
    __setHostTransportForTest(
      nativeTransport(async (command) => {
        commands.push(command)
        if (command.kind === "notification.permission") return permission
        if (command.kind === "notification.requestPermission") {
          permission = "granted"
          return permission
        }
        if (command.kind === "notification.send") return true
        return undefined
      }),
    )

    await projectMailboxNotifications({
      directory,
      view: "active",
      page: { items: [initial], nextCursor: null, unreadCount: 1, activeCount: 1, archivedCount: 0 },
      signal: new AbortController().signal,
    })
    await projectMailboxNotifications({
      directory,
      view: "active",
      page: { items: [added, initial], nextCursor: null, unreadCount: 2, activeCount: 2, archivedCount: 0 },
      signal: new AbortController().signal,
    })

    expect(commands).toEqual([
      { kind: "badge.set", count: 1 },
      { kind: "badge.set", count: 2 },
      { kind: "notification.permission" },
      { kind: "notification.requestPermission" },
      {
        kind: "notification.send",
        title: added.subject,
        body: added.body,
        tag: `oc:agent-mailbox:${added.id}`,
      },
    ])
  })

  test("disabling notifications during permission inspection prevents the pending native send", async () => {
    let permissionStarted!: () => void
    let releasePermission!: () => void
    const permissionStart = new Promise<void>((resolve) => {
      permissionStarted = resolve
    })
    const permissionRelease = new Promise<void>((resolve) => {
      releasePermission = resolve
    })
    const commands: NativeCommand[] = []
    const initial = mailboxItem({ id: "setting-race-initial" })
    const added = mailboxItem({ id: "setting-race-added", createdAt: 2 })
    const projector = createDesktopMailboxNotificationProjector()
    setSettingsStore("desktopNotifications", true)
    __setHostTransportForTest(
      nativeTransport(async (command) => {
        commands.push(command)
        if (command.kind === "notification.permission") {
          permissionStarted()
          await permissionRelease
          return "granted"
        }
        if (command.kind === "notification.send") return true
        return undefined
      }, HOST_CAPABILITIES.browser),
    )

    await projector.project([initial], () => true)
    const projection = projector.project([initial, added], () => true)
    await permissionStart
    setSettingsStore("desktopNotifications", false)
    releasePermission()
    await projection

    expect(commands).toEqual([{ kind: "notification.permission" }])

    setSettingsStore("desktopNotifications", true)
    await projector.project([initial, added], () => true)
    await projector.project([initial, added], () => true)
    expect(commands).toEqual([
      { kind: "notification.permission" },
      { kind: "notification.permission" },
      {
        kind: "notification.send",
        title: added.subject,
        body: added.body,
        tag: `oc:agent-mailbox:${added.id}`,
      },
    ])
  })

  test("the production sender retains the unsent remainder of a batch disabled during its first native send", async () => {
    let firstSendStarted!: () => void
    let releaseFirstSend!: () => void
    const firstSendStart = new Promise<void>((resolve) => {
      firstSendStarted = resolve
    })
    const firstSendRelease = new Promise<void>((resolve) => {
      releaseFirstSend = resolve
    })
    const sentTags: string[] = []
    const first = mailboxItem({ id: "production-batch-first" })
    const second = mailboxItem({ id: "production-batch-second", createdAt: 2 })
    const projector = createDesktopMailboxNotificationProjector()
    setSettingsStore("desktopNotifications", true)
    __setHostTransportForTest(
      nativeTransport(async (command) => {
        if (command.kind === "notification.permission") return "granted"
        if (command.kind !== "notification.send") return undefined
        sentTags.push(command.tag || "")
        if (command.tag === `oc:agent-mailbox:${first.id}`) {
          firstSendStarted()
          await firstSendRelease
        }
        return true
      }),
    )

    await projector.project([], () => true)
    const pendingBatch = projector.project([first, second], () => true)
    await firstSendStart
    setSettingsStore("desktopNotifications", false)
    releaseFirstSend()
    await pendingBatch
    expect(sentTags).toEqual([`oc:agent-mailbox:${first.id}`])

    setSettingsStore("desktopNotifications", true)
    await projector.project([first, second], () => true)
    await projector.project([first, second], () => true)
    expect(sentTags).toEqual([`oc:agent-mailbox:${first.id}`, `oc:agent-mailbox:${second.id}`])
  })

  test("supersession during permission lookup prevents sends and preserves the previous baseline", async () => {
    let ownsProjection = true
    let permissionStarted!: () => void
    let releasePermission!: () => void
    const permissionStart = new Promise<void>((resolve) => {
      permissionStarted = resolve
    })
    const permissionRelease = new Promise<void>((resolve) => {
      releasePermission = resolve
    })
    const sent: string[] = []
    let delayPermission = false
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      async canSendNotification() {
        if (!delayPermission) return true
        permissionStarted()
        await permissionRelease
        return true
      },
    })

    await projector.project([mailboxItem()], () => ownsProjection)
    const added = mailboxItem({ id: "message-2", createdAt: 2 })
    delayPermission = true
    const superseded = projector.project([mailboxItem(), added], () => ownsProjection)
    await permissionStart
    ownsProjection = false
    releasePermission()
    await superseded
    expect(sent).toEqual([])

    ownsProjection = true
    delayPermission = false
    await projector.project([mailboxItem(), added], () => ownsProjection)
    expect(sent).toEqual(["message-2"])
  })

  test("serializes delayed sends and records their real delivery before the current projection runs", async () => {
    let releaseSend!: () => void
    let sendStarted!: () => void
    const sendStart = new Promise<void>((resolve) => {
      sendStarted = resolve
    })
    const sendRelease = new Promise<void>((resolve) => {
      releaseSend = resolve
    })
    const sent: string[] = []
    const badges: number[] = []
    const projector = new MailboxNotificationProjector({
      async setBadge(count) {
        badges.push(count)
      },
      async sendNotification(item) {
        sendStarted()
        await sendRelease
        sent.push(item.id)
        return "delivered"
      },
      canSendNotification: async () => true,
    })
    const initial = mailboxItem()
    const added = mailboxItem({ id: "message-2", createdAt: 2 })
    await projector.project([initial], () => true)

    let ownsOldProjection = true
    const oldProjection = projector.project([initial, added], () => ownsOldProjection)
    await sendStart
    ownsOldProjection = false
    const currentProjection = projector.project([initial, added], () => true)
    releaseSend()
    await Promise.all([oldProjection, currentProjection])

    expect(badges).toEqual([1, 2, 2])
    expect(sent).toEqual(["message-2"])
  })

  test("does not advance the baseline past a failed notification in a partial batch", async () => {
    const attempts: string[] = []
    let failMessageThree = true
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      async sendNotification(item) {
        attempts.push(item.id)
        if (item.id === "message-3" && failMessageThree) throw new Error("native send failed")
        return "delivered"
      },
      canSendNotification: async () => true,
    })
    const initial = mailboxItem()
    const messageTwo = mailboxItem({ id: "message-2", createdAt: 2 })
    const messageThree = mailboxItem({ id: "message-3", createdAt: 3 })
    await projector.project([initial], () => true)

    await expect(projector.project([initial, messageTwo, messageThree], () => true)).rejects.toThrow(
      "native send failed",
    )
    failMessageThree = false
    await projector.project([initial, messageTwo, messageThree], () => true)
    expect(attempts).toEqual(["message-2", "message-3", "message-3"])
  })

  test("keeps the notification baseline unchanged when permission lookup fails", async () => {
    const sent: string[] = []
    let permissionFails = false
    const projector = new MailboxNotificationProjector({
      setBadge: async () => undefined,
      sendNotification: async (item) => {
        sent.push(item.id)
        return "delivered"
      },
      async canSendNotification() {
        if (permissionFails) throw new Error("permission transport failed")
        return true
      },
    })
    const initial = mailboxItem()
    const added = mailboxItem({ id: "message-2", createdAt: 2 })
    await projector.project([initial], () => true)
    permissionFails = true
    await expect(projector.project([initial, added], () => true)).rejects.toThrow("permission transport failed")
    permissionFails = false
    await projector.project([initial, added], () => true)
    expect(sent).toEqual(["message-2"])
  })
})
