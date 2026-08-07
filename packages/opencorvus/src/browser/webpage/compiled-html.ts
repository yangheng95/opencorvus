import { createHash } from "node:crypto"
import path from "node:path"
import type { ToolFiles } from "@opencorvus-ai/plugin"
import { parse, type DefaultTreeAdapterMap } from "parse5"
import {
  CompiledWebpageAssetGraphSchema,
  CompiledWebpageStructureSchema,
  type CompiledWebpageAsset,
  type CompiledWebpageAssetGraph,
  type CompiledWebpageAssetKind,
  type CompiledWebpageNode,
  type CompiledWebpageNamespace,
  type CompiledWebpageStructure,
} from "@opencorvus-ai/plugin"

interface DomNode {
  type?: string
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: DomNode[]
  namespace?: CompiledWebpageNamespace
}

export interface ExtractArchiveHtmlInput {
  html: string
  url?: string
  title?: string
  longValueThresholdBytes?: number
}

export interface CompiledWebpageExtraction {
  pageIr: CompiledWebpageStructure
  assetGraph: CompiledWebpageAssetGraph
  assetContents: Record<string, string>
}

interface ExtractionStats {
  nodes: number
  elements: number
  textNodes: number
  comments: number
  directives: number
  attributes: number
}

const DEFAULT_LONG_VALUE_THRESHOLD_BYTES = 512

