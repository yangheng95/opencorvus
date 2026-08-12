import { inspectPptxPackageUnsafe } from "./presentation"

if (process.env.OPENCORVUS_INTERNAL_WORK_ARTIFACT_INSPECTOR !== "1") {
  throw new Error("Work Artifact inspector process requires internal authority")
}

const chunks: Buffer[] = []
let bytes = 0
for await (const chunk of process.stdin) {
  const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
  bytes += value.byteLength
  if (bytes > 80 * 1024 * 1024) throw new Error("PPTX inspector input exceeds 83886080 bytes")
  chunks.push(value)
}
try {
  process.stdout.write(`${JSON.stringify({ ok: true, value: await inspectPptxPackageUnsafe(Buffer.concat(chunks, bytes)) })}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`)
}
