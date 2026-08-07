/**
 * Theme isolation guard — `cascade/vscode-dark.css` is an Overlay-owned
 * fixed palette, not a VS Code host-token passthrough.
 *
 * Regression covered here: the 2026-05-07 passthrough change let arbitrary
 * editor theme variables recolor Overlay menus. All Overlay themes must be
 * selectable and deterministic in Tauri, browser, and VS Code webview hosts.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const CASCADE_DIR = join(import.meta.dir, "..", "src", "styles", "cascade")

function readCascade(name: string): string {
  return readFileSync(join(CASCADE_DIR, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
}

function themeToken(css: string, token: string): string {
  const match = css.match(new RegExp(`${token.replace(/-/g, "\\-")}\\s*:\\s*([^;]+);`))
  if (!match) throw new Error(`Missing ${token}`)
  return match[1]!.trim()
}

const VSCODE_DARK = readCascade("vscode-dark.css")
const DARK = readCascade("dark.css")
const LIGHT = readCascade("light.css")

describe("vscode-dark overlay palette — no host-token passthrough", () => {
  test("does not reference VS Code host variables", () => {
    expect([...VSCODE_DARK.matchAll(/var\(\s*--vscode-/g)].map((m) => m[0])).toEqual([])
    expect(VSCODE_DARK).not.toContain("--vscode-")
  })

  test("semantic anchors are fixed opaque Overlay values", () => {
    expect(themeToken(VSCODE_DARK, "--bg")).toBe("rgb(30, 30, 30)")
    expect(themeToken(VSCODE_DARK, "--surface")).toBe("rgb(37, 37, 38)")
    expect(themeToken(VSCODE_DARK, "--surface-inset")).toBe("rgb(24, 24, 24)")
    expect(themeToken(VSCODE_DARK, "--chrome")).toBe("rgb(60, 60, 60)")
    expect(themeToken(VSCODE_DARK, "--text")).toBe("#d6d6d6")
    expect(themeToken(VSCODE_DARK, "--accent")).toBe("#007acc")
    expect(themeToken(VSCODE_DARK, "--menu-panel-bg")).toBe("rgb(31, 31, 31)")
  })
})

describe("dark.css and light.css — no VS Code coupling", () => {
  test("cascade/dark.css does not reference var(--vscode-*)", () => {
    expect([...DARK.matchAll(/var\(\s*--vscode-/g)].map((m) => m[0])).toEqual([])
  })

  test("cascade/light.css does not reference var(--vscode-*)", () => {
    expect([...LIGHT.matchAll(/var\(\s*--vscode-/g)].map((m) => m[0])).toEqual([])
  })
})
