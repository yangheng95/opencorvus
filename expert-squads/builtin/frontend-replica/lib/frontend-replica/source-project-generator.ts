import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import {
  compiledWebpageReactProperty,
  CompiledWebpageAssetGraphSchema,
  CompiledWebpageStructureSchema,
  type CompiledWebpageAsset,
  type CompiledWebpageAssetGraph,
  type CompiledWebpageAttribute,
  type CompiledWebpageNode,
  type CompiledWebpageStructure,
  type TaskArtifactRef,
} from "@opencorvus-ai/plugin"
import { GENERATED_FRONTEND_PACKAGE_PROFILE } from "./frontend-package-profile"
import { assertDirectoryTreeHasNoLinks } from "./project-path"

export interface GenerateWebCloneSourceProjectInput {
  webpageEvidenceDir: string
  sourceContextManifest: TaskArtifactRef
  referenceArtifact: TaskArtifactRef
  outputDir: string
  framework?: "react"
  packageName?: string
}

export interface GenerateWebCloneSourceProjectOutput {
  framework: "react"
  webpageEvidenceDir: string
  outputDir: string
  visualIterationMatrix: string
  files: string[]
  stats: {
    textSignalCount: number
    componentCount: number
    tableCount: number
    listCount: number
    cardCount: number
    repeatedGroupCount: number
    assetRefCount: number
    copiedCssFiles: number
  }
}

export interface SourceProjectVisualIterationViewport {
  name: string
  width: number
  height: number
  evidenceRole: "primary_reference" | "responsive_review"
  evidenceSource: "capture_viewport"
  comparison: string
}

export interface SourceProjectLayoutWidthContract {
  mode: "full_width" | "centered_container" | "unknown"
  viewportWidth: number
  referenceImageWidth?: number
  fullWidthElementCount: number
  centeredElementCount: number
  evidence: string[]
  rule: string
}

export interface SourceProjectVisualIteration {
  evidenceMethod: "task_scoped_preview_screenshots"
  viewportMatrix: SourceProjectVisualIterationViewport[]
  layoutWidthContract: SourceProjectLayoutWidthContract
  rule: string
}

function buildSourceProjectVisualIterationViewports(primary: {
  width: number
  height: number
  evidenceSource: SourceProjectVisualIterationViewport["evidenceSource"]
}): SourceProjectVisualIterationViewport[] {
  return [
    {
      name: "desktop-reference",
      width: primary.width,
      height: primary.height,
      evidenceRole: "primary_reference",
      evidenceSource: primary.evidenceSource,
      comparison:
        "Capture and inspect a task-scoped preview screenshot against the exact named reference artifact for each changed region.",
    },
  ]
}

export function renderSourceProjectVisualIterationMatrix(
  viewports: readonly SourceProjectVisualIterationViewport[],
): string {
  return viewports
    .map(
      (viewport) =>
        `${viewport.name} ${viewport.width}x${viewport.height} (${viewport.evidenceRole}, ${viewport.evidenceSource}): ${viewport.comparison}`,
    )
    .join(" ")
}

export function renderSourceProjectLayoutWidthContract(contract: SourceProjectLayoutWidthContract): string {
  const reference = contract.referenceImageWidth ? ` reference=${contract.referenceImageWidth}px` : ""
  const evidence = contract.evidence.length > 0 ? ` evidence=${contract.evidence.join("; ")}` : ""
  return `${contract.mode} viewport=${contract.viewportWidth}px${reference} full_width_elements=${contract.fullWidthElementCount} centered_elements=${contract.centeredElementCount}: ${contract.rule}${evidence}`
}

interface SourceTable {
  title?: string
  headers: string[]
  rows: string[][]
}

interface SourceList {
  title?: string
  items: string[]
}

interface SourceCard {
  title?: string
  fields: Array<{ label?: string; value: string }>
  text: string[]
}

interface SourceRepeatedGroup {
  title?: string
  sampleTexts: string[]
}

interface SourceComponentPattern {
  nodeId: string
  kind?: string
  signals?: Record<string, unknown>
}

interface SourceComponent {
  name: string
  kind?: string
  tag?: string
  classNames: string[]
  textPreview: string[]
}

interface SourceAssetRef {
  id: string
  kind: string
  path: string
  mime?: string
  semanticRole?: string
  preview?: string
  bytes?: number
}

interface SourceProjectData {
  textSignals: string[]
  components: SourceComponent[]
  tables: SourceTable[]
  lists: SourceList[]
  cards: SourceCard[]
  repeatedGroups: SourceRepeatedGroup[]
  sourceComponentPatterns: SourceComponentPattern[]
  assets: SourceAssetRef[]
}

interface DomNode {
  type?: string
  name?: string
  data?: string
  sourceNodeId?: string
  namespace?: SourceNodeNamespace
  attribs?: Record<string, string>
  children?: DomNode[]
}

type SourceNodeNamespace = "html" | "svg" | "mathml"

const SOURCE_NAMESPACE_URIS: Record<SourceNodeNamespace, string> = {
  html: "http://www.w3.org/1999/xhtml",
  svg: "http://www.w3.org/2000/svg",
  mathml: "http://www.w3.org/1998/Math/MathML",
}

interface ResolvedCompiledWebpageAsset {
  manifest: CompiledWebpageAsset
  text: string
}

interface CompiledWebpageEvidence {
  pageIr: CompiledWebpageStructure
  assetGraph: CompiledWebpageAssetGraph
  assetsById: Map<string, ResolvedCompiledWebpageAsset>
}

interface DocumentContext {
  htmlAttrs: Record<string, string>
  bodyAttrs: Record<string, string>
  title?: string
  headMarkup: string[]
}

interface SourceDomRenderProject {
  sourceDomPage: string
  regionFiles: Map<string, string>
  regionMetrics: SourceDomRegionMetric[]
}

interface SourceDomRegionMetric {
  componentName: string
  filePath: string
  sourceNodeId?: string
  sourceSegmentId?: string
  sourceBounds?: SourceBounds
  sourceComponentPattern?: SourceComponentPattern
  tag: string
  heading?: string
  textPreview: string
  elementCount: number
  bytes: number
  complexity: "low" | "medium" | "high"
}

interface SourceBounds {
  x: number
  y: number
  w: number
  h: number
}

interface SourceDomRenderContext {
  nodeBoundsById: Map<string, SourceBounds>
  sourceComponentPatternsByNodeId: Map<string, SourceComponentPattern>
  regionFiles: Map<string, string>
  regionMetrics: SourceDomRegionMetric[]
  regionNameCounts: Map<string, number>
  currentImports: Map<string, string>
  currentImportPrefix: string
  extractRegions: boolean
  regionDepth: number
  maxRegionDepth: number
  maxRegionCount: number
  omitSourceProvenanceAttributes: boolean
}

interface SourceRegionRenderRef {
  componentName: string
  importPath: string
}

interface SourceInputProvenance {
  rootDir: string
  consumedPaths: Set<string>
}

export async function generateWebCloneSourceProject(
  input: GenerateWebCloneSourceProjectInput,
): Promise<GenerateWebCloneSourceProjectOutput> {
  const framework = input.framework ?? "react"
  if (framework !== "react") throw new Error(`Unsupported web clone source framework: ${framework}`)

  const webpageEvidenceDir = path.resolve(input.webpageEvidenceDir)
  const outputDir = path.resolve(input.outputDir)
  await assertDirectoryTreeHasNoLinks(webpageEvidenceDir, "webpageEvidenceDir")
  await assertWebpageEvidenceInputs(webpageEvidenceDir)
  await fs.mkdir(outputDir)
  const provenance: SourceInputProvenance = { rootDir: webpageEvidenceDir, consumedPaths: new Set() }

  const [sourceSkeleton, rawCriticalCss, rawFullSourceCss, contentModel, componentTree, compiledEvidence] =
    await Promise.all([
      readText(path.join(webpageEvidenceDir, "source-skeleton", "index.html"), provenance),
      readText(path.join(webpageEvidenceDir, "source-skeleton", "critical.css"), provenance),
      readText(path.join(webpageEvidenceDir, "source-skeleton", "full-source.css"), provenance),
      readJsonOptional(path.join(webpageEvidenceDir, "source-ir", "content-model.json"), provenance),
      readJsonOptional(path.join(webpageEvidenceDir, "source-ir", "component-tree.json"), provenance),
      readCompiledWebpageEvidence(webpageEvidenceDir, provenance),
    ])
  const criticalCss = sanitizeCssSidecar(rawCriticalCss)
  const fullSourceCss = sanitizeCssSidecar(rawFullSourceCss)
  const projectData = buildSourceProjectData({
    sourceSkeleton,
    contentModel,
    componentTree,
    assetManifest: compiledEvidence.assetGraph,
  })
  const inertSourceProjection = buildInertSourceProjection(compiledEvidence)
  const resolvedPageIr = resolveCompiledPageIr(compiledEvidence)
  const nodeBoundsById = extractNodeBounds(compiledEvidence.pageIr)
  const documentContext = extractDocumentContext(resolvedPageIr, compiledEvidence.pageIr.source.title)
  const sourceDomProject = renderSourceDomProject(resolvedPageIr, nodeBoundsById, projectData.sourceComponentPatterns)
  const visualIteration = await buildSourceProjectVisualIteration(webpageEvidenceDir, provenance)

  const packageName = normalizePackageName(input.packageName ?? `web-clone-${path.basename(outputDir)}`)
  const files = new Map<string, string>()
  files.set("package.json", renderPackageJson(packageName))
  files.set("tsconfig.json", renderTsconfigJson())
  files.set("index.html", renderIndexHtml(documentContext))
  files.set("README.md", renderReadme(visualIteration))
  files.set("vite.config.ts", renderViteConfigTs())
  files.set("src/vite-env.d.ts", renderViteEnvDts())
  files.set("src/main.tsx", renderMainTsx())
  files.set("src/App.tsx", renderAppTsx())
  files.set("src/components/SourceClonePage.tsx", renderSourceClonePageTsx())
  files.set("src/components/SourceDomPage.tsx", sourceDomProject.sourceDomPage)
  for (const [relativePath, content] of sourceDomProject.regionFiles) files.set(relativePath, content)
  files.set("src/components/sourceDomRuntime.ts", renderSourceDomRuntimeTs())
  files.set("src/data/sourceDomRegions.ts", renderSourceDomRegionsTs(sourceDomProject.regionMetrics))
  files.set(
    "src/styles.css",
    renderStylesCss({ hasCriticalCss: criticalCss.length > 0, hasFullCss: fullSourceCss.length > 0 }),
  )
  if (criticalCss.length > 0) files.set("src/styles/source-critical.css", criticalCss)
  if (fullSourceCss.length > 0) files.set("src/styles/source-full.css", fullSourceCss)

  for (const [relativePath, content] of files) {
    await writeFile(path.join(outputDir, relativePath), content)
  }
  const generatedFrom = consumedSourceInputs(provenance)
  await writeJson(path.join(outputDir, "src/data/sourceProjectManifest.json"), {
    version: 1,
    purpose: "web-clone-source-project",
    sourceContext: {
      manifest: input.sourceContextManifest,
      referenceImage: input.referenceArtifact,
    },
    generatedFrom,
    sourceDomRegions: {
      count: sourceDomProject.regionMetrics.length,
      largestBytes: Math.max(0, ...sourceDomProject.regionMetrics.map((region) => region.bytes)),
      highComplexityCount: sourceDomProject.regionMetrics.filter((region) => region.complexity === "high").length,
      metricsModule: "src/data/sourceDomRegions.ts",
    },
    visualIteration,
    inertSourceProjection,
    rules: [
      "Use the generated source DOM components and sourceProjectManifest.json as the editable implementation surface.",
      "Do not render source-context reference images, screenshot files, base64 payloads, or hidden semantic coverage layers as the clone.",
      "Use only sourceContext.referenceImage as the exact task-scoped desktop visual comparison identity.",
    ],
  })

  const writtenFiles = [...files.keys(), "src/data/sourceProjectManifest.json"].sort()

  return {
    framework,
    webpageEvidenceDir,
    outputDir,
    visualIterationMatrix: renderSourceProjectVisualIterationMatrix(visualIteration.viewportMatrix),
    files: writtenFiles.map((file) => path.join(outputDir, file)),
    stats: {
      textSignalCount: projectData.textSignals.length,
      componentCount: projectData.components.length,
      tableCount: projectData.tables.length,
      listCount: projectData.lists.length,
      cardCount: projectData.cards.length,
      repeatedGroupCount: projectData.repeatedGroups.length,
      assetRefCount: projectData.assets.length,
      copiedCssFiles: [criticalCss, fullSourceCss].filter(Boolean).length,
    },
  }
}

