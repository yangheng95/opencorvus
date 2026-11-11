import { ApiError, assertApiAuthorityCurrent, isApiAuthorityCurrent, type ApiAuthority } from "./api"

export function isUncertainMutationReceipt(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500 || error.status === 408
}

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
    if (!isApiAuthorityCurrent(authority) || !isUncertainMutationReceipt(receiptError)) {
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
