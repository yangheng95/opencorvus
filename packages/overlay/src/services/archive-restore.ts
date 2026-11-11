import type { ApiAuthority } from "./api"
import { settleMutationReceipt } from "./mutation-receipt"

export class ArchiveRestoreUnconfirmedError extends AggregateError {
  override readonly name = "ArchiveRestoreUnconfirmedError"

  constructor(receiptError: unknown, verificationError: unknown) {
    super([receiptError, verificationError], "The archive restore state could not be confirmed.")
  }
}

export function settleArchiveRestore<T>(input: {
  authority: ApiAuthority
  write: () => Promise<T>
  readRestored: () => Promise<T>
}): Promise<T> {
  return settleMutationReceipt({
    authority: input.authority,
    write: input.write,
    verify: input.readRestored,
    UnconfirmedError: ArchiveRestoreUnconfirmedError,
  })
}
