import { RealProviderAudit, installProcessProviderAudit } from "./real-provider-audit"
import { createAuditSnapshotPublisher } from "./audit-snapshot"

// Explicit isolated-test instrumentation. No request bodies, headers or credentials are retained.

export default async function nativeProviderAudit(input: { serverUrl: URL }) {
  if (process.env.OPENCORVUS_NATIVE_REAL_PROVIDER !== "1") throw new Error("Native Provider audit requires explicit real-test opt-in")
  const root = process.env.OPENCORVUS_NATIVE_AUDIT_ROOT
  const model = process.env.OPENCORVUS_NATIVE_AUDIT_MODEL
  if (!root || !model) throw new Error("Native Provider audit requires an owned evidence root and exact model")
  const state = installProcessProviderAudit(() => {
    const publish = createAuditSnapshotPublisher(root, "provider")
    const persist = () => {
      publish({ pid: process.pid, executable: process.execPath, model,
        requests: audit.requests, exhausted: audit.exhausted, observedAt: new Date().toISOString() })
    }
    const ceiling = process.env.OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS
    if (ceiling === undefined) throw new Error("Native Provider audit requires an explicit request ceiling or null")
    const expires = process.env.OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES
    const audit = new RealProviderAudit(model, JSON.parse(ceiling), persist,
      expires === undefined ? undefined : { copiedOAuthExpiresAt: Number(expires) })
    persist()
    return { audit, persist }
  })
  if (state.audit.modelID !== model) throw new Error("Native Provider audit model conflicts with its process identity")
  state.audit.localOrigins.add(input.serverUrl.origin)
  return {}
}
