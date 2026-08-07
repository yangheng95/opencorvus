/**
 * URL → `ExtractedPage` — Browser Runtime DOM traversal + ~33 CSS computed
 * style fields + optional screenshot + optional image download.
 *
 * Browser DOM capture implementation details:
 *   - Uses opencorvus `findBrowserExecutable` (single browser-lifecycle
 *     policy shared with `browser/webpage/render.ts`,
 *     `runtime/visual-page.ts`).
 *   - Logs structured extraction failures through the webpage evidence logger.
 *   - Throws `UrlExtractError` (typed) on 401/403/429 + browser infra failures.
 *   - Owns image-download constants locally so capture behavior has one source.
 *
 * **Atomic tool guarantee**: this module does not compile source handoff,
 * analyze visual segments, or run visual verification.
 */

import { dirname, resolve } from "node:path"
import type { ToolFiles } from "@opencorvus-ai/plugin"

import { BrowserRuntime } from "@/browser/runtime"
import { BrowserNodeSidecarError, runTaskBrowserNodeSidecar } from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { defaultWebpageEvidenceViewport } from "@/browser/webpage/default-viewport"
import { Log } from "@/util/log"
import {
  ExtractedPageSchema,
  type ExtractedPage,
  type ExtractedElement,
  type ExtractedStyles,
} from "@/browser/webpage/extracted-page"
import { UrlExtractError } from "./errors"
import { ExecutionCapsuleRuntimeUnavailableError } from "@/execution-capsule/runtime"
import { resolveTaskProcessExecution } from "@/engine/task-execution-capsule-binding"

const log = Log.create({ service: "webpage-evidence.url.extract" })

// ─── Image-download constants ────────────────────────────────────────────

const IMAGE_DOWNLOAD_MAX_COUNT = 200
const IMAGE_DOWNLOAD_MAX_SIZE_BYTES = 2 * 1024 * 1024
const IMAGE_DOWNLOAD_MAX_TOTAL_BYTES = 20 * 1024 * 1024
const IMAGE_DOWNLOAD_CONCURRENCY = 6
const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000
const INLINE_IMAGE_DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i
const CSS_URL_RE = /url\(["']?(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)["']?\)/

// ─── Extraction constants ────────────────────────────────────────────────

const STYLE_PROPERTIES: (keyof ExtractedStyles)[] = [
  "display",
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "gap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "position",
  "overflow",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "margin",
  "padding",
  "backgroundColor",
  "backgroundImage",
  "border",
  "borderRadius",
  "boxShadow",
  "opacity",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "textDecoration",
]

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "BR", "WBR", "TEMPLATE"])
const MAX_DEPTH = 50
const MAX_CHILDREN = 200
const MAX_TEXT_LEN = 500

// ─── page.evaluate payload: DOM walker ───────────────────────────────────

/**
 * Runs inside the browser context via `page.evaluate()`. Must be
 * self-contained — NO references to outer scope. Return value must be
 * JSON-serialisable (no `Set`/`Map`).
 *
 * Keep screenshot/network-trigger timing stable so benchmark outputs are
 * reproducible across runs.
 */
