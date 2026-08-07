import fs from "node:fs/promises"
import path from "node:path"
import {
  readPassedAudit,
  readPngEvidence,
  sha256File,
  WEB_CLONE_REQUIRED_WEBPAGE_EVIDENCE_ARTIFACTS,
} from "./evidence-integrity"

export interface PrepareWebCloneContextInput {
  webpageEvidenceDir: string
  webpageEvidenceRef: string
  outputDir: string
}

export interface PrepareWebCloneContextOutput {
  webpageEvidenceDir: string
  sourceContextDir: string
  sourceReadmePath: string
  contextPath: string
  contractPath: string
  materializedFiles: string[]
  stats: {
    components: number
    tables: number
    lists: number
    cards: number
    repeatedGroups: number
    styleTokens: number
    styleProfiles: number
    interactionHints: number
    assets: number
    sourceSkeletonAuditPassed: boolean | undefined
    sourceQualityAuditPassed: boolean | undefined
  }
}

interface ContextSummary {
  components: Array<{ name: string; kind?: string; tag?: string; textPreview: string[] }>
  tables: Array<{ title?: string; headers: string[]; sampleRows: string[][] }>
  lists: Array<{ title?: string; items: string[] }>
  cards: Array<{ title?: string; text: string[] }>
  repeatedGroups: Array<{ title?: string; sampleTexts: string[] }>
  styleTokens: string[]
  styleProfiles: string[]
  interactionHints: string[]
  assets: Array<{ id: string; kind: string; path: string; semanticRole?: string }>
  textSignals: string[]
}

const REQUIRED_READS = [
  "README.md",
  "implementation-blueprint.md",
  "web-clone-context.md",
  "web-clone-implementation-contract.json",
  "source-ir/component-tree.json",
  "source-ir/content-model.json",
  "source-ir/layout-map.json",
  "source-ir/style-tokens.json",
  "source-ir/style-profile.json",
  "source-ir/interaction-hints.json",
  "source-ir/interaction-state-snapshots.json",
  "source-skeleton/critical.css",
  "source-skeleton/index.html (raw evidence only; do not mechanically convert this file into app source)",
]

