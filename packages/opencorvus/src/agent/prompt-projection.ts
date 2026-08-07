export interface PromptAttachmentRef {
  sha?: string
  url: string
  mime: string
  size?: number
  filename?: string
}

export function selectPromptAttachments(
  attachments: readonly PromptAttachmentRef[] | undefined,
  selectedRefs: readonly string[],
): { attachments: PromptAttachmentRef[]; missingRefs: string[] } {
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
