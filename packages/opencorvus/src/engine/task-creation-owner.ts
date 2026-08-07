import type z from "zod"
import type { CreateTaskInput } from "./model"
import { withKeyedLock } from "@/util/lock"

const createTaskOwnerLocks = new Map<string, Promise<unknown>>()

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

export function taskCreationOwnerKey(input: z.infer<typeof CreateTaskInput>): string | undefined {
  return taskCreationOwnerKeys(input)[0]
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

export function resetTaskCreationOwnerLocksForTest(): void {
  createTaskOwnerLocks.clear()
}
