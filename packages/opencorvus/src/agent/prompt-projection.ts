export interface PromptAttachmentRef {
  sha?: string
  url: string
  mime: string
  size?: number
  filename?: string
}

export function selectPromptAttachments<Attachment extends PromptAttachmentRef>(
  attachments: readonly Attachment[] | undefined,
  selectedRefs: readonly string[],
): { attachments: Attachment[]; missingRefs: string[] } {
  if (selectedRefs.length === 0) return { attachments: [], missingRefs: [] }
  const selected = new Set(selectedRefs)
  const matches = (attachments ?? []).filter(
    (attachment) => selected.has(attachment.url) || (attachment.sha ? selected.has(attachment.sha) : false),
  )
  const matchedRefs = new Set(
    matches.flatMap((attachment) => [attachment.url, ...(attachment.sha ? [attachment.sha] : [])]),
  )
  return {
    attachments: matches,
    missingRefs: selectedRefs.filter((reference) => !matchedRefs.has(reference)),
  }
}

export class PromptAttachmentReferenceError extends Error {
  override readonly name = "PromptAttachmentReferenceError"
  constructor(readonly missingRefs: readonly string[]) {
    super(`Selected Task attachment refs are unavailable: ${missingRefs.join(", ")}. Use exact Task attachment URLs or SHA-256 refs; participant Message IDs and Artifact IDs are separate evidence identities.`)
  }
}

export function requirePromptAttachments<Attachment extends PromptAttachmentRef>(
  attachments: readonly Attachment[] | undefined,
  selectedRefs: readonly string[],
): Attachment[] {
  const selected = selectPromptAttachments(attachments, selectedRefs)
  if (selected.missingRefs.length) throw new PromptAttachmentReferenceError(selected.missingRefs)
  return selected.attachments
}

export function renderPromptSections(sections: readonly string[] | undefined): string | undefined {
  const visible = (sections ?? []).map((section) => section.trim()).filter(Boolean)
  if (visible.length === 0) return undefined
  return ["# Referenced facts", ...visible].join("\n\n")
}

export function attachmentPromptSection(attachments: readonly PromptAttachmentRef[] | undefined): string | undefined {
  if (!attachments?.length) return undefined
  return [
    "## Attachment references",
    ...attachments.map((attachment) => {
      const label = attachment.filename ?? attachment.sha ?? attachment.url
      const size = typeof attachment.size === "number" ? `; ${attachment.size} bytes` : ""
      return `- ${label} (${attachment.mime}${size}): ${attachment.url}`
    }),
  ].join("\n")
}

export function withAttachmentPromptSections(
  sections: readonly string[] | undefined,
  attachments: readonly PromptAttachmentRef[] | undefined,
): string[] {
  const attachmentSection = attachmentPromptSection(attachments)
  return [...(sections ?? []), ...(attachmentSection ? [attachmentSection] : [])]
}
