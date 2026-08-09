export class InvalidWindowError extends RangeError {
  constructor(index) {
    super(`Invalid window at index ${index}`)
    this.name = "InvalidWindowError"
    this.code = "INVALID_WINDOW"
  }
}

export function mergeWindows(windows) {
  return windows.map((window) => ({ ...window, labels: [...window.labels] }))
}
