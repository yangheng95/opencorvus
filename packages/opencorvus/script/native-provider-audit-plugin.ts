import { RealProviderAudit } from "./real-provider-audit"
import { createAuditSnapshotPublisher } from "./audit-snapshot"

// Explicit isolated-test instrumentation. No request bodies, headers or credentials are retained.
const identity = Symbol.for("opencorvus.native-provider-audit")
type AuditState = { audit: RealProviderAudit; persist: () => void }
const processState = globalThis as typeof globalThis & { [identity]?: AuditState }

export default async function nativeProviderAudit(input: { serverUrl: URL }) {
  if (process.env.OPENCORVUS_NATIVE_REAL_PROVIDER !== "1") throw new Error("Native Provider audit requires explicit real-test opt-in")
  const root = process.env.OPENCORVUS_NATIVE_AUDIT_ROOT
  const model = process.env.OPENCORVUS_NATIVE_AUDIT_MODEL
  if (!root || !model) throw new Error("Native Provider audit requires an owned evidence root and exact model")
  if (!processState[identity]) {
    const publish = createAuditSnapshotPublisher(root, "provider")
    const persist = () => {
      publish({ pid: process.pid, executable: process.execPath, model,
        requests: audit.requests, exhausted: audit.exhausted, observedAt: new Date().toISOString() })
    }
    const audit = new RealProviderAudit(model, Number(process.env.OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS), persist)
    processState[identity] = { audit, persist }
    persist()
  }
  processState[identity]!.audit.localOrigins.add(input.serverUrl.origin)
  return {}
}
