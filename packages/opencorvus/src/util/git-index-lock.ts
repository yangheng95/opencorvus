import fs from "node:fs/promises"
import type { BigIntStats } from "node:fs"
import { Filesystem } from "./filesystem"

export type GitIndexFingerprint = Readonly<{
  device: bigint
  inode: bigint
  mode: bigint
  size: bigint
  modifiedNanoseconds: bigint
  changedNanoseconds: bigint
}>

export type OwnedGitIndexLock = Readonly<{ path: string; fingerprint: GitIndexFingerprint }>

export function gitIndexFingerprint(stat: BigIntStats): GitIndexFingerprint {
  return {
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    size: stat.size,
    modifiedNanoseconds: stat.mtimeNs,
    changedNanoseconds: stat.ctimeNs,
  }
}

export function sameGitIndexFingerprint(left: GitIndexFingerprint, right: GitIndexFingerprint) {
  return Object.keys(left).every(
    (key) => left[key as keyof GitIndexFingerprint] === right[key as keyof GitIndexFingerprint],
  )
}

export async function readOptionalGitIndex(file: string) {
  return fs.readFile(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
}

export async function writeSyncedGitIndex(handle: Awaited<ReturnType<typeof fs.open>>, bytes: Uint8Array) {
  await handle.truncate(0)
  await handle.writeFile(bytes)
  await handle.sync()
}

export async function removeOwnedGitIndexLock(lock: OwnedGitIndexLock) {
  const observed = await fs.lstat(lock.path, { bigint: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (!observed) return
  if (!sameGitIndexFingerprint(lock.fingerprint, gitIndexFingerprint(observed))) {
    throw new Error(`Git index lock ownership changed before cleanup: ${lock.path}`)
  }
  await fs.rm(lock.path)
}

/** Publish a prepared index only while its exact predecessor is still current. */
export async function prepareGitIndexLock(input: {
  indexPath: string
  predecessor: Buffer | undefined
  preparedIndex: string
  label: string
}) {
  const lockPath = `${input.indexPath}.lock`
  const handle = await fs.open(lockPath, "wx", 0o600)
  let lock: OwnedGitIndexLock | undefined
  let failure: unknown
  try {
    const [current, next] = await Promise.all([readOptionalGitIndex(input.indexPath), fs.readFile(input.preparedIndex)])
    if (
      (current === undefined) !== (input.predecessor === undefined) ||
      (current && input.predecessor && !current.equals(input.predecessor))
    ) {
      throw new Error(`Canonical Git index changed during checkpoint preparation: ${input.label}`)
    }
    await writeSyncedGitIndex(handle, next)
  } catch (error) {
    failure = error
  }
  try {
    lock = { path: lockPath, fingerprint: gitIndexFingerprint(await handle.stat({ bigint: true })) }
  } catch (error) {
    failure = failure ? new AggregateError([failure, error], `Git index lock stat failed for ${input.label}`) : error
  }
  try {
    await handle.close()
  } catch (error) {
    failure = failure
      ? new AggregateError([failure, error], `Git index lock write and close failed for ${input.label}`)
      : error
  }
  if (lock) {
    const observed = await fs.lstat(lockPath, { bigint: true })
    if (!observed.isFile() || observed.dev !== lock.fingerprint.device || observed.ino !== lock.fingerprint.inode) {
      throw new Error(`Git index lock ownership changed before close completed: ${lockPath}`, { cause: failure })
    }
    // Windows finalizes write timestamps when the handle closes.
    lock = { path: lockPath, fingerprint: gitIndexFingerprint(observed) }
  }
  if (failure) {
    if (lock) await removeOwnedGitIndexLock(lock)
    throw failure
  }
  return lock!
}

export async function installGitIndexLock(lock: OwnedGitIndexLock, indexPath: string) {
  await Filesystem.renameAfterTransientContention(lock.path, indexPath)
}
