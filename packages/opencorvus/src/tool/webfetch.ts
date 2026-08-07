import z from "zod"
import { Tool } from "./tool"
import TurndownService from "turndown"
import DESCRIPTION from "./webfetch.txt"
import { abortAfterAny } from "../util/abort"
import { Truncate } from "./truncation"
import { Config } from "../config/config"
import { proxiedFetchInit, resolveNetworkProxy } from "../util/network-proxy"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { assertTaskNetworkCapability } from "@/engine/task-execution-capsule-binding"

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_TIMEOUT = 30 * 1000 // 30 seconds
const MAX_TIMEOUT = 120 * 1000 // 2 minutes
const TEXT_OUTPUT_MARKER_RESERVE_BYTES = 512
const TEXT_OUTPUT_MAX_BYTES = Truncate.MAX_BYTES - TEXT_OUTPUT_MARKER_RESERVE_BYTES
const EMBEDDED_BASE64_DATA_URL = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(?:;[^;,\s"'()<>]+)*;base64,[a-z0-9+/]+={0,2}/gi

export const WebFetchDescription = DESCRIPTION

export const WebFetchParameters = z.object({
  url: z.string().describe("The URL to fetch content from"),
  format: z
    .enum(["text", "markdown", "html"])
    .default("markdown")
    .describe("The format to return the content in (text, markdown, or html). Defaults to markdown."),
  timeout: z.number().describe("Optional timeout in seconds (max 120)").optional(),
})

export const WebFetchTool = Tool.define("webfetch", {
  description: WebFetchDescription,
  parameters: WebFetchParameters,
  execute: executeWebFetch,
})

export async function executeWebFetch(params: z.infer<typeof WebFetchParameters>, ctx: Tool.Context) {
  const taskID = taskIDForSession(ctx.sessionID)
  if (!taskID) throw new Error(`Web fetch Session ${ctx.sessionID} does not belong to a Task`)
  assertTaskNetworkCapability({ taskID, capability: "webfetch" })
  // Validate URL
  if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
    throw new Error("URL must start with http:// or https://")
  }

  await ctx.ask({
    permission: "webfetch",
    patterns: [params.url],
    always: ["*"],
    metadata: {
      url: params.url,
      format: params.format,
      timeout: params.timeout,
    },
  })

  const timeout = Math.min((params.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT)

  const { signal, clearTimeout } = abortAfterAny(timeout, ctx.abort)

  // Build Accept header based on requested format with q-weighted alternatives.
  let acceptHeader = "*/*"
  switch (params.format) {
    case "markdown":
      acceptHeader = "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1"
      break
    case "text":
      acceptHeader = "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1"
      break
    case "html":
      acceptHeader = "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1"
      break
    default:
      acceptHeader = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
  }
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    Accept: acceptHeader,
    "Accept-Language": "en-US,en;q=0.9",
  }
  const proxyUrl = resolveNetworkProxy(await Config.get(), "webResearch")

  const initial = await fetch(params.url, proxiedFetchInit({ signal, headers }, proxyUrl, "webResearch"))

  // Retry with honest UA if blocked by Cloudflare bot detection (TLS fingerprint mismatch)
  const response =
    initial.status === 403 && initial.headers.get("cf-mitigated") === "challenge"
      ? await fetch(
          params.url,
          proxiedFetchInit({ signal, headers: { ...headers, "User-Agent": "opencorvus" } }, proxyUrl, "webResearch"),
        )
      : initial

  clearTimeout()

  if (!response.ok) {
    throw new Error(`Request failed with status code: ${response.status}`)
  }

  // Check content length
  const contentLength = response.headers.get("content-length")
  if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
    throw new Error("Response too large (exceeds 5MB limit)")
  }

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
    throw new Error("Response too large (exceeds 5MB limit)")
  }

  const contentType = response.headers.get("content-type") || ""
  const mime = contentType.split(";")[0]?.trim().toLowerCase() || ""
  const title = `${params.url} (${contentType})`

  // Check if response is an image
  const isImage = mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/vnd.fastbidsheet"

  if (isImage) {
    const base64Content = Buffer.from(arrayBuffer).toString("base64")
    return {
      title,
      output: "Image fetched successfully",
      metadata: {},
      attachments: [
        {
          type: "file" as const,
          mime,
          url: `data:${mime};base64,${base64Content}`,
        },
      ],
    }
  }

  const content = new TextDecoder().decode(arrayBuffer)

  // Handle content based on requested format and actual content type
  switch (params.format) {
    case "markdown":
      if (contentType.includes("text/html")) {
        const markdown = formatFetchedText(convertHTMLToMarkdown(content))
        return {
          ...markdown,
          title,
        }
      }
      const markdown = formatFetchedText(content)
      return {
        ...markdown,
        title,
      }

    case "text":
      if (contentType.includes("text/html")) {
        const text = formatFetchedText(await extractTextFromHTML(content))
        return {
          ...text,
          title,
        }
      }
      const text = formatFetchedText(content)
      return {
        ...text,
        title,
      }

    case "html":
      const html = formatFetchedText(content)
      return {
        ...html,
        title,
      }

    default:
      const output = formatFetchedText(content)
      return {
        ...output,
        title,
      }
  }
}