function browserExtract(args: {
  scopeSelector: string | null
  maxDepth: number
  maxChildren: number
  maxTextLen: number
  styleProps: string[]
  skipTags: string[]
}): {
  tree: ExtractedElement[]
  totalElements: number
  extractedElements: number
  colors: Record<string, number>
  fonts: string[]
  customProperties: Record<string, string>
  images: Array<{ src: string; alt?: string }>
  icons: Array<{ src: string; type: "svg" | "icon-font" | "img" }>
} {
  const { scopeSelector, maxDepth, maxChildren, maxTextLen, styleProps, skipTags } = args
  const skipSet = new Set(skipTags)
  let totalElements = 0
  let extractedElements = 0
  const colorFreq: Record<string, number> = {}
  const fontList: string[] = []
  const fontSeen: Record<string, boolean> = {}
  const imageList: Array<{ src: string; alt?: string }> = []
  const iconList: Array<{ src: string; type: "svg" | "icon-font" | "img" }> = []

  function addColor(c: string) {
    if (!c || c === "rgba(0, 0, 0, 0)" || c === "transparent") return
    colorFreq[c] = (colorFreq[c] || 0) + 1
  }

  function inferRole(el: Element): ExtractedElement["role"] | undefined {
    const tag = el.tagName.toLowerCase()
    if (tag === "header") return "header"
    if (tag === "nav") return "nav"
    if (tag === "main") return "main"
    if (tag === "section") return "section"
    if (tag === "aside") return "aside"
    if (tag === "footer") return "footer"
    if (tag === "form") return "form"
    if (tag === "ul" || tag === "ol") return "list"

    const cls = el.className?.toString?.() || ""
    if (/\b(card)\b/i.test(cls)) return "card"
    if (/\b(hero)\b/i.test(cls)) return "hero"
    if (/\b(grid)\b/i.test(cls)) return "grid"
    if (/\b(nav)\b/i.test(cls)) return "nav"
    if (/\b(footer)\b/i.test(cls)) return "footer"
    if (/\b(header)\b/i.test(cls)) return "header"
    if (/\b(form)\b/i.test(cls)) return "form"

    return undefined
  }

  function getSelector(el: Element): string {
    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ""
    const cls =
      el.className
        ?.toString?.()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((c: string) => `.${c}`)
        .join("") || ""
    return `${tag}${id}${cls}`
  }

  function isVisible(el: Element, cs: CSSStyleDeclaration): boolean {
    if (cs.display === "none") return false
    if (cs.visibility === "hidden") return false
    if (el.getAttribute("aria-hidden") === "true") return false
    const rect = el.getBoundingClientRect()
    const tag = el.tagName
    if (rect.width === 0 && rect.height === 0 && tag !== "PICTURE" && tag !== "SPAN") return false
    return true
  }

  function getDirectText(el: Element): string | undefined {
    let text = ""
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent || ""
      }
    }
    text = text.trim()
    if (!text) return undefined
    return text.length > maxTextLen ? text.slice(0, maxTextLen) + "..." : text
  }

  function extractElement(el: Element, depth: number): ExtractedElement | null {
    totalElements++
    if (depth > maxDepth) return null
    if (skipSet.has(el.tagName)) return null

    const cs = window.getComputedStyle(el)
    if (!isVisible(el, cs)) return null

    extractedElements++
    const rect = el.getBoundingClientRect()
    const selector = getSelector(el)
    const tag = el.tagName.toLowerCase()

    const styles: Record<string, string | undefined> = {}
    for (const prop of styleProps) {
      const val = cs.getPropertyValue(prop.replace(/[A-Z]/g, (m: string) => `-${m.toLowerCase()}`))
      if (
        val &&
        val !== "" &&
        val !== "normal" &&
        val !== "none" &&
        val !== "auto" &&
        val !== "0px" &&
        val !== "rgba(0, 0, 0, 0)"
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(styles as any)[prop] = val
      }
    }

    styles.display = cs.display
    if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") styles.backgroundColor = cs.backgroundColor
    if (cs.color) styles.color = cs.color

    addColor(cs.backgroundColor)
    addColor(cs.color)

    const fontFamily = cs.fontFamily
    if (fontFamily) {
      const primary = fontFamily.split(",")[0].replace(/['"]/g, "").trim()
      if (primary && !fontSeen[primary]) {
        fontSeen[primary] = true
        fontList.push(primary)
      }
    }

    const role = inferRole(el)
    const text = getDirectText(el)

    const classes = el.className?.toString?.().split(/\s+/).filter(Boolean)

    let imageSrc: string | undefined
    let imageAlt: string | undefined
    if (tag === "img") {
      const imgEl = el as HTMLImageElement
      imageSrc =
        (imgEl.currentSrc && imgEl.currentSrc !== window.location.href ? imgEl.currentSrc : undefined) ||
        imgEl.getAttribute("data-src") ||
        imgEl.getAttribute("data-original") ||
        imgEl.getAttribute("data-lazy") ||
        imgEl.getAttribute("data-url") ||
        imgEl.getAttribute("data-img") ||
        imgEl.src ||
        undefined
      imageAlt = imgEl.alt
      if (imageSrc) imageList.push({ src: imageSrc, alt: imageAlt })
    }

    if (tag === "video") {
      const video = el as HTMLVideoElement
      const videoSrc = video.src || video.querySelector("source")?.src || undefined
      const videoPoster = video.poster || undefined
      imageSrc = videoPoster || videoSrc
      imageAlt = videoPoster ? `video: ${videoPoster}` : "video"
      if (videoSrc) imageList.push({ src: videoSrc, alt: imageAlt })
      if (videoPoster && videoPoster !== videoSrc) imageList.push({ src: videoPoster, alt: `poster: ${videoPoster}` })
    }

    if (tag === "canvas") {
      const canvas = el as HTMLCanvasElement
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          const canvasUrl = canvas.toDataURL("image/png")
          if (canvasUrl && canvasUrl !== "data:,") {
            imageSrc = canvasUrl
            imageAlt = "canvas capture"
            imageList.push({ src: canvasUrl, alt: imageAlt })
          }
        } catch {
          // Tainted canvas: keep the measured canvas element in the tree.
        }
      }
    }

    if (!imageSrc) {
      const bgImage = cs.backgroundImage
      if (bgImage && bgImage !== "none") {
        const bgUrlMatch = bgImage.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/)
        if (bgUrlMatch) {
          imageSrc = bgUrlMatch[1]
          imageList.push({ src: imageSrc, alt: `bg: ${tag}` })
        }
      }
    }

    if (tag === "svg") {
      iconList.push({ src: selector, type: "svg" })
    }

    if (tag === "i" && classes && classes.length > 0) {
      const iconClass = classes.find((c: string) => /^fa[a-z]?-/.test(c))
      if (iconClass) {
        iconList.push({ src: iconClass, type: "icon-font" })
      }
    }

    let href: string | undefined
    if (tag === "a") {
      href = (el as HTMLAnchorElement).href
    }

    let aria: Record<string, string> | undefined
    const ariaAttrs = Array.from(el.attributes).filter((a) => a.name.startsWith("aria-"))
    if (ariaAttrs.length > 0) {
      aria = {}
      for (const a of ariaAttrs) aria[a.name] = a.value
    }

    let attrs: Record<string, string> | undefined
    for (const a of el.attributes) {
      if (a.name === "class" || a.name === "style" || a.name.startsWith("aria-")) continue
      if (a.value.length > 300) continue
      if (!attrs) attrs = {}
      attrs[a.name] = a.value
    }

    const visibleChildren = Array.from(el.children).filter((c) => !skipSet.has(c.tagName))
    let childElements: ExtractedElement[] | undefined

    if (visibleChildren.length > 0) {
      const processed: ExtractedElement[] = []
      const limit = Math.min(visibleChildren.length, maxChildren)
      for (let i = 0; i < limit; i++) {
        const child = extractElement(visibleChildren[i], depth + 1)
        if (child) processed.push(child)
      }
      if (processed.length > 0) childElements = processed
    }

    return {
      selector,
      tag,
      role: role || undefined,
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      styles: styles as ExtractedStyles,
      text: text || undefined,
      imageSrc,
      imageAlt,
      href,
      aria,
      attrs,
      classes: classes && classes.length > 0 ? classes : undefined,
      children: childElements,
    }
  }

  const customProperties: Record<string, string> = {}
  try {
    const sheets = document.styleSheets
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j] as CSSStyleRule
          if (rule.selectorText === ":root" || rule.selectorText === "html") {
            for (let k = 0; k < rule.style.length; k++) {
              const prop = rule.style[k]
              if (prop.startsWith("--")) {
                customProperties[prop] = rule.style.getPropertyValue(prop).trim()
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheet — skip.
      }
    }
  } catch {
    // Cannot access stylesheets at all.
  }

  const root = scopeSelector ? document.querySelector(scopeSelector) : document.body
  if (!root) {
    return {
      tree: [],
      totalElements,
      extractedElements,
      colors: colorFreq,
      fonts: fontList,
      customProperties,
      images: imageList,
      icons: iconList,
    }
  }

  const tree: ExtractedElement[] = []
  const topChildren = Array.from(root.children)
  for (const child of topChildren) {
    const extracted = extractElement(child, 0)
    if (extracted) tree.push(extracted)
  }

  return {
    tree,
    totalElements,
    extractedElements,
    colors: colorFreq,
    fonts: fontList,
    customProperties,
    images: imageList,
    icons: iconList,
  }
}

