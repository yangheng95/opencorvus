import fs from "node:fs/promises"
import path from "node:path"

const root = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/directory-target-before-01a133/project"
const records = []
for (const name of ["junction-dir", "absolute-dir-link", "root-link"]) {
  for (const suffix of ["", path.sep]) {
    const full = path.join(root, name) + suffix
    const entry = await fs.lstat(full, { bigint: true })
    const parent = await fs.realpath(path.dirname(full))
    const address = path.join(parent, path.basename(full))
    const addressed = await fs.lstat(address, { bigint: true })
    const describe = (value: typeof entry) => ({ directory: value.isDirectory(), link: value.isSymbolicLink(), dev: String(value.dev), ino: String(value.ino) })
    records.push({ name, suffix, full, parent, address, entry: describe(entry), addressed: describe(addressed) })
  }
}
const record = { qualification: "Read-only actual trailing-separator entry identity; no mutation, API or UI acceptance", executable: process.execPath, bun: process.versions.bun, at: new Date().toISOString(), records }
await fs.writeFile(path.join(import.meta.dir, "trailing-observation.json"), JSON.stringify(record, null, 2), { flag: "wx" })
console.log(JSON.stringify(record, null, 2))
