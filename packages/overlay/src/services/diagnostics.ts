import { formatErrorDetails } from "../utils/error-details"
import { AppLog } from "../utils/log"

export interface DiagnosticInput {
  id?: string
  title: string
  message?: string
  details?: string
  taskID?: string
  taskDirectory?: string
  taskTitle?: string
}

type DiagnosticLevel = "info" | "warn" | "error"

function reportDiagnostic(level: DiagnosticLevel, input: DiagnosticInput): void {
  const message = input.message?.trim() || input.title
  AppLog[level]("ui", input.title, {
    diagnosticID: input.id,
    message,
    details: input.details || "",
    taskID: input.taskID || "",
    taskDirectory: input.taskDirectory || "",
    taskTitle: input.taskTitle || "",
  })
}

export function reportSuccess(input: DiagnosticInput): void {
  reportDiagnostic("info", input)
}

export function reportWarning(input: DiagnosticInput): void {
  reportDiagnostic("warn", input)
}

export function reportError(input: DiagnosticInput): void {
  reportDiagnostic("error", input)
}

/**
 * Run UI reconciliation after a server mutation has already committed.
 * Secondary UI failures stay visible but can never rewrite durable success.
 */
export function runPostCommitUiEffect(input: DiagnosticInput, effect: () => void): void {
  try {
    effect()
  } catch (error) {
    AppLog.error("ui", "post-commit UI reconciliation failed", {
      diagnosticID: input.id,
      diagnosticTitle: input.title,
      diagnosticMessage: error instanceof Error ? error.message : String(error),
      diagnosticDetails: formatErrorDetails(error),
    })
  }
}

export { formatErrorDetails }
