import fs from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencorvus-ai/plugin"
import type {
  CompiledWebpageAssetGraph,
  CompiledWebpageAttribute,
  CompiledWebpageNode,
  CompiledWebpageStructure,
} from "@opencorvus-ai/plugin"
import type { WebCloneSegment, WebCloneSegments } from "./schema"

const z = tool.schema

export const WebCloneSourceSkeletonManifestSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("web-clone-source-skeleton"),
  sourceEvidence: z.strictObject({
    referenceImage: z.literal("../reference.png"),
    pageIr: z.literal("../page.ir.json"),
    assets: z.literal("../assets/manifest.json"),
    segments: z.literal("../segments.json"),
  }),
  files: z.strictObject({
    html: z.literal("index.html"),
    css: z.literal("styles.css"),
    criticalCss: z.literal("critical.css"),
    fullSourceCss: z.literal("full-source.css"),
    usedSelectors: z.literal("used-selectors.json"),
    readme: z.literal("README.md"),
    sourceIr: z.strictObject({
      componentTree: z.literal("../source-ir/component-tree.json"),
      contentModel: z.literal("../source-ir/content-model.json"),
      layoutMap: z.literal("../source-ir/layout-map.json"),
      styleTokens: z.literal("../source-ir/style-tokens.json"),
      styleProfile: z.literal("../source-ir/style-profile.json"),
      interactionHints: z.literal("../source-ir/interaction-hints.json"),
      sourceQualityAudit: z.literal("../source-ir/source-quality-audit.json"),
    }),
  }),
  policy: z.strictObject({
    intendedConsumer: z.literal("projected implementation consumers declared by the active expert-squad package"),
    compileRequired: z.literal(false),
    generatedFrontendRequired: z.literal(false),
    sourceOfVisualTruth: z.literal("reference screenshot plus CSS-complete skeleton source"),
  }),
  stats: z.strictObject({
    htmlNodes: z.number().int().nonnegative(),
    renderedElements: z.number().int().nonnegative(),
    cssAssetCount: z.number().int().nonnegative(),
    cssAssetBytes: z.number().int().nonnegative(),
    computedStyleRuleCount: z.number().int().nonnegative(),
    sourceSegmentCount: z.number().int().nonnegative(),
    componentHintCount: z.number().int().nonnegative(),
    reachableCssRuleCount: z.number().int().nonnegative(),
    fullSourceCssBytes: z.number().int().nonnegative(),
    criticalCssBytes: z.number().int().nonnegative(),
  }),
  componentHints: z.array(
    z.strictObject({
      name: z.string(),
      kind: z.string(),
      sourceSegmentId: z.string(),
      rootNodeId: z.string(),
      textPreview: z.array(z.string()),
    }),
  ),
})

export const WebCloneSourceSkeletonAuditSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("web-clone-source-skeleton-audit"),
  passed: z.boolean(),
  hasHtml: z.boolean(),
  hasCss: z.boolean(),
  hasCriticalCss: z.boolean(),
  hasFullSourceCss: z.boolean(),
  hasUsedSelectors: z.boolean(),
  hasReadme: z.boolean(),
  hasSourceIr: z.boolean(),
  frameworkAgnostic: z.boolean(),
  referencesScreenshot: z.boolean(),
  cssAssetBytes: z.number().int().nonnegative(),
  criticalCssBytes: z.number().int().nonnegative(),
  computedStyleRuleCount: z.number().int().nonnegative(),
  replayFactoryDetected: z.boolean(),
  generatedProjectDetected: z.boolean(),
  placeholderTextDetected: z.boolean().default(false),
  hiddenSourceNodeDetected: z.boolean().default(false),
  findings: z.array(z.string()),
})

export type WebCloneSourceSkeletonManifest = ReturnType<typeof WebCloneSourceSkeletonManifestSchema.parse>
export type WebCloneSourceSkeletonAudit = ReturnType<typeof WebCloneSourceSkeletonAuditSchema.parse>

export interface WriteWebCloneSourceSkeletonInput {
  outputDir: string
  pageIr: CompiledWebpageStructure
  assetGraph: CompiledWebpageAssetGraph
  segments: WebCloneSegments
}

export interface WriteWebCloneSourceSkeletonOutput {
  skeletonDir: string
  files: string[]
  manifest: WebCloneSourceSkeletonManifest
  audit: WebCloneSourceSkeletonAudit
}

const TRANSPARENT_TAGS = new Set(["html"])
const DROPPED_TAGS = new Set(["head", "meta", "link", "style", "script", "title", "noscript"])
const SAFE_ATTRS = new Set([
  "id",
  "class",
  "role",
  "aria-label",
  "aria-expanded",
  "aria-controls",
  "aria-current",
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "type",
  "name",
  "value",
  "placeholder",
  "title",
  "colspan",
  "rowspan",
  "scope",
  "viewBox",
  "viewbox",
  "d",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "transform",
  "points",
  "preserveAspectRatio",
  "preserveaspectratio",
])

export async function writeWebCloneSourceSkeleton(
  input: WriteWebCloneSourceSkeletonInput,
): Promise<WriteWebCloneSourceSkeletonOutput> {
  const skeletonDir = path.join(input.outputDir, "source-skeleton")
  const files: string[] = []
  const segmentByNode = buildSegmentLookup(input.segments.segments)
  const body = findFirstElement(input.pageIr.root, "body")
  const renderRoot = body ?? input.pageIr.root
  const htmlBody = renderChildren(renderRoot.children ?? [], input.assetGraph, segmentByNode, 2)
  const componentHints = input.segments.segments.map((segment) => ({
    name: componentName(segment),
    kind: inferSkeletonKind(segment),
    sourceSegmentId: segment.id,
    rootNodeId: segment.rootNodeId,
    textPreview: segment.textPreview.slice(0, 8),
  }))
  const cssBundle = await renderSkeletonCssBundle(input.outputDir, input.assetGraph, input.pageIr.root)
  const sourceIr = buildSourceIr(input.pageIr, input.assetGraph, input.segments, cssBundle.usedSelectors)
  const computedStyleRuleCount = countComputedStyleRules(input.pageIr.root)
  const cssAssets = input.assetGraph.assets.filter((asset) => asset.kind === "css")
  const manifest = WebCloneSourceSkeletonManifestSchema.parse({
    version: 1,
    purpose: "web-clone-source-skeleton",
    sourceEvidence: {
      referenceImage: "../reference.png",
      pageIr: "../page.ir.json",
      assets: "../assets/manifest.json",
      segments: "../segments.json",
    },
    files: {
      html: "index.html",
      css: "styles.css",
      criticalCss: "critical.css",
      fullSourceCss: "full-source.css",
      usedSelectors: "used-selectors.json",
      readme: "README.md",
      sourceIr: {
        componentTree: "../source-ir/component-tree.json",
        contentModel: "../source-ir/content-model.json",
        layoutMap: "../source-ir/layout-map.json",
        styleTokens: "../source-ir/style-tokens.json",
        styleProfile: "../source-ir/style-profile.json",
        interactionHints: "../source-ir/interaction-hints.json",
        sourceQualityAudit: "../source-ir/source-quality-audit.json",
      },
    },
    policy: {
      intendedConsumer: "projected implementation consumers declared by the active expert-squad package",
      compileRequired: false,
      generatedFrontendRequired: false,
      sourceOfVisualTruth: "reference screenshot plus CSS-complete skeleton source",
    },
    stats: {
      htmlNodes: input.pageIr.stats.nodes,
      renderedElements: countRenderedElements(renderRoot),
      cssAssetCount: cssAssets.length,
      cssAssetBytes: cssAssets.reduce((sum, asset) => sum + asset.bytes, 0),
      computedStyleRuleCount,
      sourceSegmentCount: input.segments.segments.length,
      componentHintCount: componentHints.length,
      reachableCssRuleCount: cssBundle.usedSelectors.rules.filter((rule) => rule.reachable).length,
      fullSourceCssBytes: Buffer.byteLength(cssBundle.fullSourceCss, "utf8"),
      criticalCssBytes: Buffer.byteLength(cssBundle.criticalCss, "utf8"),
    },
    componentHints,
  })

  await fs.mkdir(skeletonDir, { recursive: true })
  await fs.mkdir(path.join(input.outputDir, "source-ir"), { recursive: true })
  await writeText(skeletonDir, files, "index.html", renderHtmlDocument(input.pageIr, htmlBody, componentHints))
  await writeText(skeletonDir, files, "styles.css", renderStylesheetIndex())
  await writeText(skeletonDir, files, "critical.css", cssBundle.criticalCss)
  await writeText(skeletonDir, files, "full-source.css", cssBundle.fullSourceCss)
  await writeText(skeletonDir, files, "used-selectors.json", JSON.stringify(cssBundle.usedSelectors, null, 2))
  await writeText(skeletonDir, files, "README.md", renderSkeletonReadme(input.pageIr, manifest))
  await writeText(skeletonDir, files, "skeleton-manifest.json", JSON.stringify(manifest, null, 2))
  await writeText(
    input.outputDir,
    files,
    "source-ir/component-tree.json",
    JSON.stringify(sourceIr.componentTree, null, 2),
  )
  await writeText(
    input.outputDir,
    files,
    "source-ir/content-model.json",
    JSON.stringify(sourceIr.contentModel, null, 2),
  )
  await writeText(input.outputDir, files, "source-ir/layout-map.json", JSON.stringify(sourceIr.layoutMap, null, 2))
  await writeText(input.outputDir, files, "source-ir/style-tokens.json", JSON.stringify(sourceIr.styleTokens, null, 2))
  await writeText(
    input.outputDir,
    files,
    "source-ir/style-profile.json",
    JSON.stringify(sourceIr.styleProfile, null, 2),
  )
  await writeText(
    input.outputDir,
    files,
    "source-ir/interaction-hints.json",
    JSON.stringify(sourceIr.interactionHints, null, 2),
  )
  await writeText(
    input.outputDir,
    files,
    "source-ir/source-quality-audit.json",
    JSON.stringify(sourceIr.sourceQualityAudit, null, 2),
  )

  const audit = await auditWebCloneSourceSkeleton(skeletonDir)
  await writeText(skeletonDir, files, "source-skeleton-audit.json", JSON.stringify(audit, null, 2))

  return { skeletonDir, files, manifest, audit }
}

