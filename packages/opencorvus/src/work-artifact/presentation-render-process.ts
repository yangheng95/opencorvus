import { requireRuntimePackage } from "../runtime/package-require"
import { parseFragment } from "parse5"

if (process.env.OPENCORVUS_INTERNAL_WORK_ARTIFACT_RENDERER !== "1") {
  throw new Error("Work Artifact renderer process requires internal authority")
}

const MAX_RENDER_SVG_BYTES = 20 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const OUTPUT_WIDTH = 1280
const OUTPUT_HEIGHT = 720
const MAX_FOREIGN_OBJECTS = 512
const MAX_TEXT_BLOCKS = 1024
const MAX_TEXT_CHARACTERS = 200_000
const MAX_TEXT_RASTER_HEIGHT = 100_000
const MAX_TEXT_RASTER_PIXELS = 40_000_000
const MAX_OVERLAY_PIXELS = OUTPUT_WIDTH * OUTPUT_HEIGHT * 16
const MAX_INTERMEDIATE_PNG_BYTES = 32 * 1024 * 1024
const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")
const chunks: Buffer[] = []
let bytes = 0
for await (const chunk of process.stdin) {
  const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
  bytes += value.byteLength
  if (bytes > MAX_RENDER_SVG_BYTES) throw new Error(`Work Artifact SVG exceeds ${MAX_RENDER_SVG_BYTES} bytes`)
  chunks.push(value)
}
const svg = Buffer.concat(chunks, bytes)
const renderedBase = await sharp(svg, {
  density: 96,
  limitInputPixels: MAX_IMAGE_PIXELS,
  failOn: "warning",
})
  .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "fill" })
  .png()
  .toBuffer()

type ParsedNode = {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: Array<{ name: string; value: string }>
  childNodes?: ParsedNode[]
}

type TextOverlay = {
  left: number
  top: number
  width: number
  height: number
  blocks: Array<{
    markup: string
    align: "left" | "center" | "right"
    font: string
    dpi: number
    estimatedHeight: number
    spacing: number
  }>
  justify: "start" | "center" | "end"
}

function attribute(node: ParsedNode, name: string): string | undefined {
  return node.attrs?.find((candidate) => candidate.name === name)?.value
}

function styleMap(value: string | undefined): Map<string, string> {
  const result = new Map<string, string>()
  for (const declaration of value?.split(";") ?? []) {
    const separator = declaration.indexOf(":")
    if (separator < 1) continue
    result.set(declaration.slice(0, separator).trim().toLowerCase(), declaration.slice(separator + 1).trim())
  }
  return result
}

function pangoEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function textContent(node: ParsedNode): string {
  if (node.nodeName === "#text") return node.value ?? ""
  return (node.childNodes ?? []).map(textContent).join("")
}

function firstElement(node: ParsedNode): ParsedNode | undefined {
  return node.childNodes?.find((candidate) => candidate.tagName !== undefined)
}

