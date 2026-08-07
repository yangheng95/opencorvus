import { expect, test } from "bun:test"
import {
  clampComposerTextareaHeight,
  composerTextareaResizeBounds,
  nextComposerTextareaKeyboardHeight,
} from "../src/components/composer-resizer"

test("composer textarea resize bounds scale with UI density", () => {
  expect(composerTextareaResizeBounds(2)).toEqual({ min: 84, max: 520, step: 32 })
})

test("composer textarea keyboard resize clamps to shared bounds", () => {
  const bounds = composerTextareaResizeBounds(1)
  expect(clampComposerTextareaHeight(12, bounds)).toBe(42)
  expect(clampComposerTextareaHeight(999, bounds)).toBe(260)
  expect(nextComposerTextareaKeyboardHeight(100, "ArrowUp", bounds)).toBe(116)
  expect(nextComposerTextareaKeyboardHeight(100, "ArrowDown", bounds)).toBe(84)
  expect(nextComposerTextareaKeyboardHeight(100, "Home", bounds)).toBe(42)
  expect(nextComposerTextareaKeyboardHeight(100, "End", bounds)).toBe(260)
  expect(nextComposerTextareaKeyboardHeight(100, "Enter", bounds)).toBeUndefined()
})
