import { ApiError, assertApiAuthorityCurrent, isApiAuthorityCurrent, type ApiAuthority } from "./api"

export class ArchiveRestoreUnconfirmedError extends AggregateError {
  override readonly name = "ArchiveRestoreUnconfirmedError"

  constructor(receiptError: unknown, verificationError: unknown) {
    super([receiptError, verificationError], "The archive restore state could not be confirmed.")
  }
}

export async function settleArchiveRestore<T>(input: {
  authority: ApiAuthority
  write: () => Promise<T>
  readRestored: () => Promise<T>
}): Promise<T> {
  const { authority, write, readRestored } = input
  assertApiAuthorityCurrent(authority)
  try {
    return await write()
  } catch (receiptError) {
    if (
      !isApiAuthorityCurrent(authority) ||
      (receiptError instanceof ApiError && receiptError.status < 500 && receiptError.status !== 408)
    ) {
      throw receiptError
    }
    try {
      const restored = await readRestored()
      assertApiAuthorityCurrent(authority)
      return restored
    } catch (verificationError) {
      if (!isApiAuthorityCurrent(authority)) throw verificationError
      throw new ArchiveRestoreUnconfirmedError(receiptError, verificationError)
    }
  }
}
