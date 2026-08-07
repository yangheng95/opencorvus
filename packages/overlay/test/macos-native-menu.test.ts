import { describe, expect, test } from "bun:test"
import { usesNativeMacosMenu } from "../src/services/native-menu"

describe("macOS native application menu ownership", () => {
  test("selects AppKit only for the native macOS host", () => {
    expect(usesNativeMacosMenu("darwin", "tauri", true)).toBe(true)
    expect(usesNativeMacosMenu("darwin", "tauri", false)).toBe(false)
    for (const [platform, host] of [
      ["darwin", "browser"],
      ["darwin", "vscode"],
      ["linux", "tauri"],
      ["win32", "tauri"],
    ] as const) {
      expect(usesNativeMacosMenu(platform, host, true)).toBe(false)
    }
  })
})