function buildInertSourceProjection(evidence: CompiledWebpageEvidence): {
  policy: "source-code-is-evidence-not-executable-runtime"
  scripts: Array<{ nodeId: string; assetId?: string; sha256?: string }>
  replacedStyleNodeIds: string[]
  eventAttributes: Array<{ nodeId: string; name: string }>
  activeUrls: Array<{ nodeId: string; name: string }>
  nonRuntimeNodes: Array<{ nodeId: string; type: "comment" | "directive"; text: string }>
  excludedHeadNodes: Array<{ nodeId: string; tag: string }>
} {
  const scripts: Array<{ nodeId: string; assetId?: string; sha256?: string }> = []
  const replacedStyleNodeIds: string[] = []
  const eventAttributes: Array<{ nodeId: string; name: string }> = []
  const activeUrls: Array<{ nodeId: string; name: string }> = []
  const nonRuntimeNodes: Array<{ nodeId: string; type: "comment" | "directive"; text: string }> = []
  const excludedHeadNodes: Array<{ nodeId: string; tag: string }> = []
  function visit(node: CompiledWebpageNode, parentTag?: string, parentNamespace: SourceNodeNamespace = "html"): void {
    const tag = node.tag?.toLowerCase()
    const namespace = node.type === "element" ? sourceNodeNamespace(node.namespace) : parentNamespace
    if (node.type === "comment" || node.type === "directive") {
      nonRuntimeNodes.push({ nodeId: node.id, type: node.type, text: node.text ?? "" })
    }
    if (tag === "script") {
      const textNode = node.children?.find((child) => child.type === "text" && child.assetId)
      const asset = textNode?.assetId ? evidence.assetsById.get(textNode.assetId) : undefined
      scripts.push({ nodeId: node.id, assetId: textNode?.assetId, sha256: asset?.manifest.sha256 })
    }
    if (tag === "style") replacedStyleNodeIds.push(node.id)
    for (const attr of node.attrs ?? []) {
      const rawValue = attr.assetId
        ? requireCompiledAsset(evidence.assetsById, attr.assetId, `${node.id}.${attr.name}`).text
        : (attr.value ?? "")
      if (isEventHandlerAttribute(namespace, attr.name)) eventAttributes.push({ nodeId: node.id, name: attr.name })
      if (isActiveSourceAttribute(namespace, tag ?? "", attr.name, rawValue)) {
        activeUrls.push({ nodeId: node.id, name: attr.name })
      }
    }
    if (parentTag === "head" && tag && !HEAD_RUNTIME_TAGS.has(tag)) excludedHeadNodes.push({ nodeId: node.id, tag })
    for (const child of node.children ?? []) visit(child, tag ?? parentTag, namespace)
  }
  visit(evidence.pageIr.root)
  return {
    policy: "source-code-is-evidence-not-executable-runtime",
    scripts,
    replacedStyleNodeIds,
    eventAttributes,
    activeUrls,
    nonRuntimeNodes,
    excludedHeadNodes,
  }
}

function buildSourceProjectData(input: {
  sourceSkeleton: string
  contentModel: unknown
  componentTree: unknown
  assetManifest: unknown
}): SourceProjectData {
  const tables = readTables(input.contentModel)
  const lists = readLists(input.contentModel)
  const cards = readCards(input.contentModel)
  const repeatedGroups = readRepeatedGroups(input.contentModel)
  const sourceComponentPatterns = readSourceComponentPatterns(input.contentModel)
  const components = readComponents(input.componentTree)
  const assets = readAssetRefs(input.assetManifest)
  const textSignals = rankTextSignals([
    ...collectVisibleStrings(input.contentModel),
    ...components.flatMap((component) => [component.name, ...component.textPreview]),
    ...tables.flatMap((table) => [...table.headers, ...table.rows.flat()]),
    ...lists.flatMap((list) => list.items),
    ...cards.flatMap((card) => [...card.text, ...card.fields.map((field) => field.value)]),
    ...repeatedGroups.flatMap((group) => group.sampleTexts),
    ...collectSkeletonText(input.sourceSkeleton),
  ])

  return {
    textSignals,
    components,
    tables,
    lists,
    cards,
    repeatedGroups,
    sourceComponentPatterns,
    assets,
  }
}

async function readCompiledWebpageEvidence(
  webpageEvidenceDir: string,
  provenance: SourceInputProvenance,
): Promise<CompiledWebpageEvidence> {
  const pageIrPath = path.join(webpageEvidenceDir, "page.ir.json")
  const assetGraphPath = path.join(webpageEvidenceDir, "assets", "manifest.json")
  const pageIr = CompiledWebpageStructureSchema.parse(await readJsonRequired(pageIrPath, provenance))
  const assetGraph = CompiledWebpageAssetGraphSchema.parse(await readJsonRequired(assetGraphPath, provenance))
  if (assetGraph.sourceIr !== "page.ir.json") {
    throw new Error(`Compiled webpage asset graph sourceIr must be page.ir.json: ${assetGraph.sourceIr}`)
  }
  if (pageIr.stats.sidecarAssets !== assetGraph.assets.length) {
    throw new Error(
      `Compiled webpage sidecar count mismatch: page.ir.json=${pageIr.stats.sidecarAssets}, manifest=${assetGraph.assets.length}`,
    )
  }

  const assetsById = new Map<string, ResolvedCompiledWebpageAsset>()
  const assetPaths = new Set<string>()
  for (const asset of assetGraph.assets) {
    if (assetsById.has(asset.id)) throw new Error(`Duplicate compiled webpage asset id: ${asset.id}`)
    const relativePath = assertCompiledAssetPath(asset)
    if (assetPaths.has(relativePath)) throw new Error(`Duplicate compiled webpage asset path: ${relativePath}`)
    assetPaths.add(relativePath)
    const absolutePath = path.resolve(webpageEvidenceDir, ...relativePath.split("/"))
    const bytes = await fs.readFile(absolutePath)
    recordConsumedSourceInput(provenance, absolutePath)
    let text: string
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch (error) {
      throw new Error(`Compiled webpage asset is not valid UTF-8: ${asset.id}`, { cause: error })
    }
    const digest = createHash("sha256").update(bytes).digest("hex")
    if (digest !== asset.sha256) throw new Error(`Compiled webpage asset digest mismatch: ${asset.id}`)
    if (bytes.byteLength !== asset.bytes) throw new Error(`Compiled webpage asset byte count mismatch: ${asset.id}`)
    if (text.length !== asset.chars) throw new Error(`Compiled webpage asset character count mismatch: ${asset.id}`)
    if (asset.kind === "image-data-uri" || asset.kind === "data-uri") {
      const parsed = parseDataUrl(text)
      if (!parsed || parsed.mime !== asset.mime) {
        throw new Error(`Compiled webpage data URI MIME mismatch: ${asset.id}`)
      }
    }
    if (asset.kind === "svg-path-data" && text.trim().length === 0) {
      throw new Error(`Compiled webpage SVG path asset is empty: ${asset.id}`)
    }
    assetsById.set(asset.id, { manifest: asset, text })
  }

  validateCompiledAssetReferences(pageIr.root, assetsById)
  await assertNoUndeclaredCompiledAssets(webpageEvidenceDir, assetPaths)
  return { pageIr, assetGraph, assetsById }
}