export async function auditWebCloneSourceSkeleton(skeletonDir: string): Promise<WebCloneSourceSkeletonAudit> {
  const htmlPath = path.join(skeletonDir, "index.html")
  const cssPath = path.join(skeletonDir, "styles.css")
  const criticalCssPath = path.join(skeletonDir, "critical.css")
  const fullSourceCssPath = path.join(skeletonDir, "full-source.css")
  const usedSelectorsPath = path.join(skeletonDir, "used-selectors.json")
  const readmePath = path.join(skeletonDir, "README.md")
  const sourceIrDir = path.resolve(skeletonDir, "..", "source-ir")
  const [html, css, criticalCss, fullSourceCss, usedSelectors, readme] = await Promise.all([
    readOptional(htmlPath),
    readOptional(cssPath),
    readOptional(criticalCssPath),
    readOptional(fullSourceCssPath),
    readOptional(usedSelectorsPath),
    readOptional(readmePath),
  ])
  const allText = [html, css, criticalCss, fullSourceCss, usedSelectors, readme].join("\n")
  const findings: string[] = []
  const hasHtml = html.length > 0
  const hasCss = css.length > 0
  const hasCriticalCss = criticalCss.length > 0
  const hasFullSourceCss = fullSourceCss.length > 0
  const hasUsedSelectors = usedSelectors.length > 0
  const hasReadme = readme.length > 0
  const hasSourceIr = await hasAllFiles(sourceIrDir, [
    "component-tree.json",
    "content-model.json",
    "layout-map.json",
    "style-tokens.json",
    "style-profile.json",
    "interaction-hints.json",
    "source-quality-audit.json",
  ])
  const frameworkAgnostic =
    !/\bimport\s+.*\b(react|vue|svelte|solid-js)\b|from\s+["'](react|vue|svelte|solid-js)["']/.test(allText)
  const referencesScreenshot = readme.includes("../reference.png") && html.includes("../reference.png")
  const replayFactoryDetected = /\bel\s*\(|\{\s*["']?t["']?\s*:|document\.createElement|createRoot\(|createApp\(/.test(
    allText,
  )
  const generatedProjectDetected = /package\.json|node_modules|bun run dev|web-clone-generated-runtime/.test(allText)
  const placeholderTextDetected = /__COMPILED_WEBPAGE_[A-Z0-9_]+__/.test(html)
  const hiddenSourceNodeDetected = /(?:class\s*=\s*["'][^"']*\bsf-hidden\b|aria-hidden\s*=\s*["']true["'])/i.test(html)
  const computedStyleRuleCount = (css.match(/\[data-source-node-id=/g) ?? []).length
  const cssAssetBytes = Buffer.byteLength(fullSourceCss, "utf8")

  if (!hasHtml) findings.push("source-skeleton/index.html is missing or empty")
  if (!hasCss) findings.push("source-skeleton/styles.css is missing or empty")
  if (!hasCriticalCss) findings.push("source-skeleton/critical.css is missing or empty")
  if (!hasFullSourceCss) findings.push("source-skeleton/full-source.css is missing or empty")
  if (!hasUsedSelectors) findings.push("source-skeleton/used-selectors.json is missing or empty")
  if (!hasReadme) findings.push("source-skeleton/README.md is missing or empty")
  if (!hasSourceIr) findings.push("source-ir semantic files are missing or incomplete")
  if (!frameworkAgnostic) findings.push("source skeleton imports a concrete frontend framework")
  if (!referencesScreenshot) findings.push("source skeleton does not explicitly reference ../reference.png")
  if (replayFactoryDetected) findings.push("source skeleton contains generated runtime or DOM replay factory markers")
  if (generatedProjectDetected)
    findings.push("source skeleton looks like a generated runnable project instead of source-only files")
  if (placeholderTextDetected) findings.push("source skeleton leaks extracted asset placeholder text into visible HTML")
  if (hiddenSourceNodeDetected)
    findings.push("source skeleton includes hidden source-only duplicate nodes in visible HTML")

  return WebCloneSourceSkeletonAuditSchema.parse({
    version: 1,
    purpose: "web-clone-source-skeleton-audit",
    passed: findings.length === 0,
    hasHtml,
    hasCss,
    hasCriticalCss,
    hasFullSourceCss,
    hasUsedSelectors,
    hasReadme,
    hasSourceIr,
    frameworkAgnostic,
    referencesScreenshot,
    cssAssetBytes,
    criticalCssBytes: Buffer.byteLength(criticalCss, "utf8"),
    computedStyleRuleCount,
    replayFactoryDetected,
    generatedProjectDetected,
    placeholderTextDetected,
    hiddenSourceNodeDetected,
    findings,
  })
}

function renderHtmlDocument(
  pageIr: CompiledWebpageStructure,
  body: string,
  componentHints: WebCloneSourceSkeletonManifest["componentHints"],
): string {
  const hints = componentHints
    .map((hint) => `    <!-- ${hint.name}: ${hint.kind}, segment=${hint.sourceSegmentId}, node=${hint.rootNodeId} -->`)
    .join("\n")
  return [
    "<!doctype html>",
    `<html lang="en" data-source-sha256="${escapeAttr(pageIr.source.inputSha256)}">`,
    "  <head>",
    '    <meta charset="utf-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    `    <title>${escapeText(pageIr.source.title ?? "Webpage source skeleton")}</title>`,
    '    <link rel="stylesheet" href="./critical.css">',
    "  </head>",
    '  <body data-reference-image="../reference.png">',
    "    <!-- Component hints for LLM framework generation. Keep these semantic boundaries when porting. -->",
    hints,
    body || '    <main data-source-node-id="empty">No renderable body content was captured.</main>',
    "  </body>",
    "</html>",
    "",
  ].join("\n")
}

function renderChildren(
  nodes: CompiledWebpageNode[],
  assetGraph: CompiledWebpageAssetGraph,
  segmentByNode: Map<string, string>,
  indent: number,
): string {
  return nodes
    .map((node) => renderNode(node, assetGraph, segmentByNode, indent))
    .filter(Boolean)
    .join("\n")
}

function renderNode(
  node: CompiledWebpageNode,
  assetGraph: CompiledWebpageAssetGraph,
  segmentByNode: Map<string, string>,
  indent: number,
): string {
  const pad = " ".repeat(indent)
  if (node.type === "text") return node.text?.trim() ? `${pad}${escapeText(node.text)}` : ""
  if (node.type !== "element") return ""
  const tag = normalizeTag(node.tag)
  if (!tag) return ""
  if (TRANSPARENT_TAGS.has(tag)) return renderChildren(node.children ?? [], assetGraph, segmentByNode, indent)
  if (DROPPED_TAGS.has(tag) || isHiddenSourceNode(node)) return ""
  const attrs = renderAttributes(node, assetGraph, segmentByNode)
  const children = renderChildren(node.children ?? [], assetGraph, segmentByNode, indent + 2)
  if (!children.trim() && isVoidTag(tag)) return `${pad}<${tag}${attrs}>`
  if (!children.trim()) return `${pad}<${tag}${attrs}></${tag}>`
  return `${pad}<${tag}${attrs}>\n${children}\n${pad}</${tag}>`
}

function isHiddenSourceNode(node: CompiledWebpageNode): boolean {
  for (const attr of node.attrs ?? []) {
    const name = attr.name.toLowerCase()
    const value = attr.value ?? ""
    if (name === "aria-hidden" && value.toLowerCase() === "true") return true
    if (name === "class" && /\bsf-hidden\b/.test(value)) return true
    if (attr.classTokens?.some((token) => token === "sf-hidden")) return true
  }
  return false
}

function renderAttributes(
  node: CompiledWebpageNode,
  assetGraph: CompiledWebpageAssetGraph,
  segmentByNode: Map<string, string>,
): string {
  const attrs: Array<[string, string]> = []
  attrs.push(["data-source-node-id", node.id])
  const segmentId = segmentByNode.get(node.id)
  if (segmentId) attrs.push(["data-source-segment-id", segmentId])
  if (node.layout?.role) attrs.push(["data-source-role", node.layout.role])
  for (const attr of node.attrs ?? []) {
    const rendered = renderAttribute(attr, assetGraph)
    if (rendered) attrs.push(rendered)
  }
  if (node.layout?.href && !attrs.some(([name]) => name === "href")) attrs.push(["href", node.layout.href])
  if (node.layout?.imageAlt && !attrs.some(([name]) => name === "alt")) attrs.push(["alt", node.layout.imageAlt])
  if (node.layout?.imageSrc && !attrs.some(([name]) => name === "src")) attrs.push(["src", node.layout.imageSrc])
  return attrs.map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join("")
}

function renderAttribute(
  attr: CompiledWebpageAttribute,
  assetGraph: CompiledWebpageAssetGraph,
): [string, string] | undefined {
  if (!isSafeAttr(attr.name)) return undefined
  if (attr.assetId) {
    const asset = assetGraph.assets.find((candidate) => candidate.id === attr.assetId)
    if (!asset) return undefined
    if (attr.name === "src" || attr.name === "href") return [attr.name, `../${asset.path.replaceAll("\\", "/")}`]
    return [`data-asset-${attr.name.toLowerCase()}`, `../${asset.path.replaceAll("\\", "/")}`]
  }
  if (attr.value === undefined) return undefined
  return [attr.name, attr.value]
}

interface CssRuleEvidence {
  selector: string
  assetId: string
  assetPath: string
  reachable: boolean
  matchedBy: string[]
}

interface CssSelectorReachability {
  version: 1
  purpose: "web-clone-css-selector-reachability"
  rules: CssRuleEvidence[]
  stats: {
    totalRules: number
    reachableRules: number
    unreachableRules: number
  }
}

interface CssBundle {
  criticalCss: string
  fullSourceCss: string
  usedSelectors: CssSelectorReachability
}

async function renderSkeletonCssBundle(
  outputDir: string,
  assetGraph: CompiledWebpageAssetGraph,
  root: CompiledWebpageNode,
): Promise<CssBundle> {
  const base = [
    "/* Source skeleton CSS.",
    "   This critical file contains reachable stylesheet rules plus computed-style evidence rules.",
    "   Full stylesheet evidence remains in full-source.css. */",
    "",
    "* { box-sizing: border-box; }",
    "[data-source-node-id] { min-width: 0; }",
    "",
  ]
  const fullChunks = [
    "/* Full source CSS sidecar.",
    "   Keep this as evidence. Projected implementation consumers declared by the active expert-squad package should start from critical.css and source-ir/*.json, then inspect this only for missing details. */",
    "",
  ]
  const cssAssets = assetGraph.assets.filter((asset) => asset.kind === "css")
  const nodeIndex = buildSelectorNodeIndex(root)
  const rules: CssRuleEvidence[] = []
  const criticalRules: string[] = []
  for (const asset of cssAssets) {
    const assetPath = path.join(outputDir, asset.path)
    const content = await fs.readFile(assetPath, "utf8")
    fullChunks.push(`/* CSS asset ${asset.id}: ${asset.path}, ${asset.bytes} bytes */`)
    fullChunks.push(content)
    fullChunks.push("")
    const extracted = extractReachableCssRules(content, asset.id, asset.path, nodeIndex)
    rules.push(...extracted.rules)
    criticalRules.push(...extracted.css)
  }
  const computedRules: string[] = []
  collectComputedStyleRules(root, computedRules)
  if (criticalRules.length > 0) {
    base.push("/* Reachable original CSS rules. */")
    base.push(...criticalRules)
    base.push("")
  }
  if (computedRules.length > 0) {
    base.push("/* Browser computed-style evidence rules keyed by source node id. */")
    base.push(...computedRules)
  }
  const reachableRules = rules.filter((rule) => rule.reachable).length
  return {
    criticalCss: base.join("\n"),
    fullSourceCss: fullChunks.join("\n"),
    usedSelectors: {
      version: 1,
      purpose: "web-clone-css-selector-reachability",
      rules,
      stats: {
        totalRules: rules.length,
        reachableRules,
        unreachableRules: rules.length - reachableRules,
      },
    },
  }
}

function renderStylesheetIndex(): string {
  return [
    "/* Stylesheet index. Projected implementation consumers declared by the active expert-squad package should read critical.css first, then inspect full-source.css only for additional style detail. */",
    "@import url('./critical.css');",
    "",
  ].join("\n")
}

function collectComputedStyleRules(node: CompiledWebpageNode, rules: string[]): void {
  if (node.type === "element" && node.layout?.styles && Object.keys(node.layout.styles).length > 0) {
    const declarations = Object.entries(node.layout.styles)
      .filter(([, value]) => value !== undefined && value !== "" && value !== "initial")
      .map(([name, value]) => `  ${toKebabCase(name)}: ${value};`)
      .join("\n")
    if (declarations) {
      rules.push(`[data-source-node-id="${cssEscape(node.id)}"] {\n${declarations}\n}`)
    }
  }
  for (const child of node.children ?? []) collectComputedStyleRules(child, rules)
}

function renderSkeletonReadme(pageIr: CompiledWebpageStructure, manifest: WebCloneSourceSkeletonManifest): string {
  return [
    "# Source Skeleton Evidence",
    "",
    "This directory is the only development-facing webpage clone seed.",
    "",
    "Use these files:",
    "",
    "- `index.html`: semantic source skeleton with source node/segment ids.",
    "- `critical.css`: reachable stylesheet rules plus computed-style evidence rules.",
    "- `full-source.css`: complete stylesheet evidence sidecar for targeted lookup.",
    "- `used-selectors.json`: selector reachability evidence from the skeleton nodes.",
    "- `../source-ir/component-tree.json`: semantic component boundary evidence.",
    "- `../source-ir/content-model.json`: visible text, repeated structures, tables, lists, cards, controls, links, and media.",
    "- `../source-ir/layout-map.json`: source-node bounds and key computed styles.",
    "- `../source-ir/style-tokens.json`: color, typography, spacing, radius, and shadow candidates.",
    "- `../source-ir/style-profile.json`: region-scoped style source with component bounds, computed style summaries, selector refs, assets, and source-node ids.",
    "- `../source-ir/interaction-hints.json`: links, buttons, inputs, tabs, dropdowns, search, and accordion candidates.",
    "- `../assets/manifest.json`: asset sidecar index. `data-asset-*` attributes in `index.html` point to dense values moved out of HTML, including SVG `path` geometry under `../assets/svg/*.path.txt`.",
    "- `../reference.png`: visual truth for final screenshot regression.",
    "- `skeleton-manifest.json`: source coverage and component hints.",
    "",
    "Generate maintainable project source from this skeleton and IR; do not use runtime replay or generated runnable project code as the implementation seed.",
    "",
    "Generation workflow:",
    "",
    "1. Read this README, `../source-ir/component-tree.json`, `../source-ir/content-model.json`, `../source-ir/style-profile.json`, `../source-ir/style-tokens.json`, and `critical.css` first.",
    "2. Use `index.html` for exact hierarchy and `full-source.css` only for targeted missing CSS detail.",
    "3. Convert semantic regions into the target framework's normal components.",
    "4. Preserve useful class names, source ids, visible text, links, assets, `data-asset-*` sidecar references, and data table/list structure.",
    "5. Move repeated rows/cards into data arrays and typed models.",
    "6. Use `../reference.png` for visual acceptance after implementation.",
    "",
    `Source title: ${pageIr.source.title ?? "unknown"}`,
    `Source URL: ${pageIr.source.url ?? "unknown"}`,
    `CSS assets: ${manifest.stats.cssAssetCount}, reachable CSS rules: ${manifest.stats.reachableCssRuleCount}, computed style rules: ${manifest.stats.computedStyleRuleCount}`,
    `Critical CSS bytes: ${manifest.stats.criticalCssBytes}, full source CSS bytes: ${manifest.stats.fullSourceCssBytes}`,
    "",
  ].join("\n")
}

function buildSourceIr(
  pageIr: CompiledWebpageStructure,
  assetGraph: CompiledWebpageAssetGraph,
  segments: WebCloneSegments,
  usedSelectors: CssSelectorReachability,
) {
  const elements = flattenElements(pageIr.root)
  const textByNode = new Map<string, string>()
  for (const node of elements) textByNode.set(node.id, visibleText(node))
  const componentTree = {
    version: 1,
    purpose: "web-clone-component-tree",
    sourceEvidence: {
      referenceImage: "../reference.png",
      sourceSkeleton: "../source-skeleton/index.html",
      criticalCss: "../source-skeleton/critical.css",
      fullSourceCss: "../source-skeleton/full-source.css",
      usedSelectors: "../source-skeleton/used-selectors.json",
    },
    components: segments.segments.map((segment) => ({
      id: segment.id,
      name: componentName(segment),
      kind: inferSkeletonKind(segment),
      rootNodeId: segment.rootNodeId,
      tag: segment.tag,
      strategy: segment.strategy,
      bounds: segment.bounds,
      classNames: classTokens(segment.nodeOutline[0]?.attrs),
      textPreview: segment.textPreview.slice(0, 12),
      assetSummary: {
        total: segment.assetRefs.length,
        byKind: countBy(segment.assetRefs.map((asset) => asset.kind)),
      },
      assetRefs: segment.assetRefs
        .filter((asset) => asset.kind !== "css")
        .map((asset) => ({
          id: asset.id,
          kind: asset.kind,
          path: asset.path,
          semanticRole: asset.semanticRole,
          bytes: asset.bytes,
        })),
      childElementCount: segment.childElementCount,
      implementationHint: implementationHintForSegment(segment),
    })),
  }
  const contentModel = buildContentModel(pageIr.root, assetGraph)
  const layoutMap = {
    version: 1,
    purpose: "web-clone-layout-map",
    sourceEvidence: {
      pageIr: "../page.ir.json",
      sourceSkeleton: "../source-skeleton/index.html",
    },
    elements: elements
      .filter((node) => node.layout?.bounds || node.layout?.styles)
      .map((node) => ({
        nodeId: node.id,
        tag: normalizeTag(node.tag) ?? "div",
        selector: node.layout?.selector,
        role: node.layout?.role,
        bounds: node.layout?.bounds,
        styles: pickLayoutStyles(node.layout?.styles),
        textPreview: compactText(textByNode.get(node.id) ?? "", 120),
      })),
  }
  const styleTokens = buildStyleTokens(pageIr.root, usedSelectors)
  const styleProfile = buildStyleProfile(pageIr, assetGraph, segments, usedSelectors)
  const interactionHints = buildInteractionHints(pageIr.root)
  const sourceQualityAudit = {
    version: 1,
    purpose: "web-clone-source-quality-audit",
    passed: true,
    sourceOnly: true,
    generatedFrontendRequired: false,
    primaryBuildInputs: [
      "../source-skeleton/README.md",
      "component-tree.json",
      "content-model.json",
      "style-profile.json",
      "style-tokens.json",
      "../source-skeleton/critical.css",
      "../source-skeleton/index.html",
      "../reference.png",
    ],
    findings: [],
    metrics: {
      componentCount: componentTree.components.length,
      contentTables: contentModel.tables.length,
      contentLists: contentModel.lists.length,
      repeatedGroups: contentModel.repeatedGroups.length,
      controls: contentModel.controls.length,
      layoutElements: layoutMap.elements.length,
      styleProfiles: styleProfile.regions.length,
      reachableCssRules: usedSelectors.stats.reachableRules,
      totalCssRules: usedSelectors.stats.totalRules,
      colorTokens: styleTokens.colors.length,
      spacingTokens: styleTokens.spacing.length,
      interactionHints: interactionHints.hints.length,
    },
  }
  return {
    componentTree,
    contentModel,
    layoutMap,
    styleTokens,
    styleProfile,
    interactionHints,
    sourceQualityAudit,
  }
}

function buildStyleProfile(
  pageIr: CompiledWebpageStructure,
  assetGraph: CompiledWebpageAssetGraph,
  segments: WebCloneSegments,
  usedSelectors: CssSelectorReachability,
) {
  const nodeById = new Map(flattenElements(pageIr.root).map((node) => [node.id, node]))
  const selectorRefsByNode = buildSelectorRefsByNode(usedSelectors)
  const assetRefsByNode = buildAssetRefsByNode(assetGraph)
  const regions = segments.segments.map((segment) => {
    const root = nodeById.get(segment.rootNodeId)
    const sourceNodeIds = [segment.rootNodeId, ...segment.nodeIds.filter((nodeId) => nodeId !== segment.rootNodeId)]
    const sampledNodes = sourceNodeIds
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node): node is CompiledWebpageNode => Boolean(node))
    const styleSummary = summarizeRegionStyles(sampledNodes)
    const selectorRefs = Array.from(new Set(sourceNodeIds.flatMap((nodeId) => selectorRefsByNode.get(nodeId) ?? [])))
    const assetRefs = Array.from(new Set(sourceNodeIds.flatMap((nodeId) => assetRefsByNode.get(nodeId) ?? [])))
    return {
      id: segment.id,
      name: componentName(segment),
      kind: inferSkeletonKind(segment),
      rootNodeId: segment.rootNodeId,
      sourceNodeIds,
      bounds: segment.bounds ?? root?.layout?.bounds,
      selector: root?.layout?.selector,
      tag: segment.tag,
      classNames: classTokens(root?.attrs).slice(0, 24),
      textPreview: segment.textPreview.slice(0, 12),
      styleSummary,
      selectorRefs,
      assetRefs,
      implementationGuidance: [
        "Read this region profile before editing the matching component/style files.",
        "Use bounds as source-capture crop/region identity evidence only; use computed typography, spacing, border, color, source node ids, selector refs, and assets as implementation facts.",
        "Do not turn source-capture x/y/height/full-page geometry into CSS position, spacer, min-height, footer-y, or document-height targets.",
        "Use source-skeleton/critical.css for exact declarations and full-source.css only for targeted missing details.",
        implementationHintForSegment(segment),
      ],
    }
  })
  return {
    version: 1,
    purpose: "web-clone-style-profile",
    sourceEvidence: {
      pageIr: "../page.ir.json",
      referenceImage: "../reference.png",
      componentTree: "component-tree.json",
      layoutMap: "layout-map.json",
      styleTokens: "style-tokens.json",
      criticalCss: "../source-skeleton/critical.css",
      usedSelectors: "../source-skeleton/used-selectors.json",
    },
    policy: {
      sourceOfTruth: "deterministic browser/DOM/CSS evidence grouped by source region",
      consumer: "projected consumers declared by the active expert-squad package",
      coordinateSpace: "source_capture_viewport_px",
      boundsImplementationUse: "evidence_only",
      noParallelStyleSummary: true,
    },
    regions,
    stats: {
      regionCount: regions.length,
      cssRuleRefs: usedSelectors.rules.length,
      reachableCssRuleRefs: usedSelectors.stats.reachableRules,
    },
  }
}

function buildSelectorRefsByNode(usedSelectors: CssSelectorReachability): Map<string, string[]> {
  const refs = new Map<string, string[]>()
  for (const rule of usedSelectors.rules) {
    if (!rule.reachable) continue
    const ref = `${rule.assetPath} :: ${rule.selector}`
    for (const nodeId of rule.matchedBy) {
      const existing = refs.get(nodeId) ?? []
      existing.push(ref)
      refs.set(nodeId, existing)
    }
  }
  return refs
}

function buildAssetRefsByNode(assetGraph: CompiledWebpageAssetGraph): Map<string, string[]> {
  const refs = new Map<string, string[]>()
  for (const asset of assetGraph.assets) {
    for (const use of asset.usedBy) {
      const existing = refs.get(use.nodeId) ?? []
      existing.push(`${asset.id} ${asset.kind} ${asset.path}`)
      refs.set(use.nodeId, existing)
    }
  }
  return refs
}

function summarizeRegionStyles(nodes: CompiledWebpageNode[]) {
  const values = {
    display: new Map<string, number>(),
    position: new Map<string, number>(),
    typography: new Map<string, number>(),
    color: new Map<string, number>(),
    background: new Map<string, number>(),
    spacing: new Map<string, number>(),
    border: new Map<string, number>(),
    radius: new Map<string, number>(),
    shadow: new Map<string, number>(),
    layout: new Map<string, number>(),
  }
  for (const node of nodes) {
    const styles = node.layout?.styles ?? {}
    addStyleValue(values.display, styles.display)
    addStyleValue(values.position, styles.position)
    addStyleValue(
      values.typography,
      compactStyleTuple(styles, ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"]),
    )
    addStyleValue(values.color, styles.color)
    addStyleValue(values.background, styles.backgroundColor ?? styles.background)
    addStyleValue(values.spacing, compactStyleTuple(styles, ["margin", "padding", "gap", "rowGap", "columnGap"]))
    addStyleValue(
      values.border,
      compactStyleTuple(styles, ["border", "borderTop", "borderRight", "borderBottom", "borderLeft"]),
    )
    addStyleValue(values.radius, styles.borderRadius)
    addStyleValue(values.shadow, styles.boxShadow)
    addStyleValue(
      values.layout,
      compactStyleTuple(styles, [
        "width",
        "height",
        "minWidth",
        "minHeight",
        "maxWidth",
        "maxHeight",
        "gridTemplateColumns",
        "gridTemplateRows",
        "flexDirection",
        "alignItems",
        "justifyContent",
      ]),
    )
  }
  return {
    display: rankedTokens(values.display).slice(0, 8),
    position: rankedTokens(values.position).slice(0, 8),
    typography: rankedTokens(values.typography).slice(0, 12),
    colors: rankedTokens(values.color).slice(0, 12),
    backgrounds: rankedTokens(values.background).slice(0, 12),
    spacing: rankedTokens(values.spacing).slice(0, 16),
    borders: rankedTokens(values.border).slice(0, 12),
    radii: rankedTokens(values.radius).slice(0, 8),
    shadows: rankedTokens(values.shadow).slice(0, 8),
    layout: rankedTokens(values.layout).slice(0, 16),
  }
}

function compactStyleTuple(styles: Record<string, string>, keys: string[]): string | undefined {
  const parts = keys
    .map((key) => {
      const value = styles[key]
      return value && value !== "initial" ? `${toKebabCase(key)}=${value}` : undefined
    })
    .filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join("; ") : undefined
}

function addStyleValue(counts: Map<string, number>, value: string | undefined): void {
  if (!value || value === "initial" || value === "none" || value === "normal") return
  increment(counts, value)
}

function buildContentModel(root: CompiledWebpageNode, assetGraph: CompiledWebpageAssetGraph) {
  const tables: unknown[] = []
  const lists: unknown[] = []
  const controls: unknown[] = []
  const links: unknown[] = []
  const media: unknown[] = []
  const cards: unknown[] = []
  const repeatedGroups: unknown[] = []
  const sourceComponentPatterns: unknown[] = []
  walk(root, (node, parent) => {
    if (node.type !== "element") return
    const tag = normalizeTag(node.tag) ?? "div"
    const text = compactText(visibleText(node), 240)
    if (tag === "table") tables.push(extractTableModel(node))
    if (tag === "ul" || tag === "ol") lists.push(extractListModel(node))
    if (isControlTag(tag)) controls.push(controlModel(node, tag, text))
    if (tag === "a" || node.layout?.href)
      links.push({ nodeId: node.id, text, href: attr(node.attrs, "href") ?? node.layout?.href })
    if (tag === "img" || tag === "svg" || tag === "canvas" || node.layout?.imageSrc) {
      media.push(mediaModel(node, tag, assetGraph))
    }
    if (looksLikeCard(node, parent)) {
      cards.push({
        nodeId: node.id,
        tag,
        classNames: classTokens(node.attrs),
        textPreview: text,
        fields: fieldTexts(node).map((value) => ({ value })),
      })
    }
  })
  collectRepeatedGroups(root, repeatedGroups)
  collectSourceComponentPatterns(root, sourceComponentPatterns)
  return withContentModelStats({
    version: 1,
    purpose: "web-clone-content-model",
    tables,
    lists,
    cards,
    controls,
    links,
    media,
    repeatedGroups,
    sourceComponentPatterns,
  })
}

function buildStyleTokens(root: CompiledWebpageNode, usedSelectors: CssSelectorReachability) {
  const colorCounts = new Map<string, number>()
  const fontCounts = new Map<string, number>()
  const spacingCounts = new Map<string, number>()
  const radiusCounts = new Map<string, number>()
  const shadowCounts = new Map<string, number>()
  walk(root, (node) => {
    if (node.type !== "element") return
    const styles = node.layout?.styles ?? {}
    for (const [name, value] of Object.entries(styles))
      collectToken(name, value, colorCounts, fontCounts, spacingCounts, radiusCounts, shadowCounts)
  })
  for (const rule of usedSelectors.rules.filter((candidate) => candidate.reachable)) {
    for (const color of rule.selector.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g) ?? [])
      increment(colorCounts, color)
  }
  return {
    version: 1,
    purpose: "web-clone-style-tokens",
    colors: rankedTokens(colorCounts).slice(0, 80),
    typography: rankedTokens(fontCounts).slice(0, 40),
    spacing: rankedTokens(spacingCounts).slice(0, 80),
    radii: rankedTokens(radiusCounts).slice(0, 40),
    shadows: rankedTokens(shadowCounts).slice(0, 40),
  }
}

function buildInteractionHints(root: CompiledWebpageNode) {
  const hints: Array<Record<string, unknown>> = []
  walk(root, (node) => {
    if (node.type !== "element") return
    const tag = normalizeTag(node.tag) ?? "div"
    const text = compactText(visibleText(node), 120)
    const role = attr(node.attrs, "role") ?? node.layout?.role
    const type = attr(node.attrs, "type")
    const ariaExpanded = attr(node.attrs, "aria-expanded")
    const ariaHasPopup = attr(node.attrs, "aria-haspopup")
    const href = attr(node.attrs, "href") ?? node.layout?.href
    const kind = inferInteractionKind({ tag, role, type, ariaExpanded, ariaHasPopup, href })
    if (!kind) return
    hints.push({
      nodeId: node.id,
      kind,
      tag,
      role,
      label: text || attr(node.attrs, "aria-label") || attr(node.attrs, "placeholder") || tag,
      href,
      state: ariaExpanded !== undefined ? { ariaExpanded } : undefined,
      implementationHint: interactionImplementationHint(kind),
    })
  })
  return {
    version: 1,
    purpose: "web-clone-interaction-hints",
    hints,
    stats: {
      totalHints: hints.length,
      byKind: countBy(hints.map((hint) => (typeof hint.kind === "string" ? hint.kind : "unknown"))),
    },
  }
}

function withContentModelStats(model: {
  version: 1
  purpose: "web-clone-content-model"
  tables: unknown[]
  lists: unknown[]
  cards: unknown[]
  controls: unknown[]
  links: unknown[]
  media: unknown[]
  repeatedGroups: unknown[]
  sourceComponentPatterns: unknown[]
}) {
  return {
    ...model,
    stats: {
      totalTables: model.tables.length,
      totalLists: model.lists.length,
      totalCards: model.cards.length,
      totalControls: model.controls.length,
      totalLinks: model.links.length,
      totalMedia: model.media.length,
      totalRepeatedGroups: model.repeatedGroups.length,
      totalSourceComponentPatterns: model.sourceComponentPatterns.length,
    },
  }
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function implementationHintForSegment(segment: WebCloneSegment): string {
  const kind = inferSkeletonKind(segment)
  if (kind === "table") return "Convert rows and columns into typed data arrays and render with framework loops."
  if (kind === "list") return "Convert repeated list items into a data array and a reusable item component."
  if (kind === "controls") return "Implement controls as real framework state, not copied static DOM."
  if (kind === "asset-backed-visual")
    return "Keep dense SVG/canvas/raster data as an asset or replace with a maintainable chart/map component."
  if (kind === "navigation") return "Implement navigation items from an array and preserve active state."
  return "Implement as a semantic component with project-owned data and styles."
}

function buildSelectorNodeIndex(root: CompiledWebpageNode) {
  const ids = new Map<string, string[]>()
  const classes = new Map<string, string[]>()
  const tags = new Map<string, string[]>()
  const attrs = new Map<string, string[]>()
  walk(root, (node) => {
    if (node.type !== "element") return
    const tag = normalizeTag(node.tag)
    if (tag) addIndex(tags, tag, node.id)
    for (const attribute of node.attrs ?? []) {
      const name = attribute.name.toLowerCase()
      if (name === "id" && attribute.value) addIndex(ids, attribute.value, node.id)
      if (name === "class")
        for (const token of attribute.classTokens ?? splitClasses(attribute.value)) addIndex(classes, token, node.id)
      addIndex(attrs, name, node.id)
    }
  })
  return { ids, classes, tags, attrs }
}

function extractReachableCssRules(
  css: string,
  assetId: string,
  assetPath: string,
  nodeIndex: ReturnType<typeof buildSelectorNodeIndex>,
): { css: string[]; rules: CssRuleEvidence[] } {
  const output: string[] = []
  const rules: CssRuleEvidence[] = []
  for (const rule of splitCssRules(css)) {
    if (rule.prelude.startsWith("@")) {
      if (/^@(media|supports|container)\b/i.test(rule.prelude)) {
        const nested = extractReachableCssRules(rule.body, assetId, assetPath, nodeIndex)
        rules.push(...nested.rules)
        if (nested.css.length > 0) output.push(`${rule.prelude} {\n${nested.css.join("\n")}\n}`)
      }
      continue
    }
    const selectors = rule.prelude
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean)
    const matchedBy = new Set<string>()
    for (const selector of selectors) {
      for (const nodeId of matchSelectorAtoms(selector, nodeIndex)) matchedBy.add(nodeId)
    }
    const reachable = matchedBy.size > 0 || selectors.some(isGlobalSelector)
    rules.push({ selector: rule.prelude, assetId, assetPath, reachable, matchedBy: Array.from(matchedBy).slice(0, 6) })
    const criticalBody = compactCriticalCssBody(rule.body)
    if (reachable && criticalBody) output.push(`${rule.prelude} {${criticalBody}}`)
  }
  return { css: output, rules }
}

function compactCriticalCssBody(body: string): string {
  const declarations = splitCssDeclarations(body)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(":")
      if (colon <= 0) return undefined
      const property = part.slice(0, colon).trim()
      const value = part.slice(colon + 1).trim()
      if (!property || !value) return undefined
      if (!isCriticalCssProperty(property, value)) return undefined
      return `${property}: ${value};`
    })
    .filter((part): part is string => Boolean(part))
  return declarations.join(" ")
}

function splitCssDeclarations(body: string): string[] {
  const declarations: string[] = []
  let start = 0
  let parenDepth = 0
  let quote: string | undefined
  for (let index = 0; index < body.length; index++) {
    const char = body[index]
    const prev = body[index - 1]
    if (quote) {
      if (char === quote && prev !== "\\") quote = undefined
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === "(") {
      parenDepth++
      continue
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1)
      continue
    }
    if (char === ";" && parenDepth === 0) {
      declarations.push(body.slice(start, index))
      start = index + 1
    }
  }
  const tail = body.slice(start)
  if (tail.trim()) declarations.push(tail)
  return declarations
}

function isCriticalCssProperty(property: string, value: string): boolean {
  const name = property.toLowerCase()
  if (name.startsWith("--")) {
    return /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)\b|font|radius|shadow|color/i.test(
      value,
    )
  }
  return /^(display|position|inset|top|right|bottom|left|z-index|box-sizing|width|height|min-width|min-height|max-width|max-height|margin|margin-.+|padding|padding-.+|gap|row-gap|column-gap|grid|grid-.+|flex|flex-.+|place-.+|align-.+|justify-.+|font|font-.+|line-height|letter-spacing|text-.+|white-space|color|background|background-.+|border|border-.+|border-radius|box-shadow|opacity|overflow|overflow-.+|transform|object-fit|object-position|visibility|pointer-events)$/.test(
    name,
  )
}

