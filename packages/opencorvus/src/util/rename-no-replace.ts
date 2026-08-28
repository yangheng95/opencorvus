function nativeError(message: string, code: string, errno?: number): NodeJS.ErrnoException {
  return Object.assign(new Error(message), { code, errno })
}

function posixCode(errno: number): string {
  if (errno === 2) return "ENOENT"
  if (errno === 13) return "EACCES"
  if (errno === 17) return "EEXIST"
  if (errno === 18) return "EXDEV"
  if (errno === 39 || errno === 66) return "ENOTEMPTY"
  return `ERRNO_${errno}`
}

function cString(value: string): Buffer {
  return Buffer.from(`${value}\0`, "utf8")
}

function wideString(value: string): Uint16Array {
  const result = new Uint16Array(value.length + 1)
  for (let index = 0; index < value.length; index++) result[index] = value.charCodeAt(index)
  return result
}

async function renameDarwin(source: string, target: string): Promise<void> {
  const { dlopen, read } = await import("bun:ffi")
  const library = dlopen("/usr/lib/libSystem.B.dylib", {
    renamex_np: { args: ["ptr", "ptr", "u32"], returns: "i32" },
    __error: { args: [], returns: "ptr" },
  })
  try {
    const result = library.symbols.renamex_np(cString(source), cString(target), 0x00000004)
    if (result === 0) return
    const errnoPointer = library.symbols.__error()
    if (!errnoPointer) throw new Error("renamex_np failed without an errno pointer")
    const errno = read.i32(errnoPointer, 0)
    throw nativeError(`renamex_np failed for ${source} -> ${target}`, posixCode(errno), errno)
  } finally {
    library.close()
  }
}

function linuxLibraries(): string[] {
  const architecture = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x86_64" : process.arch
  return [
    "libc.so.6",
    `libc.musl-${architecture}.so.1`,
    `/lib/ld-musl-${architecture}.so.1`,
    `/usr/lib/ld-musl-${architecture}.so.1`,
  ]
}

async function renameLinux(source: string, target: string): Promise<void> {
  const { dlopen, read } = await import("bun:ffi")
  let lastLoadError: unknown
  for (const candidate of linuxLibraries()) {
    try {
      const library = dlopen(candidate, {
        renameat2: { args: ["i32", "ptr", "i32", "ptr", "u32"], returns: "i32" },
        __errno_location: { args: [], returns: "ptr" },
      })
      try {
        const result = library.symbols.renameat2(-100, cString(source), -100, cString(target), 1)
        if (result === 0) return
        const errnoPointer = library.symbols.__errno_location()
        if (!errnoPointer) throw new Error("renameat2 failed without an errno pointer")
        const errno = read.i32(errnoPointer, 0)
        throw nativeError(`renameat2 failed for ${source} -> ${target}`, posixCode(errno), errno)
      } finally {
        library.close()
      }
    } catch (error) {
      if (typeof (error as NodeJS.ErrnoException | undefined)?.errno === "number") throw error
      lastLoadError = error
    }
  }
  throw new Error("Linux renameat2(RENAME_NOREPLACE) is unavailable in the active libc", {
    cause: lastLoadError,
  })
}

async function renameWindows(source: string, target: string, writeThrough: boolean): Promise<void> {
  const { dlopen } = await import("bun:ffi")
  const library = dlopen("kernel32.dll", {
    MoveFileExW: { args: ["ptr", "ptr", "u32"], returns: "bool" },
    GetLastError: { args: [], returns: "u32" },
  })
  try {
    if (library.symbols.MoveFileExW(wideString(source), wideString(target), writeThrough ? 0x00000008 : 0)) return
    const error = library.symbols.GetLastError()
    const code = error === 80 || error === 183 ? "EEXIST" : `WIN32_${error}`
    throw nativeError(`MoveFileExW failed for ${source} -> ${target}`, code, error)
  } finally {
    library.close()
  }
}

async function replaceWindows(source: string, target: string): Promise<void> {
  const { dlopen } = await import("bun:ffi")
  const library = dlopen("kernel32.dll", {
    MoveFileExW: { args: ["ptr", "ptr", "u32"], returns: "bool" },
    GetLastError: { args: [], returns: "u32" },
  })
  try {
    // MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
    if (library.symbols.MoveFileExW(wideString(source), wideString(target), 0x00000001 | 0x00000008)) return
    const error = library.symbols.GetLastError()
    throw nativeError(`MoveFileExW replace failed for ${source} -> ${target}`, `WIN32_${error}`, error)
  } finally {
    library.close()
  }
}

/**
 * Perform one operating-system rename that fails when the destination exists.
 * No existence check, destination reservation, copy, or replace fallback is
 * permitted here: callers depend on a single atomic namespace operation.
 */
export async function renameNoReplace(source: string, target: string): Promise<void> {
  if (process.platform === "darwin") return renameDarwin(source, target)
  if (process.platform === "linux") return renameLinux(source, target)
  if (process.platform === "win32") return renameWindows(source, target, false)
  throw new Error(`Atomic rename-no-replace is unsupported on ${process.platform}`)
}

/**
 * Publish one same-volume namespace move with persistence semantics. Windows
 * uses MOVEFILE_WRITE_THROUGH; POSIX callers must fsync the affected parent
 * directories after the atomic rename.
 */
export async function renameNoReplaceWriteThrough(source: string, target: string): Promise<void> {
  if (process.platform === "darwin") return renameDarwin(source, target)
  if (process.platform === "linux") return renameLinux(source, target)
  if (process.platform === "win32") return renameWindows(source, target, true)
  throw new Error(`Durable atomic rename-no-replace is unsupported on ${process.platform}`)
}

/** Atomically replace one same-volume target. Windows requests write-through;
 * POSIX callers fsync the affected directories after this namespace change. */
export async function renameReplaceWriteThrough(source: string, target: string): Promise<void> {
  if (process.platform === "win32") return replaceWindows(source, target)
  if (process.platform === "darwin" || process.platform === "linux") {
    const { rename } = await import("node:fs/promises")
    await rename(source, target)
    return
  }
  throw new Error(`Durable atomic rename-replace is unsupported on ${process.platform}`)
}