async function assertNoUndeclaredCompiledAssets(webpageEvidenceDir: string, declaredPaths: Set<string>): Promise<void> {
  const assetsRoot = path.join(webpageEvidenceDir, "assets")
  async function visit(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolutePath)
        continue
      }
      if (!entry.isFile()) throw new Error(`Compiled webpage assets contain an unsupported entry: ${absolutePath}`)
      const relativePath = path.relative(webpageEvidenceDir, absolutePath).split(path.sep).join("/")
      if (relativePath !== "assets/manifest.json" && !declaredPaths.has(relativePath)) {
        throw new Error(`Compiled webpage asset file is not declared by manifest: ${relativePath}`)
      }
    }
  }
  await visit(assetsRoot)
}

function assertCompiledAssetPath(asset: CompiledWebpageAsset): string {
  const normalized = asset.path.replaceAll("\\", "/")
  if (
    normalized !== asset.path ||
    path.posix.isAbsolute(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
    !normalized.startsWith("assets/")
  ) {
    throw new Error(`Compiled webpage asset path is invalid: ${asset.path}`)
  }
  const validLocation =
    (asset.kind === "css" && /^assets\/styles\/[^/]+\.css$/.test(normalized)) ||
    (asset.kind === "script" && /^assets\/scripts\/[^/]+\.js$/.test(normalized)) ||
    (asset.kind === "svg-path-data" && /^assets\/svg\/[^/]+\.path\.txt$/.test(normalized)) ||
    (asset.kind === "image-data-uri" && /^assets\/images\/[^/]+\.[^.]+\.txt$/.test(normalized)) ||
    (asset.kind === "data-uri" && /^assets\/values\/[^/]+\.data-uri\.txt$/.test(normalized)) ||
    ((asset.kind === "large-attribute" || asset.kind === "large-text") &&
      /^assets\/values\/[^/]+\.txt$/.test(normalized))
  if (!validLocation) throw new Error(`Compiled webpage asset kind/path mismatch: ${asset.id}`)
  return normalized
}

function validateCompiledAssetReferences(
  root: CompiledWebpageNode,
  assetsById: Map<string, ResolvedCompiledWebpageAsset>,
): void {
  const nodesById = new Map<string, CompiledWebpageNode>()
  const parentTagsById = new Map<string, string | undefined>()
  function collect(node: CompiledWebpageNode, parentTag?: string): void {
    if (nodesById.has(node.id)) throw new Error(`Duplicate compiled webpage node id: ${node.id}`)
    nodesById.set(node.id, node)
    parentTagsById.set(node.id, parentTag)
    for (const child of node.children ?? []) collect(child, node.tag ?? parentTag)
  }
  collect(root)

  const expectedEdges = new Set<string>()
  for (const node of nodesById.values()) {
    if (node.assetId) {
      const parentTag = parentTagsById.get(node.id)
      const expectedKind =
        parentTag?.toLowerCase() === "style" ? "css" : parentTag?.toLowerCase() === "script" ? "script" : "large-text"
      const asset = requireCompiledAsset(assetsById, node.assetId, node.id)
      if (asset.manifest.kind !== expectedKind) {
        throw new Error(`Compiled webpage text asset kind mismatch: ${node.assetId}`)
      }
      assertAssetUse(asset.manifest, node.id, parentTag, undefined)
      expectedEdges.add(
        assetUseKey(
          node.assetId,
          node.id,
          parentTag,
          undefined,
          expectedKind === "css" ? "stylesheet-text" : expectedKind === "script" ? "script-text" : "text-node",
        ),
      )
    }
    for (const attr of node.attrs ?? []) {
      if (!attr.assetId) continue
      const asset = requireCompiledAsset(assetsById, attr.assetId, `${node.id}.${attr.name}`)
      const allowedKinds =
        node.tag?.toLowerCase() === "path" && attr.name === "d"
          ? new Set(["svg-path-data"])
          : new Set(["data-uri", "image-data-uri", "large-attribute"])
      if (!allowedKinds.has(asset.manifest.kind)) {
        throw new Error(`Compiled webpage attribute asset kind mismatch: ${attr.assetId}`)
      }
      assertAssetUse(asset.manifest, node.id, node.tag, attr.name)
      const role =
        asset.manifest.kind === "svg-path-data"
          ? "svg-geometry"
          : asset.manifest.kind === "large-attribute"
            ? "attribute-value"
            : "attribute-data-uri"
      expectedEdges.add(assetUseKey(attr.assetId, node.id, node.tag, attr.name, role))
    }
  }

  const actualEdges = new Set<string>()
  for (const asset of assetsById.values()) {
    if (asset.manifest.usedBy.length === 0) throw new Error(`Compiled webpage asset has no owner: ${asset.manifest.id}`)
    for (const use of asset.manifest.usedBy) {
      const node = nodesById.get(use.nodeId)
      if (!node) throw new Error(`Compiled webpage asset owner is missing: ${asset.manifest.id}`)
      const ownerTag = node.type === "text" ? parentTagsById.get(node.id) : node.tag
      if (use.tag !== ownerTag) {
        throw new Error(`Compiled webpage asset owner tag mismatch: ${asset.manifest.id}`)
      }
      if (use.attribute !== undefined && !(node.attrs ?? []).some((attr) => attr.name === use.attribute)) {
        throw new Error(`Compiled webpage asset owner attribute mismatch: ${asset.manifest.id}`)
      }
      if (use.role !== asset.manifest.semanticRole) {
        throw new Error(`Compiled webpage asset semantic role mismatch: ${asset.manifest.id}`)
      }
      const key = assetUseKey(asset.manifest.id, use.nodeId, use.tag, use.attribute, use.role)
      if (actualEdges.has(key)) throw new Error(`Duplicate compiled webpage asset ownership: ${asset.manifest.id}`)
      actualEdges.add(key)
    }
  }
  if (expectedEdges.size !== actualEdges.size || [...expectedEdges].some((edge) => !actualEdges.has(edge))) {
    throw new Error("Compiled webpage IR references and manifest ownership do not match")
  }
}

function assetUseKey(
  assetId: string,
  nodeId: string,
  tag: string | undefined,
  attribute: string | undefined,
  role: string | undefined,
): string {
  return JSON.stringify([assetId, nodeId, tag ?? null, attribute ?? null, role ?? null])
}

function requireCompiledAsset(
  assetsById: Map<string, ResolvedCompiledWebpageAsset>,
  assetId: string,
  owner: string,
): ResolvedCompiledWebpageAsset {
  const asset = assetsById.get(assetId)
  if (!asset) throw new Error(`Compiled webpage assetId ${assetId} referenced by ${owner} is missing from manifest`)
  return asset
}

function assertAssetUse(
  asset: CompiledWebpageAsset,
  nodeId: string,
  tag: string | undefined,
  attribute: string | undefined,
): void {
  const matches = asset.usedBy.some((use) => use.nodeId === nodeId && use.tag === tag && use.attribute === attribute)
  if (!matches) throw new Error(`Compiled webpage asset ownership mismatch: ${asset.id}`)
}

function resolveCompiledPageIr(evidence: CompiledWebpageEvidence): CompiledWebpageStructure {
  function resolveNode(node: CompiledWebpageNode): CompiledWebpageNode {
    if (node.type === "text") {
      return {
        ...node,
        text: node.assetId ? requireCompiledAsset(evidence.assetsById, node.assetId, node.id).text : (node.text ?? ""),
        assetId: undefined,
      }
    }
    return {
      ...node,
      attrs: node.attrs?.map((attr) => resolveCompiledAttribute(node, attr, evidence.assetsById)),
      children: node.children?.map(resolveNode),
    }
  }
  return { ...evidence.pageIr, root: resolveNode(evidence.pageIr.root) }
}

function resolveCompiledAttribute(
  node: CompiledWebpageNode,
  attr: CompiledWebpageAttribute,
  assetsById: Map<string, ResolvedCompiledWebpageAsset>,
): CompiledWebpageAttribute {
  if (attr.assetId) {
    const asset = requireCompiledAsset(assetsById, attr.assetId, `${node.id}.${attr.name}`)
    return { ...attr, value: asset.text, assetId: undefined }
  }
  return { ...attr, value: attr.value ?? "" }
}

function extractNodeBounds(pageIr: unknown): Map<string, SourceBounds> {
  const boundsById = new Map<string, SourceBounds>()

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (!value || typeof value !== "object") return
    const row = value as Record<string, unknown>
    const bounds = asSourceBounds((row.layout as Record<string, unknown> | undefined)?.bounds)
    if (typeof row.id === "string" && bounds) boundsById.set(row.id, bounds)
    if (row.root) visit(row.root)
    if (Array.isArray(row.children)) {
      for (const child of row.children) visit(child)
    }
  }

  visit(pageIr)
  return boundsById
}

function asSourceBounds(value: unknown): SourceBounds | undefined {
  if (!value || typeof value !== "object") return undefined
  const row = value as Record<string, unknown>
  const x = typeof row.x === "number" ? row.x : undefined
  const y = typeof row.y === "number" ? row.y : undefined
  const w = typeof row.w === "number" ? row.w : typeof row.width === "number" ? row.width : undefined
  const h = typeof row.h === "number" ? row.h : typeof row.height === "number" ? row.height : undefined
  if (x === undefined || y === undefined || w === undefined || h === undefined) return undefined
  return { x, y, w, h }
}

