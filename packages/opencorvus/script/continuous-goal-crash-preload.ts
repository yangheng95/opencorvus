import fs from "node:fs"
import path from "node:path"
import { RealProviderAudit, CredentialRedactor, assertCopiedOAuthAccess } from "./real-provider-audit"
import { createAuditSnapshotPublisher } from "./audit-snapshot"

// Observation only: the formal serve command owns all admission and recovery.
if (process.env.GOAL_CRASH_ALLOW_REAL_PROVIDER !== "1") throw new Error("Real Provider crash audit requires opt-in")
const root = process.env.GOAL_CRASH_AUDIT_ROOT!
const model = process.env.GOAL_CRASH_MODEL!.split("/").slice(1).join("/")
const providerID = process.env.GOAL_CRASH_MODEL!.split("/")[0]!
const limit = Number(process.env.GOAL_CRASH_REMAINING_REQUESTS)
if (!root || !model || !Number.isSafeInteger(limit) || limit < 0) throw new Error("Missing crash audit contract")
const credentialFile = JSON.parse(fs.readFileSync(path.join(process.env.OPENCORVUS_HOME!, "data", "auth.json"), "utf8"))
const credential = credentialFile[providerID].info
const redactor = new CredentialRedactor()
redactor.collect(credentialFile)
const authority = credential.type === "oauth" ? { copiedOAuthExpiresAt: credential.expires } : undefined
if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
const publish = createAuditSnapshotPublisher(root, "provider")
let signature = ""
const persist = () => {
  if (process.env.OPENCORVUS_SERVER_URL) audit.localOrigins.add(new URL(process.env.OPENCORVUS_SERVER_URL).origin)
  const next = redactor.redact(JSON.stringify({ requests: audit.requests, exhausted: audit.exhausted }))
  if (next === signature) return
  signature = next
  publish({ pid: process.pid, remainingRequests: limit, observedAt: Date.now(), ...JSON.parse(next) })
}
const audit = new RealProviderAudit(model, limit, persist, authority)
persist()
setInterval(persist, 100).unref()
process.on("exit", persist)
