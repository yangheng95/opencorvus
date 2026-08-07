import fs from "node:fs/promises"
import path from "node:path"
import {
  type CompiledWebpageAssetGraph,
  type CompiledWebpageNode,
  type CompiledWebpageStructure,
} from "@opencorvus-ai/plugin"
import {
  WebCloneCodegenContextSchema,
  WebCloneSegmentsSchema,
  type WebCloneSegment,
  type WebCloneSegmentAssetSummary,
  type WebCloneSegmentNodeSummary,
  type WebCloneSegmentStrategy,
} from "./schema"

export interface WebCloneHandoff {
  segments: ReturnType<typeof WebCloneSegmentsSchema.parse>
  codegenContext: ReturnType<typeof WebCloneCodegenContextSchema.parse>
}

const SEGMENT_TAGS = new Set(["header", "nav", "main", "section", "article", "aside", "footer", "form", "table"])
const ASSET_BACKED_TAGS = new Set(["svg", "canvas", "picture", "video"])
const NON_VISUAL_TAGS = new Set(["html", "head", "meta", "link", "style", "script", "title", "noscript"])
const MAX_SEGMENT_OUTLINE_NODES = 120

export function buildWebCloneHandoff(pageIr: CompiledWebpageStructure, assetGraph: CompiledWebpageAssetGraph): WebCloneHandoff {
  const assetsByNode = new Map<string, string[]>()
  for (const asset of assetGraph.assets) {
    for (const use of asset.usedBy) {
      const list = assetsByNode.get(use.nodeId) ?? []
      list.push(asset.id)
      assetsByNode.set(use.nodeId, list)
    }
  }

  const segmentRoots = selectSegmentRoots(pageIr.root)
  const segments = segmentRoots.map((node, index) => buildSegment(node, index, assetsByNode, assetGraph))
  const parsedSegments = WebCloneSegmentsSchema.parse({
    version: 1,
    purpose: "web-clone-visual-segments",
    sourceIr: "page.ir.json",
    assetManifest: "assets/manifest.json",
    segments,
  })

  const codegenContext = WebCloneCodegenContextSchema.parse({
    version: 1,
    purpose: "web-clone-framework-codegen-context",
    sourceIr: "page.ir.json",
    assetManifest: "assets/manifest.json",
    segmentsPath: "segments.json",
    rules: [
      "Use page.ir.json for DOM order, hierarchy, attributes, visible text, and asset references.",
      "Use node layout bounds and computed style summaries in page.ir.json/segments.json as the primary geometry source.",
      "Use each segment's nodeOutline as the bounded source-code generation plan; expand omittedNodeCount gaps directly from page.ir.json.",
      "Use assets/manifest.json for dense CSS, SVG path data, data URIs, images, canvas captures, and long values.",
      "Do not inline long CSS, SVG path data, base64, or copied asset payloads into React/Vue source; import or reference sidecar assets.",
      "Preserve text and link coverage before decorative refactors.",
    ],
    verificationChecks: [
      "rendered screenshot comparison",
      "visible text coverage",
      "asset reference coverage",
      "segment-level visual diagnostics",
      "qualitative vision review when numeric diff is inconclusive",
    ],
    segments,
  })

  return { segments: parsedSegments, codegenContext }
}

export async function writeWebCloneHandoff(outputDir: string, handoff: WebCloneHandoff): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(path.join(outputDir, "segments.json"), JSON.stringify(handoff.segments, null, 2), "utf8")
  await fs.writeFile(
    path.join(outputDir, "codegen-context.json"),
    JSON.stringify(handoff.codegenContext, null, 2),
    "utf8",
  )
}

function selectSegmentRoots(root: CompiledWebpageNode): CompiledWebpageNode[] {
  const body = findFirstElement(root, "body")
  const parent = body ?? root
  const direct = (parent.children ?? []).filter((node) => node.type === "element")
  const semantic = direct.filter((node) => node.tag && (SEGMENT_TAGS.has(node.tag) || ASSET_BACKED_TAGS.has(node.tag)))
  if (semantic.length > 0) return semantic
  const nested = findNestedSegmentRoots(direct)
  if (nested.length > 0) return nested
  if (direct.length > 0) return direct
  return [root]
}

function findNestedSegmentRoots(nodes: CompiledWebpageNode[]): CompiledWebpageNode[] {
  const candidates: CompiledWebpageNode[] = []
  for (const node of nodes) {
    collectNestedSegmentRoots(node, 0, candidates)
  }
  return dedupeNodes(candidates)
}

function collectNestedSegmentRoots(node: CompiledWebpageNode, depth: number, candidates: CompiledWebpageNode[]): void {
  if (depth > 3 || node.type !== "element") return
  const tag = node.tag ?? ""
  if (NON_VISUAL_TAGS.has(tag)) return
  if ((SEGMENT_TAGS.has(tag) || ASSET_BACKED_TAGS.has(tag) || isMajorLayoutRegion(node)) && depth > 0) {
    candidates.push(node)
    return
  }
  for (const child of node.children ?? []) collectNestedSegmentRoots(child, depth + 1, candidates)
}

function isMajorLayoutRegion(node: CompiledWebpageNode): boolean {
  const bounds = node.layout?.bounds
  if (!bounds) return false
  if (bounds.w < 240 || bounds.h < 120) return false
  const display = node.layout?.styles?.display
  return display === "grid" || display === "flex" || display === "block"
}

