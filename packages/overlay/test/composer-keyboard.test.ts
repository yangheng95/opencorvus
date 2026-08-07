import { describe, expect, test } from "bun:test"

import { isComposerImeKeyboardEvent } from "../src/services/composer-keyboard"

describe("Composer Input Method Editor keyboard ownership", () => {
  test("keeps standards-based composition events inside the input method", () => {
    expect(isComposerImeKeyboardEvent({ isComposing: true, keyCode: 13 })).toBe(true)
  })

  test("keeps macOS WebKit process-key events inside the input method after compositionend", () => {
    expect(isComposerImeKeyboardEvent({ isComposing: false, keyCode: 229 })).toBe(true)
  })

  test("leaves a later ordinary Enter available to Composer submission", () => {
    expect(isComposerImeKeyboardEvent({ isComposing: false, keyCode: 13 })).toBe(false)
  })
})