function extractDocumentContext(pageIr: unknown, sourceTitle?: string): DocumentContext {
  const head = findIrElement(pageIr, "head")
  return {
    htmlAttrs: extractElementAttrs(pageIr, "html"),
    bodyAttrs: extractElementAttrs(pageIr, "body"),
    title: sourceTitle,
    headMarkup: Array.isArray(head?.children)
      ? head.children.flatMap((child) => renderSafeHeadNode(child as CompiledWebpageNode, 2))
      : [],
  }
}

function renderSafeHeadNode(node: CompiledWebpageNode, indentLevel: number): string[] {
  if (node.type === "text") return node.text ? [`${indent(indentLevel)}${escapeHtmlText(node.text)}`] : []
  if (node.type !== "element" || !node.tag) return []
  const tag = node.tag.toLowerCase()
  if (
    !HEAD_RUNTIME_TAGS.has(tag) ||
    (tag === "meta" && hasRefreshDirective(node.attrs)) ||
    (tag === "link" && !hasCanonicalLinkRelation(node.attrs))
  )
    return []
  const attrs = inertSourceAttributes("html", tag, irAttrsToDomAttribs(node.attrs))
  const open = `${indent(indentLevel)}<${tag}${renderHtmlAttributes(attrs)}`
  if (VOID_TAGS.has(tag)) return [`${open} />`]
  const children = (node.children ?? []).flatMap((child) => renderSafeHeadNode(child, indentLevel + 1))
  return [`${open}>`, ...children, `${indent(indentLevel)}</${tag}>`]
}

const HEAD_RUNTIME_TAGS = new Set(["link", "meta", "title"])

function hasCanonicalLinkRelation(attrs: CompiledWebpageAttribute[] | undefined): boolean {
  return (attrs ?? []).some((attr) => attr.name.toLowerCase() === "rel" && attr.value?.toLowerCase() === "canonical")
}

function hasRefreshDirective(attrs: CompiledWebpageAttribute[] | undefined): boolean {
  return (attrs ?? []).some(
    (attr) => attr.name.toLowerCase() === "http-equiv" && attr.value?.toLowerCase() === "refresh",
  )
}

function escapeHtmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function extractElementAttrs(pageIr: unknown, tagName: string): Record<string, string> {
  const node = findIrElement(pageIr, tagName)
  return node ? inertSourceAttributes("html", tagName, irAttrsToDomAttribs(node.attrs)) : {}
}

function findIrElement(value: unknown, tagName: string): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findIrElement(item, tagName)
      if (found) return found
    }
    return undefined
  }
  if (!value || typeof value !== "object") return undefined
  const row = value as Record<string, unknown>
  if (row.type === "element" && typeof row.tag === "string" && row.tag.toLowerCase() === tagName.toLowerCase()) return row
  if (row.root) {
    const found = findIrElement(row.root, tagName)
    if (found) return found
  }
  if (Array.isArray(row.children)) {
    for (const child of row.children) {
      const found = findIrElement(child, tagName)
      if (found) return found
    }
  }
  return undefined
}

function domNodeFromIrNode(value: unknown): DomNode | undefined {
  if (!value || typeof value !== "object") return undefined
  const row = value as Record<string, unknown>
  if (row.type === "text") {
    return { type: "text", data: typeof row.text === "string" ? row.text : "" }
  }
  if (row.type !== "element" || typeof row.tag !== "string") return undefined
  const namespace = sourceNodeNamespace(row.namespace)
  return {
    type: "tag",
    name: namespace === "html" ? row.tag.toLowerCase() : row.tag,
    sourceNodeId: typeof row.id === "string" ? row.id : undefined,
    namespace,
    attribs: irAttrsToDomAttribs(row.attrs),
    children: Array.isArray(row.children)
      ? row.children
          .map((child) => domNodeFromIrNode(child))
          .filter((child): child is DomNode => Boolean(child))
      : [],
  }
}

function sourceNodeNamespace(value: unknown): SourceNodeNamespace {
  for (const [namespace, uri] of Object.entries(SOURCE_NAMESPACE_URIS) as Array<[SourceNodeNamespace, string]>) {
    if (value === uri) return namespace
  }
  throw new Error(`Compiled webpage element has unsupported namespace: ${String(value ?? "<missing>")}`)
}

function irAttrsToDomAttribs(attrs: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!Array.isArray(attrs)) return result
  for (const attr of attrs) {
    const row = attr && typeof attr === "object" ? (attr as Record<string, unknown>) : undefined
    if (!row || typeof row.name !== "string") continue
    if (typeof row.value !== "string") continue
    result[row.name] = row.value
  }
  return result
}

function readTables(contentModel: unknown): SourceTable[] {
  return readArray(contentModel, "tables")
    .map((item, index) => {
      const row = asRecord(item)
      const headers = readStringArray(row.headers).filter((value) => value.length > 0)
      const rows = readTableRows(row.rows)
      return {
        title: readString(row.title) ?? `Table ${index + 1}`,
        headers,
        rows,
      }
    })
    .filter((table) => table.headers.length > 0 || table.rows.length > 0)
}

function readLists(contentModel: unknown): SourceList[] {
  return readArray(contentModel, "lists")
    .map((item, index) => {
      const row = asRecord(item)
      return {
        title: readString(row.title) ?? `List ${index + 1}`,
        items: readStringArray(row.items),
      }
    })
    .filter((list) => list.items.length > 0)
}

function readCards(contentModel: unknown): SourceCard[] {
  return readArray(contentModel, "cards")
    .map((item, index) => {
      const row = asRecord(item)
      const fields: Array<{ label?: string; value: string }> = []
      for (const field of readArray(row, "fields")) {
        const fieldRow = asRecord(field)
        const value = readString(fieldRow.value) ?? readString(fieldRow.text)
        if (!value) continue
        const label = readString(fieldRow.label)
        fields.push(label ? { label, value } : { value })
      }
      return {
        title: readString(row.title) ?? `Card ${index + 1}`,
        fields,
        text: readStringArray(row.text),
      }
    })
    .filter((card) => card.fields.length > 0 || card.text.length > 0)
}

function readRepeatedGroups(contentModel: unknown): SourceRepeatedGroup[] {
  return readArray(contentModel, "repeatedGroups")
    .map((item, index) => {
      const row = asRecord(item)
      return {
        title: readString(row.title) ?? `Repeated group ${index + 1}`,
        sampleTexts: readStringArray(row.sampleTexts),
      }
    })
    .filter((group) => group.sampleTexts.length > 0)
}

function readSourceComponentPatterns(contentModel: unknown): SourceComponentPattern[] {
  return readArray(contentModel, "sourceComponentPatterns")
    .map((item): SourceComponentPattern | undefined => {
      const row = asRecord(item)
      const nodeId = readString(row.nodeId)
      if (!nodeId) return undefined
      return {
        nodeId,
        kind: readString(row.kind),
        signals: asRecord(row.signals),
      }
    })
    .filter((item): item is SourceComponentPattern => Boolean(item))
}

function readComponents(componentTree: unknown): SourceComponent[] {
  return readArray(componentTree, "components").map((item, index) => {
    const row = asRecord(item)
    const name = readString(row.name) ?? `SourceComponent${index + 1}`
    return {
      name: toComponentName(name, index),
      kind: readString(row.kind),
      tag: readString(row.tag),
      classNames: readStringArray(row.classNames),
      textPreview: readStringArray(row.textPreview),
    }
  })
}

function readAssetRefs(assetManifest: unknown): SourceAssetRef[] {
  const root = asRecord(assetManifest)
  const assets = Array.isArray(root.assets) ? root.assets : Array.isArray(assetManifest) ? assetManifest : []
  const refs: SourceAssetRef[] = []
  for (const item of assets) {
    const row = asRecord(item)
    const id = readString(row.id)
    const kind = readString(row.kind)
    const assetPath = readString(row.path)
    if (!id || !kind || !assetPath) continue
    const ref: SourceAssetRef = { id, kind, path: assetPath }
    const mime = readString(row.mime)
    const semanticRole = readString(row.semanticRole)
    const preview = sanitizeAssetPreview(readString(row.preview))
    if (mime) ref.mime = mime
    if (semanticRole) ref.semanticRole = semanticRole
    if (preview) ref.preview = preview
    if (typeof row.bytes === "number") ref.bytes = row.bytes
    refs.push(ref)
  }
  return refs
}

function sanitizeCssSidecar(css: string): string {
  return css
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | undefined {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl.trim())
  if (!match) return undefined
  const mime = match[1] || "application/octet-stream"
  const isBase64 = Boolean(match[2])
  try {
    const bytes = isBase64
      ? Buffer.from(match[3] ?? "", "base64")
      : Buffer.from(decodeURIComponent(match[3] ?? ""), "utf8")
    return { mime, bytes }
  } catch (error) {
    if (error instanceof URIError) return undefined
    throw error
  }
}

function sanitizeAssetPreview(preview: string | undefined): string | undefined {
  if (!preview) return undefined
  if (/data:/i.test(preview)) return undefined
  return preview
}

function renderPackageJson(packageName: string): string {
  return `${JSON.stringify(
    {
      name: packageName,
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: GENERATED_FRONTEND_PACKAGE_PROFILE.scripts.viteDev,
        typecheck: GENERATED_FRONTEND_PACKAGE_PROFILE.scripts.typecheck,
        build: GENERATED_FRONTEND_PACKAGE_PROFILE.scripts.viteBuild,
        preview: GENERATED_FRONTEND_PACKAGE_PROFILE.scripts.vitePreview,
      },
      packageManager: GENERATED_FRONTEND_PACKAGE_PROFILE.packageManager,
      dependencies: {
        "@vitejs/plugin-react": "^5.0.0",
        typescript: "^5.8.0",
        vite: "^7.0.0",
        react: GENERATED_FRONTEND_PACKAGE_PROFILE.runtimeDependencies.react,
        "react-dom": GENERATED_FRONTEND_PACKAGE_PROFILE.runtimeDependencies.reactDom,
      },
      devDependencies: {
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
      },
    },
    null,
    2,
  )}\n`
}

