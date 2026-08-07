export const CONFIG_SIDEBAR_MIN_WIDTH = 140
export const CONFIG_SIDEBAR_MAX_WIDTH = 444
export const CONFIG_SIDEBAR_KEYBOARD_STEP = 16

export type ConfigSidebarResizeBounds = {
  min: number
  max: number
  step: number
}

export function configSidebarResizeBounds(scale: number): ConfigSidebarResizeBounds {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`Config sidebar resize scale must be a positive finite number: ${scale}`)
  }
  return {
    min: CONFIG_SIDEBAR_MIN_WIDTH * scale,
    max: CONFIG_SIDEBAR_MAX_WIDTH * scale,
    step: CONFIG_SIDEBAR_KEYBOARD_STEP * scale,
  }
}

export function clampConfigSidebarWidth(width: number, bounds: ConfigSidebarResizeBounds): number {
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, width)))
}

export function nextConfigSidebarKeyboardWidth(
  width: number,
  key: string,
  bounds: ConfigSidebarResizeBounds,
): number | undefined {
  switch (key) {
    case "ArrowLeft":
      return clampConfigSidebarWidth(width - bounds.step, bounds)
    case "ArrowRight":
      return clampConfigSidebarWidth(width + bounds.step, bounds)
    case "Home":
      return clampConfigSidebarWidth(bounds.min, bounds)
    case "End":
      return clampConfigSidebarWidth(bounds.max, bounds)
  }
  return undefined
}
