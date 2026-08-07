import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const BOARD = readFileSync(path.resolve(import.meta.dir, "..", "src", "components", "Board.tsx"), "utf8")

describe("retired AcceptancePanel projection", () => {
  test("Board does not restore the retired mutable acceptance aggregate", () => {
    expect(BOARD).not.toContain("export function AcceptancePanel")
    expect(BOARD).not.toContain('id="acceptanceSection"')
    expect(BOARD).not.toContain('bodyId="acceptanceBody"')
    expect(BOARD).not.toContain("verdictPillLabel")
    expect(BOARD).not.toContain("data-phase-state")
  })
})