function splitCssRules(css: string): Array<{ prelude: string; body: string }> {
  const rules: Array<{ prelude: string; body: string }> = []
  let start = 0
  let open = -1
  let depth = 0
  let quote: string | undefined
  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    const prev = css[i - 1]
    if (quote) {
      if (char === quote && prev !== "\\") quote = undefined
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === "{") {
      if (depth === 0) open = i
      depth++
      continue
    }
    if (char === "}") {
      depth--
      if (depth === 0 && open >= 0) {
        const prelude = css.slice(start, open).trim()
        const body = css.slice(open + 1, i).trim()
        if (prelude && body) rules.push({ prelude, body })
        start = i + 1
        open = -1
      }
    }
  }
  return rules
}

function matchSelectorAtoms(selector: string, nodeIndex: ReturnType<typeof buildSelectorNodeIndex>): string[] {
  const stripped = selector.replace(/::?[a-zA-Z-]+(?:\([^)]*\))?/g, "").replace(/\[[^\]]+\]/g, (match) => {
    const name = match
      .slice(1, -1)
      .split(/[~|^$*]?=/)[0]
      ?.trim()
    return name ? `[${name}]` : ""
  })
  const matches = new Set<string>()
  for (const id of stripped.match(/#[a-zA-Z0-9_-]+/g) ?? []) {
    for (const nodeId of nodeIndex.ids.get(id.slice(1)) ?? []) matches.add(nodeId)
  }
  for (const className of stripped.match(/\.[a-zA-Z0-9_-]+/g) ?? []) {
    for (const nodeId of nodeIndex.classes.get(className.slice(1)) ?? []) matches.add(nodeId)
  }
  for (const attrName of stripped.match(/\[[a-zA-Z0-9_:-]+\]/g) ?? []) {
    for (const nodeId of nodeIndex.attrs.get(attrName.slice(1, -1).toLowerCase()) ?? []) matches.add(nodeId)
  }
  for (const tag of stripped.match(/(^|[\s>+~])([a-zA-Z][a-zA-Z0-9-]*)/g) ?? []) {
    const normalized = normalizeTag(
      tag
        .trim()
        .replace(/^[>+~]/, "")
        .trim(),
    )
    if (!normalized || ["not", "is", "where", "has"].includes(normalized)) continue
    for (const nodeId of nodeIndex.tags.get(normalized) ?? []) matches.add(nodeId)
  }
  return Array.from(matches)
}

