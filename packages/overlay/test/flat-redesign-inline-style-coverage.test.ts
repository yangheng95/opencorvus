import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const COMPONENTS_ROOT = join(OVERLAY_ROOT, "src", "components")

const DIRECT_VISUAL_PROPS = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
  "flexBasis",
  "borderWidth",
  "borderRadius",
  "fontSize",
  "lineHeight",
])

const ALLOWED_DIRECT_PROPS = new Set(["transform", "opacity", "display", "visibility", "pointerEvents"])

type StyleBlock = {
  text: string
  start: number
}

function walkTsxFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry)
    const stat = statSync(file)
    if (stat.isDirectory()) out.push(...walkTsxFiles(file))
    else if (entry.endsWith(".tsx")) out.push(file)
  }
  return out
}

function relativeOverlayPath(file: string): string {
  return relative(OVERLAY_ROOT, file).replace(/\\/g, "/")
}

function lineAtOffset(text: string, offset: number): number {
  return text.slice(0, offset).split(/\r?\n/).length
}

function skipQuoted(text: string, index: number, quote: string): number {
  let i = index + 1
  while (i < text.length) {
    if (text[i] === "\\") {
      i += 2
      continue
    }
    if (text[i] === quote) return i + 1
    i++
  }
  return text.length
}

function extractStyleBlocks(text: string): StyleBlock[] {
  const blocks: StyleBlock[] = []
  let searchFrom = 0
  while (searchFrom < text.length) {
    const start = text.indexOf("style={{", searchFrom)
    if (start < 0) break
    const open = text.indexOf("{", start)
    let depth = 0
    let i = open
    while (i < text.length) {
      const ch = text[i]
      if (ch === "'" || ch === '"' || ch === "`") {
        i = skipQuoted(text, i, ch)
        continue
      }
      if (ch === "{") depth++
      else if (ch === "}") {
        depth--
        if (depth === 0) {
          blocks.push({ text: text.slice(open, i + 1), start: open })
          searchFrom = i + 1
          break
        }
      }
      i++
    }
    if (depth !== 0) throw new Error(`Unbalanced inline style block near line ${lineAtOffset(text, start)}`)
  }
  return blocks
}

function styleEntries(block: StyleBlock): Array<{ prop: string; value: string; offset: number }> {
  const entries: Array<{ prop: string; value: string; offset: number }> = []
  const propValue = /(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*|--[a-zA-Z0-9-]+))\s*:\s*([^,\n}]+)/g
  for (const match of block.text.matchAll(propValue)) {
    entries.push({
      prop: (match[1] ?? match[2] ?? match[3] ?? "").trim(),
      value: (match[4] ?? "").trim(),
      offset: block.start + (match.index ?? 0),
    })
  }
  return entries
}

function hasColorLiteral(value: string): boolean {
  const namedColor =
    /(?<![\w-])(?:white|black|red|green|blue|yellow|orange|purple|pink|cyan|magenta|gray|grey|transparent|currentColor)(?![\w-])/i
  return /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(|\bcolor-mix\s*\(/i.test(value) || namedColor.test(value)
}

function hasSizeLiteral(value: string): boolean {
  return /(?:\d|\})\s*(?:px|em|rem)\b/i.test(value)
}

function isCssVariableReference(value: string): boolean {
  return /\bvar\(\s*--[a-zA-Z0-9-]+\s*\)/.test(value)
}

function inlineStyleViolations(): string[] {
  const violations: string[] = []
  for (const file of walkTsxFiles(COMPONENTS_ROOT).sort()) {
    const text = readFileSync(file, "utf8")
    for (const block of extractStyleBlocks(text)) {
      for (const entry of styleEntries(block)) {
        const loc = `${relativeOverlayPath(file)}:${lineAtOffset(text, entry.offset)}`
        if (hasColorLiteral(entry.value)) {
          violations.push(`${loc}: ${entry.prop}: ${entry.value}`)
          continue
        }
        if (hasSizeLiteral(entry.value)) {
          violations.push(`${loc}: ${entry.prop}: ${entry.value}`)
          continue
        }
        if (
          !entry.prop.startsWith("--") &&
          DIRECT_VISUAL_PROPS.has(entry.prop) &&
          !ALLOWED_DIRECT_PROPS.has(entry.prop) &&
          !isCssVariableReference(entry.value)
        ) {
          violations.push(`${loc}: ${entry.prop}: ${entry.value}`)
        }
      }
    }
  }
  return violations
}

describe("flat-redesign inline style coverage", () => {
  it("component style objects do not encode color or dimensional design literals", () => {
    const violations = inlineStyleViolations()
    if (violations.length > 0) {
      throw new Error(
        `inline style discipline violations:\n  ${violations.join("\n  ")}\n` +
          "Move visual decisions to CSS tokens/classes; inline style may only carry non-visual props or var(--*) references.",
      )
    }
    expect(violations).toHaveLength(0)
  })
})
