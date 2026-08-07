export namespace ExpertSquadCleanup {
  export const packageInstallationFailureMessage = "Expert squad package installation failed and cleanup also failed"
  export const archiveImportFailureMessage = "Expert squad ZIP import failed and temporary source cleanup also failed"

  export async function rethrowWithFailures(
    primaryError: unknown,
    message: string,
    cleanupActions: ReadonlyArray<() => Promise<void>>,
  ): Promise<never> {
    const cleanupFailures: unknown[] = []
    for (const cleanup of cleanupActions) {
      try {
        await cleanup()
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    if (cleanupFailures.length > 0) {
      throw new AggregateError([primaryError, ...cleanupFailures], message, { cause: primaryError })
    }
    throw primaryError
  }

  export async function run<T>(
    operation: () => Promise<T>,
    cleanup: () => Promise<void>,
    failureMessage: string,
  ): Promise<T> {
    let operationFailed = false
    let operationFailure: unknown
    try {
      return await operation()
    } catch (error) {
      operationFailed = true
      operationFailure = error
      throw error
    } finally {
      try {
        await cleanup()
      } catch (cleanupFailure) {
        if (operationFailed) {
          throw new AggregateError([operationFailure, cleanupFailure], failureMessage, { cause: operationFailure })
        }
        throw cleanupFailure
      }
    }
  }
}
