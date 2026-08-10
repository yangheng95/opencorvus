import fs from "node:fs"
import path from "node:path"
import { artifactEmbeddedExecutableRelativePaths } from "./build-artifact"

export const ARTIFACT_EXECUTABLE_MODE = 0o755

const NATIVE_BINARY_EXTENSIONS = new Set([".dll", ".dylib", ".exe", ".node", ".so"])
const NATIVE_BINARY_MAGICS = new Set([
  0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca,
])

function hasNativeBinaryExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return NATIVE_BINARY_EXTENSIONS.has(path.extname(lower)) || lower.includes(".so.")
}

function hasNativeBinaryMagic(header: Buffer): boolean {
  if (header.length < 4) return false
  if (header[0] === 0x4d && header[1] === 0x5a) return true
  if (header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46) return true
  return NATIVE_BINARY_MAGICS.has(header.readUInt32BE(0))
}

async function isNativeBinary(filename: string): Promise<boolean> {
  if (hasNativeBinaryExtension(filename)) return true
  const namespacedFilename = path.toNamespacedPath(filename)
  let handle: fs.promises.FileHandle | undefined
  let lastError: unknown
  const maximumAttempts = 12
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      handle = await fs.promises.open(namespacedFilename, "r")
      break
    } catch (error) {
      lastError = error
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || attempt === maximumAttempts - 1) throw error
      // Windows package copies can briefly expose a directory entry before
      // the file is openable. Retry the exact path, but keep a persistent
      // disappearance fatal so an incomplete artifact cannot pass validation.
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(500, 25 * 2 ** attempt)))
    }
  }
  if (!handle) throw lastError
  try {
    const header = Buffer.alloc(4)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    return hasNativeBinaryMagic(header.subarray(0, bytesRead))
  } finally {
    await handle.close()
  }
}

export async function discoverArtifactBinaryPaths(root: string): Promise<string[]> {
  const discovered = new Set<string>()
  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.promises.readdir(path.toNamespacedPath(directory), { withFileTypes: true })
    for (const entry of entries) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(filename)
        continue
      }
      if (entry.isFile() && (await isNativeBinary(filename))) discovered.add(filename)
    }
  }
  await visit(root)
  return [...discovered].sort((left, right) => left.localeCompare(right))
}

export function artifactEmbeddedExecutablePaths(root: string, os = process.platform): string[] {
  return artifactEmbeddedExecutableRelativePaths(os).map((relativePath) => path.join(root, relativePath))
}

export async function normalizeArtifactExecutablePermissions(input: { root: string; os: string }): Promise<string[]> {
  const windows = input.os === "win32" || input.os.startsWith("windows")
  const executables = [
    ...new Set([
      ...artifactEmbeddedExecutablePaths(input.root, input.os),
      ...(windows ? [] : await discoverArtifactBinaryPaths(input.root)),
    ]),
  ].sort((left, right) => left.localeCompare(right))
  for (const executable of executables) {
    const info = await fs.promises.stat(path.toNamespacedPath(executable))
    if (!info.isFile()) throw new Error(`Packaged executable is not a file: ${executable}`)
    if (!windows) {
      await fs.promises.chmod(path.toNamespacedPath(executable), ARTIFACT_EXECUTABLE_MODE)
    }
  }
  return executables
}

export async function inspectArtifactExecutableClosure(input: {
  root: string
  os: string
}): Promise<Array<{ path: string; mode: number }>> {
  const executables = [
    ...new Set([
      ...artifactEmbeddedExecutablePaths(input.root, input.os),
      ...(await discoverArtifactBinaryPaths(input.root)),
    ]),
  ].sort((left, right) => left.localeCompare(right))
  return Promise.all(
    executables.map(async (executable) => {
      const info = await fs.promises.stat(path.toNamespacedPath(executable))
      if (!info.isFile()) throw new Error(`Packaged executable is not a file: ${executable}`)
      return { path: executable, mode: info.mode & 0o777 }
    }),
  )
}
