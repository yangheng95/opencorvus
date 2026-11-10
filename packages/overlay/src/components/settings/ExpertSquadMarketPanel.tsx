import { Feedback } from "../ui/Feedback"
import { Show, createMemo, createResource, createSignal } from "solid-js"
import { localeTag, t, tc } from "../../utils/i18n"
import { formatErrorDetails } from "../../utils/error-details"
import { captureApiAuthority, isApiAuthorityCurrent } from "../../services/api"
import {
  expertSquadCatalogRequestKey,
  expertSquadCatalogRequestKeyForScope,
  expertSquadCatalogScope,
  expertSquadSettingsScope,
} from "../../services/expert-squad-scope"
import {
  importExpertSquadArchive,
  importExpertSquadFolder,
  loadExpertSquadMarket,
  expertSquadPublicPageURL,
  type ExpertSquadInstallationScope,
} from "../../services/expert-squad"
import {
  clearExpertSquadInstallHandoff,
  downloadExpertSquadInstallArchive,
  expertSquadInstallHandoff,
  importExactExpertSquadHandoff,
} from "../../services/expert-squad-install-handoff"
import { getHostTransport } from "../../services/host-transport-runtime"
import { pickDirectory } from "../../services/workspace"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { LinkButton } from "../ui/LinkButton"
import { Icon } from "../ui/Icon"
import { SelectField } from "../ui/SelectField"
import { SettingsGroup, SettingsPanel, SettingsRow, SettingsSurface } from "./layout"
import { secureContextFailure } from "../../utils/secure-context"

type BusyAction = "import-folder" | "import-archive" | `handoff:${ExpertSquadInstallationScope}`

interface CapturedInstallScope {
  directory: string
  identity: string
}

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
  // SubtleCrypto has no equivalent outside a secure context, so this check
  // cannot be performed at all there — say so rather than throwing on undefined.
  if (!crypto.subtle) throw new Error(secureContextFailure("secure_context.subject.package_digest"))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
}