// ─── Image download ───────────────────────────────────────────────────────

function mimeToExt(mime: string): string {
  if (mime.includes("png")) return "png"
  if (mime.includes("gif")) return "gif"
  if (mime.includes("webp")) return "webp"
  if (mime.includes("svg")) return "svg"
  if (mime.includes("bmp")) return "bmp"
  if (mime.includes("ico")) return "ico"
  if (mime.includes("avif")) return "avif"
  return "jpg"
}

async function nodeDownloadImages(
  processIdentity: Readonly<{ taskID: string; cwd: string }>,
  urls: string[],
  outputDir: string,
  files: ToolFiles,
  signal: AbortSignal | undefined,
  onProgress: ((msg: string) => void) | undefined,
): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {}
  const imagesDir = resolve(outputDir, "images")
  await files.mkdir(imagesDir, { recursive: true })

  let totalBytes = 0
  let downloaded = 0
  let skipped = 0

  for (let i = 0; i < urls.length; i += IMAGE_DOWNLOAD_CONCURRENCY) {
    const batch = urls.slice(i, i + IMAGE_DOWNLOAD_CONCURRENCY)
    const sidecar = await runTaskBrowserNodeSidecar<
      Array<{ url: string; error: string } | { url: string; bytes: string; mime: string }>
    >(processIdentity, {
      script: String.raw`
const payload = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));
Promise.all(payload.urls.map(async (url) => {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": payload.userAgent },
      signal: AbortSignal.timeout(payload.timeoutMs),
    });
    if (!response.ok) return { url, error: "HTTP " + response.status };
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return { url, error: "non-image content-type " + (contentType || "(missing)") };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) return { url, error: "empty image response" };
    if (bytes.length > payload.maxBytes) return { url, error: "image size " + bytes.length + " exceeds " + payload.maxBytes };
    return { url, bytes: bytes.toString("base64"), mime: contentType.split(";")[0] };
  } catch (error) {
    return { url, error: error instanceof Error ? error.message : String(error) };
  }
})).then((result) => process.stdout.write(JSON.stringify(result)));
`,
      payload: {
        urls: batch,
        timeoutMs: IMAGE_DOWNLOAD_TIMEOUT_MS,
        maxBytes: IMAGE_DOWNLOAD_MAX_SIZE_BYTES,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      inactivityTimeoutMs: IMAGE_DOWNLOAD_TIMEOUT_MS,
      signal,
      label: "webpage image download",
    })
    const results = sidecar.result.map((item) =>
      "error" in item ? item : { url: item.url, buf: Buffer.from(item.bytes, "base64"), mime: item.mime },
    )

    for (const r of results) {
      if ("error" in r) {
        skipped++
        onProgress?.(`skipped image ${r.url}: ${r.error}`)
        continue
      }
      if (totalBytes + r.buf.length > IMAGE_DOWNLOAD_MAX_TOTAL_BYTES) {
        skipped++
        onProgress?.(
          `skipped image ${r.url}: image download total bytes would exceed ${IMAGE_DOWNLOAD_MAX_TOTAL_BYTES}`,
        )
        continue
      }
      const ext = mimeToExt(r.mime)
      const fileName = `img-${downloaded}.${ext}`
      await files.writeFile(resolve(imagesDir, fileName), r.buf)
      imageMap[r.url] = `images/${fileName}`
      totalBytes += r.buf.length
      downloaded++
    }
  }

  if (downloaded > 0) onProgress?.(`saved ${downloaded} images (${(totalBytes / 1024).toFixed(0)}KB)`)
  if (skipped > 0) onProgress?.(`skipped ${skipped} unavailable images`)
  return imageMap
}

