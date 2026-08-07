import path from "node:path"
import { AttachmentStore } from "@/storage/attachment-store"

export interface MultimodalToolAttachment {
  type: "file"
  mime: string
  url: string
  filename?: string
}

export interface MultimodalToolOutput {
  text: string
  attachments: MultimodalToolAttachment[]
}

export async function buildMultimodalToolResult(input: {
  projectID: string
  text: string
  images: Array<{
    path: string
    mime?: string
    filename?: string
  }>
}): Promise<MultimodalToolOutput> {
  const attachments: MultimodalToolAttachment[] = []
  for (const img of input.images) {
    const filename = img.filename ?? path.basename(img.path)
    const ref = await AttachmentStore.writeFromPath(input.projectID, img.path, img.mime, filename)
    attachments.push({
      type: "file",
      mime: ref.mime,
      url: ref.url,
      filename,
    })
  }
  return { text: input.text, attachments }
}
