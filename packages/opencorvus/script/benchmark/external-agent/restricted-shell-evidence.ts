import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

function sha256(bytes: Uint8Array) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

export async function verifyAutomationBenchRestrictedShells(input: {
  base: string
  extended: string
  sourceDirectory: string
}) {
  const [baseBytes, extendedBytes, expectedBaseBytes, expectedExtendedBytes, baseStat, extendedStat] =
    await Promise.all([
      fs.readFile(input.base),
      fs.readFile(input.extended),
      fs.readFile(path.join(input.sourceDirectory, "restricted-agent-shell-base.sh")),
      fs.readFile(path.join(input.sourceDirectory, "restricted-agent-shell.sh")),
      fs.stat(input.base),
      fs.stat(input.extended),
    ])
  const passed =
    sha256(baseBytes) === sha256(expectedBaseBytes) &&
    sha256(extendedBytes) === sha256(expectedExtendedBytes) &&
    [baseStat, extendedStat].every((stat) => stat.uid === 0 && (stat.mode & 0o022) === 0 && stat.isFile())
  if (!passed) throw new Error("Benchmark requires both frozen root-owned restricted Agent shells")
  return { base_sha256: sha256(baseBytes), extended_sha256: sha256(extendedBytes) }
}
