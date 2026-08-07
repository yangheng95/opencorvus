import { afterAll, afterEach, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { HostTransport, NativeCommand } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { installIconHtmlRenderer } from "../src/utils/icon-html"
import { setLocaleData } from "../src/utils/i18n"
;(globalThis as typeof globalThis & { __OPENCORVUS_OVERLAY_VERSION__?: string }).__OPENCORVUS_OVERLAY_VERSION__ = "test"

const { editorTargetPath, openDirectoryInEditor, openPathInSelectedEditor, openProjectFile } = await import(
  "../src/services/workspace"
)
const { applySettings, DEFAULT_SETTINGS } = await import("../src/store/settings")
const { pathBreadcrumb } = await import("../src/utils/dom-utils")

const disposeIconHtmlRenderer = installIconHtmlRenderer(({ name, size }) => {
  if (name !== "folder" && name !== "close") throw new Error(`Unknown test icon "${name}"`)
  return `<svg data-test-icon="${name}" width="${size}" height="${size}" aria-hidden="true"></svg>`
})

afterAll(() => {
  disposeIconHtmlRenderer()
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  applySettings(DEFAULT_SETTINGS)
})

function fakeTransport(calls: NativeCommand[]): HostTransport {
  return {
    kind: "tauri",
    async request() {
      throw new Error("request not expected")
    },
    openStream() {
      throw new Error("stream not expected")
    },
    async native(command) {
      calls.push(command)
      return true
    },
  }
}

test("openDirectoryInEditor routes the selected project editor through HostTransport", async () => {
  const calls: NativeCommand[] = []
  __setHostTransportForTest(fakeTransport(calls))

  await openDirectoryInEditor("vscode", "D:/workspace/app")

  expect(calls).toEqual([
    {
      kind: "workspace.openProjectEditor",
      editor: "vscode",
      path: "D:/workspace/app",
    },
  ])
})

test("openPathInSelectedEditor routes file links through the persisted top-right IDE", async () => {
  const calls: NativeCommand[] = []
  __setHostTransportForTest(fakeTransport(calls))
  applySettings({ ...DEFAULT_SETTINGS, projectEditor: "cursor" })

  await openPathInSelectedEditor("D:/workspace/app/src/main.ts")

  expect(calls).toEqual([
    {
      kind: "workspace.openProjectEditor",
      editor: "cursor",
      path: "D:/workspace/app/src/main.ts",
    },
  ])
})

test("openProjectFile resolves a relative deliverable and uses the operating system default application", async () => {
  const calls: NativeCommand[] = []
  __setHostTransportForTest(fakeTransport(calls))
  applySettings({ ...DEFAULT_SETTINGS, directory: "D:/workspace/app" })

  await openProjectFile("Tesla_财务模型_2026Q2.xlsx")

  expect(calls).toEqual([
    {
      kind: "open-path",
      path: "D:/workspace/app/Tesla_财务模型_2026Q2.xlsx",
    },
  ])
})

test("editorTargetPath resolves relative file links against the active directory", () => {
  applySettings({ ...DEFAULT_SETTINGS, directory: "D:/workspace/app" })

  expect(editorTargetPath("src/main.ts")).toBe("D:/workspace/app/src/main.ts")
  expect(editorTargetPath("C:/other/file.ts")).toBe("C:/other/file.ts")
})

test("editorTargetPath refuses unresolved relative file links without an active directory", () => {
  applySettings(DEFAULT_SETTINGS)

  expect(editorTargetPath("src/main.ts")).toBe("")
  expect(editorTargetPath("C:/other/file.ts")).toBe("C:/other/file.ts")
})

test("markdown file links no longer open the built-in workspace file preview", () => {
  const main = readFileSync(join(import.meta.dir, "../src/main.tsx"), "utf8")
  const filesPanel = readFileSync(join(import.meta.dir, "../src/components/FileChangesPanel.tsx"), "utf8")

  expect(main).toContain("openPathInSelectedEditor(path)")
  expect(main).toContain("openProjectFile(projectFilePath)")
  expect(main).not.toContain("openWorkspaceFile")
  expect(existsSync(join(import.meta.dir, "../src/components/WorkspacePanel.tsx"))).toBe(false)
  expect(filesPanel).not.toContain('kind: "file"')
  expect(filesPanel).not.toContain("FileViewPanel")
})

test("cwd breadcrumb keeps editor launchers out of the directory control", () => {
  setLocaleData("en-US", {
    "cwd.browse": "Switch Folder…",
    "cwd.open": "Reveal in File Manager",
    "cwd.open_in_editor": "Open in {{name}}",
    "cwd.choose_level": "Use this folder",
  })

  const html = pathBreadcrumb("D:/workspace/app", { browseDirectory: true, openDirectory: true })

  expect(html).not.toContain("data-path-editor")
  expect(html).not.toContain("Open in VS Code")
  expect(html).not.toContain("Open in PyCharm")
  expect(html).not.toContain(">VS<")
  expect(html).not.toContain(">Py<")
  expect(html).not.toContain('data-path-action="create"')
})

test("cwd breadcrumb renders only host-supported native path actions", () => {
  setLocaleData("en-US", {
    "cwd.browse": "Switch Folder…",
    "cwd.open": "Reveal in File Manager",
    "cwd.choose_level": "Use this folder",
  })

  const supported = pathBreadcrumb("D:/workspace/app", { browseDirectory: true, openDirectory: true })
  expect(supported).toContain('data-path-action="browse"')
  expect(supported).toContain("data-path-open=")
  expect(supported).toContain("data-path-set=")
  expect(supported.match(/data-current="true" aria-current="location"/g)?.length).toBe(1)
  expect(supported).not.toContain("aria-selected=")
  expect(supported).not.toContain("aria-pressed=")

  const unsupported = pathBreadcrumb("D:/workspace/app", { browseDirectory: false, openDirectory: false })
  expect(unsupported).not.toContain('data-path-action="browse"')
  expect(unsupported).not.toContain("data-path-open=")
  expect(unsupported).toContain("data-path-set=")
  expect(unsupported).toContain('class="task-dir-node"')
  expect(unsupported.match(/data-current="true" aria-current="location"/g)?.length).toBe(1)
  expect(unsupported).not.toContain("aria-selected=")
  expect(unsupported).not.toContain("aria-pressed=")
})
