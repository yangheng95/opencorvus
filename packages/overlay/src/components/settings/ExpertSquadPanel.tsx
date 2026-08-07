// ── ExpertSquadPanel ──
// Dynamic expert-squad catalog surface. Active selection remains config-owned
// via prompt_profile.active; this panel edits only that existing config field.

import { createEffect, createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { renderMarkdown } from "../../utils/markdown"
import { pickDirectory } from "../../services/workspace"
import {
  clearSessionExpertSquadOverride,
  clearExpertSquadUninstallReceipt,
  exportExpertSquadArchive,
  importExpertSquadArchive,
  importExpertSquadFolder,
  installExpertSquadMarketPackage,
  updateExpertSquadPackage,
  uninstallExpertSquadPackage,
  expertSquadUninstallReceipt,
  loadExpertSquadCatalog,
  loadExpertSquadConfiguration,
  loadExpertSquadMarket,
  setProjectExpertSquadActive,
  setSessionExpertSquadActive,
  updateExpertSquadConfiguration,
  type ExpertSquadCatalog,
  type ExpertSquadConfiguration,
  type ExpertSquadMarketItem,
  type ExpertSquadOption,
  type ExpertSquadInstallationScope,
  type ExpertSquadUpdateSource,
} from "../../services/expert-squad"
import {
  expertSquadCatalogDirectory,
  expertSquadCatalogRequestKey,
  expertSquadCatalogScope,
} from "../../services/expert-squad-scope"
import { Button } from "../ui/Button"
import { Badge } from "../ui/Badge"
import { Disclosure } from "../ui/Disclosure"
import { DropdownMenu } from "../ui/DropdownMenu"
import { SearchField } from "../ui/SearchField"
import { SelectField } from "../ui/SelectField"
import { Icon, type IconName } from "../ui/Icon"
import { Tab, TabList, TabPanel, Tabs } from "../ui/Tabs"
import { SettingsGroup, SettingsPanel, SettingsRow, SettingsState, SettingsSurface } from "./layout"
import { showAppDialog } from "../../services/app-dialog"
import { TextField } from "../ui/TextField"
import { Switch } from "../ui/Switch"
import ExpertSquadEvolutionPanel from "./ExpertSquadEvolutionPanel"

function markdownHtml(value: string): string {
  if (!value.trim()) {
    return `<p class="empty-hint">${t("expert_squad.preview_empty")}</p>`
  }
  return renderMarkdown(value)
}

function sourceLabel(squad: ExpertSquadOption): string {
  if (squad.source.kind === "built_in") return t("expert_squad.built_in")
  return squad.source.installation_scope === "project"
    ? t("expert_squad.package_project")
    : t("expert_squad.package_global")
}

function hasBuiltinMarketSource(squad: ExpertSquadOption, market: ExpertSquadMarketItem[]): boolean {
  if (squad.source.kind !== "installed_package") return false
  const namespace = squad.source.namespace
  return market.some((item) => item.id === squad.id && item.namespace === namespace)
}

function installedPackageScope(squad: ExpertSquadOption): ExpertSquadInstallationScope | "" {
  return squad.source.kind === "installed_package" ? squad.source.installation_scope : ""
}

function generationTrace(squad: ExpertSquadOption) {
  return squad.source.kind === "installed_package" ? squad.source.generation : undefined
}

function generationMethodLabel(method: "sdk_authoring" | "heterogeneous_import"): string {
  return t(
    method === "sdk_authoring"
      ? "expert_squad.generation_method_authoring"
      : "expert_squad.generation_method_import",
  )
}

function catalogDirectoryLabel(): string {
  const directory = expertSquadCatalogDirectory().trim()
  return directory ? directory : t("expert_squad.directory_unavailable")
}

function projectionCount(values: string[] | undefined): number {
  return values?.length ?? 0
}

type ProjectionEntry = Omit<
  ExpertSquadOption["capability_projection"]["scheduler"],
  "base_role" | "inherit_base_tools" | "prompt"
>

function projectionToolRefCount(entry: ProjectionEntry): number {
  return (
    projectionCount(entry.built_in_tool_ids) +
    projectionCount(entry.default_tool_refs) +
    projectionCount(entry.package_tool_refs) +
    projectionCount(entry.default_mcp_tool_refs) +
    projectionCount(entry.package_mcp_tool_refs)
  )
}

type ResourceProjectionEntry = Pick<
  ProjectionEntry,
  | "built_in_tool_ids"
  | "default_skill_refs"
  | "package_skill_refs"
  | "default_tool_refs"
  | "package_tool_refs"
  | "default_mcp_server_refs"
  | "package_mcp_server_refs"
  | "default_mcp_tool_refs"
  | "package_mcp_tool_refs"
  | "default_mcp_prompt_refs"
  | "package_mcp_prompt_refs"
  | "default_mcp_resource_refs"
  | "package_mcp_resource_refs"
>

type CapabilityOrigin = "built_in" | "default" | "package"
type McpCapabilityKind = "server" | "tool" | "prompt" | "resource"

interface CapabilityItem {
  ref: string
  origin: CapabilityOrigin
  mcpKind?: McpCapabilityKind
}

function capabilityItems(values: string[], origin: CapabilityOrigin, mcpKind?: McpCapabilityKind): CapabilityItem[] {
  return values.map((ref) => ({ ref, origin, mcpKind }))
}

function skillCapabilityItems(entry: ResourceProjectionEntry): CapabilityItem[] {
  return [
    ...capabilityItems(entry.default_skill_refs, "default"),
    ...capabilityItems(entry.package_skill_refs, "package"),
  ]
}

function toolCapabilityItems(entry: ResourceProjectionEntry): CapabilityItem[] {
  return [
    ...capabilityItems(entry.built_in_tool_ids, "built_in"),
    ...capabilityItems(entry.default_tool_refs, "default"),
    ...capabilityItems(entry.package_tool_refs, "package"),
  ]
}

function mcpCapabilityItems(entry: ResourceProjectionEntry): CapabilityItem[] {
  return [
    ...capabilityItems(entry.default_mcp_server_refs, "default", "server"),
    ...capabilityItems(entry.package_mcp_server_refs, "package", "server"),
    ...capabilityItems(entry.default_mcp_tool_refs, "default", "tool"),
    ...capabilityItems(entry.package_mcp_tool_refs, "package", "tool"),
    ...capabilityItems(entry.default_mcp_prompt_refs, "default", "prompt"),
    ...capabilityItems(entry.package_mcp_prompt_refs, "package", "prompt"),
    ...capabilityItems(entry.default_mcp_resource_refs, "default", "resource"),
    ...capabilityItems(entry.package_mcp_resource_refs, "package", "resource"),
  ]
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
  return [
    ["built_in_tool_ids", entry.built_in_tool_ids],
    ["default_skill_refs", entry.default_skill_refs],
    ["package_skill_refs", entry.package_skill_refs],
    ["default_tool_refs", entry.default_tool_refs],
    ["package_tool_refs", entry.package_tool_refs],
    ["default_mcp_server_refs", entry.default_mcp_server_refs],
    ["package_mcp_server_refs", entry.package_mcp_server_refs],
    ["default_mcp_tool_refs", entry.default_mcp_tool_refs],
    ["package_mcp_tool_refs", entry.package_mcp_tool_refs],
    ["default_mcp_prompt_refs", entry.default_mcp_prompt_refs],
    ["package_mcp_prompt_refs", entry.package_mcp_prompt_refs],
    ["default_mcp_resource_refs", entry.default_mcp_resource_refs],
    ["package_mcp_resource_refs", entry.package_mcp_resource_refs],
  ] as const
}

function catalogScopeIdentity(scope = expertSquadCatalogScope()): string {
  if (scope.kind === "project") return `project:${scope.directory}`
  if (scope.kind === "session") return `session:${scope.directory}:${scope.sessionID}`
  return scope.kind
}

type WritableCatalogScope = Extract<ReturnType<typeof expertSquadCatalogScope>, { kind: "project" | "session" }>
type CapturedCatalogActionScope = { scope: WritableCatalogScope; identity: string }
type MarketOperation = "install" | "update" | "uninstall"
type MarketInstallation = ExpertSquadMarketItem["installations"][number]
type BusyAction = {
  key: string
  scopeIdentity: string
  itemID?: string
  installationScope?: ExpertSquadInstallationScope
  operation?: MarketOperation
}
type MarketFilter = "all" | "available" | "installed"
type CatalogFilter = "all" | "active" | "package" | "built_in"
type InstalledSquadSection = "overview" | "agents" | "configuration" | "evolution" | "package"

function marketFilterLabel(filter: MarketFilter): string {
  if (filter === "available") return t("expert_squad.filter_available")
  if (filter === "installed") return t("expert_squad.filter_installed")
  return t("expert_squad.filter_all")
}

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

async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : ""
      const comma = value.indexOf(",")
      resolve(comma >= 0 ? value.slice(comma + 1) : value)
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read expert-squad archive"))
    reader.readAsDataURL(file)
  })
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

