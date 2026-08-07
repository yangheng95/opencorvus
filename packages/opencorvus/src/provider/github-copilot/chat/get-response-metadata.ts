// Upstream source: anomalyco/opencode packages/core/src/github-copilot/chat/get-response-metadata.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
export function getResponseMetadata({
  id,
  model,
  created,
}: {
  id?: string | undefined | null
  created?: number | undefined | null
  model?: string | undefined | null
}) {
  return {
    id: id ?? undefined,
    modelId: model ?? undefined,
    timestamp: created != null ? new Date(created * 1000) : undefined,
  }
}
