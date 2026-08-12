import { describe, expect, test } from "bun:test"
import { renderOverlaySizeContractStyle } from "../script/overlay-size-contract"

describe("overlay size contract", () => {
  test("renders the configured minimum width-to-height ratio", () => {
    const style = renderOverlaySizeContractStyle({ minWidth: 1120, minHeight: 720 })
    expect(style).toContain(
      "--ui-overlay-min-aspect-ratio: calc(var(--ui-overlay-min-width-units) / var(--ui-overlay-min-height-units));",
    )
  })
})
