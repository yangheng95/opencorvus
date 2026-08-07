import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const SOURCE = readFileSync(path.resolve(import.meta.dir, "..", "src", "main.tsx"), "utf8")

describe("main reactive controllers", () => {
  test("follow-up effect lives inside the single application root", () => {
    const rootStart = SOURCE.indexOf("function OverlayRoot()")
    const rootEnd = SOURCE.indexOf("const overlayAppHost")
    const followUpEffect = SOURCE.indexOf("const busyNow = !!messageStore.chatRequest || isTaskInterruptable()")
    expect(rootStart).toBeGreaterThanOrEqual(0)
    expect(rootEnd).toBeGreaterThan(rootStart)
    expect(followUpEffect).toBeGreaterThan(rootStart)
    expect(followUpEffect).toBeLessThan(rootEnd)
    expect(SOURCE).not.toContain("createRoot")
    expect(SOURCE.match(/\brender\(/g)).toHaveLength(1)
    expect(SOURCE).toContain("insert(host, Icon(")
  })
})
