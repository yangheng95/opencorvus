import { afterEach, describe, expect, test } from "bun:test"
import { createTauriTransport } from "../src/services/tauri-transport"

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
const originalNotification = Object.getOwnPropertyDescriptor(globalThis, "Notification")
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")

type Permission = "default" | "denied" | "granted"

function installNotificationHost(
  permission: Permission,
  invokeResult: (command: string, args?: Record<string, unknown>) => Promise<unknown> = async () => true,
  clipboardWrite: (text: string) => Promise<void> = async () => {},
) {
  const delivered: Array<{ title: string; options?: NotificationOptions }> = []
  const invocations: Array<{ command: string; args?: Record<string, unknown> }> = []
  class HostNotification {
    static permission: Permission = permission
    static async requestPermission(): Promise<Permission> {
      return HostNotification.permission
    }

    constructor(title: string, options?: NotificationOptions) {
      delivered.push({ title, options })
    }
  }

  Object.defineProperty(globalThis, "Notification", { configurable: true, value: HostNotification })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: clipboardWrite } },
  })
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      Notification: HostNotification,
      __TAURI__: {
        core: {
          async invoke(command: string, args?: Record<string, unknown>) {
            invocations.push({ command, args })
            return invokeResult(command, args)
          },
        },
      },
    },
  })
  return { HostNotification, delivered, invocations }
}

function restoreGlobal(
  name: "window" | "Notification" | "navigator",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else Reflect.deleteProperty(globalThis, name)
}

afterEach(() => {
  restoreGlobal("window", originalWindow)
  restoreGlobal("Notification", originalNotification)
  restoreGlobal("navigator", originalNavigator)
})

describe("notification host transports", () => {
  test("browser clipboard writes the exact diagnostic text through the browser host", async () => {
    const writes: string[] = []
    installNotificationHost("granted", undefined, async (text) => {
      writes.push(text)
    })
    const transport = createTauriTransport("browser")

    await transport.native({ kind: "clipboard.writeText", text: "bridge diagnostic" })
    expect(writes).toEqual(["bridge diagnostic"])
  })

  test("Tauri clipboard maps exact text to the registered native command and propagates native failure", async () => {
    let rejectClipboard = false
    const { invocations } = installNotificationHost("granted", async (command) => {
      if (command === "overlay_clipboard_write_text" && rejectClipboard) {
        throw new Error("native clipboard unavailable")
      }
      return true
    })
    const transport = createTauriTransport("tauri")

    expect(await transport.native({ kind: "clipboard.writeText", text: "bridge diagnostic" })).toBe(true)
    rejectClipboard = true
    await expect(transport.native({ kind: "clipboard.writeText", text: "second diagnostic" })).rejects.toThrow(
      "native clipboard unavailable",
    )
    expect(invocations).toEqual([
      { command: "overlay_clipboard_write_text", args: { text: "bridge diagnostic" } },
      { command: "overlay_clipboard_write_text", args: { text: "second diagnostic" } },
    ])
  })

  test("browser reports accepted delivery only while Web Notification permission remains granted", async () => {
    const { HostNotification, delivered } = installNotificationHost("granted")
    const transport = createTauriTransport("browser")

    expect(await transport.native({ kind: "notification.permission" })).toBe("granted")
    expect(
      await transport.native({
        kind: "notification.send",
        title: "Mailbox notice",
        body: "Browser delivery",
        tag: "mailbox-browser",
      }),
    ).toBe(true)
    expect(delivered).toEqual([
      { title: "Mailbox notice", options: { body: "Browser delivery", tag: "mailbox-browser" } },
    ])

    HostNotification.permission = "denied"
    expect(await transport.native({ kind: "notification.send", title: "Lost permission", tag: "mailbox-denied" })).toBe(
      false,
    )
    expect(delivered).toHaveLength(1)
  })

  test("Tauri distinguishes denied permission and reports accepted native delivery", async () => {
    const { HostNotification, delivered, invocations } = installNotificationHost("denied")
    const transport = createTauriTransport("tauri")

    expect(await transport.native({ kind: "notification.permission" })).toBe("denied")
    expect(await transport.native({ kind: "notification.send", title: "Denied" })).toBe(false)

    HostNotification.permission = "granted"
    expect(await transport.native({ kind: "notification.permission" })).toBe("granted")
    expect(
      await transport.native({
        kind: "notification.send",
        title: "Mailbox attention",
        body: "Tauri delivery",
        tag: "mailbox-tauri",
      }),
    ).toBe(true)
    expect(delivered).toEqual([])
    expect(invocations).toEqual([
      {
        command: "overlay_notification_send",
        args: { title: "Mailbox attention", body: "Tauri delivery" },
      },
    ])
  })

  test("Tauri propagates a rejected native toast instead of recording false delivery", async () => {
    const { invocations } = installNotificationHost("granted", async () => {
      throw new Error("Windows toast submission failed")
    })
    const transport = createTauriTransport("tauri")

    await expect(
      transport.native({
        kind: "notification.send",
        title: "Mailbox attention",
        body: "Native failure",
        tag: "mailbox-tauri",
      }),
    ).rejects.toThrow("Windows toast submission failed")
    expect(invocations).toEqual([
      {
        command: "overlay_notification_send",
        args: { title: "Mailbox attention", body: "Native failure" },
      },
    ])
  })

  test("both browser and Tauri permission requests preserve the host result", async () => {
    const { HostNotification } = installNotificationHost("default")
    const browser = createTauriTransport("browser")
    const tauri = createTauriTransport("tauri")

    expect(await browser.native({ kind: "notification.requestPermission" })).toBe("default")
    HostNotification.permission = "granted"
    expect(await tauri.native({ kind: "notification.requestPermission" })).toBe("granted")
  })
})
