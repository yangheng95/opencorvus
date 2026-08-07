import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  HOST_CAPABILITIES,
  type HostCapabilities,
  type HostKind,
  type NativeCommandKind,
} from "../src/services/host-transport"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")

function read(relativePath: string): string {
  return readFileSync(path.join(OVERLAY_ROOT, relativePath), "utf8")
}

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
  "settings.load",
  "settings.save",
  "config.write-file",
  "server.info",
  "server.restart",
  "devtools.toggle",
  "window.quit",
  "badge.set",
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
  test("transport contracts, runtime selection, and API state remain acyclic", () => {
    const contract = read("src/services/host-transport.ts")
    const runtime = read("src/services/host-transport-runtime.ts")
    const tauri = read("src/services/tauri-transport.ts")

    expect(contract).not.toContain('from "./tauri-transport"')
    expect(contract).not.toContain('from "./vscode-transport"')
    expect(runtime).toContain('from "./tauri-transport"')
    expect(runtime).not.toContain('from "./vscode-transport"')
    expect(tauri).toContain('from "./api-state"')
    expect(tauri).not.toContain('from "./api"')
  })

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

  test("native picker commands use async dispatch and reject malformed path payloads", () => {
    const workspace = read("src/services/workspace.ts")
    const tauriMain = read("src-tauri/src/main.rs")

    expect(workspace).toContain('throw new Error("workspace.pickDir returned a non-string payload")')
    expect(workspace).toContain('throw new Error("workspace.pickFiles returned a non-string-array payload")')
    expect(tauriMain).toContain('"picked directory is not a filesystem path"')
    expect(tauriMain).toContain('"picked file is not a filesystem path"')
    expect(tauriMain).toContain("async fn overlay_pick_dir<R: Runtime>(")
    expect(tauriMain).toContain("async fn overlay_pick_files<R: Runtime>(")
    expect(tauriMain).not.toMatch(/#\[tauri::command\]\s+fn overlay_pick_(?:dir|files)</)
    expect(tauriMain).toContain(") -> Result<Vec<String>, String>")
    expect(tauriMain).toContain("multiple: Option<bool>")
    expect(tauriMain).toContain("blocking_pick_file()")
    expect(tauriMain).not.toContain("fall back to display string")
    expect(tauriMain).not.toContain("item_back.to_string()")
    expect(tauriMain).not.toContain("if let Ok(path) = entry.into_path()")
    expect(tauriMain).not.toContain("struct PickedFile")
    expect(tauriMain).not.toContain("mime_from_ext")
    expect(tauriMain).not.toContain("cancelled/no-op pick")
    expect(tauriMain).not.toContain("norm(picked_path) == norm(start_path)")
  })
})
