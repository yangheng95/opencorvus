import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const RETIRED_SELECTORS = [
  "global-task-current",
  "task-row-badge-icon",
  "card__meta-row",
  "msg-tool-expand",
  "plan-summary",
  "overview-summary",
  "overview-next-step",
  "change-path",
  "mission-conversation-body",
]

function walk(dir: string, accept: (path: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, accept))
    else if (accept(full)) out.push(full)
  }
  return out
}

function stripCssComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function classTokenRegExp(selector: string): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(selector)}(?![A-Za-z0-9_-])`)
}

const runtimeSource = walk(join(OVERLAY_ROOT, "src"), (path) => /\.(?:ts|tsx|html)$/.test(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n")

const cssSource = stripCssComments(
  walk(join(OVERLAY_ROOT, "src", "styles"), (path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n"),
)

describe("retired overlay orphan CSS residue", () => {
  test("retired selectors have no runtime DOM owner and no CSS rule", () => {
    for (const selector of RETIRED_SELECTORS) {
      expect(runtimeSource).not.toMatch(classTokenRegExp(selector))
      expect(cssSource).not.toMatch(new RegExp(`\\.${escapeRegExp(selector)}(?=[\\s,{:.#\\[])`))
    }
  })
})
