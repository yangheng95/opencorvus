import { normalizeBrowserPreviewUrl } from "./target"
import { isLoopbackBrowserPreviewUrl } from "./liveness"

const LOCAL_URL_TOKEN =
  /(?:^|[\s(<"'=])((?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d{1,5}(?:\/[^\s<>"'`]*)?)/gi
const ANSI_ESCAPE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const MAX_PREVIEW_OUTPUT_SCAN_CHARS = 65_536
const MAX_EXTRACTED_PREVIEW_URLS = 16

export function extractBrowserPreviewUrlFromText(text: string): string | undefined {
  return extractBrowserPreviewUrlsFromText(text)[0]
}

export function extractBrowserPreviewUrlsFromText(text: string): string[] {
  const clean = text.replace(ANSI_ESCAPE, "")
  const scan = clean.length > MAX_PREVIEW_OUTPUT_SCAN_CHARS ? clean.slice(-MAX_PREVIEW_OUTPUT_SCAN_CHARS) : clean
  const urls: string[] = []
  const seen = new Set<string>()
  for (const match of scan.matchAll(LOCAL_URL_TOKEN)) {
    const normalized = normalizeBrowserPreviewUrl(trimUrlToken(match[1]))
    if (!normalized) continue
    if (!isLoopbackBrowserPreviewUrl(normalized)) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    urls.push(normalized)
    if (urls.length >= MAX_EXTRACTED_PREVIEW_URLS) break
  }
  return urls
}

function trimUrlToken(token: string): string {
  return token.replace(/[),.;\]}]+$/g, "")
}
