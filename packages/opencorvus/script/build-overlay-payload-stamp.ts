import { createHash } from "crypto"
import fs from "fs"
import { availableParallelism } from "node:os"
import path from "path"

export const OVERLAY_PAYLOAD_STAMP_FILE = ".opencorvus-overlay-payload.stamp"

async function collectOverlayPayloadFiles(root: string): Promise<string[]> {
  const files: string[] = []

  async function visit(current: string) {
    const entries = await fs.promises.readdir(current, { withFileTypes: true })
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      const absolute = path.join(current, entry.name)
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/")
      if (relative === OVERLAY_PAYLOAD_STAMP_FILE) continue
      if (entry.isDirectory()) {
        await visit(absolute)
      } else if (entry.isFile()) {
        files.push(relative)
      }
    }
  }

  await visit(root)
  return files
}

export async function writeOverlayPayloadStamp(outdir: string) {
  const files = await collectOverlayPayloadFiles(outdir)
  const hash = createHash("sha256")
  let bytes = 0
  const concurrency = availableParallelism()
  const pending = new Map<
    number,
    Promise<{
      executable: boolean
      payload: Buffer
    }>
  >()

  const schedule = (index: number) => {
    const file = files[index]
    if (!file) return
    const absolute = path.join(outdir, ...file.split("/"))
    pending.set(
      index,
      Promise.all([fs.promises.readFile(absolute), fs.promises.stat(absolute)]).then(([payload, stat]) => ({
        executable: (stat.mode & 0o111) !== 0,
        payload,
      })),
    )
  }

  for (let index = 0; index < Math.min(concurrency, files.length); index++) schedule(index)

  for (let index = 0; index < files.length; index++) {
    const file = files[index]!
    const result = await pending.get(index)!
    pending.delete(index)
    schedule(index + concurrency)
    const { executable, payload } = result
    bytes += payload.byteLength
    hash.update(file)
    hash.update("\0")
    hash.update(String(payload.byteLength))
    hash.update("\0")
    hash.update(executable ? "x" : "-")
    hash.update("\0")
    hash.update(payload)
    hash.update("\0")
  }

  const stampPath = path.join(outdir, OVERLAY_PAYLOAD_STAMP_FILE)
  await fs.promises.writeFile(
    stampPath,
    `${JSON.stringify(
      {
        version: 2,
        files: files.length,
        bytes,
        sha256: hash.digest("hex"),
      },
      null,
      2,
    )}\n`,
    { mode: 0o644 },
  )
  if (process.platform !== "win32") await fs.promises.chmod(stampPath, 0o644)
}