// ─── Public API ──────────────────────────────────────────────────────────

function decodeInlineImageDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | undefined {
  const match = INLINE_IMAGE_DATA_URL_RE.exec(dataUrl)
  if (!match) return undefined
  return { mime: match[1]!, bytes: Buffer.from(match[2]!, "base64") }
}

async function writeCategorizedInlineImage(input: {
  outputDir: string
  category: "canvas" | "background" | "inline"
  source: string
  index: number
  files: ToolFiles
}): Promise<string | undefined> {
  const decoded = decodeInlineImageDataUrl(input.source)
  if (!decoded || decoded.bytes.length === 0) return undefined
  if (decoded.bytes.length > IMAGE_DOWNLOAD_MAX_SIZE_BYTES) {
    throw new UrlExtractError({
      url: "inline-image",
      reason: `inline image size ${decoded.bytes.length} exceeds ${IMAGE_DOWNLOAD_MAX_SIZE_BYTES}`,
      phase: "asset",
    })
  }
  const ext = mimeToExt(decoded.mime)
  const dir = resolve(input.outputDir, "images", input.category)
  await input.files.mkdir(dir, { recursive: true })
  const fileName = `${input.category}-${input.index}.${ext}`
  await input.files.writeFile(resolve(dir, fileName), decoded.bytes)
  return `images/${input.category}/${fileName}`
}

function classifyInlineImage(alt?: string): "canvas" | "background" | "inline" {
  if (alt === "canvas capture") return "canvas"
  if (alt?.startsWith("bg:")) return "background"
  return "inline"
}

async function mapInlineImage(input: {
  source: string
  alt?: string
  outputDir: string
  imageMap: Record<string, string>
  counters: Record<"canvas" | "background" | "inline", number>
  files: ToolFiles
}): Promise<string | undefined> {
  if (!INLINE_IMAGE_DATA_URL_RE.test(input.source)) return undefined
  const category = classifyInlineImage(input.alt)
  const key = `${category}:${input.source}`
  if (input.imageMap[key]) return input.imageMap[key]
  const rel = await writeCategorizedInlineImage({
    outputDir: input.outputDir,
    category,
    source: input.source,
    index: input.counters[category]++,
    files: input.files,
  })
  if (rel) input.imageMap[key] = rel
  return rel
}

async function materializeScreenshot(input: {
  outputDir: string
  dataUrl: string | undefined
  relPath: string
  files: ToolFiles
}): Promise<string | undefined> {
  if (!input.dataUrl) return undefined
  const decoded = decodeInlineImageDataUrl(input.dataUrl)
  if (!decoded) return input.dataUrl
  const abs = resolve(input.outputDir, input.relPath)
  await input.files.mkdir(dirname(abs), { recursive: true })
  await input.files.writeFile(abs, decoded.bytes)
  return input.relPath.replace(/\\/g, "/")
}

async function localizeElementInlineImages(
  element: ExtractedElement,
  outputDir: string,
  imageMap: Record<string, string>,
  counters: Record<"canvas" | "background" | "inline", number>,
  files: ToolFiles,
): Promise<ExtractedElement> {
  const next: ExtractedElement = {
    ...element,
    styles: { ...element.styles },
    attrs: element.attrs ? { ...element.attrs } : undefined,
    aria: element.aria ? { ...element.aria } : undefined,
    classes: element.classes ? [...element.classes] : undefined,
  }

  if (next.imageSrc) {
    const rel = await mapInlineImage({
      source: next.imageSrc,
      alt: next.imageAlt,
      outputDir,
      imageMap,
      counters,
      files,
    })
    if (rel) next.imageSrc = rel
  }

  const bgMatch = next.styles.backgroundImage ? CSS_URL_RE.exec(next.styles.backgroundImage) : undefined
  if (bgMatch) {
    const source = bgMatch[1]!
    const rel = await mapInlineImage({
      source,
      alt: `bg: ${next.tag}`,
      outputDir,
      imageMap,
      counters,
      files,
    })
    if (rel) next.styles.backgroundImage = next.styles.backgroundImage!.replace(source, rel)
  }

  if (next.children) {
    next.children = await Promise.all(
      next.children.map((child) => localizeElementInlineImages(child, outputDir, imageMap, counters, files)),
    )
  }
  return next
}

