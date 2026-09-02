import z from "zod"

export const INTERACTIVE_ARTIFACT_SCHEMA_VERSION = "1" as const
export const INTERACTIVE_ARTIFACT_MIN_HEIGHT = 180
export const INTERACTIVE_ARTIFACT_MAX_HEIGHT = 720

const JsonScalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
const JsonObject = z.record(z.string(), z.unknown())
const Sha256Digest = z.string().regex(/^[a-f0-9]{64}$/)
const StableID = z.string().trim().min(1).max(80)
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const IsoDateTime = z.iso.datetime({ offset: true })

// MIME means Multipurpose Internet Mail Extensions; it declares the stored attachment media type.
export const InteractiveArtifactAttachment = z
  .object({
    sha: Sha256Digest,
    url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
    mime: z.string().trim().min(1).max(160),
    size: z.number().int().nonnegative(),
    filename: z.string().trim().min(1).max(255).optional(),
  })
  .strict()

const InteractiveArtifactCodeLanguage = z.enum([
  "plaintext",
  "css",
  "html",
  "javascript",
  "json",
  "markdown",
  "python",
  "typescript",
])

export const InteractiveArtifactPresentationOptions = z
  .object({
    height: z.number().int().min(INTERACTIVE_ARTIFACT_MIN_HEIGHT).max(INTERACTIVE_ARTIFACT_MAX_HEIGHT).optional(),
  })
  .strict()

const InteractiveArtifactBase = z.object({
  schemaVersion: z.literal(INTERACTIVE_ARTIFACT_SCHEMA_VERSION),
  title: z.string().trim().min(1).max(160),
  presentation: InteractiveArtifactPresentationOptions.optional(),
})

export const InteractiveArtifactDocument = InteractiveArtifactBase.extend({
  renderer: z.literal("document@1"),
  markdown: z.string().min(1),
}).strict()

export const InteractiveArtifactTable = InteractiveArtifactBase.extend({
  renderer: z.literal("table@1"),
  columns: z
    .array(
      z
        .object({
          id: z.string().trim().min(1).max(80),
          label: z.string().trim().min(1).max(120),
          dataType: z.enum(["string", "number", "boolean", "date"]),
        })
        .strict(),
    )
    .min(1)
    .max(80)
    .refine((columns) => new Set(columns.map((column) => column.id)).size === columns.length, {
      message: "table column IDs must be unique",
    }),
  rows: z.array(z.record(z.string(), JsonScalar)).max(10_000),
}).strict()

function hasEmbeddedExternalData(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  if (Array.isArray(value)) return value.some(hasEmbeddedExternalData)
  const record = value as Record<string, unknown>
  const data = record.data
  if (data && typeof data === "object" && !Array.isArray(data) && "url" in data) return true
  return Object.values(record).some(hasEmbeddedExternalData)
}

export const InteractiveArtifactChart = InteractiveArtifactBase.extend({
  renderer: z.literal("chart@1"),
  spec: JsonObject.refine((spec) => !hasEmbeddedExternalData(spec), {
    message: "chart spec must not contain external data URLs",
  }),
  data: z.array(z.record(z.string(), JsonScalar)).min(1).max(20_000),
}).strict()

export const InteractiveArtifactDiagram = InteractiveArtifactBase.extend({
  renderer: z.literal("diagram@1"),
  source: z.string().trim().min(1).max(200_000),
}).strict()

export const InteractiveArtifactCode = InteractiveArtifactBase.extend({
  renderer: z.literal("code@1"),
  language: InteractiveArtifactCodeLanguage,
  source: z.string().max(1_000_000),
  filename: z.string().trim().min(1).max(255).optional(),
  editable: z.boolean().default(false),
}).strict()

export const InteractiveArtifactDiff = InteractiveArtifactBase.extend({
  renderer: z.literal("diff@1"),
  language: InteractiveArtifactCodeLanguage,
  original: z.string().max(1_000_000),
  modified: z.string().max(1_000_000),
  originalLabel: z.string().trim().min(1).max(120).optional(),
  modifiedLabel: z.string().trim().min(1).max(120).optional(),
}).strict()

