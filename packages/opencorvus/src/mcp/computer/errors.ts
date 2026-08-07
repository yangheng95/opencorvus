import { z } from "zod"

export const ComputerErrorCode = z.enum([
  "COMPUTER_SESSION_NOT_FOUND",
  "COMPUTER_SESSION_IDENTITY_MISMATCH",
  "COMPUTER_RUN_REVOKED",
  "STALE_OBSERVATION",
  "COMPUTER_INPUT_OUT_OF_BOUNDS",
  "COMPUTER_BACKEND_ERROR",
  "COMPUTER_OUTCOME_UNKNOWN",
])

export type ComputerErrorCode = z.infer<typeof ComputerErrorCode>

export class ComputerError extends Error {
  constructor(
    readonly code: ComputerErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "ComputerError"
  }
}

export function computerError(error: unknown): ComputerError {
  if (error instanceof ComputerError) return error
  return new ComputerError(
    "COMPUTER_BACKEND_ERROR",
    error instanceof Error ? error.message : String(error),
    {},
    error instanceof Error ? { cause: error } : undefined,
  )
}
