import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

const values = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith("--") || value === undefined) throw new Error("Expected --root value")
  values.set(key.slice(2), value)
}
const root = values.get("root")
if (!root) throw new Error("--root is required")
const evidenceRoot = path.resolve(root)

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name)
        return entry.isDirectory() ? walk(target) : Promise.resolve([target])
      }),
    )
  ).flat()
}

function hash(bytes: Uint8Array | string) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function redact(value: unknown, state: { replacements: number }): unknown {
  if (typeof value === "string") {
    return value
      .replace(/("tool_token"\s*:\s*")([0-9a-f]{48})(")/gi, (_match, before, _secret, after) => {
        state.replacements++
        return `${before}[REDACTED_EPHEMERAL_TOOL_TOKEN]${after}`
      })
      .replace(/(Bearer\s+)([0-9a-f]{48})\b/gi, (_match, before) => {
        state.replacements++
        return `${before}[REDACTED_EPHEMERAL_TOOL_TOKEN]`
      })
      .replace(/(tool_token.{0,120}?)([0-9a-f]{48})\b/gi, (_match, before) => {
        state.replacements++
        return `${before}[REDACTED_EPHEMERAL_TOOL_TOKEN]`
      })
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, state))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, state)]))
  }
  return value
}

const transcripts = (await walk(evidenceRoot)).filter((file) => path.basename(file) === "opencorvus-transcript.json")
const receipts: Array<Record<string, unknown>> = []
for (const transcript of transcripts) {
  const originalBytes = await fs.readFile(transcript)
  const parsed = JSON.parse(originalBytes.toString("utf8"))
  const state = { replacements: 0 }
  const sanitized = JSON.stringify(redact(parsed, state), null, 2) + "\n"
  if (state.replacements === 0) continue

  const directory = path.dirname(transcript)
  const manifestPath = path.join(directory, "evidence-manifest.json")
  const originalManifestBytes = await fs.readFile(manifestPath)
  const originalManifest = JSON.parse(originalManifestBytes.toString("utf8")) as {
    run_id?: string
    run_key?: string
    files: Array<{ path: string; bytes: number; sha256: string }>
  }
  const originalEntry = originalManifest.files.find((entry) => entry.path === "opencorvus-transcript.json")
  if (!originalEntry || originalEntry.bytes !== originalBytes.byteLength || originalEntry.sha256 !== hash(originalBytes)) {
    throw new Error(`Original transcript does not match its sealed manifest: ${transcript}`)
  }

  const existingNames = await fs.readdir(directory)
  const priorReceipts = existingNames.filter((name) => /^redaction-receipt(?:-\d+)?\.json$/.test(name)).length
  const suffix = priorReceipts === 0 ? "" : `-${priorReceipts + 1}`
  const preRedactionManifestPath = path.join(directory, `pre-redaction-evidence-manifest${suffix}.json`)
  await fs.writeFile(preRedactionManifestPath, originalManifestBytes, { flag: "wx" })
  await fs.writeFile(transcript, sanitized, "utf8")
  const sanitizedBytes = await fs.readFile(transcript)
  const receipt = {
    schema_version: 1,
    run_id: originalManifest.run_id ?? null,
    run_key: originalManifest.run_key ?? null,
    reason: "Remove an expired localhost-only benchmark tool bearer from committed transcript evidence.",
    file: "opencorvus-transcript.json",
    replacements: state.replacements,
    original: { bytes: originalEntry.bytes, sha256: originalEntry.sha256 },
    sanitized: { bytes: sanitizedBytes.byteLength, sha256: hash(sanitizedBytes) },
    original_manifest_sha256: hash(originalManifestBytes),
  }
  await fs.writeFile(path.join(directory, `redaction-receipt${suffix}.json`), JSON.stringify(receipt, null, 2) + "\n", {
    flag: "wx",
  })

  const files = await fs.readdir(directory, { withFileTypes: true })
  const entries = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name !== "evidence-manifest.json")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const file = path.join(directory, entry.name)
        const bytes = await fs.readFile(file)
        return { path: entry.name, bytes: bytes.byteLength, sha256: hash(bytes) }
      }),
  )
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        schema_version: 1,
        run_id: originalManifest.run_id ?? null,
        run_key: originalManifest.run_key ?? null,
        generated_at: Date.now(),
        redacted_from_manifest_sha256: hash(originalManifestBytes),
        files: entries,
      },
      null,
      2,
    ) + "\n",
  )
  receipts.push({ directory: path.relative(evidenceRoot, directory).replaceAll("\\", "/"), ...receipt })
}

process.stdout.write(JSON.stringify({ root: evidenceRoot, sanitized_transcripts: receipts.length, receipts }) + "\n")
