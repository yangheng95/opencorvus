import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { crc32, inflateSync } from "node:zlib"
import { TaskArtifactSnapshotLocatorSchema, tool, type ToolFetch } from "@opencorvus-ai/plugin"

// PNG means Portable Network Graphics; SHA-256 means Secure Hash Algorithm 256-bit.
const TREE = "frontend-innovate-figma-resource"
const RESOURCE_MANIFEST = "figma-resource-manifest.json"
const NODE_CONTEXT = "node-context.json"
const REFERENCE_IMAGE = "reference.png"

type FigmaNodeResponse = {
  nodes?: Record<string, { document?: unknown } | null>
}

type FigmaImageResponse = {
  images?: Record<string, string | null>
}

function parseFigmaUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "https:" || !/(^|\.)figma\.com$/i.test(url.hostname)) {
    throw new Error("figma_url must be an HTTPS figma.com URL")
  }
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length < 2 || !["design", "file", "proto", "board"].includes(parts[0]!)) {
    throw new Error("figma_url must identify a Figma design, file, prototype, or board")
  }
  const fileKey = parts[1]!
  if (!/^[A-Za-z0-9_-]+$/.test(fileKey)) throw new Error("figma_url contains an invalid file key")
  const rawNodeID = url.searchParams.get("node-id")
  if (!rawNodeID) throw new Error("figma_url must contain a node-id query parameter")
  const nodeID = rawNodeID.includes(":") ? rawNodeID : rawNodeID.replaceAll("-", ":")
  if (!/^[A-Za-z0-9:_-]+$/.test(nodeID)) throw new Error("figma_url contains an invalid node-id")
  return { fileKey, nodeID }
}

