/**
 * A compromised cross-process lock must fail the operation that lost it, not
 * the host process.
 *
 * `proper-lockfile` renews a held lock on a timer and calls `onCompromised`
 * when renewal falls outside the stale threshold or the lockfile disappears.
 * Its default is `(err) => { throw err }`, thrown from inside that timer — an
 * uncaught exception no caller can catch. Six call sites took the default, so
 * a suspended machine or a cleaned lock directory crashed the host over one
 * file.
 */
import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ProcessLockCompromisedError, acquireProcessLock, withProcessLock } from "../../src/util/process-lock"

const roots: string[] = []

async function lockTarget(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `opencorvus-process-lock-${name}-`))
  roots.push(root)
  const target = path.join(root, "target.json")
  await fs.writeFile(target, "{}\n")
  return target
}

/**
 * Wait for the renewal timer to observe the removed lockfile. proper-lockfile
 * clamps `stale` to at least 2000ms and `update` to at least 1000ms, so the
 * first renewal cannot land sooner than a second no matter what is requested.
 */
const RENEWAL_INTERVAL_MS = 1_000
async function settleRenewal(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, RENEWAL_INTERVAL_MS + 500))
}

afterAll(async () => {
  for (const root of roots) await fs.rm(root, { recursive: true, force: true }).catch(() => undefined)
})

describe("process lock compromise", () => {
  test("reports a lost lock from release instead of throwing out of the renewal timer", async () => {
    const target = await lockTarget("release")
    const release = await acquireProcessLock(target, { realpath: false, stale: 2_000, update: RENEWAL_INTERVAL_MS })

    // Removing the lockfile is what a cleaner, a crashed sibling, or a stale
    // sweep does. proper-lockfile sees ENOENT on renewal and declares the lock
    // compromised.
    await fs.rm(`${target}.lock`, { recursive: true, force: true })
    await settleRenewal()

    await expect(release()).rejects.toBeInstanceOf(ProcessLockCompromisedError)
  })

  test("names the target and keeps the underlying cause", async () => {
    const target = await lockTarget("cause")
    const release = await acquireProcessLock(target, { realpath: false, stale: 2_000, update: RENEWAL_INTERVAL_MS })
    await fs.rm(`${target}.lock`, { recursive: true, force: true })
    await settleRenewal()

    const error = await release().then(
      () => undefined,
      (reason: unknown) => reason,
    )
    expect(error).toBeInstanceOf(ProcessLockCompromisedError)
    expect((error as ProcessLockCompromisedError).target).toBe(target)
    expect((error as ProcessLockCompromisedError).message).toContain("expected: sole ownership until release")
    expect((error as ProcessLockCompromisedError).cause).toBeDefined()
  })

  test("release is idempotent, so a caller releasing twice sees the same verdict", async () => {
    const target = await lockTarget("idempotent")
    const release = await acquireProcessLock(target, { realpath: false, stale: 2_000, update: RENEWAL_INTERVAL_MS })
    await fs.rm(`${target}.lock`, { recursive: true, force: true })
    await settleRenewal()

    await expect(release()).rejects.toBeInstanceOf(ProcessLockCompromisedError)
    await expect(release()).rejects.toBeInstanceOf(ProcessLockCompromisedError)
  })

  test("an uneventful lock releases cleanly and runs its operation once", async () => {
    const target = await lockTarget("clean")
    let runs = 0
    const result = await withProcessLock(target, { realpath: false }, async () => {
      runs += 1
      return "done"
    })
    expect(result).toBe("done")
    expect(runs).toBe(1)
    // The lockfile is gone, so the next acquisition does not have to wait it out.
    await expect(fs.stat(`${target}.lock`)).rejects.toThrow()
  })

  test("withProcessLock surfaces a compromise rather than returning the value", async () => {
    const target = await lockTarget("scoped")
    const attempt = withProcessLock(target, { realpath: false, stale: 2_000, update: RENEWAL_INTERVAL_MS }, async () => {
      await fs.rm(`${target}.lock`, { recursive: true, force: true })
      await settleRenewal()
      return "written without exclusivity"
    })
    await expect(attempt).rejects.toBeInstanceOf(ProcessLockCompromisedError)
  })

  test("a body that throws keeps its own error and still releases", async () => {
    const target = await lockTarget("body-error")
    const failure = new Error("body failed")
    await expect(
      withProcessLock(target, { realpath: false }, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    await expect(fs.stat(`${target}.lock`)).rejects.toThrow()
  })
})
