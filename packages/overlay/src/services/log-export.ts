import { batch, createSignal } from "solid-js"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "./api-state"
import { downloadZipArchive } from "./project-archive"

type LogExportResult = { status: "complete" } | { status: "failed"; error: unknown }
type LogExportOutcome = { status: "pending" } | LogExportResult

const [logExport, setLogExport] = createSignal<{ authority: ApiAuthority; outcome: LogExportOutcome }>()

export function logExportOutcome(): LogExportOutcome | undefined {
  const operation = logExport()
  return operation && isApiAuthorityCurrent(operation.authority) ? operation.outcome : undefined
}

export async function startLogSupportBundleExport(): Promise<void> {
  if (logExportOutcome()?.status === "pending") return

  const authority = captureApiAuthority()
  const download = batch(() => {
    setLogExport({ authority, outcome: { status: "pending" } })
    return downloadZipArchive({ path: "log/export" })
  })

  let outcome: LogExportResult
  try {
    await download
    outcome = { status: "complete" }
  } catch (error) {
    outcome = { status: "failed", error }
  }
  if (isApiAuthorityCurrent(authority)) setLogExport({ authority, outcome })
}
