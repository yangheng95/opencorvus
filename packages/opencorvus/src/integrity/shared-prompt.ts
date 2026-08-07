export type SharedPromptBudget = {
  totalTokenCap: 12000
  totalCharCap: 48000
  maxRenderedPriorReviews: 8
  latestReviewFullTextCharCap: 16000
  persistentRootsCharCap: 12000
  changedEvidenceCharCap: 10000
  oldReviewSummaryCharCap: 800
  findingDescriptionCharCap: 2400
  findingRepairCharCap: 1600
}

export type SanitizedPromptTextReport = {
  text: string
  truncated: boolean
  originalChars: number
  renderedChars: number
  removedAnsiEscapes: number
  removedControls: number
  removedBidirectionalControls: number
  escapedMarkdownControls: number
}

export type SanitizedPromptTextField =
  | "user_request_quote"
  | "finding_description"
  | "finding_repair"
  | "reviewer_text"
  | "changed_evidence"
  | "generic"

const SHARED_INTEGRITY_PROMPT_BUDGET: SharedPromptBudget = {
  totalTokenCap: 12000,
  totalCharCap: 48000,
  maxRenderedPriorReviews: 8,
  latestReviewFullTextCharCap: 16000,
  persistentRootsCharCap: 12000,
  changedEvidenceCharCap: 10000,
  oldReviewSummaryCharCap: 800,
  findingDescriptionCharCap: 2400,
  findingRepairCharCap: 1600,
}

export function getSharedIntegrityPromptBudget(): SharedPromptBudget {
  return SHARED_INTEGRITY_PROMPT_BUDGET
}

export function sanitizeIntegrityPromptText(input: {
  text: string
  field: SanitizedPromptTextField
  maxChars?: number
  markdownContext: "inline" | "block"
}): SanitizedPromptTextReport {
  const originalChars = input.text.length
  let removedAnsiEscapes = 0
  let removedControls = 0
  let removedBidirectionalControls = 0
  let escapedMarkdownControls = 0

  let text = input.text
  text = text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, () => {
    removedAnsiEscapes += 1
    return ""
  })
  text = text.replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)?/g, () => {
    removedAnsiEscapes += 1
    return ""
  })

  const chars: string[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code === 0) {
      removedControls += 1
      chars.push("[NUL REMOVED]")
      continue
    }
    if (isBidirectionalControl(code)) {
      removedBidirectionalControls += 1
      chars.push(`[BIDI U+${hexCode(code)} REMOVED]`)
      continue
    }
    if (isDisallowedControl(code)) {
      removedControls += 1
      chars.push(`[CTRL U+${hexCode(code)} REMOVED]`)
      continue
    }
    chars.push(char)
  }
  text = chars.join("")

  if (input.markdownContext === "block") {
    text = text
      .split("\n")
      .map((line) =>
        escapesMarkdownControl(line)
          ? escapeMarkdownControlLine(line, () => {
              escapedMarkdownControls += 1
            })
          : line,
      )
      .join("\n")
  }

  const maxChars = input.maxChars ?? defaultSanitizedPromptTextMaxChars(input.field)
  let truncated = false
  if (Number.isFinite(maxChars) && text.length > maxChars) {
    truncated = true
    const marker = "\n[truncated_by_integrity_prompt_sanitizer]"
    text = maxChars > marker.length ? `${text.slice(0, maxChars - marker.length)}${marker}` : text.slice(0, maxChars)
  }

  return {
    text,
    truncated,
    originalChars,
    renderedChars: text.length,
    removedAnsiEscapes,
    removedControls,
    removedBidirectionalControls,
    escapedMarkdownControls,
  }
}

function defaultSanitizedPromptTextMaxChars(field: SanitizedPromptTextField): number {
  switch (field) {
    case "user_request_quote":
      return Number.POSITIVE_INFINITY
    case "finding_description":
      return 2400
    case "finding_repair":
      return 1600
    case "reviewer_text":
      return 3000
    case "changed_evidence":
    case "generic":
      return 12000
  }
}

function isBidirectionalControl(code: number): boolean {
  return (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
}

function isDisallowedControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false
  return (code >= 0x0000 && code <= 0x001f) || (code >= 0x007f && code <= 0x009f)
}

function hexCode(code: number): string {
  return code.toString(16).toUpperCase().padStart(4, "0")
}

function escapesMarkdownControl(line: string): boolean {
  return (
    /^\s{0,3}#{1,6}(\s|$)/.test(line) ||
    /^\s{0,3}(```|~~~)/.test(line) ||
    /^\s{0,3}<\/?[A-Za-z][^>]*>/.test(line) ||
    /^\s{0,3}([-*_]\s*){3,}$/.test(line) ||
    /^\s{0,3}(=+|-+)\s*$/.test(line)
  )
}

function escapeMarkdownControlLine(line: string, onEscape: () => void): string {
  onEscape()
  const indent = line.match(/^\s*/)?.[0] ?? ""
  return `${indent}\\${line.slice(indent.length)}`
}