function renderTsconfigJson(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        useDefineForClassFields: true,
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        allowJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        module: "ESNext",
        moduleResolution: "Bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`
}

function renderViteConfigTs(): string {
  return [
    'import react from "@vitejs/plugin-react"',
    'import { defineConfig } from "vite"',
    "",
    "export default defineConfig({",
    "  plugins: [react()],",
    "  build: {",
    "    cssMinify: false,",
    "  },",
    "})",
    "",
  ].join("\n")
}

function renderIndexHtml(documentContext: DocumentContext): string {
  const hasTitle = documentContext.headMarkup.some((line) => /<title(?:\s|>)/i.test(line))
  return [
    "<!doctype html>",
    `<html${renderHtmlAttributes(documentContext.htmlAttrs)}>`,
    "  <head>",
    ...documentContext.headMarkup,
    ...(hasTitle ? [] : [`    <title>${escapeHtmlText(documentContext.title ?? "Web Clone Source Project")}</title>`]),
    "  </head>",
    `  <body${renderHtmlAttributes(documentContext.bodyAttrs)}>`,
    '    <script type="module" src="/src/main.tsx"></script>',
    "  </body>",
    "</html>",
    "",
  ].join("\n")
}

function renderViteEnvDts(): string {
  return ['/// <reference types="vite/client" />', ""].join("\n")
}

function renderHtmlAttributes(attrs: Record<string, string>): string {
  const parts = Object.entries(attrs)
    .filter(([name]) => /^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(name))
    .map(([name, value]) =>
      HTML_BOOLEAN_ATTRIBUTES.has(name.toLowerCase()) ? ` ${name}` : ` ${name}="${escapeHtmlAttribute(value)}"`,
    )
  return parts.join("")
}

function inertSourceAttributes(
  namespace: SourceNodeNamespace,
  tag: string,
  attrs: Record<string, string>,
): Record<string, string> {
  const inert: Record<string, string> = {}
  for (const [name, value] of Object.entries(attrs)) {
    if (isEventHandlerAttribute(namespace, name)) {
      inert[inertAttributeName("data-source-event", name)] = value
      continue
    }
    if (isActiveSourceAttribute(namespace, tag, name, value)) {
      inert[inertAttributeName("data-source-inert", name)] = value
      continue
    }
    inert[name] = value
  }
  return inert
}

function inertAttributeName(prefix: string, name: string): string {
  return `${prefix}-${name.toLowerCase().replace(/[^a-z0-9_.:-]+/g, "-")}`
}

function isEventHandlerAttribute(namespace: SourceNodeNamespace, name: string): boolean {
  const property = compiledWebpageReactProperty(namespace, name)
  return property.defined && /^on[A-Z]/.test(property.property)
}

function isActiveSourceAttribute(
  namespace: SourceNodeNamespace,
  tag: string,
  name: string,
  value: string,
): boolean {
  const normalizedName = name.toLowerCase()
  if (normalizedName === "srcdoc") return true
  if (!ACTIVE_URL_ATTRIBUTES.has(normalizedName)) return false
  const scheme = sourceUrlScheme(value)
  if (scheme === "javascript") return true
  if (scheme !== "data") return false
  return !SAFE_DATA_URL_BINDINGS.has(`${namespace}:${tag}:${normalizedName}`)
}

function sourceUrlScheme(value: string): string | undefined {
  const normalized = value.replace(/[\u0009\u000a\u000d]/g, "").replace(/^[\u0000-\u0020]+/, "")
  const separator = normalized.indexOf(":")
  return separator >= 0 ? normalized.slice(0, separator).toLowerCase() : undefined
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function renderMainTsx(): string {
  return [
    'import { StrictMode } from "react"',
    'import { createRoot } from "react-dom/client"',
    'import "./styles.css"',
    'import App from "./App"',
    "",
    "createRoot(document.body).render(",
    "  <StrictMode>",
    "    <App />",
    "  </StrictMode>,",
    ")",
    "",
  ].join("\n")
}

function renderAppTsx(): string {
  return [
    'import { SourceClonePage } from "./components/SourceClonePage"',
    "",
    "export default function App() {",
    "  return <SourceClonePage />",
    "}",
    "",
  ].join("\n")
}

function renderSourceClonePageTsx(): string {
  return [
    'import { SourceDomPage } from "./SourceDomPage"',
    "",
    "export function SourceClonePage() {",
    "  return <SourceDomPage />",
    "}",
    "",
  ].join("\n")
}

function renderSourceDomProject(
  pageIr: unknown,
  nodeBoundsById: Map<string, SourceBounds>,
  sourceComponentPatterns: SourceComponentPattern[],
): SourceDomRenderProject {
  const currentImports = new Map<string, string>()
  const context: SourceDomRenderContext = {
    nodeBoundsById,
    sourceComponentPatternsByNodeId: new Map(sourceComponentPatterns.map((pattern) => [pattern.nodeId, pattern])),
    regionFiles: new Map(),
    regionMetrics: [],
    regionNameCounts: new Map(),
    currentImports,
    currentImportPrefix: "./source-dom/",
    extractRegions: true,
    regionDepth: 0,
    maxRegionDepth: 6,
    maxRegionCount: 80,
    omitSourceProvenanceAttributes: false,
  }
  const bodyLines = renderPageIrBodyJsx(pageIr, 3, context)
  const imports = Array.from(currentImports.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([componentName, importPath]) => `import { ${componentName} } from ${JSON.stringify(importPath)}`)
  const sourceDomPage = [
    "// @ts-nocheck",
    'import { sourceAttributesRef } from "./sourceDomRuntime"',
    ...imports,
    "",
    "export function SourceDomPage() {",
    "  return (",
    "    <>",
    ...bodyLines,
    "    </>",
    "  )",
    "}",
    "",
  ].join("\n")
  context.regionMetrics.sort((a, b) => b.bytes - a.bytes || a.componentName.localeCompare(b.componentName))
  return {
    sourceDomPage,
    regionFiles: context.regionFiles,
    regionMetrics: context.regionMetrics,
  }
}

function renderSourceDomRuntimeTs(): string {
  return [
    "export function sourceAttributesRef(attributes: Record<string, string>) {",
    "  return (element: HTMLElement | SVGElement | null) => {",
    "    if (!element) return",
    "    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)",
    "  }",
    "}",
    "",
  ].join("\n")
}

function renderPageIrBodyJsx(pageIr: unknown, indentLevel: number, context: SourceDomRenderContext): string[] {
  const body = findIrElement(pageIr, "body")
  if (!body || !Array.isArray(body.children)) {
    throw new Error("Web clone source project requires page.ir.json with one body element and explicit children")
  }
  const children = body.children
    .map((child) => domNodeFromIrNode(child))
    .filter((child): child is DomNode => Boolean(child))
  const rendered = children.flatMap((child) => renderDomChildJsx(child, indentLevel, context, children))
  if (rendered.length === 0) throw new Error("Web clone source project page.ir.json body has no renderable children")
  return rendered
}

function renderDomNodeJsx(node: DomNode, indentLevel: number, context: SourceDomRenderContext): string[] {
  if (node.type === "text") {
    const text = node.data ?? ""
    return text.length > 0 ? [`${indent(indentLevel)}{${JSON.stringify(text)}}`] : []
  }
  if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return []
  const tag = node.name ?? "div"
  if (tag.toLowerCase() === "style") return []
  const safeAttribs = tag.toLowerCase() === "script" ? inertScriptAttributes(node.attribs ?? {}) : (node.attribs ?? {})
  const namespace = node.namespace ?? "html"
  const namespaceFragment = hasDirectReactNamespaceMismatch(node)
    ? renderNamespaceFragmentHtml(node.children ?? [])
    : undefined
  const children = namespaceFragment === undefined
    ? renderDomChildrenJsx(node.children ?? [], indentLevel + 1, context)
    : []
  const attrText = renderJsxAttributes(
    tag,
    namespace,
    safeAttribs,
    context.omitSourceProvenanceAttributes,
  )
  const innerHtmlAttribute =
    namespaceFragment === undefined
      ? ""
      : `dangerouslySetInnerHTML={{ __html: ${JSON.stringify(namespaceFragment)} }}`
  const allAttributes = [attrText, innerHtmlAttribute].filter(Boolean).join(" ")
  const componentTag = toJsxTagName(tag, namespace)
  const open = `${indent(indentLevel)}<${componentTag}${allAttributes ? ` ${allAttributes}` : ""}`
  if (isHtmlVoidElement(namespace, tag) || children.length === 0) return [`${open} />`]
  return [`${open}>`, ...children, `${indent(indentLevel)}</${componentTag}>`]
}

function renderDomChildrenJsx(children: DomNode[], indentLevel: number, context: SourceDomRenderContext): string[] {
  return children.flatMap((child) => renderDomChildJsx(child, indentLevel, context, children))
}

function renderDomChildJsx(
  node: DomNode,
  indentLevel: number,
  context: SourceDomRenderContext,
  siblings: DomNode[],
): string[] {
  if (shouldExtractSourceRegion(node, siblings, context)) {
    const regionRef = renderExtractedSourceRegion(node, context)
    context.currentImports.set(regionRef.componentName, regionRef.importPath)
    return [`${indent(indentLevel)}<${regionRef.componentName} />`]
  }
  return renderDomNodeJsx(node, indentLevel, context)
}

function renderExtractedSourceRegion(node: DomNode, context: SourceDomRenderContext): SourceRegionRenderRef {
  const componentName = allocateSourceRegionComponentName(node, context)
  const parentImports = context.currentImports
  const parentPrefix = context.currentImportPrefix
  const parentDepth = context.regionDepth
  const parentOmitSourceProvenanceAttributes = context.omitSourceProvenanceAttributes
  const imports = new Map<string, string>()
  context.currentImports = imports
  context.currentImportPrefix = "./"
  context.regionDepth = parentDepth + 1
  context.omitSourceProvenanceAttributes = false
  const body = renderDomNodeJsx(node, 2, context)
  context.omitSourceProvenanceAttributes = parentOmitSourceProvenanceAttributes
  context.regionDepth = parentDepth
  context.currentImportPrefix = parentPrefix
  context.currentImports = parentImports

  const nestedImports = Array.from(imports.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, importPath]) => `import { ${name} } from ${JSON.stringify(importPath)}`)
  const content = [
    "// @ts-nocheck",
    'import { sourceAttributesRef } from "../sourceDomRuntime"',
    ...nestedImports,
    "",
    `export function ${componentName}() {`,
    "  return (",
    ...body,
    "  )",
    "}",
    "",
  ].join("\n")
  const filePath = `src/components/source-dom/${componentName}.tsx`
  const bytes = Buffer.byteLength(content, "utf8")
  context.regionFiles.set(filePath, content)
  context.regionMetrics.push({
    componentName,
    filePath,
    sourceNodeId: node.sourceNodeId,
    sourceSegmentId: node.attribs?.["data-source-segment-id"],
    sourceBounds: sourceNodeBounds(node, context),
    sourceComponentPattern: sourceComponentPatternForNode(node, context),
    tag: node.name ?? "div",
    heading: findFirstHeadingText(node),
    textPreview: visibleText(node).slice(0, 180),
    elementCount: countRenderableElements(node),
    bytes,
    complexity: sourceDomComplexity(bytes, countRenderableElements(node)),
  })
  return { componentName, importPath: sourceDomImportPath(context, componentName) }
}

