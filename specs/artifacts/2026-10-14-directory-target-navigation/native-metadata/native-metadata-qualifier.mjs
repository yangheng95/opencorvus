/** PREPARED ONLY. Root separately authorizes Node and Bun; the qualifier writes only stdout. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const ownDirectory = path.dirname(fileURLToPath(import.meta.url))
const inputsPath = path.join(ownDirectory, "native-metadata-qualifier.inputs.json")
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
const errorFact = (error, seen = new Map()) => {
  if (typeof error === "bigint") return { type: "bigint", value: String(error) }
  if (error === undefined) return { type: "undefined" }
  if (error === null || typeof error !== "object") return { type: typeof error, value: String(error) }
  if (seen.has(error)) return { reference: seen.get(error) }
  const identity = seen.size + 1
  seen.set(error, identity)
  const properties = {}
  for (const name of Object.getOwnPropertyNames(error)) properties[name] = errorFact(error[name], seen)
  return { identity, type: error instanceof Error ? error.name : "Object", properties }
}
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

  stage = "single-koffi-load"
  const packageRequire = createRequire(input.packageAnchor)
  const entryPath = packageRequire.resolve("koffi")
  const packagePath = path.join(path.dirname(entryPath), "package.json")
  const packageInfo = JSON.parse(await fs.readFile(packagePath, "utf8"))
  assert.equal(packageInfo.version, input.koffiVersion)
  const koffi = packageRequire("koffi")
  assert.equal(koffi.version, input.koffiVersion)
  const nativeModules = Object.values(packageRequire.cache).filter((item) => item?.filename?.endsWith(".node"))
  const addons = []
  for (const item of nativeModules) addons.push({ cacheFilename: item.filename, physicalPath: await fs.realpath(item.filename), loaded: item.loaded, exportedVersion: item.exports?.version })
  output.library = { packageAnchor: input.packageAnchor, entryPath, physicalEntry: await fs.realpath(entryPath), packagePath, packageVersion: packageInfo.version, nativeVersion: koffi.version, addons }
  await emit({ type: "actual-library", library: output.library })
  assert.equal(addons.length, 1, "Exactly one observed loaded native addon is required; do not infer an unobserved path")
  assert.equal(addons[0].exportedVersion, input.koffiVersion)
  assert.ok(addons[0].physicalPath.toLowerCase().includes(`${path.sep}@koromix${path.sep}koffi-win32-x64${path.sep}`), "Observed addon must be the declared installed Windows x64 package")

  stage = "fixed-win32-abi"
  const kernel = koffi.load("kernel32.dll")
  const HANDLE = koffi.pointer("DIRECTORY_TARGET_METADATA_HANDLE", koffi.opaque())
  const TAG_INFO = koffi.struct("DIRECTORY_TARGET_FILE_ATTRIBUTE_TAG_INFO", { FileAttributes: "uint32_t", ReparseTag: "uint32_t" })
  const abi = { handleBytes: koffi.sizeof(HANDLE), bufferSize: koffi.sizeof(TAG_INFO), fields: { FileAttributes: koffi.offsetof(TAG_INFO, "FileAttributes"), ReparseTag: koffi.offsetof(TAG_INFO, "ReparseTag") } }
  assert.deepEqual(abi, { handleBytes: 8, bufferSize: 8, fields: { FileAttributes: 0, ReparseTag: 4 } })
  const create = kernel.func("DIRECTORY_TARGET_METADATA_HANDLE __stdcall CreateFileW(const char16_t *lpFileName, uint32_t dwDesiredAccess, uint32_t dwShareMode, void *lpSecurityAttributes, uint32_t dwCreationDisposition, uint32_t dwFlagsAndAttributes, void *hTemplateFile)")
  const query = kernel.func("int __stdcall GetFileInformationByHandleEx(DIRECTORY_TARGET_METADATA_HANDLE hFile, int FileInformationClass, _Out_ DIRECTORY_TARGET_FILE_ATTRIBUTE_TAG_INFO *lpFileInformation, uint32_t dwBufferSize)")
  const lastError = kernel.func("uint32_t __stdcall GetLastError()")
  const close = kernel.func("int __stdcall CloseHandle(DIRECTORY_TARGET_METADATA_HANDLE hObject)")
  const INVALID = (1n << 64n) - 1n
  const invalid = (handle) => handle === null || handle === undefined || (typeof handle === "bigint" && BigInt.asUintN(64, handle) === INVALID)
  output.abi = abi
  await emit({ type: "abi-layout", abi, nativeInput: input.nativeInput })

  for (const item of paths) {
    stage = `observe:${item.id}`
    const record = { id: item.id, operand: item.operand, pair: item.pair, trailing: Boolean(item.trailing), native: { open: null, query: null, close: { status: "not-opened" }, failures: [] } }
    const native = record.native
    record.lstatBefore = await observe("lstat-bigint", item.operand, () => fs.lstat(item.operand, { bigint: true }).then(fullStat))
    record.stat = await observe("stat-bigint", item.operand, () => fs.stat(item.operand, { bigint: true }).then(fullStat))
    record.readlink = await observe("readlink", item.operand, () => fs.readlink(item.operand))
    record.realpath = await observe("realpath", item.operand, () => fs.realpath(item.operand))
    let handle
    try {
      handle = create(item.operand, 0, 7, null, 3, 0x00200000 | 0x02000000, null)
      const openError = lastError() // Immediate, synchronous same-thread capture; no await/other native call intervenes.
      native.open = { returnValue: handle, lastError: openError, lastErrorMeaning: invalid(handle) ? "failure-code" : "observed-stale-on-success" }
      if (invalid(handle)) native.failures.push({ kind: "win32", operation: "CreateFileW", win32Error: openError, operand: item.operand, rawReturn: handle })
      else {
        const info = {}
        const accepted = query(handle, 9, info, 8)
        const queryError = lastError()
        native.query = { returnValue: accepted, lastError: queryError, lastErrorMeaning: accepted ? "observed-stale-on-success" : "failure-code", output: { ...info } }
        if (!accepted) native.failures.push({ kind: "win32", operation: "GetFileInformationByHandleEx", win32Error: queryError, operand: item.operand, rawReturn: accepted })
      }
    } catch (error) { native.failures.push({ kind: "host-or-ffi", error: errorFact(error) }) }
    finally {
      if (!invalid(handle)) {
        try {
          const accepted = close(handle)
          const closeError = lastError()
          native.close = { status: accepted ? "closed" : "failed", returnValue: accepted, lastError: closeError, lastErrorMeaning: accepted ? "observed-stale-on-success" : "failure-code" }
          if (!accepted) native.failures.push({ kind: "win32", operation: "CloseHandle", win32Error: closeError, operand: item.operand, rawReturn: accepted })
        } catch (error) { native.close = { status: "failed", error: errorFact(error) }; native.failures.push({ kind: "close-host-or-ffi", error: errorFact(error) }) }
      }
    }
    record.lstatAfter = await observe("lstat-bigint", item.operand, () => fs.lstat(item.operand, { bigint: true }).then(fullStat))
    record.firstCause = native.failures[0] ?? null
    const stable = identity(record.lstatBefore) !== null && stringify(identity(record.lstatBefore)) === stringify(identity(record.lstatAfter))
    const values = native.query?.output
    const validFields = values && [values.FileAttributes, values.ReparseTag].every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff)
    if (values && validFields) record.metadata = { ...values, FileAttributesHex: `0x${values.FileAttributes.toString(16).padStart(8, "0")}`, ReparseTagHex: `0x${values.ReparseTag.toString(16).padStart(8, "0")}` }
    if (item.expectedOpenWin32Error !== undefined) record.contract = { kind: "declared-missing-open-error", expectedWin32Error: item.expectedOpenWin32Error,
      passed: native.failures.length === 1 && native.failures[0].operation === "CreateFileW" && native.failures[0].win32Error === item.expectedOpenWin32Error && record.lstatBefore.code === "ENOENT" && record.lstatAfter.code === "ENOENT" }
    else record.contract = { kind: "same-entry-native-metadata-and-close", entryIdentityStable: stable,
      passed: Boolean(stable && native.failures.length === 0 && typeof handle === "bigint" && validFields && native.close.status === "closed") }
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