export async function prepareWebCloneContext(
  input: PrepareWebCloneContextInput,
): Promise<PrepareWebCloneContextOutput> {
  const webpageEvidenceDir = path.resolve(input.webpageEvidenceDir)
  const outputDir = path.resolve(input.outputDir)
  await assertContextInputs(webpageEvidenceDir)
  if (isSameOrInside(outputDir, webpageEvidenceDir) || isSameOrInside(webpageEvidenceDir, outputDir)) {
    throw new Error(`Web clone context outputDir must not overlap webpageEvidenceDir: ${outputDir}`)
  }

  const [
    componentTree,
    contentModel,
    styleTokens,
    styleProfile,
    interactionHints,
    assetManifest,
    skeletonAudit,
    sourceQualityAudit,
    sourceSkeleton,
  ] = await Promise.all([
    readJson(path.join(webpageEvidenceDir, "source-ir", "component-tree.json")),
    readJson(path.join(webpageEvidenceDir, "source-ir", "content-model.json")),
    readJson(path.join(webpageEvidenceDir, "source-ir", "style-tokens.json")),
    readJson(path.join(webpageEvidenceDir, "source-ir", "style-profile.json")),
    readJson(path.join(webpageEvidenceDir, "source-ir", "interaction-hints.json")),
    readJson(path.join(webpageEvidenceDir, "assets", "manifest.json")),
    readJson(path.join(webpageEvidenceDir, "source-skeleton", "source-skeleton-audit.json")),
    readJson(path.join(webpageEvidenceDir, "source-ir", "source-quality-audit.json")),
    fs.readFile(path.join(webpageEvidenceDir, "source-skeleton", "index.html"), "utf8"),
  ])
  const summary = buildContextSummary({
    componentTree,
    contentModel,
    styleTokens,
    styleProfile,
    interactionHints,
    assetManifest,
    sourceSkeleton,
  })
  const stats = {
    components: summary.components.length,
    tables: summary.tables.length,
    lists: summary.lists.length,
    cards: summary.cards.length,
    repeatedGroups: summary.repeatedGroups.length,
    styleTokens: summary.styleTokens.length,
    styleProfiles: summary.styleProfiles.length,
    interactionHints: summary.interactionHints.length,
    assets: summary.assets.length,
    sourceSkeletonAuditPassed: readPassed(skeletonAudit),
    sourceQualityAuditPassed: readPassed(sourceQualityAudit),
  }

  const contextPath = path.join(outputDir, "web-clone-context.md")
  const contractPath = path.join(outputDir, "web-clone-implementation-contract.json")
  const outputStat = await fs.lstat(outputDir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (outputStat) throw new Error(`Source context output already exists: ${outputDir}`)
  await fs.mkdir(outputDir)
  await fs.writeFile(contextPath, renderContextMarkdown(input.webpageEvidenceRef, summary, stats), "utf8")
  await fs.writeFile(
    contractPath,
    `${JSON.stringify(renderContract(input.webpageEvidenceRef, summary, stats), null, 2)}\n`,
    "utf8",
  )
  const materializedFiles = await materializeSourceContextTree({
    webpageEvidenceDir,
    webpageEvidenceRef: input.webpageEvidenceRef,
    outputDir,
    contextPath,
    contractPath,
    summary,
    stats,
  })
  const sourceReadmePath = path.join(outputDir, "README.md")

  return {
    webpageEvidenceDir,
    sourceContextDir: outputDir,
    sourceReadmePath,
    contextPath,
    contractPath,
    materializedFiles,
    stats,
  }
}

function buildContextSummary(input: {
  componentTree: unknown
  contentModel: unknown
  styleTokens: unknown
  styleProfile: unknown
  interactionHints: unknown
  assetManifest: unknown
  sourceSkeleton: string
}): ContextSummary {
  return {
    components: readComponents(input.componentTree),
    tables: readTables(input.contentModel),
    lists: readLists(input.contentModel),
    cards: readCards(input.contentModel),
    repeatedGroups: readRepeatedGroups(input.contentModel),
    styleTokens: collectNamedStrings(input.styleTokens, ["name", "token", "property", "value"]).slice(0, 80),
    styleProfiles: readStyleProfiles(input.styleProfile),
    interactionHints: collectNamedStrings(input.interactionHints, ["type", "role", "label", "text", "href"]).slice(
      0,
      80,
    ),
    assets: readAssets(input.assetManifest),
    textSignals: rankTextSignals([
      ...collectNamedStrings(input.contentModel, [
        "headers",
        "rows",
        "items",
        "sampleTexts",
        "text",
        "value",
        "label",
        "title",
      ]),
      ...collectSkeletonText(input.sourceSkeleton),
    ]).slice(0, 80),
  }
}

function renderContextMarkdown(
  webpageEvidenceDir: string,
  summary: ContextSummary,
  stats: PrepareWebCloneContextOutput["stats"],
): string {
  return [
    "# Web Clone Context",
    "",
    `Webpage evidence: ${webpageEvidenceDir}`,
    "",
    "## Required Reads",
    ...REQUIRED_READS.map((file) => `- ${file}`),
    "",
    "## Audit Status",
    `- source-skeleton audit passed: ${stats.sourceSkeletonAuditPassed ?? "unknown"}`,
    `- source-ir quality audit passed: ${stats.sourceQualityAuditPassed ?? "unknown"}`,
    "",
    "## Implementation Rules",
    "- Treat this immutable source-context artifact set as the mandatory implementation source before writing app code.",
    "- Start from `implementation-blueprint.md`, `source-ir/*`, and data/component contracts; use `source-skeleton/index.html` only to resolve ambiguous DOM order or missing text.",
    "- Treat `source-ir/style-profile.json` as the region-scoped style source before CSS/layout edits; do not invent a parallel style summary from prose.",
    "- Do not run an unstructured HTML-to-JSX/Vue converter over `source-skeleton/index.html`; preserve the generated source skeleton modules and CSS sidecars as the editable baseline instead.",
    "- Write or repair normal target app source in the project tree; do not create a disconnected generated app as the default deliverable.",
    "- Implement normal framework components, data arrays, adapters, states, and interactions.",
    "- Repeated rows/cards/items must be data plus render loops, not duplicated JSX literals.",
    "- For full-stack/database work, derive schema, seed/reset data, and read APIs from `source-ir/content-model.json` and visible skeleton text.",
    "- Do not render the named reference image, screenshots, base64/data URI payloads, or hidden semantic layers as the page. The source skeleton and CSS sidecars are the visual baseline implementation; refine regions only when parity can be maintained.",
    "- Use source evidence review and runtime visual evaluation through the exact Task Artifact resource locator for `source-context/reference.png` selected from the verified snapshot manifest; report measured results and concrete findings instead of inventing a score.",
    "",
    "## Components",
    ...summary.components
      .slice(0, 24)
      .map(
        (component) =>
          `- ${component.name}${component.kind ? ` (${component.kind})` : ""}${component.textPreview.length ? `: ${component.textPreview.join(" | ")}` : ""}`,
      ),
    "",
    "## Structured Content",
    `- tables: ${stats.tables}`,
    `- lists: ${stats.lists}`,
    `- cards: ${stats.cards}`,
    `- repeated groups: ${stats.repeatedGroups}`,
    ...summary.tables
      .slice(0, 8)
      .map((table) =>
        `- table ${table.title ?? ""}: ${table.headers.join(" | ")}${table.sampleRows[0] ? ` / sample ${table.sampleRows[0].join(" | ")}` : ""}`.trim(),
      ),
    "",
    "## Text Signals",
    ...summary.textSignals.slice(0, 40).map((text) => `- ${text}`),
    "",
    "## Interaction Hints",
    ...summary.interactionHints.slice(0, 40).map((hint) => `- ${hint}`),
    "",
    "## Region Style Profiles",
    ...summary.styleProfiles.slice(0, 40).map((profile) => `- ${profile}`),
    "",
    "## Asset References",
    ...summary.assets
      .slice(0, 40)
      .map(
        (asset) => `- ${asset.id} ${asset.kind} ${asset.path}${asset.semanticRole ? ` (${asset.semanticRole})` : ""}`,
      ),
    "",
  ].join("\n")
}

function renderContract(
  webpageEvidenceDir: string,
  summary: ContextSummary,
  stats: PrepareWebCloneContextOutput["stats"],
): unknown {
  return {
    version: 1,
    purpose: "web-clone-implementation-context",
    webpageEvidenceDir,
    requiredReads: REQUIRED_READS,
    rules: {
      sourceContextIdentity: "task_artifact_snapshot",
      primaryImplementationInput: "implementation-blueprint.md",
      rawSkeletonPolicy:
        "source-skeleton/index.html is raw evidence for DOM order and missing text; it is not an app-source template.",
      visualTruth: "task-artifact-resource:source-context/reference.png",
      visualEvaluation: {
        role: "diagnostic_measurement",
        report: ["score", "ssim", "pixelDiffPercent", "structural differences"],
      },
      forbidden: [
        "reference screenshot replay",
        "large HTML strings outside generated baseline files",
        "dangerouslySetInnerHTML outside generated baseline files",
        "innerHTML/insertAdjacentHTML/DOMParser page construction outside generated baseline files",
        "base64/data URI payloads in project-owned source",
        "hidden semantic coverage layers",
        "mechanical conversion of source-skeleton/index.html into one giant framework component",
        "runtime loading of third-party stylesheet bundles instead of project-owned CSS",
      ],
    },
    stats,
    components: summary.components,
    content: {
      tables: summary.tables,
      lists: summary.lists,
      cards: summary.cards,
      repeatedGroups: summary.repeatedGroups,
      textSignals: summary.textSignals,
    },
    styleTokens: summary.styleTokens,
    styleProfiles: summary.styleProfiles,
    interactionHints: summary.interactionHints,
    assets: summary.assets,
  }
}

async function materializeSourceContextTree(input: {
  webpageEvidenceDir: string
  webpageEvidenceRef: string
  outputDir: string
  contextPath: string
  contractPath: string
  summary: ContextSummary
  stats: PrepareWebCloneContextOutput["stats"]
}): Promise<string[]> {
  const written = new Set<string>([input.contextPath, input.contractPath])
  await fs.mkdir(input.outputDir, { recursive: true })
  const readmePath = path.join(input.outputDir, "README.md")
  await fs.writeFile(readmePath, renderSourcePackageReadme(input.webpageEvidenceRef, input.stats), "utf8")
  written.add(readmePath)

  const blueprintPath = path.join(input.outputDir, "implementation-blueprint.md")
  await fs.writeFile(blueprintPath, renderImplementationBlueprint(input.summary, input.stats), "utf8")
  written.add(blueprintPath)

  await copyFileIfExists(
    path.join(input.webpageEvidenceDir, "reference.png"),
    path.join(input.outputDir, "reference.png"),
    written,
  )
  await copyDirIfExists(
    path.join(input.webpageEvidenceDir, "source-skeleton"),
    path.join(input.outputDir, "source-skeleton"),
    written,
  )
  await copyDirIfExists(
    path.join(input.webpageEvidenceDir, "source-ir"),
    path.join(input.outputDir, "source-ir"),
    written,
  )
  await copyDirIfExists(
    path.join(input.webpageEvidenceDir, "interaction-states"),
    path.join(input.outputDir, "interaction-states"),
    written,
  )
  await copyFileIfExists(
    path.join(input.webpageEvidenceDir, "assets", "manifest.json"),
    path.join(input.outputDir, "assets", "manifest.json"),
    written,
  )
  await copyDirIfExists(
    path.join(input.webpageEvidenceDir, "assets", "svg"),
    path.join(input.outputDir, "assets", "svg"),
    written,
  )
  await copyDirIfExists(
    path.join(input.webpageEvidenceDir, "assets", "images"),
    path.join(input.outputDir, "assets", "images"),
    written,
  )
  for (const diagnostic of [
    "page.ir.json",
    "segments.json",
    "codegen-context.json",
    "visual-surface-candidates.json",
  ]) {
    await copyFileIfExists(
      path.join(input.webpageEvidenceDir, diagnostic),
      path.join(input.outputDir, diagnostic),
      written,
    )
  }

  const manifestPath = path.join(input.outputDir, "web-clone-source-manifest.json")
  const referenceEvidence = await readPngEvidence(path.join(input.outputDir, "reference.png"))
  const captureViewport = await readCaptureViewport(input.webpageEvidenceDir)
  const manifestEntries = await buildSourceManifestEntries(input.outputDir, input.webpageEvidenceDir, written)
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        purpose: "web-clone-visible-source-package",
        webpageEvidenceDir: input.webpageEvidenceRef,
        provenance: {
          source: "webpage-evidence",
          webpageEvidenceDir: input.webpageEvidenceRef,
          requiredWebpageEvidenceArtifacts: WEB_CLONE_REQUIRED_WEBPAGE_EVIDENCE_ARTIFACTS,
          captureViewport,
          reference: referenceEvidence.valid
            ? {
                path: "reference.png",
                sha256: referenceEvidence.sha256,
                width: referenceEvidence.width,
                height: referenceEvidence.height,
                bytes: referenceEvidence.bytes,
              }
            : undefined,
        },
        files: manifestEntries,
        entrypoints: [
          "README.md",
          "implementation-blueprint.md",
          "web-clone-context.md",
          "web-clone-implementation-contract.json",
          "source-ir/component-tree.json",
          "source-ir/content-model.json",
          "source-ir/layout-map.json",
          "source-ir/style-tokens.json",
          "source-ir/style-profile.json",
          "source-ir/interaction-hints.json",
          "source-ir/interaction-state-snapshots.json",
          "interaction-states/initial.png",
          "interaction-states/scroll-25.png",
          "interaction-states/scroll-50.png",
          "interaction-states/scroll-75.png",
          "visual-surface-candidates.json",
          "source-skeleton/critical.css",
          "source-skeleton/index.html",
          "assets/manifest.json",
          "reference.png",
        ],
        rules: [
          "Projected implementation consumers declared by the active expert-squad package must read this immutable source-context artifact set before implementation.",
          "implementation-blueprint.md and source-ir/* are the primary app-source inputs.",
          "source-ir/style-profile.json is the region-scoped style source for CSS/layout generation.",
          "source-skeleton/index.html is raw evidence only; do not mechanically convert it into one giant framework component.",
          "Implementation code belongs in the target app source tree; this package is the reusable source evidence, not a generated app.",
          "source-ir/interaction-state-snapshots.json is runtime evidence, not prose requirements or implementation code.",
          "Use sidecar assets by file reference instead of inlining dense SVG/base64 payloads.",
          "Do not runtime-load third-party CSS bundles; copy or author project-owned CSS from the extracted critical styles and tokens.",
          "Runtime visual comparison uses only the exact Task Artifact resource locator for source-context/reference.png selected from the verified snapshot manifest.",
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  )
  written.add(manifestPath)
  return Array.from(written).sort((a, b) => a.localeCompare(b))
}

function renderSourcePackageReadme(webpageEvidenceDir: string, stats: PrepareWebCloneContextOutput["stats"]): string {
  return [
    "# Web Clone Source",
    "",
    "This tree is one verified materialization of the immutable source-context artifact set. Projected implementation consumers declared by the active expert-squad package must start from that exact set before writing or changing app code.",
    "",
    "Read in this order:",
    "1. `implementation-blueprint.md`",
    "2. `web-clone-context.md`",
    "3. `web-clone-implementation-contract.json`",
    "4. `source-ir/component-tree.json`",
    "5. `source-ir/content-model.json`",
    "6. `source-ir/layout-map.json`, `source-ir/style-tokens.json`, and `source-ir/interaction-hints.json`",
    "7. `source-ir/style-profile.json` for region-scoped computed style, layout, selector, and asset facts",
    "8. `source-ir/interaction-state-snapshots.json` and `interaction-states/*.png` for scroll/click/runtime state evidence",
    "9. `visual-surface-candidates.json` when present",
    "10. `source-skeleton/critical.css`",
    "11. `source-skeleton/index.html` only as raw evidence for ambiguous DOM order or missing text",
    "",
    "Use `assets/manifest.json`, `assets/svg/`, and `assets/images/` as reusable sidecars for dense geometry and extracted resources. Reference those files from normal React/Vue/etc. source instead of pasting the payloads inline.",
    "",
    "Do not mechanically convert `source-skeleton/index.html` into one giant React/Vue/Svelte component. Preserve the structured source skeleton/CSS sidecars and refine modules in place.",
    "",
    "Do not runtime-load source-site or other third-party CSS bundles. The target project must own the CSS it needs, derived from `source-ir/style-profile.json`, `source-skeleton/critical.css`, `source-ir/style-tokens.json`, and explicit component styling.",
    "",
    "Do not treat this package as the deliverable app. The deliverable is the project-owned app source seeded from this package's structure, content, styles, and assets.",
    "",
    "`source-ir/interaction-state-snapshots.json` is factual runtime evidence for frontend-research investigation packets and implementation verification; it must not be treated as generated PRD prose.",
    "",
    "Verification evidence should include source-evidence review plus runtime visual comparison through the exact Task Artifact resource locator for `source-context/reference.png` selected from the verified snapshot manifest when that check is available.",
    "",
    `Webpage evidence source: ${webpageEvidenceDir}`,
    "",
    "Source context stats:",
    `- components: ${stats.components}`,
    `- tables: ${stats.tables}`,
    `- lists: ${stats.lists}`,
    `- cards: ${stats.cards}`,
    `- repeated groups: ${stats.repeatedGroups}`,
    `- style profiles: ${stats.styleProfiles}`,
    `- asset refs: ${stats.assets}`,
    "",
  ].join("\n")
}

function renderImplementationBlueprint(summary: ContextSummary, stats: PrepareWebCloneContextOutput["stats"]): string {
  return [
    "# Implementation Blueprint",
    "",
    "This is the first file to read when building the webpage replica. It turns the extracted evidence into an app-source work plan.",
    "",
    "## Non-Negotiable Build Shape",
    "- Build semantic components and project-owned CSS; do not generate one huge component from `source-skeleton/index.html`.",
    "- Repeated tables, lists, cards, country chips, news rows, calendar events, footer columns, and FAQ rows must be data arrays rendered with framework loops.",
    "- Complex visual surfaces such as maps, charts, heatmaps, and idea thumbnails must be implemented as named components that either use extracted sidecar assets or authored SVG/CSS/Canvas primitives. They must not disappear as empty `<canvas>` tags.",
    "- Use `source-skeleton/critical.css` as style evidence, but consolidate it into maintainable app styles instead of depending on raw node-id rules alone.",
    "- Use `source-ir/style-profile.json` before editing each region's CSS/layout; it binds computed styles, bounds, selector refs, assets, and source-node ids to component regions.",
    "- Keep `source-skeleton/index.html` available for audit and DOM-order lookup only.",
    "",
    "## Expected Component Slices",
    ...summary.components
      .slice(0, 24)
      .map(
        (component) =>
          `- ${component.name}${component.kind ? ` (${component.kind})` : ""}${component.textPreview.length ? `: ${component.textPreview.join(" | ")}` : ""}`,
      ),
    "",
    "## Data Models To Create",
    `- Tables: ${stats.tables}`,
    `- Lists: ${stats.lists}`,
    `- Cards: ${stats.cards}`,
    `- Repeated groups: ${stats.repeatedGroups}`,
    ...summary.tables
      .slice(0, 8)
      .map((table) =>
        `- Table ${table.title ?? ""}: headers ${table.headers.join(" | ")}${table.sampleRows[0] ? `; sample ${table.sampleRows[0].join(" | ")}` : ""}`.trim(),
      ),
    ...summary.lists
      .slice(0, 12)
      .map((list) => `- List ${list.title ?? ""}: ${list.items.slice(0, 8).join(" | ")}`.trim()),
    "",
    "## Required Text Coverage Samples",
    ...summary.textSignals.slice(0, 40).map((text) => `- ${text}`),
    "",
    "## Visual/Asset Evidence",
    "- Check `visual-surface-candidates.json` for high-impact visual surfaces and bounds when present.",
    "- Check `source-ir/style-profile.json` for region-level computed typography, spacing, colors, borders, radii, CSS selector refs, and source-node ids before authoring CSS.",
    "- Check `assets/manifest.json`, `assets/svg/`, and `assets/images/` before authoring dense geometry by hand.",
    '- If the raw skeleton contains `<canvas src="images/canvas/...">`, implement it as an actual visible chart/image component; browsers do not render a `src` attribute on `<canvas>`.',
    "",
    "## Verification Checks",
    "- Review generated source against this immutable source-context artifact set and record concrete source-evidence findings.",
    "- Run runtime overlay/visual diff through the exact Task Artifact resource locator for `source-context/reference.png` selected from the verified snapshot manifest and inspect the rendered output before claiming fidelity.",
    "",
  ].join("\n")
}

async function copyFileIfExists(source: string, target: string, written: Set<string>): Promise<void> {
  if (!(await exists(source))) return
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(source, target)
  written.add(target)
}

async function copyDirIfExists(source: string, target: string, written: Set<string>): Promise<void> {
  if (!(await exists(source))) return
  const targetStat = await fs.lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (targetStat) await fs.rm(target, { recursive: true })
  await fs.cp(source, target, { recursive: true })
  for (const file of await listFiles(target)) written.add(file)
}

async function buildSourceManifestEntries(
  outputDir: string,
  webpageEvidenceDir: string,
  written: Set<string>,
): Promise<Array<{ path: string; sha256?: string; bytes?: number; source?: string }>> {
  const entries: Array<{ path: string; sha256?: string; bytes?: number; source?: string }> = []
  for (const file of Array.from(written).sort((a, b) => a.localeCompare(b))) {
    const relative = normalizePath(path.relative(outputDir, file))
    if (!relative || relative.startsWith("..")) continue
    const stat = await fs.stat(file)
    entries.push({
      path: relative,
      sha256: await sha256File(file),
      bytes: stat?.isFile() ? stat.size : undefined,
      source: (await exists(path.join(webpageEvidenceDir, relative)))
        ? normalizePath(path.join("webpage-evidence", relative))
        : "generated",
    })
  }
  return entries
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        files.push(full)
      } else throw new Error(`Source context contains an unsupported filesystem entry: ${full}`)
    }
  }
  await walk(root)
  return files
}

