import fs from "node:fs/promises"
import { Database } from "bun:sqlite"
const root = "D:/myhexin-local/opencorvus"
process.env.OPENCORVUS_HOME = `${root}/.tmp-product-iteration/tool-caption-284/audit-runtime`
const { projectConversationTransportPart } = await import(`${root}/packages/opencorvus/src/conversation/transport.ts`)
const canonical = JSON.parse(await fs.readFile(`${root}/specs/artifacts/2026-10-05-connection-workspace-authority/source-provenance-283/live-01/canonical-current-conversations.json`, "utf8"))
const db = new Database("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/source-provenance-283-live-01/runtime/data/opencorvus.db", { readonly: true })
const records: unknown[] = []
try {
  db.exec("BEGIN")
  for (const row of db.query("SELECT id,data FROM tool_part_request ORDER BY time_created,id").all() as any[]) {
    const request = JSON.parse(row.data)
    const stored = db.query("SELECT data FROM tool_part_outcome WHERE request_part_id = ?").get(row.id) as any
    const outcome = JSON.parse(stored.data)
    const archived = canonical.outcomes.find((item: any) => item.requestPartID === row.id)
    if (outcome.outcome !== "completed" || archived?.outcome !== "completed") throw new Error("Actual completed outcome required")
    const part = { ...request, type: "tool", state: { status: "completed", input: request.input, output: archived.output, title: outcome.title, metadata: outcome.metadata, time: outcome.time } }
    const projected: any = projectConversationTransportPart(part as any)
    records.push({ requestID: row.id, input: request.input, originalTitle: outcome.title, originalTitleJSONBytes: Buffer.byteLength(JSON.stringify(outcome.title)), projectedTitle: projected.state.title, projectedTitleJSONBytes: Buffer.byteLength(JSON.stringify(projected.state.title)), projectedStateJSONBytes: Buffer.byteLength(JSON.stringify(projected.state)), projectedInput: projected.state.input, outputBytes: Buffer.byteLength(archived.output), boundary: "Original readonly request/outcome rows and retained canonical output reassembled only for the production transport projection; no SQL writes, UI assertions or synthesized runtime message" })
  }
} finally { db.exec("ROLLBACK"); db.close() }
const output = process.argv[2]
if (!output) throw new Error("Output path required")
await fs.writeFile(output, JSON.stringify(records,null,2)+"\n", {flag:"wx"})
console.log(JSON.stringify(records.map((record:any)=>({requestID:record.requestID, originalTitleJSONBytes:record.originalTitleJSONBytes, projectedTitle:record.projectedTitle, projectedTitleJSONBytes:record.projectedTitleJSONBytes}))))
