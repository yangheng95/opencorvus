import { describe, expect, test } from "bun:test"
import {
  HOST_CAPABILITIES,
  type HostCapabilities,
  type HostKind,
  type NativeCommandKind,
} from "../src/services/host-transport"

const NATIVE_COMMAND_KINDS: NativeCommandKind[] = [
  "open-url",
  "open-path",
  "browserPreview.sync",
  "browserPreview.navigate",
  "browserPreview.navigateUrl",
  "browserPreview.close",
  "browserPreview.destroy",
  "browserPreview.selection.setEnabled",
  "browserPreview.selection.take",
  "browserPreview.currentPage",
  "browserPreview.setZoom",
  "clipboard.readText",
  "settings.load",
  "settings.save",
  "server.info",
  "server.restart",
  "devtools.toggle",
  "desktopUpdate.check",
  "desktopUpdate.download",
  "desktopUpdate.install",
  "window.quit",
  "workspace.pickDir",
  "workspace.pickFiles",
  "workspace.openProjectEditor",
  "notification.permission",
  "notification.requestPermission",
  "notification.send",
]

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
    expect(supported(HOST_CAPABILITIES.tauri)).toEqual(NATIVE_COMMAND_KINDS)
    expect(supported(HOST_CAPABILITIES.browser)).toEqual([
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
