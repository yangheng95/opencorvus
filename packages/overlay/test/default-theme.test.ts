import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

describe("overlay default theme", () => {
  test("settings and sanitizers default to reference light style", async () => {
    const settings = await fs.readFile(path.join(import.meta.dir, "..", "src", "store", "settings.ts"), "utf8")
    const theme = await fs.readFile(path.join(import.meta.dir, "..", "src", "services", "theme.ts"), "utf8")
    const registry = await fs.readFile(path.join(import.meta.dir, "..", "src", "services", "theme-registry.ts"), "utf8")
    expect(registry).toContain('export const DEFAULT_THEME_ID: OverlayThemeID = "light"')
    expect(settings).toContain("export const DEFAULT_THEME = DEFAULT_THEME_ID")
    expect(settings).toContain("theme: DEFAULT_THEME")
    expect(theme).toContain("return sanitizeThemeForHost(value)")
  })

  test("pre-render theme bootstrap uses static light attributes without inline writes", async () => {
    const html = await fs.readFile(path.join(import.meta.dir, "..", "src", "index.html"), "utf8")
    expect(html).toContain('<html lang="en-US" data-theme="light">')
    expect(html).toContain('<body data-page="overlay">')
    expect(html).not.toContain("document.documentElement.dataset.theme")
    expect(html).not.toContain("document.body.dataset.theme")
  })

  test("cascade theme files are on the runtime path", async () => {
    const html = await fs.readFile(path.join(import.meta.dir, "..", "src", "index.html"), "utf8")
    for (const theme of ["light", "dark", "vscode-dark"]) {
      expect(html).toContain(`styles/cascade/${theme}.css`)
    }
    expect(html).toContain("styles/cascade/base.css")
  })

  test("applyTheme writes only the root palette attribute", async () => {
    const source = await fs.readFile(path.join(import.meta.dir, "..", "src", "services", "theme.ts"), "utf8")
    expect(source).toContain("document.documentElement.dataset.theme = effective")
    expect(source).not.toContain("document.body.dataset.theme")
  })

  test("retired prompt draft state stays absent", async () => {
    const app = await fs.readFile(path.join(import.meta.dir, "..", "src", "store", "app.ts"), "utf8")
    const workspace = await fs.readFile(path.join(import.meta.dir, "..", "src", "services", "workspace.ts"), "utf8")
    expect(app).not.toContain("promptDrafts")
    expect(workspace).not.toContain("promptDrafts")
  })

  test("main theme effect waits for settings hydration before first apply", async () => {
    const source = await fs.readFile(path.join(import.meta.dir, "..", "src", "main.tsx"), "utf8")
    expect(source).toContain("const [settingsHydrated, setSettingsHydrated] = createSignal(false)")
    expect(source).toContain("if (!settingsHydrated()) return")
    expect(source).toContain("onSettingsLoaded:")
    expect(source).toContain("setSettingsHydrated(true)")
  })
})