function safeFontFamily(value: string | undefined): string {
  const normalized = value?.replaceAll(/["']/g, "").trim()
  if (!normalized || normalized.length > 100 || !/^[\p{L}\p{N} .,\-_]+$/u.test(normalized)) return "sans"
  return normalized.split(",")[0]!.trim() || "sans"
}

function safeFontSize(value: string | undefined): number {
  const match = /^(\d+(?:\.\d+)?)pt$/.exec(value ?? "")
  if (!match) return 12
  return Math.min(96, Math.max(4, Number(match[1])))
}

function safeColor(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : "#000000"
}

function markupForBlock(block: ParsedNode): { markup: string; font: string; fontSize: number } {
  const spans = (block.childNodes ?? []).filter((candidate) => candidate.tagName === "span")
  const source = spans.length > 0 ? spans : [block]
  let fallbackFont = "sans"
  let maximumFontSize = 12
  const markup = source
    .map((span) => {
      const style = styleMap(attribute(span, "style"))
      const font = safeFontFamily(style.get("font-family"))
      const fontSize = safeFontSize(style.get("font-size"))
      const weight = style.get("font-weight")
      const bold = weight === "bold" || (weight !== undefined && Number(weight) >= 600)
      const italic = style.get("font-style") === "italic"
      fallbackFont = font
      maximumFontSize = Math.max(maximumFontSize, fontSize)
      return `<span foreground="${safeColor(style.get("color"))}" font_family="${pangoEscape(font)}" font_size="${fontSize}pt"${bold ? ' font_weight="bold"' : ""}${italic ? ' font_style="italic"' : ""}>${pangoEscape(textContent(span))}</span>`
    })
    .join("")
  return { markup, font: fallbackFont, fontSize: maximumFontSize }
}

function parseTranslate(value: string | undefined): { x: number; y: number } {
  if (!value) return { x: 0, y: 0 }
  const match = /^translate\(\s*(-?\d+(?:\.\d+)?)\s*(?:[, ]\s*(-?\d+(?:\.\d+)?))?\s*\)$/.exec(value)
  if (!match) throw new Error(`Work Artifact SVG text uses unsupported transform: ${value}`)
  return { x: Number(match[1]), y: Number(match[2] ?? 0) }
}

function finiteAttribute(node: ParsedNode, name: string): number {
  const value = Number(attribute(node, name))
  if (!Number.isFinite(value)) throw new Error(`Work Artifact SVG text has invalid ${name}`)
  return value
}

function collectTextOverlays(svgBytes: Buffer): TextOverlay[] {
  const root = parseFragment(svgBytes.toString("utf8")) as unknown as ParsedNode
  const svgNode = root.childNodes?.find((candidate) => candidate.tagName === "svg")
  if (!svgNode) throw new Error("Work Artifact SVG is missing its root element")
  const viewBox = attribute(svgNode, "viewBox")?.split(/[ ,]+/).map(Number)
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    throw new Error("Work Artifact SVG has an invalid viewBox")
  }
  const [, , sourceWidth, sourceHeight] = viewBox as [number, number, number, number]
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error("Work Artifact SVG has an invalid viewBox size")
  const scaleX = OUTPUT_WIDTH / sourceWidth
  const scaleY = OUTPUT_HEIGHT / sourceHeight
  const overlays: TextOverlay[] = []
  let totalBlocks = 0
  let totalTextCharacters = 0
  let totalOverlayPixels = 0
  const walk = (node: ParsedNode, offsetX: number, offsetY: number): void => {
    const translated = parseTranslate(attribute(node, "transform"))
    const nextX = offsetX + translated.x
    const nextY = offsetY + translated.y
    if (node.tagName === "foreignObject") {
      if (overlays.length >= MAX_FOREIGN_OBJECTS)
        throw new Error(`Work Artifact SVG exceeds ${MAX_FOREIGN_OBJECTS} text objects`)
      const container = firstElement(node)
      if (!container) return
      const containerStyle = styleMap(attribute(container, "style"))
      const blocks = (container.childNodes ?? [])
        .filter((candidate) => candidate.tagName === "div")
        .map((block) => {
          const style = styleMap(attribute(block, "style"))
          const text = markupForBlock(block)
          const alignValue = style.get("text-align")
          const align: TextOverlay["blocks"][number]["align"] =
            alignValue === "center" || alignValue === "right" ? alignValue : "left"
          const lineHeight = Number(style.get("line-height"))
          const dpi = Math.max(36, Math.round(96 * Math.min(scaleX, scaleY)))
          const spacing =
            Number.isFinite(lineHeight) && lineHeight > 1 ? Math.round(text.fontSize * (lineHeight - 1)) : 0
          const estimatedHeight =
            Math.max(1, textContent(block).length) * Math.ceil((text.fontSize * dpi * 4) / 72 + spacing)
          return {
            markup: text.markup,
            align,
            font: `${text.font} ${text.fontSize}`,
            dpi,
            estimatedHeight,
            spacing,
          }
        })
        .filter((block) => block.markup.length > 0)
      totalTextCharacters += textContent(container).length
      if (totalTextCharacters > MAX_TEXT_CHARACTERS) {
        throw new Error(`Work Artifact SVG exceeds ${MAX_TEXT_CHARACTERS} text characters`)
      }
      const justifyValue = containerStyle.get("justify-content")
      const justify = justifyValue === "flex-start" ? "start" : justifyValue === "flex-end" ? "end" : "center"
      const overlay = {
        left: Math.round((nextX + finiteAttribute(node, "x")) * scaleX),
        top: Math.round((nextY + finiteAttribute(node, "y")) * scaleY),
        width: Math.round(finiteAttribute(node, "width") * scaleX),
        height: Math.round(finiteAttribute(node, "height") * scaleY),
        blocks,
        justify,
      } satisfies TextOverlay
      if (
        overlay.left < 0 ||
        overlay.top < 0 ||
        overlay.width < 1 ||
        overlay.height < 1 ||
        overlay.left + overlay.width > OUTPUT_WIDTH ||
        overlay.top + overlay.height > OUTPUT_HEIGHT
      ) {
        throw new Error("Work Artifact SVG text geometry exceeds the output canvas")
      }
      totalBlocks += blocks.length
      if (totalBlocks > MAX_TEXT_BLOCKS) throw new Error(`Work Artifact SVG exceeds ${MAX_TEXT_BLOCKS} text blocks`)
      totalOverlayPixels += overlay.width * overlay.height
      if (totalOverlayPixels > MAX_OVERLAY_PIXELS) {
        throw new Error(`Work Artifact SVG text overlays exceed ${MAX_OVERLAY_PIXELS} pixels`)
      }
      for (const block of blocks) {
        if (
          block.estimatedHeight > MAX_TEXT_RASTER_HEIGHT ||
          overlay.width * block.estimatedHeight > MAX_TEXT_RASTER_PIXELS
        ) {
          throw new Error("Work Artifact SVG text raster exceeds its bounded pixel budget")
        }
      }
      overlays.push(overlay)
      return
    }
    for (const child of node.childNodes ?? []) walk(child, nextX, nextY)
  }
  walk(svgNode, 0, 0)
  return overlays
}

async function renderOverlay(
  overlay: TextOverlay,
  budget: { intermediatePngBytes: number },
): Promise<Buffer | undefined> {
  const renderedBlocks: Array<{ input: Buffer; left: number; top: number; height: number }> = []
  let contentHeight = 0
  for (const block of overlay.blocks) {
    const rendered = await sharp({
      text: {
        text: block.markup,
        font: block.font,
        width: overlay.width,
        align: block.align,
        justify: false,
        dpi: block.dpi,
        rgba: true,
        spacing: block.spacing,
        wrap: "word-char",
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true })
    budget.intermediatePngBytes += rendered.data.byteLength
    if (budget.intermediatePngBytes > MAX_INTERMEDIATE_PNG_BYTES) {
      throw new Error(`Work Artifact SVG intermediate images exceed ${MAX_INTERMEDIATE_PNG_BYTES} bytes`)
    }
    renderedBlocks.push({ input: rendered.data, left: 0, top: contentHeight, height: rendered.info.height })
    contentHeight += rendered.info.height
  }
  if (renderedBlocks.length === 0) return undefined
  const initialTop =
    overlay.justify === "start"
      ? 0
      : overlay.justify === "end"
        ? overlay.height - contentHeight
        : (overlay.height - contentHeight) / 2
  const result = await sharp({
    create: { width: overlay.width, height: overlay.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(renderedBlocks.map((block) => ({ ...block, top: Math.max(0, Math.round(initialTop + block.top)) })))
    .png()
    .toBuffer()
  budget.intermediatePngBytes += result.byteLength
  if (budget.intermediatePngBytes > MAX_INTERMEDIATE_PNG_BYTES) {
    throw new Error(`Work Artifact SVG intermediate images exceed ${MAX_INTERMEDIATE_PNG_BYTES} bytes`)
  }
  return result
}

let rendered = renderedBase
const budget = { intermediatePngBytes: 0 }
for (const overlay of collectTextOverlays(svg)) {
  const input = await renderOverlay(overlay, budget)
  if (!input) continue
  rendered = await sharp(rendered)
    .composite([{ input, left: overlay.left, top: overlay.top }])
    .png()
    .toBuffer()
}
process.stdout.write(rendered)