function readComponents(componentTree: unknown): ContextSummary["components"] {
  return readArray(componentTree, "components")
    .map((item, index) => {
      const row = asRecord(item)
      return {
        name: readString(row.name) ?? `Component${index + 1}`,
        kind: readString(row.kind),
        tag: readString(row.tag),
        textPreview: readStringArray(row.textPreview).slice(0, 8),
      }
    })
    .slice(0, 80)
}

function readTables(contentModel: unknown): ContextSummary["tables"] {
  return readArray(contentModel, "tables")
    .map((item, index) => {
      const row = asRecord(item)
      return {
        title: readString(row.title) ?? `Table ${index + 1}`,
        headers: readStringArray(row.headers).slice(0, 32),
        sampleRows: readTableRows(row.rows).slice(0, 4),
      }
    })
    .filter((table) => table.headers.length > 0 || table.sampleRows.length > 0)
    .slice(0, 24)
}

function readLists(contentModel: unknown): ContextSummary["lists"] {
  return readArray(contentModel, "lists")
    .map((item, index) => {
      const row = asRecord(item)
      return {
        title: readString(row.title) ?? `List ${index + 1}`,
        items: readStringArray(row.items).slice(0, 12),
      }
    })
    .filter((list) => list.items.length > 0)
    .slice(0, 24)
}

