import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { stageAccent } from "../src/utils/card-color"

const CARD_CSS = readFileSync(join(import.meta.dir, "..", "src", "styles", "surfaces", "card.css"), "utf8")
const CARD_COLOR_TS = readFileSync(join(import.meta.dir, "..", "src", "utils", "card-color.ts"), "utf8")
const LOG_VIEWER_TSX = readFileSync(join(import.meta.dir, "..", "src", "components", "LogViewer.tsx"), "utf8")

const KNOWN_STAGES = [
  "user",
  "assistant",
  "system",
  "orchestrator",
  "mission",
  "intent-analysis",
  "spec",
  "requirements",
  "frontend-design",
  "frontend-research",
  "visual-qa",
  "architect",
  "goal-workload-analyst",
  "planner",
  "goal",
  "executor",
  "build",
  "explore",
  "deep-research",
  "acceptance",
  "integrity",
  "fact-check",
  "tool",
] as const

const AGENT_IDENTITY_STAGES = KNOWN_STAGES.filter(
  (stage) => !["user", "system", "tool"].includes(stage),
)

describe("card stage tokens", () => {
  test("every stage stageAccent emits has a matching --card-stage-* CSS var", () => {
    const missing: string[] = []
    for (const stage of KNOWN_STAGES) {
      const accent = stageAccent(stage)
      expect(accent).toBe(`var(--card-stage-${stage})`)
      const declared = new RegExp(`--card-stage-${stage}\\s*:`).test(CARD_CSS)
      if (!declared) missing.push(stage)
    }
    expect(missing).toEqual([])
  })

  test("border-left shorthand rules carry a fallback so an unset --card-stage cannot blank the rail", () => {
    // Only the shorthand (`border-left: <width> <style> <color>`) is at risk —
    // an invalid `var(--card-stage)` invalidates the whole declaration and
    // resets `border-left-style` to `none`, hiding the rail. The
    // `border-left-color: var(--card-stage-...)` status overrides set color
    // alone and don't need fallbacks (they only run when the shorthand
    // already painted a rail).
    const railLines = CARD_CSS.split(/\r?\n/).filter(
      (line) => /border-left\s*:/.test(line) && /var\(--card-stage[^-]/.test(line),
    )
    expect(railLines.length).toBeGreaterThan(0)
    for (const line of railLines) {
      expect(line).toMatch(/var\(--card-stage,\s*var\(--card-stage-[a-z-]+\)\)/)
    }
  })

  test("Agent identity stages use unique theme-adaptive semantic colors", () => {
    const block = CARD_CSS.match(/Per-stage rail tokens[\s\S]*?--card-stage-tool:[^;]+;/)
    expect(block).not.toBeNull()
    const text = block?.[0] ?? ""
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    const identityColors: string[] = []
    for (const stage of AGENT_IDENTITY_STAGES) {
      const decl = new RegExp(`--card-stage-${stage}\\s*:\\s*([^;]+);`).exec(text)
      expect(decl).not.toBeNull()
      const color = decl?.[1]?.trim() ?? ""
      identityColors.push(color)
      expect(color).toMatch(/var\(--(?:accent|good|warn|bad)\)/)
    }
    expect(new Set(identityColors).size).toBe(AGENT_IDENTITY_STAGES.length)
    expect(identityColors.length).toBeGreaterThanOrEqual(20)

    expect(text).toMatch(/--card-stage-user:\s*var\(--accent\)/)
    expect(text).toMatch(/--card-stage-system:\s*var\(--warn\)/)
    expect(text).toMatch(/--card-stage-tool:\s*color-mix\([^;]+var\(--text-soft\)/)
  })

  test("unknown stages use the CSS fallback instead of a generated raw color", () => {
    expect(stageAccent("custom-agent")).toBeUndefined()
    expect(CARD_COLOR_TS).not.toContain("hsl(")
    expect(CARD_COLOR_TS).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  test("log viewer does not define a parallel raw-color NDJSON palette", () => {
    expect(LOG_VIEWER_TSX).not.toContain("NDJSON_STAGE_COLORS")
    expect(LOG_VIEWER_TSX).not.toContain("NDJSON_TOOL_COLORS")
    expect(LOG_VIEWER_TSX).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
