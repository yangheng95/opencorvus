import fs from "node:fs/promises"
import type { BigIntStats } from "node:fs"
import path from "node:path"
import { requireRuntimePackage } from "@/runtime/package-require"

export type FileEntry = {
  address: string
  stat: BigIntStats
  // The creation type preserves the entry; it does not describe its target.
  link: "file" | "dir" | "junction" | undefined
  shortName?: string
}

function sameIdentity(left: BigIntStats, right: BigIntStats) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    (left.mode & 0o170000n) === (right.mode & 0o170000n)
  )
}

function changedEntry(full: string) {
  return Object.assign(new Error(`File entry changed while observing its address: ${full}`), {
    code: "ERR_FILE_ENTRY_CHANGED",
    path: full,
  })
}

/** Observe the directory entry itself, including a terminal broken link. */
export async function readFileEntry(full: string, expected?: BigIntStats): Promise<FileEntry> {
  const stat = expected ?? (await fs.lstat(full, { bigint: true }))
  let address: string
  let link: FileEntry["link"]
  let shortName: string | undefined
  if (process.platform === "win32") {
    const info = readWindowsEntry(full)
    address = info.address
    link = info.link
    shortName = info.shortName
    if (Boolean(link) !== stat.isSymbolicLink()) throw changedEntry(full)
  } else {
    address = path.join(await fs.realpath(path.dirname(full)), path.basename(full))
    link = stat.isSymbolicLink() ? "file" : undefined
  }
  const observations = await Promise.allSettled([fs.lstat(full, { bigint: true }), fs.lstat(address, { bigint: true })])
  const failures = observations.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, `File entry identity observations failed: ${full}`, { cause: failures[0] })
  }
  for (const observation of observations) {
    if (observation.status === "fulfilled" && !sameIdentity(stat, observation.value)) throw changedEntry(full)
  }
  return { address, stat, link, shortName }
}

export function sameFileEntry(left: FileEntry, right: FileEntry) {
  return left.address === right.address && sameIdentity(left.stat, right.stat)
}

// Keep the library and functions alive for every observation in this process.
let windowsBindings: ReturnType<typeof loadWindowsBindings> | undefined

function loadWindowsBindings() {
  const koffi = requireRuntimePackage<typeof import("koffi")>("koffi")
  const kernel = koffi.load("kernel32.dll")
  const HANDLE = koffi.pointer("OPENCORVUS_FILE_ENTRY_HANDLE", koffi.opaque())
  const TAG = koffi.struct("OPENCORVUS_FILE_ENTRY_TAG_INFO", { FileAttributes: "uint32_t", ReparseTag: "uint32_t" })
  return {
    kernel,
    invalid: (1n << BigInt(koffi.sizeof(HANDLE) * 8)) - 1n,
    open: kernel.func(
      "OPENCORVUS_FILE_ENTRY_HANDLE __stdcall CreateFileW(const char16_t *name, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *templateFile)",
    ),
    tag: kernel.func(
      "int __stdcall GetFileInformationByHandleEx(OPENCORVUS_FILE_ENTRY_HANDLE handle, int infoClass, _Out_ OPENCORVUS_FILE_ENTRY_TAG_INFO *info, uint32_t size)",
    ),
    name: kernel.func(
      "uint32_t __stdcall GetFinalPathNameByHandleW(OPENCORVUS_FILE_ENTRY_HANDLE handle, _Out_ char16_t *name, uint32_t count, uint32_t flags)",
    ),
    shortName: kernel.func(
      "uint32_t __stdcall GetShortPathNameW(const char16_t *name, _Out_ char16_t *shortName, uint32_t count)",
    ),
    close: kernel.func("int __stdcall CloseHandle(OPENCORVUS_FILE_ENTRY_HANDLE handle)"),
    lastError: kernel.func("uint32_t __stdcall GetLastError()"),
    tagSize: koffi.sizeof(TAG),
  }
}

function readWindowsEntry(full: string): Pick<FileEntry, "address" | "link" | "shortName"> {
  const api = (windowsBindings ??= loadWindowsBindings())
  const failure = (operation: string) => {
    const errno = api.lastError()
    return Object.assign(new Error(`${operation} failed for file entry: ${full} (Win32 ${errno})`), {
      code:
        operation === "CreateFileW" && (errno === 2 || errno === 3)
          ? "ENOENT"
          : errno === 5
            ? "EACCES"
            : `WIN32_${errno}`,
      errno,
      syscall: operation,
      path: full,
    })
  }
  // No access requested; share read/write/delete. Open the terminal reparse
  // entry, including directories, rather than following its target.
  const handle = api.open(full, 0, 7, null, 3, 0x02200000, null)
  if (handle === null || handle === undefined || handle === api.invalid || handle === -1n) throw failure("CreateFileW")
  const failures: unknown[] = []
  let result: Pick<FileEntry, "address" | "link" | "shortName"> | undefined
  try {
    const info = {} as { FileAttributes: number; ReparseTag: number }
    if (!api.tag(handle, 9, info, api.tagSize)) throw failure("GetFileInformationByHandleEx")
    let link: FileEntry["link"]
    if (info.ReparseTag === 0xa000000c) link = (info.FileAttributes & 0x10) !== 0 ? "dir" : "file"
    else if (info.ReparseTag === 0xa0000003) link = "junction"
    else if (info.ReparseTag !== 0 || (info.FileAttributes & 0x400) !== 0) {
      throw Object.assign(new Error(`Unsupported reparse tag for file entry: ${full} (${info.ReparseTag})`), {
        code: "ENOTSUP",
        path: full,
        reparseTag: info.ReparseTag,
      })
    }
    const capacity = api.name(handle, null, 0, 0)
    if (!capacity) throw failure("GetFinalPathNameByHandleW")
    const buffer = Buffer.alloc(capacity * 2)
    const written = api.name(handle, buffer, capacity, 0)
    if (!written) throw failure("GetFinalPathNameByHandleW")
    if (written >= capacity || buffer.readUInt16LE(written * 2) !== 0) throw changedEntry(full)
    const address = buffer.toString("utf16le", 0, written * 2)
    if (address.includes("\0")) throw changedEntry(full)
    const shortCapacity = api.shortName(address, null, 0)
    if (!shortCapacity) throw failure("GetShortPathNameW")
    if (shortCapacity > 32768) throw changedEntry(full)
    const shortBuffer = Buffer.alloc(shortCapacity * 2)
    const shortWritten = api.shortName(address, shortBuffer, shortCapacity)
    if (!shortWritten) throw failure("GetShortPathNameW")
    if (shortWritten >= shortCapacity || shortBuffer.readUInt16LE(shortWritten * 2) !== 0) throw changedEntry(full)
    const shortPath = shortBuffer.toString("utf16le", 0, shortWritten * 2)
    if (shortPath.includes("\0")) throw changedEntry(full)
    result = { address, link, shortName: path.basename(shortPath) || undefined }
  } catch (error) {
    failures.push(error)
  } finally {
    try {
      if (!api.close(handle)) throw failure("CloseHandle")
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1)
    throw new AggregateError(failures, `File entry observation and closure failed: ${full}`, { cause: failures[0] })
  return result!
}
