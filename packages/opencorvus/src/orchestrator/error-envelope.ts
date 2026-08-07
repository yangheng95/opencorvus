export interface OrchestratorTaskErrorEnvelope {
  errorName: string
  message: string
  data?: unknown
}

export const ORCHESTRATOR_TASK_ERROR_ENVELOPE_MARKER = "\n[orchestrator-error-envelope]"

export function parseOrchestratorTaskErrorEnvelope(input?: string | null): OrchestratorTaskErrorEnvelope | undefined {
  if (!input) return undefined
  const markerIndex = input.indexOf(ORCHESTRATOR_TASK_ERROR_ENVELOPE_MARKER)
  if (markerIndex < 0) return undefined
  const raw = input.slice(markerIndex + ORCHESTRATOR_TASK_ERROR_ENVELOPE_MARKER.length).trim()
  if (!raw) throw new Error("Orchestrator task error envelope is empty")
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Orchestrator task error envelope must be an object")
  }
  const candidate = parsed as Record<string, unknown>
  if (typeof candidate.errorName !== "string" || candidate.errorName.trim().length === 0) {
    throw new Error("Orchestrator task error envelope requires errorName")
  }
  if (typeof candidate.message !== "string" || candidate.message.trim().length === 0) {
    throw new Error("Orchestrator task error envelope requires message")
  }
  return {
    errorName: candidate.errorName,
    message: candidate.message,
    data: candidate.data,
  }
}