export const InteractiveArtifactCandlestickPoint = z
  .object({
    // UTC means Coordinated Universal Time; values use Unix seconds for Lightweight Charts.
    time: z.number().int().positive(),
    // OHLC means Open, High, Low and Close prices for one trading interval.
    open: z.number().finite(),
    high: z.number().finite(),
    low: z.number().finite(),
    close: z.number().finite(),
    volume: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .refine((point) => point.high >= Math.max(point.open, point.close, point.low), {
    message: "candlestick high must be greater than or equal to open, close and low",
    path: ["high"],
  })
  .refine((point) => point.low <= Math.min(point.open, point.close, point.high), {
    message: "candlestick low must be less than or equal to open, close and high",
    path: ["low"],
  })

export const InteractiveArtifactCandlestick = InteractiveArtifactBase.extend({
  renderer: z.literal("candlestick@1"),
  series: InteractiveArtifactCandlestickPoint.array().min(1).max(20_000),
}).strict()

export const InteractiveArtifactMedia = InteractiveArtifactBase.extend({
  renderer: z.literal("media@1"),
  kind: z.enum(["image", "audio", "video"]),
  source: InteractiveArtifactAttachment,
  alt: z.string().trim().min(1).max(500),
  caption: z.string().trim().min(1).max(1_000).optional(),
})
  .strict()
  .refine((payload) => payload.source.mime.toLowerCase().startsWith(`${payload.kind}/`), {
    message: "media kind must match attachment MIME",
    path: ["source", "mime"],
  })

export const InteractiveArtifactFilePreview = InteractiveArtifactBase.extend({
  renderer: z.literal("file-preview@1"),
  kind: z.enum(["pdf", "text"]),
  source: InteractiveArtifactAttachment,
})
  .strict()
  .refine(
    (payload) =>
      payload.kind === "pdf"
        ? payload.source.mime.toLowerCase() === "application/pdf"
        : payload.source.mime.toLowerCase().startsWith("text/") ||
          payload.source.mime.toLowerCase() === "application/json",
    {
      message: "file preview kind must match attachment MIME",
      path: ["source", "mime"],
    },
  )

// GeoJSON means Geographic JavaScript Object Notation; each geometry keeps its standard coordinate depth.
const GeoJsonPosition = z.array(z.number().finite()).min(2).max(4)
const GeoJsonLine = GeoJsonPosition.array().min(2)
const GeoJsonLinearRing = GeoJsonPosition.array().min(4)
const GeoJsonPolygon = GeoJsonLinearRing.array().min(1)
const GeoJsonGeometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: GeoJsonPosition }).strict(),
  z.object({ type: z.literal("MultiPoint"), coordinates: GeoJsonPosition.array() }).strict(),
  z.object({ type: z.literal("LineString"), coordinates: GeoJsonLine }).strict(),
  z.object({ type: z.literal("MultiLineString"), coordinates: GeoJsonLine.array() }).strict(),
  z.object({ type: z.literal("Polygon"), coordinates: GeoJsonPolygon }).strict(),
  z.object({ type: z.literal("MultiPolygon"), coordinates: GeoJsonPolygon.array() }).strict(),
])

export const InteractiveArtifactMap = InteractiveArtifactBase.extend({
  renderer: z.literal("map@1"),
  geojson: z
    .object({
      type: z.literal("FeatureCollection"),
      features: z
        .array(
          z
            .object({
              type: z.literal("Feature"),
              geometry: GeoJsonGeometry,
              properties: JsonObject,
            })
            .strict(),
        )
        .max(20_000),
    })
    .strict(),
}).strict()

const NotebookOutput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), name: z.enum(["stdout", "stderr"]).optional(), text: z.string() }).strict(),
  z.object({ kind: z.literal("markdown"), markdown: z.string() }).strict(),
  z
    .object({
      kind: z.literal("media"),
      source: InteractiveArtifactAttachment,
      alt: z.string().trim().min(1).max(500),
    })
    .strict(),
])

export const InteractiveArtifactNotebook = InteractiveArtifactBase.extend({
  renderer: z.literal("notebook@1"),
  cells: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("markdown"), markdown: z.string().min(1) }).strict(),
        z
          .object({
            kind: z.literal("code"),
            language: InteractiveArtifactCodeLanguage,
            source: z.string(),
            executionCount: z.number().int().nonnegative().optional(),
            outputs: NotebookOutput.array().max(100).default([]),
          })
          .strict(),
      ]),
    )
    .min(1)
    .max(500),
}).strict()

