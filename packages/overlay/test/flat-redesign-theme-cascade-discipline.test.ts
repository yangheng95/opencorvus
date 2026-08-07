import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const STYLES_ROOT = join(OVERLAY_ROOT, "src", "styles")
const SURFACES_ROOT = join(STYLES_ROOT, "surfaces")
const CASCADE_ROOT = join(STYLES_ROOT, "cascade")

type CssBlock = {
  body: string
  startLine: number
}

type TokenDeclaration = {
  line: number
  value: string
}

function walkCssFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry)
    const stat = statSync(file)
    if (stat.isDirectory()) out.push(...walkCssFiles(file))
    else if (entry.endsWith(".css")) out.push(file)
  }
  return out
}

function relativeOverlayPath(file: string): string {
  return relative(OVERLAY_ROOT, file).replace(/\\/g, "/")
}

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1))
}

function lineAtOffset(text: string, offset: number): number {
  return text.slice(0, offset).split(/\r?\n/).length
}

function firstBlock(text: string, selectorPattern: RegExp): CssBlock {
  const match = selectorPattern.exec(text)
  if (!match || match.index === undefined) throw new Error(`CSS block not found: ${selectorPattern}`)
  const open = text.indexOf("{", match.index)
  if (open < 0) throw new Error(`CSS block has no opening brace: ${selectorPattern}`)
  let depth = 1
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") {
      depth--
      if (depth === 0) {
        return {
          body: text.slice(open + 1, i),
          startLine: lineAtOffset(text, open + 1),
        }
      }
    }
  }
  throw new Error(`CSS block has unbalanced braces: ${selectorPattern}`)
}

function rootBlock(file: string): CssBlock {
  return firstBlock(withoutComments(readFileSync(file, "utf8")), /(^|\n)\s*:root\s*\{/)
}

function firstThemeBlock(file: string): CssBlock {
  return firstBlock(withoutComments(readFileSync(file, "utf8")), /\{/)
}

function themeTokens(file: string): Map<string, TokenDeclaration> {
  const block = firstThemeBlock(file)
  const tokens = new Map<string, TokenDeclaration>()
  const lines = block.body.split(/\r?\n/)
  let active: { line: number; name: string; value: string } | null = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const declarationStart = line.match(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*(.*)$/)
    if (!active && declarationStart) {
      active = {
        line: block.startLine + index,
        name: declarationStart[1]!,
        value: declarationStart[2]!,
      }
    } else if (active) {
      active.value += `\n${line}`
    }

    if (active && /;/.test(active.value)) {
      const value = active.value.slice(0, active.value.indexOf(";")).trim()
      tokens.set(active.name, { line: active.line, value })
      active = null
    }
  }
  return tokens
}

function failWithViolations(kind: string, violations: string[], guidance: string): void {
  if (violations.length > 0) {
    throw new Error(`${kind} violations:\n  ${violations.join("\n  ")}\n${guidance}`)
  }
  expect(violations).toHaveLength(0)
}

describe("flat-redesign theme cascade discipline", () => {
  it("surfaces do not contain body[data-theme=] theme branches", () => {
    const violations: string[] = []
    for (const file of walkCssFiles(SURFACES_ROOT).sort()) {
      const lines = withoutComments(readFileSync(file, "utf8")).split(/\r?\n/)
      lines.forEach((line, index) => {
        if (/body\[data-theme=/.test(line)) {
          violations.push(`${relativeOverlayPath(file)}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    failWithViolations("surface theme branch", violations, "Move theme-specific differences into cascade theme tokens.")
  })

  it("cascade/base.css :root declares no color token values or color-scheme", () => {
    const file = join(CASCADE_ROOT, "base.css")
    const block = rootBlock(file)
    const colorValue =
      /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(|\bcolor-mix\s*\(|(?<![\w-])(?:white|black|transparent|currentColor)(?![\w-])/i
    const violations: string[] = []

    block.body.split(/\r?\n/).forEach((line, index) => {
      const declaration = line.match(/^\s*([a-zA-Z0-9_-]+|--[a-zA-Z0-9-]+)\s*:\s*(.*?)\s*;?\s*$/)
      if (!declaration) return
      const prop = declaration[1]!
      const value = declaration[2]!
      if (prop === "color-scheme" || (prop.startsWith("--") && colorValue.test(value))) {
        violations.push(`${relativeOverlayPath(file)}:${block.startLine + index}: ${line.trim()}`)
      }
    })

    failWithViolations(
      "base.css :root color token",
      violations,
      "Keep base.css :root structural; theme color values belong in cascade theme files.",
    )
  })

  it("dark, light, and vscode-dark theme token values are all present", () => {
    const themeFiles = [
      join(CASCADE_ROOT, "dark.css"),
      join(CASCADE_ROOT, "light.css"),
      join(CASCADE_ROOT, "vscode-dark.css"),
    ]
    const tokenMaps = new Map(themeFiles.map((file) => [file, themeTokens(file)]))
    const tokenNames = new Set<string>()
    for (const tokens of tokenMaps.values()) {
      for (const token of tokens.keys()) tokenNames.add(token)
    }

    const violations: string[] = []
    for (const token of [...tokenNames].sort()) {
      for (const file of themeFiles) {
        const declaration = tokenMaps.get(file)!.get(token)
        if (!declaration) {
          violations.push(`${relativeOverlayPath(file)}:1: missing ${token}`)
        } else if (!declaration.value.trim()) {
          violations.push(`${relativeOverlayPath(file)}:${declaration.line}: ${token} has no value`)
        }
      }
    }

    failWithViolations(
      "theme token value",
      violations,
      "Declare every theme token with an explicit value in dark.css, light.css, and vscode-dark.css.",
    )
  })
})
