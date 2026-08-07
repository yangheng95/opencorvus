import { describe, expect, it } from "bun:test"
import { activeTone, verdictTone } from "../src/utils/verdict-tone"

describe("flat-redesign verdict tone helper", () => {
  it("derives badge tone from a single verdict helper", () => {
    expect(verdictTone({ passed: 1, failed: 1, total: 2 })).toBe("bad")
    expect(verdictTone({ passed: 2, failed: 0, total: 2 })).toBe("good")
    expect(verdictTone({ passed: 1, failed: 0, total: 2 })).toBe("accent")
    expect(verdictTone({ passed: 0, failed: 0, total: 0 })).toBe("accent")
  })

  it("derives active tone without local visual ternaries", () => {
    expect(activeTone(true)).toBe("accent")
    expect(activeTone(false)).toBe("")
  })
})