export function compileArchivedWebpageHtml(input: ExtractArchiveHtmlInput): CompiledWebpageExtraction {
  const threshold = input.longValueThresholdBytes ?? DEFAULT_LONG_VALUE_THRESHOLD_BYTES
  const document = parse5DocumentToDom(parse(input.html, { sourceCodeLocationInfo: true }), input.html)
  const assets: CompiledWebpageAsset[] = []
  const assetContents: Record<string, string> = {}
  const stats: ExtractionStats = {
    nodes: 0,
    elements: 0,
    textNodes: 0,
    comments: 0,
    directives: 0,
    attributes: 0,
  }
  let nextNodeIndex = 0

  function nextNodeId(): string {
    return `node_${String(nextNodeIndex++).padStart(6, "0")}`
  }

  function createAsset(inputAsset: {
    kind: CompiledWebpageAssetKind
    value: string
    nodeId: string
    tag?: string
    attribute?: string
    role?: string
    mime?: string
  }): string {
    const id = `asset_${String(assets.length).padStart(6, "0")}`
    const assetPath = assetPathFor(id, inputAsset.kind, inputAsset.mime)
    const bytes = Buffer.byteLength(inputAsset.value, "utf8")
    const asset: CompiledWebpageAsset = {
      id,
      kind: inputAsset.kind,
      path: assetPath,
      sha256: sha256(inputAsset.value),
      bytes,
      chars: inputAsset.value.length,
      mime: inputAsset.mime,
      semanticRole: inputAsset.role ?? inputAsset.kind,
      preview: inputAsset.value.replace(/\s+/g, " ").slice(0, 160),
      usedBy: [
        {
          nodeId: inputAsset.nodeId,
          tag: inputAsset.tag,
          attribute: inputAsset.attribute,
          role: inputAsset.role,
        },
      ],
    }
    assets.push(asset)
    assetContents[id] = inputAsset.value
    return id
  }

  function encodeAttribute(nodeId: string, tag: string, name: string, rawValue: string) {
    stats.attributes++
    const value = String(rawValue)
    if (name === "class" && Buffer.byteLength(value, "utf8") <= threshold) {
      return {
        name,
        value,
        classTokens: value.trim().length > 0 ? value.trim().split(/\s+/) : [],
      }
    }

    const dataUri = parseDataUri(value)
    if (dataUri && dataUri.body.length > 0) {
      return {
        name,
        value: dataUri.placeholder,
        assetId: createAsset({
          kind: dataUri.mime.startsWith("image/") ? "image-data-uri" : "data-uri",
          value,
          nodeId,
          tag,
          attribute: name,
          role: "attribute-data-uri",
          mime: dataUri.mime,
        }),
      }
    }

    const kind = containsEmbeddedDataUri(value) ? "large-attribute" : classifyLongAttribute(tag, name, value, threshold)
    if (kind) {
      return {
        name,
        value: `__COMPILED_WEBPAGE_ASSET_REF_${assets.length}__`,
        classTokens: name === "class" ? value.trim().split(/\s+/).filter(Boolean) : undefined,
        assetId: createAsset({
          kind,
          value,
          nodeId,
          tag,
          attribute: name,
          role: name === "d" ? "svg-geometry" : "attribute-value",
        }),
      }
    }

    return { name, value }
  }

  function encodeText(node: DomNode, parentTag: string | undefined, sourcePath: string): CompiledWebpageNode {
    const nodeId = nextNodeId()
    const text = node.data ?? ""
    stats.nodes++
    stats.textNodes++

    if ((parentTag ?? "").toLowerCase() === "style") {
      return {
        id: nodeId,
        type: "text",
        sourcePath,
        text: `__COMPILED_WEBPAGE_CSS_ASSET_${assets.length}__`,
        assetId: createAsset({
          kind: "css",
          value: text,
          nodeId,
          tag: parentTag,
          role: "stylesheet-text",
          mime: "text/css",
        }),
      }
    }

    if ((parentTag ?? "").toLowerCase() === "script") {
      return {
        id: nodeId,
        type: "text",
        sourcePath,
        text: `__COMPILED_WEBPAGE_SCRIPT_ASSET_${assets.length}__`,
        assetId: createAsset({
          kind: "script",
          value: text,
          nodeId,
          tag: parentTag,
          role: "script-text",
          mime: "application/javascript",
        }),
      }
    }

    if (Buffer.byteLength(text, "utf8") > threshold) {
      return {
        id: nodeId,
        type: "text",
        sourcePath,
        text: text.slice(0, 160),
        assetId: createAsset({
          kind: "large-text",
          value: text,
          nodeId,
          tag: parentTag,
          role: "text-node",
        }),
      }
    }

    return { id: nodeId, type: "text", sourcePath, text }
  }

  function encodeNode(
    node: DomNode,
    parentTag: string | undefined,
    sourcePath: string,
  ): CompiledWebpageNode | undefined {
    if (node.type === "root") {
      const id = nextNodeId()
      stats.nodes++
      return {
        id,
        type: "document",
        sourcePath,
        children: encodeChildren(node.children, parentTag, sourcePath),
      }
    }
    if (node.type === "directive") {
      const id = nextNodeId()
      stats.nodes++
      stats.directives++
      return { id, type: "directive", sourcePath, text: node.data ?? "" }
    }
    if (node.type === "comment") {
      const id = nextNodeId()
      stats.nodes++
      stats.comments++
      return { id, type: "comment", sourcePath, text: node.data ?? "" }
    }
    if (node.type === "text") return encodeText(node, parentTag, sourcePath)
    if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return undefined

    const id = nextNodeId()
    const tag = node.name ?? "unknown"
    if (!node.namespace) throw new Error(`Compiled webpage element ${tag} is missing parser namespace`)
    stats.nodes++
    stats.elements++
    return {
      id,
      type: "element",
      sourcePath,
      tag,
      namespace: node.namespace,
      attrs: Object.entries(node.attribs ?? {}).map(([name, value]) => encodeAttribute(id, tag, name, value)),
      children: encodeChildren(node.children, tag, sourcePath),
    }
  }

  function encodeChildren(
    nodes: DomNode[] | undefined,
    parentTag: string | undefined,
    parentPath: string,
  ): CompiledWebpageNode[] {
    return (nodes ?? [])
      .map((child, index) => encodeNode(child, parentTag, `${parentPath}/${sourcePathToken(child, index)}`))
      .filter((child): child is CompiledWebpageNode => Boolean(child))
  }

  const root = encodeNode(document, undefined, "document")
  if (!root) throw new Error("Compiled webpage extraction failed to produce a document root")

  const pageIr = CompiledWebpageStructureSchema.parse({
    version: 1,
    purpose: "compiled-webpage-structure",
    source: {
      url: input.url,
      title: input.title,
      inputSha256: sha256(input.html),
    },
    policy: {
      preserved:
        "DOM order, element nesting, tag names, attributes, class tokens, comments, directives, text nodes, style/script element positions, SVG path ownership, and data URI ownership are preserved.",
      sidecar:
        "Dense CSS, script bodies, SVG path data, data URIs, and long text/attribute values are moved to assets and referenced by assetId and sha256.",
    },
    stats: {
      ...stats,
      sidecarAssets: assets.length,
    },
    root,
  })

  const assetGraph = CompiledWebpageAssetGraphSchema.parse({
    version: 1,
    purpose: "compiled-webpage-asset-graph",
    sourceIr: "page.ir.json",
    assets,
  })

  return { pageIr, assetGraph, assetContents }
}

function parse5DocumentToDom(document: DefaultTreeAdapterMap["document"], source: string): DomNode {
  return parse5NodeToDom(document, source)
}

