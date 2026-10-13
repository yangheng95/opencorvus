import { configMutationReceiptDiagnostic, readConfigMutationReceipt } from "../services/config-mutation-receipt"

/**
 * Render a thrown value into a multi-line detail string suitable for the
 * notification's collapsible details block. Pulls stack, and when the error is
 * an ApiError, the HTTP status, path, and response body. Committed configuration
 * receipts expose their reconciliation details while retaining the snapshot
 * exclusively on the original error.
 */
export function formatErrorDetails(err: unknown): string {
  if (err == null) return ""
  if (err instanceof Error) {
    const parts: string[] = []
    const meta = err as Error & {
      status?: unknown
      path?: unknown
      method?: unknown
      body?: unknown
      requestID?: unknown
    }
    if (typeof meta.status === "number" && typeof meta.path === "string") {
      parts.push(`HTTP ${typeof meta.method === "string" ? `${meta.method} ` : ""}${meta.status} ${meta.path}`)
    }
    if (typeof meta.requestID === "string" && meta.requestID) parts.push(`Request ID: ${meta.requestID}`)
    const receipt = readConfigMutationReceipt(meta.body)
    parts.push(receipt ? `${receipt.name}: ${receipt.data.message}` : err.stack || `${err.name}: ${err.message}`)
    const body = receipt ? configMutationReceiptDiagnostic(receipt) : meta.body
    if (body !== undefined) {
      let rendered: string
      try {
        rendered = typeof body === "string" ? body : JSON.stringify(body, null, 2)
      } catch {
        rendered = String(body)
      }
      if (rendered) parts.push(`response body:\n${rendered}`)
    }
    return parts.join("\n\n")
  }
  if (typeof err === "string") return err
  try {
    const receipt = readConfigMutationReceipt(err)
    return JSON.stringify(receipt ? configMutationReceiptDiagnostic(receipt) : err, null, 2)
  } catch {
    return String(err)
  }
}