function readCards(contentModel: unknown): ContextSummary["cards"] {
  return readArray(contentModel, "cards")
    .map((item, index) => {
      const row = asRecord(item)
      return {
        title: readString(row.title) ?? `Card ${index + 1}`,
        text: collectNamedStrings(row, ["title", "text", "label", "value"]).slice(0, 12),
      }
    })
    .filter((card) => card.text.length > 0)
    .slice(0, 48)
}

function readRepeatedGroups(contentModel: unknown): ContextSummary["repeatedGroups"] {
  return readArray(contentModel, "repeatedGroups")
    .map((item, index) => {
      const row = asRecord(item)
      return {
        title: readString(row.title) ?? `Repeated group ${index + 1}`,
        sampleTexts: readStringArray(row.sampleTexts).slice(0, 10),
      }
    })
    .filter((group) => group.sampleTexts.length > 0)
    .slice(0, 48)
}

function readStyleProfiles(styleProfile: unknown): ContextSummary["styleProfiles"] {
  return readArray(styleProfile, "regions")
    .map((item, index) => {
      const row = asRecord(item)
      const name = readString(row.name) ?? readString(row.id) ?? `Style profile ${index + 1}`
      const kind = readString(row.kind)
      const bounds = formatBounds(asRecord(row.bounds))
      const preview = readStringArray(row.textPreview).slice(0, 3).join(" | ")
      const rootNodeId = readString(row.rootNodeId)
      const selector = readString(row.selector)
      const styleSummary = asRecord(row.styleSummary)
      const typography = formatTokenPreview(styleSummary.typography)
      const colors = formatTokenPreview(styleSummary.colors)
      const spacing = formatTokenPreview(styleSummary.spacing)
      return [
        `${name}${kind ? ` (${kind})` : ""}`,
        rootNodeId ? `node ${rootNodeId}` : undefined,
        bounds,
        selector ? `selector ${selector}` : undefined,
        typography ? `type ${typography}` : undefined,
        colors ? `colors ${colors}` : undefined,
        spacing ? `spacing ${spacing}` : undefined,
        preview ? `text ${preview}` : undefined,
      ]
        .filter(Boolean)
        .join("; ")
    })
    .filter(Boolean)
    .slice(0, 80)
}