const PresentationSlide = z
  .object({
    id: StableID,
    title: z.string().trim().min(1).max(160),
    markdown: z.string().max(100_000),
    notes: z.string().max(50_000).optional(),
    image: InteractiveArtifactAttachment.optional(),
    imageAlt: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((slide) => Boolean(slide.image) === Boolean(slide.imageAlt), {
    message: "presentation slide image and imageAlt must be supplied together",
    path: ["image"],
  })
  .refine((slide) => !slide.image || slide.image.mime.toLowerCase().startsWith("image/"), {
    message: "presentation slide attachment must be an image",
    path: ["image", "mime"],
  })

export const InteractiveArtifactPresentation = InteractiveArtifactBase.extend({
  renderer: z.literal("presentation@1"),
  aspectRatio: z.enum(["16:9", "4:3", "1:1"]).default("16:9"),
  slides: PresentationSlide.array()
    .min(1)
    .max(200)
    .refine((slides) => new Set(slides.map((slide) => slide.id)).size === slides.length, {
      message: "presentation slide IDs must be unique",
    }),
}).strict()

const SpreadsheetCellStyle = z
  .object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    color: HexColor.optional(),
    background: HexColor.optional(),
    align: z.enum(["left", "center", "right"]).optional(),
  })
  .strict()

const SpreadsheetCell = z
  .object({
    address: z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,5}$/),
    value: JsonScalar.optional(),
    formula: z
      .string()
      .regex(/^=[^\r\n]+$/)
      .max(2_000)
      .optional(),
    computed: JsonScalar.optional(),
    numberFormat: z.string().trim().min(1).max(80).optional(),
    style: SpreadsheetCellStyle.optional(),
  })
  .strict()
  .refine((cell) => (cell.value === undefined) !== (cell.formula === undefined), {
    message: "spreadsheet cell must contain exactly one value or formula",
    path: ["value"],
  })
  .refine((cell) => cell.formula !== undefined || cell.computed === undefined, {
    message: "computed spreadsheet value requires a formula",
    path: ["computed"],
  })

function spreadsheetColumnIndex(address: string): number {
  const letters = address.match(/^[A-Z]+/)?.[0] ?? ""
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0)
}

function spreadsheetRowIndex(address: string): number {
  return Number(address.match(/[0-9]+$/)?.[0] ?? 0)
}

const SpreadsheetSheet = z
  .object({
    id: StableID,
    name: z.string().trim().min(1).max(120),
    rowCount: z.number().int().min(1).max(100_000),
    columnCount: z.number().int().min(1).max(1_000),
    frozenRows: z.number().int().nonnegative().max(1_000).default(0),
    frozenColumns: z.number().int().nonnegative().max(100).default(0),
    cells: SpreadsheetCell.array().max(50_000),
  })
  .strict()
  .refine((sheet) => new Set(sheet.cells.map((cell) => cell.address)).size === sheet.cells.length, {
    message: "spreadsheet cell addresses must be unique within a sheet",
    path: ["cells"],
  })
  .refine(
    (sheet) =>
      sheet.cells.every(
        (cell) =>
          spreadsheetRowIndex(cell.address) <= sheet.rowCount &&
          spreadsheetColumnIndex(cell.address) <= sheet.columnCount,
      ),
    {
      message: "spreadsheet cell address exceeds declared sheet bounds",
      path: ["cells"],
    },
  )
  .refine((sheet) => sheet.frozenRows <= sheet.rowCount && sheet.frozenColumns <= sheet.columnCount, {
    message: "spreadsheet frozen panes exceed declared sheet bounds",
    path: ["frozenRows"],
  })

export const InteractiveArtifactSpreadsheet = InteractiveArtifactBase.extend({
  renderer: z.literal("spreadsheet@1"),
  editable: z.boolean().default(false),
  sheets: SpreadsheetSheet.array()
    .min(1)
    .max(32)
    .refine(
      (sheets) =>
        new Set(sheets.map((sheet) => sheet.id)).size === sheets.length &&
        new Set(sheets.map((sheet) => sheet.name)).size === sheets.length,
      {
        message: "spreadsheet sheet IDs and names must be unique",
      },
    ),
}).strict()

