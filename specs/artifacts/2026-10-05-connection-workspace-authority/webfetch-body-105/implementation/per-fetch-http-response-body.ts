export interface HttpResponseOwner {
  response: Response
  abort(reason: unknown): void
}

/** One physical fetch owns its cancellation independently of the whole operation. */
export async function fetchHttpResponseOwner(
  fetchResponse: (signal: AbortSignal) => Promise<Response>,
  signal: AbortSignal,
): Promise<HttpResponseOwner> {
  const controller = new AbortController()
  const response = await fetchResponse(AbortSignal.any([signal, controller.signal]))
  return { response, abort: (reason) => controller.abort(reason) }
}

function combineBodyFailures(primary: unknown, cleanup: unknown): unknown {
  return primary === cleanup
    ? primary
    : new AggregateError([primary, cleanup], "HTTP response body failed and cleanup failed")
}

/** Consume one actual response reader, bounding bytes before they are retained. */
export async function readHttpResponseBody(
  owner: HttpResponseOwner,
  limit?: { maxBytes: number; error: () => Error },
): Promise<Uint8Array> {
  const { response } = owner
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let result = new Uint8Array()
  let failed = false
  let failure: unknown
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (limit && total > limit.maxBytes) throw limit.error()
      chunks.push(new Uint8Array(next.value))
    }
    result = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.byteLength
    }
  } catch (error) {
    failed = true
    failure = error
    owner.abort(error)
    try {
      await reader.cancel(error)
    } catch (cleanup) {
      failure = combineBodyFailures(failure, cleanup)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch (cleanup) {
      failure = failed ? combineBodyFailures(failure, cleanup) : cleanup
      failed = true
    }
  }
  if (failed) throw failure
  return result
}

/** Settle an unconsumed body before rejecting it or replacing its response. */
export async function disposeHttpResponseBody(
  owner: HttpResponseOwner,
  primary: Error = new DOMException("Response replaced", "AbortError"),
): Promise<void> {
  owner.abort(primary)
  try {
    await owner.response.body?.cancel(primary)
  } catch (cleanup) {
    throw combineBodyFailures(primary, cleanup)
  }
}
