import { ApiError, assertApiAuthorityCurrent, isApiAuthorityCurrent, type ApiAuthority } from "./api"

export async function settleMutationReceipt<T>(input: {
  authority: ApiAuthority
  write: () => Promise<T>
  verify: () => Promise<T>
  UnconfirmedError: new (receiptError: unknown, verificationError: unknown) => Error
}): Promise<T> {
  const { authority, write, verify, UnconfirmedError } = input
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
      const confirmed = await verify()
      assertApiAuthorityCurrent(authority)
      return confirmed
    } catch (verificationError) {
      if (!isApiAuthorityCurrent(authority)) throw verificationError
      throw new UnconfirmedError(receiptError, verificationError)
    }
  }
}