export async function materializeInlineExtractedPageAssets(
  page: ExtractedPage,
  outputDir: string,
  files: ToolFiles,
  processIdentity: Readonly<{ taskID: string; cwd: string }>,
): Promise<ExtractedPage> {
  const imageMap: Record<string, string> = { ...(page.assets.imageMap ?? {}) }
  const counters = { canvas: 0, background: 0, inline: 0 }

  for (const image of page.assets.images) {
    await mapInlineImage({
      source: image.src,
      alt: image.alt,
      outputDir,
      imageMap,
      counters,
      files,
    })
  }

  const tree = await Promise.all(
    page.tree.map((element) => localizeElementInlineImages(element, outputDir, imageMap, counters, files)),
  )
  const images = page.assets.images.map((image) => ({
    ...image,
    src: imageMap[`${classifyInlineImage(image.alt)}:${image.src}`] ?? imageMap[image.src] ?? image.src,
  }))
  const persistedImageMap = Object.fromEntries(
    Object.entries(imageMap).filter(
      ([source, target]) => !source.includes("data:image/") && !target.includes("data:image/"),
    ),
  )

  return ExtractedPageSchema.parse({
    ...page,
    screenshotUrl:
      (await materializeScreenshot({
        outputDir,
        dataUrl: page.screenshotUrl,
        relPath: "screenshots/full.png",
        files,
      })) ?? page.screenshotUrl,
    screenshotAboveFold:
      (await materializeScreenshot({
        outputDir,
        dataUrl: page.screenshotAboveFold,
        relPath: "screenshots/above-fold.png",
        files,
      })) ?? page.screenshotAboveFold,
    tree,
    assets: {
      ...page.assets,
      images,
      imageMap: persistedImageMap,
    },
  })
}

export interface ExtractPageInput {
  processIdentity: Readonly<{ taskID: string; cwd: string }>
  url: string
  viewport?: { width: number; height: number }
  browserProxy?: BrowserRuntime.BrowserProxyConfig
  /** CSS selector scoping the extraction; default body. */
  scopeSelector?: string | null
  /** Post-DOM settle wait (ms), default 2000. */
  waitMs?: number
  /** Skip the full-page + above-fold screenshots (non-deterministic). */
  noScreenshots?: boolean
  /** When provided, downloads referenced images into `<dir>/images/` and populates `assets.imageMap`. */
  outputDir?: string
  /** When provided, writes the post-load archive HTML snapshot for canonical structure IR compilation. */
  captureHtmlPath?: string
  /** When false, only screenshots and inline images are materialized under outputDir. */
  downloadImages?: boolean
  files: ToolFiles
  onProgress?: (msg: string) => void
  signal?: AbortSignal
}

type NodeExtractInput = {
  url: string
  viewport: { width: number; height: number }
  scopeSelector: string | null
  waitMs: number
  noScreenshots: boolean
  captureHtml: boolean
  executablePath: string
  nodeExecutable: string
  playwrightRequirePath: string
  launchArgs: string[]
  launchTimeoutMs: number
  navigationTimeoutMs: number
  browserProxy?: BrowserRuntime.BrowserProxyConfig
  browserExtractSource: string
  maxDepth: number
  maxChildren: number
  maxTextLen: number
  styleProps: string[]
  skipTags: string[]
}

type NodeExtractResult =
  | {
      ok: true
      title: string
      screenshotUrl: string
      screenshotAboveFold?: string
      html?: string
      result: ReturnType<typeof browserExtract>
    }
  | {
      ok: false
      phase: "launch" | "navigate" | "evaluate" | "screenshot" | "close"
      message: string
      status?: number
      stack?: string
    }

/**
 * Launch a headless browser, navigate to `url`, extract the DOM + computed
 * styles + token inventory + assets into a validated `ExtractedPage`.
 *
 * @throws {UrlExtractError} when browser launch fails, navigation fails,
 * the target returns HTTP 401/403/429, or the evaluate/screenshot step
 * throws.
 */