function formatBounds(bounds: Record<string, unknown>): string | undefined {
  const x = readNumber(bounds.x)
  const y = readNumber(bounds.y)
  const w = readNumber(bounds.w)
  const h = readNumber(bounds.h)
  if ([x, y, w, h].some((value) => value === undefined)) return undefined
  return `bounds ${x},${y},${w}x${h}`
}

function formatTokenPreview(value: unknown): string | undefined {
  const items = Array.isArray(value) ? value : []
  const preview = items
    .map((item) => readString(asRecord(item).value))
    .filter((item): item is string => Boolean(item))
    .slice(0, 3)
    .join(" | ")
  return preview || undefined
}

function readAssets(assetManifest: unknown): ContextSummary["assets"] {
  const root = asRecord(assetManifest)
  const assets = Array.isArray(root.assets) ? root.assets : []
  return assets
    .map((item) => {
      const row = asRecord(item)
      const id = readString(row.id)
      const kind = readString(row.kind)
      const assetPath = readString(row.path)
      if (!id || !kind || !assetPath) return undefined
      const semanticRole = readString(row.semanticRole)
      return semanticRole ? { id, kind, path: assetPath, semanticRole } : { id, kind, path: assetPath }
    })
    .filter((asset): asset is { id: string; kind: string; path: string; semanticRole?: string } => Boolean(asset))
    .slice(0, 240)
}

