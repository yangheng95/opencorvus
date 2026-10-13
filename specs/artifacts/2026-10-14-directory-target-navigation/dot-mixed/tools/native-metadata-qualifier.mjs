/** REVIEW PROPOSAL ONLY. Do not run the prior 20 operands again. Root may replace the original with this shared-reader consumer after review. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createNativeMetadataReader, originalError as errorFact } from "./native-metadata-reader.mjs"
import { fileURLToPath } from "node:url"

const ownDirectory = path.dirname(fileURLToPath(import.meta.url))
const inputsPath = path.join(ownDirectory, "native-metadata-qualifier.inputs.json")
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
const stringify = (value) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? { type: "bigint", value: String(item) } : item)
const emit = (value) => new Promise((resolve, reject) => {
  process.stdout.write(stringify(value) + "\n", (error) => error ? reject(error) : resolve())
})
const fullStat = (value) => ({
  fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "bigint" ? String(item) : item instanceof Date ? item.toISOString() : item])),
  isFile: value.isFile(), isDirectory: value.isDirectory(), isSymbolicLink: value.isSymbolicLink(),
  isBlockDevice: value.isBlockDevice(), isCharacterDevice: value.isCharacterDevice(), isFIFO: value.isFIFO(), isSocket: value.isSocket(),
})
async function observe(operation, operand, read) {
  try { return { operation, operand, status: "fulfilled", value: await read() } }
  catch (error) { return { operation, operand, status: "rejected", error: errorFact(error), code: error?.code } }
}
const identity = (record) => record.status === "fulfilled" ? {
  dev: record.value.fields.dev, ino: record.value.fields.ino, birthtimeNs: record.value.fields.birthtimeNs,
  isFile: record.value.isFile, isDirectory: record.value.isDirectory, isSymbolicLink: record.value.isSymbolicLink,
} : null

let stage = "input"
const output = { schema: "directory-target-native-metadata-result/v1", startedAt: new Date().toISOString(),
  executable: process.execPath, versions: { ...process.versions }, platform: process.platform, architecture: process.arch,
  qualification: "Read-only installed Koffi library/Win32 ABI facts only; no production-runtime loader, File API, mutation or UI acceptance", records: [] }
try {
  assert.equal(process.argv.length, 4)
  assert.equal(process.argv[2], "--host")
  const host = process.argv[3]
  assert.ok(host === "node" || host === "bun")
  const input = JSON.parse(await fs.readFile(inputsPath, "utf8"))
  assert.equal(input.schema, "directory-target-native-metadata-qualification/v1")
  assert.equal(input.maximumItems, 20)
  assert.equal(input.paths.length, input.maximumItems)
  assert.equal(process.platform, input.platform)
  assert.equal(process.arch, input.architecture)
  assert.ok(samePath(process.execPath, input.runtimes[host].executable))
  if (host === "bun") assert.equal(process.versions.bun, input.runtimes.bun.bunVersion)
  else assert.equal(process.versions.node, input.runtimes.node.nodeVersion)
  const manifest = JSON.parse(await fs.readFile(input.fixtureManifest, "utf8"))
  const hop = JSON.parse(await fs.readFile(input.hopFacts, "utf8"))
  assert.equal(manifest.fixtureID, input.fixtureID)
  assert.ok(samePath(manifest.scopes.root.directory, input.roots.a))
  assert.ok(samePath(manifest.scopes.b.directory, input.roots.b))
  for (const kind of ["dir", "junction"]) {
    const original = hop.cases.find((item) => item.kind === kind)
    assert.ok(original && samePath(original.ancestor, path.join(input.roots[`hop-${kind}`], "project/context/root-alias")))
  }
  const paths = input.paths.map((item) => {
    assert.ok(Object.hasOwn(input.roots, item.root))
    assert.ok(!path.isAbsolute(item.relative) && !item.relative.split(/[\\/]/).includes(".."))
    // Retain the explicitly declared trailing separator in every actual filesystem/Win32 operand.
    return { ...item, operand: path.join(input.roots[item.root], item.relative) + (item.trailing ? "\\" : "") }
  })
  output.input = { ...input, paths }
  output.host = host
  await emit({ type: "original-input", ...output, records: undefined })
  for (const [name, root] of Object.entries(input.roots)) {
    const entry = await fs.lstat(root, { bigint: true })
    assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), `Declared owned root is not a direct directory: ${name}`)
    assert.ok(samePath(await fs.realpath(root), root))
  }

  const reader = await createNativeMetadataReader(input, async (fact) => {
    if (fact.type === "reader-stage") stage = fact.stage
    if (fact.type === "actual-library") output.library = fact.library
    if (fact.type === "abi-layout") output.abi = fact.abi
    await emit(fact)
  })

  for (const item of paths) {
    stage = `observe:${item.id}`
    const record = { id: item.id, operand: item.operand, pair: item.pair, trailing: Boolean(item.trailing), native: { open: null, query: null, close: { status: "not-opened" }, failures: [] } }
    const native = record.native
    record.lstatBefore = await observe("lstat-bigint", item.operand, () => fs.lstat(item.operand, { bigint: true }).then(fullStat))
    record.stat = await observe("stat-bigint", item.operand, () => fs.stat(item.operand, { bigint: true }).then(fullStat))
    record.readlink = await observe("readlink", item.operand, () => fs.readlink(item.operand))
    record.realpath = await observe("realpath", item.operand, () => fs.realpath(item.operand))
    Object.assign(native, reader.read(item.operand))
    record.lstatAfter = await observe("lstat-bigint", item.operand, () => fs.lstat(item.operand, { bigint: true }).then(fullStat))
    record.firstCause = native.failures[0] ?? null
    const stable = identity(record.lstatBefore) !== null && stringify(identity(record.lstatBefore)) === stringify(identity(record.lstatAfter))
    const values = native.query?.output
    const validFields = values && [values.FileAttributes, values.ReparseTag].every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff)
    if (values && validFields) record.metadata = { ...values, FileAttributesHex: `0x${values.FileAttributes.toString(16).padStart(8, "0")}`, ReparseTagHex: `0x${values.ReparseTag.toString(16).padStart(8, "0")}` }
    if (item.expectedOpenWin32Error !== undefined) record.contract = { kind: "declared-missing-open-error", expectedWin32Error: item.expectedOpenWin32Error,
      passed: native.failures.length === 1 && native.failures[0].operation === "CreateFileW" && native.failures[0].win32Error === item.expectedOpenWin32Error && record.lstatBefore.code === "ENOENT" && record.lstatAfter.code === "ENOENT" }
    else record.contract = { kind: "same-entry-native-metadata-and-close", entryIdentityStable: stable,
      passed: Boolean(stable && native.failures.length === 0 && typeof native.open?.returnValue === "bigint" && validFields && native.close.status === "closed") }
    output.records.push(record)
    await emit({ type: "original-observation", record })
    if (!record.contract.passed) { output.outcome = "unexpected-original-result-retained"; process.exitCode = 1; break }
  }
  output.completedAt = new Date().toISOString()
  output.outcome ??= "fixed-readonly-metadata-abi-contracts-collected"
  await emit({ type: "complete", outcome: output.outcome, attemptedItems: output.records.length, plannedItems: input.paths.length, exitCode: process.exitCode ?? 0, completedAt: output.completedAt,
    qualification: "Actual tag values remain observed fields, not path-name guesses; no production loader/File API/UI/mutation acceptance" })
} catch (error) {
  process.exitCode = 1
  await emit({ type: "first-unexpected-error", stage, error: errorFact(error), attemptedItems: output.records.length, input: output.input, library: output.library, abi: output.abi,
    qualification: output.qualification, failedAt: new Date().toISOString() })
}
