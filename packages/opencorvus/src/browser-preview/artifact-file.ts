import type { Stats } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

export async function readBrowserPreviewArtifactFile(input: {
  filePath: string
  authorityRoot: string
  scopedRoot: string
}): Promise<Buffer> {
  const filePath = path.resolve(input.filePath)
  const authorityRoot = path.resolve(input.authorityRoot)
  const scopedRoot = path.resolve(input.scopedRoot)
  assertContained(authorityRoot, scopedRoot, "Browser Preview scoped root must be inside its authority root")
  assertDescendant(scopedRoot, filePath, "Browser Preview artifact must be inside its scoped root")

  const canonicalAuthorityRoot = await fs.realpath(authorityRoot)
  const authorityRelative = path.relative(authorityRoot, filePath)
  let current = authorityRoot
  let targetBeforeOpen: Stats | undefined
  for (const segment of authorityRelative.split(path.sep)) {
    current = path.join(current, segment)
    const item = await fs.lstat(current)
    if (item.isSymbolicLink()) {
      throw new Error(`Browser Preview artifact path contains a symbolic link: ${filePath}`)
    }
    if (current === filePath) targetBeforeOpen = item
  }
  if (!targetBeforeOpen?.isFile() || targetBeforeOpen.nlink !== 1) {
    throw new Error(`Browser Preview artifact must be a single-link regular file: ${filePath}`)
  }

  const canonicalScopedRoot = await fs.realpath(scopedRoot)
  const canonicalFile = await fs.realpath(filePath)
  assertContainedCanonical(
    canonicalAuthorityRoot,
    canonicalScopedRoot,
    `Browser Preview scoped root resolves outside its authority root: ${scopedRoot}`,
  )
  assertDescendantCanonical(
    canonicalScopedRoot,
    canonicalFile,
    `Browser Preview artifact resolves outside its scoped root: ${filePath}`,
  )

  const handle = await fs.open(filePath, "r")
  try {
    const before = await handle.stat()
    if (!before.isFile() || before.nlink !== 1 || !sameFileIdentity(targetBeforeOpen, before)) {
      throw new Error(`Browser Preview artifact identity changed before it was opened: ${filePath}`)
    }
    const bytes = await handle.readFile()
    const after = await handle.stat()
    const pathAfter = await fs.lstat(filePath)
    const canonicalAuthorityAfter = await fs.realpath(authorityRoot)
    const canonicalScopeAfter = await fs.realpath(scopedRoot)
    const canonicalFileAfter = await fs.realpath(filePath)
    if (
      pathAfter.isSymbolicLink() ||
      !pathAfter.isFile() ||
      after.nlink !== 1 ||
      pathAfter.nlink !== 1 ||
      canonicalAuthorityAfter !== canonicalAuthorityRoot ||
      canonicalScopeAfter !== canonicalScopedRoot ||
      canonicalFileAfter !== canonicalFile ||
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(after, pathAfter) ||
      bytes.byteLength !== after.size
    ) {
      throw new Error(`Browser Preview artifact changed while it was being read: ${filePath}`)
    }
    return bytes
  } finally {
    await handle.close()
  }
}

function assertContainedCanonical(root: string, candidate: string, message: string): void {
  if (candidate === root) return
  assertDescendantCanonical(root, candidate, message)
}

function assertContained(root: string, candidate: string, message: string): void {
  if (candidate === root) return
  assertDescendant(root, candidate, message)
}

function assertDescendant(root: string, candidate: string, message: string): void {
  const relative = path.relative(root, candidate)
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(message)
  }
}

function assertDescendantCanonical(root: string, candidate: string, message: string): void {
  if (candidate === root || !candidate.startsWith(`${root}${path.sep}`)) throw new Error(message)
}

function sameFileIdentity(left: Stats, right: Stats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs &&
    left.nlink === right.nlink
  )
}