function collectNamedStrings(value: unknown, keys: string[], key = ""): string[] {
  if (typeof value === "string") return keys.includes(key) ? [value] : []
  if (Array.isArray(value)) return value.flatMap((item) => collectNamedStrings(item, keys, key))
  if (!value || typeof value !== "object") return []
  return Object.entries(value as Record<string, unknown>).flatMap(([childKey, child]) =>
    collectNamedStrings(child, keys, childKey),
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
  if (/data:/i.test(normalized)) return undefined
  return normalized
}

function readPassed(value: unknown): boolean | undefined {
  const row = asRecord(value)
  return typeof row.passed === "boolean" ? row.passed : undefined
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

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
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

function isSameOrInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
}

async function assertContextInputs(webpageEvidenceDir: string): Promise<void> {
  const missing: string[] = []
  for (const relative of WEB_CLONE_REQUIRED_WEBPAGE_EVIDENCE_ARTIFACTS) {
    const file = path.join(webpageEvidenceDir, relative)
    if (relative.endsWith(".png")) {
      const evidence = await readPngEvidence(file)
      if (!evidence.valid) missing.push(`${evidence.path} (${evidence.error ?? "invalid PNG"})`)
    } else if (!(await exists(file))) missing.push(file)
  }
  if (missing.length > 0) throw new Error(`Web clone context inputs are missing: ${missing.join(", ")}`)
  if (
    (await readPassedAudit(path.join(webpageEvidenceDir, "source-skeleton", "source-skeleton-audit.json"))) !== true
  ) {
    missing.push(
      path.join(webpageEvidenceDir, "source-skeleton", "source-skeleton-audit.json") + " (passed=true required)",
    )
  }
  if ((await readPassedAudit(path.join(webpageEvidenceDir, "source-ir", "source-quality-audit.json"))) !== true) {
    missing.push(path.join(webpageEvidenceDir, "source-ir", "source-quality-audit.json") + " (passed=true required)")
  }
  if (missing.length > 0) throw new Error(`Web clone context audits did not pass: ${missing.join(", ")}`)
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"))
}

async function readCaptureViewport(webpageEvidenceDir: string): Promise<{ width: number; height: number } | undefined> {
  const extractedPage = asRecord(await readJson(path.join(webpageEvidenceDir, "extracted-page.json")))
  const viewport = asRecord(extractedPage.viewport)
  const width = readPositiveInteger(viewport.width)
  const height = readPositiveInteger(viewport.height)
  return width && height ? { width, height } : undefined
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

function normalizePath(value: string): string {
  return value.replaceAll(path.sep, "/")
}
