import fs from "node:fs"
import { Database } from "bun:sqlite"
const db = new Database("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/stream-reading-294-live-01/runtime/data/opencorvus.db", { readonly: true })
db.exec("BEGIN")
try {
  const rows = db.query("SELECT s.attempt_id,s.request_id,o.id AS outcome_id,o.event_type AS outcome,o.reason,r.time_created AS result_at FROM permission_ledger s LEFT JOIN permission_ledger o ON o.outcome_slot=s.attempt_id LEFT JOIN permission_execution_result r ON r.attempt_id=s.attempt_id WHERE s.event_type='execution_started' ORDER BY s.attempt_id").all() as any[]
  const result = { observedAtUtc: new Date().toISOString(), access: "Original readonly BEGIN/ROLLBACK", rows, contract: "permission/authority.ts completeExecution persists successful result; catch appendEffectOutcome persists execution_failed with original reason and retires effect lease. Failed execution is a terminal outcome, not a successful result." }
  fs.writeFileSync("D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/resize-review-295/final-readiness/permission-terminal.json", JSON.stringify(result, null, 2), { flag: "wx" })
  if (rows.some(row => !row.outcome_id || !(row.outcome === "execution_succeeded" && row.result_at || row.outcome === "execution_failed" && row.reason))) throw Error("Permission terminal contract incomplete")
  console.log(JSON.stringify({ total: rows.length, succeeded: rows.filter(row => row.outcome === "execution_succeeded").length, failed: rows.filter(row => row.outcome === "execution_failed").length, terminal: "qualified" }))
} finally { db.exec("ROLLBACK"); db.close() }