export default function ExpertSquadMarketPanel() {
  const [installationScope, setInstallationScope] = createSignal<ExpertSquadInstallationScope>("global")
  const [busyAction, setBusyAction] = createSignal<BusyAction | null>(null)
  const [error, setError] = createSignal("")
  const [notice, setNotice] = createSignal("")
  let archiveInput: HTMLInputElement | undefined
  let pendingArchiveScope: CapturedInstallScope | null = null
  let marketBrowseLink: HTMLAnchorElement | undefined
  let marketCountFeedback: HTMLDivElement | undefined

  const marketDirectory = createMemo(() => {
    const scope = expertSquadSettingsScope()
    return scope.kind === "project" ? scope.directory : ""
  })
  const marketSource = createMemo(() => {
    const directory = marketDirectory()
    if (!directory) return undefined
    return {
      directory,
      authority: captureApiAuthority(),
      key: expertSquadCatalogRequestKeyForScope({ kind: "project", directory }),
    }
  })
  const [marketRead, { refetch: retryMarketRead }] = createResource(marketSource, async (source) => {
    try {
      const page = await loadExpertSquadMarket(source.directory, { authority: source.authority, limit: 1 })
      if (
        marketSource() === source &&
        isApiAuthorityCurrent(source.authority) &&
        marketCountFeedback?.isConnected &&
        marketBrowseLink?.isConnected &&
        marketCountFeedback.contains(marketCountFeedback.ownerDocument.activeElement)
      ) {
        marketBrowseLink.focus()
      }
      return { source, kind: "ready" as const, count: page.total_count }
    } catch (cause) {
      return { source, kind: "failed" as const, cause }
    }
  })
  const currentMarketRead = createMemo(() => {
    const source = marketSource()
    if (!source || marketRead.state === "unresolved" || marketRead.state === "pending") return undefined
    const result = marketRead.latest
    return result?.source === source ? result : undefined
  })
  const marketFailure = () => {
    const result = currentMarketRead()
    return result?.kind === "failed" ? result : undefined
  }
  const marketCountText = () => {
    const result = currentMarketRead()
    if (result?.kind === "ready") {
      return tc("expert_squad.market_count", result.count, { count: result.count.toLocaleString(localeTag()) })
    }
    return t(marketSource() ? "expert_squad.market_count_loading" : "expert_squad.market_count_scope_required")
  }

  const installScopeIdentity = (): string => {
    const scope = expertSquadCatalogScope()
    if (scope.kind === "project") return `project:${scope.directory}`
    if (scope.kind === "session") return `session:${scope.directory}:${scope.sessionID}`
    return ""
  }

  const captureInstallScope = (): CapturedInstallScope | null => {
    const scope = expertSquadCatalogScope()
    const identity = installScopeIdentity()
    if (!identity || (scope.kind !== "project" && scope.kind !== "session")) return null
    return { directory: scope.directory, identity }
  }

  const importFolder = async () => {
    const captured = captureInstallScope()
    if (!captured || getHostTransport().kind !== "tauri" || busyAction()) return
    const targetScope = installationScope()
    setBusyAction("import-folder")
    setError("")
    setNotice("")
    try {
      const sourceDirectory = await pickDirectory(captured.directory)
      if (!sourceDirectory.trim() || installScopeIdentity() !== captured.identity) return
      const result = await importExpertSquadFolder({
        directory: captured.directory,
        sourceDirectory,
        installationScope: targetScope,
      })
      if (installScopeIdentity() !== captured.identity) return
      setNotice(t("expert_squad.local_installed", { id: result.after.id }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusyAction(null)
    }
  }

  const openArchivePicker = () => {
    const captured = captureInstallScope()
    if (!captured || busyAction()) return
    pendingArchiveScope = captured
    archiveInput?.click()
  }

  const importArchive = async (file: File | undefined) => {
    const captured = pendingArchiveScope
    pendingArchiveScope = null
    if (!captured || !file) {
      if (archiveInput) archiveInput.value = ""
      return
    }
    const targetScope = installationScope()
    setBusyAction("import-archive")
    setError("")
    setNotice("")
    try {
      const archiveBase64 = await blobToBase64(file)
      if (installScopeIdentity() !== captured.identity) return
      const result = await importExpertSquadArchive({
        directory: captured.directory,
        archiveBase64,
        filename: file.name,
        installationScope: targetScope,
      })
      if (installScopeIdentity() !== captured.identity) return
      setNotice(t("expert_squad.local_installed", { id: result.after.id }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusyAction(null)
      if (archiveInput) archiveInput.value = ""
    }
  }

  const installHostedHandoff = async (installationScope: ExpertSquadInstallationScope) => {
    const handoff = expertSquadInstallHandoff()
    const scope = expertSquadCatalogScope()
    if (!handoff || (scope.kind !== "project" && scope.kind !== "session") || busyAction()) return
    const requestKey = expertSquadCatalogRequestKey()

    setBusyAction(`handoff:${installationScope}`)
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
      setBusyAction(null)
    }
  }

  const scopeAvailable = () => {
    const scope = expertSquadCatalogScope()
    return scope.kind === "project" || scope.kind === "session"
  }

  return (
    <SettingsPanel class="expert-squad-market-entry-panel">
      <Show when={notice()}>
        <Feedback tone="success">{notice()}</Feedback>
      </Show>
      <Show when={error()}>
        <Feedback tone="error">{error()}</Feedback>
      </Show>

      <SettingsGroup>
        <SettingsSurface class="expert-squad-market-entry" data-ui="expert-squad-market-entry">
          <div class="expert-squad-market-entry-copy">
            <p>{t("expert_squad.market_intro")}</p>
            <div class="expert-squad-market-facts">
              <Show when={marketFailure()} fallback={<span role="status">{marketCountText()}</span>}>
                {(failure) => (
                  <Feedback
                    ref={marketCountFeedback}
                    tone="error"
                    details={formatErrorDetails(failure().cause)}
                    actions={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tone="neutral"
                        aria-disabled={marketRead.loading || undefined}
                        aria-busy={marketRead.loading || undefined}
                        onClick={() => { if (!marketRead.loading) void retryMarketRead() }}
                      >
                        {t(marketRead.loading ? "common.retrying" : "common.retry")}
                      </Button>
                    }
                  >
                    {t("expert_squad.market_count_failed")}
                  </Feedback>
                )}
              </Show>
            </div>
          </div>
          <div class="expert-squad-market-entry-actions">
            <LinkButton
              ref={marketBrowseLink}
              class="expert-squad-market-web-action"
              variant="solid"
              size="md"
              tone="neutral"
              data-ui="expert-squad-market-web"
              href={expertSquadPublicPageURL({ locale: localeTag(), page: "market" })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="web-search" size="medium" />
              <span>{t("expert_squad.market_open_web")}</span>
            </LinkButton>
            <LinkButton
              class="expert-squad-market-publish-action"
              variant="outline"
              size="md"
              tone="neutral"
              data-ui="expert-squad-market-publish"
              href={expertSquadPublicPageURL({ locale: localeTag(), page: "publish" })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="upload" size="medium" />
              <span>{t("expert_squad.market_publish")}</span>
            </LinkButton>
          </div>
        </SettingsSurface>
      </SettingsGroup>

      <SettingsGroup title={t("expert_squad.local_install_title")} description={t("expert_squad.local_install_body")}>
        <SettingsSurface class="expert-squad-local-install" data-ui="expert-squad-local-install">
          <SettingsRow
            title={t("expert_squad.local_install_scope")}
            desc={t("expert_squad.local_install_scope_note")}
            align="center"
            actions={
              <SelectField
                value={installationScope()}
                options={[
                  { value: "global", label: t("expert_squad.local_scope_global") },
                  { value: "project", label: t("expert_squad.local_scope_project") },
                ]}
                ariaLabel={t("expert_squad.local_install_scope")}
                onChange={(value) => setInstallationScope(value as ExpertSquadInstallationScope)}
                disabled={!scopeAvailable() || busyAction() !== null}
              />
            }
          />
          <SettingsRow
            title={t("expert_squad.local_folder_title")}
            desc={t(
              getHostTransport().kind === "tauri"
                ? "expert_squad.local_folder_body"
                : "expert_squad.local_folder_desktop_only",
            )}
            align="center"
            actions={
              <Button
                type="button"
                variant="outline"
                size="md"
                tone="neutral"
                data-ui="expert-squad-import-folder"
                onClick={() => void importFolder()}
                disabled={!scopeAvailable() || getHostTransport().kind !== "tauri" || busyAction() !== null}
              >
                {busyAction() === "import-folder"
                  ? t("expert_squad.local_installing")
                  : t("expert_squad.local_choose_folder")}
              </Button>
            }
          />
          <SettingsRow
            title={t("expert_squad.local_archive_title")}
            desc={t("expert_squad.local_archive_body")}
            align="center"
            actions={
              <Button
                type="button"
                variant="outline"
                size="md"
                tone="neutral"
                data-ui="expert-squad-import-archive"
                onClick={openArchivePicker}
                disabled={!scopeAvailable() || busyAction() !== null}
              >
                {busyAction() === "import-archive"
                  ? t("expert_squad.local_installing")
                  : t("expert_squad.local_choose_archive")}
              </Button>
            }
          />
          <input
            ref={(element) => {
              archiveInput = element
            }}
            class="expert-squad-file-input"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => void importArchive(event.currentTarget.files?.[0])}
          />
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
                  disabled={!scopeAvailable() || busyAction() !== null}
                >
                  {busyAction() === "handoff:project"
                    ? t("expert_squad.installing")
                    : t("expert_squad.install_project")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  tone="neutral"
                  onClick={() => void installHostedHandoff("global")}
                  disabled={!scopeAvailable() || busyAction() !== null}
                >
                  {busyAction() === "handoff:global" ? t("expert_squad.installing") : t("expert_squad.install_global")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  tone="neutral"
                  onClick={() => clearExpertSquadInstallHandoff(handoff)}
                  disabled={busyAction() !== null}
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
