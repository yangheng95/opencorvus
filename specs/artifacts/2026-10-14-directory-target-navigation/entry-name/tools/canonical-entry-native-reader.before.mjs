/** Scratch ABI reader proposal. Koffi is loaded only when explicitly called. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"

export function originalError(error, seen = new Map()) {
  if (typeof error === "bigint") return { type: "bigint", value: String(error) }
  if (error === undefined) return { type: "undefined" }
  if (error === null || typeof error !== "object") return { type: typeof error, value: String(error) }
  if (seen.has(error)) return { reference: seen.get(error) }
  const identity = seen.size + 1
  seen.set(error, identity)
  const properties = {}
  for (const name of Object.getOwnPropertyNames(error)) properties[name] = originalError(error[name], seen)
  return { identity, type: error instanceof Error ? error.name : "Object", properties }
}

export async function createNativeMetadataReader(input, publish) {
  await publish({ type: "reader-stage", stage: "single-koffi-load" })
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
  const library = { packageAnchor: input.packageAnchor, entryPath, physicalEntry: await fs.realpath(entryPath), packagePath, packageVersion: packageInfo.version, nativeVersion: koffi.version, addons }
  await publish({ type: "actual-library", library })
  assert.equal(addons.length, 1, "Exactly one observed loaded native addon is required; do not infer an unobserved path")
  assert.equal(addons[0].exportedVersion, input.koffiVersion)
  assert.ok(addons[0].physicalPath.toLowerCase().includes(`${path.sep}@koromix${path.sep}koffi-win32-x64${path.sep}`), "Observed addon must be the declared installed Windows x64 package")

  await publish({ type: "reader-stage", stage: "fixed-win32-abi" })
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
  await publish({ type: "abi-layout", abi, nativeInput: input.nativeInput })

  function read(operand) {
    const native = { open: null, query: null, close: { status: "not-opened" }, failures: [] }
    let handle
    try {
      handle = create(operand, 0, 7, null, 3, 0x00200000 | 0x02000000, null)
      const openError = lastError()
      native.open = { returnValue: handle, lastError: openError, lastErrorMeaning: invalid(handle) ? "failure-code" : "observed-stale-on-success" }
      if (invalid(handle)) native.failures.push({ kind: "win32", operation: "CreateFileW", win32Error: openError, operand, rawReturn: handle })
      else {
        const info = {}
        const accepted = query(handle, 9, info, 8)
        const queryError = lastError()
        native.query = { returnValue: accepted, lastError: queryError, lastErrorMeaning: accepted ? "observed-stale-on-success" : "failure-code", output: { ...info } }
        if (!accepted) native.failures.push({ kind: "win32", operation: "GetFileInformationByHandleEx", win32Error: queryError, operand, rawReturn: accepted })
      }
    } catch (error) { native.failures.push({ kind: "host-or-ffi", error: originalError(error) }) }
    finally {
      if (!invalid(handle)) {
        try {
          const accepted = close(handle)
          const closeError = lastError()
          native.close = { status: accepted ? "closed" : "failed", returnValue: accepted, lastError: closeError, lastErrorMeaning: accepted ? "observed-stale-on-success" : "failure-code" }
          if (!accepted) native.failures.push({ kind: "win32", operation: "CloseHandle", win32Error: closeError, operand, rawReturn: accepted })
        } catch (error) { native.close = { status: "failed", error: originalError(error) }; native.failures.push({ kind: "close-host-or-ffi", error: originalError(error) }) }
      }
    }
    return native
  }
  return { library, abi, read }
}