function sourceDomImportPath(context: SourceDomRenderContext, componentName: string): string {
  return `${context.currentImportPrefix}${componentName}`
}

function sourceNodeBounds(node: DomNode, context: SourceDomRenderContext): SourceBounds | undefined {
  const sourceNodeId = node.sourceNodeId
  return sourceNodeId ? context.nodeBoundsById.get(sourceNodeId) : undefined
}

function sourceComponentPatternForNode(
  node: DomNode,
  context: SourceDomRenderContext,
): SourceComponentPattern | undefined {
  const sourceNodeId = node.sourceNodeId
  return sourceNodeId ? context.sourceComponentPatternsByNodeId.get(sourceNodeId) : undefined
}

function sourceDomComplexity(bytes: number, elementCount: number): SourceDomRegionMetric["complexity"] {
  if (bytes >= 32_000 || elementCount >= 220) return "high"
  if (bytes >= 12_000 || elementCount >= 80) return "medium"
  return "low"
}

function shouldExtractSourceRegion(node: DomNode, siblings: DomNode[], context: SourceDomRenderContext): boolean {
  if (!context.extractRegions || context.regionDepth >= context.maxRegionDepth) return false
  if (context.regionFiles.size >= context.maxRegionCount) return false
  if (node.type !== "tag") return false
  const tag = node.name?.toLowerCase() ?? ""
  if (!tag || tag === "html" || tag === "body" || tag === "script" || tag === "style") return false
  if (node.namespace === "html" && VOID_TAGS.has(tag)) return false
  if (isSourcePageShellNode(node)) return false
  const elementCount = countRenderableElements(node)
  if (elementCount < 24) return false
  const siblingElementCount = siblings.filter((child) => child.type === "tag").length
  if (["section", "article", "header", "footer", "nav"].includes(tag) && elementCount > 40) return true
  if (context.regionDepth >= 2 && siblingElementCount >= 3 && elementCount > 16) return true
  if (siblingElementCount >= 4 && elementCount > 80) return true
  return false
}

function isSourcePageShellNode(node: DomNode): boolean {
  const tag = node.name?.toLowerCase() ?? ""
  if (tag === "main") return true
  return node.attribs?.role === "main" || node.attribs?.["data-source-role"] === "page-shell"
}

function allocateSourceRegionComponentName(node: DomNode, context: SourceDomRenderContext): string {
  const tag = node.name?.toLowerCase() ?? "region"
  const structuralLabel =
    node.attribs?.["data-source-role"] ??
    node.sourceNodeId ??
    ({ header: "Header", footer: "Footer", nav: "Navigation", main: "Main", section: "Section", article: "Article" }[
      tag
    ] as string | undefined) ??
    tag ??
    "Source"
  const base = `${toPascalIdentifier(structuralLabel)}Region`
  const count = (context.regionNameCounts.get(base) ?? 0) + 1
  context.regionNameCounts.set(base, count)
  return count === 1 ? base : `${base}${count}`
}

function countRenderableElements(node: DomNode): number {
  if (node.type !== "tag") return 0
  const tag = node.name?.toLowerCase() ?? ""
  if (tag === "script" || tag === "style") return 0
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countRenderableElements(child), 0)
}

function findFirstHeadingText(node: DomNode): string | undefined {
  if (node.type === "tag" && /^h[1-4]$/i.test(node.name ?? "")) {
    const text = visibleText(node)
    if (text) return text
  }
  for (const child of node.children ?? []) {
    const text = findFirstHeadingText(child)
    if (text) return text
  }
  return undefined
}

function visibleText(node: DomNode): string {
  if (node.type === "text")
    return decodeEntities(node.data ?? "")
      .replace(/\s+/g, " ")
      .trim()
  if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return ""
  if (node.name?.toLowerCase() === "script" || node.name?.toLowerCase() === "style") return ""
  return (node.children ?? []).map(visibleText).filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

function toPascalIdentifier(value: string): string {
  const words = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
  const label = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("")
  return /^[A-Za-z]/.test(label) ? label : `Source${label || "Region"}`
}

function inertScriptAttributes(attribs: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = { type: "application/json", "data-source-script": "inert" }
  for (const [name, value] of Object.entries(attribs)) {
    result[`data-source-script-${name.toLowerCase().replace(/[^a-z0-9_.:-]+/g, "-")}`] = value
  }
  return result
}

function hasDirectReactNamespaceMismatch(node: DomNode): boolean {
  if (!node.namespace) throw new Error("Compiled webpage element is missing its canonical namespace")
  return (node.children ?? []).some(
    (child) =>
      child.type === "tag" &&
      child.namespace !== undefined &&
      (child.namespace !== reactChildNamespace(node.namespace!, node.name ?? "", child.name ?? "") ||
        (child.namespace !== "html" &&
          VOID_TAGS.has((child.name ?? "").toLowerCase()) &&
          (child.children?.length ?? 0) > 0)),
  )
}

function reactChildNamespace(
  parentNamespace: SourceNodeNamespace,
  parentTag: string,
  childTag: string,
): SourceNodeNamespace {
  if (parentNamespace === "html") {
    if (childTag === "svg") return "svg"
    if (childTag === "math") return "mathml"
    return "html"
  }
  if (parentNamespace === "svg" && parentTag === "foreignObject") return "html"
  return parentNamespace
}

function renderNamespaceFragmentHtml(nodes: DomNode[]): string {
  return nodes.map(renderNamespaceFragmentNodeHtml).join("")
}

function renderNamespaceFragmentNodeHtml(node: DomNode): string {
  if (node.type === "text") return escapeHtmlText(node.data ?? "")
  if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return ""
  const tag = node.name ?? "div"
  if (tag.toLowerCase() === "style") return ""
  const namespace = node.namespace
  if (!namespace) throw new Error(`Compiled webpage element ${tag} is missing its canonical namespace`)
  const attributes =
    tag.toLowerCase() === "script"
      ? inertScriptAttributes(node.attribs ?? {})
      : inertSourceAttributes(namespace, tag, node.attribs ?? {})
  const open = `<${tag}${renderSerializedAttributes(namespace, attributes)}`
  if (isHtmlVoidElement(namespace, tag)) return `${open}>`
  return `${open}>${renderNamespaceFragmentHtml(node.children ?? [])}</${tag}>`
}

function renderSerializedAttributes(namespace: SourceNodeNamespace, attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .filter(([name]) => /^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(name))
    .map(([name, value]) =>
      namespace === "html" && HTML_BOOLEAN_ATTRIBUTES.has(name.toLowerCase())
        ? ` ${name}`
        : ` ${name}="${escapeHtmlAttribute(value)}"`,
    )
    .join("")
}

function renderJsxAttributes(
  tag: string,
  namespace: SourceNodeNamespace,
  attribs: Record<string, string>,
  omitSourceProvenanceAttributes = false,
): string {
  const parts: string[] = []
  const refAttributes: Record<string, string> = {}
  for (const [rawName, rawValue] of Object.entries(attribs)) {
    if (omitSourceProvenanceAttributes && (rawName === "data-source-node-id" || rawName === "data-source-segment-id"))
      continue
    if (isEventHandlerAttribute(namespace, rawName)) {
      const evidenceName = inertAttributeName("data-source-event", rawName)
      parts.push(`${evidenceName}={${JSON.stringify(rawValue)}}`)
      continue
    }
    const property = compiledWebpageReactProperty(namespace, rawName)
    const name = property.property
    if (!property.defined && !/^(?:aria|data)-/i.test(rawName)) {
      if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(rawName)) {
        throw new Error(`Compiled webpage attribute cannot be represented safely in JSX: ${rawName}`)
      }
      refAttributes[rawName] = rawValue
      continue
    }
    if (name === "style") {
      refAttributes[rawName] = rawValue
      continue
    }
    if (property.boolean) {
      parts.push(`${name}={true}`)
      continue
    }
    if (property.overloadedBoolean && rawValue === "") {
      parts.push(`${name}={true}`)
      continue
    }
    if (isActiveSourceAttribute(namespace, tag, rawName, rawValue)) {
      parts.push(`${inertAttributeName("data-source-inert", rawName)}={${JSON.stringify(rawValue)}}`)
      continue
    }
    parts.push(`${name}={${JSON.stringify(rawValue)}}`)
  }
  if (Object.keys(refAttributes).length > 0) {
    parts.push(`ref={sourceAttributesRef(${JSON.stringify(refAttributes)})}`)
  }
  return parts.join(" ")
}

