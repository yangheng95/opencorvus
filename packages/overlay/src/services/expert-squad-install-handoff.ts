import { createSignal } from "solid-js"
import { openConfigDialog } from "./config-dialog-control"
import { apiJson } from "./api"
import {
  markExpertSquadCatalogStale,
  type ExpertSquadImportResult,
  type ExpertSquadInstallationScope,
} from "./expert-squad"
import { getHostTransport } from "./host-transport-runtime"
import {
  acknowledgeExpertSquadInstallHandoff,
  currentExpertSquadInstallHandoff,
  listenTauriEvent,
} from "./tauri-transport"
import { showOverlayWindow } from "./window"
import {
  parseExpertSquadInstallHandoff,
  sameExpertSquadInstallHandoff,
  type ExpertSquadInstallHandoff,
} from "./expert-squad-install-handoff-contract"

export {
  downloadExpertSquadInstallArchive,
  parseExpertSquadInstallHandoff,
  type ExpertSquadInstallHandoff,
} from "./expert-squad-install-handoff-contract"

export const EXPERT_SQUAD_INSTALL_HANDOFF_EVENT = "opencorvus:expert-squad-install"

export async function importExactExpertSquadHandoff(input: {
  handoff: ExpertSquadInstallHandoff
  directory: string
  archiveBase64: string
  filename: string
  installationScope: ExpertSquadInstallationScope
}): Promise<ExpertSquadImportResult> {
  const params = new URLSearchParams({ directory: input.directory.trim() })
  if (!params.get("directory")) throw new Error("Exact Expert Squad install requires a project directory")
  const result = (await apiJson(`expert-squad/import-exact-file?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      archiveBase64: input.archiveBase64,
      filename: input.filename,
      installationScope: input.installationScope,
      expectedNamespace: input.handoff.namespace,
      expectedID: input.handoff.id,
      expectedVersion: input.handoff.version,
      expectedPackageDigest: input.handoff.packageDigest,
    }),
  })) as ExpertSquadImportResult
  markExpertSquadCatalogStale()
  return result
}

const [expertSquadInstallHandoffValue, setExpertSquadInstallHandoffValue] =
  createSignal<ExpertSquadInstallHandoff | null>(null)

export function expertSquadInstallHandoff(): ExpertSquadInstallHandoff | null {
  return expertSquadInstallHandoffValue()
}

export function clearExpertSquadInstallHandoff(expected: ExpertSquadInstallHandoff): void {
  setExpertSquadInstallHandoffValue((current) => (current === expected ? null : current))
}

async function acceptExpertSquadInstallHandoff(raw: string): Promise<void> {
  const parsed = parseExpertSquadInstallHandoff(raw)
  const current = expertSquadInstallHandoffValue()
  if (current && sameExpertSquadInstallHandoff(current, parsed)) return
  setExpertSquadInstallHandoffValue(parsed)
  try {
    await showOverlayWindow()
    await openConfigDialog("expert-squad-install")
  } catch (error) {
    clearExpertSquadInstallHandoff(parsed)
    throw error
  }
}

function reportExpertSquadInstallHandoffError(error: unknown): void {
  console.error("[expert-squad-install-handoff] rejected", error)
}

export function installExpertSquadInstallHandoffBridge(): () => void {
  if (getHostTransport().kind !== "tauri") return () => undefined

  let disposed = false
  let unlisten: (() => void) | undefined
  let reconciliation: Promise<void> | undefined
  let reconciliationRequested = false

  const reconcilePendingHandoff = async (): Promise<void> => {
    while (!disposed) {
      reconciliationRequested = false
      const pending = await currentExpertSquadInstallHandoff()
      if (!pending || disposed) return

      await acceptExpertSquadInstallHandoff(pending)
      if (disposed) return

      const acknowledged = await acknowledgeExpertSquadInstallHandoff(pending)
      if (acknowledged && !reconciliationRequested) return
    }
  }

  const requestReconciliation = (): void => {
    if (disposed) return
    if (reconciliation) {
      reconciliationRequested = true
      return
    }
    reconciliation = reconcilePendingHandoff()
      .catch(reportExpertSquadInstallHandoffError)
      .finally(() => {
        reconciliation = undefined
        if (reconciliationRequested && !disposed) requestReconciliation()
      })
  }

  void listenTauriEvent<string>(EXPERT_SQUAD_INSTALL_HANDOFF_EVENT, () => {
    requestReconciliation()
  }).then((registeredUnlisten) => {
    if (disposed) {
      registeredUnlisten()
      return
    }
    unlisten = registeredUnlisten
    requestReconciliation()
  }, reportExpertSquadInstallHandoffError)

  return () => {
    disposed = true
    unlisten?.()
    unlisten = undefined
  }
}
