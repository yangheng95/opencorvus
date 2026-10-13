import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { renameNoReplace } from "../packages/opencorvus/src/util/rename-no-replace.ts"

assert.equal(process.platform, "win32")
assert.equal(process.versions.bun, "1.4.0")
const root = path.join(import.meta.dir, "hop-qualification")
const describe = (item: Awaited<ReturnType<typeof fs.lstat>>) => ({ directory: item.isDirectory(), file: item.isFile(), link: item.isSymbolicLink(), dev: String(item.dev), ino: String(item.ino) })
const observed = async (full: string) => {
  assert(path.relative(root, full).split(path.sep)[0] !== "..")
  const record: Record<string, unknown> = { full }
  for (const [name, read] of [["entry", () => fs.lstat(full, { bigint: true }).then(describe)], ["target", () => fs.stat(full, { bigint: true }).then(describe)], ["text", () => fs.readlink(full)], ["realpath", () => fs.realpath(full)]] as const) {
    try { record[name] = { state: "present", value: await read() } }
    catch (error) { record[name] = { state: "error", error: { name: (error as Error).name, code: (error as NodeJS.ErrnoException).code, message: (error as Error).message } } }
  }
  return record
}
const output: Record<string, unknown> = { qualification: "Actual two host access-namespace observations; not File API or UI acceptance", executable: process.execPath, bun: process.versions.bun, root, startedAt: new Date().toISOString(), cases: [] }
await fs.writeFile(path.join(import.meta.dir, "hop-qualification-inputs.json"), JSON.stringify({ ...output, cases: ["dir", "junction"], maximumNativeMoves: 2, modelCalls: "none", originalTool: import.meta.filename }, null, 2), { flag: "wx" })
await fs.mkdir(root)
for (const kind of ["dir", "junction"] as const) {
  const base = path.join(root, kind), project = path.join(base, "project"), context = path.join(project, "context"), data = path.join(project, "data")
  await fs.mkdir(context, { recursive: true })
  await fs.mkdir(data)
  const marker = Buffer.from(`HOST ${kind} original\r\n`)
  await fs.writeFile(path.join(data, "marker.txt"), marker, { flag: "wx" })
  const source = path.join(context, "source-link"), independent = path.join(base, "source-link"), relative = path.join(project, "other-relative"), ancestor = path.join(context, "root-alias")
  await fs.symlink(data, source, "dir")
  await fs.symlink(data, independent, "dir")
  await fs.symlink("../source-link", relative, "dir")
  await fs.symlink(project, ancestor, kind)
  const accessed = path.join(ancestor, "other-relative"), target = path.join(accessed, "moved"), physical = path.join(data, "moved")
  const record: Record<string, unknown> = { kind, source, independent, relative, ancestor, target, physical, before: { source: await observed(source), independent: await observed(independent), relative: await observed(relative), accessed: await observed(accessed) } }
  ;(output.cases as unknown[]).push(record)
  try { await renameNoReplace(source, target); record.native = { outcome: "returned", at: new Date().toISOString() } }
  catch (error) { record.native = { outcome: "rejected", error: { name: (error as Error).name, code: (error as NodeJS.ErrnoException).code, message: (error as Error).message } } }
  record.after = { source: await observed(source), independent: await observed(independent), accessed: await observed(accessed), target: await observed(target), physical: await observed(physical) }
  const bytes = await fs.readFile(path.join(data, "marker.txt"))
  assert.deepEqual(bytes, marker)
  record.marker = { expectedBytesBase64: marker.toString("base64"), actualBytesBase64: bytes.toString("base64") }
}
output.completedAt = new Date().toISOString()
await fs.writeFile(path.join(import.meta.dir, "hop-qualification-results.json"), JSON.stringify(output, null, 2), { flag: "wx" })
console.log(JSON.stringify(output, null, 2))
