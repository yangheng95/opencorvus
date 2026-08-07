export interface ComposerTextareaResizeBounds {
  min: number
  max: number
  step: number
}

const COMPOSER_TEXTAREA_MIN_HEIGHT = 42
const COMPOSER_TEXTAREA_MAX_HEIGHT = 260
const COMPOSER_TEXTAREA_KEYBOARD_STEP = 16

export function composerTextareaResizeBounds(scale: number): ComposerTextareaResizeBounds {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1
  return {
    min: COMPOSER_TEXTAREA_MIN_HEIGHT * factor,
    max: COMPOSER_TEXTAREA_MAX_HEIGHT * factor,
    step: COMPOSER_TEXTAREA_KEYBOARD_STEP * factor,
  }
}

export function clampComposerTextareaHeight(height: number, bounds: ComposerTextareaResizeBounds): number {
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, height)))
}

export function nextComposerTextareaKeyboardHeight(
  height: number,
  key: string,
  bounds: ComposerTextareaResizeBounds,
): number | undefined {
  switch (key) {
    case "ArrowUp":
      return clampComposerTextareaHeight(height + bounds.step, bounds)
    case "ArrowDown":
      return clampComposerTextareaHeight(height - bounds.step, bounds)
    case "Home":
      return clampComposerTextareaHeight(bounds.min, bounds)
    case "End":
      return clampComposerTextareaHeight(bounds.max, bounds)
    default:
      return undefined
  }
}