function parse5NodeToDom(node: DefaultTreeAdapterMap["node"], source: string): DomNode {
  if (node.nodeName === "#document" || node.nodeName === "#document-fragment") {
    const parent = node as DefaultTreeAdapterMap["parentNode"]
    return { type: "root", children: parent.childNodes.map((child) => parse5NodeToDom(child, source)) }
  }
  if (node.nodeName === "#text") {
    return { type: "text", data: (node as DefaultTreeAdapterMap["textNode"]).value }
  }
  if (node.nodeName === "#comment") {
    return { type: "comment", data: (node as DefaultTreeAdapterMap["commentNode"]).data }
  }
  if (node.nodeName === "#documentType") {
    const documentType = node as DefaultTreeAdapterMap["documentType"]
    const location = documentType.sourceCodeLocation
    if (!location) throw new Error("Parsed webpage doctype is missing source location")
    const raw = source.slice(location.startOffset, location.endOffset)
    if (!raw.startsWith("<") || !raw.endsWith(">")) throw new Error("Parsed webpage doctype location is invalid")
    return { type: "directive", data: raw.slice(1, -1) }
  }

  const element = node as DefaultTreeAdapterMap["element"]
  const locationEntries = Object.values(element.sourceCodeLocation?.attrs ?? {}).sort(
    (left, right) => left.startOffset - right.startOffset,
  )
  if (locationEntries.length !== element.attrs.length) {
    throw new Error(
      `Parsed webpage element ${element.tagName} has ${element.attrs.length} attributes but ${locationEntries.length} source locations`,
    )
  }
  const attribs: Record<string, string> = {}
  for (let index = 0; index < element.attrs.length; index++) {
    const attribute = element.attrs[index]!
    const location = locationEntries[index]!
    const spelling = source.slice(location.startOffset, location.endOffset).match(/^\s*([^\s=/>]+)/)?.[1]
    if (!spelling) throw new Error(`Parsed webpage attribute ${attribute.name} has no source spelling`)
    const sourceLocalName = spelling.includes(":") ? spelling.slice(spelling.lastIndexOf(":") + 1) : spelling
    if (sourceLocalName.toLowerCase() !== attribute.name.toLowerCase()) {
      throw new Error(`Parsed webpage attribute order drift: expected ${attribute.name}, found ${spelling}`)
    }
    attribs[spelling] = attribute.value
  }
  const childNodes =
    element.nodeName === "template"
      ? (element as DefaultTreeAdapterMap["template"]).content.childNodes
      : element.childNodes
  return {
    type: element.tagName === "script" || element.tagName === "style" ? element.tagName : "tag",
    name: element.tagName,
    namespace: element.namespaceURI as CompiledWebpageNamespace,
    attribs,
    children: childNodes.map((child) => parse5NodeToDom(child, source)),
  }
}

export async function writeCompiledWebpageEvidence(
  outputDir: string,
  extraction: CompiledWebpageExtraction,
  files: ToolFiles,
): Promise<void> {
  await files.mkdir(path.join(outputDir, "assets"), { recursive: true })
  await files.writeFile(path.join(outputDir, "page.ir.json"), JSON.stringify(extraction.pageIr, null, 2), "utf8")
  await files.writeFile(
    path.join(outputDir, "assets", "manifest.json"),
    JSON.stringify(extraction.assetGraph, null, 2),
    "utf8",
  )

  for (const asset of extraction.assetGraph.assets) {
    const content = extraction.assetContents[asset.id]
    if (content === undefined) throw new Error(`Missing content for compiled webpage asset ${asset.id}`)
    const absolutePath = path.join(outputDir, asset.path)
    await files.mkdir(path.dirname(absolutePath), { recursive: true })
    await files.writeFile(absolutePath, content, "utf8")
  }
}

function sourcePathToken(node: DomNode, index: number): string {
  if (node.type === "tag" || node.type === "script" || node.type === "style") {
    return `${node.name ?? "unknown"}[${index}]`
  }
  return `${node.type ?? "unknown"}[${index}]`
}

function classifyLongAttribute(
  tag: string,
  name: string,
  value: string,
  thresholdBytes: number,
): CompiledWebpageAssetKind | undefined {
  if (tag.toLowerCase() === "path" && name === "d") return "svg-path-data"
  if (Buffer.byteLength(value, "utf8") > thresholdBytes) return "large-attribute"
  return undefined
}

function parseDataUri(value: string): { mime: string; body: string; placeholder: string } | undefined {
  const match = /^data:([^,;]+)(?:;[^,]+)?,(.+)$/s.exec(value)
  if (!match) return undefined
  const mime = match[1] ?? "application/octet-stream"
  const body = match[2] ?? ""
  return {
    mime,
    body,
    placeholder: `data:${mime},__COMPILED_WEBPAGE_DATA_URI_ASSET__`,
  }
}

function containsEmbeddedDataUri(value: string): boolean {
  return /data:[^,;'"()\s]+(?:;[^,;'"()\s]+)*;base64,[A-Za-z0-9+/=]+/.test(value)
}

function assetPathFor(id: string, kind: CompiledWebpageAssetKind, mime?: string): string {
  if (kind === "css") return `assets/styles/${id}.css`
  if (kind === "script") return `assets/scripts/${id}.js`
  if (kind === "svg-path-data") return `assets/svg/${id}.path.txt`
  if (kind === "image-data-uri") return `assets/images/${id}.${extensionForMime(mime)}.txt`
  if (kind === "data-uri") return `assets/values/${id}.data-uri.txt`
  return `assets/values/${id}.txt`
}

function extensionForMime(mime?: string): string {
  if (!mime) return "bin"
  if (mime.includes("png")) return "png"
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
  if (mime.includes("svg")) return "svg"
  if (mime.includes("webp")) return "webp"
  return "bin"
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}