function indent(level: number): string {
  return "  ".repeat(level)
}

const VOID_TAGS = new Set([
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
  "param",
  "source",
  "track",
  "wbr",
])

const HTML_BOOLEAN_ATTRIBUTES = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
])

function isHtmlVoidElement(namespace: SourceNodeNamespace, tag: string): boolean {
  return namespace === "html" && VOID_TAGS.has(tag.toLowerCase())
}

const ACTIVE_URL_ATTRIBUTES = new Set([
  "action",
  "data",
  "formaction",
  "href",
  "poster",
  "src",
  "srcset",
  "xlink:href",
])

const SAFE_DATA_URL_BINDINGS = new Set([
  "html:audio:src",
  "html:img:src",
  "html:img:srcset",
  "html:source:src",
  "html:source:srcset",
  "html:track:src",
  "html:video:poster",
  "html:video:src",
  "svg:image:href",
  "svg:image:xlink:href",
])

const SVG_TAG_NAME_MAP: Record<string, string> = {
  altglyph: "altGlyph",
  altglyphdef: "altGlyphDef",
  altglyphitem: "altGlyphItem",
  animatecolor: "animateColor",
  animatemotion: "animateMotion",
  animatetransform: "animateTransform",
  clippath: "clipPath",
  feblend: "feBlend",
  fecolormatrix: "feColorMatrix",
  fecomponenttransfer: "feComponentTransfer",
  fecomposite: "feComposite",
  feconvolvematrix: "feConvolveMatrix",
  fediffuselighting: "feDiffuseLighting",
  fedisplacementmap: "feDisplacementMap",
  fedistantlight: "feDistantLight",
  fedropshadow: "feDropShadow",
  feflood: "feFlood",
  fefunca: "feFuncA",
  fefuncb: "feFuncB",
  fefuncg: "feFuncG",
  fefuncr: "feFuncR",
  fegaussianblur: "feGaussianBlur",
  feimage: "feImage",
  femerge: "feMerge",
  femergenode: "feMergeNode",
  femorphology: "feMorphology",
  feoffset: "feOffset",
  fepointlight: "fePointLight",
  fespecularlighting: "feSpecularLighting",
  fespotlight: "feSpotLight",
  fetile: "feTile",
  feturbulence: "feTurbulence",
  foreignobject: "foreignObject",
  glyphref: "glyphRef",
  lineargradient: "linearGradient",
  radialgradient: "radialGradient",
  textpath: "textPath",
}

function toJsxTagName(tag: string, namespace: SourceNodeNamespace): string {
  const normalized = tag.toLowerCase()
  return namespace === "svg" ? (SVG_TAG_NAME_MAP[normalized] ?? normalized) : normalized
}

function renderSourceDomRegionsTs(regions: SourceDomRegionMetric[]): string {
  return [
    "export const sourceDomRegions = " + JSON.stringify(regions, null, 2) + " as const",
    "",
    'export const highComplexitySourceDomRegions = sourceDomRegions.filter((region) => region.complexity === "high")',
    "",
  ].join("\n")
}

function renderStylesCss(input: { hasCriticalCss: boolean; hasFullCss: boolean }): string {
  return [input.hasCriticalCss ? '@import "./styles/source-critical.css";' : "", "", ""].filter(Boolean).join("\n")
}

function renderReadme(visualIteration: SourceProjectVisualIteration): string {
  return [
    "# Web Clone Source Project",
    "",
    "This project is generated from one immutable Frontend Replica source-context artifact set. It is the editable implementation seed for downstream React work, not a separate scoring artifact.",
    "",
    "Inputs consumed:",
    "- `source-skeleton/index.html` for visible text and DOM order hints",
    "- `source-skeleton/critical.css` and `source-skeleton/full-source.css` for CSS sidecars",
    "- `source-ir/content-model.json` for tables, lists, cards, and repeated groups",
    "- `source-ir/component-tree.json` for component boundary hints",
    "- `page.ir.json` and `source-ir/layout-map.json` for captured node styles and horizontal layout-width evidence",
    "- `assets/manifest.json` for sidecar asset references",
    "- `src/data/sourceDomRegions.ts` for generated-region size, source identity, and text-preview evidence",
    "- `src/data/sourceProjectManifest.json` for the desktop visual iteration viewport and generated-source ownership rules",
    "",
    "Implementation guidance:",
    "- The default app entrypoint renders `src/components/SourceDomPage.tsx` through `src/components/SourceClonePage.tsx`; this is the high-fidelity visual baseline, not a placeholder scaffold.",
    "- `src/components/source-dom/*Region.tsx` only splits the high-fidelity baseline into bounded files; every region retains the source DOM hierarchy and attributes.",
    "- Keep `src/styles/source-critical.css`, `src/styles/source-full.css`, and `public/assets/` together with the React entrypoints; they are required for visual parity.",
    "- Source scripts are retained in DOM order as inert evidence and are never executed by the generated project. Event-handler attributes are retained as inert data-source-event-* evidence.",
    "- Source style elements are represented once by source-critical.css; full-source.css remains evidence and is not imported into the runtime cascade.",
    "- Use the generated source DOM components, `src/data/sourceDomRegions.ts`, source IR, and component metadata as evidence when implementing maintainable application components; the generator does not prescribe a workflow or silently rewrite source structures.",
    "- Refine this baseline region by region using the exact `sourceContext.referenceImage` TaskArtifact ref in `src/data/sourceProjectManifest.json`.",
    `- Desktop visual iteration viewport: ${renderSourceProjectVisualIterationMatrix(visualIteration.viewportMatrix)}`,
    `- Layout width contract: ${renderSourceProjectLayoutWidthContract(visualIteration.layoutWidthContract)}`,
    "- Source-capture `x/y/w/h`, full-page height, scrollY, and footer transition coordinates are evidence-only crop/comparison facts. Do not convert them into CSS `top`, `height`, `min-height`, margin, padding, spacer, footer-y, or document-height implementation targets.",
    "- Use only that exact TaskArtifact ref for visual comparison. Do not render source-context screenshots, replay screenshots, or add hidden semantic coverage layers.",
    "- Use source evidence review and overlay/visual comparison as diagnostics; fix the implementation when their findings describe a real user-visible or maintainability defect.",
    "",
    "Canonical source-context provenance is recorded in `src/data/sourceProjectManifest.json` as exact manifest and reference-image TaskArtifact refs.",
    "",
  ].join("\n")
}

function collectVisibleStrings(value: unknown, key = ""): string[] {
  const visibleKeys = new Set([
    "alt",
    "fields",
    "headers",
    "items",
    "label",
    "rows",
    "sampleTexts",
    "text",
    "textPreview",
    "title",
    "value",
  ])
  if (typeof value === "string") return visibleKeys.has(key) ? [value] : []
  if (Array.isArray(value)) return value.flatMap((item) => collectVisibleStrings(item, key))
  if (!value || typeof value !== "object") return []
  return Object.entries(value as Record<string, unknown>).flatMap(([childKey, child]) =>
    collectVisibleStrings(child, childKey),
  )
}

function collectSkeletonText(html: string): string[] {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  return Array.from(withoutScripts.matchAll(/>([^<>]{2,180})</g), (match) => decodeEntities(match[1] ?? ""))
}

function rankTextSignals(values: string[]): string[] {
  const unique = Array.from(new Set(values.map(canonicalText).filter((value): value is string => Boolean(value))))
  return unique
    .filter((value) => value.length >= 3 && value.length <= 120)
    .filter((value) => !/^https?:\/\//i.test(value))
    .map((value) => ({ value, score: textSignalScore(value) }))
    .sort((a, b) => b.score - a.score || a.value.length - b.value.length)
    .map((item) => item.value)
}

function textSignalScore(value: string): number {
  let score = Math.min(value.length, 40)
  if (/\d/.test(value)) score += 40
  if (/[A-Za-z]\s+[A-Za-z]/.test(value)) score += 20
  if (/[.%$€¥£]/.test(value)) score += 12
  if (value.length <= 24) score += 8
  return score
}

function canonicalText(value: string): string | undefined {
  const normalized = decodeEntities(value).replace(/\s+/g, " ").trim()
  if (!normalized) return undefined
  if (/^__COMPILED_WEBPAGE_[A-Z_]+_\d+__$/.test(normalized)) return undefined
  if (/^[{}[\],:;./\\|_-]+$/.test(normalized)) return undefined
  return normalized
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => readString(item)).filter((item): item is string => Boolean(item))
}

function readTableRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => (Array.isArray(row) ? row.map((cell) => readString(cell) ?? "") : []))
    .filter((row) => row.some((cell) => cell.length > 0))
}

function readArray(value: unknown, key: string): unknown[] {
  const row = asRecord(value)
  return Array.isArray(row[key]) ? (row[key] as unknown[]) : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? decodeEntities(value).replace(/\s+/g, " ").trim()
    : undefined
}

function toComponentName(name: string, index: number): string {
  const normalized = name
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
  if (!normalized) return `SourceComponent${index + 1}`
  return /^[A-Za-z]/.test(normalized) ? normalized : `SourceComponent${normalized}`
}

function normalizePackageName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "web-clone-source-project"
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function assertWebpageEvidenceInputs(webpageEvidenceDir: string): Promise<void> {
  const required = [
    path.join(webpageEvidenceDir, "source-skeleton", "index.html"),
    path.join(webpageEvidenceDir, "source-skeleton", "critical.css"),
    path.join(webpageEvidenceDir, "source-skeleton", "full-source.css"),
    path.join(webpageEvidenceDir, "source-ir", "content-model.json"),
    path.join(webpageEvidenceDir, "source-ir", "component-tree.json"),
    path.join(webpageEvidenceDir, "page.ir.json"),
    path.join(webpageEvidenceDir, "assets", "manifest.json"),
    path.join(webpageEvidenceDir, "web-clone-source-manifest.json"),
  ]
  const missing: string[] = []
  for (const file of required) {
    if (!(await exists(file))) missing.push(file)
  }
  if (missing.length > 0) throw new Error(`Webpage evidence source-project inputs are missing: ${missing.join(", ")}`)
}