export default function ExpertSquadPanel(props: { page: "install" | "details" }) {
  const [selectedSquadID, setSelectedSquadID] = createSignal("")
  const [catalog, setCatalog] = createSignal<ExpertSquadCatalog | null>(null)
  const [notice, setNotice] = createSignal("")
  const [noticeTone, setNoticeTone] = createSignal("")
  const [busy, setBusy] = createSignal<BusyAction | null>(null)
  const [marketBusy, setMarketBusy] = createSignal<BusyAction[]>([])
  const [loading, setLoading] = createSignal(false)
  const [installationScope, setInstallationScope] = createSignal<ExpertSquadInstallationScope>("global")
  const [market, setMarket] = createSignal<ExpertSquadMarketItem[]>([])
  const [marketIdentity, setMarketIdentity] = createSignal("")
  const [marketLoading, setMarketLoading] = createSignal(false)
  const [marketError, setMarketError] = createSignal("")
  const [marketQuery, setMarketQuery] = createSignal("")
  const [marketFilter, setMarketFilter] = createSignal<MarketFilter>("all")
  const [catalogFilter, setCatalogFilter] = createSignal<CatalogFilter>("all")
  const [selectedMarketID, setSelectedMarketID] = createSignal("")
  const [catalogError, setCatalogError] = createSignal("")
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
  const isInstallPage = () => props.page === "install"

  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let loadSequence = 0
  let marketLoadSequence = 0
  let configurationLoadSequence = 0
  let configurationSaveSequence = 0
  let archiveInput: HTMLInputElement | undefined
  let pendingArchiveImportScope: CapturedCatalogActionScope | null = null

  const currentScope = createMemo(() => expertSquadCatalogScope())
  const currentScopeIdentity = createMemo(() => catalogScopeIdentity(currentScope()))
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
  const isMarketItemBusy = (itemID: string) => activeMarketActions().some((action) => action.itemID === itemID)
  const isMarketInstallationBusy = (itemID: string, installationScope: ExpertSquadInstallationScope) =>
    activeMarketActions().some((action) => action.itemID === itemID && action.installationScope === installationScope)
  const isMarketOperationBusy = (itemID: string, operation: MarketOperation) =>
    activeMarketActions().some((action) => action.itemID === itemID && action.operation === operation)
  const isMarketActionBusy = (key: string) => activeMarketBusyKeys().has(key)
  const requestKey = createMemo(() => expertSquadCatalogRequestKey())
  const currentScopeSessionID = createMemo(() => {
    const scope = currentScope()
    return scope.kind === "session" ? scope.sessionID : ""
  })
  const scopedCatalog = createMemo(() => (catalogIdentity() === currentScopeIdentity() ? catalog() : null))
  const squads = createMemo(() => scopedCatalog()?.installations ?? scopedCatalog()?.squads ?? [])
  const catalogIssues = createMemo(
    () =>
      (
        scopedCatalog() as
          | (ExpertSquadCatalog & {
              issues?: Array<{ phase: string; location: string; id?: string; message: string }>
            })
          | null
      )?.issues ?? [],
  )
  const catalogWarnings = createMemo(() => scopedCatalog()?.warnings ?? [])
  const squadSelectionKey = (squad: ExpertSquadCatalog["squads"][number]) =>
    squad.source.kind === "built_in" ? `built_in:${squad.id}` : `${squad.source.installation_scope}:${squad.id}`
  const scopedMarket = createMemo(() => (marketIdentity() === currentScopeIdentity() ? market() : []))
  const filteredMarket = createMemo(() => {
    const query = marketQuery().trim().toLocaleLowerCase()
    const filter = marketFilter()
    return scopedMarket().filter((item) => {
      if (filter === "available" && item.installations.length > 0) return false
      if (filter === "installed" && item.installations.length === 0) return false
      if (!query) return true
      return [item.name, item.label, item.id, item.namespace, item.description ?? "", item.selector_summary ?? ""]
        .join("\n")
        .toLocaleLowerCase()
        .includes(query)
    })
  })
  const selectedMarketItem = createMemo(() => {
    const list = filteredMarket()
    return list.find((item) => item.id === selectedMarketID()) ?? list[0]
  })
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
    const effective = scopedCatalog()?.squads.find((squad) => squad.id === id)
    return effective ? squadSelectionKey(effective) : ""
  }
  const isEffectiveInstallation = (squad: ExpertSquadOption) =>
    effectiveInstallationKey(squad.id) === squadSelectionKey(squad)
  const isProjectActiveInstallation = (squad: ExpertSquadOption) =>
    projectActiveID() === squad.id && isEffectiveInstallation(squad)
  const isSessionOverrideInstallation = (squad: ExpertSquadOption) =>
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
  const currentSquad = createMemo(() => {
    const list = filteredSquads()
    return (
      list.find((squad) => squadSelectionKey(squad) === selectedSquadID()) ??
      list.find((squad) => squad.id === selectedSquadID()) ??
      list[0]
    )
  })
  createEffect<string>((previousSelectionIdentity) => {
    const squad = currentSquad()
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
    nextSelectedID?: string,
    scope = expertSquadCatalogScope(),
    expectedScopeIdentity = catalogScopeIdentity(scope),
  ): Promise<void> {
    if (scope.kind === "unavailable" || scope.kind === "pending") {
      loadSequence++
      setCatalog(null)
      setCatalogIdentity("")
      setCatalogError("")
      setLoading(false)
      return
    }
    setLoading(true)
    if (currentScopeIdentity() === expectedScopeIdentity) setCatalogError("")
    const sequence = ++loadSequence
    try {
      const next = await loadExpertSquadCatalog(scope)
      if (sequence !== loadSequence || currentScopeIdentity() !== expectedScopeIdentity) return
      setCatalog(next)
      setCatalogIdentity(expectedScopeIdentity)
      setCatalogError("")
      setSelectedSquadID((current) => {
        const installations = next.installations ?? next.squads
        const requested = nextSelectedID || current
        const selected =
          installations.find((squad) => squadSelectionKey(squad) === requested) ??
          installations.find((squad) => squad.id === requested) ??
          installations.find((squad) => squad.id === next.active.effective) ??
          installations[0]
        return selected ? squadSelectionKey(selected) : ""
      })
    } catch (error) {
      if (sequence === loadSequence && currentScopeIdentity() === expectedScopeIdentity) {
        setCatalogError(error instanceof Error ? error.message : String(error))
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
    if (scope.kind === "unavailable" || scope.kind === "pending") {
      marketLoadSequence++
      setMarket([])
      setMarketIdentity("")
      setMarketError("")
      setMarketLoading(false)
      return
    }
    setMarketLoading(true)
    if (currentScopeIdentity() === expectedScopeIdentity) setMarketError("")
    const sequence = ++marketLoadSequence
    try {
      const next = await loadExpertSquadMarket(scope.directory)
      if (sequence !== marketLoadSequence || currentScopeIdentity() !== expectedScopeIdentity) return
      setMarket(next)
      setMarketIdentity(expectedScopeIdentity)
      setMarketError("")
      setSelectedMarketID((current) =>
        next.some((item) => item.id === (nextSelectedID || current))
          ? nextSelectedID || current
          : next.find((item) => item.installations.length === 0)?.id || next[0]?.id || "",
      )
    } catch (error) {
      if (sequence === marketLoadSequence && currentScopeIdentity() === expectedScopeIdentity) {
        setMarketError(error instanceof Error ? error.message : String(error))
      }
      throw error
    } finally {
      if (sequence === marketLoadSequence && currentScopeIdentity() === expectedScopeIdentity) setMarketLoading(false)
    }
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
      setCatalog(null)
      setCatalogIdentity("")
      setCatalogError("")
      setLoading(false)
      setMarket([])
      setMarketIdentity("")
      setMarketError("")
      setMarketLoading(false)
      return key
    }
    void refreshCatalog().catch(() => undefined)
    void refreshMarket().catch(() => undefined)
    return key
  }, "")

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
    operation: MarketOperation,
    key: string,
    fn: () => Promise<void>,
    expectedScopeIdentity = currentScopeIdentity(),
  ) {
    if (isMarketInstallationBusy(itemID, installationScope)) return
    const action = { key, scopeIdentity: expectedScopeIdentity, itemID, installationScope, operation }
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
        await refreshCatalog(squad.id, actionScope, actionScopeIdentity)
        showNotice(t("expert_squad.activated_project"), "active")
      },
      actionScopeIdentity,
    )
  }

  async function activateSession() {
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
        await refreshCatalog(squad.id, actionScope, actionScopeIdentity)
        showNotice(t("expert_squad.activated_session"), "active")
      },
      actionScopeIdentity,
    )
  }

  async function clearSessionOverride() {
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
        await refreshCatalog(projectActiveID(), actionScope, actionScopeIdentity)
        showNotice(t("expert_squad.cleared_session_override"), "active")
      },
      actionScopeIdentity,
    )
  }

  async function importFolder() {
    const captured = captureCatalogActionScope()
    if (!captured) return
    const targetInstallationScope = installationScope()
    await runBusy(
      "import-folder",
      async () => {
        const sourceDirectory = await pickDirectory(captured.scope.directory)
        if (!sourceDirectory.trim()) return
        if (currentScopeIdentity() !== captured.identity) return
        const result = await importExpertSquadFolder({
          directory: captured.scope.directory,
          sourceDirectory,
          installationScope: targetInstallationScope,
        })
        if (currentScopeIdentity() !== captured.identity) return
        await refreshCatalog(`${targetInstallationScope}:${result.after.id}`, captured.scope, captured.identity)
        if (isInstallPage()) await refreshMarket(result.after.id, captured.scope, captured.identity)
        showNotice(t("expert_squad.imported", { id: result.after.id }), "active")
      },
      captured.identity,
    )
  }

  async function importArchive(file: File | undefined) {
    const captured = pendingArchiveImportScope
    pendingArchiveImportScope = null
    if (!captured || !file) {
      if (archiveInput) archiveInput.value = ""
      return
    }
    const targetInstallationScope = installationScope()
    await runBusy(
      "import-archive",
      async () => {
        const archiveBase64 = await fileToBase64(file)
        if (currentScopeIdentity() !== captured.identity) return
        const result = await importExpertSquadArchive({
          directory: captured.scope.directory,
          archiveBase64,
          filename: file.name,
          installationScope: targetInstallationScope,
        })
        if (currentScopeIdentity() !== captured.identity) return
        await refreshCatalog(`${targetInstallationScope}:${result.after.id}`, captured.scope, captured.identity)
        if (isInstallPage()) await refreshMarket(result.after.id, captured.scope, captured.identity)
        showNotice(t("expert_squad.imported", { id: result.after.id }), "active")
      },
      captured.identity,
    )
    if (archiveInput) archiveInput.value = ""
  }

  function openArchivePicker() {
    const captured = captureCatalogActionScope()
    if (!captured) return
    pendingArchiveImportScope = captured
    archiveInput?.click()
  }

  async function installMarketItem(item: ExpertSquadMarketItem, scope: ExpertSquadInstallationScope) {
    const captured = captureCatalogActionScope()
    if (!captured || item.installations.some((installation) => installation.installation_scope === scope)) return
    await runMarketBusy(
      item.id,
      scope,
      "install",
      `install-market:${item.id}:${scope}`,
      async () => {
        const result = await installExpertSquadMarketPackage(captured.scope.directory, item.id, scope)
        if (currentScopeIdentity() !== captured.identity) return
        await Promise.all([
          refreshMarket(item.id, captured.scope, captured.identity),
          refreshCatalog(`${scope}:${result.after.id}`, captured.scope, captured.identity),
        ])
        showNotice(t("expert_squad.market_installed", { id: result.after.id }), "active")
      },
      captured.identity,
    )
  }

  async function updateMarketItem(item: ExpertSquadMarketItem, installation: MarketInstallation) {
    const captured = captureCatalogActionScope()
    const installedScope = installation.installation_scope
    if (!captured) return
    await runMarketBusy(
      item.id,
      installedScope,
      "update",
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
        void refreshCatalog(`${installedScope}:${result.receipt.after.id}`, captured.scope, captured.identity).catch(
          () => undefined,
        )
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
          refreshCatalog(`${installationScope}:${result.receipt.after.id}`, captured.scope, captured.identity),
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
    independentMarketItemID?: string,
  ): Promise<void> {
    const captured = captureCatalogActionScope()
    if (!captured) return
    const dialog = await showAppDialog({
      title: t("expert_squad.uninstall"),
      message: t("expert_squad.uninstall_confirm_replace", { id }),
      cancel: true,
      okLabel: t("expert_squad.uninstall"),
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
    if (independentMarketItemID) {
      await runMarketBusy(independentMarketItemID, installedScope, "uninstall", busyKey, action, captured.identity)
      return
    }
    await runBusy(busyKey, action, captured.identity)
  }

  async function uninstallMarketItem(
    item: ExpertSquadMarketItem,
    installedScope: ExpertSquadInstallationScope,
  ): Promise<void> {
    await uninstallInstalledSquad(item.id, installedScope, `uninstall-market:${item.id}:${installedScope}`, item.id)
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
    const configurationInstallation = `${current?.installationScope ?? ""}:${current?.id ?? ""}`
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
            <SettingsState title={t("expert_squad.configuration_unavailable_title")}>
              {t("expert_squad.configuration_unavailable_body")}
            </SettingsState>
          }
        >
          <Show
            when={!configurationLoading()}
            fallback={<SettingsState>{t("expert_squad.configuration_loading")}</SettingsState>}
          >
            <Show when={configurationError()}>
              <SettingsState tone="error" data-ui="expert-squad-configuration-error">
                {configurationError()}
              </SettingsState>
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
        <SettingsState tone={noticeTone() === "error" ? "error" : "success"} data-ui="expert-squad-notice">
          {notice()}
        </SettingsState>
      </Show>

      <SettingsPanel class="general-panel expert-squad-panel">
        <SettingsGroup>
          <Show when={isInstallPage()}>
            <div class="expert-squad-install-intro">
              <div>
                <h2>{t("expert_squad.market_title")}</h2>
                <p>{t("expert_squad.market_intro")}</p>
              </div>
              <div class="expert-squad-install-context">
                <span class="expert-squad-type-meta">{t("expert_squad.install_target")}</span>
                <span class="expert-squad-install-scope">
                  {t("expert_squad.scope_global")} · {t("expert_squad.scope_project")}
                </span>
                <span class="expert-squad-type-meta">
                  {t("expert_squad.market_available", { count: scopedMarket().length })}
                </span>
              </div>
            </div>
            <div class="expert-squad-list-toolbar" data-ui="expert-squad-market-toolbar">
              <div class="expert-squad-filter-list" role="toolbar" aria-label={t("expert_squad.market_filter_label")}>
                <For each={["all", "available", "installed"] as MarketFilter[]}>
                  {(filter) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      class="expert-squad-filter-chip"
                      data-selected={marketFilter() === filter ? "true" : undefined}
                      data-ui="expert-squad-market-filter"
                      data-filter={filter}
                      aria-pressed={marketFilter() === filter}
                      onClick={() => setMarketFilter(filter)}
                    >
                      {marketFilterLabel(filter)}
                    </Button>
                  )}
                </For>
              </div>
              <SearchField
                class="expert-squad-market-search"
                dataUI="expert-squad-market-search"
                size="md"
                value={marketQuery()}
                placeholder={t("expert_squad.market_search_placeholder")}
                onValueChange={setMarketQuery}
                onClear={() => setMarketQuery("")}
                clearDataUI="expert-squad-market-search-clear"
              />
            </div>
            <Show when={marketError()}>
              <SettingsState tone="error" data-ui="expert-squad-market-error">
                {marketError()}
              </SettingsState>
            </Show>
            <div class="expert-squad-market" data-ui="expert-squad-market">
              <Show when={!marketLoading()} fallback={<div class="empty-hint">{t("common.loading")}</div>}>
                <Show
                  when={filteredMarket().length > 0}
                  fallback={<div class="empty-hint">{t("expert_squad.market_empty")}</div>}
                >
                  <div class="expert-squad-market-browser">
                    <SettingsSurface class="expert-squad-market-list" data-ui="expert-squad-market-list">
                      <For each={filteredMarket()}>
                        {(item) => (
                          <SettingsRow
                            customContent
                            class="expert-squad-master-row expert-squad-market-row"
                            data-selected={selectedMarketItem()?.id === item.id ? "true" : undefined}
                            data-installed={item.installations.length > 0 ? "true" : "false"}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              tone="neutral"
                              class="expert-squad-master-select"
                              data-ui="expert-squad-market-select"
                              data-market-id={item.id}
                              aria-current={selectedMarketItem()?.id === item.id ? "true" : undefined}
                              onClick={() => setSelectedMarketID(item.id)}
                            >
                              <span class="expert-squad-master-icon" aria-hidden="true">
                                <Icon name="config-skill-market" size="medium" />
                              </span>
                              <span class="expert-squad-master-copy">
                                <span class="expert-squad-type-title">{item.name}</span>
                                <span class="expert-squad-type-body">
                                  {item.description || item.selector_summary || ""}
                                </span>
                              </span>
                            </Button>
                            <div class="expert-squad-master-action">
                              <Show when={item.installations.length > 0}>
                                <Badge tone="ok">{t("expert_squad.filter_installed")}</Badge>
                              </Show>
                              <Show when={item.installations.length < 2}>
                                <DropdownMenu.Root placement="bottom-end" gutter={6} fitViewport>
                                  <DropdownMenu.Trigger
                                    as={Button}
                                    type="button"
                                    variant="solid"
                                    size="md"
                                    tone="accent"
                                    class="expert-squad-market-card-action"
                                    data-ui="expert-squad-market-install"
                                    data-market-id={item.id}
                                    title={t("expert_squad.install")}
                                    aria-label={t("expert_squad.install")}
                                    disabled={!writableScopeAvailable() || isMarketItemBusy(item.id)}
                                  >
                                    <span>
                                      {isMarketOperationBusy(item.id, "install")
                                        ? t("expert_squad.installing")
                                        : t("expert_squad.install")}
                                    </span>
                                    <Icon name="chevron-down" size="compact" />
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                      class="expert-squad-market-install-menu"
                                      data-ui="expert-squad-market-install-menu"
                                    >
                                      <Show
                                        when={
                                          !item.installations.some(
                                            (installation) => installation.installation_scope === "global",
                                          )
                                        }
                                      >
                                        <DropdownMenu.Item
                                          as="button"
                                          type="button"
                                          class="expert-squad-market-install-menu-item"
                                          data-ui="expert-squad-market-install-scope"
                                          data-market-id={item.id}
                                          data-installation-scope="global"
                                          onSelect={() => void installMarketItem(item, "global")}
                                        >
                                          <Icon name="web-search" size="medium" />
                                          <span>{t("expert_squad.install_global")}</span>
                                        </DropdownMenu.Item>
                                      </Show>
                                      <Show
                                        when={
                                          !item.installations.some(
                                            (installation) => installation.installation_scope === "project",
                                          )
                                        }
                                      >
                                        <DropdownMenu.Item
                                          as="button"
                                          type="button"
                                          class="expert-squad-market-install-menu-item"
                                          data-ui="expert-squad-market-install-scope"
                                          data-market-id={item.id}
                                          data-installation-scope="project"
                                          onSelect={() => void installMarketItem(item, "project")}
                                        >
                                          <Icon name="folder" size="medium" />
                                          <span>{t("expert_squad.install_project")}</span>
                                        </DropdownMenu.Item>
                                      </Show>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                              </Show>
                            </div>
                          </SettingsRow>
                        )}
                      </For>
                    </SettingsSurface>
                    <Show when={selectedMarketItem()}>
                      {(item) => (
                        <section class="expert-squad-market-detail" data-ui="expert-squad-market-detail">
                          <header class="expert-squad-identity-head">
                            <span class="expert-squad-identity-icon" aria-hidden="true">
                              <Icon name="config-skill-market" size="large" />
                            </span>
                            <div class="expert-squad-identity-copy">
                              <h2>{item().name}</h2>
                              <div class="expert-squad-identity-meta">
                                <code>
                                  {item().namespace}/{item().id}
                                </code>
                                <span>{t("expert_squad.market_available_version", { version: item().version })}</span>
                              </div>
                              <p>{item().selector_summary || item().description || ""}</p>
                            </div>
                          </header>
                          <div
                            class="expert-squad-capability-summary"
                            aria-label={t("expert_squad.capability_projection")}
                          >
                            <span>{t("expert_squad.market_agents", { count: item().agents.length })}</span>
                            <span>{t("expert_squad.market_skills", { count: item().skill_count })}</span>
                            <span>{t("expert_squad.market_tools", { count: item().tool_count })}</span>
                            <span>{t("expert_squad.market_mcp", { count: item().mcp_count })}</span>
                          </div>
                          <Show when={item().installations.length > 0}>
                            <div class="expert-squad-market-installations">
                              <For each={item().installations}>
                                {(installation) => (
                                  <div class="expert-squad-market-installation-row">
                                    <Badge tone="ok">
                                      {installation.update_available
                                        ? t("expert_squad.market_update_versions", {
                                            installed:
                                              installation.installed_version ?? t("expert_squad.version_unknown"),
                                            available: item().version,
                                          })
                                        : t("expert_squad.market_installed_version", {
                                            version:
                                              installation.installed_version ?? t("expert_squad.version_unknown"),
                                          })}{" "}
                                      ·{" "}
                                      {installation.installation_scope === "global"
                                        ? t("expert_squad.scope_global")
                                        : t("expert_squad.scope_project")}
                                    </Badge>
                                    <div class="expert-squad-market-installation-actions">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        tone="neutral"
                                        data-ui="expert-squad-market-update"
                                        data-market-id={item().id}
                                        data-installation-scope={installation.installation_scope}
                                        disabled={
                                          !writableScopeAvailable() ||
                                          isMarketInstallationBusy(item().id, installation.installation_scope)
                                        }
                                        onClick={() => void updateMarketItem(item(), installation)}
                                      >
                                        <Icon
                                          name={
                                            isMarketActionBusy(
                                              `update-market:${item().id}:${installation.installation_scope}`,
                                            )
                                              ? "loading"
                                              : "refresh"
                                          }
                                        />
                                        <span>{t("expert_squad.update_builtin")}</span>
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        tone="danger"
                                        data-ui="expert-squad-market-uninstall"
                                        data-market-id={item().id}
                                        data-installation-scope={installation.installation_scope}
                                        disabled={
                                          !writableScopeAvailable() ||
                                          isMarketInstallationBusy(item().id, installation.installation_scope)
                                        }
                                        onClick={() =>
                                          void uninstallMarketItem(item(), installation.installation_scope)
                                        }
                                      >
                                        <Icon
                                          name={
                                            isMarketActionBusy(
                                              `uninstall-market:${item().id}:${installation.installation_scope}`,
                                            )
                                              ? "loading"
                                              : "delete"
                                          }
                                        />
                                        <span>{t("expert_squad.uninstall")}</span>
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                          <SettingsSurface class="expert-squad-market-agents">
                            <For each={item().agents}>
                              {(agent) => (
                                <SettingsRow
                                  align="center"
                                  leading={<Icon name="config-agent-models" size="medium" />}
                                  title={agent.label}
                                />
                              )}
                            </For>
                          </SettingsSurface>
                        </section>
                      )}
                    </Show>
                  </div>
                </Show>
              </Show>
            </div>
            <Disclosure.Root class="expert-squad-local-install" data-ui="expert-squad-local-install" variant="surface">
              <Disclosure.Trigger>{t("expert_squad.local_sources")}</Disclosure.Trigger>
              <Disclosure.Content class="expert-squad-install-options" data-ui="expert-squad-install-options">
                <SettingsRow
                  class="expert-squad-install-option"
                  align="center"
                  leading={<Icon name="config-general" size="medium" />}
                  title={t("expert_squad.install_target")}
                  desc={t("expert_squad.install_target_body")}
                  actions={
                    <SelectField
                      value={installationScope()}
                      options={[
                        { value: "global", label: t("expert_squad.scope_global") },
                        { value: "project", label: t("expert_squad.scope_project") },
                      ]}
                      ariaLabel={t("expert_squad.install_target")}
                      onChange={(value) => setInstallationScope(value as ExpertSquadInstallationScope)}
                      disabled={!writableScopeAvailable() || !!activeBusy()}
                      testid="expert-squad-install-scope"
                    />
                  }
                />
                <SettingsRow
                  class="expert-squad-install-option"
                  align="center"
                  leading={<Icon name="folder-open" size="medium" />}
                  title={t("expert_squad.install_folder_title")}
                  desc={t("expert_squad.install_folder_body")}
                  actions={
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      tone="neutral"
                      data-ui="expert-squad-import-folder"
                      disabled={!writableScopeAvailable() || !!activeBusy()}
                      onClick={importFolder}
                    >
                      {t("expert_squad.import_folder")}
                    </Button>
                  }
                />
                <SettingsRow
                  class="expert-squad-install-option"
                  align="center"
                  leading={<Icon name="upload" size="medium" />}
                  title={t("expert_squad.install_archive_title")}
                  desc={t("expert_squad.install_archive_body")}
                  actions={
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      tone="neutral"
                      data-ui="expert-squad-import-archive"
                      disabled={!writableScopeAvailable() || !!activeBusy()}
                      onClick={openArchivePicker}
                    >
                      {t("expert_squad.import_archive")}
                    </Button>
                  }
                />
                <input
                  ref={(el) => {
                    archiveInput = el
                  }}
                  type="file"
                  accept=".zip,application/zip"
                  class="expert-squad-file-input"
                  onChange={(event) => void importArchive(event.currentTarget.files?.[0] ?? undefined)}
                />
              </Disclosure.Content>
            </Disclosure.Root>
            <Show when={currentScopeSessionID()}>
              <p class="agent-models-info">{t("expert_squad.session_scope_hint")}</p>
            </Show>
          </Show>
          <Show when={catalogError()}>
            <SettingsState tone="error" data-ui="expert-squad-catalog-error">
              {t("expert_squad.catalog_failed", {
                directory: catalogDirectoryLabel(),
                error: catalogError(),
              })}
            </SettingsState>
          </Show>
          <For each={catalogIssues()}>
            {(issue) => (
              <SettingsState tone="error" data-ui="expert-squad-catalog-issue">
                {t("expert_squad.catalog_issue", {
                  owner: [issue.id, issue.phase].filter(Boolean).join(" · "),
                  error: issue.message,
                })}
              </SettingsState>
            )}
          </For>
          <For each={catalogWarnings()}>
            {(warning) => (
              <SettingsState data-ui="expert-squad-catalog-warning">
                {t("expert_squad.project_override_warning", { id: warning.logical_id })}
              </SettingsState>
            )}
          </For>
          <Show when={actionError()}>
            <SettingsState
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
            </SettingsState>
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
            <Show when={!scopeStatus() && catalogError()}>
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
            <Show when={!isInstallPage() && !scopeStatus() && !catalogError() && squads().length === 0}>
              <div class="empty-hint">{t("expert_squad.none")}</div>
            </Show>
            <Show when={!isInstallPage() && !scopeStatus() && !catalogError() && squads().length > 0}>
              <div class="expert-squad-layout" data-ui="expert-squad-panel">
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
                        const selected = () =>
                          currentSquad() ? squadSelectionKey(currentSquad()!) === squadSelectionKey(squad) : false
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
                            actions={
                              <>
                                <Show when={squad.system_role === "expert_squad_generator"}>
                                  <Badge tone="accent">{t("expert_squad.system_generator")}</Badge>
                                </Show>
                                <Show when={effectiveActiveID() === squad.id && isEffectiveInstallation(squad)}>
                                  <Badge tone="accent">{t("expert_squad.effective_active")}</Badge>
                                </Show>
                              </>
                            }
                            data-ui="expert-squad-select"
                            data-squad-id={squad.id}
                            data-selected={selected() ? "true" : undefined}
                            aria-current={selected() ? "true" : undefined}
                            onClick={() => setSelectedSquadID(squadSelectionKey(squad))}
                          />
                        )
                      }}
                    </For>
                  </SettingsSurface>
                </Show>

                <Show when={currentSquad()} keyed>
                  {(squad) => (
                    <div class="expert-squad-detail" data-ui="expert-squad-detail">
                      <header class="expert-squad-identity-head expert-squad-installed-identity">
                        <span class="expert-squad-identity-icon" aria-hidden="true">
                          <Icon
                            name={
                              squad.system_role === "expert_squad_generator"
                                ? "config-expert-squad-install"
                                : "expert-squad"
                            }
                            size="large"
                          />
                        </span>
                        <div class="expert-squad-identity-copy">
                          <h2>{squad.name}</h2>
                          <div class="expert-squad-identity-meta">
                            <code>{squad.id}</code>
                            <span>{sourceLabel(squad)}</span>
                            <Show when={squad.version}>
                              <span>v{squad.version}</span>
                            </Show>
                          </div>
                          <Show when={squad.description}>
                            <p>{squad.description}</p>
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
                        <Button
                          type="button"
                          variant={isProjectActiveInstallation(squad) ? "outline" : "solid"}
                          size="md"
                          tone={isProjectActiveInstallation(squad) ? "neutral" : "accent"}
                          data-ui="expert-squad-activate-project"
                          disabled={
                            !writableScopeAvailable() ||
                            !!activeBusy() ||
                            !isEffectiveInstallation(squad) ||
                            isProjectActiveInstallation(squad)
                          }
                          onClick={activateProject}
                        >
                          <Icon name={isProjectActiveInstallation(squad) ? "check" : "folder"} />
                          <span>
                            {isProjectActiveInstallation(squad)
                              ? t("expert_squad.project_active")
                              : t("expert_squad.activate_project")}
                          </span>
                        </Button>
                        <Show when={currentScopeSessionID()}>
                          <Button
                            type="button"
                            variant={isSessionOverrideInstallation(squad) ? "outline" : "solid"}
                            size="md"
                            tone={isSessionOverrideInstallation(squad) ? "neutral" : "accent"}
                            data-ui="expert-squad-activate-session"
                            disabled={
                              !writableScopeAvailable() ||
                              !!activeBusy() ||
                              !isEffectiveInstallation(squad) ||
                              isSessionOverrideInstallation(squad)
                            }
                            onClick={activateSession}
                          >
                            <Icon name={isSessionOverrideInstallation(squad) ? "check" : "message"} />
                            <span>
                              {isSessionOverrideInstallation(squad)
                                ? t("expert_squad.session_override")
                                : t("expert_squad.activate_session")}
                            </span>
                          </Button>
                          <Show when={sessionOverrideID()}>
                            <Button
                              type="button"
                              variant="outline"
                              size="md"
                              tone="neutral"
                              data-ui="expert-squad-clear-session-override"
                              disabled={!writableScopeAvailable() || !!activeBusy() || !sessionOverrideID()}
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
                          <div class="expert-squad-overview-note">
                            <h3>{t("expert_squad.detail_runtime_boundary")}</h3>
                            <p>{t("expert_squad.detail_runtime_boundary_body")}</p>
                          </div>
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
                                                  items={toolCapabilityItems(access().entry)}
                                                />
                                                <AgentCapabilityGroup
                                                  kind="skills"
                                                  title={t("expert_squad.skills")}
                                                  icon="config-skill"
                                                  items={skillCapabilityItems(access().entry)}
                                                />
                                                <AgentCapabilityGroup
                                                  kind="mcp"
                                                  title={t("expert_squad.mcp")}
                                                  icon="config-mcp"
                                                  items={mcpCapabilityItems(access().entry)}
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
                                    squadSelectionKey(squad),
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
                                      <span class="expert-squad-technical-label">{t("expert_squad.generated_at")}</span>
                                      <time dateTime={generation.generated_at}>{generation.generated_at}</time>
                                    </div>
                                    <div>
                                      <span class="expert-squad-technical-label">{t("expert_squad.generation_task")}</span>
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
                                    <span class="expert-squad-selector-guidance">{selector().selection_guidance}</span>
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
                                <h3>{t("expert_squad.capability_projection")}</h3>
                                <span class="expert-squad-section-meta">
                                  {t("expert_squad.tool_count", {
                                    count: projectionToolRefCount(squad.capability_projection.scheduler),
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
              </div>
            </Show>
          </Show>
        </SettingsGroup>
      </SettingsPanel>
    </>
  )
}
