type Page = any

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
  const cdp = await page.context().newCDPSession(page)
  try {
    const capture = cdp.send("Page.captureScreenshot", { format: "png" }) as Promise<{ data: string }>
    const { data } =
      options.timeoutMs === undefined
        ? await capture
        : await Promise.race([
            capture,
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new BrowserMcpScreenshotTimeoutError(
                      `screenshot capture inactive for ${options.timeoutMs}ms`,
                    ),
                  ),
                options.timeoutMs,
              ),
            ),
          ])
    const buffer = Buffer.from(data, "base64")
    const { width, height } = pngDimensionsStrict(buffer)
    return { data, buffer, width, height }
  } finally {
    await cdp.detach().catch(() => undefined)
  }
}
