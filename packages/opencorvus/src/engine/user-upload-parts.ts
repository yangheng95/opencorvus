import z from "zod"
import { Instance } from "@/project/instance"
import { SessionWake } from "@/session/wake"
import { decodeRawBase64Payload } from "@/session/text-mime"
import { AttachmentStore } from "@/storage/attachment-store"
import { UserUploadInput } from "./model"

export async function materializeUserUploadParts(
  attachments: z.infer<typeof UserUploadInput>[] | undefined,
  context: string,
): Promise<NonNullable<SessionWake.WakeInput["parts"]>> {
  const parts: NonNullable<SessionWake.WakeInput["parts"]> = []
  for (const attachment of attachments ?? []) {
    const reference =
      "data" in attachment
        ? await AttachmentStore.write(
            Instance.project.id,
            decodeRawBase64Payload(attachment.data, `${context} ${attachment.filename ?? attachment.mime}`),
            attachment.mime,
            attachment.filename,
          )
        : await AttachmentStore.requireReference({
            projectID: Instance.project.id,
            url: attachment.url,
            mime: attachment.mime,
          })
    parts.push({
      type: "file",
      mime: reference.mime,
      url: reference.url,
      presentation: "attachment-index",
      ...((attachment.filename ?? reference.filename) ? { filename: attachment.filename ?? reference.filename } : {}),
    })
  }
  return parts
}
