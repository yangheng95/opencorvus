import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { gzipSync, gunzipSync } from "node:zlib"
import { CredentialRedactor } from "../../../packages/opencorvus/script/real-provider-audit"

const root = import.meta.dir
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
async function files(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : Promise.resolve([path.join(directory, entry.name)]),
    ),
  )
  return nested.flat().sort()
}
const before = await files(root)
const audits = [
  ...new Set(
    before
      .map((file) => {
        const relative = path.relative(root, file).split(path.sep)
        const at = relative.findIndex((part) => part.endsWith("-audit"))
        return at >= 0 ? path.join(root, ...relative.slice(0, at + 1)) : ""
      })
      .filter(Boolean),
  ),
]
const archives = []
for (const audit of audits) {
  const entries = await Promise.all(
    (await files(audit)).map(async (file) => ({
      path: path.relative(audit, file).replaceAll("\\", "/"),
      text: await fs.readFile(file, "utf8"),
    })),
  )
  assert(entries.length > 0)
  for (const entry of entries)
    if (redactor.containsCredential(entry.text)) throw new Error("Audit evidence contains a credential")
  const content = JSON.stringify({ format: "raw-provider-audit-files-v1", files: entries })
  const zipped = gzipSync(content)
  assert.deepEqual(
    JSON.parse(gunzipSync(zipped).toString("utf8")).files,
    entries,
    "Archive preserves every original audit file",
  )
  const target = `${audit}.json.gz`
  await fs.writeFile(target, zipped)
  archives.push({
    path: path.relative(root, target).replaceAll("\\", "/"),
    files: entries.length,
    bytes: zipped.length,
  })
}
for (const file of before.filter((file) => file.endsWith(".log"))) {
  const content = await fs.readFile(file)
  if (redactor.containsCredential(content.toString("utf8"))) throw new Error("Raw log evidence contains a credential")
  const zipped = gzipSync(content)
  assert(gunzipSync(zipped).equals(content), "Log archive retains the exact original bytes")
  await fs.writeFile(`${file}.gz`, zipped)
}
const providerFiles = before.filter((file) => /generation-\d+-provider\.json$/.test(file))
const provider = await Promise.all(
  providerFiles.map(async (file) => ({
    file: path.relative(root, file).replaceAll("\\", "/"),
    data: JSON.parse(await fs.readFile(file, "utf8")),
  })),
)
const requests = provider.flatMap((entry) => entry.data.requests)
assert.equal(requests.length, 24, "Cumulative real requests include the initial failed checker run")
for (const request of requests) {
  assert.equal(request.model, "gpt-6.1-sol")
  assert.equal(request.streaming, true)
  assert.equal(request.status, 200)
}
const successfulRequests = provider
  .filter((entry) => entry.file.startsWith("runtime-2/"))
  .flatMap((entry) => entry.data.requests)
for (const request of successfulRequests)
  assert.equal(request.response_reader.terminal.kind, "eof", "Successful acceptance streams reached real EOF")
const settlement = JSON.parse(await fs.readFile(path.join(root, "runtime-2/settlement.json"), "utf8"))
assert.equal(settlement.credentialPairRemoved, true)
assert(settlement.processes.every((entry: any) => entry.exited))
assert.equal(settlement.totalRequests, 24)
const publishable = (await files(root)).filter(
  (file) =>
    !path
      .relative(root, file)
      .split(path.sep)
      .some((part) => part.endsWith("-audit")) && !file.endsWith(".log"),
)
for (const file of publishable) {
  if (file.endsWith(".jpg")) continue
  const raw = await fs.readFile(file)
  const content = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8")
  if (redactor.containsCredential(content)) throw new Error("Publishable evidence contains a credential")
}
const result = {
  status: "passed",
  realRequests: requests.length,
  successfulStreams: successfulRequests.length,
  model: "gpt-6.1-sol",
  streaming: true,
  archives,
  scannedFiles: publishable.length,
  credentialScan: "passed",
  credentialPairRemoved: true,
  processes: "exited",
  rawEvidence: "Retained locally; only the complete archives are staged",
}
await fs.writeFile(path.join(root, "evidence-package.json"), JSON.stringify(result, null, 2) + "\n")
console.log(
  JSON.stringify({
    status: result.status,
    realRequests: result.realRequests,
    successfulStreams: result.successfulStreams,
    archives: archives.length,
    auditFiles: archives.reduce((sum, archive) => sum + archive.files, 0),
    scannedFiles: result.scannedFiles,
    credentialScan: result.credentialScan,
  }),
)
