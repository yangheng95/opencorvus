type RuntimeHandoff = { releaseHandoff(commit?: boolean): void | Promise<void> }

/** The runtime's real cancellation boundary releases handlers which may be
 * holding listener drain. Both operations retain their original owner until
 * joined; a failed drain rolls back only the exact completed handoff. */
export async function settleRuntimeAndQuiesceListener<T extends RuntimeHandoff>(input: {
  settle(onRuntimeCancellationRequested: () => void): Promise<T>
  quiesce(): Promise<void>
}): Promise<T> {
  const cancellation = Promise.withResolvers<void>()
  let cancellationRequested = false
  const settlement = Promise.resolve().then(() => input.settle(() => {
    cancellationRequested = true
    cancellation.resolve()
  }))
  void settlement.then(
    () => {
      if (!cancellationRequested) cancellation.reject(new Error("Runtime settlement completed without cancellation readiness"))
    },
    cancellation.reject,
  )
  const [listener, runtime] = await Promise.allSettled([
    cancellation.promise.then(() => input.quiesce()),
    settlement,
  ])
  const failures: unknown[] = []
  if (listener.status === "rejected" && (runtime.status === "fulfilled" || listener.reason !== runtime.reason)) {
    failures.push(listener.reason)
  }
  if (runtime.status === "rejected") failures.push(runtime.reason)
  if (failures.length > 0) {
    if (runtime.status === "fulfilled") {
      try { await runtime.value.releaseHandoff(false) }
      catch (error) { failures.push(error) }
    }
    if (failures.length === 1) throw failures[0]
    throw new AggregateError(failures, "Server listener quiesce and runtime settlement failed")
  }
  if (runtime.status === "rejected") throw runtime.reason
  return runtime.value
}

export async function stopServerWithTimeout(input: {
  stop: () => void | Promise<void>
  timeoutMilliseconds: number
  onStopError: (error: unknown) => void
  onTimeout: (error: Error) => void
}): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = Promise.resolve().then(input.stop).then(
    () => ({ status: "fulfilled" as const }),
    (error: unknown) => {
      try { input.onStopError(error) }
      catch (diagnosticError) {
        if (diagnosticError !== error) error = new AggregateError([error, diagnosticError], "Server stop and error reporting failed")
      }
      return { status: "rejected" as const, error }
    },
  )
  try {
    const result = await Promise.race([
      stop,
      new Promise<{ status: "timeout"; error: Error }>((resolve) => {
        timer = setTimeout(() => {
          let error: Error = new Error(`Server stop timed out after ${input.timeoutMilliseconds}ms`)
          try { input.onTimeout(error) }
          catch (callbackError) {
            error = new AggregateError([error, callbackError], "Server stop timeout reporting failed")
          }
          resolve({ status: "timeout", error })
        }, input.timeoutMilliseconds)
      }),
    ])
    if (result.status === "timeout") {
      // Detect the original deadline without abandoning Bun's pending stop.
      // The CLI's timeout callback owns failed process exit for an
      // uncooperative listener; other callers retain their original owner.
      const terminal = await stop
      if (terminal.status === "rejected") {
        throw new AggregateError([result.error, terminal.error], "Server stop timed out and subsequently failed")
      }
      throw result.error
    }
    if (result.status === "rejected") throw result.error
  } finally {
    if (timer) clearTimeout(timer)
  }
}
