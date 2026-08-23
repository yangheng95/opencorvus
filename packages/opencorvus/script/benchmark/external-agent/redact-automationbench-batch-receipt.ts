import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { ProviderError } from "../../../src/provider/error"

const receiptValue = process.argv[2]
if (!receiptValue || process.argv.length !== 3) {
  throw new Error("Usage: bun redact-automationbench-batch-receipt.ts <batch-receipt.json>")
}
const receiptPath = path.resolve(receiptValue)
const fileMatch = /^batch-(\d{2})-([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})-receipt\.json$/.exec(
  path.basename(receiptPath),
)
if (!fileMatch) {
  throw new Error("Redaction target must be one AutomationBench batch receipt")
}
const redactionReceiptPath = receiptPath.replace(/-receipt\.json$/, "-redaction-receipt.json")
await fs.stat(redactionReceiptPath).then(
  () => {
    throw new Error("Batch receipt already has a redaction chain")
  },
  (error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error
  },
)
const before = await fs.readFile(receiptPath)
const receipt = JSON.parse(before.toString("utf8")) as Record<string, any>
if (receipt.batch_run_id !== fileMatch[2] || Number(receipt.batch_index) !== Number(fileMatch[1])) {
  throw new Error("Batch receipt filename and durable batch identity do not match")
}
let changed = 0
for (const waveName of ["wave_1", "wave_2"]) {
  const launched = receipt[waveName]?.launched
  if (!Array.isArray(launched)) continue
  for (const item of launched) {
    if (typeof item?.stderr_tail !== "string") continue
    const safe = ProviderError.redactSensitiveProviderText(item.stderr_tail)
    if (safe !== item.stderr_tail) changed++
    item.stderr_tail = safe
  }
}
if (changed === 0) throw new Error("Batch receipt contained no labelled Provider diagnostic secret")
const after = Buffer.from(JSON.stringify(receipt, null, 2) + "\n")
const sha256 = (bytes: Uint8Array) => crypto.createHash("sha256").update(bytes).digest("hex")
const redactionReceipt = {
  schema_version: 1,
  kind: "automationbench_batch_receipt_secret_redaction",
  target: path.basename(receiptPath),
  created_at: Date.now(),
  reason: "provider_response_header_diagnostic_disclosure",
  redacted_labels: ["set-cookie", "x-codex-turn-state"],
  changed_stderr_tails: changed,
  before_sha256: sha256(before),
  after_sha256: sha256(after),
}
const temporary = path.join(path.dirname(receiptPath), `.${path.basename(receiptPath)}.${crypto.randomUUID()}.tmp`)
await fs.writeFile(temporary, after, { mode: 0o600 })
await fs.writeFile(redactionReceiptPath, JSON.stringify(redactionReceipt, null, 2) + "\n", {
  encoding: "utf8",
  flag: "wx",
})
await fs.rename(temporary, receiptPath)
process.stdout.write(JSON.stringify({ receipt: receiptPath, redaction_receipt: redactionReceiptPath, changed }) + "\n")