function isGlobalSelector(selector: string): boolean {
  const normalized = selector.trim()
  return normalized === "*" || /^(html|body|:root)\b/.test(normalized)
}

function addIndex(index: Map<string, string[]>, key: string, nodeId: string): void {
  const list = index.get(key) ?? []
  list.push(nodeId)
  index.set(key, list)
}

function extractTableModel(node: CompiledWebpageNode) {
  const headers: string[] = []
  const rows: string[][] = []
  walk(node, (candidate) => {
    if (candidate.type !== "element") return
    const tag = normalizeTag(candidate.tag)
    if (tag === "th") headers.push(compactText(visibleText(candidate), 80))
    if (tag === "tr") {
      const cells = (candidate.children ?? [])
        .filter((child) => child.type === "element" && ["td", "th"].includes(normalizeTag(child.tag) ?? ""))
        .map((child) => compactText(visibleText(child), 80))
        .filter(Boolean)
      if (cells.length > 0) rows.push(cells)
    }
  })
  return {
    nodeId: node.id,
    headers,
    rows,
    suggestedDataShape: headers.length > 0 ? headers.map(toDataFieldName) : undefined,
  }
}

function extractListModel(node: CompiledWebpageNode) {
  const items = (node.children ?? [])
    .filter((child) => child.type === "element" && normalizeTag(child.tag) === "li")
    .map((child) => compactText(visibleText(child), 160))
    .filter(Boolean)
  return { nodeId: node.id, ordered: normalizeTag(node.tag) === "ol", items }
}

