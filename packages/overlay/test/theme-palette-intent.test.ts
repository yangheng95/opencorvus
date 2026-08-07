import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const STYLES_ROOT = join(import.meta.dir, "..", "src", "styles", "cascade")
const DESIGN_LANGUAGE_PATH = join(import.meta.dir, "..", "src", "styles", "tokens", "design-language.css")

function readTheme(name: string): string {
  return readFileSync(join(STYLES_ROOT, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
}

function themeToken(css: string, token: string): string {
  const pattern = new RegExp(`${token.replace(/-/g, "\\-")}\\s*:\\s*([^;]+);`)
  const match = css.match(pattern)
  if (!match) throw new Error(`Missing ${token}`)
  return match[1]!.trim()
}

describe("overlay theme palette intent", () => {
  const dark = readTheme("dark.css")
  const light = readTheme("light.css")
  const vscodeDark = readTheme("vscode-dark.css")
  const designLanguage = readFileSync(DESIGN_LANGUAGE_PATH, "utf8")

  test("dark keeps the April-mid historical Overlay palette", () => {
    expect(themeToken(dark, "--bg")).toBe("rgb(26, 27, 30)")
    expect(themeToken(dark, "--surface")).toBe("rgb(38, 40, 44)")
    expect(themeToken(dark, "--surface-inset")).toBe("rgb(31, 33, 37)")
    expect(themeToken(dark, "--dialog-bg")).toBe("rgb(40, 42, 46)")
    expect(themeToken(dark, "--menu-panel-bg")).toBe("rgb(32, 34, 38)")
    expect(themeToken(dark, "--accent")).toBe("#5b8def")
    expect(themeToken(dark, "--accent-start")).toBe("#5b8def")
    expect(themeToken(dark, "--accent-mid")).toBe("#5b8def")
    expect(themeToken(dark, "--accent-end")).toBe("#4a7de0")
  })

  test("vscode dark is an Overlay-owned fixed palette", () => {
    expect(themeToken(vscodeDark, "--bg")).toBe("rgb(30, 30, 30)")
    expect(themeToken(vscodeDark, "--surface")).toBe("rgb(37, 37, 38)")
    expect(themeToken(vscodeDark, "--dialog-bg")).toBe("rgb(37, 37, 38)")
    expect(themeToken(vscodeDark, "--menu-panel-bg")).toBe("rgb(31, 31, 31)")
    expect(vscodeDark).not.toContain("--vscode-")
    expect(vscodeDark).not.toContain("#1f2339")
    expect(vscodeDark).not.toContain("rgba(31, 35, 57")
    expect(vscodeDark).not.toContain("#1c213a")
    expect(vscodeDark).not.toContain("rgba(28, 33, 58")
  })

  test("light theme follows the Codex reference neutral rail and near-white canvas", () => {
    const materialTokens = [
      ["--bg", "rgb(244, 244, 244)"],
      ["--surface", "rgb(255, 255, 255)"],
      ["--surface-hover", "rgb(240, 240, 240)"],
      ["--surface-inset", "rgb(244, 244, 245)"],
      ["--surface-strong", "rgb(255, 255, 255)"],
      ["--rail-surface", "rgb(247, 247, 247)"],
      ["--chat-canvas", "rgb(255, 255, 255)"],
      ["--inspector-surface", "var(--chat-canvas)"],
      ["--panel-body-bg", "var(--rail-surface)"],
      ["--chrome", "rgb(247, 247, 247)"],
      ["--dialog-bg", "rgb(255, 255, 255)"],
      ["--menu-panel-bg", "rgb(255, 255, 255)"],
    ] as const

    for (const [token, value] of materialTokens) {
      expect(themeToken(light, token)).toBe(value)
    }

    // The hover surface must sit *below* every resting material it can
    // appear on (surface 255, rail 247, bg 244) so a pointer never
    // brightens a control relative to its own background.
    expect(themeToken(light, "--surface-hover")).toBe("rgb(240, 240, 240)")

    const railBackgroundImage = themeToken(light, "--rail-background-image").replace(/\s+/g, " ")
    expect(railBackgroundImage).toStartWith("linear-gradient( 180deg,")
    for (const stop of [
      "rgb(239, 247, 249) 0%",
      "rgb(247, 246, 245) 48%",
      "rgb(249, 245, 242) 64%",
      "rgb(239, 248, 244) 100%",
    ]) {
      expect(railBackgroundImage).toContain(stop)
    }

    expect(themeToken(light, "--body-bg")).toBe("var(--rail-surface)")
    expect(themeToken(dark, "--rail-background-image")).toBe("none")
    expect(themeToken(vscodeDark, "--rail-background-image")).toBe("none")
    expect(themeToken(light, "--workspace-ambient-fill")).toBe("var(--chat-canvas)")
    expect(light).not.toContain("radial-gradient")
    expect(themeToken(light, "--text")).toBe("#343a3d")
    expect(themeToken(light, "--text-strong")).toBe("#181b1d")
    expect(themeToken(light, "--text-soft")).toBe("#454c4f")
    expect(themeToken(light, "--text-muted")).toBe("#596164")
    expect(themeToken(light, "--border")).toBe("rgba(32, 38, 40, 0.14)")
    expect(themeToken(light, "--border-strong")).toBe("rgba(32, 38, 40, 0.22)")
    expect(themeToken(light, "--accent")).toBe("#0969da")
    expect(themeToken(light, "--accent-hover")).toBe("#0757b3")

    for (const retired of [
      "rgb(241, 235, 224)",
      "rgb(251, 248, 241)",
      "rgb(246, 240, 229)",
      "rgb(244, 238, 226)",
      "rgb(250, 246, 239)",
      "rgb(247, 242, 233)",
      "rgb(243, 240, 235)",
      "rgb(252, 250, 247)",
      "rgb(247, 244, 239)",
      "rgb(244, 241, 235)",
      "rgb(254, 253, 250)",
      "rgb(246, 243, 238)",
      "rgb(254, 253, 251)",
      "rgb(249, 247, 243)",
    ]) {
      expect(light).not.toContain(retired)
    }
  })

  test("all themes share one rail/workspace/dock material topology", () => {
    for (const theme of [dark, light, vscodeDark]) {
      expect(themeToken(theme, "--body-bg")).toBe("var(--rail-surface)")
      expect(themeToken(theme, "--panel-body-bg")).toBe("var(--rail-surface)")
      expect(themeToken(theme, "--workspace-ambient-fill")).toBe("var(--chat-canvas)")
      expect(themeToken(theme, "--inspector-surface")).toBe("var(--chat-canvas)")
    }
  })

  test("all themes keep shell backing materials opaque", () => {
    const themes = [
      ["dark", dark],
      ["light", light],
      ["vscode-dark", vscodeDark],
    ] as const
    const backingTokens = [
      "--bg",
      "--surface",
      "--surface-hover",
      "--surface-inset",
      "--surface-strong",
      "--rail-surface",
      "--chat-canvas",
      "--inspector-surface",
      "--body-bg",
      "--panel-body-bg",
      "--chrome",
    ]
    const violations: string[] = []

    for (const [themeName, css] of themes) {
      for (const token of backingTokens) {
        const value = resolveThemeValue(css, themeToken(css, token))
        if (!isOpaqueBackdrop(value)) {
          violations.push(`${themeName} ${token}: ${value}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  test("retired card-shadow theme tokens stay removed", () => {
    for (const css of [dark, light, vscodeDark]) {
      expect(css).not.toContain("--guide-card-")
      expect(css).not.toContain("--hover-accent-shadow")
    }
  })

  test("popup window backing materials are opaque", () => {
    const themes = [
      ["dark", dark],
      ["light", light],
      ["vscode-dark", vscodeDark],
    ] as const
    const popupTokens = ["--dialog-bg", "--menu-panel-bg"]
    const violations: string[] = []

    for (const [themeName, css] of themes) {
      for (const token of popupTokens) {
        const value = resolveThemeValue(css, themeToken(css, token))
        if (!isOpaqueColor(value)) {
          violations.push(`${themeName} ${token}: ${value}`)
        }
      }
    }

    expect(violations).toEqual([])
    for (const css of [dark, light, vscodeDark]) expect(css).not.toContain("--executor-menu-bg")
  })

  test("light popup foreground tokens keep secondary and warning text readable", () => {
    const popupBackground = toRgba(resolveThemeValue(light, themeToken(light, "--menu-panel-bg")))
    const warnDim = composite(toRgba(resolveThemeValue(light, themeToken(light, "--warn-dim"))), popupBackground)
    const accentDim = colorMixWithTransparentToRgba(
      light,
      resolveThemeValue(light, themeToken(light, "--accent-dim")),
      popupBackground,
    )

    expect(contrastRatio(toRgba(themeToken(light, "--text-soft")), popupBackground)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(toRgba(themeToken(light, "--text-muted")), popupBackground)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(toRgba(themeToken(light, "--warn")), popupBackground)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(toRgba(themeToken(light, "--warn")), warnDim)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(toRgba(themeToken(light, "--accent")), accentDim)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(toRgba(themeToken(light, "--text-muted")), accentDim)).toBeGreaterThanOrEqual(4.5)
  })

  test("compact text tiers remain readable on every theme surface", () => {
    const themes = [
      ["dark", dark],
      ["light", light],
      ["vscode-dark", vscodeDark],
    ] as const
    const textTokens = ["--text", "--text-strong", "--text-soft", "--text-muted"] as const
    const surfaceTokens = ["--bg", "--surface", "--surface-hover", "--surface-inset", "--surface-strong"] as const
    const violations: string[] = []

    for (const [themeName, css] of themes) {
      for (const textToken of textTokens) {
        const foreground = toRgba(themeToken(css, textToken))
        for (const surfaceToken of surfaceTokens) {
          const background = toRgba(resolveThemeValue(css, themeToken(css, surfaceToken)))
          const contrast = contrastRatio(foreground, background)
          if (contrast < 4.5) {
            violations.push(`${themeName} ${textToken} on ${surfaceToken}: ${contrast.toFixed(2)}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  test("Markdown syntax tokens are theme-scoped and readable on code surfaces", () => {
    const themes = [
      ["dark", dark],
      ["light", light],
      ["vscode-dark", vscodeDark],
    ] as const
    const syntaxTokens = [
      "--oc-syntax-keyword",
      "--oc-syntax-string",
      "--oc-syntax-comment",
      "--oc-syntax-number",
      "--oc-syntax-function",
      "--oc-syntax-variable",
      "--oc-syntax-meta",
      "--oc-syntax-addition-text",
      "--oc-syntax-deletion-text",
    ]
    const violations: string[] = []

    expect(designLanguage).not.toMatch(/--oc-syntax-[a-z-]+\s*:/)

    for (const [themeName, css] of themes) {
      const windowBacking = composite(toRgba(resolveThemeValue(css, themeToken(css, "--bg"))), {
        r: 255,
        g: 255,
        b: 255,
        a: 1,
      })
      const contentSurface = composite(toRgba(resolveThemeValue(css, themeToken(css, "--surface"))), windowBacking)
      const codeSurface = composite(toRgba(resolveThemeValue(css, themeToken(css, "--surface-inset"))), contentSurface)
      for (const token of syntaxTokens) {
        const contrast = contrastRatio(toRgba(resolveThemeValue(css, themeToken(css, token))), codeSurface)
        if (contrast < 4.5) violations.push(`${themeName} ${token}: ${contrast}`)
      }
    }

    expect(violations).toEqual([])
  })
})

function resolveThemeValue(css: string, value: string, seen = new Set<string>()): string {
  return value.replace(/var\(\s*(--[a-z][a-z0-9-]*)\s*\)/gi, (raw, token: string) => {
    if (seen.has(token)) return `var(${token})`
    const local = themeTokenOptional(css, token)
    // Some supporting tokens still live outside the theme file. Leave those
    // cross-file var() references intact instead of throwing.
    if (local === null) return raw
    seen.add(token)
    const resolved = resolveThemeValue(css, local, seen)
    seen.delete(token)
    return resolved
  })
}

function themeTokenOptional(css: string, token: string): string | null {
  const pattern = new RegExp(`${token.replace(/-/g, "\\-")}\\s*:\\s*([^;]+);`)
  const match = css.match(pattern)
  return match ? match[1]!.trim() : null
}

function isOpaqueBackdrop(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (/var\(--ui-window-opacity\)/i.test(normalized)) return false
  if (/\brgba\(/i.test(normalized) || /\bhsla\(/i.test(normalized) || /\btransparent\b/i.test(normalized)) {
    return false
  }
  if (/^linear-gradient\(/i.test(normalized)) {
    return /\brgb\(/i.test(normalized) || /#[0-9a-f]{6}\b/i.test(normalized)
  }
  return isOpaqueColor(normalized)
}

function isOpaqueColor(value: string): boolean {
  return /\brgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i.test(value) || /#[0-9a-f]{6}\b/i.test(value)
}

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

function toRgba(value: string): Rgba {
  const normalized = value.trim().toLowerCase()
  const hex = normalized.match(/^#([0-9a-f]{6})$/)
  if (hex) {
    const raw = hex[1]!
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
      a: 1,
    }
  }
  const rgb = normalized.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const parts = rgb[1]!.split(",").map((part) => Number.parseFloat(part.trim()))
    const [r, g, b] = parts
    const a = parts.length >= 4 ? parts[3] : 1
    if (![r, g, b, a].every(Number.isFinite)) throw new Error(`Invalid color ${value}`)
    return { r, g, b, a: a! }
  }
  throw new Error(`Unsupported color ${value}`)
}

function colorMixWithTransparentToRgba(css: string, value: string, background: Rgba): Rgba {
  const match = value.trim().match(/^color-mix\(\s*in\s+srgb\s*,\s*([^,]+?)\s+([0-9.]+)%\s*,\s*transparent\s*\)$/i)
  if (!match) throw new Error(`Unsupported transparent color-mix ${value}`)
  const color = toRgba(resolveThemeValue(css, match[1]!.trim()))
  color.a = Number.parseFloat(match[2]!) / 100
  if (!Number.isFinite(color.a)) throw new Error(`Invalid color-mix percent ${value}`)
  return composite(color, background)
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.a + background.a * (1 - foreground.a)
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a: alpha,
  }
}

function colorChannel(value: number): number {
  const scaled = value / 255
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(color: Rgba): number {
  return 0.2126 * colorChannel(color.r) + 0.7152 * colorChannel(color.g) + 0.0722 * colorChannel(color.b)
}

function contrastRatio(foreground: Rgba, background: Rgba): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}
