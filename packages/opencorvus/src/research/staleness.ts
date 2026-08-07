import {
  RESEARCH_VOLATILE_STALE_AFTER_MS,
  researchRequestHash,
  type ResearchBrief,
  type ResearchStaleness,
} from "./schema"

export function researchRequestHashInput(input: {
  request: string
  clarificationTranscript?: string
}): string {
  return [
    input.request,
    input.clarificationTranscript?.trim() ? `Clarification transcript:\n${input.clarificationTranscript.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function researchBriefIsStale(input: {
  request: string
  requestHashInput?: string
  brief: ResearchBrief
  now?: number
}): ResearchStaleness {
  const reasons: string[] = []
  const expectedRequestHash = researchRequestHash(input.requestHashInput ?? input.request)
  if (input.brief.metadata.request_hash !== expectedRequestHash) {
    reasons.push("request_hash_mismatch")
  }
  if (input.brief.metadata.stale_after) {
    const cutoff = Date.parse(input.brief.metadata.stale_after)
    if (!Number.isNaN(cutoff) && (input.now ?? Date.now()) > cutoff) {
      reasons.push("stale_after_elapsed")
    }
  }
  if (!input.brief.metadata.stale_after && input.brief.evidence_index.some((item) => item.volatile)) {
    const createdAt = Date.parse(input.brief.metadata.created_at)
    if (!Number.isNaN(createdAt) && (input.now ?? Date.now()) > createdAt + RESEARCH_VOLATILE_STALE_AFTER_MS) {
      reasons.push("volatile_evidence_elapsed")
    }
  }
  return {
    stale: reasons.length > 0,
    reasons,
  }
}