function controlModel(node: CompiledWebpageNode, tag: string, text: string) {
  return {
    nodeId: node.id,
    tag,
    type: attr(node.attrs, "type"),
    role: attr(node.attrs, "role") ?? node.layout?.role,
    label: text || attr(node.attrs, "aria-label") || attr(node.attrs, "placeholder") || attr(node.attrs, "name") || tag,
    value: attr(node.attrs, "value"),
  }
}

function mediaModel(node: CompiledWebpageNode, tag: string, assetGraph: CompiledWebpageAssetGraph) {
  const asset = node.assetId ? assetGraph.assets.find((candidate) => candidate.id === node.assetId) : undefined
  return {
    nodeId: node.id,
    tag,
    src: attr(node.attrs, "src") ?? node.layout?.imageSrc,
    alt: attr(node.attrs, "alt") ?? node.layout?.imageAlt,
    assetId: node.assetId,
    assetPath: asset?.path,
    semanticRole: asset?.semanticRole,
  }
}

function collectRepeatedGroups(node: CompiledWebpageNode, repeatedGroups: unknown[]): void {
  const elementChildren = (node.children ?? []).filter((child) => child.type === "element")
  const groups = new Map<string, CompiledWebpageNode[]>()
  for (const child of elementChildren) {
    const signature = structuralSignature(child)
    const group = groups.get(signature) ?? []
    group.push(child)
    groups.set(signature, group)
  }
  for (const [signature, group] of groups) {
    if (group.length < 2) continue
    repeatedGroups.push({
      parentNodeId: node.id,
      signature,
      count: group.length,
      itemTag: normalizeTag(group[0]?.tag) ?? "div",
      itemClassNames: classTokens(group[0]?.attrs),
      sampleTexts: group.map((item) => compactText(visibleText(item), 120)),
      implementationHint: "Render this repeated sibling group from a typed data array.",
    })
  }
  for (const child of elementChildren) collectRepeatedGroups(child, repeatedGroups)
}

