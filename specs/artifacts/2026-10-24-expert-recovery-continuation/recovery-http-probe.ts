import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
const source = process.env.EXPERT_RECOVERY_HTTP_SOURCE
assert(source, "EXPERT_RECOVERY_HTTP_SOURCE names a fresh isolated case containing original/result.json")
const report = JSON.parse(fs.readFileSync(path.join(source, "original/result.json"), "utf8"))
const original = report.original
const expected = process.env.EXPERT_RECOVERY_HTTP_DISPOSITION ?? "committed_revision_changed"
assert(["committed_revision_changed", "commit_receipt_unavailable"].includes(expected))
const journalBytes = fs.readFileSync(path.join(source, "original/after-delete-files/journal.json"), "utf8")
const journal = JSON.parse(journalBytes)
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
const current = await memoryProject("expert-continuation-http-current")
let result: unknown
await Instance.provide({
  directory: current.path,
  fn: async () => {
    const request = (extra: Record<string, string> = {}) =>
      Server.App().request(
        `/expert-squad/mutation-recovery?${new URLSearchParams({ id: original.id, installationScope: "global", ...extra })}`,
        { headers: { "x-opencorvus-directory": current.path } },
      )
    const response = await request()
    assert.equal(response.status, 200)
    const list: any = await response.json()
    const summary = list.entries.find((entry: any) => entry.occurrenceID === journal.operationID)
    assert.deepEqual(
      summary && {
        disposition: summary.disposition,
        preservation: summary.preservation,
        targetEvidence: summary.targetEvidence,
        originalMutationAfter: summary.originalMutationAfter,
      },
      {
        disposition: expected,
        preservation: "complete",
        targetEvidence: "observed_at_preservation",
        originalMutationAfter: "unverified",
      },
    )
    const chunks: Buffer[] = []
    let offset: number | null = 0
    while (offset !== null) {
      const pageResponse = await request({ occurrenceID: journal.operationID, byteOffset: String(offset) })
      assert.equal(pageResponse.status, 200)
      const page: any = await pageResponse.json()
      const bytes = Buffer.from(page.dataBase64, "base64")
      assert(bytes.length <= 4096)
      chunks.push(bytes)
      offset = page.nextByteOffset
    }
    const bytes = Buffer.concat(chunks)
    const occurrence = JSON.parse(bytes.toString("utf8"))
    assert.equal(occurrence.intent.payload.journalText, journalBytes)
    assert.equal(occurrence.terminal.payload.disposition, expected)
    const missing = await request({ occurrenceID: "00000000-0000-4000-8000-000000000000" })
    assert.equal(missing.status, 404)
    const invalid = await request({ byteOffset: "-1" })
    assert.equal(invalid.status, 400)
    const end = await request({ occurrenceID: journal.operationID, byteOffset: String(bytes.length + 1) })
    assert.equal(end.status, 200)
    const endPage: any = await end.json()
    assert.deepEqual({ bytes: endPage.dataBase64, next: endPage.nextByteOffset }, { bytes: "", next: null })
    result = {
      summary,
      publicEntry: "Server.App.request",
      pages: chunks.length,
      totalBytes: bytes.length,
      journalBytesEqual: true,
      missing: 404,
      invalid: 400,
      end: 200,
      currentProject: Instance.project.id,
    }
  },
})
await Instance.disposeAll()
await Database.awaitEffectIdle(60_000)
assert.equal(Database.allFinalized<any>("SELECT count(*) AS n FROM provider_activity_request")[0].n, 0)
Database.close()
fs.writeFileSync(path.join(source, "public-http-result.json"), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
process.exit(0)
