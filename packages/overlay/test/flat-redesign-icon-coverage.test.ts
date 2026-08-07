/**
 * Coverage guard for flat-redesign Step 3 (flat redesign migration contract §2.3).
 *
 * Two assertions:
 *
 *   1. The Icon primitive is the single source of icon rendering.
 *      Commodity icons are backed by lucide-solid, while product-specific
 *      glyphs remain in the custom SVG registry.
 *
 *   2. No regression to character-icon callsites under
 *      `packages/overlay/src/components/**\/*.tsx`. The 4 close-X
 *      JSX literals (`>×</button>`), the 2 emoji icons (📁), and the
 *      caret literal (▾) that were migrated 2026-05-04 must not
 *      crawl back. The static `index.html` and the `main.tsx`
 *      innerHTML template are excluded from this guard — they are
 *      tracked separately in plan.md §3 Step 6 (dead-code cleanup)
 *      because rewriting innerHTML templates is out of scope here.
 */

import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// Importing Icon.tsx directly pulls in the SolidJS JSX runtime. Read its
// source contract here; real rendered icon coverage lives in the browser test.
const COMPONENTS_ROOT = join(import.meta.dir, "..", "src", "components")
const SRC_ROOT = join(import.meta.dir, "..", "src")
const ICON_TSX_PATH = join(COMPONENTS_ROOT, "ui", "Icon.tsx")
const ICON_TYPES_PATH = join(COMPONENTS_ROOT, "ui", "Icon.types.ts")
const ICON_LUCIDE_PATH = join(COMPONENTS_ROOT, "ui", "Icon.lucide.ts")
const ICON_BRANDS_PATH = join(COMPONENTS_ROOT, "ui", "Icon.brands.tsx")
const ICON_TSX = readFileSync(ICON_TSX_PATH, "utf8")
const ICON_TYPES = readFileSync(ICON_TYPES_PATH, "utf8")
const ICON_LUCIDE = readFileSync(ICON_LUCIDE_PATH, "utf8")
const ICON_BRANDS = readFileSync(ICON_BRANDS_PATH, "utf8")
const ICON_CSS = readFileSync(join(SRC_ROOT, "styles", "primitives", "icon.css"), "utf8")
const ICON_HTML_TSX = readFileSync(join(import.meta.dir, "..", "src", "utils", "icon-html.tsx"), "utf8")
const MAIN_TSX = readFileSync(join(import.meta.dir, "..", "src", "main.tsx"), "utf8")
const TOOL_TS = readFileSync(join(SRC_ROOT, "utils", "tool.ts"), "utf8")

function listTsx(dir: string, exclude: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (exclude.has(full)) continue
    if (statSync(full).isDirectory()) out.push(...listTsx(full, exclude))
    else if (name.endsWith(".tsx")) out.push(full)
  }
  return out
}

function listFiles(dir: string, extension: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full, extension))
    else if (name.endsWith(extension)) out.push(full)
  }
  return out
}

