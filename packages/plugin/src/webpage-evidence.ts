import z from "zod"
import { find, hastToReact, html, svg } from "property-information"

export function compiledWebpageReactProperty(
  namespace: "html" | "svg" | "mathml",
  attributeName: string,
): { property: string; boolean: boolean; overloadedBoolean: boolean; defined: boolean } {
  const info = find(namespace === "svg" ? svg : html, attributeName)
  const reactProperty = /^(?:aria|data)-/i.test(info.attribute)
    ? info.attribute
    : (hastToReact[info.property] ?? info.property)
  return {
    property: reactProperty,
    boolean: info.boolean,
    overloadedBoolean: info.overloadedBoolean,
    defined: info.defined,
  }
}

export const CompiledWebpageAssetKindSchema = z.enum([
  "css",
  "script",
  "svg-path-data",
  "data-uri",
  "image-data-uri",
  "large-attribute",
  "large-text",
])

export const CompiledWebpageAssetUseSchema = z.strictObject({
  nodeId: z.string(),
  tag: z.string().optional(),
  attribute: z.string().optional(),
  role: z.string().optional(),
})

export const CompiledWebpageAssetSchema = z.strictObject({
  id: z.string(),
  kind: CompiledWebpageAssetKindSchema,
  path: z.string(),
  sha256: z.string().length(64),
  bytes: z.number().int().nonnegative(),
  chars: z.number().int().nonnegative(),
  mime: z.string().optional(),
  semanticRole: z.string(),
  preview: z.string(),
  usedBy: z.array(CompiledWebpageAssetUseSchema),
})

export const CompiledWebpageAttributeSchema = z.strictObject({
  name: z.string(),
  value: z.string().optional(),
  assetId: z.string().optional(),
  classTokens: z.array(z.string()).optional(),
})

export const CompiledWebpageBoundsSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
})

export const CompiledWebpageLayoutSchema = z.strictObject({
  selector: z.string().optional(),
  role: z.string().optional(),
  bounds: CompiledWebpageBoundsSchema.optional(),
  styles: z.record(z.string(), z.string()).optional(),
  text: z.string().optional(),
  imageSrc: z.string().optional(),
  imageAlt: z.string().optional(),
  href: z.string().optional(),
  matchConfidence: z.number().min(0).max(1).optional(),
})

export const CompiledWebpageNamespaceSchema = z.enum([
  "http://www.w3.org/1999/xhtml",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1998/Math/MathML",
])

export const CompiledWebpageNodeSchema: z.ZodType<{
  id: string
  type: "document" | "element" | "text" | "comment" | "directive"
  sourcePath?: string
  tag?: string
  namespace?: z.infer<typeof CompiledWebpageNamespaceSchema>
  text?: string
  assetId?: string
  attrs?: z.infer<typeof CompiledWebpageAttributeSchema>[]
  layout?: z.infer<typeof CompiledWebpageLayoutSchema>
  children?: CompiledWebpageNode[]
}> = z.lazy(() =>
  z.strictObject({
    id: z.string(),
    type: z.enum(["document", "element", "text", "comment", "directive"]),
    sourcePath: z.string().optional(),
    tag: z.string().optional(),
    namespace: CompiledWebpageNamespaceSchema.optional(),
    text: z.string().optional(),
    assetId: z.string().optional(),
    attrs: z.array(CompiledWebpageAttributeSchema).optional(),
    layout: CompiledWebpageLayoutSchema.optional(),
    children: z.array(CompiledWebpageNodeSchema).optional(),
  }).superRefine((node, ctx) => {
    if (node.type === "element" && !node.namespace) {
      ctx.addIssue({ code: "custom", path: ["namespace"], message: "Compiled webpage element requires namespace" })
    }
    if (node.type !== "element" && node.namespace) {
      ctx.addIssue({ code: "custom", path: ["namespace"], message: "Only compiled webpage elements carry namespace" })
    }
  }),
)

export const CompiledWebpageStructureSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("compiled-webpage-structure"),
  source: z.strictObject({
    url: z.string().optional(),
    title: z.string().optional(),
    inputSha256: z.string().length(64),
  }),
  policy: z.strictObject({
    preserved: z.string(),
    sidecar: z.string(),
  }),
  stats: z.strictObject({
    nodes: z.number().int().nonnegative(),
    elements: z.number().int().nonnegative(),
    textNodes: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
    directives: z.number().int().nonnegative(),
    attributes: z.number().int().nonnegative(),
    sidecarAssets: z.number().int().nonnegative(),
    layoutElements: z.number().int().nonnegative().optional(),
    layoutMatchedElements: z.number().int().nonnegative().optional(),
  }),
  root: CompiledWebpageNodeSchema,
})

export const CompiledWebpageAssetGraphSchema = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("compiled-webpage-asset-graph"),
  sourceIr: z.string(),
  assets: z.array(CompiledWebpageAssetSchema),
})

export type CompiledWebpageAssetKind = z.infer<typeof CompiledWebpageAssetKindSchema>
export type CompiledWebpageAssetUse = z.infer<typeof CompiledWebpageAssetUseSchema>
export type CompiledWebpageAsset = z.infer<typeof CompiledWebpageAssetSchema>
export type CompiledWebpageAttribute = z.infer<typeof CompiledWebpageAttributeSchema>
export type CompiledWebpageBounds = z.infer<typeof CompiledWebpageBoundsSchema>
export type CompiledWebpageLayout = z.infer<typeof CompiledWebpageLayoutSchema>
export type CompiledWebpageNamespace = z.infer<typeof CompiledWebpageNamespaceSchema>
export type CompiledWebpageNode = z.infer<typeof CompiledWebpageNodeSchema>
export type CompiledWebpageStructure = z.infer<typeof CompiledWebpageStructureSchema>
export type CompiledWebpageAssetGraph = z.infer<typeof CompiledWebpageAssetGraphSchema>