function structuralSignature(node: CompiledWebpageNode): string {
  if (node.type !== "element") return node.type
  const childTags = (node.children ?? [])
    .filter((child) => child.type === "element")
    .map((child) => normalizeTag(child.tag) ?? "div")
    .join(".")
  const roles = [
    attr(node.attrs, "role"),
    attr(node.attrs, "type"),
    attr(node.attrs, "aria-haspopup") ? "popup" : undefined,
    attr(node.attrs, "href") ? "link" : undefined,
  ]
    .filter(Boolean)
    .join(".")
  return `${normalizeTag(node.tag) ?? "div"}|${roles}|${childTags}`
}

function collectSourceComponentPatterns(node: CompiledWebpageNode, patterns: unknown[]): void {
  if (node.type !== "element") {
    for (const child of node.children ?? []) collectSourceComponentPatterns(child, patterns)
    return
  }
  const pattern = sourceComponentPattern(node)
  if (pattern) patterns.push(pattern)
  for (const child of node.children ?? []) collectSourceComponentPatterns(child, patterns)
}

function sourceComponentPattern(node: CompiledWebpageNode): Record<string, unknown> | undefined {
  const tag = normalizeTag(node.tag) ?? "div"
  if (["html", "body", "script", "style", "meta", "link"].includes(tag)) return undefined
  const signals = sourceComponentSignals(node)
  const kind = sourceComponentPatternKind(tag, signals)
  if (!kind) return undefined
  return {
    nodeId: node.id,
    tag,
    classNames: classTokens(node.attrs),
    bounds: node.layout?.bounds,
    textPreview: compactText(visibleText(node), 180),
    kind,
    signals,
    implementationHint: implementationHintForSourceComponentPattern(kind),
  }
}

