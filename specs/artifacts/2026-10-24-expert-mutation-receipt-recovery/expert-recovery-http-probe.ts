import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
const source = process.env.EXPERT_HTTP_SOURCE_DIRECTORY ?? path.join(import.meta.dir, "expert-v7-deleted-preserved-2")
const report = JSON.parse(fs.readFileSync(path.join(source, "result.json"), "utf8"))
const original = report.original
const upgraded = JSON.parse(
  fs.readFileSync(
    path.join(
      process.env.EXPERT_HTTP_UPGRADE_DIRECTORY ?? path.join(import.meta.dir, "expert-upgrade-deleted"),
      "result.json",
    ),
    "utf8",
  ),
)
const { isolatedTestChildEnvironment } = await import("../../../packages/util/src/test-runtime-environment")
Object.assign(process.env, isolatedTestChildEnvironment(report.runtime))
process.env.OPENCORVUS_HOME = report.runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = report.runtime.processRoot
for (const key of Object.keys(process.env))
  if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
const { memoryProject } = await import("../../../packages/opencorvus/test/fixture/memory")
const { Instance } = await import("@/project/instance")
const { Server } = await import("@/server/server")
const { Database } = await import("@/storage/db")
const current = await memoryProject("http-read-global-deleted-source-preservation")
let result: any
await Instance.provide({
  directory: current.path,
  fn: async () => {
    assert.notEqual(Instance.project.id, original.projectID)
    const request = async (extra: Record<string, string> = {}) => {
      const query = new URLSearchParams({ id: original.id, installationScope: "global", ...extra })
      return Server.App().request(`/expert-squad/mutation-recovery?${query}`, {
        headers: { "x-opencorvus-directory": current.path },
      })
    }
    const response = await request()
    assert.equal(response.status, 200)
    const list: any = await response.json()
    assert.deepEqual(
      list.entries.map((row: any) => ({ disposition: row.disposition, preservation: row.preservation })),
      [{ disposition: "commit_receipt_unavailable", preservation: "complete" }],
    )
    let offset: number | undefined = 0,
      totalBytes = 0,
      pages = 0
    const chunks: Buffer[] = []
    while (offset !== undefined) {
      const response = await request({ occurrenceID: upgraded.outcome.occurrenceID, byteOffset: String(offset) })
      assert.equal(response.status, 200)
      const body: any = await response.json()
      totalBytes = body.totalBytes
      pages++
      const chunk = Buffer.from(body.dataBase64, "base64")
      assert(chunk.length <= 4096)
      chunks.push(chunk)
      offset = body.nextByteOffset ?? undefined
    }
    const bytes = Buffer.concat(chunks)
    assert.equal(bytes.length, totalBytes)
    const preservation = JSON.parse(bytes.toString("utf8"))
    assert.equal(
      preservation.intent.payload.journalText,
      fs.readFileSync(path.join(source, "after-delete-files", "journal.json"), "utf8"),
    )
    const missing = await request({ occurrenceID: "00000000-0000-4000-8000-000000000000" })
    assert.equal(missing.status, 404)
    const missingBody = await missing.json()
    const end = await request({ occurrenceID: upgraded.outcome.occurrenceID, byteOffset: String(totalBytes + 100) })
    assert.equal(end.status, 200)
    const endBody: any = await end.json()
    assert.deepEqual(
      { dataBase64: endBody.dataBase64, nextByteOffset: endBody.nextByteOffset },
      { dataBase64: "", nextByteOffset: null },
    )
    const invalid = await request({ byteOffset: "-1" })
    assert.equal(invalid.status, 400)
    result = {
      sourceProjectDeleted: original.projectID,
      currentProject: Instance.project.id,
      actualEntry: "Server.App.request GET /expert-squad/mutation-recovery",
      list,
      pages,
      totalBytes,
      journalBytesEqualOriginal: true,
      missing: { status: missing.status, body: missingBody },
      end: { status: end.status, body: endBody },
      invalid: invalid.status,
    }
  },
})
await Instance.disposeAll()
await Database.awaitEffectIdle(60_000)
Database.close()
fs.writeFileSync(path.join(import.meta.dir, "expert-recovery-http-result.json"), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
process.exit(0)
