export async function runTimedStage<T>(
  label: string,
  action: () => Promise<T>,
  log: (message: string) => void = console.log,
  now: () => number = performance.now.bind(performance),
): Promise<T> {
  const startedAt = now()
  log(`[package] ${label}: started`)
  try {
    const result = await action()
    log(`[package] ${label}: completed in ${((now() - startedAt) / 1_000).toFixed(2)}s`)
    return result
  } catch (error) {
    log(`[package] ${label}: failed after ${((now() - startedAt) / 1_000).toFixed(2)}s`)
    throw error
  }
}
