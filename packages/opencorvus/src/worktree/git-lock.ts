import fs from "fs/promises"
import os from "node:os"
import { randomUUID } from "node:crypto"
import path from "node:path"
import lockfile from "proper-lockfile"
import { Filesystem } from "@/util/filesystem"

const STALE_MILLISECONDS = 30_000
const UPDATE_MILLISECONDS = 1_000
const WAIT_MILLISECONDS = 120_000
const RETRY_MILLISECONDS = 200

export type ProjectGitLockOwner = {
  token: string
  pid: number
  hostname: string
  acquiredAt: number
  projectID: string
}

function isOwner(value: unknown): value is ProjectGitLockOwner {
  if (!value || typeof value !== "object") return false
  const owner = value as Partial<ProjectGitLockOwner>
  return (
    typeof owner.token === "string" &&
    owner.token.length > 0 &&
    typeof owner.pid === "number" &&
    Number.isInteger(owner.pid) &&
    owner.pid > 0 &&
    typeof owner.hostname === "string" &&
    owner.hostname.length > 0 &&
    typeof owner.acquiredAt === "number" &&
    Number.isFinite(owner.acquiredAt) &&
    typeof owner.projectID === "string" &&
    owner.projectID.length > 0
  )
}

export namespace ProjectGitLock {
  export type Lease = {
    owner: ProjectGitLockOwner
    assertOwned(): void
    release(): Promise<void>
  }

  export async function readOwner(target: string): Promise<ProjectGitLockOwner | undefined> {
    return fs
      .readFile(target, "utf8")
      .then((raw) => JSON.parse(raw) as unknown)
      .then((value) => (isOwner(value) ? value : undefined))
      .catch(() => undefined)
  }

  export async function acquire(target: string, projectID: string): Promise<Lease> {
    await fs.mkdir(path.dirname(target), { recursive: true })
    let compromised: unknown
    const releaseOwnership = await lockfile.lock(target, {
      realpath: false,
      stale: STALE_MILLISECONDS,
      update: UPDATE_MILLISECONDS,
      retries: {
        retries: Math.ceil(WAIT_MILLISECONDS / RETRY_MILLISECONDS),
        factor: 1,
        minTimeout: RETRY_MILLISECONDS,
        maxTimeout: RETRY_MILLISECONDS,
        randomize: false,
      },
      onCompromised(error) {
        compromised ??= error
      },
    })
    const owner: ProjectGitLockOwner = {
      token: randomUUID(),
      pid: process.pid,
      hostname: os.hostname(),
      acquiredAt: Date.now(),
      projectID,
    }
    try {
      await Filesystem.writeAtomic(target, `${JSON.stringify(owner, null, 2)}\n`, 0o600)
    } catch (error) {
      await releaseOwnership().catch((releaseError) => {
        throw new AggregateError([error, releaseError], `Failed to publish and release project Git lock ${target}`)
      })
      throw error
    }

    let releasePromise: Promise<void> | undefined
    return {
      owner,
      assertOwned() {
        if (compromised) {
          throw new Error(`Project Git lock ${target} was compromised`, { cause: compromised })
        }
      },
      release() {
        releasePromise ??= (async () => {
          const errors: unknown[] = []
          const current = await readOwner(target)
          if (current?.token === owner.token) {
            await fs.rm(target, { force: true }).catch((error) => errors.push(error))
          } else {
            errors.push(
              new Error(
                `Project Git lock ${target} owner changed before release: expected ${owner.token}, received ${current?.token ?? "missing"}`,
              ),
            )
          }
          await releaseOwnership().catch((error) => errors.push(error))
          if (errors.length === 1) throw errors[0]
          if (errors.length > 1) throw new AggregateError(errors, `Failed to release project Git lock ${target}`)
        })()
        return releasePromise
      },
    }
  }
}
