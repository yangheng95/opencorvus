import { Show, createSignal } from "solid-js"
import { t } from "../../utils/i18n"
import { expertSquadCatalogRequestKey, expertSquadCatalogScope } from "../../services/expert-squad-scope"
import type { ExpertSquadInstallationScope } from "../../services/expert-squad"
import {
  clearExpertSquadInstallHandoff,
  downloadExpertSquadInstallArchive,
  expertSquadInstallHandoff,
  importExactExpertSquadHandoff,
} from "../../services/expert-squad-install-handoff"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { SettingsGroup, SettingsPanel, SettingsState, SettingsSurface } from "./layout"

const EXPERT_SQUAD_MARKET_URL = "https://opencorvus.com/market/"

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : ""
      const comma = value.indexOf(",")
      resolve(comma >= 0 ? value.slice(comma + 1) : value)
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read expert-squad archive"))
    reader.readAsDataURL(blob)
  })
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
}

export default function ExpertSquadMarketPanel() {
  const [busyScope, setBusyScope] = createSignal<ExpertSquadInstallationScope | null>(null)
  const [error, setError] = createSignal("")
  const [notice, setNotice] = createSignal("")

  const installHostedHandoff = async (installationScope: ExpertSquadInstallationScope) => {
    const handoff = expertSquadInstallHandoff()
    const scope = expertSquadCatalogScope()
    if (!handoff || (scope.kind !== "project" && scope.kind !== "session") || busyScope()) return
    const requestKey = expertSquadCatalogRequestKey()

    setBusyScope(installationScope)
    setError("")
    setNotice("")
    try {
      const bytes = await downloadExpertSquadInstallArchive(handoff)
      const archiveSha256 = await sha256Hex(bytes)
      if (archiveSha256 !== handoff.archiveSha256) {
        throw new Error(
          `Hosted Expert Squad archive digest mismatch: expected ${handoff.archiveSha256}, received ${archiveSha256}`,
        )
      }
      if (expertSquadCatalogRequestKey() !== requestKey) {
        throw new Error("The active Expert Squad installation scope changed while downloading the package")
      }
      const result = await importExactExpertSquadHandoff({
        handoff,
        directory: scope.directory,
        archiveBase64: await blobToBase64(new Blob([bytes], { type: "application/zip" })),
        filename: `${handoff.id}-${handoff.version}.zip`,
        installationScope,
      })
      if (
        result.after.namespace !== handoff.namespace ||
        result.after.id !== handoff.id ||
        result.after.version !== handoff.version ||
        result.after.packageDigest !== handoff.packageDigest
      ) {
        throw new Error("Exact Expert Squad import receipt does not match the hosted handoff target")
      }
      clearExpertSquadInstallHandoff(handoff)
      setNotice(t("expert_squad.hosted_handoff_installed", { id: result.after.id }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusyScope(null)
    }
  }

  const scopeAvailable = () => {
    const scope = expertSquadCatalogScope()
    return scope.kind === "project" || scope.kind === "session"
  }

  return (
    <SettingsPanel class="expert-squad-market-entry-panel">
      <Show when={notice()}>
        <SettingsState tone="success">{notice()}</SettingsState>
      </Show>
      <Show when={error()}>
        <SettingsState tone="error">{error()}</SettingsState>
      </Show>

      <SettingsGroup>
        <SettingsSurface class="expert-squad-market-entry" data-ui="expert-squad-market-entry">
          <span class="expert-squad-market-entry-icon" aria-hidden="true">
            <Icon name="config-expert-squad-install" size="display" />
          </span>
          <div class="expert-squad-market-entry-copy">
            <h2>{t("expert_squad.market_title")}</h2>
            <p>{t("expert_squad.market_intro")}</p>
            <span>{t("expert_squad.market_web_note")}</span>
          </div>
          <a
            class="oc-button expert-squad-market-web-action"
            data-variant="solid"
            data-size="md"
            data-tone="accent"
            data-ui="expert-squad-market-web"
            href={EXPERT_SQUAD_MARKET_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="web-search" size="medium" />
            <span>{t("expert_squad.market_open_web")}</span>
          </a>
        </SettingsSurface>
      </SettingsGroup>

      <Show when={expertSquadInstallHandoff()} keyed>
        {(handoff) => (
          <SettingsGroup title={t("expert_squad.hosted_handoff_badge")}>
            <SettingsSurface class="expert-squad-hosted-handoff" data-ui="expert-squad-hosted-handoff">
              <div class="expert-squad-hosted-handoff-copy">
                <Badge tone="accent">{t("expert_squad.hosted_handoff_badge")}</Badge>
                <h2>{t("expert_squad.hosted_handoff_title", { id: handoff.id })}</h2>
                <p>{t("expert_squad.hosted_handoff_body")}</p>
                <code>
                  {handoff.namespace}/{handoff.id}@{handoff.version}
                </code>
                <code>sha256:{handoff.packageDigest}</code>
              </div>
              <div class="expert-squad-hosted-handoff-actions">
                <Button
                  type="button"
                  variant="solid"
                  size="md"
                  tone="accent"
                  onClick={() => void installHostedHandoff("project")}
                  disabled={!scopeAvailable() || busyScope() !== null}
                >
                  {busyScope() === "project" ? t("expert_squad.installing") : t("expert_squad.install_project")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  tone="neutral"
                  onClick={() => void installHostedHandoff("global")}
                  disabled={!scopeAvailable() || busyScope() !== null}
                >
                  {busyScope() === "global" ? t("expert_squad.installing") : t("expert_squad.install_global")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  tone="neutral"
                  onClick={() => clearExpertSquadInstallHandoff(handoff)}
                  disabled={busyScope() !== null}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </SettingsSurface>
          </SettingsGroup>
        )}
      </Show>
    </SettingsPanel>
  )
}