const DashboardMetric = z
  .object({
    id: StableID,
    label: z.string().trim().min(1).max(120),
    value: z.union([z.string().max(120), z.number().finite()]),
    delta: z.number().finite().optional(),
    unit: z.string().trim().min(1).max(40).optional(),
  })
  .strict()

const DashboardFilter = z
  .object({
    id: StableID,
    label: z.string().trim().min(1).max(120),
    field: StableID,
    values: JsonScalar.array().min(1).max(200),
  })
  .strict()

const DashboardView = z
  .object({
    id: StableID,
    title: z.string().trim().min(1).max(160),
    spec: JsonObject.refine((spec) => !hasEmbeddedExternalData(spec), {
      message: "dashboard view spec must not contain external data URLs",
    }),
    span: z.enum(["half", "full"]).default("half"),
  })
  .strict()

export const InteractiveArtifactDashboard = InteractiveArtifactBase.extend({
  renderer: z.literal("dashboard@1"),
  metrics: DashboardMetric.array().max(24).default([]),
  filters: DashboardFilter.array().max(12).default([]),
  views: DashboardView.array().min(1).max(24),
  data: z.array(z.record(z.string(), JsonScalar)).min(1).max(50_000),
})
  .strict()
  .refine(
    (payload) =>
      [payload.metrics, payload.filters, payload.views].every(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
      ),
    {
      message: "dashboard metric, filter and view IDs must be unique within their collection",
    },
  )
  .refine(
    (payload) =>
      payload.filters.every(
        (filter) =>
          payload.data.some((row) => filter.field in row) &&
          filter.values.every((value) => payload.data.some((row) => Object.is(row[filter.field], value))),
      ),
    {
      message: "dashboard filters must reference fields and values present in inline data",
      path: ["filters"],
    },
  )

const TimelineItemBase = {
  id: StableID,
  content: z.string().trim().min(1).max(500),
  group: StableID.optional(),
  color: HexColor.optional(),
}

const TimelineItem = z.discriminatedUnion("kind", [
  z.object({ ...TimelineItemBase, kind: z.literal("point"), start: IsoDateTime }).strict(),
  z
    .object({
      ...TimelineItemBase,
      kind: z.literal("range"),
      start: IsoDateTime,
      end: IsoDateTime,
    })
    .strict()
    .refine((item) => Date.parse(item.end) > Date.parse(item.start), {
      message: "timeline range end must be after start",
      path: ["end"],
    }),
  z
    .object({
      ...TimelineItemBase,
      kind: z.literal("background"),
      start: IsoDateTime,
      end: IsoDateTime,
    })
    .strict()
    .refine((item) => Date.parse(item.end) > Date.parse(item.start), {
      message: "timeline background end must be after start",
      path: ["end"],
    }),
])

const TimelineGroup = z
  .object({
    id: StableID,
    label: z.string().trim().min(1).max(160),
  })
  .strict()

export const InteractiveArtifactTimeline = InteractiveArtifactBase.extend({
  renderer: z.literal("timeline@1"),
  groups: TimelineGroup.array().max(200).default([]),
  items: TimelineItem.array().min(1).max(20_000),
  viewport: z
    .object({
      start: IsoDateTime,
      end: IsoDateTime,
    })
    .strict()
    .refine((viewport) => Date.parse(viewport.end) > Date.parse(viewport.start), {
      message: "timeline viewport end must be after start",
      path: ["end"],
    })
    .optional(),
})
  .strict()
  .refine(
    (payload) =>
      new Set(payload.groups.map((group) => group.id)).size === payload.groups.length &&
      new Set(payload.items.map((item) => item.id)).size === payload.items.length,
    {
      message: "timeline group and item IDs must be unique within their collection",
    },
  )
  .refine(
    (payload) => {
      const groupIDs = new Set(payload.groups.map((group) => group.id))
      return payload.items.every((item) => item.group === undefined || groupIDs.has(item.group))
    },
    {
      message: "timeline items must reference an existing group",
      path: ["items"],
    },
  )

const NetworkNode = z
  .object({
    id: StableID,
    label: z.string().trim().min(1).max(160),
    group: z.string().trim().min(1).max(80).optional(),
    metadata: z.record(z.string(), JsonScalar).optional(),
  })
  .strict()

