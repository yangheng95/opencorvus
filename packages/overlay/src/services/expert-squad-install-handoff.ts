
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { createSignal } from "solid-js"
import { openConfigDialog } from "./config-dialog-control"
import { apiJson } from "./api"
import { markExpertSquadCatalogStale, type ExpertSquadImportResult, type ExpertSquadInstallationScope } from "./expert-squad"
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
  await showOverlayWindow()
  await openConfigDialog("expert-squad-install")
}

export async function installExpertSquadInstallHandoffBridge(): Promise<() => void> {
  const unlisten = await listen<string>(EXPERT_SQUAD_INSTALL_HANDOFF_EVENT, ({ payload }) => {
    void acceptExpertSquadInstallHandoff(payload).catch((error) => {
      console.error("[expert-squad-install-handoff] rejected", error)
    })
  })
  const pending = await invoke<string | null>("overlay_expert_squad_install_handoff_take")
  if (pending) await acceptExpertSquadInstallHandoff(pending)
  return unlisten
}
