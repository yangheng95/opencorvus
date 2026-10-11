import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { Database } from "bun:sqlite"
import { completedToolOutcomeOutput } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/session/tool-outcome-facts"
const manifest = JSON.parse(await fs.readFile(process.argv[2], "utf8"))
const require = createRequire("D:/myhexin-local/opencorvus/packages/opencorvus/package.json")
const { drizzle } = await import(require.resolve("drizzle-orm/bun-sqlite"))
const db = new Database(path.join(manifest.caseRun, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const row = (db.query("SELECT id,data FROM tool_part_request ORDER BY time_created,id").all() as any[]).find(row => {
    const request = JSON.parse(row.data)
    return request.tool === "webfetch" && request.input.url === "https://www.w3.org/WAI/fundamentals/accessibility-intro/"
  })
  if (!row) throw new Error("Original WAI tool request required")
  const request = JSON.parse(row.data)
  const stored = db.query("SELECT data FROM tool_part_outcome WHERE request_part_id=?").get(row.id) as any
  const outcome = JSON.parse(stored.data)
  if (outcome.outcome !== "completed") throw new Error("Original completed tool outcome required")
  const output = completedToolOutcomeOutput(drizzle({ client:db }) as any, outcome, () => row.id)
  if (typeof output !== "string") throw new Error("Complete output required")
  const input = JSON.stringify(request.input, null, 2)
  await fs.writeFile(path.join(manifest.caseEvidence,"expected-payloads.json"), JSON.stringify({input,output},null,2)+"\n", {flag:"wx"})
  const fact = {requestID:row.id,url:request.input.url,inputChars:input.length,outputChars:output.length,outputBytes:Buffer.byteLength(output),boundary:"Original readonly Tool request and complete production output reader; no clipboard content read by this helper"}
  await fs.writeFile(path.join(manifest.caseEvidence,"expected-identity.json"),JSON.stringify(fact,null,2)+"\n",{flag:"wx"})
  console.log(JSON.stringify(fact))
} finally {db.exec("ROLLBACK");db.close()}