const NetworkEdge = z
  .object({
    id: StableID,
    source: StableID,
    target: StableID,
    label: z.string().trim().min(1).max(160).optional(),
    directed: z.boolean().default(true),
    weight: z.number().finite().positive().optional(),
  })
  .strict()

export const InteractiveArtifactNetwork = InteractiveArtifactBase.extend({
  renderer: z.literal("network@1"),
  layout: z.enum(["breadthfirst", "circle", "concentric", "cose", "grid"]).default("cose"),
  nodes: NetworkNode.array().min(1).max(10_000),
  edges: NetworkEdge.array().max(50_000),
})
  .strict()
  .refine(
    (payload) =>
      new Set(payload.nodes.map((node) => node.id)).size === payload.nodes.length &&
      new Set(payload.edges.map((edge) => edge.id)).size === payload.edges.length,
    {
      message: "network node and edge IDs must be unique within their collection",
    },
  )
  .refine(
    (payload) => {
      const nodeIDs = new Set(payload.nodes.map((node) => node.id))
      return payload.edges.every((edge) => nodeIDs.has(edge.source) && nodeIDs.has(edge.target))
    },
    {
      message: "network edges must reference existing nodes",
      path: ["edges"],
    },
  )

const TreeNode = z
  .object({
    id: StableID,
    parentID: StableID.optional(),
    label: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(1_000).optional(),
    metadata: z.record(z.string(), JsonScalar).optional(),
  })
  .strict()

function treeIsAcyclic(nodes: z.infer<typeof TreeNode>[]): boolean {
  const parents = new Map(nodes.map((node) => [node.id, node.parentID]))
  for (const node of nodes) {
    const visited = new Set<string>()
    let current: string | undefined = node.id
    while (current) {
      if (visited.has(current)) return false
      visited.add(current)
      current = parents.get(current)
    }
  }
  return true
}

export const InteractiveArtifactTree = InteractiveArtifactBase.extend({
  renderer: z.literal("tree@1"),
  nodes: TreeNode.array().min(1).max(10_000),
  defaultExpandedDepth: z.number().int().min(0).max(20).default(1),
})
  .strict()
  .refine((payload) => new Set(payload.nodes.map((node) => node.id)).size === payload.nodes.length, {
    message: "tree node IDs must be globally unique",
    path: ["nodes"],
  })
  .refine(
    (payload) => {
      const ids = new Set(payload.nodes.map((node) => node.id))
      return payload.nodes.every((node) => node.parentID === undefined || ids.has(node.parentID))
    },
    {
      message: "tree nodes must reference an existing parent",
      path: ["nodes"],
    },
  )
  .refine((payload) => treeIsAcyclic(payload.nodes), {
    message: "tree parent references must be acyclic",
    path: ["nodes"],
  })

export const InteractiveArtifactTerminal = InteractiveArtifactBase.extend({
  renderer: z.literal("terminal@1"),
  output: z.string().max(2_000_000),
  columns: z.number().int().min(20).max(500).default(100),
  rows: z.number().int().min(5).max(200).default(30),
  command: z.string().trim().min(1).max(2_000).optional(),
  workingDirectory: z.string().trim().min(1).max(2_000).optional(),
  exitCode: z.number().int().min(-255).max(255).optional(),
}).strict()

export const InteractiveArtifactModel3d = InteractiveArtifactBase.extend({
  renderer: z.literal("model-3d@1"),
  source: InteractiveArtifactAttachment,
  alt: z.string().trim().min(1).max(500),
  poster: InteractiveArtifactAttachment.optional(),
  animation: z.string().trim().min(1).max(160).optional(),
  cameraOrbit: z.string().trim().min(1).max(120).optional(),
  exposure: z.number().finite().min(0).max(2).default(1),
})
  .strict()
  .refine(
    (payload) =>
      payload.source.mime.toLowerCase() === "model/gltf-binary" ||
      payload.source.mime.toLowerCase() === "model/gltf+json",
    {
      message: "3D model attachment MIME must be model/gltf-binary or model/gltf+json",
      path: ["source", "mime"],
    },
  )
  .refine((payload) => !payload.poster || payload.poster.mime.toLowerCase().startsWith("image/"), {
    message: "3D model poster attachment must be an image",
    path: ["poster", "mime"],
  })

