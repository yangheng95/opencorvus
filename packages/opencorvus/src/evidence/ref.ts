import z from "zod"

const DURABLE_EVIDENCE_REF_NAMESPACES = new Set([
  "browser_preview_evidence",
  "build_host_observation",
  "decision_log",
  "deep_research",
  "frontend_design",
  "frontend_research",
  "integrity_review",
  "visual_qa",
])

export function isDurableEvidenceRef(value: string): boolean {
  const ref = value.trim()
  if (!ref) return false
  if (isAttachmentStoreURL(ref)) return true
  const match = /^([a-z][a-z0-9_-]*):(.+)$/i.exec(ref)
  if (!match) return false
  const namespace = match[1]?.toLowerCase()
  const payload = match[2]?.trim()
  if (!namespace || !payload) return false
  if (!DURABLE_EVIDENCE_REF_NAMESPACES.has(namespace)) return false
  return !isRawPathOrURLProtocol(namespace, payload)
}

export const DurableEvidenceRefSchema = z.string().min(1).refine(isDurableEvidenceRef, {
  message:
    "evidence refs must use a durable OpenCorvus evidence namespace or AttachmentStore URL; bare paths, file URLs, command text, and screenshot:// local labels are not portable report refs.",
})

function isAttachmentStoreURL(ref: string): boolean {
  return /^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/.test(ref)
}

function isRawPathOrURLProtocol(namespace: string, payload: string): boolean {
  if (namespace === "file" || namespace === "http" || namespace === "https" || namespace === "screenshot") return true
  return /^[A-Za-z]:[\\/]/.test(payload) || payload.startsWith("/") || payload.startsWith("\\")
}
