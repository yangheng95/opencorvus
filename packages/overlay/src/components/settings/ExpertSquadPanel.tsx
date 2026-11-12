import {
  squadSelectionKey,
  squadInstallationKey,
  parseSquadInstallationKey,
  type SquadRefreshSelection,
} from "../../services/expert-squad-selection"
import { ApiAuthorityChangedError, ApiError, captureApiAuthority, isApiAuthorityCurrent } from "../../services/api"
import { formatErrorDetails } from "../../services/diagnostics"
import { Feedback } from "../ui/Feedback"
// ── ExpertSquadPanel ──
// Dynamic expert-squad catalog surface. Active selection remains config-owned
// via prompt_profile.active; this panel edits only that existing config field.

import { batch, createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { localeTag, t } from "../../utils/i18n"
import { expertSquadDescription } from "../../utils/expert-squad-description"
import { renderMarkdown } from "../../utils/markdown"
import {
  clearSessionExpertSquadOverride,
  clearExpertSquadUninstallReceipt,
  exportExpertSquadArchive,
  updateExpertSquadPackage,
  repairObsoleteBundledExpertSquads,
  uninstallExpertSquadPackage,
  expertSquadUninstallReceipt,
  loadExpertSquadCatalog,
  loadExpertSquadConfiguration,
  loadExpertSquadInventoryStatus,
  loadExpertSquadDiagnostics,
  loadExpertSquadMarket,
  loadExpertSquadMarketDetail,
  loadExpertSquadSettings,
  inspectExpertSquad,
  searchExpertSquads,
  setProjectExpertSquadActive,
  setSessionExpertSquadActive,
  updateExpertSquadConfiguration,
  type ExpertSquadCatalog,
  type ExpertSquadConfiguration,
  type ExpertSquadDetail,
  type ExpertSquadSettingsSurface,
  type ExpertSquadMarketItem,
  type ExpertSquadMarketIndexItem,
  type ExpertSquadInventoryStatus,
  type ExpertSquadDiagnosticsPage,
  type ExpertSquadOption,
  type ExpertSquadInstallationScope,
  type ExpertSquadUpdateSource,
} from "../../services/expert-squad"
import {
  expertSquadCatalogDirectory,
  expertSquadCatalogRequestKey,
  expertSquadCatalogScope,
  expertSquadCatalogScopeIdentity,
} from "../../services/expert-squad-scope"
import { Button } from "../ui/Button"
import { Badge } from "../ui/Badge"
import { Disclosure } from "../ui/Disclosure"
import { DropdownMenu } from "../ui/DropdownMenu"
import { Icon, type IconName } from "../ui/Icon"
import { Tab, TabList, TabPanel, Tabs } from "../ui/Tabs"
import { SettingsGroup, SettingsPanel, SettingsRow, SettingsSurface } from "./layout"
import { showAppDialog } from "../../services/app-dialog"
import { TextField } from "../ui/TextField"
import { Switch } from "../ui/Switch"
import ExpertSquadEvolutionPanel from "./ExpertSquadEvolutionPanel"
import { CapabilityRefCodec, type CapabilityKind } from "@opencorvus-ai/util/capability-ref"

function markdownHtml(value: string): string {
  if (!value.trim()) {
    return `<p class="empty-hint">${t("expert_squad.preview_empty")}</p>`
  }
  return renderMarkdown(value)
}

type ExpertSquadSelectionIdentity = Pick<ExpertSquadOption, "id" | "source"> | Pick<ExpertSquadDetail, "id" | "source">

function sourceLabel(squad: ExpertSquadSelectionIdentity): string {
  if (squad.source.kind === "built_in") return t("expert_squad.built_in")
  return squad.source.installation_scope === "project"
    ? t("expert_squad.package_project")
    : t("expert_squad.package_global")
}

function hasBuiltinMarketSource(squad: ExpertSquadDetail, market: ExpertSquadMarketItem[]): boolean {
  if (squad.source.kind !== "installed_package") return false
  const namespace = squad.source.namespace
  return market.some((item) => item.id === squad.id && item.namespace === namespace)
}

function installedPackageScope(squad: ExpertSquadDetail): ExpertSquadInstallationScope | "" {
  return squad.source.kind === "installed_package" ? squad.source.installation_scope : ""
}

function generationTrace(squad: ExpertSquadDetail) {
  return squad.source.kind === "installed_package" ? squad.source.generation : undefined
}

function generationMethodLabel(method: "sdk_authoring" | "heterogeneous_import"): string {
  return t(
    method === "sdk_authoring" ? "expert_squad.generation_method_authoring" : "expert_squad.generation_method_import",
  )
}

function catalogDirectoryLabel(): string {
  const directory = expertSquadCatalogDirectory().trim()
  return directory ? directory : t("expert_squad.directory_unavailable")
}

type ProjectionEntry = Pick<ExpertSquadDetail["capability_projection"]["scheduler"], "capability_refs">
type CapabilitySets = ExpertSquadDetail["capability_sets"]

function projectionLeafRefs(entry: ProjectionEntry, capabilitySets: CapabilitySets) {
  return entry.capability_refs.flatMap((encoded) => {
    const capability = CapabilityRefCodec.decode(encoded)
    if (capability.kind !== "capability_set") return [capability]
    if (capability.source !== "package") return []
    const definition = capabilitySets[capability.local_ref]
    if (!definition) throw new Error(`Missing package capability set ${capability.local_ref}`)
    return definition.member_refs.map(CapabilityRefCodec.decode)
  })
}

type CapabilityOrigin = "built_in" | "default" | "package"
type McpCapabilityKind = "server" | "tool" | "prompt" | "resource"

interface CapabilityItem {
  ref: string
  origin: CapabilityOrigin
  mcpKind?: McpCapabilityKind
}

function capabilityItems(
  entry: ProjectionEntry,
  capabilitySets: CapabilitySets,
  kinds: readonly CapabilityKind[],
): CapabilityItem[] {
  return projectionLeafRefs(entry, capabilitySets).flatMap((capability) => {
    if (!kinds.includes(capability.kind)) return []
    const origin: CapabilityOrigin =
      capability.source === "package"
        ? "package"
        : capability.source === "platform" && capability.owner_ref === "tool-registry"
          ? "built_in"
          : "default"
    const mcpKind = capability.kind.startsWith("mcp_")
      ? (capability.kind.slice("mcp_".length) as McpCapabilityKind)
      : undefined
    return [{ ref: capability.local_ref, origin, ...(mcpKind ? { mcpKind } : {}) }]
  })
}

function skillCapabilityItems(entry: ProjectionEntry, capabilitySets: CapabilitySets): CapabilityItem[] {
  return capabilityItems(entry, capabilitySets, ["skill"])
}

function toolCapabilityItems(entry: ProjectionEntry, capabilitySets: CapabilitySets): CapabilityItem[] {
  return capabilityItems(entry, capabilitySets, ["tool"])
}

function mcpCapabilityItems(entry: ProjectionEntry, capabilitySets: CapabilitySets): CapabilityItem[] {
  return capabilityItems(entry, capabilitySets, ["mcp_server", "mcp_tool", "mcp_prompt", "mcp_resource"])
}

function capabilityOriginLabel(origin: CapabilityOrigin): string {
  if (origin === "built_in") return t("expert_squad.origin_built_in")
  if (origin === "default") return t("expert_squad.origin_default")
  return t("expert_squad.origin_package")
}

function mcpCapabilityKindLabel(kind: McpCapabilityKind | undefined): string {
  if (kind === "server") return t("expert_squad.mcp_server")
  if (kind === "tool") return t("expert_squad.mcp_tool")
  if (kind === "prompt") return t("expert_squad.mcp_prompt")
  if (kind === "resource") return t("expert_squad.mcp_resource")
  return ""
}

function AgentCapabilityGroup(props: {
  kind: "tools" | "skills" | "mcp"
  title: string
  icon: IconName
  items: CapabilityItem[]
}) {
  return (
    <section class="expert-squad-capability-group" data-capability={props.kind}>
      <header class="expert-squad-capability-head">
        <span class="expert-squad-capability-icon" aria-hidden="true">
          <Icon name={props.icon} size="medium" />
        </span>
        <h3>{props.title}</h3>
        <span class="expert-squad-capability-count">{props.items.length}</span>
      </header>
      <div class="expert-squad-capability-list">
        <Show
          when={props.items.length > 0}
          fallback={<span class="expert-squad-capability-empty">{t("expert_squad.access_none")}</span>}
        >
          <For each={props.items}>
            {(item) => (
              <div class="expert-squad-capability-item" data-origin={item.origin}>
                <code>{item.ref}</code>
                <span class="expert-squad-capability-item-meta">
                  {capabilityOriginLabel(item.origin)}
                  <Show when={item.mcpKind}> · {mcpCapabilityKindLabel(item.mcpKind)}</Show>
                </span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </section>
  )
}

function projectionRows(entry: ProjectionEntry) {
  return [["capability_refs", entry.capability_refs]] as const
}

function catalogScopeIdentity(scope = expertSquadCatalogScope()): string {
  return expertSquadCatalogScopeIdentity(scope)
}

type WritableCatalogScope = Extract<ReturnType<typeof expertSquadCatalogScope>, { kind: "project" | "session" }>
type CapturedCatalogActionScope = { scope: WritableCatalogScope; identity: string }
type MarketInstallation = ExpertSquadMarketItem["installations"][number]
const EMPTY_MARKET_DIGEST = "0".repeat(64)

function marketIndexView(item: ExpertSquadMarketIndexItem): ExpertSquadMarketItem {
  return {
    ...item,
    package_digest: EMPTY_MARKET_DIGEST,
    selector_summary: "",
    agents: [],
    skill_count: 0,
    tool_count: 0,
    mcp_count: 0,
    installations: item.installation_scopes.map((installation_scope) => ({
      installation_scope,
      installed_version: null,
      installed_package_digest: EMPTY_MARKET_DIGEST,
      update_available: false,
    })),
  }
}
type BusyAction = {
  key: string
  scopeIdentity: string
  itemID?: string
  installationScope?: ExpertSquadInstallationScope
}
type CatalogFilter = "all" | "active" | "package" | "built_in"
type InstalledSquadSection = "overview" | "agents" | "configuration" | "evolution" | "package"
type CatalogDiscoveryIssue = Extract<ExpertSquadDiagnosticsPage["entries"][number], { kind: "issue" }>["issue"]
type CatalogDiagnosticsSnapshot = Pick<ExpertSquadDiagnosticsPage, "entries" | "next_cursor" | "total_count">
type DiagnosticContinuation = { kind: "loading" } | { kind: "failed"; error: unknown }
type InstallationContinuationFailure = { error: unknown; action: "retry" | "refresh" }
type InstallationContinuation =
  | { kind: "loading"; failure?: InstallationContinuationFailure }
  | { kind: "failed"; failure: InstallationContinuationFailure }

function installationContinuationFailure(error: unknown): InstallationContinuationFailure {
  if (error instanceof ApiError && error.body && typeof error.body === "object" && "name" in error.body) {
    if (
      (error.status === 409 && error.body.name === "ExpertSquadCatalogRevisionConflictError") ||
      (error.status === 400 && error.body.name === "ExpertSquadCatalogCursorInvalidError")
    ) {
      return { error, action: "refresh" }
    }
  }
  return { error, action: "retry" }
}

type InstalledDetailRead = { identity: string } & (
  | { kind: "loading" }
  | { kind: "failed" | "retrying"; error: unknown }
  | { kind: "ready"; surface: ExpertSquadSettingsSurface }
)

const catalogIssueLabels = {
  "location.scan": "expert_squad.catalog_issue.location",
  "namespace.scan": "expert_squad.catalog_issue.namespace",
  "package.identity": "expert_squad.catalog_issue.identity",
  "package.catalog": "expert_squad.catalog_issue.package",
  "identity.duplicate": "expert_squad.catalog_issue.duplicate",
} satisfies Record<CatalogDiscoveryIssue["phase"], string>

function catalogFilterLabel(filter: CatalogFilter): string {
  if (filter === "active") return t("expert_squad.filter_active")
  if (filter === "package") return t("expert_squad.filter_package")
  if (filter === "built_in") return t("expert_squad.filter_built_in")
  return t("expert_squad.filter_all")
}

function captureCatalogActionScope(): CapturedCatalogActionScope | null {
  const scope = expertSquadCatalogScope()
  if (scope.kind !== "project" && scope.kind !== "session") return null
  return { scope, identity: catalogScopeIdentity(scope) }
}

function saveBase64Archive(filename: string, archiveBase64: string): void {
  const binary = atob(archiveBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: "application/zip" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function ExpertSquadPanel() {
  const [selectedSquadID, setSelectedSquadID] = createSignal("")
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [catalog, setCatalog] = createSignal<ExpertSquadCatalog | null>(null)
  const [catalogEntries, setCatalogEntries] = createSignal<ExpertSquadOption[]>([])
  const [catalogNextCursor, setCatalogNextCursor] = createSignal<string | null>(null)
  const [installationContinuation, setInstallationContinuation] = createSignal<InstallationContinuation>()
  const installationPageBusy = () => installationContinuation()?.kind === "loading"
  const installationPageFailure = () => installationContinuation()?.failure
  const installationPageActionLabel = () => {
    const failure = installationPageFailure()
    if (installationPageBusy()) return t(failure ? "common.retrying" : "common.loading")
    if (failure?.action === "refresh") return t("expert_squad.refresh_catalog")
    return t(failure ? "common.retry" : "expert_squad.load_more")
  }
  const [inventoryStatus, setInventoryStatus] = createSignal<ExpertSquadInventoryStatus | null>(null)
  const [catalogDiagnostics, setCatalogDiagnostics] = createSignal<CatalogDiagnosticsSnapshot | null>(null)
  const [catalogDiagnosticsOpen, setCatalogDiagnosticsOpen] = createSignal(false)
  const [diagnosticContinuation, setDiagnosticContinuation] = createSignal<DiagnosticContinuation | null>(null)
  const [installedDetailRead, setInstalledDetailRead] = createSignal<InstalledDetailRead>()
  const [notice, setNotice] = createSignal("")
  const [noticeTone, setNoticeTone] = createSignal("")
  const [busy, setBusy] = createSignal<BusyAction | null>(null)
  const [marketBusy, setMarketBusy] = createSignal<BusyAction[]>([])
  const [loading, setLoading] = createSignal(false)
  const diagnosticActionBusy = () => loading() || diagnosticContinuation()?.kind === "loading"
  const diagnosticContinuationFailure = () => {
    const state = diagnosticContinuation()
    return state?.kind === "failed" ? state : undefined
  }
  const [market, setMarket] = createSignal<ExpertSquadMarketItem[]>([])
  const [marketIdentity, setMarketIdentity] = createSignal("")
  const [marketLoading, setMarketLoading] = createSignal(false)
  const [catalogFilter, setCatalogFilter] = createSignal<CatalogFilter>("all")
  const [catalogError, setCatalogError] = createSignal<{ error: unknown } | null>(null)
  const [catalogIdentity, setCatalogIdentity] = createSignal("")
  const [actionError, setActionError] = createSignal("")
  const [configuration, setConfiguration] = createSignal<ExpertSquadConfiguration | null>(null)
  const [configurationValues, setConfigurationValues] = createSignal<Record<string, string | boolean>>({})
  const [configurationClears, setConfigurationClears] = createSignal<Record<string, boolean>>({})
  const [configurationLoading, setConfigurationLoading] = createSignal(false)
  const [configurationSaving, setConfigurationSaving] = createSignal(false)
  const [configurationError, setConfigurationError] = createSignal("")
  const [expandedAgentIDs, setExpandedAgentIDs] = createSignal<ReadonlySet<string>>(new Set())
  const [installedSquadSection, setInstalledSquadSection] = createSignal<InstalledSquadSection>("overview")

  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let loadSequence = 0
  let detailLoadSequence = 0
  let marketLoadSequence = 0
  let marketDetailLoadSequence = 0
  let configurationLoadSequence = 0
  let configurationSaveSequence = 0
  let installedFocusSequence = 0
  let installedOpenerKey = ""
  let installedLayout: HTMLDivElement | undefined
  let installedBackButton: HTMLButtonElement | undefined
  let installedDetailHeading: HTMLHeadingElement | undefined
  let installationsMoreButton: HTMLButtonElement | undefined
  let installationsFooter: HTMLDivElement | undefined
  let diagnosticDisclosure: HTMLDetailsElement | undefined
  let diagnosticsMoreButton: HTMLButtonElement | undefined

  const currentScope = createMemo(() => expertSquadCatalogScope())
  const currentScopeIdentity = createMemo(() => catalogScopeIdentity(currentScope()))
  onCleanup(() => {
    loadSequence++
    installedFocusSequence++
  })
  createEffect(() => {
    currentScopeIdentity()
    installedFocusSequence++
    installedOpenerKey = ""
    setDetailOpen(false)
    setCatalogDiagnosticsOpen(false)
  })

  function changeInstalledView(change: () => void, target: () => HTMLElement | null | undefined) {
    const authority = captureApiAuthority()
    const scope = currentScopeIdentity()
    const origin = document.activeElement
    const sequence = ++installedFocusSequence
    change()
    queueMicrotask(() => {
      if (sequence !== installedFocusSequence || currentScopeIdentity() !== scope || !isApiAuthorityCurrent(authority)) return
      if (!installedLayout?.isConnected || (document.activeElement !== origin && document.activeElement !== document.body)) return
      const element = target()
      if (element?.isConnected) element.focus()
    })
  }

  function openInstalledDetail(key: string) {
    changeInstalledView(
      () => {
        installedOpenerKey = key
        setSelectedSquadID(key)
        setDetailOpen(true)
      },
      () => detailOpen() ? installedBackButton : undefined,
    )
  }

  function installedRow(key: string) {
    return installedLayout?.querySelector<HTMLButtonElement>(`[data-squad-selection-key="${CSS.escape(key)}"]`)
  }

  function selectedInstalledFilter() {
    return installedLayout?.querySelector<HTMLButtonElement>('[data-ui="expert-squad-catalog-filter"][aria-pressed="true"]')
  }

  function returnToInstalledCatalog() {
    const key = installedOpenerKey
    changeInstalledView(
      () => {
        installedOpenerKey = ""
        setDetailOpen(false)
      },
      () => !detailOpen() ? installedRow(key) ?? selectedInstalledFilter() : undefined,
    )
  }

  const writableScopeAvailable = createMemo(() => {
    const scope = currentScope()
    return scope.kind === "project" || scope.kind === "session"
  })
  const activeBusy = createMemo(() => {
    const action = busy()
    return action?.scopeIdentity === currentScopeIdentity() ? action.key : ""
  })
  const activeMarketBusyKeys = createMemo(() => {
    const scopeIdentity = currentScopeIdentity()
    return new Set(
      marketBusy()
        .filter((action) => action.scopeIdentity === scopeIdentity)
        .map((action) => action.key),
    )
  })
  const activeMarketActions = createMemo(() => {
    const scopeIdentity = currentScopeIdentity()
    return marketBusy().filter((action) => action.scopeIdentity === scopeIdentity)
  })
  const isMarketInstallationBusy = (itemID: string, installationScope: ExpertSquadInstallationScope) =>
    activeMarketActions().some((action) => action.itemID === itemID && action.installationScope === installationScope)
  const isMarketActionBusy = (key: string) => activeMarketBusyKeys().has(key)
  const requestKey = createMemo(() => expertSquadCatalogRequestKey())
  const currentScopeSessionID = createMemo(() => {
    const scope = currentScope()
    return scope.kind === "session" ? scope.sessionID : ""
  })
  const scopedCatalog = createMemo(() => (catalogIdentity() === currentScopeIdentity() ? catalog() : null))
  const squads = createMemo(() => (catalogIdentity() === currentScopeIdentity() ? catalogEntries() : []))
  const diagnosticCount = createMemo(() =>
    catalogIdentity() === currentScopeIdentity() ? catalogDiagnostics()?.total_count ?? 0 : 0,
  )
  const scopedMarket = createMemo(() => (marketIdentity() === currentScopeIdentity() ? market() : []))
  const recoveryUpdates = createMemo(() =>
    scopedMarket().flatMap((item) =>
      item.installations
        .filter((installation) => installation.update_available)
        .map((installation) => ({
          item,
          installation,
        })),
    ),
  )
  const projectActiveID = createMemo(() => scopedCatalog()?.active.project ?? "")
  const sessionOverrideID = createMemo(() => scopedCatalog()?.active.session_override ?? "")
  const effectiveActiveID = createMemo(() => scopedCatalog()?.active.effective ?? "")
  const effectiveInstallationKey = (id: string) => {
    const revision = scopedCatalog()?.active.package_revision
    if (!revision || revision.id !== id) return ""
    return squadInstallationKey(
      revision.scope === "built_in"
        ? { installationScope: "built_in", id }
        : { installationScope: revision.scope, namespace: revision.namespace, id },
    )
  }
  const isEffectiveInstallation = (squad: ExpertSquadSelectionIdentity) =>
    effectiveInstallationKey(squad.id) === squadSelectionKey(squad)
  const isProjectActiveInstallation = (squad: ExpertSquadSelectionIdentity) =>
    projectActiveID() === squad.id && isSelectableInstallation(squad)
  const isSessionOverrideInstallation = (squad: ExpertSquadSelectionIdentity) =>
    sessionOverrideID() === squad.id && isEffectiveInstallation(squad)
  const activeAgentProjection = createMemo(() => scopedCatalog()?.active_agent_projection ?? null)
  const filteredSquads = createMemo(() => {
    const filter = catalogFilter()
    return squads().filter((squad) => {
      if (filter === "active") return effectiveActiveID() === squad.id && isEffectiveInstallation(squad)
      if (filter === "package") return !squad.built_in
      if (filter === "built_in") return squad.built_in
      return true
    })
  })
  const currentSquadIndex = createMemo(() => {
    const list = filteredSquads()
    return list.find((squad) => squadSelectionKey(squad) === selectedSquadID()) ?? list[0]
  })
  const selectedDetailKey = createMemo(() => {
    const squad = currentSquadIndex()
    return squad ? `${currentScopeIdentity()}\n${squadSelectionKey(squad)}` : ""
  })
  const currentDetailRead = createMemo(() => {
    const read = installedDetailRead()
    return read?.identity === selectedDetailKey() ? read : undefined
  })
  const selectedDetailFailure = createMemo(() => {
    const read = currentDetailRead()
    return read?.kind === "failed" || read?.kind === "retrying" ? read : undefined
  })
  const selectedDetailRetrying = () => currentDetailRead()?.kind === "retrying"
  const currentSelectedSurface = createMemo(() => {
    const read = currentDetailRead()
    return read?.kind === "ready" ? read.surface : null
  })
  const currentSquad = createMemo(() => currentSelectedSurface()?.selected ?? null)
  const isSelectableInstallation = (squad: ExpertSquadSelectionIdentity) => {
    const surface = currentSelectedSurface()
    const winner = surface?.selection.effective_identity
    return !!surface && squadSelectionKey(surface.selected) === squadSelectionKey(squad) && !!winner &&
      squadSelectionKey(winner) === squadSelectionKey(squad)
  }
  const fixedTaskID = createMemo(() => {
    const scope = currentScope()
    return scope.kind === "session" ? scope.taskID ?? "" : ""
  })
  const canActivateProject = () => {
    const squad = currentSquad()
    return !!squad && !!scopedCatalog() && writableScopeAvailable() && !activeBusy() && isSelectableInstallation(squad) && projectActiveID() !== squad.id
  }
  const canActivateSession = () => {
    const squad = currentSquad()
    return !!squad && !!scopedCatalog() && !!currentScopeSessionID() && !fixedTaskID() && writableScopeAvailable() && !activeBusy() &&
      isSelectableInstallation(squad) && sessionOverrideID() !== squad.id
  }
  const canClearSessionOverride = () => !!currentScopeSessionID() && !fixedTaskID() && writableScopeAvailable() && !activeBusy() && !!sessionOverrideID()
  createEffect<string>((previousSelectionIdentity) => {
    const squad = currentSquadIndex()
    const selectionIdentity = `${currentScopeIdentity()}\n${squad ? squadSelectionKey(squad) : ""}`
    if (selectionIdentity !== previousSelectionIdentity) {
      configurationLoadSequence++
      configurationSaveSequence++
      setExpandedAgentIDs(new Set<string>())
      setInstalledSquadSection("overview")
      setConfiguration(null)
      setConfigurationValues({})
      setConfigurationClears({})
      setConfigurationLoading(false)
      setConfigurationSaving(false)
      setConfigurationError("")
    }
    return selectionIdentity
  }, "")

  function loadSelectedDetail(retryButton?: HTMLButtonElement): void {
    const failure = retryButton ? selectedDetailFailure() : undefined
    if (retryButton && failure?.kind !== "failed") return
    const squad = currentSquadIndex()
    const scope = currentScope()
    const identity = selectedDetailKey()
    const sequence = ++detailLoadSequence
    if (!squad || (scope.kind !== "project" && scope.kind !== "session")) {
      setInstalledDetailRead(undefined)
      return
    }
    setInstalledDetailRead(failure ? { kind: "retrying", identity, error: failure.error } : { kind: "loading", identity })
    const authority = captureApiAuthority()
    const navigation = installedFocusSequence
    const owns = () => sequence === detailLoadSequence && selectedDetailKey() === identity
    const installationScope = squad.source.kind === "built_in" ? "built_in" : squad.source.installation_scope
    const namespace = squad.source.kind === "installed_package" ? squad.source.namespace : undefined
    void loadExpertSquadSettings(scope.directory, squad.id, installationScope, namespace, authority)
      .then((surface) => {
        if (!owns()) return
        const restoreFocus = retryButton && document.activeElement === retryButton
        setInstalledDetailRead({ kind: "ready", identity, surface })
        if (!restoreFocus) return
        queueMicrotask(() => {
          if (!owns() || !isApiAuthorityCurrent(authority) || navigation !== installedFocusSequence || !detailOpen()) return
          if (!installedLayout?.isConnected || !installedDetailHeading?.isConnected || document.activeElement !== document.body) return
          installedDetailHeading.focus()
        })
      })
      .catch((error) => {
        if (!owns()) return
        setInstalledDetailRead(error instanceof ApiAuthorityChangedError ? undefined : { kind: "failed", identity, error })
      })
  }
  createEffect(() => loadSelectedDetail())

  function setAgentExpanded(agentID: string, open: boolean): void {
    setExpandedAgentIDs((current) => {
      const next = new Set(current)
      if (open) next.add(agentID)
      else next.delete(agentID)
      return next
    })
  }
  const scopeStatus = createMemo(() => {
    const scope = currentScope()
    if (scope.kind === "pending") {
      return {
        status: "pending",
        title: t("expert_squad.scope_pending_title"),
        body: t("expert_squad.scope_pending_body"),
      }
    }
    if (scope.kind === "unavailable") {
      return {
        status: "unavailable",
        title: t("expert_squad.scope_unavailable_title"),
        body: t("expert_squad.scope_unavailable_body"),
      }
    }
    return null
  })

  async function refreshCatalog(
    selection?: SquadRefreshSelection,
    scope = expertSquadCatalogScope(),
    expectedScopeIdentity = catalogScopeIdentity(scope),
  ): Promise<void> {
    setInstallationContinuation(undefined)
    if (scope.kind === "unavailable" || scope.kind === "pending") {
      loadSequence++
      setDiagnosticContinuation(null)
      setCatalog(null)
      setCatalogEntries([])
      setCatalogNextCursor(null)
      setInventoryStatus(null)
      setCatalogDiagnostics(null)
      setCatalogIdentity("")
      setCatalogError(null)
      setLoading(false)
      return
    }
    const selectionAtEntry = selectedSquadID()
    setLoading(true)
    setDiagnosticContinuation(null)
    if (currentScopeIdentity() === expectedScopeIdentity) setCatalogError(null)
    const sequence = ++loadSequence
    try {
      const repair = await repairObsoleteBundledExpertSquads(scope.directory)
      if (repair.repaired.length || repair.failures.length) {
        const packages = repair.repaired
          .map(
            ({ before, after }) =>
              `${after.id} (${t(after.installationScope === "project" ? "expert_squad.package_project" : "expert_squad.package_global")}): ${before?.version ?? t("expert_squad.version_unknown")} → ${after.version}`,
          )
          .join("\n")
        const failures = repair.failures
          .map((item) => `${item.id} (${item.installationScope}): ${item.message}`)
          .join("\n")
        void showAppDialog({
          title: t("expert_squad.obsolete_replaced_title"),
          message: [packages && t("expert_squad.obsolete_replaced_body", { packages }), failures]
            .filter(Boolean)
            .join("\n\n"),
          cancel: false,
        })
        if (repair.repaired.length)
          void refreshMarket(undefined, scope, expectedScopeIdentity).catch((error) => {
            if (currentScopeIdentity() === expectedScopeIdentity) setActionError(String(error))
          })
      }
      if (
        sequence !== loadSequence ||
        currentScopeIdentity() !== expectedScopeIdentity ||
        selectedSquadID() !== selectionAtEntry
      )
        return
      const [next, entries, status, diagnostics] = await Promise.all([
        loadExpertSquadCatalog(scope),
        searchExpertSquads({ directory: scope.directory, view: "installations", limit: 20 }),
        loadExpertSquadInventoryStatus(scope.directory),
        loadExpertSquadDiagnostics(scope.directory, { limit: 20 }),
      ])
      if (
        sequence !== loadSequence ||
        currentScopeIdentity() !== expectedScopeIdentity ||
        selectedSquadID() !== selectionAtEntry
      )
        return
      const installations = [...entries.entries]
      const revision = next.active.package_revision
      const activeKey = squadInstallationKey(
        revision.scope === "built_in"
          ? { installationScope: "built_in", id: revision.id }
          : { installationScope: revision.scope, namespace: revision.namespace, id: revision.id },
      )
      const desired = selection?.kind === "effective" ? activeKey : (selection?.key ?? selectedSquadID())
      const exactRequests = [parseSquadInstallationKey(activeKey)]
      if (desired && desired !== activeKey) exactRequests.push(parseSquadInstallationKey(desired))
      for (const request of exactRequests) {
        const present = installations.some((entry) => squadSelectionKey(entry) === squadInstallationKey(request))
        if (present) continue
        const exact = await inspectExpertSquad({ directory: scope.directory, ...request })
        installations.unshift(exact)
      }
      if (
        sequence !== loadSequence ||
        currentScopeIdentity() !== expectedScopeIdentity ||
        selectedSquadID() !== selectionAtEntry
      )
        return
      setCatalog(next)
      setCatalogEntries(installations)
      setCatalogNextCursor(entries.next_cursor)
      setInventoryStatus(status)
      setCatalogDiagnostics(diagnostics)
      setCatalogIdentity(expectedScopeIdentity)
      setCatalogError(null)
      const selected =
        installations.find((squad) => squadSelectionKey(squad) === desired) ??
        installations.find((squad) => squadSelectionKey(squad) === activeKey) ??
        installations[0]
      setSelectedSquadID(selected ? squadSelectionKey(selected) : "")
    } catch (error) {
      if (
        !(error instanceof ApiAuthorityChangedError) &&
        sequence === loadSequence &&
        currentScopeIdentity() === expectedScopeIdentity &&
        selectedSquadID() === selectionAtEntry
      ) {
        setCatalogError({ error })
      }
      throw error
    } finally {
      if (sequence === loadSequence && currentScopeIdentity() === expectedScopeIdentity) setLoading(false)
    }
  }

  async function refreshMarket(
    nextSelectedID?: string,
    scope = expertSquadCatalogScope(),
    expectedScopeIdentity = catalogScopeIdentity(scope),
  ): Promise<void> {
    marketDetailLoadSequence++
    if (scope.kind === "unavailable" || scope.kind === "pending") {
      marketLoadSequence++
      setMarket([])
      setMarketIdentity("")
      setMarketLoading(false)
      return
    }
    setMarketLoading(true)
    const sequence = ++marketLoadSequence
    try {
      const next = await loadExpertSquadMarket(scope.directory, { availability: "all", limit: 20 })
      const exactIDs = [nextSelectedID, currentSquadIndex()?.id, effectiveActiveID()].filter((id): id is string =>
        Boolean(id),
      )
      const exactResults = await Promise.allSettled(
        [...new Set(exactIDs)].map((id) => loadExpertSquadMarketDetail(scope.directory, id)),
      )
      if (sequence !== marketLoadSequence || currentScopeIdentity() !== expectedScopeIdentity) return
      const items = new Map(next.entries.map((item) => [item.id, marketIndexView(item)]))
      for (const result of exactResults) {
        if (result.status === "fulfilled") items.set(result.value.id, result.value)
      }
      setMarket([...items.values()])
      setMarketIdentity(expectedScopeIdentity)
    } finally {
      if (sequence === marketLoadSequence && currentScopeIdentity() === expectedScopeIdentity) setMarketLoading(false)
    }
  }

  async function loadMoreCatalog(): Promise<void> {
    const scope = currentScope()
    const cursor = catalogNextCursor()
    if (!cursor || (scope.kind !== "project" && scope.kind !== "session") || loading() || installationPageBusy()) return
    const sequence = loadSequence
    const expectedScopeIdentity = currentScopeIdentity()
    const authority = captureApiAuthority()
    const origin = document.activeElement === installationsMoreButton ? installationsMoreButton : undefined
    const owns = () =>
      sequence === loadSequence && currentScopeIdentity() === expectedScopeIdentity && catalogNextCursor() === cursor
    setInstallationContinuation({ kind: "loading", failure: installationPageFailure() })
    try {
      const page = await searchExpertSquads({
        directory: scope.directory,
        view: "installations",
        cursor,
        limit: 20,
        authority,
      })
      if (!owns()) return
      if (!isApiAuthorityCurrent(authority)) {
        setInstallationContinuation(undefined)
        return
      }
      const existing = new Set(squads().map(squadSelectionKey))
      const additions = page.entries.filter((entry) => !existing.has(squadSelectionKey(entry)))
      const accept = () =>
        batch(() => {
          setCatalogEntries((current) => [...current, ...additions])
          setCatalogNextCursor(page.next_cursor)
          setInstallationContinuation(undefined)
        })
      if (origin && document.activeElement === origin) {
        const addedKeys = new Set(additions.map(squadSelectionKey))
        changeInstalledView(accept, () => {
          if (detailOpen()) return
          const firstVisible = filteredSquads().find((entry) => addedKeys.has(squadSelectionKey(entry)))
          return (firstVisible ? installedRow(squadSelectionKey(firstVisible)) : undefined)
            ?? (installationsMoreButton?.isConnected ? installationsMoreButton : selectedInstalledFilter())
        })
      } else {
        accept()
      }
    } catch (error) {
      if (owns()) {
        const failure = error instanceof ApiAuthorityChangedError || !isApiAuthorityCurrent(authority)
          ? undefined
          : installationContinuationFailure(error)
        setInstallationContinuation(failure ? { kind: "failed", failure } : undefined)
        if (failure && installationsFooter?.contains(document.activeElement)) {
          installationsFooter.scrollIntoView({ block: "nearest" })
        }
      }
    }
  }

  async function runInstallationContinuationAction(): Promise<void> {
    if (loading() || installationPageBusy()) return
    if (installationPageFailure()?.action !== "refresh") return loadMoreCatalog()

    const origin = document.activeElement === installationsMoreButton ? installationsMoreButton : undefined
    const scope = currentScopeIdentity()
    const authority = captureApiAuthority()
    const navigation = installedFocusSequence
    const refresh = refreshCatalog()
    const sequence = loadSequence
    try {
      await refresh
    } catch {
      return // The full refresh owns its error feedback.
    }
    if (!origin || origin.isConnected || document.activeElement !== document.body || detailOpen()) return
    if (sequence !== loadSequence || currentScopeIdentity() !== scope || navigation !== installedFocusSequence || !isApiAuthorityCurrent(authority)) return
    if (!installedLayout?.isConnected) return
    const target = installationsMoreButton?.isConnected ? installationsMoreButton : selectedInstalledFilter()
    target?.focus()
  }

  async function loadMoreDiagnostics(): Promise<void> {
    const scope = currentScope()
    const diagnostics = catalogDiagnostics()
    if (!diagnostics?.next_cursor || (scope.kind !== "project" && scope.kind !== "session")) return
    const sequence = loadSequence
    const expectedScopeIdentity = currentScopeIdentity()
    const authority = captureApiAuthority()
    const firstNewIndex = diagnostics.entries.length
    const origin = document.activeElement === diagnosticsMoreButton ? diagnosticsMoreButton : undefined
    setDiagnosticContinuation({ kind: "loading" })
    try {
      const page = await loadExpertSquadDiagnostics(scope.directory, { cursor: diagnostics.next_cursor, limit: 20, authority })
      if (sequence !== loadSequence || currentScopeIdentity() !== expectedScopeIdentity) return
      const ownsFocus = origin && document.activeElement === origin
      setCatalogDiagnostics({
        entries: [...diagnostics.entries, ...page.entries],
        next_cursor: page.next_cursor,
        total_count: page.total_count,
      })
      if (ownsFocus && page.entries.length) {
        queueMicrotask(() => {
          if (sequence !== loadSequence || currentScopeIdentity() !== expectedScopeIdentity || !isApiAuthorityCurrent(authority)) return
          if (!diagnosticDisclosure?.isConnected || !diagnosticDisclosure.open) return
          if (document.activeElement !== origin && document.activeElement !== document.body) return
          const row = diagnosticDisclosure.querySelector<HTMLElement>(`[data-diagnostic-index="${firstNewIndex}"]`)
          const target = row?.querySelector<HTMLElement>("summary") ?? row
          target?.focus()
        })
      }
    } catch (error) {
      if (!(error instanceof ApiAuthorityChangedError) && sequence === loadSequence && currentScopeIdentity() === expectedScopeIdentity) {
        setDiagnosticContinuation({ kind: "failed", error })
      }
    } finally {
      if (sequence === loadSequence && currentScopeIdentity() === expectedScopeIdentity) {
        setDiagnosticContinuation((state) => state?.kind === "loading" ? null : state)
      }
    }
  }

  async function runDiagnosticAction(): Promise<void> {
    if (diagnosticActionBusy()) return
    if (!diagnosticContinuationFailure()) return loadMoreDiagnostics()

    const origin = document.activeElement === diagnosticsMoreButton ? diagnosticsMoreButton : undefined
    const expectedScopeIdentity = currentScopeIdentity()
    const authority = captureApiAuthority()
    const refresh = refreshCatalog()
    const sequence = loadSequence
    try {
      await refresh
    } catch {
      return // The full refresh owns its error feedback.
    }
    if (!origin || origin.isConnected || document.activeElement !== document.body) return
    if (sequence !== loadSequence || currentScopeIdentity() !== expectedScopeIdentity || !isApiAuthorityCurrent(authority)) return
    const target = diagnosticDisclosure?.isConnected
      ? diagnosticDisclosure.querySelector<HTMLElement>("summary")
      : selectedInstalledFilter()
    target?.focus()
  }

  createEffect<string>((previousKey) => {
    const key = requestKey()
    if (key === previousKey) return previousKey
    setActionError("")
    clearNotice()
    const scope = currentScope()
    if (scope.kind === "unavailable" || scope.kind === "pending") {
      loadSequence++
      marketLoadSequence++
      setInstallationContinuation(undefined)
      setDiagnosticContinuation(null)
      setCatalog(null)
      setCatalogEntries([])
      setCatalogNextCursor(null)
      setInventoryStatus(null)
      setCatalogDiagnostics(null)
      setCatalogIdentity("")
      setCatalogError(null)
      setLoading(false)
      setMarket([])
      setMarketIdentity("")
      setMarketLoading(false)
      return key
    }
    void refreshCatalog().catch(() => undefined)
    void refreshMarket().catch(() => undefined)
    return key
  }, "")

  createEffect(() => {
    const scope = currentScope()
    const identity = currentScopeIdentity()
    const ids = [...new Set([currentSquadIndex()?.id, effectiveActiveID()].filter((id): id is string => Boolean(id)))]
    const sequence = ++marketDetailLoadSequence
    if (ids.length === 0 || marketIdentity() !== identity || (scope.kind !== "project" && scope.kind !== "session")) {
      return
    }
    void Promise.allSettled(ids.map((id) => loadExpertSquadMarketDetail(scope.directory, id))).then((results) => {
      if (sequence !== marketDetailLoadSequence || currentScopeIdentity() !== identity) return
      const details = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
      if (details.length === 0) return
      setMarket((current) => {
        const items = new Map(current.map((item) => [item.id, item]))
        for (const detail of details) items.set(detail.id, detail)
        return [...items.values()]
      })
    })
  })

  createEffect(() => {
    const list = squads()
    if (list.length === 0) {
      if (selectedSquadID()) setSelectedSquadID("")
      return
    }
    if (list.some((squad) => squadSelectionKey(squad) === selectedSquadID())) return
    const active = list.find((squad) => isEffectiveInstallation(squad)) ?? list[0]!
    setSelectedSquadID(squadSelectionKey(active))
  })

  createEffect(() => {
    const receipt = expertSquadUninstallReceipt()
    const scope = currentScope()
    if (!receipt || (scope.kind !== "project" && scope.kind !== "session")) return
    if (receipt.directory !== scope.directory.trim()) return
    clearExpertSquadUninstallReceipt(receipt)
    showNotice(
      t("expert_squad.uninstalled_references", {
        id: receipt.id,
        count:
          receipt.replacedReferences.global + receipt.replacedReferences.projects + receipt.replacedReferences.sessions,
      }),
      "active",
    )
  })

  function clearNotice() {
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = undefined
    setNotice("")
    setNoticeTone("")
  }

  function showNotice(message: string, tone = "") {
    clearNotice()
    setNotice(message)
    setNoticeTone(tone)
    if (message) noticeTimer = setTimeout(() => setNotice(""), 3200)
  }

  async function runBusy(key: string, fn: () => Promise<void>, expectedScopeIdentity = currentScopeIdentity()) {
    if (activeBusy()) return
    setBusy({ key, scopeIdentity: expectedScopeIdentity })
    setActionError("")
    try {
      await fn()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (currentScopeIdentity() === expectedScopeIdentity) setActionError(message)
    } finally {
      setBusy((current) => (current?.key === key && current.scopeIdentity === expectedScopeIdentity ? null : current))
    }
  }

  async function runMarketBusy(
    itemID: string,
    installationScope: ExpertSquadInstallationScope,
    key: string,
    fn: () => Promise<void>,
    expectedScopeIdentity = currentScopeIdentity(),
  ) {
    if (isMarketInstallationBusy(itemID, installationScope)) return
    const action = { key, scopeIdentity: expectedScopeIdentity, itemID, installationScope }
    setMarketBusy((current) => [...current, action])
    setActionError("")
    try {
      await fn()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (currentScopeIdentity() === expectedScopeIdentity) setActionError(message)
    } finally {
      setMarketBusy((current) =>
        current.filter((candidate) => candidate.key !== key || candidate.scopeIdentity !== expectedScopeIdentity),
      )
    }
  }

  async function activateProject() {
    if (!canActivateProject()) return
    const squad = currentSquad()
    const captured = captureCatalogActionScope()
    if (!captured) return
    const actionScope = captured.scope
    const actionScopeIdentity = captured.identity
    const directory = actionScope.directory
    if (!squad || !directory || projectActiveID() === squad.id) return
    await runBusy(
      "activate-project",
      async () => {
        await setProjectExpertSquadActive(squad.id, directory, {
          isCurrentDirectory: () => currentScopeIdentity() === actionScopeIdentity,
        })
        if (currentScopeIdentity() !== actionScopeIdentity) return
        await refreshCatalog({ kind: "installation", key: squadSelectionKey(squad) }, actionScope, actionScopeIdentity)
        showNotice(t("expert_squad.activated_project"), "active")
      },
      actionScopeIdentity,
    )
  }

  async function activateSession() {
    if (!canActivateSession()) return
    const squad = currentSquad()
    const captured = captureCatalogActionScope()
    if (!captured) return
    const actionScope = captured.scope
    const actionScopeIdentity = captured.identity
    const sessionID = actionScope.kind === "session" ? actionScope.sessionID : ""
    const directory = actionScope.directory
    if (!squad || !sessionID || !directory || sessionOverrideID() === squad.id) return
    await runBusy(
      "activate-session",
      async () => {
        await setSessionExpertSquadActive(sessionID, squad.id, directory)
        if (currentScopeIdentity() !== actionScopeIdentity) return
        await refreshCatalog({ kind: "installation", key: squadSelectionKey(squad) }, actionScope, actionScopeIdentity)
        showNotice(t("expert_squad.activated_session"), "active")
      },
      actionScopeIdentity,
    )
  }

  async function clearSessionOverride() {
    if (!canClearSessionOverride()) return
    const captured = captureCatalogActionScope()
    if (!captured) return
    const actionScope = captured.scope
    const actionScopeIdentity = captured.identity
    const sessionID = actionScope.kind === "session" ? actionScope.sessionID : ""
    const directory = actionScope.directory
    if (!sessionID || !directory || !sessionOverrideID()) return
    await runBusy(
      "clear-session-override",
      async () => {
        await clearSessionExpertSquadOverride(sessionID, directory)
        if (currentScopeIdentity() !== actionScopeIdentity) return
        await refreshCatalog({ kind: "effective" }, actionScope, actionScopeIdentity)
        showNotice(t("expert_squad.cleared_session_override"), "active")
      },
      actionScopeIdentity,
    )
  }

  async function updateMarketItem(item: ExpertSquadMarketItem, installation: MarketInstallation) {
    const captured = captureCatalogActionScope()
    const installedScope = installation.installation_scope
    if (!captured) return
    await runMarketBusy(
      item.id,
      installedScope,
      `update-market:${item.id}:${installedScope}`,
      async () => {
        const result = await updateExpertSquadPackage(
          captured.scope.directory,
          item.id,
          installedScope,
          "builtin",
          installation.installed_package_digest,
        )
        if (currentScopeIdentity() !== captured.identity) return
        await refreshMarket(item.id, captured.scope, captured.identity)
        void refreshCatalog(
          { kind: "installation", key: squadInstallationKey(result.receipt.after) },
          captured.scope,
          captured.identity,
        ).catch(() => undefined)
        showNotice(
          t("expert_squad.updated", {
            id: result.receipt.after.id,
            version: result.receipt.after.version ?? "",
          }),
          "active",
        )
      },
      captured.identity,
    )
  }

  async function exportCurrent() {
    const squad = currentSquad()
    const captured = captureCatalogActionScope()
    if (!squad || !captured || squad.built_in || squad.source.kind !== "installed_package") return
    const installationScope = squad.source.installation_scope
    await runBusy(
      `export:${installationScope}:${squad.id}`,
      async () => {
        const result = await exportExpertSquadArchive(captured.scope.directory, squad.id, installationScope)
        if (currentScopeIdentity() !== captured.identity) return
        saveBase64Archive(result.filename, result.archiveBase64)
        showNotice(t("expert_squad.exported", { id: result.id, count: result.fileCount }), "active")
      },
      captured.identity,
    )
  }

  async function updateCurrent(source: ExpertSquadUpdateSource) {
    const squad = currentSquad()
    const captured = captureCatalogActionScope()
    if (!squad || !captured || squad.built_in || squad.source.kind !== "installed_package") return
    const installationScope = squad.source.installation_scope
    const expectedCurrentPackageDigest = squad.source.package_digest
    await runBusy(
      `update:${installationScope}:${squad.id}:${source}`,
      async () => {
        const result = await updateExpertSquadPackage(
          captured.scope.directory,
          squad.id,
          installationScope,
          source,
          expectedCurrentPackageDigest,
        )
        if (currentScopeIdentity() !== captured.identity) return
        await Promise.all([
          refreshCatalog(
            { kind: "installation", key: squadInstallationKey(result.receipt.after) },
            captured.scope,
            captured.identity,
          ),
          refreshMarket(result.receipt.after.id, captured.scope, captured.identity),
        ])
        showNotice(
          t("expert_squad.updated", {
            id: result.receipt.after.id,
            version: result.receipt.after.version ?? "",
          }),
          "active",
        )
      },
      captured.identity,
    )
  }

  async function uninstallInstalledSquad(
    id: string,
    installedScope: ExpertSquadInstallationScope,
    busyKey: string,
  ): Promise<void> {
    const captured = captureCatalogActionScope()
    if (!captured) return
    const dialog = await showAppDialog({
      title: t("expert_squad.uninstall"),
      message: t("expert_squad.uninstall_confirm_replace", { id }),
      cancel: true,
      okLabel: t("expert_squad.uninstall"),
      okTone: "danger",
    })
    if (!dialog.confirmed || currentScopeIdentity() !== captured.identity) return
    const action = async () => {
      await uninstallExpertSquadPackage(captured.scope.directory, id, installedScope)
      if (currentScopeIdentity() !== captured.identity) return
      await Promise.all([
        refreshCatalog(undefined, captured.scope, captured.identity),
        refreshMarket(undefined, captured.scope, captured.identity),
      ])
    }
    await runBusy(busyKey, action, captured.identity)
  }

  async function uninstallCurrent(): Promise<void> {
    const squad = currentSquad()
    if (!squad || squad.built_in || squad.source.kind !== "installed_package") return
    await uninstallInstalledSquad(
      squad.id,
      squad.source.installation_scope,
      `uninstall:${squad.source.installation_scope}:${squad.id}`,
    )
  }

  async function openConfiguration(): Promise<boolean> {
    const squad = currentSquad()
    const captured = captureCatalogActionScope()
    if (!squad?.configuration || !captured || squad.source.kind !== "installed_package") return false
    const selectedInstallation = squadSelectionKey(squad)
    const sequence = ++configurationLoadSequence
    setConfigurationLoading(true)
    setConfiguration(null)
    setConfigurationValues({})
    setConfigurationClears({})
    setConfigurationError("")
    setActionError("")
    try {
      const next = await loadExpertSquadConfiguration(
        captured.scope.directory,
        squad.id,
        squad.source.installation_scope,
      )
      if (
        sequence !== configurationLoadSequence ||
        currentScopeIdentity() !== captured.identity ||
        !currentSquad() ||
        squadSelectionKey(currentSquad()!) !== selectedInstallation
      ) {
        return false
      }
      const values: Record<string, string | boolean> = {}
      for (const field of next.fields) {
        values[field.key] = field.value ?? (field.type === "boolean" ? false : "")
      }
      setConfigurationValues(values)
      setConfigurationClears({})
      setConfiguration(next)
      return true
    } catch (error) {
      if (
        sequence !== configurationLoadSequence ||
        currentScopeIdentity() !== captured.identity ||
        !currentSquad() ||
        squadSelectionKey(currentSquad()!) !== selectedInstallation
      ) {
        return false
      }
      const message = error instanceof Error ? error.message : String(error)
      setConfiguration(null)
      setConfigurationValues({})
      setConfigurationClears({})
      setConfigurationError(message)
      setActionError(message)
      return false
    } finally {
      if (
        sequence === configurationLoadSequence &&
        currentScopeIdentity() === captured.identity &&
        currentSquad() &&
        squadSelectionKey(currentSquad()!) === selectedInstallation
      ) {
        setConfigurationLoading(false)
      }
    }
  }

  function selectInstalledSquadSection(value: string): void {
    const section = value as InstalledSquadSection
    setInstalledSquadSection(section)
    if (section === "configuration" && currentSquad()?.configuration && !configuration()) {
      void openConfiguration()
    }
  }

  function updateConfigurationValue(key: string, value: string | boolean): void {
    setConfigurationValues((current) => ({ ...current, [key]: value }))
    setConfigurationClears((current) => ({ ...current, [key]: false }))
  }

  function toggleConfigurationClear(key: string): void {
    setConfigurationClears((current) => ({ ...current, [key]: !current[key] }))
    setConfigurationValues((current) => ({ ...current, [key]: "" }))
  }

  function configurationInvalid(): boolean {
    const current = configuration()
    if (!current) return true
    return current.fields.some((field) => {
      if (!field.required || field.type === "boolean") return false
      if (configurationClears()[field.key] === true) return false
      const value = configurationValues()[field.key]
      if (field.type === "secret") return !field.configured && value === ""
      return value === ""
    })
  }

  async function saveConfiguration(): Promise<void> {
    const current = configuration()
    const scope = captureCatalogActionScope()
    const selectedInstallation = currentSquad()
    const configurationInstallation = current ? squadInstallationKey(current) : ""
    if (
      !current ||
      !scope ||
      !selectedInstallation ||
      squadSelectionKey(selectedInstallation) !== configurationInstallation ||
      configurationSaving() ||
      configurationInvalid()
    ) {
      return
    }
    const sequence = ++configurationSaveSequence
    const updates: Record<string, string | boolean | null> = {}
    for (const field of current.fields) {
      const value = configurationValues()[field.key]
      if (configurationClears()[field.key]) {
        updates[field.key] = null
      } else if (field.type === "secret") {
        if (typeof value === "string" && value.length > 0) updates[field.key] = value
      } else if (field.type === "boolean") {
        if (value !== field.value) updates[field.key] = Boolean(value)
      } else if (value !== field.value) {
        updates[field.key] = typeof value === "string" && value.length > 0 ? value : null
      }
    }
    setConfigurationSaving(true)
    setConfigurationError("")
    try {
      await updateExpertSquadConfiguration(scope.scope.directory, current.id, current.installationScope, updates)
      if (
        sequence !== configurationSaveSequence ||
        currentScopeIdentity() !== scope.identity ||
        !currentSquad() ||
        squadSelectionKey(currentSquad()!) !== configurationInstallation
      ) {
        return
      }
      if (!(await openConfiguration())) return
      if (
        sequence !== configurationSaveSequence ||
        currentScopeIdentity() !== scope.identity ||
        !currentSquad() ||
        squadSelectionKey(currentSquad()!) !== configurationInstallation
      ) {
        return
      }
      showNotice(t("expert_squad.configuration_saved"), "active")
    } catch (error) {
      if (
        sequence === configurationSaveSequence &&
        currentScopeIdentity() === scope.identity &&
        currentSquad() &&
        squadSelectionKey(currentSquad()!) === configurationInstallation
      ) {
        setConfigurationError(error instanceof Error ? error.message : String(error))
      }
    } finally {
      if (
        sequence === configurationSaveSequence &&
        currentScopeIdentity() === scope.identity &&
        currentSquad() &&
        squadSelectionKey(currentSquad()!) === configurationInstallation
      ) {
        setConfigurationSaving(false)
      }
    }
  }

  function ConfigurationEditor(): JSX.Element {
    const squad = () => currentSquad()
    return (
      <div class="expert-squad-configuration-page" data-ui="expert-squad-configuration-page">
        <Show
          when={squad()?.configuration}
          fallback={
            <Feedback title={t("expert_squad.configuration_unavailable_title")}>
              {t("expert_squad.configuration_unavailable_body")}
            </Feedback>
          }
        >
          <Show
            when={!configurationLoading()}
            fallback={<Feedback>{t("expert_squad.configuration_loading")}</Feedback>}
          >
            <Show when={configurationError()}>
              <Feedback tone="error" data-ui="expert-squad-configuration-error">
                {configurationError()}
              </Feedback>
            </Show>
            <Show when={configuration()} keyed>
              {(current) => (
                <div class="expert-squad-configuration" data-ui="expert-squad-configuration-fields">
                  <p>{t("expert_squad.configuration_description")}</p>
                  <For each={current.fields}>
                    {(field) => {
                      const value = () => configurationValues()[field.key]
                      const clearing = () => configurationClears()[field.key] === true
                      if (field.type === "boolean") {
                        return (
                          <div class="expert-squad-configuration-boolean">
                            <div>
                              <TextField.Label>{field.label}</TextField.Label>
                              <Show when={field.description}>
                                <TextField.Description>{field.description}</TextField.Description>
                              </Show>
                            </div>
                            <Switch
                              aria-label={field.label}
                              checked={value() === true}
                              onChange={(checked) => updateConfigurationValue(field.key, checked)}
                            />
                          </div>
                        )
                      }
                      return (
                        <div class="expert-squad-configuration-field">
                          <TextField.Root as="label">
                            <span class="expert-squad-configuration-label">
                              <TextField.Label>{field.label}</TextField.Label>
                              <Show when={field.required}>
                                <Badge tone="muted">{t("expert_squad.configuration_required")}</Badge>
                              </Show>
                              <Show when={field.type === "secret" && field.configured && !clearing()}>
                                <Badge tone="ok">{t("expert_squad.configuration_configured")}</Badge>
                              </Show>
                            </span>
                            <TextField.Input
                              type={field.type === "secret" ? "password" : "text"}
                              name={`expert_squad_${current.id}_${field.key}`}
                              value={String(value() ?? "")}
                              placeholder={field.placeholder ?? ""}
                              disabled={clearing()}
                              autocomplete="off"
                              onInput={(event) => updateConfigurationValue(field.key, event.currentTarget.value)}
                            />
                            <Show when={field.description}>
                              <TextField.Description>{field.description}</TextField.Description>
                            </Show>
                          </TextField.Root>
                          <Show when={field.configured || clearing()}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              tone={clearing() ? "accent" : "neutral"}
                              onClick={() => toggleConfigurationClear(field.key)}
                            >
                              {clearing()
                                ? t("expert_squad.configuration_keep")
                                : t("expert_squad.configuration_clear")}
                            </Button>
                          </Show>
                        </div>
                      )
                    }}
                  </For>
                  <div class="expert-squad-configuration-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      tone="neutral"
                      onClick={() => void openConfiguration()}
                      disabled={configurationSaving() || configurationLoading()}
                    >
                      {t("common.reload")}
                    </Button>
                    <Button
                      type="button"
                      variant="solid"
                      size="md"
                      tone="accent"
                      data-ui="expert-squad-configuration-save"
                      onClick={() => void saveConfiguration()}
                      disabled={configurationSaving() || configurationInvalid()}
                    >
                      {configurationSaving() ? t("common.saving") : t("common.save")}
                    </Button>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </div>
    )
  }

  return (
    <>
      <Show when={notice()}>
        <Feedback tone={noticeTone() === "error" ? "error" : "success"} data-ui="expert-squad-notice">
          {notice()}
        </Feedback>
      </Show>

      <SettingsPanel class="general-panel expert-squad-panel">
        <Show when={scopedCatalog()?.disabled_default_mcp_servers}>
          {(servers) => (
            <SettingsGroup>
              <Feedback tone="warning" title={t("expert_squad.disabled_connections_title")}>
                {t("expert_squad.disabled_connections_body", {
                  names: new Intl.ListFormat(localeTag()).format(servers()),
                })}
              </Feedback>
            </SettingsGroup>
          )}
        </Show>
        <SettingsGroup>
          <Show when={catalogError()}>
            <Feedback
              tone="error"
              data-ui="expert-squad-catalog-error"
              title={t("expert_squad.catalog_recovery_title")}
              details={t("expert_squad.catalog_failed", {
                directory: catalogDirectoryLabel(),
                error: formatErrorDetails(catalogError()?.error),
              })}
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  tone="neutral"
                  disabled={loading()}
                  onClick={() => void refreshCatalog().catch(() => undefined)}
                >
                  {t("common.retry")}
                </Button>
              }
            >
              {t("expert_squad.catalog_unavailable_hint")}
            </Feedback>
          </Show>
          <Show when={!detailOpen() && diagnosticCount() > 0}>
            <Disclosure.Root
              ref={diagnosticDisclosure}
              data-ui="expert-squad-catalog-diagnostics"
              variant="surface"
              size="md"
              open={catalogDiagnosticsOpen()}
              onOpenChange={setCatalogDiagnosticsOpen}
            >
              <Disclosure.Trigger>
                {t("expert_squad.catalog_diagnostics_summary", { count: new Intl.NumberFormat(localeTag()).format(diagnosticCount()) })}
              </Disclosure.Trigger>
              <Disclosure.Content>
                <For each={catalogDiagnostics()?.entries}>
                  {(entry, index) => entry.kind === "issue" ? (
                    <Feedback
                      tone="warning"
                      data-ui="expert-squad-catalog-issue"
                      data-diagnostic-index={index()}
                      tabIndex={-1}
                      title={t(catalogIssueLabels[entry.issue.phase])}
                      details={entry.issue.message}
                    >
                      <code>{entry.issue.location}</code>
                    </Feedback>
                  ) : (
                    <Feedback data-ui="expert-squad-catalog-warning" data-diagnostic-index={index()} tabIndex={-1}>
                      {t("expert_squad.project_override_warning", { id: entry.warning.logical_id })}
                    </Feedback>
                  )}
                </For>
                <Show when={diagnosticContinuationFailure()}>
                  {(failure) => (
                    <Feedback tone="error" title={t("expert_squad.diagnostics_continuation_failed")} details={formatErrorDetails(failure().error)}>
                      {t("expert_squad.diagnostics_continuation_hint")}
                    </Feedback>
                  )}
                </Show>
                <Show when={catalogDiagnostics()?.next_cursor}>
                  <Button
                    ref={diagnosticsMoreButton}
                    type="button"
                    variant="ghost"
                    size="sm"
                    tone="neutral"
                    data-ui="expert-squad-diagnostics-more"
                    aria-disabled={diagnosticActionBusy() || undefined}
                    aria-busy={diagnosticActionBusy() || undefined}
                    onClick={() => void runDiagnosticAction()}
                  >
                    {t(diagnosticContinuationFailure() ? "expert_squad.refresh_catalog" : "expert_squad.load_more_diagnostics")}
                  </Button>
                </Show>
              </Disclosure.Content>
            </Disclosure.Root>
          </Show>
          <Show when={actionError()}>
            <Feedback
              tone="error"
              data-ui="expert-squad-action-error"
              actions={
                <Button type="button" variant="ghost" size="md" tone="neutral" onClick={() => setActionError("")}>
                  {t("common.dismiss")}
                </Button>
              }
            >
              {t("expert_squad.action_failed", {
                directory: catalogDirectoryLabel(),
                error: actionError(),
              })}
            </Feedback>
          </Show>

          <Show when={!loading()} fallback={<div class="loading-hint">{t("expert_squad.loading")}</div>}>
            <Show when={scopeStatus()}>
              {(status) => (
                <div class="expert-squad-recovery" data-ui="expert-squad-scope-state" data-status={status().status}>
                  <Icon name="info-circle" size="medium" />
                  <span class="expert-squad-recovery-title">{status().title}</span>
                  <span class="expert-squad-recovery-body">{status().body}</span>
                </div>
              )}
            </Show>
            <Show when={!scopeStatus() && catalogError() && (marketLoading() || recoveryUpdates().length > 0)}>
              <div class="expert-squad-recovery" data-ui="expert-squad-catalog-recovery" data-status="failed">
                <Icon name="folder-open" size="medium" />
                <div class="expert-squad-recovery-content">
                  <span class="expert-squad-recovery-title">{t("expert_squad.catalog_recovery_title")}</span>
                  <span class="expert-squad-recovery-body">{t("expert_squad.catalog_recovery_body")}</span>
                  <Show when={marketLoading()}>
                    <span class="expert-squad-recovery-body">{t("expert_squad.loading")}</span>
                  </Show>
                  <For each={recoveryUpdates()}>
                    {({ item, installation }) => (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        tone="neutral"
                        data-ui="expert-squad-catalog-update"
                        data-market-id={item.id}
                        disabled={
                          !writableScopeAvailable() ||
                          isMarketInstallationBusy(item.id, installation.installation_scope)
                        }
                        data-installation-scope={installation.installation_scope}
                        onClick={() => void updateMarketItem(item, installation)}
                      >
                        {isMarketActionBusy(`update-market:${item.id}:${installation.installation_scope}`)
                          ? t("expert_squad.updating")
                          : t("expert_squad.catalog_update_candidate", {
                              id: item.id,
                              installed: installation.installed_version ?? t("expert_squad.version_unknown"),
                              available: item.version,
                            })}
                      </Button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
            <Show when={!scopeStatus() && !catalogError() && squads().length === 0}>
              <div class="empty-hint">{t("expert_squad.none")}</div>
            </Show>
            <Show when={!scopeStatus() && !catalogError() && squads().length > 0}>
              <div ref={installedLayout} class="expert-squad-layout" data-ui="expert-squad-panel">
                <Show when={!detailOpen()}>
                  <div class="expert-squad-list-toolbar expert-squad-catalog-toolbar">
                    <div
                      class="expert-squad-filter-list"
                      role="toolbar"
                      aria-label={t("expert_squad.catalog_filter_label")}
                    >
                      <For each={["all", "active", "package", "built_in"] as CatalogFilter[]}>
                        {(filter) => (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            tone="neutral"
                            class="expert-squad-filter-chip"
                            data-selected={catalogFilter() === filter ? "true" : undefined}
                            data-ui="expert-squad-catalog-filter"
                            data-filter={filter}
                            aria-pressed={catalogFilter() === filter}
                            onClick={() => setCatalogFilter(filter)}
                          >
                            {catalogFilterLabel(filter)}
                          </Button>
                        )}
                      </For>
                    </div>
                  </div>
                  <Show
                    when={filteredSquads().length > 0}
                    fallback={<div class="empty-hint">{t("expert_squad.none")}</div>}
                  >
                    <SettingsSurface class="expert-squad-list" data-ui="expert-squad-list">
                      <For each={filteredSquads()}>
                        {(squad) => {
                          const selectionKey = squadSelectionKey(squad)
                          return (
                            <SettingsRow
                              as="button"
                              align="center"
                              interactive
                              class="expert-squad-master-row expert-squad-installed-row"
                              leading={
                                <Icon
                                  name={
                                    squad.system_role === "expert_squad_generator"
                                      ? "config-expert-squad-install"
                                      : "expert-squad"
                                  }
                                  size="medium"
                                />
                              }
                              title={squad.name}
                              meta={squad.source.kind === "installed_package" ? (
                                <>
                                  <span>{sourceLabel(squad)}</span>
                                  <code>{squad.source.namespace}/{squad.id}</code>
                                </>
                              ) : undefined}
                              actions={
                                <>
                                  <Show when={squad.system_role === "expert_squad_generator"}>
                                    <Badge tone="accent">{t("expert_squad.system_generator")}</Badge>
                                  </Show>
                                  <Show when={effectiveActiveID() === squad.id && isEffectiveInstallation(squad)}>
                                    <Badge tone="muted">{t("expert_squad.effective_active")}</Badge>
                                  </Show>
                                  <Icon name="chevron" />
                                </>
                              }
                              data-ui="expert-squad-select"
                              data-squad-id={squad.id}
                              data-squad-selection-key={selectionKey}
                              onClick={() => openInstalledDetail(selectionKey)}
                            />
                          )
                        }}
                      </For>
                    </SettingsSurface>
                    <Show when={catalogNextCursor()}>
                      <div ref={installationsFooter} class="expert-squad-installation-footer">
                        <Button
                          ref={installationsMoreButton}
                          type="button"
                          variant="outline"
                          size="md"
                          tone="neutral"
                          aria-disabled={installationPageBusy() || undefined}
                          aria-busy={installationPageBusy() || undefined}
                          onClick={() => void runInstallationContinuationAction()}
                        >
                          {installationPageActionLabel()}
                        </Button>
                        <Show when={installationPageFailure()}>
                          {(failure) => (
                            <Feedback tone="error" details={formatErrorDetails(failure().error)}>
                              {t(failure().action === "refresh"
                                ? "expert_squad.installation_page_refresh_needed"
                                : "expert_squad.installation_page_failed")}
                            </Feedback>
                          )}
                        </Show>
                      </div>
                    </Show>
                  </Show>
                </Show>
                <Show when={detailOpen()}>
                  <Button
                    ref={installedBackButton}
                    class="s-detail-back"
                    type="button"
                    variant="ghost"
                    size="sm"
                    tone="neutral"
                    onClick={returnToInstalledCatalog}
                  >
                    <Icon name="nav-back" />
                    {t("settings.back_to_list")}
                  </Button>
                  <Show when={currentDetailRead()?.kind === "loading"}>
                    <div class="loading-hint">{t("expert_squad.loading")}</div>
                  </Show>
                  <Show when={selectedDetailFailure()}>
                    <Feedback
                      tone="error"
                      details={formatErrorDetails(selectedDetailFailure()?.error)}
                      actions={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          tone="neutral"
                          aria-disabled={selectedDetailRetrying() || undefined}
                          aria-busy={selectedDetailRetrying() || undefined}
                          onClick={(event) => loadSelectedDetail(event.currentTarget)}
                        >
                          {t(selectedDetailRetrying() ? "common.retrying" : "common.retry")}
                        </Button>
                      }
                    >
                      {t("expert_squad.selected_read_failed")}
                    </Feedback>
                  </Show>
                  <Show when={currentSquad()} keyed>
                    {(squad) => (
                      <div class="expert-squad-detail" data-ui="expert-squad-detail">
                        <header class="expert-squad-identity-head expert-squad-installed-identity">
                          <div class="expert-squad-identity-copy">
                            <h2 ref={installedDetailHeading} tabIndex={-1}>{squad.name}</h2>
                            <div class="expert-squad-identity-meta">
                              <code>{squad.id}</code>
                              <span>{sourceLabel(squad)}</span>
                              <Show when={squad.version}>
                                <span>v{squad.version}</span>
                              </Show>
                            </div>
                            <Show when={squad.description}>
                              <p>{expertSquadDescription(squad)}</p>
                            </Show>
                            <div class="expert-squad-status-list">
                              <Show when={squad.system_role === "expert_squad_generator"}>
                                <Badge tone="accent">{t("expert_squad.system_generator")}</Badge>
                              </Show>
                              <Show when={isProjectActiveInstallation(squad)}>
                                <Badge tone="accent">{t("expert_squad.project_active")}</Badge>
                              </Show>
                              <Show when={isSessionOverrideInstallation(squad)}>
                                <Badge tone="ok">{t("expert_squad.session_override")}</Badge>
                              </Show>
                            </div>
                          </div>
                          <DropdownMenu.Root placement="bottom-end" gutter={6} fitViewport>
                            <DropdownMenu.Trigger
                              as={Button}
                              type="button"
                              variant="outline"
                              size="md"
                              tone="neutral"
                              class="expert-squad-package-menu-trigger"
                              data-ui="expert-squad-package-actions"
                              disabled={!writableScopeAvailable() || !!activeBusy()}
                            >
                              <span>{t("expert_squad.package_actions")}</span>
                              <Icon name="chevron-down" size="compact" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content class="expert-squad-package-menu">
                                <Show when={squad.configuration}>
                                  <DropdownMenu.Item
                                    as="button"
                                    type="button"
                                    data-ui="expert-squad-configure"
                                    disabled={configurationLoading()}
                                    onSelect={() => selectInstalledSquadSection("configuration")}
                                  >
                                    <Icon name={configurationLoading() ? "loading" : "config-general"} />
                                    <span>{t("expert_squad.configure")}</span>
                                  </DropdownMenu.Item>
                                </Show>
                                <Show when={!squad.built_in && squad.source.kind === "installed_package"}>
                                  <Show when={hasBuiltinMarketSource(squad, scopedMarket())}>
                                    <DropdownMenu.Item
                                      as="button"
                                      type="button"
                                      data-ui="expert-squad-update-builtin"
                                      onSelect={() => void updateCurrent("builtin")}
                                    >
                                      <Icon
                                        name={
                                          activeBusy() === `update:${installedPackageScope(squad)}:${squad.id}:builtin`
                                            ? "loading"
                                            : "refresh"
                                        }
                                      />
                                      <span>{t("expert_squad.update_builtin")}</span>
                                    </DropdownMenu.Item>
                                  </Show>
                                  <DropdownMenu.Item
                                    as="button"
                                    type="button"
                                    data-ui="expert-squad-update-server"
                                    onSelect={() => void updateCurrent("server")}
                                  >
                                    <Icon
                                      name={
                                        activeBusy() === `update:${installedPackageScope(squad)}:${squad.id}:server`
                                          ? "loading"
                                          : "web-search"
                                      }
                                    />
                                    <span>{t("expert_squad.update_server")}</span>
                                  </DropdownMenu.Item>
                                </Show>
                                <DropdownMenu.Item
                                  as="button"
                                  type="button"
                                  data-ui="expert-squad-export"
                                  disabled={squad.built_in}
                                  onSelect={exportCurrent}
                                >
                                  <Icon name="download" />
                                  <span>{t("expert_squad.export")}</span>
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator />
                                <DropdownMenu.Item
                                  as="button"
                                  type="button"
                                  class="expert-squad-danger-action"
                                  data-ui="expert-squad-uninstall"
                                  disabled={squad.built_in}
                                  onSelect={uninstallCurrent}
                                >
                                  <Icon name="delete" />
                                  <span>{t("expert_squad.uninstall")}</span>
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </header>

                        <div class="expert-squad-selection-actions" data-ui="expert-squad-actions">
                          <Show when={currentSelectedSurface() && !isSelectableInstallation(squad)}>
                            <Feedback tone="warning">
                              {t(currentSelectedSurface()?.selection.effective_identity
                                ? "expert_squad.installation_shadowed"
                                : "expert_squad.installation_not_selectable")}
                            </Feedback>
                          </Show>
                          <Show when={fixedTaskID() && scopedCatalog()}>
                            <Feedback tone="info">
                              {t("expert_squad.task_assignment_fixed", {
                                name: scopedCatalog()?.active.name ?? "",
                                version: scopedCatalog()?.active.package_revision.version ?? "",
                              })}
                            </Feedback>
                          </Show>
                          <Show when={!isProjectActiveInstallation(squad)}>
                            <Button
                              type="button"
                              variant="outline"
                              size="md"
                              tone="neutral"
                              data-ui="expert-squad-activate-project"
                              disabled={!canActivateProject()}
                              onClick={activateProject}
                            >
                              <Icon name={isProjectActiveInstallation(squad) ? "check" : "folder"} />
                              <span>
                                {isProjectActiveInstallation(squad)
                                  ? t("expert_squad.project_active")
                                  : t(fixedTaskID() ? "expert_squad.activate_project_future" : "expert_squad.activate_project")}
                              </span>
                            </Button>
                          </Show>
                          <Show when={currentScopeSessionID() && !fixedTaskID()}>
                            <Show when={!isSessionOverrideInstallation(squad)}>
                              <Button
                                type="button"
                                variant="outline"
                                size="md"
                                tone="neutral"
                                data-ui="expert-squad-activate-session"
                                disabled={!canActivateSession()}
                                onClick={activateSession}
                              >
                                <Icon name={isSessionOverrideInstallation(squad) ? "check" : "message"} />
                                <span>
                                  {isSessionOverrideInstallation(squad)
                                    ? t("expert_squad.session_override")
                                    : t("expert_squad.activate_session")}
                                </span>
                              </Button>
                            </Show>
                            <Show when={sessionOverrideID()}>
                              <Button
                                type="button"
                                variant="outline"
                                size="md"
                                tone="neutral"
                                data-ui="expert-squad-clear-session-override"
                                disabled={!canClearSessionOverride()}
                                onClick={clearSessionOverride}
                              >
                                <Icon name="rewind" />
                                <span>{t("expert_squad.clear_session_override")}</span>
                              </Button>
                            </Show>
                          </Show>
                        </div>

                        <Tabs
                          class="expert-squad-detail-tabs"
                          value={installedSquadSection()}
                          onValueChange={selectInstalledSquadSection}
                        >
                          <TabList
                            class="expert-squad-detail-tablist"
                            size="md"
                            tone="neutral"
                            aria-label={t("expert_squad.detail_sections")}
                          >
                            <Tab value="overview" size="md" tone="neutral">
                              {t("expert_squad.detail_overview")}
                            </Tab>
                            <Tab value="agents" size="md" tone="neutral">
                              {t("expert_squad.detail_agents")}
                            </Tab>
                            <Tab value="configuration" size="md" tone="neutral">
                              {t("expert_squad.detail_configuration")}
                            </Tab>
                            <Show when={squad.source.kind === "installed_package"}>
                              <Tab value="evolution" size="md" tone="neutral">
                                {t("expert_squad.detail_evolution")}
                              </Tab>
                            </Show>
                            <Tab value="package" size="md" tone="neutral">
                              {t("expert_squad.detail_package")}
                            </Tab>
                          </TabList>

                          <TabPanel value="overview" class="expert-squad-detail-panel">
                            <dl class="expert-squad-overview-list">
                              <div>
                                <dt>{t("expert_squad.detail_project_selection")}</dt>
                                <dd>
                                  <code>{projectActiveID() || "-"}</code>
                                </dd>
                              </div>
                              <div>
                                <dt>{t("expert_squad.detail_effective_selection")}</dt>
                                <dd>
                                  <code>{effectiveActiveID() || "-"}</code>
                                </dd>
                              </div>
                            </dl>
                            <Disclosure.Root class="expert-squad-overview-note">
                              <Disclosure.Trigger>{t("expert_squad.detail_runtime_boundary")}</Disclosure.Trigger>
                              <Disclosure.Content>
                                <p>{t("expert_squad.detail_runtime_boundary_body")}</p>
                              </Disclosure.Content>
                            </Disclosure.Root>
                          </TabPanel>

                          <TabPanel value="agents" class="expert-squad-detail-panel">
                            <section
                              class="expert-squad-agent-access-section"
                              data-ui="expert-squad-agent-access-section"
                            >
                              <Show
                                when={Object.keys(squad.capability_projection.agents).length > 0}
                                fallback={<div class="empty-hint">{t("expert_squad.no_projected_agents")}</div>}
                              >
                                <div class="expert-squad-agent-access-list">
                                  <For each={Object.entries(squad.capability_projection.agents)}>
                                    {([agentID, declaredProjection]) => {
                                      const resolvedAccess = () => {
                                        if (effectiveActiveID() !== squad.id) {
                                          return { entry: declaredProjection, source: "declared" as const }
                                        }
                                        const active = activeAgentProjection()
                                        if (!active || active.source_expert_squad_id !== squad.id) return null
                                        const agent = active.agents.find((candidate) => candidate.agent_id === agentID)
                                        if (!agent) return null
                                        return { entry: agent, source: "effective" as const }
                                      }
                                      return (
                                        <Disclosure.Root
                                          class="expert-squad-agent-access"
                                          data-ui="expert-squad-agent-access"
                                          data-agent-id={agentID}
                                          open={expandedAgentIDs().has(agentID)}
                                          onOpenChange={(open) => setAgentExpanded(agentID, open)}
                                          variant="plain"
                                          size="md"
                                        >
                                          <Disclosure.Trigger
                                            class="expert-squad-agent-access-head"
                                            indicatorPosition="end"
                                          >
                                            <div class="expert-squad-agent-identity">
                                              <span class="expert-squad-agent-icon" aria-hidden="true">
                                                <Icon name="config-agent-models" size="medium" />
                                              </span>
                                              <div>
                                                <span class="expert-squad-agent-title">{declaredProjection.label}</span>
                                              </div>
                                            </div>
                                            <Show when={resolvedAccess()}>
                                              {(access) => (
                                                <Badge tone={access().source === "effective" ? "accent" : "muted"}>
                                                  {access().source === "effective"
                                                    ? t("expert_squad.effective_access")
                                                    : t("expert_squad.declared_access")}
                                                </Badge>
                                              )}
                                            </Show>
                                          </Disclosure.Trigger>
                                          <Disclosure.Content class="expert-squad-agent-access-content">
                                            <Show
                                              when={resolvedAccess()}
                                              fallback={
                                                <div class="expert-squad-agent-access-error">
                                                  {t("expert_squad.access_projection_unavailable", { id: agentID })}
                                                </div>
                                              }
                                            >
                                              {(access) => (
                                                <div class="expert-squad-agent-capability-grid">
                                                  <AgentCapabilityGroup
                                                    kind="tools"
                                                    title={t("expert_squad.tools")}
                                                    icon="config-tool"
                                                    items={toolCapabilityItems(access().entry, squad.capability_sets)}
                                                  />
                                                  <AgentCapabilityGroup
                                                    kind="skills"
                                                    title={t("expert_squad.skills")}
                                                    icon="config-skill"
                                                    items={skillCapabilityItems(access().entry, squad.capability_sets)}
                                                  />
                                                  <AgentCapabilityGroup
                                                    kind="mcp"
                                                    title={t("expert_squad.mcp")}
                                                    icon="config-mcp"
                                                    items={mcpCapabilityItems(access().entry, squad.capability_sets)}
                                                  />
                                                </div>
                                              )}
                                            </Show>
                                          </Disclosure.Content>
                                        </Disclosure.Root>
                                      )
                                    }}
                                  </For>
                                </div>
                              </Show>
                            </section>
                          </TabPanel>

                          <TabPanel value="configuration" class="expert-squad-detail-panel">
                            <ConfigurationEditor />
                          </TabPanel>

                          <Show when={squad.source.kind === "installed_package" ? squad.source : null} keyed>
                            {(source) => (
                              <TabPanel value="evolution" class="expert-squad-detail-panel">
                                <ExpertSquadEvolutionPanel
                                  directory={expertSquadCatalogDirectory()}
                                  namespace={source.namespace}
                                  id={squad.id}
                                  installationScope={source.installation_scope}
                                  onMutation={async () => {
                                    const captured = captureCatalogActionScope()
                                    if (!captured) return
                                    await refreshCatalog(
                                      { kind: "installation", key: squadSelectionKey(squad) },
                                      captured.scope,
                                      captured.identity,
                                    )
                                  }}
                                />
                              </TabPanel>
                            )}
                          </Show>

                          <TabPanel value="package" class="expert-squad-detail-panel">
                            <div class="expert-squad-technical-body" data-ui="expert-squad-package-details">
                              <div class="expert-squad-source-grid">
                                <div>
                                  <span class="expert-squad-technical-label">{t("expert_squad.source")}</span>
                                  <span class="expert-squad-technical-value">{sourceLabel(squad)}</span>
                                </div>
                                <div>
                                  <span class="expert-squad-technical-label">{t("expert_squad.declaration_hash")}</span>
                                  <code>{squad.declaration_hash.slice(0, 12)}</code>
                                </div>
                                <div class="expert-squad-source-grid-agents">
                                  <span class="expert-squad-technical-label">{t("expert_squad.projected_agents")}</span>
                                  <code>{Object.keys(squad.capability_projection.agents).join(", ") || "-"}</code>
                                </div>
                                <Show when={generationTrace(squad)} keyed>
                                  {(generation) => (
                                    <>
                                      <div>
                                        <span class="expert-squad-technical-label">
                                          {t("expert_squad.generated_by")}
                                        </span>
                                        <code>{generation.generator_expert_squad_id}</code>
                                      </div>
                                      <div>
                                        <span class="expert-squad-technical-label">
                                          {t("expert_squad.generation_method")}
                                        </span>
                                        <span class="expert-squad-technical-value">
                                          {generationMethodLabel(generation.method)}
                                        </span>
                                      </div>
                                      <div>
                                        <span class="expert-squad-technical-label">
                                          {t("expert_squad.generated_at")}
                                        </span>
                                        <time dateTime={generation.generated_at}>{generation.generated_at}</time>
                                      </div>
                                      <div>
                                        <span class="expert-squad-technical-label">
                                          {t("expert_squad.generation_task")}
                                        </span>
                                        <code>{generation.task_id}</code>
                                      </div>
                                      <div class="expert-squad-source-grid-agents">
                                        <span class="expert-squad-technical-label">
                                          {t("expert_squad.generation_session")}
                                        </span>
                                        <code>{generation.session_id}</code>
                                      </div>
                                    </>
                                  )}
                                </Show>
                              </div>

                              <div class="expert-squad-section">
                                <div class="expert-squad-section-head">
                                  <h3>{t("expert_squad.readme_title")}</h3>
                                  <Badge tone="accent">{t("expert_squad.orchestrator_append")}</Badge>
                                </div>
                                <div
                                  class="expert-squad-markdown md-content"
                                  innerHTML={markdownHtml(squad.readme.content)}
                                />
                              </div>

                              <Show when={squad.selector}>
                                {(selector) => (
                                  <div class="expert-squad-section">
                                    <div class="expert-squad-section-head">
                                      <h3>{t("expert_squad.selector_instructions_title")}</h3>
                                      <code>{selector().ref}</code>
                                    </div>
                                    <div class="expert-squad-selector-summary">
                                      <p>{selector().summary}</p>
                                      <span class="expert-squad-selector-guidance">
                                        {selector().selection_guidance}
                                      </span>
                                    </div>
                                    <div
                                      class="expert-squad-markdown md-content"
                                      innerHTML={markdownHtml(selector().instructions)}
                                    />
                                  </div>
                                )}
                              </Show>

                              <div class="expert-squad-section">
                                <div class="expert-squad-section-head">
                                  <h3>{t("expert_squad.scheduler_capability_declarations")}</h3>
                                  <span class="expert-squad-section-meta">
                                    {t("expert_squad.capability_reference_count", {
                                      count: squad.capability_projection.scheduler.capability_refs.length,
                                    })}
                                  </span>
                                </div>
                                <div class="expert-squad-projection-grid">
                                  <For each={projectionRows(squad.capability_projection.scheduler)}>
                                    {([key, values]) => (
                                      <div class="expert-squad-projection-row">
                                        <code>{key}</code>
                                        <code>{values.length ? values.join(", ") : "-"}</code>
                                      </div>
                                    )}
                                  </For>
                                </div>
                              </div>
                            </div>
                          </TabPanel>
                        </Tabs>
                      </div>
                    )}
                  </Show>
                </Show>
              </div>
            </Show>
          </Show>
        </SettingsGroup>
      </SettingsPanel>
    </>
  )
}
