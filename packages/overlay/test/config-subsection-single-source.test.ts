import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")
const STYLES_ROOT = path.join(OVERLAY_ROOT, "src", "styles")
const COMPONENTS_ROOT = path.join(OVERLAY_ROOT, "src", "components")

function walk(dir: string, predicate: (file: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, predicate))
    else if (predicate(full)) out.push(full)
  }
  return out
}

function stripCssComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "")
}

function retiredCssSelector(className: string): RegExp {
  return new RegExp(`(^|[\\n,{])\\s*\\.${className}(?:\\s|[,>{:+~.#\\[]|$)`, "m")
}

function retiredClassToken(className: string): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9_-])${className}([^A-Za-z0-9_-]|$)`)
}

const CSS = stripCssComments(
  walk(STYLES_ROOT, (file) => file.endsWith(".css"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n"),
)
const COMPONENTS = walk(COMPONENTS_ROOT, (file) => /\.(?:ts|tsx)$/.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")

describe("retired settings config-subsection shell", () => {
  test.each(["config-subsection", "config-subsection-head", "config-subsection-body"])(
    "does not keep .%s CSS selectors",
    (className) => {
      expect(CSS).not.toMatch(retiredCssSelector(className))
    },
  )

  test.each(["config-subsection", "config-subsection-head", "config-subsection-body"])(
    "does not recreate %s class tokens in components",
    (className) => {
      expect(COMPONENTS).not.toMatch(retiredClassToken(className))
    },
  )
})
