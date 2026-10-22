/** Owned QA transport: its socket and total lifetime share the native host deadline. */
export async function ownedJSON(url: URL, init: RequestInit, deadlineAt: number) {
  const remaining = Math.floor(deadlineAt - Date.now())
  if (!Number.isSafeInteger(remaining) || remaining <= 0) throw new RangeError('Owned HTTP deadline must remain in the future')
  const response = await fetch(url, { ...init, timeout: remaining, signal: AbortSignal.timeout(remaining) })
  return { response, result: await response.json() as any }
}