function recordConsumedSourceInput(provenance: SourceInputProvenance, filePath: string): void {
  const relativePath = path.relative(provenance.rootDir, filePath)
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Source-project input is outside webpage evidence root: ${filePath}`)
  }
  provenance.consumedPaths.add(relativePath.split(path.sep).join(path.posix.sep))
}

function consumedSourceInputs(provenance: SourceInputProvenance): string[] {
  return [...provenance.consumedPaths].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, "utf8")
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function readText(filePath: string, provenance?: SourceInputProvenance): Promise<string> {
  const text = await fs.readFile(filePath, "utf8")
  if (provenance) recordConsumedSourceInput(provenance, filePath)
  return text
}

async function readJsonOptional(filePath: string, provenance?: SourceInputProvenance): Promise<unknown> {
  let text: string
  try {
    text = await fs.readFile(filePath, "utf8")
  } catch (error) {
    if (isMissingFileError(error)) return undefined
    throw error
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (provenance) recordConsumedSourceInput(provenance, filePath)
    return parsed
  } catch (error) {
    throw new Error(`Malformed JSON in existing webpage evidence input: ${filePath}`, { cause: error })
  }
}

async function readJsonRequired(filePath: string, provenance?: SourceInputProvenance): Promise<unknown> {
  const value = await readJsonOptional(filePath, provenance)
  if (value === undefined) throw new Error(`Required JSON input is missing: ${filePath}`)
  return value
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

async function buildSourceProjectVisualIteration(
  webpageEvidenceDir: string,
  provenance: SourceInputProvenance,
): Promise<SourceProjectVisualIteration> {
  const manifest = asRecord(
    await readJsonOptional(path.join(webpageEvidenceDir, "web-clone-source-manifest.json"), provenance),
  )
  const manifestProvenance = asRecord(manifest.provenance)
  const manifestViewport = readVisualViewport(asRecord(manifestProvenance.captureViewport))
  const primary = manifestViewport ? { ...manifestViewport, evidenceSource: "capture_viewport" as const } : undefined
  if (!primary) {
    throw new Error(
      "Web clone source project requires captured viewport metadata from web-clone-source-manifest.json provenance.captureViewport.",
    )
  }
  const viewportMatrix = buildSourceProjectVisualIterationViewports(primary)
  const layoutWidthContract = await buildSourceProjectLayoutWidthContract({
    webpageEvidenceDir,
    viewportWidth: primary.width,
    referenceImageWidth: readPositiveInteger(asRecord(manifestProvenance.reference).width),
    provenance,
  })
  return {
    evidenceMethod: "task_scoped_preview_screenshots",
    viewportMatrix,
    layoutWidthContract,
    rule: "Use the desktop-reference viewport as the primary inspected preview screenshot for changed regions. Preserve the layout width contract instead of bootstrapping the page into a guessed fixed-width shell.",
  }
}

function readVisualViewport(value: Record<string, unknown>): { width: number; height: number } | undefined {
  const width = readPositiveInteger(value.width)
  const height = readPositiveInteger(value.height)
  if (!width || !height) return undefined
  if (width < 240 || height < 180) return undefined
  return { width, height }
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined
}

interface LayoutBoundEvidence {
  nodeId?: string
  tag?: string
  role?: string
  depth?: number
  bounds: SourceBounds
}

async function buildSourceProjectLayoutWidthContract(input: {
  webpageEvidenceDir: string
  viewportWidth: number
  referenceImageWidth?: number
  provenance: SourceInputProvenance
}): Promise<SourceProjectLayoutWidthContract> {
  const [layoutMap, pageIr] = await Promise.all([
    readJsonOptional(path.join(input.webpageEvidenceDir, "source-ir", "layout-map.json"), input.provenance),
    readJsonOptional(path.join(input.webpageEvidenceDir, "page.ir.json"), input.provenance),
  ])
  const layoutBounds = [
    ...extractLayoutBoundEvidenceFromLayoutMap(layoutMap),
    ...extractLayoutBoundEvidenceFromPageIr(pageIr),
  ]
  const candidates = layoutBounds.filter((item) => isLayoutWidthCandidate(item))
  const fullWidth = candidates.filter((item) => isFullWidthLayoutBound(item.bounds, input.viewportWidth))
  const centered = candidates.filter((item) => isCenteredLayoutBound(item.bounds, input.viewportWidth))
  const referenceEvidence =
    input.referenceImageWidth === undefined
      ? []
      : Math.abs(input.referenceImageWidth - input.viewportWidth) <= 2
        ? [`reference image width matches captured viewport ${input.viewportWidth}px`]
        : [
            `reference image width ${input.referenceImageWidth}px differs from captured viewport ${input.viewportWidth}px`,
          ]
  const fullWidthEvidence = fullWidth.slice(0, 4).map((item) => formatLayoutBoundEvidence(item))
  const centeredEvidence = centered.slice(0, 4).map((item) => formatLayoutBoundEvidence(item))
  const rootFullWidth = fullWidth.some((item) => /^(?:html|body|main)$/i.test(item.tag ?? ""))
  const sectionFullWidth = fullWidth.some((item) => /^(?:header|footer|nav|section|article)$/i.test(item.tag ?? ""))
  const mode: SourceProjectLayoutWidthContract["mode"] =
    fullWidth.length >= 2 || (rootFullWidth && sectionFullWidth)
      ? "full_width"
      : centered.length >= 2 && fullWidth.length === 0
        ? "centered_container"
        : "unknown"
  const rule =
    mode === "full_width"
      ? "Treat the page canvas and major bands as viewport-width for horizontal width mode only; do not wrap the whole page in a fixed max-width shell. Preserve internal gutters, columns, and cards from region evidence. This width contract does not impose page height, footer y, scrollY, or blank vertical filler."
      : mode === "centered_container"
        ? "Treat the page as a centered content shell for horizontal width mode only; preserve the measured container width and gutters from layout evidence instead of expanding all sections to the viewport. This width contract does not impose page height, footer y, scrollY, or blank vertical filler."
        : "Width mode is not proven by layout-map/page.ir evidence; inspect reference pixels and layout bounds before choosing a page container width. Do not infer page height, footer y, scrollY, or blank vertical filler from this contract."
  return {
    mode,
    viewportWidth: input.viewportWidth,
    referenceImageWidth: input.referenceImageWidth,
    fullWidthElementCount: fullWidth.length,
    centeredElementCount: centered.length,
    evidence: [...referenceEvidence, ...(mode === "centered_container" ? centeredEvidence : fullWidthEvidence)],
    rule,
  }
}

function extractLayoutBoundEvidenceFromLayoutMap(value: unknown): LayoutBoundEvidence[] {
  const elements = Array.isArray(asRecord(value).elements) ? (asRecord(value).elements as unknown[]) : []
  return elements
    .map((item): LayoutBoundEvidence | undefined => {
      const row = asRecord(item)
      const bounds = asSourceBounds(row.bounds)
      if (!bounds) return undefined
      return {
        nodeId: typeof row.nodeId === "string" ? row.nodeId : undefined,
        tag: typeof row.tag === "string" ? row.tag : undefined,
        role: typeof row.role === "string" ? row.role : undefined,
        bounds,
      }
    })
    .filter((item): item is LayoutBoundEvidence => !!item)
}

function extractLayoutBoundEvidenceFromPageIr(value: unknown): LayoutBoundEvidence[] {
  const out: LayoutBoundEvidence[] = []
  function visit(item: unknown, depth: number): void {
    if (!item || typeof item !== "object") return
    const row = item as Record<string, unknown>
    const bounds = asSourceBounds(asRecord(row.layout).bounds)
    if (bounds) {
      out.push({
        nodeId: typeof row.id === "string" ? row.id : undefined,
        tag: typeof row.tag === "string" ? row.tag : undefined,
        role: typeof asRecord(row.layout).role === "string" ? (asRecord(row.layout).role as string) : undefined,
        depth,
        bounds,
      })
    }
    visit(row.root, depth)
    if (Array.isArray(row.children)) {
      for (const child of row.children) visit(child, depth + 1)
    }
  }
  visit(value, 0)
  return out
}

function isLayoutWidthCandidate(item: LayoutBoundEvidence): boolean {
  if (item.depth !== undefined && item.depth > 2) return false
  const tag = (item.tag ?? "").toLowerCase()
  if (/^(html|body|main|header|footer|nav|section|article|aside)$/.test(tag)) return true
  return item.role === "main" || item.role === "banner" || item.role === "contentinfo"
}

function isFullWidthLayoutBound(bounds: SourceBounds, viewportWidth: number): boolean {
  return bounds.x <= 4 && bounds.w >= Math.max(0, viewportWidth - 8)
}

function isCenteredLayoutBound(bounds: SourceBounds, viewportWidth: number): boolean {
  if (bounds.w > viewportWidth * 0.92 || bounds.w < viewportWidth * 0.45) return false
  const expectedX = (viewportWidth - bounds.w) / 2
  return bounds.x >= 8 && Math.abs(bounds.x - expectedX) <= Math.max(24, viewportWidth * 0.04)
}

function formatLayoutBoundEvidence(item: LayoutBoundEvidence): string {
  const label = [item.tag, item.nodeId ? `#${item.nodeId}` : undefined].filter(Boolean).join("")
  return `${label || "element"} x=${item.bounds.x} w=${item.bounds.w}`
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    if (isMissingFileError(error)) return false
    throw error
  }
}
