import type z from "zod"
import type { CreateTaskInput } from "./model"
import { Lock, withKeyedLock } from "@/util/lock"
import { Global } from "@/global"
import { CROSS_PROCESS_LOCK_RETRY, withProcessLock } from "@/util/process-lock"
import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const createTaskOwnerLocks = new Map<string, Promise<unknown>>()
let afterGlobalProcessOwnerStartedForTest: ((input: { target: string }) => Promise<void>) | undefined

export function taskCreationOwnerKeys(input: z.infer<typeof CreateTaskInput>): string[] {
  const keys: string[] = []
  const requestID = input.requestID?.trim()
  if (requestID) keys.push(`request:${requestID}`)
  // This lock protects duplicate channel ingress, not Mission/task lineage.
  // Lineage children may fan out in parallel when their briefs are independent.
  if (input.channelBinding) {
    keys.push(`channel:${input.channelBinding.platform}:${input.channelBinding.channel}:${input.channelBinding.thread}`)
  }
  return [...new Set(keys)].sort()
}

export async function withTaskCreationOwnerLock<T>(
  input: z.infer<typeof CreateTaskInput>,
  fn: () => Promise<T>,
): Promise<T> {
  const ownerKeys = taskCreationOwnerKeys(input)
  let run = fn
  for (const ownerKey of ownerKeys.toReversed()) {
    const next = run
    run = () => withKeyedLock(createTaskOwnerLocks, ownerKey, next)
  }
  return run()
}

/**
 * Own one global Task request before it chooses an anonymous Project.
 *
 * The per-project owner above is intentionally too late for this boundary: two
 * backends can both observe no global replay, allocate different Projects and
 * then each acquire a perfectly valid per-project request owner. The global
 * request identity must therefore span lookup, allocation and canonical Task
 * creation. Task creation has no fixed wall-clock bound, so the local writer
 * waits indefinitely and the process lock uses the shared retry policy.
 */
export async function withGlobalTaskRequestOwner<T>(requestID: string, fn: () => Promise<T>): Promise<T> {
  const identity = requestID.trim()
  if (!identity) throw new Error("Global Task request owner requires a non-empty request ID")
  const digest = createHash("sha256").update(identity).digest("hex")
  const ownerDirectory = path.join(Global.Path.data, "global-task-request-owners")
  const target = path.join(ownerDirectory, digest)
  await mkdir(ownerDirectory, { recursive: true })
  using _localOwner = await Lock.write(`global-task-request:${target}`)
  const operation = withProcessLock(target, { realpath: false, retries: CROSS_PROCESS_LOCK_RETRY }, fn).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason }),
  )
  let hookFailed = false
  let hookFailure: unknown
  try {
    await afterGlobalProcessOwnerStartedForTest?.({ target })
  } catch (error) {
    hookFailed = true
    hookFailure = error
  }
  const outcome = await operation
  if (hookFailed) {
    if (outcome.status === "rejected") {
      throw new AggregateError(
        [hookFailure, outcome.reason],
        `Global Task request owner hook and operation both failed for ${target}`,
      )
    }
    throw hookFailure
  }
  if (outcome.status === "rejected") throw outcome.reason
  return outcome.value
}

export namespace GlobalTaskRequestOwnerTestHooks {
  export function replaceAfterProcessOwnerStarted(hook: (input: { target: string }) => Promise<void>): Disposable {
    const previous = afterGlobalProcessOwnerStartedForTest
    afterGlobalProcessOwnerStartedForTest = hook
    return {
      [Symbol.dispose]() {
        afterGlobalProcessOwnerStartedForTest = previous
      },
    }
  }
}
