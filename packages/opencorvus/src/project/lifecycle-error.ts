export function lifecycleError(error: unknown, operation: string): Error {
  if (error instanceof Error) return error
  return new Error(`${operation} rejected with a non-Error value: ${String(error)}`, { cause: error })
}