const McpAppToolResult = z
  .object({
    content: z.array(z.record(z.string(), z.unknown())),
    structuredContent: z.record(z.string(), z.unknown()).optional(),
    isError: z.boolean().optional(),
    _meta: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export const McpAppToolLifecycle = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("input-streaming"),
      partialInput: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      status: z.literal("running"),
      input: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      status: z.literal("completed"),
      input: z.record(z.string(), z.unknown()),
      result: McpAppToolResult,
    })
    .strict(),
  z
    .object({
      status: z.literal("cancelled"),
      input: z.record(z.string(), z.unknown()),
      reason: z.string().trim().min(1).max(2_000).optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal("error"),
      input: z.record(z.string(), z.unknown()),
      message: z.string().trim().min(1).max(2_000),
    })
    .strict(),
])

const McpAppServerAuthority = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("configured") }).strict(),
  z
    .object({
      kind: z.literal("expert-squad"),
      taskID: z.string().trim().min(1),
      expertSquadID: z.string().trim().min(1),
      agentID: z.string().trim().min(1),
      projectionHash: Sha256Digest,
      providerKind: z.enum(["package-mcp-tool", "default-mcp-tool"]),
      toolRef: z.string().trim().min(1),
      providerName: z.string().trim().min(1),
      mcpServerConfigSHA256: Sha256Digest,
    })
    .strict(),
])

const McpAppResourceMetadata = z
  .object({
    csp: z
      .object({
        connectDomains: z.array(z.string().url()).max(100).optional(),
        resourceDomains: z.array(z.string().url()).max(100).optional(),
        frameDomains: z.array(z.string().url()).max(100).optional(),
        baseUriDomains: z.array(z.string().url()).max(100).optional(),
      })
      .strict()
      .optional(),
    permissions: z
      .object({
        camera: z.object({}).strict().optional(),
        microphone: z.object({}).strict().optional(),
        geolocation: z.object({}).strict().optional(),
        clipboardWrite: z.object({}).strict().optional(),
      })
      .strict()
      .optional(),
    domain: z.string().trim().min(1).max(253).optional(),
    prefersBorder: z.boolean().optional(),
  })
  .strict()