export async function extractPage(input: ExtractPageInput): Promise<ExtractedPage> {
  const {
    url,
    viewport = defaultWebpageEvidenceViewport(),
    scopeSelector = null,
    waitMs = 2000,
    noScreenshots = false,
    outputDir,
    captureHtmlPath,
    downloadImages = true,
    onProgress,
    signal,
  } = input
  const browserProxy = input.browserProxy ?? BrowserRuntime.resolveBrowserProxyConfig()
  const execution = await resolveTaskProcessExecution(input.processIdentity)
  if (execution.kind === "task_capsule" && (browserProxy?.username || browserProxy?.password)) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      "Task Browser Capsule does not expose proxy credentials to model-controlled processes",
    )
  }

  onProgress?.(`Extracting URL: ${url}`)
  onProgress?.(`Viewport: ${viewport.width}x${viewport.height}`)
  if (scopeSelector) onProgress?.(`Scope: ${scopeSelector}`)

  const startTime = Date.now()

  const chromePath = await BrowserRuntime.findBrowserExecutable()
  onProgress?.(`Browser: ${chromePath}`)

  const sidecarRuntime = await resolveBrowserNodeSidecarRuntime()
  const nodeResult = await extractPageViaNode(
    input.processIdentity,
    {
      url,
      viewport,
      scopeSelector,
      waitMs,
      noScreenshots,
      captureHtml: Boolean(captureHtmlPath),
      executablePath: chromePath,
      nodeExecutable: sidecarRuntime.nodeExecutable,
      playwrightRequirePath: sidecarRuntime.playwrightRequirePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs({
        proxyServer: browserProxy?.server,
        extraArgs: [
          "--disable-extensions",
          "--disable-background-networking",
          `--window-size=${viewport.width},${viewport.height}`,
        ],
      }),
      launchTimeoutMs: BrowserRuntime.resolveBrowserLaunchTimeoutMs(),
      navigationTimeoutMs: 60_000,
      browserProxy,
      browserExtractSource: browserExtract.toString(),
      maxDepth: MAX_DEPTH,
      maxChildren: MAX_CHILDREN,
      maxTextLen: MAX_TEXT_LEN,
      styleProps: STYLE_PROPERTIES as string[],
      skipTags: Array.from(SKIP_TAGS),
    },
    signal,
  )

  if (!nodeResult.ok) {
    throw new UrlExtractError(
      {
        url,
        reason: nodeResult.message,
        phase: nodeResult.phase,
        ...(nodeResult.status ? { status: nodeResult.status } : {}),
      } as never,
      { cause: nodeResult.stack ? new Error(nodeResult.stack) : undefined },
    )
  }

  if (captureHtmlPath && nodeResult.html !== undefined) {
    try {
      await input.files.mkdir(dirname(captureHtmlPath), { recursive: true })
      await input.files.writeFile(captureHtmlPath, nodeResult.html, "utf8")
      onProgress?.(`Captured HTML snapshot (${(Buffer.byteLength(nodeResult.html, "utf8") / 1024).toFixed(0)}KB)`)
    } catch (err) {
      throw new UrlExtractError(
        { url, reason: err instanceof Error ? err.message : String(err), phase: "evaluate" },
        { cause: err },
      )
    }
  }

  const title = nodeResult.title
  onProgress?.(`Title: ${title}`)
  const screenshotUrl = nodeResult.screenshotUrl
  const screenshotAboveFold = nodeResult.screenshotAboveFold
  const result = nodeResult.result
  const extractionTimeMs = Date.now() - startTime

  const colorEntries = Object.entries(result.colors as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  const colors: Record<string, string> = {}
  for (const [color, count] of colorEntries) colors[color] = `${count}x`

  let imageMap: Record<string, string> | undefined
  if (outputDir && downloadImages) {
    const allImages = result.images
    const seen = new Set<string>()
    const downloadUrls: string[] = []
    for (const img of allImages) {
      if (!img.src || seen.has(img.src)) continue
      if (!img.src.startsWith("http://") && !img.src.startsWith("https://")) continue
      seen.add(img.src)
      downloadUrls.push(img.src)
      if (downloadUrls.length >= IMAGE_DOWNLOAD_MAX_COUNT) break
    }

    if (downloadUrls.length > 0) {
      onProgress?.(`Downloading ${downloadUrls.length} images (Node-side)...`)
      try {
        imageMap = await nodeDownloadImages(input.processIdentity, downloadUrls, outputDir, input.files, signal, onProgress)
        onProgress?.(`Downloaded ${Object.keys(imageMap).length}/${downloadUrls.length} images`)
      } catch (err) {
        if (UrlExtractError.isInstance(err)) throw err
        throw new UrlExtractError(
          {
            url,
            reason: err instanceof Error ? err.message : String(err),
            phase: "asset",
          },
          { cause: err },
        )
      }
    }
  }

  const extractedPage: ExtractedPage = {
    url,
    title,
    viewport,
    screenshotUrl,
    screenshotAboveFold,
    tree: result.tree,
    tokens: {
      colors,
      fonts: result.fonts,
      customProperties: result.customProperties,
    },
    assets: {
      images: result.images,
      icons: result.icons,
      imageMap,
    },
    stats: {
      totalElements: result.totalElements,
      extractedElements: result.extractedElements,
      imageCount: result.images.length,
      extractionTimeMs,
    },
  }

  const materializedPage = outputDir
    ? await materializeInlineExtractedPageAssets(extractedPage, outputDir, input.files, input.processIdentity)
    : extractedPage

  onProgress?.(`Extracted: ${result.extractedElements}/${result.totalElements} elements`)
  onProgress?.(`Colors: ${colorEntries.length}, Fonts: ${result.fonts.length}`)
  onProgress?.(`Images: ${result.images.length}, Icons: ${result.icons.length}`)
  onProgress?.(`Time: ${extractionTimeMs}ms`)

  return ExtractedPageSchema.parse(materializedPage)
}