function sourceComponentSignals(node: CompiledWebpageNode): Record<string, unknown> {
  const elementCount = countElementDescendants(node)
  const linkCount = countElementDescendants(
    node,
    (child) => normalizeTag(child.tag) === "a" || Boolean(child.layout?.href),
  )
  const mediaCount = countElementDescendants(node, (child) => {
    const tag = normalizeTag(child.tag)
    return tag === "img" || tag === "svg" || tag === "canvas" || Boolean(child.layout?.imageSrc)
  })
  const controlCount = countElementDescendants(node, (child) => isControlTag(normalizeTag(child.tag) ?? ""))
  const headingCount = countElementDescendants(node, (child) => /^h[1-4]$/.test(normalizeTag(child.tag) ?? ""))
  const tableRowCount = countElementDescendants(node, (child) => normalizeTag(child.tag) === "tr")
  const maxRepeatedSiblingCount = maxRepeatedDirectChildCount(node)
  const display = String(node.layout?.styles?.display ?? "").toLowerCase()
  return {
    elementCount,
    linkCount,
    linkDensity: elementCount > 0 ? Number((linkCount / elementCount).toFixed(3)) : 0,
    mediaCount,
    controlCount,
    headingCount,
    tableRowCount,
    maxRepeatedSiblingCount,
    display,
    gridOrFlex: display.includes("grid") || display.includes("flex"),
    textLength: visibleText(node).length,
  }
}

function sourceComponentPatternKind(tag: string, signals: Record<string, unknown>): string | undefined {
  const elementCount = numberSignal(signals.elementCount)
  const linkCount = numberSignal(signals.linkCount)
  const linkDensity = numberSignal(signals.linkDensity)
  const mediaCount = numberSignal(signals.mediaCount)
  const controlCount = numberSignal(signals.controlCount)
  const headingCount = numberSignal(signals.headingCount)
  const tableRowCount = numberSignal(signals.tableRowCount)
  const maxRepeatedSiblingCount = numberSignal(signals.maxRepeatedSiblingCount)
  const gridOrFlex = signals.gridOrFlex === true
  const textLength = numberSignal(signals.textLength)
  if (tag === "table" || tableRowCount >= 3) return "data_grid_surface"
  if (mediaCount > 0 && (tag === "svg" || mediaCount >= 2 || elementCount >= 8)) return "media_chart_surface"
  if (tag === "form" || controlCount >= 2) return "form_control_surface"
  if (tag === "nav" || tag === "header" || tag === "footer" || (linkCount >= 4 && linkDensity >= 0.2))
    return "navigation_surface"
  if (maxRepeatedSiblingCount >= 3 && (gridOrFlex || mediaCount > 0 || linkCount >= 3 || headingCount >= 3))
    return "card_collection_surface"
  if (headingCount > 0 && elementCount >= 6 && textLength > 20) return "section_shell_surface"
  if (textLength > 160 && elementCount >= 4) return "text_content_surface"
  return undefined
}

function implementationHintForSourceComponentPattern(kind: string): string {
  if (kind === "data_grid_surface")
    return "Extract rows and columns into typed data and render through a table/grid component."
  if (kind === "card_collection_surface")
    return "Extract repeated item records and render them through a reusable collection component."
  if (kind === "media_chart_surface")
    return "Move dense SVG/canvas/image evidence into owned assets or a maintained chart/map component."
  if (kind === "navigation_surface")
    return "Extract links, labels, active state, and controls into navigation data and components."
  if (kind === "form_control_surface")
    return "Model form controls with real state, labels, validation, and disabled/loading states."
  if (kind === "section_shell_surface")
    return "Extract the section chrome and delegate repeated child surfaces to narrower components."
  return "Use semantic project components, data modules, and scoped styles for this source surface."
}

function countElementDescendants(
  node: CompiledWebpageNode,
  predicate?: (node: CompiledWebpageNode) => boolean,
): number {
  let count = 0
  walk(node, (candidate) => {
    if (candidate.type !== "element") return
    if (!predicate || predicate(candidate)) count += 1
  })
  return count
}

function maxRepeatedDirectChildCount(node: CompiledWebpageNode): number {
  const groups = new Map<string, number>()
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue
    const signature = structuralSignature(child)
    groups.set(signature, (groups.get(signature) ?? 0) + 1)
  }
  return Math.max(0, ...groups.values())
}

