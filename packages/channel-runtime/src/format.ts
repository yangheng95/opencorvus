import type { Part, ToolPart } from "@opencorvus-ai/sdk"
import fs from "node:fs"
import path from "node:path"
import { channelRuntimePaths } from "./runtime-paths"

const MAX_LENGTH = 3000

export interface ImageAttachment {
  buffer: Buffer
  filename: string
  title: string
}

export function formatResponse(parts: Part[]): { text: string; images: ImageAttachment[] } {
  const textLines: string[] = []
  const toolLines: string[] = []
  const images: ImageAttachment[] = []

  for (const part of parts) {
    if (part.type === "text") {
      textLines.push(part.text)
    } else if (part.type === "tool" && part.state.status === "completed") {
      toolLines.push(`*${part.tool}* - ${part.state.title}`)
      // Extract image attachments from tool results
      for (const att of part.state.attachments ?? []) {
        if (att.type === "file" && att.mime?.startsWith("image/")) {
          const buffer = dataUrlToBuffer(att.url)
          if (buffer) {
            const ext = att.mime === "image/png" ? "png" : att.mime === "image/jpeg" ? "jpg" : "png"
            images.push({
              buffer,
              filename: att.filename ?? `screenshot.${ext}`,
              title: part.state.title,
            })
          }
        }
      }
    }
  }

  let text = textLines.join("\n") || "I received your message but didn't have a response."

  if (toolLines.length > 0) {
    text += "\n\n" + toolLines.join("\n")
  }

  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH - 3) + "..."
  }

  return { text, images }
}

export function formatToolUpdate(part: ToolPart): { text?: string; images: ImageAttachment[] } {
  if (part.state.status !== "completed") return { images: [] }
  const images: ImageAttachment[] = []
  for (const att of part.state.attachments ?? []) {
    if (att.type === "file" && att.mime?.startsWith("image/")) {
      const buffer = dataUrlToBuffer(att.url)
      if (buffer) {
        const ext = att.mime === "image/png" ? "png" : att.mime === "image/jpeg" ? "jpg" : "png"
        images.push({
          buffer,
          filename: att.filename ?? `screenshot.${ext}`,
          title: part.state.title,
        })
      }
    }
  }
  return { text: `*${part.tool}* - ${part.state.title}`, images }
}

function dataUrlToBuffer(url: string): Buffer | null {
  // Handle opencorvus:// file-backed screenshots
  if (url.startsWith("opencorvus://screenshot/")) {
    try {
      const rel = url.slice("opencorvus://screenshot/".length)
      // Guard against path traversal (e.g. "../../etc/passwd")
      if (rel.includes("..")) return null
      const filepath = path.join(channelRuntimePaths().data, "screenshots", rel)
      return fs.readFileSync(filepath)
    } catch {
      // A missing or unreadable screenshot produces the attachment parser's null result.
      return null
    }
  }
  const match = url.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) return null
  return Buffer.from(match[1], "base64")
}