async function extractPageViaNode(
  processIdentity: Readonly<{ taskID: string; cwd: string }>,
  input: NodeExtractInput,
  signal?: AbortSignal,
): Promise<NodeExtractResult> {
  const inactivityTimeoutMs = input.launchTimeoutMs + input.navigationTimeoutMs + input.waitMs + 30_000
  try {
    const run = await runTaskBrowserNodeSidecar<NodeExtractResult>(processIdentity, {
      runtime: {
        nodeExecutable: input.nodeExecutable,
        playwrightRequirePath: input.playwrightRequirePath,
        packaged: false,
      },
      script: NODE_EXTRACT_SCRIPT,
      payload: input,
      inactivityTimeoutMs,
      signal,
      label: "Node webpage extract",
    })
    if (run.exitCode !== 0 && run.result.ok) {
      return {
        ok: false,
        phase: "evaluate",
        message: `Node webpage extract exited with ${run.signal ?? run.exitCode}. stderr=${run.stderr.trim()}`,
      }
    }
    return run.result
  } catch (error) {
    return {
      ok: false,
      phase: error instanceof BrowserNodeSidecarError && error.kind === "invalid_json" ? "evaluate" : "launch",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }
  }
}

const NODE_EXTRACT_SCRIPT = String.raw`
const { chromium } = require(process.argv[3] || "playwright");

function opencorvusActivityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

function opencorvusIsBrowserImplicitAssetRequest(rawUrl) {
  try {
    return new URL(rawUrl).pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

function opencorvusIsPrimaryNavigationRequest(payload) {
  const request = payload && typeof payload.request === "function" ? payload.request() : payload;
  return Boolean(request && typeof request.isNavigationRequest === "function" && request.isNavigationRequest());
}

function opencorvusRequestUrl(payload) {
  const request = payload && typeof payload.request === "function" ? payload.request() : payload;
  if (request && typeof request.url === "function") return request.url();
  if (payload && typeof payload.url === "function") return payload.url();
  return "";
}

function opencorvusResourceType(payload) {
  const request = payload && typeof payload.request === "function" ? payload.request() : payload;
  const type = request && typeof request.resourceType === "function" ? request.resourceType() : "";
  return type;
}

function opencorvusUrlScope(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "file:") return "file:";
    if (parsed.origin && parsed.origin !== "null") return parsed.origin;
    return "";
  } catch {
    return "";
  }
}

function opencorvusIsSameOrigin(pageUrl, rawUrl) {
  const pageScope = opencorvusUrlScope(pageUrl);
  const requestScope = opencorvusUrlScope(rawUrl);
  return Boolean(pageScope && requestScope && pageScope === requestScope);
}

function opencorvusIsCriticalPageRequestFailure(pageUrl, payload) {
  const url = opencorvusRequestUrl(payload);
  if (opencorvusIsBrowserImplicitAssetRequest(url)) return false;
  if (opencorvusIsPrimaryNavigationRequest(payload)) return true;
  if (!opencorvusIsSameOrigin(pageUrl, url)) return false;
  const type = opencorvusResourceType(payload);
  return (
    type === "document" ||
    type === "script" ||
    type === "stylesheet" ||
    type === "xhr" ||
    type === "fetch" ||
    type === "image" ||
    type === "media" ||
    type === "font"
  );
}

function opencorvusErrorStack(error) {
  if (error && typeof error.stack === "string") return error.stack;
  if (error && typeof error.message === "string") return error.message;
  return String(error || "");
}

function opencorvusIsSameOriginPageError(pageUrl, error) {
  const stack = opencorvusErrorStack(error);
  const scope = opencorvusUrlScope(pageUrl);
  return Boolean(scope && stack.includes(scope));
}

async function opencorvusWithBrowserInactivity(page, pageUrl, label, inactivityTimeoutMs, action) {
  let settled = false;
  let lastActivity = "start";
  let timer;
  let rejectInactive;
  let rejectFailure;
  const listeners = [];
  const inactive = new Promise((_, reject) => {
    rejectInactive = reject;
  });
  const browserFailure = new Promise((_, reject) => {
    rejectFailure = reject;
  });
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const reset = (source) => {
    if (settled) return;
    lastActivity = source;
    clearTimer();
    timer = setTimeout(() => {
      rejectInactive(new Error(label + " browser inactive for " + inactivityTimeoutMs + "ms after " + lastActivity));
    }, inactivityTimeoutMs);
  };
  const fail = (source) => {
    if (settled) return;
    rejectFailure(new Error(label + " Browser failures before URL extraction: " + source));
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => {
    reset(opencorvusActivityLabel("console", payload));
  });
  on("response", (payload) => {
    const status = typeof payload.status === "function" ? payload.status() : 0;
    const url = typeof payload.url === "function" ? payload.url() : "";
    if (
      status >= 400 &&
      status < 600 &&
      !opencorvusIsPrimaryNavigationRequest(payload) &&
      opencorvusIsCriticalPageRequestFailure(pageUrl, payload)
    ) {
      fail(opencorvusActivityLabel("response", payload) + " HTTP " + status);
      return;
    }
    reset(opencorvusActivityLabel("response", payload));
  });
  on("requestfailed", (payload) => {
    if (opencorvusIsCriticalPageRequestFailure(pageUrl, payload)) {
      fail(opencorvusActivityLabel("requestfailed", payload));
      return;
    }
    reset(opencorvusActivityLabel("requestfailed", payload));
  });
  on("pageerror", (payload) => {
    if (opencorvusIsSameOriginPageError(pageUrl, payload)) {
      fail(opencorvusActivityLabel("pageerror", payload));
      return;
    }
    reset(opencorvusActivityLabel("pageerror", payload));
  });
  reset("start");
  try {
    return await Promise.race([action(), inactive, browserFailure]);
  } finally {
    settled = true;
    clearTimer();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

async function main() {
  const input = JSON.parse(Buffer.from(process.argv[2] || "", "base64").toString("utf8"));
  let browser;
  let phase = "launch";
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: true,
      timeout: input.launchTimeoutMs,
      args: input.launchArgs,
    });
    const context = await browser.newContext({
      viewport: input.viewport,
      ...(input.browserProxy ? { proxy: input.browserProxy } : {}),
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      extraHTTPHeaders: { "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
    });
    const page = await context.newPage();
    const browserFailures = [];
    const assertNoBrowserFailures = (stage) => {
      if (browserFailures.length > 0) {
        throw new Error("Browser failures before URL extraction " + stage + ": " + browserFailures.join("; "));
      }
    };
    page.on("response", (res) => {
      const status = res.status();
      if (
        status >= 400 &&
        status < 600 &&
        !opencorvusIsPrimaryNavigationRequest(res) &&
        opencorvusIsCriticalPageRequestFailure(input.url, res)
      ) {
        browserFailures.push("response " + res.url() + " HTTP " + status);
      }
    });
    page.on("requestfailed", (req) => {
      if (opencorvusIsCriticalPageRequestFailure(input.url, req)) {
        browserFailures.push("requestfailed " + req.url() + " " + (req.failure()?.errorText || "request failed"));
      }
    });
    page.on("pageerror", (error) => {
      if (opencorvusIsSameOriginPageError(input.url, error)) {
        browserFailures.push("pageerror " + (error && error.message ? error.message : String(error)));
      }
    });

    phase = "navigate";
    const response = await opencorvusWithBrowserInactivity(
      page,
      input.url,
      "navigate " + input.url,
      input.navigationTimeoutMs,
      () => page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 0 }),
    );
    await opencorvusWithBrowserInactivity(
      page,
      input.url,
      "networkidle " + input.url,
      Math.min(5000, input.navigationTimeoutMs),
      () => page.waitForLoadState("networkidle", { timeout: 0 }),
    ).catch(() => undefined);
    const status = response ? response.status() : 0;
    if (status === 401 || status === 403) {
      return { ok: false,
        phase,
        status,
        message: "HTTP " + status + ": site denied access — provide a pre-extracted url-data.json instead",
      };
    }
    if (status === 429) {
      return { ok: false,
        phase,
        status,
        message: "HTTP 429: site is throttling — retry later",
      };
    }
    if (status >= 400) {
      return { ok: false,
        phase,
        status,
        message: "HTTP " + status + ": URL extraction requires a successful page response",
      };
    }
    assertNoBrowserFailures("navigation");

    await new Promise((resolve) => setTimeout(resolve, input.waitMs));
    assertNoBrowserFailures("wait");
    const title = await page.title();

    phase = "evaluate";
    await page.evaluate(async () => {
      await new Promise((resolve) => {
          const distance = 400
          const delay = 80
          const timer = setInterval(() => {
            window.scrollBy(0, distance)
            if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
              clearInterval(timer)
              window.scrollTo(0, 0)
              resolve()
            }
          }, delay)
          setTimeout(() => {
            clearInterval(timer)
            window.scrollTo(0, 0)
            resolve()
          }, 8000)
        })
    }).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 800));
    assertNoBrowserFailures("scroll");

    const html = input.captureHtml ? await page.content() : undefined;
    assertNoBrowserFailures("html");

    let screenshotUrl = ""
    let screenshotAboveFold

    if (!input.noScreenshots) {
      phase = "screenshot";
      assertNoBrowserFailures("screenshot");
      const fullScreenshot = Buffer.from(await page.screenshot({ fullPage: true, type: "png" }));
      assertNoBrowserFailures("screenshot");
      screenshotUrl = "data:image/png;base64," + fullScreenshot.toString("base64");
      const foldScreenshot = Buffer.from(await page.screenshot({ type: "png" }));
      assertNoBrowserFailures("screenshot");
      screenshotAboveFold = "data:image/png;base64," + foldScreenshot.toString("base64");
    }

    phase = "evaluate";
    assertNoBrowserFailures("evaluate");
    const browserExtract = Function("return (" + input.browserExtractSource + ")")();
    const result = await page.evaluate(browserExtract, {
      scopeSelector: input.scopeSelector,
      maxDepth: input.maxDepth,
      maxChildren: input.maxChildren,
      maxTextLen: input.maxTextLen,
      styleProps: input.styleProps,
      skipTags: input.skipTags,
    });
    assertNoBrowserFailures("artifact");

    return { ok: true, title, screenshotUrl, screenshotAboveFold, html, result };
  } catch (error) {
    return {
      ok: false,
      phase,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : undefined,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

main()
  .then((result) => process.stdout.write(JSON.stringify(result)))
  .catch((error) => {
    process.stdout.write(JSON.stringify({
      ok: false,
      phase: "launch",
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : undefined,
    }));
  });
`
