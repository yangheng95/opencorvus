import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const BUTTON_SOURCE = join(import.meta.dir, "../src/components/ui/Button.tsx")
const BUTTON_CSS = join(import.meta.dir, "../src/styles/primitives/button.css")
const THEME_CSS = [
  join(import.meta.dir, "../src/styles/cascade/light.css"),
  join(import.meta.dir, "../src/styles/cascade/dark.css"),
  join(import.meta.dir, "../src/styles/cascade/vscode-dark.css"),
]

function sourceArray(source: string, name: string): string[] {
  const match = source.match(new RegExp(`export const ${name} = \\[([^\\]]+)\\] as const`))
  expect(match).not.toBeNull()
  return match![1]!
    .split(",")
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
}

function cssDataValues(css: string, attr: "variant" | "size" | "tone"): string[] {
  return Array.from(
    new Set(
      Array.from(css.matchAll(new RegExp(`\\.oc-button\\[data-${attr}="([^"]+)"\\]`, "g"))).map((match) => match[1]!),
    ),
  ).sort()
}

test("Button primitive exposes the canonical data-attribute contract", () => {
  const source = readFileSync(BUTTON_SOURCE, "utf8")

  expect(source).toContain('export const BUTTON_VARIANTS = ["solid", "outline", "ghost"] as const')
  expect(source).toContain('export const BUTTON_SIZES = ["mini", "sm", "md", "control", "icon"] as const')
  expect(source).toContain('export const BUTTON_TONES = ["neutral", "accent", "danger"] as const')
  expect(source).toContain("export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]")
  expect(source).toContain("export type ButtonSize = (typeof BUTTON_SIZES)[number]")
  expect(source).toContain("export type ButtonTone = (typeof BUTTON_TONES)[number]")
  expect(source).toContain("export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement>")
  expect(source).toContain("variant: ButtonVariant")
  expect(source).toContain("size: ButtonSize")
  expect(source).toContain("tone: ButtonTone")
  expect(source).toContain('splitProps(props, ["variant", "size", "tone", "class"])')
  expect(source).toContain('const className = () => (local.class ? `oc-button ${local.class}` : "oc-button")')
  expect(source).toContain("class={className()}")
  expect(source).toContain("data-variant={local.variant}")
  expect(source).toContain("data-size={local.size}")
  expect(source).toContain("data-tone={local.tone}")
  expect(source).not.toContain('Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class" | "classList">')
  expect(source).not.toMatch(/\b(?:btn|chat-send|titlebar-btn|sidebar-btn|right-panel-tab|executor-chip)\b/)
})

test("Button primitive TypeScript API and CSS data variants stay in lockstep", () => {
  const source = readFileSync(BUTTON_SOURCE, "utf8")
  const css = readFileSync(BUTTON_CSS, "utf8")

  expect(cssDataValues(css, "variant")).toEqual(sourceArray(source, "BUTTON_VARIANTS").sort())
  expect(cssDataValues(css, "size")).toEqual(sourceArray(source, "BUTTON_SIZES").sort())
  expect(cssDataValues(css, "tone")).toEqual(sourceArray(source, "BUTTON_TONES").sort())
})