async function fetchJson<T>(
  fetchImplementation: ToolFetch,
  url: string,
  token: string,
  signal: AbortSignal,
  label: string,
): Promise<T> {
  const response = await fetchImplementation(url, {
    headers: { "X-Figma-Token": token },
    signal,
  })
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`)
  return (await response.json()) as T
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function decodePng(bytes: ArrayBuffer): Buffer {
  try {
    const input = Buffer.from(bytes)
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    if (input.length < signature.length || !input.subarray(0, signature.length).equals(signature)) {
      throw new Error("missing PNG signature")
    }

    let offset = signature.length
    let width = 0
    let height = 0
    let bitsPerPixel = 0
    let sawHeader = false
    let sawEnd = false
    const imageData: Buffer[] = []
    while (offset < input.length) {
      if (offset + 12 > input.length) throw new Error("truncated PNG chunk header")
      const length = input.readUInt32BE(offset)
      const dataStart = offset + 8
      const dataEnd = dataStart + length
      const chunkEnd = dataEnd + 4
      if (chunkEnd > input.length) throw new Error("truncated PNG chunk data")
      const typeBytes = input.subarray(offset + 4, dataStart)
      const type = typeBytes.toString("ascii")
      const data = input.subarray(dataStart, dataEnd)
      const expectedCrc = input.readUInt32BE(dataEnd)
      // CRC means Cyclic Redundancy Check; every chunk must match before the bytes are trusted.
      const actualCrc = crc32(Buffer.concat([typeBytes, data])) >>> 0
      if (actualCrc !== expectedCrc) throw new Error(`invalid PNG ${type} chunk CRC`)

      if (!sawHeader) {
        if (type !== "IHDR" || length !== 13) throw new Error("PNG must begin with a 13-byte IHDR chunk")
        width = data.readUInt32BE(0)
        height = data.readUInt32BE(4)
        const bitDepth = data[8]!
        const colorType = data[9]!
        const channels = new Map([
          [0, 1],
          [2, 3],
          [3, 1],
          [4, 2],
          [6, 4],
        ]).get(colorType)
        const validDepths = new Map([
          [0, [1, 2, 4, 8, 16]],
          [2, [8, 16]],
          [3, [1, 2, 4, 8]],
          [4, [8, 16]],
          [6, [8, 16]],
        ]).get(colorType)
        if (!width || !height || !channels || !validDepths?.includes(bitDepth)) {
          throw new Error("invalid PNG image header")
        }
        if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
          throw new Error("unsupported PNG compression, filter, or interlace method")
        }
        bitsPerPixel = channels * bitDepth
        sawHeader = true
      } else if (type === "IHDR") {
        throw new Error("PNG contains multiple IHDR chunks")
      }

      if (type === "IDAT") imageData.push(data)
      if (type === "IEND") {
        if (length !== 0 || chunkEnd !== input.length) throw new Error("invalid PNG IEND chunk")
        sawEnd = true
      }
      offset = chunkEnd
      if (sawEnd) break
    }
    if (!sawHeader || !sawEnd || imageData.length === 0) throw new Error("PNG is missing required chunks")

    const rowBytes = Math.ceil((width * bitsPerPixel) / 8)
    const expectedInflatedSize = (rowBytes + 1) * height
    if (!Number.isSafeInteger(expectedInflatedSize)) throw new Error("PNG dimensions exceed the safe decode range")
    const inflated = inflateSync(Buffer.concat(imageData), { maxOutputLength: expectedInflatedSize + 1 })
    if (inflated.length !== expectedInflatedSize) throw new Error("PNG decoded byte length does not match its header")
    for (let row = 0; row < height; row++) {
      if (inflated[row * (rowBytes + 1)]! > 4) throw new Error("PNG contains an invalid scanline filter")
    }
    return input
  } catch (cause) {
    throw new Error("Figma node image download did not contain a complete decodable PNG", { cause })
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export default tool({
  description:
    "Publish one explicit Figma node screenshot, node context, and stable resource manifest as an immutable Task Artifact catalog snapshot. Returns only the generic task_artifact_snapshot locator; it does not expose runtime paths, dispatch frontend_design, or infer design intent.",
  args: {
    figma_url: tool.schema
      .string()
      .min(1)
      .describe("HTTPS Figma design/file/prototype/board URL with an explicit node-id query parameter."),
    screenshot_intent: tool.schema
      .enum(["visual_reference", "design_source"])
      .describe("Explicit frontend_design intent for the materialized node screenshot."),
  },
  async execute(args, context) {
    const configuredToken = context.configuration.figma_token
    const token = typeof configuredToken === "string" ? configuredToken.trim() : ""
    if (!token) throw new Error("frontend-innovate figma_token configuration is required to materialize Figma resources")
    const { fileKey, nodeID } = parseFigmaUrl(args.figma_url)
    const encodedFileKey = encodeURIComponent(fileKey)
    const encodedNodeID = encodeURIComponent(nodeID)
    const nodeResponse = await fetchJson<FigmaNodeResponse>(
      context.host.fetch,
      `https://api.figma.com/v1/files/${encodedFileKey}/nodes?ids=${encodedNodeID}`,
      token,
      context.abort,
      "Figma node context request",
    )
    const node = nodeResponse.nodes?.[nodeID]
    if (!isObjectRecord(node) || !isObjectRecord(node.document)) {
      throw new Error(`Figma node context response does not contain node ${nodeID}`)
    }
    const imageResponse = await fetchJson<FigmaImageResponse>(
      context.host.fetch,
      `https://api.figma.com/v1/images/${encodedFileKey}?ids=${encodedNodeID}&format=png&scale=1`,
      token,
      context.abort,
      "Figma image request",
    )
    const imageUrl = imageResponse.images?.[nodeID]
    if (!imageUrl) throw new Error(`Figma image response does not contain node ${nodeID}`)
    const image = await context.host.fetch(imageUrl, { signal: context.abort })
    if (!image.ok) throw new Error(`Figma node image download failed with HTTP ${image.status}`)
    const screenshot = decodePng(await image.arrayBuffer())

    const nodeContext = jsonBytes(nodeResponse)
    const resourceManifest = jsonBytes({
      schema_version: 1,
      resource_kind: "figma_node",
      source_url: args.figma_url,
      file_key: fileKey,
      node_id: nodeID,
      manifest: {
        path: RESOURCE_MANIFEST,
        media_type: "application/json",
        intent: "resource_manifest",
      },
      resources: [
        {
          path: NODE_CONTEXT,
          media_type: "application/json",
          intent: "design_source",
          bytes: nodeContext.byteLength,
          sha256: sha256(nodeContext),
        },
        {
          path: REFERENCE_IMAGE,
          media_type: "image/png",
          intent: args.screenshot_intent,
          bytes: screenshot.byteLength,
          sha256: sha256(screenshot),
        },
      ],
    })
    const stage = await context.host.taskArtifacts.stage({ trees: [TREE] })
    const outputDirectory = stage.treeDirectories[TREE]!
    await Promise.all([
      writeFile(path.join(outputDirectory, RESOURCE_MANIFEST), resourceManifest, { flag: "wx" }),
      writeFile(path.join(outputDirectory, NODE_CONTEXT), nodeContext, { flag: "wx" }),
      writeFile(path.join(outputDirectory, REFERENCE_IMAGE), screenshot, { flag: "wx" }),
    ])

    const publication = await context.host.taskArtifacts.publish(stage, {
      snapshot_kind: "catalog",
      files: [
        { tree: TREE, path: RESOURCE_MANIFEST, media_type: "application/json" },
        { tree: TREE, path: NODE_CONTEXT, media_type: "application/json" },
        { tree: TREE, path: REFERENCE_IMAGE, media_type: "image/png" },
      ],
    })
    return JSON.stringify(
      TaskArtifactSnapshotLocatorSchema.parse({
        source: "task_artifact_snapshot",
        snapshot: publication.snapshot,
      }),
      null,
      2,
    )
  },
})
