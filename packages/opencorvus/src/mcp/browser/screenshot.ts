type Page = {
  screenshot(options: { type: "png"; scale: "css"; timeout?: number }): Promise<Buffer>
}

export type BrowserMcpScreenshot = {
  data: string
  buffer: Buffer
  width: number
  height: number
}

export class BrowserMcpScreenshotTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BrowserMcpScreenshotTimeoutError"
  }
}

export const pngDimensionsStrict = (buf: Buffer): { width: number; height: number } => {
  if (
    buf.length < 24 ||
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47 ||
    buf[4] !== 0x0d ||
    buf[5] !== 0x0a ||
    buf[6] !== 0x1a ||
    buf[7] !== 0x0a
  ) {
    throw new Error("Browser MCP screenshot is not a PNG")
  }
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  if (width <= 0 || height <= 0) throw new Error(`Browser MCP screenshot has invalid dimensions ${width}x${height}`)
  return { width, height }
}

export const captureBrowserMcpViewportScreenshot = async (
  page: Page,
  options: { timeoutMs?: number } = {},
): Promise<BrowserMcpScreenshot> => {
  let buffer: Buffer
  try {
    buffer = await page.screenshot({ type: "png", scale: "css", timeout: options.timeoutMs })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new BrowserMcpScreenshotTimeoutError(error.message)
    }
    throw error
  }
  const { width, height } = pngDimensionsStrict(buffer)
  return { data: buffer.toString("base64"), buffer, width, height }
}