test("Button solid primary tones use Codex strong-neutral chrome while danger stays semantic", () => {
  const css = readFileSync(BUTTON_CSS, "utf8")
  const themes = THEME_CSS.map((file) => [file, readFileSync(file, "utf8")] as const)

  for (const tone of ["neutral", "accent", "danger"]) {
    expect(css).toContain(`.oc-button[data-variant="solid"][data-tone="${tone}"]`)
  }
  for (const [file, themeCss] of themes) {
    expect(themeCss, file).toMatch(/--text-on-strong:\s*#[0-9a-fA-F]{6};/)
    expect(themeCss, file).toMatch(/--text-on-accent:\s*#[0-9a-fA-F]{6};/)
    expect(themeCss, file).toMatch(/--text-on-danger:\s*#[0-9a-fA-F]{6};/)
  }
  expect(css).toMatch(
    /\.oc-button\[data-variant="solid"\]\[data-tone="neutral"\],\s*\.oc-button\[data-variant="solid"\]\[data-tone="accent"\]\s*\{[^}]*--oc-button-bg:\s*var\(--text-strong\);[^}]*--oc-button-color:\s*var\(--text-on-strong\);/s,
  )
  expect(css).toMatch(
    /\.oc-button\[data-variant="solid"\]\[data-tone="danger"\]\s*\{[^}]*--oc-button-color:\s*var\(--text-on-danger\);/s,
  )
  expect(css).toMatch(
    /\.oc-button\[data-variant="solid"\]\[data-tone="neutral"\]:hover,[\s\S]*?\.oc-button\[data-variant="solid"\]\[data-tone="accent"\]:focus-visible\s*\{[^}]*--oc-button-bg:\s*color-mix\(in srgb, var\(--text-strong\) 86%, var\(--surface\)\);[^}]*--oc-button-color:\s*var\(--text-on-strong\);/s,
  )
  expect(css).not.toMatch(
    /\.oc-button\[data-variant="solid"\](?:\[data-tone="accent"\])?\s*\{[^}]*--oc-button-bg:\s*var\(--accent\);/s,
  )
  expect(css).not.toMatch(
    /\.oc-button\[data-variant="solid"\]\[data-tone="(?:accent|danger)"\][^{]*\{[^}]*--oc-button-color:\s*var\(--surface\);/s,
  )
  expect(css).toContain('.oc-button:not([data-tone="danger"]):not([data-variant="solid"]):hover')
})

test("Button mini size owns the retired compact-button padding contract", () => {
  const css = readFileSync(BUTTON_CSS, "utf8")

  expect(css).toMatch(
    /\.oc-button\[data-size="mini"\]\s*\{[^}]*--oc-button-height:\s*var\(--oc-density-chip-height\);/s,
  )
  expect(css).toMatch(
    /\.oc-button\[data-size="mini"\]\s*\{[^}]*--oc-button-padding-x:\s*var\(--ui-btn-mini-padding-x\);/s,
  )
  expect(css).toMatch(
    /\.oc-button\[data-size="mini"\]\s*\{[^}]*--oc-button-padding-y:\s*var\(--ui-btn-mini-padding-y\);/s,
  )
  expect(css).toMatch(/\.oc-button\[data-size="mini"\]\s*\{[^}]*font-size:\s*var\(--ui-font-small\);/s)
})

test("Button primitive size owns actual control height, not only minimum height", () => {
  const css = readFileSync(BUTTON_CSS, "utf8")

  expect(css).toMatch(/\.oc-button\s*\{[^}]*--oc-button-height:\s*var\(--oc-density-button-height\);/s)
  expect(css).toMatch(
    /\.oc-button\[data-size="sm"\]\s*\{[^}]*--oc-button-height:\s*var\(--oc-density-chip-height\);/s,
  )
  expect(css).toMatch(
    /\.oc-button\[data-size="md"\]\s*\{[^}]*--oc-button-height:\s*var\(--oc-density-button-height\);/s,
  )
  expect(css).toMatch(
    /\.oc-button\[data-size="icon"\]\s*\{[^}]*--oc-button-height:\s*var\(--oc-density-icon-button\);/s,
  )
  expect(css).toMatch(/\.oc-button\s*\{[^}]*height:\s*var\(--oc-button-height\);/s)
  expect(css).toMatch(/\.oc-button\s*\{[^}]*min-height:\s*var\(--oc-button-height\);/s)
})

test("Button primitive owns the canonical keyboard focus ring", () => {
  const css = readFileSync(BUTTON_CSS, "utf8")

  expect(css).toMatch(/\.oc-button:focus-visible\s*\{[^}]*outline:\s*none;/s)
  expect(css).toMatch(
    /\.oc-button:focus-visible\s*\{[^}]*box-shadow:\s*0 0 0 calc\(2px \* var\(--ui-scale\)\) var\(--accent-ring\);/s,
  )
})

test("Button outline chrome is one Codex-style surfaced control contract", () => {
  const css = readFileSync(BUTTON_CSS, "utf8")

  expect(css).toMatch(/\.oc-button\s*\{[^}]*border-radius:\s*var\(--oc-radius-large\);/s)
  expect(css).not.toContain("--oc-button-radius")
  expect(css).toMatch(/\.oc-button\s*\{[^}]*font-weight:\s*var\(--ui-font-weight-medium\);/s)
  expect(css).toMatch(/\.oc-button\[data-size="icon"\]\s*\{[^}]*border-radius:\s*var\(--oc-radius-pill\);/s)
  expect(css).toMatch(/\.oc-button\[data-variant="outline"\]\s*\{[^}]*--oc-button-bg:\s*var\(--surface-strong\);/s)
  expect(css).toMatch(
    /\.oc-button\[data-variant="outline"\]\s*\{[^}]*--oc-button-border:\s*var\(--oc-border-width\) solid var\(--border\);/s,
  )
  expect(css).toMatch(/\.oc-button\[data-variant="outline"\]\s*\{[^}]*--oc-button-shadow:\s*none;/s)
  expect(css).toMatch(
    /\.oc-button\[data-variant="outline"\]:not\(\[data-tone="danger"\]\):hover,[^}]*--oc-button-bg:\s*var\(--surface-hover\);[^}]*--oc-button-border:\s*var\(--oc-border-width\) solid var\(--border-hover\);[^}]*--oc-button-shadow:\s*none;/s,
  )
  expect(css).not.toMatch(/\.oc-button\[data-variant="outline"\][^{]*\{[^}]*--oc-button-shadow:\s*0\s+calc\(/s)
})

test("production component buttons are owned by the shared Button primitive", () => {
  const root = join(import.meta.dir, "../src/components")
  const files: string[] = []
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name)) files.push(path)
    }
  }
  walk(root)

  const literalOwners = files.filter((file) => {
    if (file === BUTTON_SOURCE) return false
    return /<button\b/.test(readFileSync(file, "utf8"))
  })
  expect(literalOwners).toEqual([])

  const generated = readFileSync(join(import.meta.dir, "../src/utils/dom-utils.ts"), "utf8")
  expect(generated.match(/<button type="button"/g)?.length).toBe(3)
  expect(generated.match(/class="oc-button /g)?.length).toBe(3)
})