export const InteractiveArtifactMcpApp = InteractiveArtifactBase.extend({
  renderer: z.literal("mcp-app@1"),
  // MCP means Model Context Protocol. This binding is produced only from one real MCP tool and its ui:// resource.
  server: z
    .object({
      id: z.string().trim().min(1).max(200),
      configDigest: Sha256Digest,
      authority: McpAppServerAuthority,
    })
    .strict(),
  tool: z
    .object({
      name: z.string().trim().min(1).max(200),
      definition: z.record(z.string(), z.unknown()),
      lifecycle: McpAppToolLifecycle,
    })
    .strict(),
  resource: z
    .object({
      uri: z.string().regex(/^ui:\/\/[^/\s?#]+(?:[/?#][^\s]*)?$/),
      mimeType: z.literal("text/html;profile=mcp-app"),
      html: z.string().min(1).max(5_000_000),
      sha: Sha256Digest,
      metadata: McpAppResourceMetadata,
    })
    .strict(),
}).strict()

const PublishableInteractiveArtifactVariants = [
  InteractiveArtifactDocument,
  InteractiveArtifactTable,
  InteractiveArtifactChart,
  InteractiveArtifactDiagram,
  InteractiveArtifactCode,
  InteractiveArtifactDiff,
  InteractiveArtifactCandlestick,
  InteractiveArtifactMedia,
  InteractiveArtifactFilePreview,
  InteractiveArtifactMap,
  InteractiveArtifactNotebook,
  InteractiveArtifactPresentation,
  InteractiveArtifactSpreadsheet,
  InteractiveArtifactDashboard,
  InteractiveArtifactTimeline,
  InteractiveArtifactNetwork,
  InteractiveArtifactTree,
  InteractiveArtifactTerminal,
  InteractiveArtifactModel3d,
] as const

export const PublishableInteractiveArtifactPayload = z
  .discriminatedUnion("renderer", PublishableInteractiveArtifactVariants)
  .meta({ ref: "PublishableInteractiveArtifactPayload" })

export type PublishableInteractiveArtifactPayload = z.infer<typeof PublishableInteractiveArtifactPayload>

const PublishableInteractiveArtifactToolBase = z.object({
  schemaVersion: InteractiveArtifactBase.shape.schemaVersion,
  title: InteractiveArtifactBase.shape.title,
  presentation: InteractiveArtifactBase.shape.presentation,
}).strict()

function interactiveArtifactToolVariant(schema: z.ZodObject<z.ZodRawShape>) {
  const { schemaVersion: _schemaVersion, title: _title, presentation: _presentation, ...shape } = schema.shape
  return z.object(shape).strict()
}

const PublishableInteractiveArtifactToolVariants = PublishableInteractiveArtifactVariants.map((schema) =>
  interactiveArtifactToolVariant(schema as unknown as z.ZodObject<z.ZodRawShape>),
) as unknown as [
  z.ZodObject<z.ZodRawShape>,
  z.ZodObject<z.ZodRawShape>,
  ...z.ZodObject<z.ZodRawShape>[],
]

/**
 * Provider-facing projection of the canonical payload schema. Shared envelope
 * fields appear once instead of being repeated in every renderer branch. The
 * canonical schema remains the only validator for cross-field refinements.
 */
export const PublishableInteractiveArtifactToolPayload = z
  .object({
    schemaVersion: PublishableInteractiveArtifactToolBase.shape.schemaVersion,
    title: PublishableInteractiveArtifactToolBase.shape.title,
    presentation: PublishableInteractiveArtifactToolBase.shape.presentation,
    content: z.discriminatedUnion("renderer", PublishableInteractiveArtifactToolVariants),
  })
  .strict()
  .superRefine((payload, context) => {
    const parsed = PublishableInteractiveArtifactPayload.safeParse({
      schemaVersion: payload.schemaVersion,
      title: payload.title,
      presentation: payload.presentation,
      ...payload.content,
    })
    if (parsed.success) return
    for (const issue of parsed.error.issues) {
      const [head, ...tail] = issue.path
      context.addIssue({
        code: "custom",
        message: issue.message,
        path: head === "schemaVersion" || head === "title" || head === "presentation" ? issue.path : ["content", head, ...tail],
      })
    }
  })

export type PublishableInteractiveArtifactToolPayload = z.infer<typeof PublishableInteractiveArtifactToolPayload>

export function canonicalPublishableInteractiveArtifactFromToolPayload(
  payload: PublishableInteractiveArtifactToolPayload,
): PublishableInteractiveArtifactPayload {
  return PublishableInteractiveArtifactPayload.parse({
    schemaVersion: payload.schemaVersion,
    title: payload.title,
    presentation: payload.presentation,
    ...payload.content,
  })
}

export const InteractiveArtifactPayload = z
  .discriminatedUnion("renderer", [
    InteractiveArtifactDocument,
    InteractiveArtifactTable,
    InteractiveArtifactChart,
    InteractiveArtifactDiagram,
    InteractiveArtifactCode,
    InteractiveArtifactDiff,
    InteractiveArtifactCandlestick,
    InteractiveArtifactMedia,
    InteractiveArtifactFilePreview,
    InteractiveArtifactMap,
    InteractiveArtifactNotebook,
    InteractiveArtifactPresentation,
    InteractiveArtifactSpreadsheet,
    InteractiveArtifactDashboard,
    InteractiveArtifactTimeline,
    InteractiveArtifactNetwork,
    InteractiveArtifactTree,
    InteractiveArtifactTerminal,
    InteractiveArtifactModel3d,
    InteractiveArtifactMcpApp,
  ])
  .meta({ ref: "InteractiveArtifactPayload" })

export type InteractiveArtifactPayload = z.infer<typeof InteractiveArtifactPayload>

export const InteractiveArtifactRecord = z
  .object({
    id: z.string().min(1),
    sessionID: z.string().min(1),
    messageID: z.string().min(1),
    payload: InteractiveArtifactPayload,
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  .strict()
  .meta({ ref: "InteractiveArtifactRecord" })

export type InteractiveArtifactRecord = z.infer<typeof InteractiveArtifactRecord>
