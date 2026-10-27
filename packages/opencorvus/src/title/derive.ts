import { visibleMentionDirectiveRanges } from "@opencorvus-ai/transport-protocol"

export function deriveTitle(request: string) {
  let bodyStart = 0
  for (const reference of visibleMentionDirectiveRanges(request)) {
    if (!reference.value.trim() || request.slice(bodyStart, reference.start).trim()) break
    bodyStart = reference.end
  }
  const body = request.slice(bodyStart)
  const titleText = body.trim() ? body : request
  const line = titleText
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean)
  if (!line) return "Untitled task"
  if (line.length <= 80) return line
  return line.slice(0, 77) + "..."
}