describe("flat-redesign Icon primitive registry", () => {
  test("ordinary rendered icons use a closed semantic density tier", () => {
    expect(ICON_TSX).toContain('const sizeTier = () => props.size ?? "standard"')
    expect(ICON_TSX).toContain("size?: IconSizeTier")
    expect(ICON_TSX).not.toContain("size?: number")
    expect(ICON_TSX.match(/data-oc-icon="true"/g)).toHaveLength(2)
    expect(ICON_TSX.match(/data-size=\{sizeTier\(\)\}/g)).toHaveLength(2)
    for (const tier of ["compact", "medium", "large", "display"]) {
      expect(ICON_CSS).toContain(`.oc-icon[data-size="${tier}"]`)
    }
    const iconGeometry = ICON_CSS.slice(0, ICON_CSS.indexOf(".oc-status-indicator"))
    expect(iconGeometry).not.toMatch(/\d+px/)
  })

  test("Icon and its density contract live only in the canonical UI catalog", () => {
    expect(existsSync(join(COMPONENTS_ROOT, "Icon.tsx"))).toBe(false)
    expect(existsSync(join(SRC_ROOT, "utils", "icon-size.ts"))).toBe(false)
    expect(ICON_TSX).toContain('from "./Icon.types"')
    expect(ICON_TSX).toContain('from "./Icon.lucide"')
    expect(ICON_TSX).toContain('from "./Icon.brands"')
    expect(ICON_TYPES).toContain('export const ICON_SIZE_TIERS = ["compact", "standard", "medium", "large", "display"]')
    expect(MAIN_TSX).toContain('from "./components/ui/Icon"')

    const privateRegistryCallers = listFiles(SRC_ROOT, ".ts")
      .concat(listFiles(SRC_ROOT, ".tsx"))
      .filter((file) => ![ICON_TSX_PATH, ICON_LUCIDE_PATH, ICON_BRANDS_PATH].includes(file))
      .filter((file) => /Icon\.(?:lucide|brands)/.test(readFileSync(file, "utf8")))
    expect(privateRegistryCallers).toEqual([])
  })

  test("feature callers cannot create a second icon stroke system", () => {
    expect(ICON_TSX).not.toMatch(/export interface IconProps \{[\s\S]*?strokeWidth\?:[\s\S]*?\n\}/)
    expect(ICON_TSX).not.toContain("props.strokeWidth")
    expect(ICON_TSX).toContain("resolvedCustomRecord()?.strokeWidth ?? 1.4")
    expect(ICON_TSX).toContain("resolvedLucideRecord()?.strokeWidth ?? 1.75")
  })

  test("Icon.css is the only owner of rendered icon geometry", () => {
    const violations: string[] = []
    for (const file of listFiles(join(SRC_ROOT, "styles"), ".css")) {
      if (file.endsWith("/primitives/icon.css")) continue
      const css = readFileSync(file, "utf8")
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1]!
        const declarations = match[2]!
        if (selector.includes(".msg-artifact-")) continue
        if (/\bsvg\b/.test(selector) && /^\s*(?:width|height)\s*:/m.test(declarations)) {
          violations.push(`${file}: ${selector.trim()}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  test("feature CSS does not override icon stroke geometry", () => {
    const violations = listFiles(join(SRC_ROOT, "styles"), ".css")
      .filter((file) => !file.endsWith(join("primitives", "icon.css")))
      .filter((file) => /stroke-width\s*:/.test(readFileSync(file, "utf8")))
    expect(violations).toEqual([])
  })

  test("retired aliases and numeric Icon sizes stay out of production source", () => {
    const source = listFiles(SRC_ROOT, ".tsx")
      .concat(listFiles(SRC_ROOT, ".ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
    expect(source).not.toMatch(/<Icon\b[^>]*\bsize=\{\d+\}/)
    expect(source).not.toMatch(/\biconHtml\([^\n]*,\s*\d+\)/)
    for (const alias of [
      "caret-down",
      "caret-up",
      "pin-tilted",
      "work-chat",
      "work-mission",
      "work-task",
      "terminal-command-prompt",
      "config-archive",
      "config-about",
      "avatar-mission",
      "avatar-goal",
      "avatar-executor",
    ]) {
      expect(source).not.toContain(`\"${alias}\"`)
    }
  })

  test("each Lucide glyph has one canonical semantic name", () => {
    const registry = ICON_LUCIDE.match(
      /const LUCIDE_ICON_MAP =\s*\{([\s\S]*?)\n\} as const satisfies Record<string, LucideIconRecord>/,
    )?.[1]
    expect(registry).toBeDefined()
    const components = new Map<string, string[]>()
    for (const match of registry!.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z0-9_-]+)):\s*\{\s*component:\s*([A-Za-z0-9_]+)/gm)) {
      const name = match[1] ?? match[2]!
      const component = match[3]!
      components.set(component, [...(components.get(component) ?? []), name])
    }
    expect([...components.entries()].filter(([, names]) => names.length > 1)).toEqual([])
  })

  test("expert squad icons distinguish the catalog from one collaborating team", () => {
    expect(ICON_LUCIDE).toMatch(/"expert-squad-catalog":\s*\{\s*component:\s*Boxes\s*\}/)
    expect(ICON_LUCIDE).toMatch(/"expert-squad":\s*\{\s*component:\s*UsersRound\s*\}/)
    expect(ICON_LUCIDE).not.toContain("BrainCircuit")
  })

  test("IconName is derived from the two concrete rendering registries", () => {
    expect(ICON_LUCIDE).toContain("type LucideIconName = keyof typeof LUCIDE_ICON_MAP")
    expect(ICON_BRANDS).toContain("type CustomIconName = keyof typeof CUSTOM_ICON_PATHS")
    expect(ICON_TSX).toContain("export type IconName = LucideIconName | CustomIconName")
    expect(ICON_LUCIDE).toMatch(/const LUCIDE_ICON_MAP = \{[\s\S]*?\} as const satisfies Record<string, LucideIconRecord>/)
    expect(ICON_BRANDS).toMatch(/const CUSTOM_ICON_PATHS = \{[\s\S]*?\} as const satisfies Record<string, IconRecord>/)
    expect(`${ICON_TSX}\n${ICON_LUCIDE}\n${ICON_BRANDS}`).not.toContain("Partial<Record<IconName")
    expect(ICON_TSX).not.toMatch(/export type IconName\s*=\s*\n\s*\|/)
  })

  test("commodity icons are backed by lucide-solid", () => {
    expect(ICON_LUCIDE).toContain('from "lucide-solid"')
    expect(ICON_LUCIDE).toContain("const LUCIDE_ICON_MAP")
    for (const name of ["close", "plus", "search", "refresh", "copy", "download", "status-completed"]) {
      const escaped = name.replace(/-/g, "\\-")
      expect(ICON_LUCIDE).toMatch(new RegExp(`(?:["']${escaped}["']|\\b${escaped}\\b)\\s*:\\s*\\{\\s*component:`))
    }
  })

  test("business and agent glyphs use the same Lucide line family", () => {
    for (const name of [
      "project-add",
      "avatar-user",
      "avatar-assistant",
      "avatar-orchestrator",
      "avatar-frontend-design",
      "avatar-visual-qa",
      "avatar-integrity",
      "spec",
      "plan",
      "goals",
      "acceptance",
      "mission",
      "channel-link",
    ]) {
      const escaped = name.replace(/-/g, "\\-")
      expect(ICON_LUCIDE).toMatch(new RegExp(`(?:["']${escaped}["']|\\b${escaped}\\b)\\s*:\\s*\\{\\s*component:`))
    }
    expect(ICON_TSX).toContain("resolvedLucideRecord()?.strokeWidth ?? 1.75")

    const customRegistry = ICON_BRANDS.match(
      /const CUSTOM_ICON_PATHS =\s*\{([\s\S]*?)\n\} as const satisfies Record<string, IconRecord>/,
    )?.[1]
    expect(customRegistry).toBeDefined()
    for (const name of ["project-add", "avatar-user", "avatar-assistant", "mission"]) {
      expect(customRegistry).not.toContain(`"${name}"`)
      expect(customRegistry).not.toMatch(new RegExp(`(?:^|\\n)\\s*${name.replace(/-/g, "\\-")}\\s*:`))
    }
    for (const brandName of ["editor-vscode", "editor-pycharm", "editor-webstorm", "editor-intellij", "editor-cursor"]) {
      expect(customRegistry).toContain(`"${brandName}"`)
    }
    expect(customRegistry).toMatch(/(?:^|\n)\s*github\s*:/)
  })

  test("custom SVG fallback remains isolated inside Icon.tsx", () => {
    expect(ICON_BRANDS).toContain("const CUSTOM_ICON_PATHS")
    expect(ICON_TSX).toContain('viewBox="0 0 16 16"')
    expect(ICON_TSX).toContain('stroke="currentColor"')
    expect(ICON_TSX).toContain('stroke-linecap="round"')
    expect(ICON_TSX).toContain('stroke-linejoin="round"')
    expect(ICON_TSX).toContain('fill="none"')
  })

  test("iconHtml is a pure utility entry installed by the Icon primitive owner", () => {
    expect(ICON_HTML_TSX).toContain("installIconHtmlRenderer")
    expect(ICON_HTML_TSX).toContain('"iconHtml renderer has not been installed"')
    expect(ICON_HTML_TSX).toContain('import type { IconSizeTier } from "../components/ui/Icon.types"')
    expect(ICON_HTML_TSX).not.toMatch(/import\s+\{[^}]*\bIcon\b[^}]*\}\s+from/)
    expect(ICON_HTML_TSX).not.toContain("ICON_PATHS")
    expect(ICON_HTML_TSX).not.toContain("renderToString")
    expect(MAIN_TSX).toContain("installIconHtmlRenderer")
    expect(MAIN_TSX).toContain("REGISTERED_ICONS")
    expect(MAIN_TSX).toContain("LUCIDE_ICON_NAMES")
    expect(MAIN_TSX).toContain("insert(host, Icon(")
    expect(MAIN_TSX.match(/\brender\(/g)).toHaveLength(1)
    expect(MAIN_TSX).not.toContain("renderToString")
  })

  test("tool display icons resolve to registered IconName values", () => {
    expect(TOOL_TS).toContain("displayToolIconName")
    expect(TOOL_TS).toContain("import type { IconName }")
    expect(TOOL_TS).not.toMatch(/export function displayToolIcon\s*\(/)
    expect(TOOL_TS).not.toMatch(/\\uD83D\\uDCC4|\\u270F\\uFE0F|\\uD83D\\uDCDD|\\uD83D\\uDCBB/)
    expect(TOOL_TS).not.toMatch(/\\uD83D\\uDD0D|\\uD83D\\uDCC2|\\uD83E\\uDD16|\\u2611\\uFE0F|\\u26A1/)

    for (const name of [
      "file-document",
      "edit",
      "terminal",
      "search",
      "folder-open",
      "avatar-assistant",
      "tasks",
      "config-tool",
    ]) {
      const escaped = name.replace(/-/g, "\\-")
      expect(ICON_LUCIDE).toMatch(new RegExp(`(?:["']${escaped}["']|\\b${escaped}\\b)\\s*:\\s*\\{`))
    }
  })

  test("tool icon consumers render through Icon or iconHtml", () => {
    const cardHeader = readFileSync(join(COMPONENTS_ROOT, "CardHeader.tsx"), "utf8")
    const inlineTool = readFileSync(join(COMPONENTS_ROOT, "InlineToolPart.tsx"), "utf8")
    const cardParts = readFileSync(join(COMPONENTS_ROOT, "CardParts.tsx"), "utf8")
    const dialog = readFileSync(join(SRC_ROOT, "services", "dialog.ts"), "utf8")

    expect(cardHeader).toContain('from "./ui/Icon"')
    expect(cardHeader).toContain("<Icon name={name()} />")
    expect(inlineTool).toContain('from "./ui/Icon"')
    expect(inlineTool).toContain("<Icon name={icon()} />")
    expect(cardParts).toContain('from "./ui/Icon"')
    expect(cardParts).toContain('<Icon name="edit" class="msg-patch__icon" />')
    expect(cardParts).toContain('<Icon name={expanded() ? "chevron-down" : "chevron"} />')
    expect(cardParts).not.toContain('{"\\u2192"}')
    expect(cardParts).not.toContain('"\\u2699 "')
    expect(dialog).toContain('from "../utils/icon-html"')
    expect(dialog).toContain("iconHtml(display.icon)")
    expect(dialog).not.toContain("escapeHtml(display.icon)")
  })
})

