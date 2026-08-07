import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const REPO_ROOT = join(OVERLAY_ROOT, "..", "..")

function overlay(relativePath: string): string {
  return readFileSync(join(OVERLAY_ROOT, relativePath), "utf8")
}

test("the legacy notification UI surface and state owners are retired", () => {
  for (const relativePath of [
    "src/components/NotificationCenter.tsx",
    "src/services/notification-state.ts",
    "src/services/notify.ts",
    "src/styles/surfaces/notifications.css",
  ]) {
    expect(existsSync(join(OVERLAY_ROOT, relativePath))).toBe(false)
  }

  expect(overlay("src/components/App.tsx")).not.toContain("NotificationCenter")
  expect(overlay("src/index.html")).not.toContain("notifications.css")
  expect(overlay("src/components/settings/GeneralPanel.tsx")).toContain("desktopNotifications")
  expect(overlay("src/store/settings.ts")).toContain("desktopNotifications")
})

test("frontend transports retain agent badge and OS notifications but retire tray attention", () => {
  const surfaces = [
    overlay("src/services/host-transport.ts"),
    overlay("src/services/tauri-transport.ts"),
    readFileSync(join(REPO_ROOT, "packages/transport-protocol/src/index.ts"), "utf8"),
  ]

  for (const command of ["notification.permission", "notification.requestPermission", "notification.send"]) {
    for (const surface of surfaces) expect(surface).toContain(command)
  }
  for (const surface of surfaces) expect(surface).toContain("badge.set")
  for (const surface of surfaces) expect(surface).not.toContain("tray.attention.set")
  expect(overlay("package.json")).toContain("@tauri-apps/plugin-notification")
})

test("backend-owned Mailbox presentation is the notification source while event routing is retired", () => {
  const diagnostics = overlay("src/services/diagnostics.ts")
  const events = overlay("src/services/events.ts")
  const mailbox = overlay("src/components/MailboxPanel.tsx")
  const desktopNotifications = overlay("src/services/desktop-notifications.ts")
  const tauriMain = overlay("src-tauri/src/main.rs")

  expect(diagnostics).toContain('AppLog[level]("ui", input.title')
  expect(events).not.toContain("routeDesktopNotification")
  expect(events).not.toContain("notification.send")
  expect(mailbox).toContain('item.category === "notification"')
  expect(mailbox).toContain("projectMailboxNotifications")
  expect(desktopNotifications).toContain("item.archivedAt === undefined && item.readAt === undefined")
  expect(desktopNotifications).toContain("await ensureDesktopNotificationPermission()")
  expect(desktopNotifications).not.toContain("AGENT_MAILBOX_EVENT_TYPE")
  expect(desktopNotifications).not.toContain("item.eventType ===")
  expect(desktopNotifications).not.toContain("event.notify")
  expect(overlay("src/i18n/en-US.json")).not.toContain('"notify.event.')
  expect(overlay("src/i18n/en-US.json")).toContain('"mailbox.category.notification"')
  expect(tauriMain).toContain("tauri_plugin_notification::NotificationExt")
  expect(tauriMain).toContain("fn overlay_notification_send")
  expect(tauriMain).toContain("winrt_toast_reborn::{register, Toast, ToastManager}")
  expect(tauriMain).toContain("ToastManager::new")
  expect(tauriMain).toContain(".show(&toast)")
  expect(tauriMain).toContain("product_name")
  expect(tauriMain).not.toContain("unwrap_or(application_id)")
  expect(overlay("src/services/tauri-transport.ts")).toContain('invokeTauri("overlay_notification_send"')
  expect(overlay("src/services/tauri-transport.ts")).not.toContain("tauriSendNotification")
  expect(overlay("src-tauri/Cargo.toml")).toContain('winrt-toast-reborn = "0.3.8"')
  expect(tauriMain).toContain("native startup failure notification failed")
})
