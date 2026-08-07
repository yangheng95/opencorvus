import fs from "node:fs/promises"

export async function throwAfterBrowserPreviewPublicationCleanup(input: {
  primaryFailure: unknown
  residualPath: string
}): Promise<never> {
  try {
    await fs.rm(input.residualPath, { recursive: true })
  } catch (cleanupFailure) {
    throw new AggregateError(
      [input.primaryFailure, cleanupFailure],
      `Browser Preview publication failed and cleanup failed for residual path: ${input.residualPath}`,
      { cause: input.primaryFailure },
    )
  }
  throw input.primaryFailure
}
