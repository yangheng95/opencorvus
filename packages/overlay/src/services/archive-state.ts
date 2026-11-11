import type { ApiAuthority } from "./api"
import { settleMutationReceipt } from "./mutation-receipt"

export class ArchiveStateUnconfirmedError extends AggregateError {
  override readonly name = "ArchiveStateUnconfirmedError"

  constructor(receiptError: unknown, verificationError: unknown) {
    super([receiptError, verificationError], "The requested archive state could not be confirmed.")
  }
}

export function matchesArchiveState(archivedAt: unknown, archived: boolean): boolean {
  return archived ? typeof archivedAt === "number" && Number.isFinite(archivedAt) : archivedAt === undefined
}

export function settleArchiveState<T>(input: {
  authority: ApiAuthority
  write: () => Promise<T>
  verify: () => Promise<T>
}): Promise<T> {
  return settleMutationReceipt({
    ...input,
    UnconfirmedError: ArchiveStateUnconfirmedError,
  })
}
