import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const overlayMainPath = path.resolve(import.meta.dir, "../src/main.tsx")

describe("Overlay browser-test store hooks", () => {
  test("exposes the canonical stores used by browser fixtures", () => {
    const main = readFileSync(overlayMainPath, "utf8")

    expect(main).not.toContain("(window as any).state")
    expect(main).toMatch(/\(window as any\)\.boardStore\s*=\s*boardStore/)
    expect(main).toMatch(/\(window as any\)\.settingsStore\s*=\s*settingsStore/)
  })
})
