import { createHash } from "node:crypto"
import path from "node:path"
import type { Message } from "@/session/message"

function semanticSourceId(kind: Message.SourcePayload["type"], identity: string): string {
  return createHash("sha256").update(`${kind}\0${identity}`).digest("hex")
}

export function canonicalSourceUrl(raw: string): string {
  const url = new URL(raw)
  url.hash = ""
  return url.toString()
}

export function urlSource(input: {
  url: string
  title?: string
  snippet?: string
  author?: string
  publishedAt?: string
  provider?: string
  providerMetadata?: Record<string, unknown>
}): Message.SourceUrlPayload {
  const url = canonicalSourceUrl(input.url)
  return {
    type: "source-url",
    sourceId: semanticSourceId("source-url", url),
    url,
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
    ...(input.snippet?.trim() ? { snippet: input.snippet.trim() } : {}),
    ...(input.author?.trim() ? { author: input.author.trim() } : {}),
    ...(input.publishedAt?.trim() ? { publishedAt: input.publishedAt.trim() } : {}),
    ...(input.provider?.trim() ? { provider: input.provider.trim() } : {}),
    ...(input.providerMetadata ? { providerMetadata: input.providerMetadata } : {}),
  }
}

export function fileSource(input: {
  path: string
  title?: string
  range?: { startLine: number; endLine: number }
  symbol?: string
  provider?: string
}): Message.SourceFilePayload {
  const absolutePath = path.resolve(input.path)
  const rangeIdentity = input.range ? `${input.range.startLine}:${input.range.endLine}` : ""
  return {
    type: "source-file",
    sourceId: semanticSourceId("source-file", `${absolutePath}\0${rangeIdentity}\0${input.symbol ?? ""}`),
    path: absolutePath,
    title: input.title?.trim() || path.basename(absolutePath),
    ...(input.range ? { range: input.range } : {}),
    ...(input.symbol?.trim() ? { symbol: input.symbol.trim() } : {}),
    ...(input.provider?.trim() ? { provider: input.provider.trim() } : {}),
  }
}