function dedupeNodes(nodes: CompiledWebpageNode[]): CompiledWebpageNode[] {
  const seen = new Set<string>()
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false
    seen.add(node.id)
    return true
  })
}

function buildSegment(
  root: CompiledWebpageNode,
  index: number,
  assetsByNode: Map<string, string[]>,
  assetGraph: CompiledWebpageAssetGraph,
): WebCloneSegment {
  const nodeIds: string[] = []
  const nodeOutline: WebCloneSegmentNodeSummary[] = []
  const assetIds = new Set<string>()
  const textPreview: string[] = []
  let childElementCount = 0
  let hasSvg = false
  let hasCanvas = false

  walkWithParent(root, undefined, (node, parent) => {
    nodeIds.push(node.id)
    for (const assetId of assetsByNode.get(node.id) ?? []) assetIds.add(assetId)
    if (nodeOutline.length < MAX_SEGMENT_OUTLINE_NODES) {
      nodeOutline.push(summarizeNode(node, parent?.id))
    }
    if (node.type === "element") {
      if (node.id !== root.id) childElementCount++
      if (node.tag === "svg" || node.tag === "path") hasSvg = true
      if (node.tag === "canvas") hasCanvas = true
      for (const attr of node.attrs ?? []) {
        if (attr.assetId) assetIds.add(attr.assetId)
      }
    }
    if (node.type === "text" && node.text?.trim() && textPreview.length < 12) {
      textPreview.push(node.text.trim().replace(/\s+/g, " ").slice(0, 120))
    }
    if (node.assetId) assetIds.add(node.assetId)
  })

  const strategy = inferStrategy(root, Array.from(assetIds), assetGraph, hasSvg, hasCanvas)
  const sortedAssetIds = Array.from(assetIds).sort()
  return {
    id: `segment_${String(index).padStart(3, "0")}`,
    name: segmentName(root, index),
    rootNodeId: root.id,
    tag: root.tag ?? root.type,
    strategy,
    bounds: root.layout?.bounds,
    layout: root.layout,
    nodeIds,
    assetIds: sortedAssetIds,
    nodeOutline,
    omittedNodeCount: Math.max(0, nodeIds.length - nodeOutline.length),
    assetRefs: summarizeAssets(sortedAssetIds, assetGraph),
    textPreview,
    childElementCount,
  }
}

function summarizeNode(node: CompiledWebpageNode, parentId: string | undefined): WebCloneSegmentNodeSummary {
  return {
    id: node.id,
    parentId,
    sourcePath: node.sourcePath,
    type: node.type,
    tag: node.tag,
    text: summarizeText(node.text),
    attrs: node.attrs,
    layout: node.layout,
  }
}

function summarizeAssets(assetIds: string[], assetGraph: CompiledWebpageAssetGraph): WebCloneSegmentAssetSummary[] {
  return assetIds.map((assetId) => {
    const asset = assetGraph.assets.find((candidate) => candidate.id === assetId)
    if (!asset) throw new Error(`Segment referenced missing web-clone asset ${assetId}`)
    return {
      id: asset.id,
      kind: asset.kind,
      path: asset.path,
      bytes: asset.bytes,
      mime: asset.mime,
      semanticRole: asset.semanticRole,
      preview: asset.preview,
      usedBy: asset.usedBy,
    }
  })
}

function inferStrategy(
  root: CompiledWebpageNode,
  assetIds: string[],
  assetGraph: CompiledWebpageAssetGraph,
  hasSvg: boolean,
  hasCanvas: boolean,
): WebCloneSegmentStrategy {
  const assets = assetIds.map((assetId) => assetGraph.assets.find((asset) => asset.id === assetId)).filter(Boolean)
  if (root.tag === "canvas" || hasCanvas) return "canvas-raster"
  if (root.tag === "svg" || hasSvg || assets.some((asset) => asset?.kind === "svg-path-data")) return "svg-inline"
  if (assets.length > 0 && childElementCount(root) > 0) return "mixed"
  if (assets.length > 0) return "asset-backed-component"
  return "dom-component"
}

function segmentName(node: CompiledWebpageNode, index: number): string {
  const id = node.attrs?.find((attr) => attr.name === "id")?.value
  const classes = node.attrs
    ?.find((attr) => attr.name === "class")
    ?.classTokens?.slice(0, 2)
    .join("-")
  return [node.tag ?? node.type, id, classes, String(index)].filter(Boolean).join("-")
}

function childElementCount(node: CompiledWebpageNode): number {
  let count = 0
  walk(node, (child) => {
    if (child !== node && child.type === "element") count++
  })
  return count
}

function findFirstElement(node: CompiledWebpageNode, tag: string): CompiledWebpageNode | undefined {
  if (node.type === "element" && node.tag === tag) return node
  for (const child of node.children ?? []) {
    const found = findFirstElement(child, tag)
    if (found) return found
  }
  return undefined
}

function walk(node: CompiledWebpageNode, visit: (node: CompiledWebpageNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function walkWithParent(
  node: CompiledWebpageNode,
  parent: CompiledWebpageNode | undefined,
  visit: (node: CompiledWebpageNode, parent: CompiledWebpageNode | undefined) => void,
): void {
  visit(node, parent)
  for (const child of node.children ?? []) walkWithParent(child, node, visit)
}

function summarizeText(text: string | undefined): string | undefined {
  if (!text) return undefined
  return text.trim().replace(/\s+/g, " ").slice(0, 240)
}
