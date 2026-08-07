export async function stopServerWithTimeout(input: {
  stop: () => void | Promise<void>
  timeoutMilliseconds: number
  onStopError: (error: unknown) => void
  onTimeout: () => void
}): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve()
        .then(input.stop)
        .catch((error) => {
          input.onStopError(error)
          throw error
        }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          input.onTimeout()
          reject(new Error(`Server stop timed out after ${input.timeoutMilliseconds}ms`))
        }, input.timeoutMilliseconds)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