describe("flat-redesign character-icon callsites are gone", () => {
  // No component exclusions: migrated panels must stay covered by the
  // character-icon guard.
  const EXCLUDED = new Set<string>()

  // Patterns we forbid across .tsx components and main.tsx. Each
  // entry is `[label, regex]`. Regex must match a JSX literal or an
  // innerHTML template-string literal — both shapes counted as
  // character-icon escapes.
  const FORBIDDEN: Array<[string, RegExp]> = [
    ["close-X JSX literal", />\s*×\s*<\/button>/],
    ["close-X innerHTML literal", />×<\/button>/],
    ["folder emoji", /📁/],
    ["caret-down literal in JSX", />▾</],
    ["chevron literal in JSX", />▸</],
  ]

  function gatherSources(): string[] {
    return [
      ...listTsx(COMPONENTS_ROOT, EXCLUDED),
      // Step 7 (2026-05-04): main.tsx is now in scope; its innerHTML
      // template-string for the recent-dirs panel close button must not
      // regress to a character icon escape.
      join(import.meta.dir, "..", "src", "main.tsx"),
    ]
  }

  for (const [label, re] of FORBIDDEN) {
    test(`no ${label} across components/ + main.tsx`, () => {
      const files = gatherSources()
      const violations: string[] = []
      for (const file of files) {
        const text = readFileSync(file, "utf8")
        if (re.test(text)) {
          violations.push(file)
        }
      }
      if (violations.length > 0) {
        throw new Error(
          `${label} regressed in:\n  ${violations.join("\n  ")}\n` +
            `Use <Icon name="..." /> from components/ui/Icon.tsx, or — for ` +
            `innerHTML template flows — iconHtml() installed by the Icon ` +
            `primitive owner.`,
        )
      }
    })
  }

  test("no SECTION_ICONS innerHTML map under components/Board.tsx", () => {
    const board = readFileSync(join(COMPONENTS_ROOT, "Board.tsx"), "utf8")
    expect(board).not.toMatch(/const SECTION_ICONS\s*[:=]/)
    expect(board).not.toMatch(/innerHTML=\{[^}]*SECTION_ICONS/)
  })

  test("no inline icon svg literals outside Icon.tsx", () => {
    const EXEMPT = new Set([ICON_TSX_PATH])
    const files = [
      ...listTsx(COMPONENTS_ROOT, EXEMPT),
      join(import.meta.dir, "..", "src", "main.tsx"),
      join(import.meta.dir, "..", "src", "index.html"),
      join(import.meta.dir, "..", "src", "utils", "dom-utils.ts"),
      join(import.meta.dir, "..", "src", "utils", "markdown.ts"),
    ]
    const violations: string[] = []
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      if (/<svg\b/i.test(text)) {
        violations.push(file)
      }
    }
    if (violations.length > 0) {
      throw new Error(
        `inline icon svg literal regressed in:\n  ${violations.join("\n  ")}\n` +
          `Use <Icon name="..." /> from components/ui/Icon.tsx or iconHtml() for string-template flows.`,
      )
    }
  })

  test("retired body-scope alias tokens have no consumers", () => {
    // Step 7 (2026-05-04): `--ok / --warning / --danger / --text-dim`
    // aliases retired from design-language.css. Verified zero callsites
    // before deletion; this guard keeps it that way.
    const RETIRED = ["--ok", "--warning", "--danger", "--text-dim"]
    const stylesRoot = join(import.meta.dir, "..", "src", "styles")
    const allCss: string[] = []
    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name.endsWith(".css")) allCss.push(full)
      }
    }
    walk(stylesRoot)
    const violations: string[] = []
    for (const file of allCss) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
      for (const token of RETIRED) {
        const consumerRe = new RegExp(`var\\(${token.replace(/-/g, "\\-")}\\)`)
        if (consumerRe.test(text)) {
          violations.push(`${file}: still references var(${token})`)
        }
        const declRe = new RegExp(`(?:^|[\\s;{])${token.replace(/-/g, "\\-")}\\s*:`)
        if (declRe.test(text)) {
          violations.push(`${file}: still declares ${token}`)
        }
      }
    }
    if (violations.length > 0) {
      throw new Error(`retired body-scope aliases still in use:\n  ${violations.join("\n  ")}`)
    }
  })
})