function numberSignal(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function fieldTexts(node: CompiledWebpageNode): string[] {
  const values: string[] = []
  walk(node, (candidate) => {
    if (candidate.type !== "element") return
    const tag = normalizeTag(candidate.tag)
    if (!tag || !["h1", "h2", "h3", "h4", "p", "span", "strong", "small", "time", "dt", "dd"].includes(tag)) return
    const text = compactText(visibleText(candidate), 120)
    if (text) values.push(text)
  })
  return Array.from(new Set(values))
}

function looksLikeCard(node: CompiledWebpageNode, parent: CompiledWebpageNode | undefined): boolean {
  if (node.type !== "element" || !parent) return false
  const tag = normalizeTag(node.tag)
  const classes = classTokens(node.attrs).join(" ")
  if (/\b(card|tile|item|article|panel)\b/i.test(classes)) return true
  if (tag === "article") return true
  const siblings = (parent.children ?? []).filter(
    (child) => child.type === "element" && structuralSignature(child) === structuralSignature(node),
  )
  return siblings.length >= 2 && visibleText(node).length > 0
}

function pickLayoutStyles(styles: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!styles) return undefined
  const names = [
    "display",
    "position",
    "gridTemplateColumns",
    "gridTemplateRows",
    "flexDirection",
    "alignItems",
    "justifyContent",
    "gap",
    "padding",
    "margin",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "color",
    "background",
    "backgroundColor",
    "border",
    "borderRadius",
    "boxShadow",
  ]
  return Object.fromEntries(Object.entries(styles).filter(([name]) => names.includes(name)))
}

function collectToken(
  name: string,
  value: string,
  colorCounts: Map<string, number>,
  fontCounts: Map<string, number>,
  spacingCounts: Map<string, number>,
  radiusCounts: Map<string, number>,
  shadowCounts: Map<string, number>,
): void {
  if (!value || value === "initial") return
  if (/color|background|border/i.test(name)) {
    for (const color of value.match(
      /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|\b(?:black|white|transparent|currentColor)\b/g,
    ) ?? [])
      increment(colorCounts, color)
  }
  if (/font/i.test(name)) increment(fontCounts, value)
  if (/gap|padding|margin|width|height|top|left|right|bottom|size|lineHeight/i.test(name)) {
    for (const spacing of value.match(/-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)/g) ?? []) increment(spacingCounts, spacing)
  }
  if (/radius/i.test(name)) increment(radiusCounts, value)
  if (/shadow/i.test(name)) increment(shadowCounts, value)
}

function rankedTokens(counts: Map<string, number>): Array<{ value: string; count: number }> {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

function increment(counts: Map<string, number>, value: string): void {
  counts.set(value, (counts.get(value) ?? 0) + 1)
}

function inferInteractionKind(input: {
  tag: string
  role: string | undefined
  type: string | undefined
  ariaExpanded: string | undefined
  ariaHasPopup: string | undefined
  href: string | undefined
}): string | undefined {
  if (input.tag === "a" || input.href) return input.role === "tab" ? "tab-link" : "link"
  if (input.tag === "button" || input.role === "button") {
    if (input.role === "tab") return "tab"
    if (input.ariaHasPopup !== undefined) return "menu-trigger"
    if (input.ariaExpanded !== undefined) return "accordion-toggle"
    return "button"
  }
  if (input.tag === "input" && input.type === "search") return "search-input"
  if (input.tag === "input" || input.tag === "select" || input.tag === "textarea") return "form-control"
  if (input.role === "tab") return "tab"
  if (input.role === "menuitem") return "menu-item"
  return undefined
}

function interactionImplementationHint(kind: string): string {
  if (kind === "tab" || kind === "tab-link")
    return "Model tabs as stateful selected keys and render tab panels conditionally."
  if (kind === "search-input") return "Wire to real input state and filter/search behavior or an explicit mock adapter."
  if (kind === "accordion-toggle") return "Wire aria-expanded to component state and hide/show the associated panel."
  if (kind === "menu-trigger" || kind === "menu-item")
    return "Implement with a real menu/dropdown component and keyboard-visible state."
  if (kind === "form-control") return "Represent value, loading, error, and disabled states explicitly."
  return "Implement as a real interactive element, not static copied markup."
}

function isControlTag(tag: string): boolean {
  return ["button", "input", "select", "textarea", "option"].includes(tag)
}

function flattenElements(root: CompiledWebpageNode): CompiledWebpageNode[] {
  const elements: CompiledWebpageNode[] = []
  walk(root, (node) => {
    if (node.type === "element") elements.push(node)
  })
  return elements
}

function walk(
  node: CompiledWebpageNode,
  visit: (node: CompiledWebpageNode, parent: CompiledWebpageNode | undefined) => void,
  parent?: CompiledWebpageNode,
): void {
  visit(node, parent)
  for (const child of node.children ?? []) walk(child, visit, node)
}

function visibleText(node: CompiledWebpageNode): string {
  if (node.type === "text") return node.text ?? ""
  return (node.children ?? []).map(visibleText).join(" ").replace(/\s+/g, " ").trim()
}

function compactText(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function classTokens(attrs: CompiledWebpageAttribute[] | undefined): string[] {
  const classAttr = attrs?.find((candidate) => candidate.name.toLowerCase() === "class")
  return classAttr?.classTokens ?? splitClasses(classAttr?.value)
}

function splitClasses(value: string | undefined): string[] {
  return (
    value
      ?.split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean) ?? []
  )
}

function attr(attrs: CompiledWebpageAttribute[] | undefined, name: string): string | undefined {
  return attrs?.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase())?.value
}

function toDataFieldName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, " ").trim()
  const words = cleaned ? cleaned.split(/\s+/) : ["field"]
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("")
}

function buildSegmentLookup(segments: WebCloneSegment[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const segment of segments) {
    lookup.set(segment.rootNodeId, segment.id)
  }
  return lookup
}

function componentName(segment: WebCloneSegment): string {
  const text = segment.textPreview[0]
    ?.replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ")
  const base = text || segment.tag || "surface"
  return `${toPascalCase(base)}Skeleton`
}

function inferSkeletonKind(segment: WebCloneSegment): string {
  const tags = segment.nodeOutline.map((node) => node.tag).filter(Boolean)
  if (segment.tag === "header" || segment.tag === "nav" || tags.includes("nav")) return "navigation"
  if (tags.includes("table")) return "table"
  if (tags.includes("form") || tags.includes("input") || tags.includes("button") || tags.includes("select"))
    return "controls"
  if (tags.includes("ul") || tags.includes("ol") || tags.includes("li")) return "list"
  if (segment.strategy === "canvas-raster" || segment.strategy === "svg-inline") return "asset-backed-visual"
  return "content"
}

function normalizeTag(tag: string | undefined): string | undefined {
  if (!tag) return undefined
  const lower = tag.toLowerCase()
  if (!/^[a-z][a-z0-9-]*$/.test(lower)) return "div"
  return lower
}

function isSafeAttr(name: string): boolean {
  if (SAFE_ATTRS.has(name)) return true
  if (name.startsWith("aria-") || name.startsWith("data-")) return true
  return false
}

function isVoidTag(tag: string): boolean {
  return [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "track",
    "wbr",
  ].includes(tag)
}

function findFirstElement(node: CompiledWebpageNode, tag: string): CompiledWebpageNode | undefined {
  if (node.type === "element" && node.tag?.toLowerCase() === tag) return node
  for (const child of node.children ?? []) {
    const found = findFirstElement(child, tag)
    if (found) return found
  }
  return undefined
}

function countRenderedElements(node: CompiledWebpageNode): number {
  let count = 0
  const tag = node.tag?.toLowerCase() ?? ""
  if (node.type === "element" && (DROPPED_TAGS.has(tag) || isHiddenSourceNode(node))) return 0
  if (node.type === "element" && !TRANSPARENT_TAGS.has(tag)) count++
  for (const child of node.children ?? []) count += countRenderedElements(child)
  return count
}

function countComputedStyleRules(node: CompiledWebpageNode): number {
  let count = node.type === "element" && node.layout?.styles && Object.keys(node.layout.styles).length > 0 ? 1 : 0
  for (const child of node.children ?? []) count += countComputedStyleRules(child)
  return count
}

async function writeText(root: string, files: string[], relativePath: string, content: string): Promise<void> {
  const absolute = path.join(root, relativePath)
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, content, "utf8")
  files.push(relativePath.replaceAll(path.sep, "/"))
}

async function readOptional(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw error
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

async function hasAllFiles(root: string, files: string[]): Promise<boolean> {
  for (const file of files) {
    if (!(await exists(path.join(root, file)))) return false
  }
  return true
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&")
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function toPascalCase(value: string): string {
  const result = value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
  return result || "Surface"
}