function externalizeEmbeddedDataUrls(text: string) {
  const attachments: Array<{ type: "file"; mime: string; url: string }> = []
  const attachmentIndexByUrl = new Map<string, number>()
  const output = text.replace(EMBEDDED_BASE64_DATA_URL, (dataUrl, mime: string) => {
    const existingIndex = attachmentIndexByUrl.get(dataUrl)
    if (existingIndex !== undefined) return `attachment:webfetch-embedded-${existingIndex}`

    const index = attachments.length + 1
    attachmentIndexByUrl.set(dataUrl, index)
    attachments.push({
      type: "file",
      mime: mime.toLowerCase(),
      url: dataUrl,
    })
    return `attachment:webfetch-embedded-${index}`
  })
  return { output, attachments }
}

function formatFetchedText(text: string) {
  const externalized = externalizeEmbeddedDataUrls(text)
  const normalized = externalized.output
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
  const originalBytes = Buffer.byteLength(normalized, "utf8")
  if (originalBytes <= TEXT_OUTPUT_MAX_BYTES) {
    return {
      output: normalized,
      metadata: {
        originalBytes,
        shownBytes: originalBytes,
        webfetchOutputClipped: false,
        webfetchEmbeddedAttachmentCount: externalized.attachments.length,
      },
      ...(externalized.attachments.length > 0 ? { attachments: externalized.attachments } : {}),
    }
  }

  const lines = normalized.split("\n")
  const shown: string[] = []
  let shownBytes = 0
  for (const line of lines) {
    const lineBytes = Buffer.byteLength(line, "utf8")
    const separatorBytes = shown.length === 0 ? 0 : 1
    if (shownBytes + separatorBytes + lineBytes > TEXT_OUTPUT_MAX_BYTES) break
    shown.push(line)
    shownBytes += separatorBytes + lineBytes
  }
  if (shown.length === 0) {
    const head = Buffer.from(normalized, "utf8").subarray(0, TEXT_OUTPUT_MAX_BYTES).toString("utf8")
    shown.push(head)
    shownBytes = Buffer.byteLength(head, "utf8")
  }
  const prefix = shown.join("\n")
  const omittedBytes = originalBytes - shownBytes
  return {
    output:
      prefix +
      `\n\n[webfetch output clipped: ${shownBytes} of ${originalBytes} bytes shown, ${omittedBytes} bytes omitted from model context]`,
    metadata: {
      originalBytes,
      shownBytes,
      omittedBytes,
      webfetchOutputClipped: true,
      webfetchEmbeddedAttachmentCount: externalized.attachments.length,
    },
    ...(externalized.attachments.length > 0 ? { attachments: externalized.attachments } : {}),
  }
}

async function extractTextFromHTML(html: string) {
  let text = ""
  let skipContent = false

  const rewriter = new HTMLRewriter()
    .on("script, style, noscript, iframe, object, embed", {
      element() {
        skipContent = true
      },
      text() {
        // Skip text content inside these elements
      },
    })
    .on("*", {
      element(element) {
        // Reset skip flag when entering other elements
        if (!["script", "style", "noscript", "iframe", "object", "embed"].includes(element.tagName)) {
          skipContent = false
        }
      },
      text(input) {
        if (!skipContent) {
          text += input.text
        }
      },
    })
    .transform(new Response(html))

  await rewriter.text()
  return text.trim()
}

function convertHTMLToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  })
  turndownService.remove(["script", "style", "meta", "link"])
  return turndownService.turndown(html)
}
