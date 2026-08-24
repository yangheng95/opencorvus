import { describe, expect, test } from "bun:test"
import {
  HOST_CAPABILITIES,
  type HostCapabilities,
  type HostKind,
  NATIVE_COMMAND_KINDS,
  type NativeCommandKind,
} from "../src/services/host-transport"

function supported(capabilities: HostCapabilities): NativeCommandKind[] {
  return NATIVE_COMMAND_KINDS.filter((kind) => capabilities.nativeCommands[kind])
}

describe("HostTransport capability contract", () => {
  test("every host declares the same exhaustive NativeCommand key set", () => {
    for (const kind of ["tauri", "browser"] satisfies HostKind[]) {
      expect(Object.keys(HOST_CAPABILITIES[kind].nativeCommands).sort()).toEqual([...NATIVE_COMMAND_KINDS].sort())
    }
  })

  test("capability matrix matches implemented native command surfaces", () => {
    expect(supported(HOST_CAPABILITIES.tauri)).toEqual([...NATIVE_COMMAND_KINDS])
    // open-url is implemented on the browser branch of tauri-transport.
    expect(supported(HOST_CAPABILITIES.browser)).toEqual([
      "open-url",
      "clipboard.writeText",
      "settings.load",
      "settings.save",
      "notification.permission",
      "notification.requestPermission",
      "notification.send",
    ])
    expect(HOST_CAPABILITIES.tauri.ui.desktopNotificationsRequirePermission).toBe(true)
    expect(HOST_CAPABILITIES.browser.ui.desktopNotificationsRequirePermission).toBe(true)
  })
})
