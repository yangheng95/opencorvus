import { Disclosure } from "../ui/Disclosure"
import { Feedback } from "../ui/Feedback"
// ── Shared resource management ──
// Solid.js component for managing project Skills and MCP server definitions.
// Displays:
// • Installed custom skills with add/remove/open actions
// • Project MCP servers with add/remove and connection actions
// All CRUD operations are self-contained — no dependency on static HTML dialogs.

import { createEffect, createSignal, createMemo, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Key } from "@solid-primitives/keyed"
import type { SkillMountsResponse } from "@opencorvus-ai/sdk"
import { t } from "../../utils/i18n"
import { ApiError, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority, configure as configureApi } from "../../services/api"
import {
  pathRevealFailureText,
  pathRevealLabelKey,
  pathRevealNoticeKey,
  pickDirectory,
  revealPath,
  syncActiveDirectoryApiContext,
} from "../../services/workspace"
import { appStore } from "../../store/app"
import { getHostTransport } from "../../services/host-transport-runtime"
import { nativeConfirm, nativeOpen } from "../../utils/native"
import { formatErrorDetails, reportError } from "../../services/diagnostics"
import { createVisibilityInterval } from "../../utils/visibility-interval"
import {
  loadInstalledSkills,
  loadSkillIssues,
  loadProjectMcpStatus,
  deleteSkill,
  installSkill,
  searchSkillMarket,
  inspectSkillMarket,
  installSkillMarket,
  updateSkill,
  importSkillArchive,
  importSkillFile,
  importSkillPackage,
  type SkillImportPackageFile,
  type SkillLoadIssue,
  type SkillUpdateSource,
  type SkillMarketCandidate,
  type SkillMarketDetail,
} from "../../services/extensions"
import { addMcpServer, connectMcp, disconnectMcp, deleteAllMcp, type RemoteMcpCredentialType, type RemoteMcpTransport } from "../../services/mcp"
import {
  mcpConnectionStatusOrDisabledLabel,
  mcpConnectionStatusOrDisabledTone,
} from "../../utils/settings-status-labels"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { TextField } from "../ui/TextField"
import { Icon } from "../ui/Icon"
import { SelectField, type SelectFieldOption } from "../ui/SelectField"
import { SettingsDetailSection, SettingsGroup, SettingsRow } from "./layout"

// ── Types ──

type SkillItem = SkillMountsResponse["skills"][number]

interface McpItem {
  status?: string
  error?: string
}

interface WebkitFileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
}

interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
  isFile: true
  file(success: (file: File) => void, error?: (error: DOMException) => void): void
}

interface WebkitFileSystemDirectoryReader {
  readEntries(success: (entries: WebkitFileSystemEntry[]) => void, error?: (error: DOMException) => void): void
}

interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
  isDirectory: true
  createReader(): WebkitFileSystemDirectoryReader
}

interface SkillDropPayload {
  sourceName: string
  file?: File
  archive?: File
  files?: SkillImportPackageFile[]
}

// ── Helpers ──

function skillRemoveKind(item: SkillItem): string {
  if (String(item.source_type) === "managed_market") return "market"
  if (item.source_type === "managed_git") return "git"
  if (item.source_type === "config_url") return "url"
  if (item.source_type === "config_path") return "path"
  return ""
}

function skillRemovable(item: SkillItem): boolean {
  return !item.builtin && !!item.source && !!skillRemoveKind(item)
}

function dataTransferEntries(dataTransfer: DataTransfer | null): WebkitFileSystemEntry[] {
  if (!dataTransfer?.items?.length) return []
  const entries: WebkitFileSystemEntry[] = []
  for (const item of Array.from(dataTransfer.items)) {
    const entry = (
      item as DataTransferItem & {
        webkitGetAsEntry?: () => unknown
      }
    ).webkitGetAsEntry?.() as WebkitFileSystemEntry | null | undefined
    if (entry) entries.push(entry)
  }
  return entries
}

function readFileEntry(entry: WebkitFileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

async function readDirectoryEntries(entry: WebkitFileSystemDirectoryEntry): Promise<WebkitFileSystemEntry[]> {
  const reader = entry.createReader()
  const entries: WebkitFileSystemEntry[] = []
  while (true) {
    const batch = await new Promise<WebkitFileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (batch.length === 0) return entries
    entries.push(...batch)
  }
}

async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : ""
      const comma = value.indexOf(",")
      resolve(comma >= 0 ? value.slice(comma + 1) : value)
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read dropped skill file"))
    reader.readAsDataURL(file)
  })
}

async function readEntryFiles(entry: WebkitFileSystemEntry, prefix = ""): Promise<SkillImportPackageFile[]> {
  const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
  if (entry.isFile) {
    const file = await readFileEntry(entry as WebkitFileSystemFileEntry)
    return [{ path: relativePath, contentBase64: await fileToBase64(file) }]
  }
  if (!entry.isDirectory) return []
  const children = await readDirectoryEntries(entry as WebkitFileSystemDirectoryEntry)
  const nested = await Promise.all(children.map((child) => readEntryFiles(child, relativePath)))
  return nested.flat()
}

function fileListPayload(dataTransfer: DataTransfer | null): SkillDropPayload | undefined {
  const files = Array.from(dataTransfer?.files ?? [])
  if (files.length === 0) return undefined
  const first = files[0]!
  if (files.length === 1 && first.name.toLowerCase().endsWith(".zip")) {
    return { sourceName: first.name, archive: first }
  }
  if (files.length === 1 && !first.webkitRelativePath) {
    return { sourceName: first.name, file: first }
  }
  return {
    sourceName: first.webkitRelativePath.split("/")[0] || first.name,
    files: files.map((file) => ({
      path: file.webkitRelativePath || file.name,
      contentBase64: "",
    })),
  }
}

async function droppedSkillPayload(event: DragEvent): Promise<SkillDropPayload | undefined> {
  const entries = dataTransferEntries(event.dataTransfer)
  if (entries.length > 0) {
    if (entries.length === 1 && entries[0]!.isFile) {
      const file = await readFileEntry(entries[0] as WebkitFileSystemFileEntry)
      return file.name.toLowerCase().endsWith(".zip")
        ? { sourceName: file.name, archive: file }
        : { sourceName: file.name, file }
    }
    const files = (await Promise.all(entries.map((entry) => readEntryFiles(entry)))).flat()
    const sourceName = entries.length === 1 ? entries[0]!.name : "dropped-skills"
    return { sourceName, files }
  }

  const payload = fileListPayload(event.dataTransfer)
  if (!payload?.files) return payload
  const files = Array.from(event.dataTransfer?.files ?? [])
  return {
    ...payload,
    files: await Promise.all(
      files.map(async (file) => ({
        path: file.webkitRelativePath || file.name,
        contentBase64: await fileToBase64(file),
      })),
    ),
  }
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── Extension Settings Panels ──

type ExtensionPanelMode = "skill" | "mcp"
interface ResourceNotice {
  key: string
  vars?: () => Record<string, string>
  tone: "success" | "error" | "warning"
  details?: string
  origin: "panel" | "skill-install" | "mcp-add"
  directory?: string
}
const MCP_STATUS_REFRESH_INTERVAL_MS = 1_000

interface FormSelectOption extends SelectFieldOption {}

function runPanelAction(label: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => {
      reportError({
        id: `skill-panel-action:${label}`,
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    })
  } catch (error) {
    reportError({
      id: `skill-panel-action:${label}`,
      title: t("common.error"),
      message: error instanceof Error ? error.message : String(error),
      details: formatErrorDetails(error),
    })
  }
}

type DirectoryProp = string | (() => string | undefined)

function SharedResourceManagementPanel(props: {
  mode: ExtensionPanelMode
  active?: boolean
  directory?: DirectoryProp
  onResourcesChanged?: () => void
}) {
  const nativeCommands = getHostTransport().capabilities.nativeCommands
  const canOpenRemoteUrl = createMemo(() => nativeCommands["open-url"])
  const canPickSkillDirectory = createMemo(() => nativeCommands["workspace.pickDir"])
  const skillSourceOptions = (): FormSelectOption[] => [
    { value: "path", label: t("skill.source.path") },
    { value: "url", label: t("skill.source.url") },
    { value: "git", label: t("skill.source.git") },
  ]
  const skillPolicyOptions = (): FormSelectOption[] => [
    { value: "allow", label: t("skill.policy.allow") },
    { value: "deny", label: t("skill.policy.deny") },
  ]
  const mcpTypeOptions = (): FormSelectOption[] => [
    { value: "remote", label: t("mcp.type.remote") },
    { value: "local", label: t("mcp.type.local") },
  ]

  const mcpTransportOptions = (): FormSelectOption[] => [
    { value: "streamable-http", label: t("mcp.transport.streamable_http") },
    { value: "sse", label: t("mcp.transport.sse") },
  ]
  const mcpCredentialOptions = (): FormSelectOption[] => [
    { value: "none", label: t("mcp.credential.none") },
    { value: "query", label: t("mcp.credential.query") },
    { value: "bearer", label: t("mcp.credential.bearer") },
    { value: "header", label: t("mcp.credential.header") },
  ]
  const [notice, setNotice] = createSignal<ResourceNotice>()
  const [loading, setLoading] = createSignal(false)
  const [mcpReadOwner, setMcpReadOwner] = createSignal<{ directory: string; authority: ApiAuthority }>()
  const [skillDragActive, setSkillDragActive] = createSignal(false)
  const [skillLoadIssues, setSkillLoadIssues] = createSignal<SkillLoadIssue[]>([])

  function setPanelNotice(key: string, options: Partial<Omit<ResourceNotice, "key">> = {}) {
    setNotice({
      key,
      vars: options.vars,
      tone: options.tone ?? "error",
      details: options.details,
      origin: options.origin ?? "panel",
      directory: options.directory,
    })
  }

  function setPanelError(
    error: unknown,
    key = props.mode === "skill" ? "skill.action_failed" : "mcp.action_failed",
    source: Pick<ResourceNotice, "origin" | "directory"> = { origin: "panel" },
  ) {
    const requestID = error instanceof ApiError ? error.requestID : undefined
    const details = [errorDetail(error), requestID ? `x-opencorvus-request-id: ${requestID}` : ""]
      .filter(Boolean)
      .join("\n")
    setPanelNotice(key, { ...source, details })
  }

  function currentDirectory(): string {
    if (props.directory !== undefined) {
      const value = typeof props.directory === "function" ? props.directory() : props.directory
      const directory = String(value || "").trim()
      configureApi({ directory })
      return directory
    }
    return syncActiveDirectoryApiContext().trim()
  }

  function sourceMatchesDirectory(directory: string): boolean {
    return currentDirectory() === directory
  }

  const panelActive = createMemo(() => props.active === true)
  const skillPanelActive = createMemo(() => props.mode === "skill" && panelActive())
  const mcpPanelActive = createMemo(() => props.mode === "mcp" && panelActive())
  const poolSkills = createMemo(() => (skillPanelActive() ? (appStore.skills as SkillItem[]) : []))
  const mcp = createMemo(
    (): Record<string, McpItem> => (mcpPanelActive() ? { ...(appStore.mcp as Record<string, McpItem>) } : {}),
  )

  const mcpStatusCurrent = () => {
    const owner = mcpReadOwner()
    const scope = appStore.mcpReadScope
    return owner && scope?.kind === "project" && scope.directory === owner.directory &&
      isApiAuthorityCurrent(scope.authority) && isApiAuthorityCurrent(owner.authority) && sourceMatchesDirectory(owner.directory)
  }
  const mcpEntries = createMemo(() => mcpStatusCurrent() ? Object.entries(mcp()) : [])

  async function refreshMcpStatus(options: { directory?: string } = {}) {
    const directory = options.directory ?? currentDirectory()
    if (!directory) return undefined
    const authority = captureApiAuthority()
    const current = () => isApiAuthorityCurrent(authority) && sourceMatchesDirectory(directory)
    try {
      const result = await loadProjectMcpStatus({ directory, authority, isCurrentDirectory: sourceMatchesDirectory })
      if (current()) setMcpReadOwner({ directory, authority })
      return result as Record<string, McpItem>
    } catch (error) {
      if (current()) setMcpReadOwner(undefined)
      throw error
    }
  }

  function notifyResourceChange() {
    props.onResourcesChanged?.()
  }

  async function reloadCurrentPanel(options: { directory?: string } = {}) {
    const directory = options.directory ?? currentDirectory()
    if (!directory) {
      setLoading(false)
      setSkillLoadIssues([])
      setPanelNotice("workspace.no_directory", { tone: "warning" })
      return
    }
    setLoading(true)
    setSkillLoadIssues([])
    setNotice(undefined)
    try {
      if (props.mode === "mcp") {
        await refreshMcpStatus({ directory })
      } else {
        await loadInstalledSkills({ directory, isCurrentDirectory: sourceMatchesDirectory })
        const issues = await loadSkillIssues({ directory, isCurrentDirectory: sourceMatchesDirectory })
        if (!sourceMatchesDirectory(directory)) return
        setSkillLoadIssues(issues)
      }
      if (!sourceMatchesDirectory(directory)) return
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelError(e)
    } finally {
      if (sourceMatchesDirectory(directory)) setLoading(false)
    }
  }

  async function handleRemoveSkill(source: string, kind: string, name: string) {
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice("workspace.no_directory", { tone: "warning" })
      return
    }
    if (!(await nativeConfirm(t("skill.delete_confirm", { name }), { okTone: "danger" }))) return
    try {
      await deleteSkill(source, kind, { directory, isCurrentDirectory: sourceMatchesDirectory })
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelError(e)
    }
  }

  async function handleUpdateSkill(item: SkillItem, source: SkillUpdateSource) {
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice("workspace.no_directory", { tone: "warning" })
      return
    }
    setLoading(true)
    setNotice(undefined)
    try {
      const result = await updateSkill(item.name, source, {
        directory,
        isCurrentDirectory: sourceMatchesDirectory,
      })
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
      if (sourceMatchesDirectory(directory)) {
        setPanelNotice("skill.update_success", {
          vars: () => ({ name: result.name, version: result.version || t("skill.builtin") }),
          tone: "success",
        })
      }
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelError(e)
    } finally {
      if (sourceMatchesDirectory(directory)) setLoading(false)
    }
  }

  // A remote skill still opens as a link; a local one is revealed by whatever
  // this host supports, so the button has to say which of the two it will do.
  function skillOpenLabel(location: string): string {
    return isRemoteUrl(location) ? t("skill.open_button_title") : t(pathRevealLabelKey())
  }

  async function handleOpenSkill(location: string) {
    if (isRemoteUrl(location)) {
      if (!canOpenRemoteUrl()) return
      try {
        const opened = await nativeOpen(location)
        if (!opened) throw new Error("native open returned false")
      } catch (e) {
        setPanelError(e, "skill.open_failed")
      }
      return
    }
    try {
      const outcome = await revealPath(location)
      const notice = pathRevealNoticeKey(outcome)
      if (notice) setPanelNotice(notice, { vars: () => ({ path: location }), tone: "success" })
    } catch (e) {
      setPanelError(pathRevealFailureText(e))
    }
  }

  async function handleDeleteAllMcp() {
    if (loading()) return
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice("workspace.no_directory", { tone: "warning" })
      return
    }
    const names = mcpEntries().map(([name]) => name)
    if (names.length === 0) return
    const authority = captureApiAuthority()
    const current = () => isApiAuthorityCurrent(authority) && sourceMatchesDirectory(directory)
    if (!(await nativeConfirm(t("mcp.delete_all_confirm", { count: names.length }), { okTone: "danger" }))) return
    if (!current() || loading()) return
    setLoading(true)
    try {
      await deleteAllMcp({ directory, isCurrentDirectory: sourceMatchesDirectory, names })
      if (!current()) return
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (current()) setPanelError(e)
    } finally {
      if (current()) setLoading(false)
    }
  }

  async function handleMcpConnection(name: string, disconnect: boolean) {
    if (loading()) return
    const directory = currentDirectory()
    if (!directory) return
    const authority = captureApiAuthority()
    const current = () => isApiAuthorityCurrent(authority) && sourceMatchesDirectory(directory)
    setLoading(true)
    setNotice(undefined)
    try {
      await (disconnect ? disconnectMcp : connectMcp)(name, { directory })
      if (!current()) return
      await refreshMcpStatus({ directory })
      notifyResourceChange()
    } catch (error) {
      if (current()) setPanelError(error)
    } finally {
      if (current()) setLoading(false)
    }
  }

  // ── Add Skill inline form ──

  const [showAddSkill, setShowAddSkill] = createSignal(false)
  const [skillForm, setSkillForm] = createStore({
    type: "path" as "path" | "url" | "git",
    value: "",
    policy: "allow" as "allow" | "deny",
  })
  const [marketQuery, setMarketQuery] = createSignal("")
  const [marketResults, setMarketResults] = createSignal<SkillMarketCandidate[]>([])
  const [marketDetail, setMarketDetail] = createSignal<SkillMarketDetail>()
  const [marketPolicy, setMarketPolicy] = createSignal<"allow" | "deny">("deny")
  const [marketLoading, setMarketLoading] = createSignal(false)

  async function handleMarketSearch() {
    const query = marketQuery().trim()
    if (query.length < 2) return
    setMarketLoading(true)
    setNotice(undefined)
    setMarketResults([])
    setMarketDetail(undefined)
    try {
      setMarketResults(await searchSkillMarket(query))
    } catch (error) {
      setPanelError(error)
    } finally {
      setMarketLoading(false)
    }
  }

  async function handleMarketInspect(candidate: SkillMarketCandidate) {
    setMarketLoading(true)
    setNotice(undefined)
    setMarketDetail(undefined)
    try {
      const detail = await inspectSkillMarket(candidate.id)
      setMarketDetail(detail)
      setMarketPolicy(detail.recommended_policy)
    } catch (error) {
      setPanelError(error)
    } finally {
      setMarketLoading(false)
    }
  }

  async function handleMarketInstall(detail: SkillMarketDetail) {
    const approved = await nativeConfirm(
      t("skill.market_install_confirm", {
        name: detail.name,
        source: detail.repository,
        hash: detail.hash,
        risk: detail.risk.level,
        policy: marketPolicy(),
      }),
    )
    if (!approved) return
    setMarketLoading(true)
    setNotice(undefined)
    try {
      const installed = await installSkillMarket(detail.id, detail.hash, marketPolicy())
      setPanelNotice("skill.market_install_success", { vars: () => ({ name: installed.name }), tone: "success" })
      const directory = currentDirectory()
      if (directory) await reloadCurrentPanel({ directory })
      setMarketDetail({ ...detail, installed: true })
      setMarketResults((items) => items.map((item) => (item.id === detail.id ? { ...item, installed: true } : item)))
      notifyResourceChange()
    } catch (error) {
      setPanelError(error)
    } finally {
      setMarketLoading(false)
    }
  }

  async function handleAddSkill() {
    const value = skillForm.value.trim()
    if (!value) return
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice("workspace.no_directory", { tone: "warning" })
      return
    }
    try {
      await installSkill(skillForm.type, value, skillForm.policy, {
        directory,
        isCurrentDirectory: sourceMatchesDirectory,
      })
      if (!sourceMatchesDirectory(directory)) return
      setSkillForm({ type: "path", value: "", policy: "allow" })
      setShowAddSkill(false)
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelError(e, undefined, { origin: "skill-install", directory })
    }
  }

  async function handleDroppedSkillDrop(event: DragEvent) {
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice("workspace.no_directory", { tone: "warning" })
      return
    }
    try {
      const payload = await droppedSkillPayload(event)
      if (!payload) return
      if (!(await nativeConfirm(t("skill.drop_confirm", { name: payload.sourceName })))) return
      setLoading(true)
      setNotice(undefined)
      const imported = payload.archive
        ? await importSkillArchive(payload.archive.name, await fileToBase64(payload.archive), skillForm.policy, {
            directory,
            isCurrentDirectory: sourceMatchesDirectory,
          })
        : payload.files
          ? await importSkillPackage(payload.sourceName, payload.files, skillForm.policy, {
              directory,
              isCurrentDirectory: sourceMatchesDirectory,
            })
          : payload.file
            ? await importSkillFile(payload.file.name, await payload.file.text(), skillForm.policy, {
                directory,
                isCurrentDirectory: sourceMatchesDirectory,
              })
            : undefined
      if (!imported) return
      const installedNames = imported.names?.length ? imported.names.join(", ") : imported.name
      if (!sourceMatchesDirectory(directory)) return
      setPanelNotice("skill.drop_success", { vars: () => ({ name: installedNames }), tone: "success" })
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelError(e)
    } finally {
      setSkillDragActive(false)
      if (sourceMatchesDirectory(directory)) setLoading(false)
    }
  }

  async function handleBrowseFolder() {
    if (!canPickSkillDirectory()) return
    try {
      const selected = await pickDirectory()
      if (selected) {
        setSkillForm("value", selected)
      }
    } catch (e) {
      setPanelError(e, "skill.pick_folder_failed")
    }
  }

  async function handleReloadSkills() {
    await reloadCurrentPanel()
  }

  createEffect(() => {
    if (props.mode !== "skill" || props.active !== true) return
    const directory = currentDirectory()
    void reloadCurrentPanel({ directory })
  })

  createEffect(() => {
    if (props.mode !== "mcp" || props.active !== true) return
    const directory = currentDirectory()
    if (!directory) {
      void reloadCurrentPanel({ directory })
      return
    }

    const refresh = () => {
      refreshMcpStatus({ directory }).catch((e) => {
        if (sourceMatchesDirectory(directory)) setPanelError(e)
      })
    }
    void reloadCurrentPanel({ directory })
    const interval = createVisibilityInterval(refresh, MCP_STATUS_REFRESH_INTERVAL_MS, {
      onVisible: refresh,
    })
    interval.start()

    onCleanup(() => {
      interval.dispose()
    })
  })

  // ── Add MCP inline form ──

  const [showAddMcp, setShowAddMcp] = createSignal(false)
  const [mcpForm, setMcpForm] = createStore({
    name: "",
    type: "remote" as "remote" | "local",
    transport: "streamable-http" as RemoteMcpTransport,
    url: "",
    credentialType: "none" as RemoteMcpCredentialType,
    credentialName: "",
    credentialSecret: "",
    command: "",
    args: "",
  })

  async function handleAddMcp() {
    if (loading()) return
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice("workspace.no_directory", { tone: "warning" })
      return
    }
    const authority = captureApiAuthority()
    const current = () => isApiAuthorityCurrent(authority) && sourceMatchesDirectory(directory)
    setLoading(true)
    setNotice(undefined)
    try {
      const request =
        mcpForm.type === "remote"
          ? {
              name: mcpForm.name,
              type: "remote" as const,
              transport: mcpForm.transport,
              url: mcpForm.url,
              credentialType: mcpForm.credentialType,
              credentialName: mcpForm.credentialName,
              credentialSecret: mcpForm.credentialSecret,
            }
          : {
              name: mcpForm.name,
              type: "local" as const,
              command: mcpForm.command,
              args: mcpForm.args,
            }
      await addMcpServer(request, { directory, isCurrentDirectory: sourceMatchesDirectory })
      if (!current()) return
      setMcpForm({
        name: "",
        type: "remote",
        transport: "streamable-http",
        url: "",
        credentialType: "none",
        credentialName: "",
        credentialSecret: "",
        command: "",
        args: "",
      })
      setShowAddMcp(false)
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (current()) setPanelError(e, undefined, { origin: "mcp-add", directory })
    } finally {
      if (current()) setLoading(false)
    }
  }

  function noticeLocation(): ResourceNotice["origin"] {
    const origin = notice()?.origin
    if (origin === "skill-install" && showAddSkill()) return origin
    if (origin === "mcp-add" && showAddMcp()) return origin
    return "panel"
  }

  function renderNotice(location: ResourceNotice["origin"]) {
    return (
      <Show when={noticeLocation() === location ? notice() : undefined}>
        {(current) => {
          let element: HTMLDivElement | undefined
          createEffect(() => {
            const value = current()
            const directory = value.directory
            if (location === "panel" || !panelActive() || directory === undefined) return
            queueMicrotask(() => {
              if (
                element?.isConnected &&
                notice() === value &&
                noticeLocation() === location &&
                panelActive() &&
                sourceMatchesDirectory(directory)
              ) {
                element.scrollIntoView({ block: "nearest" })
              }
            })
          })
          return (
            <Feedback
              ref={(value) => (element = value)}
              tone={current().tone}
              details={current().details}
              data-ui={`${props.mode}-capability-notice`}
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  tone="neutral"
                  title={t("common.dismiss")}
                  aria-label={t("common.dismiss")}
                  onClick={() => setNotice(undefined)}
                >
                  {t("common.dismiss")}
                </Button>
              }
            >
              {t(current().key, current().vars?.())}
            </Feedback>
          )
        }}
      </Show>
    )
  }

  return (
    <>
      <Show when={loading() && props.mode !== "mcp"}>
        <div class="loading-hint">{t("common.loading")}</div>
      </Show>

      {renderNotice("panel")}

      <For each={skillLoadIssues()}>
        {(issue) => (
          <Feedback tone="error" data-ui="skill-load-issue">
            {t("skill.load_issue", {
              owner: `${issue.kind} · ${issue.path}`,
              error: issue.message,
            })}
          </Feedback>
        )}
      </For>

      {/* ── Skill Market ── */}
      <Show when={skillPanelActive()}>
        <SettingsGroup
          class="extension-settings-group"
          title={t("skill.market_title")}
          description={t("skill.market_intro")}
          actions={<Badge tone="neutral">skills.sh</Badge>}
        >
          <div class="extension-settings-body">
            <form
              class="skill-market-search"
              onSubmit={(event) => {
                event.preventDefault()
                void handleMarketSearch()
              }}
            >
              <TextField.Root as="label">
                <TextField.Label>{t("skill.market_query")}</TextField.Label>
                <TextField.Input
                  type="search"
                  value={marketQuery()}
                  placeholder={t("skill.market_query_placeholder")}
                  onInput={(event) => setMarketQuery(event.currentTarget.value)}
                />
              </TextField.Root>
              <div class="dialog-actions compact">
                <Button
                  type="submit"
                  variant="solid"
                  size="md"
                  tone="neutral"
                  disabled={marketLoading() || marketQuery().trim().length < 2}
                >
                  {marketLoading() ? t("common.loading") : t("common.search")}
                </Button>
              </div>
            </form>

            <Show when={marketDetail()}>
              {(selected) => (
                <SettingsDetailSection
                  title={selected().name}
                  description={selected().description}
                  actions={
                    <Badge
                      tone={
                        selected().risk.level === "high" ? "bad" : selected().risk.level === "medium" ? "warn" : "ok"
                      }
                    >
                      {t("skill.market_risk", { risk: selected().risk.level })}
                    </Badge>
                  }
                >
                  <SettingsRow title={t("skill.market_source")} desc={selected().repository} />
                  <SettingsRow title={t("skill.market_hash")} desc={selected().hash} />
                  <SettingsRow
                    title={t("skill.market_files")}
                    desc={selected()
                      .files.map((file) => `${file.path} (${file.size} B)`)
                      .join(" · ")}
                  />
                  <SettingsRow
                    title={t("skill.policy")}
                    actions={
                      <SelectField<FormSelectOption>
                        value={marketPolicy()}
                        options={skillPolicyOptions()}
                        ariaLabel={t("skill.policy")}
                        onChange={(value) => setMarketPolicy(value as "allow" | "deny")}
                        optionData={(option) => ({ "data-value": option.value })}
                      />
                    }
                  />
                  <div class="dialog-actions compact">
                    <Button
                      type="button"
                      variant="solid"
                      size="md"
                      tone="accent"
                      disabled={marketLoading() || selected().installed}
                      onClick={() => void handleMarketInstall(selected())}
                    >
                      {selected().installed ? t("common.loaded") : t("skill.market_install")}
                    </Button>
                  </div>
                </SettingsDetailSection>
              )}
            </Show>

            <Show when={marketResults().length > 0}>
              <SettingsDetailSection
                class="extension-list"
                title={t("skill.market_results")}
                actions={<Badge tone="neutral">{marketResults().length}</Badge>}
              >
                <For each={marketResults()}>
                  {(candidate) => (
                    <SettingsRow
                      class="extension-settings-row"
                      title={candidate.name}
                      desc={candidate.source}
                      meta={<small>{t("skill.market_installs", { count: candidate.installs })}</small>}
                      interactive
                      actions={
                        <div class="extension-settings-actions">
                          <Show when={candidate.installed}>
                            <Badge tone="ok">{t("common.loaded")}</Badge>
                          </Show>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            tone="neutral"
                            disabled={marketLoading()}
                            onClick={() => void handleMarketInspect(candidate)}
                          >
                            {t("skill.market_review")}
                          </Button>
                        </div>
                      }
                    />
                  )}
                </For>
              </SettingsDetailSection>
            </Show>
          </div>
        </SettingsGroup>
      </Show>

      {/* ── Installed Skills ── */}
      <Show when={skillPanelActive()}>
        <SettingsGroup
          class="extension-settings-group"
          data-skill-drop-active={skillDragActive() ? "true" : "false"}
          title={t("skill.installed_title")}
          actions={
            <div class="extension-settings-actions">
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                data-ui="tool-panel-action"
                title={t("skill.install")}
                aria-label={t("skill.install")}
                onClick={() => setShowAddSkill((visible) => !visible)}
              >
                <Icon name="plus" />
                <span class="tool-panel-action-label">{t("skill.install")}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                data-ui="tool-panel-action"
                title={t("common.reload")}
                aria-label={t("common.reload")}
                onClick={() => runPanelAction(t("common.reload"), handleReloadSkills)}
              >
                <Icon name="refresh" />
                <span class="tool-panel-action-label">{t("common.reload")}</span>
              </Button>
            </div>
          }
          onDragEnter={(event) => {
            event.preventDefault()
            setSkillDragActive(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
            setSkillDragActive(true)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            setSkillDragActive(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setSkillDragActive(false)
            void handleDroppedSkillDrop(event)
          }}
        >
          <div class="extension-settings-body">
            <div class="skill-drop-zone" data-active={skillDragActive() ? "true" : "false"}>
              <span class="skill-drop-zone__icon" aria-hidden="true">
                <Icon name="upload" />
              </span>
              <span class="skill-drop-zone__copy">
                <strong>{t("skill.drop_title")}</strong>
                <span>{t("skill.drop_hint")}</span>
              </span>
            </div>

            {/* Add Skill inline form */}
            <Show when={showAddSkill()}>
              <form
                class="config-inline-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleAddSkill()
                }}
              >
                <TextField.Root>
                  <TextField.Label>{t("skill.source_type")}</TextField.Label>
                  <SelectField<FormSelectOption>
                    value={skillForm.type}
                    options={skillSourceOptions()}
                    ariaLabel={t("skill.source_type")}
                    onChange={(value) => setSkillForm("type", value as any)}
                    optionData={(option) => ({ "data-value": option.value })}
                  />
                </TextField.Root>
                <TextField.Root as="label">
                  <TextField.Label>{t("skill.value")}</TextField.Label>
                  <TextField.Root variant="group">
                    <TextField.Input
                      type="text"
                      value={skillForm.value}
                      placeholder={t("skill.value_placeholder")}
                      onInput={(e) => setSkillForm("value", e.currentTarget.value)}
                    />
                    <Show when={skillForm.type === "path" && canPickSkillDirectory()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        tone="neutral"
                        title={t("skill.browse_folder")}
                        aria-label={t("skill.browse_folder")}
                        onClick={handleBrowseFolder}
                      >
                        {t("skill.browse_folder")}
                      </Button>
                    </Show>
                  </TextField.Root>
                </TextField.Root>
                <TextField.Root>
                  <TextField.Label>{t("skill.policy")}</TextField.Label>
                  <SelectField<FormSelectOption>
                    value={skillForm.policy}
                    options={skillPolicyOptions()}
                    ariaLabel={t("skill.policy")}
                    onChange={(value) => setSkillForm("policy", value as any)}
                    optionData={(option) => ({ "data-value": option.value })}
                  />
                </TextField.Root>
                {renderNotice("skill-install")}
                <div class="dialog-actions compact">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    tone="neutral"
                    title={t("common.cancel")}
                    aria-label={t("common.cancel")}
                    onClick={() => setShowAddSkill(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="solid"
                    size="md"
                    tone="accent"
                    disabled={!skillForm.value.trim()}
                    title={t("skill.install")}
                    aria-label={t("skill.install")}
                  >
                    {t("skill.install")}
                  </Button>
                </div>
              </form>
            </Show>
            <div class="extension-list" id="skillList">
              <Show
                when={poolSkills().length > 0}
                fallback={
                  <Show when={!loading()}>
                    <div class="empty-hint">{t("skill.none_custom")}</div>
                  </Show>
                }
              >
                <For each={poolSkills()}>
                  {(item) => (
                    <Disclosure.Root class="skill-installed-item">
                      <Disclosure.Trigger indicatorPosition="end">
                        <span class="skill-installed-copy">
                          <strong>{item.name}</strong>
                          <span class="skill-installed-preview">{item.description}</span>
                        </span>
                        <Badge tone="muted">{item.builtin ? t("skill.builtin") : t("common.loaded")}</Badge>
                      </Disclosure.Trigger>
                      <Disclosure.Content>
                        <SettingsRow
                          class="extension-settings-row"
                          desc={item.description || ""}
                          meta={<small>{item.location || ""}</small>}
                          actions={
                            <div class="extension-settings-actions">
                              <Show when={item.builtin}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  tone="neutral"
                                  data-ui="skill-update-builtin"
                                  disabled={loading()}
                                  onClick={() => void handleUpdateSkill(item, "builtin")}
                                >
                                  {t("skill.update_builtin")}
                                </Button>
                              </Show>
                              <Show when={!item.builtin && item.writable}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  tone="neutral"
                                  data-ui="skill-update-server"
                                  disabled={loading()}
                                  onClick={() => void handleUpdateSkill(item, "server")}
                                >
                                  {t("skill.update_server")}
                                </Button>
                              </Show>
                              <Show when={skillRemovable(item)}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="md"
                                  tone="danger"
                                  title={t("skill.delete_button_title")}
                                  aria-label={t("skill.delete_button_title")}
                                  onClick={() => handleRemoveSkill(item.source || "", skillRemoveKind(item), item.name)}
                                >
                                  {t("common.delete")}
                                </Button>
                              </Show>
                              <Show
                                when={
                                  item.location &&
                                  item.location !== "builtin" &&
                                  (isRemoteUrl(item.location) ? canOpenRemoteUrl() : true)
                                }
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="md"
                                  tone="neutral"
                                  title={skillOpenLabel(item.location!)}
                                  aria-label={skillOpenLabel(item.location!)}
                                  onClick={() => handleOpenSkill(item.location!)}
                                >
                                  {skillOpenLabel(item.location!)}
                                </Button>
                              </Show>
                            </div>
                          }
                        />
                      </Disclosure.Content>
                    </Disclosure.Root>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </SettingsGroup>
      </Show>

      {/* ── MCP Servers ── */}
      <Show when={mcpPanelActive()}>
        <SettingsGroup
          class="extension-settings-group"
          title={t("mcp.resource_management_title")}
          description={t("mcp.resource_management_intro")}
          contentInset
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                data-ui="tool-panel-action"
                title={t("mcp.add_action")}
                aria-label={t("mcp.add_action")}
                disabled={loading()}
                onClick={() =>
                  runPanelAction(t("mcp.add_action"), () => {
                    setShowAddMcp(!showAddMcp())
                  })
                }
              >
                <Icon name="plus" />
                <span class="tool-panel-action-label">{t("mcp.add_action")}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="danger"
                data-ui="tool-panel-action"
                title={t("mcp.delete_all")}
                aria-label={t("mcp.delete_all")}
                disabled={loading() || mcpEntries().length === 0}
                onClick={() => runPanelAction(t("mcp.delete_all"), handleDeleteAllMcp)}
              >
                <Icon name="cancel" />
                <span class="tool-panel-action-label">{t("mcp.delete_all")}</span>
              </Button>
            </>
          }
        >
          <div class="extension-settings-body">
            {/* Add MCP inline form */}
            <Show when={showAddMcp()}>
              <form
                class="config-inline-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleAddMcp()
                }}
              >
                <TextField.Root as="label">
                  <TextField.Label>{t("mcp.name")}</TextField.Label>
                  {/* Fixed MCP server-name example. */}
                  <TextField.Input
                    type="text"
                    value={mcpForm.name}
                    placeholder="exa"
                    onInput={(e) => setMcpForm("name", e.currentTarget.value)}
                  />
                </TextField.Root>
                <TextField.Root>
                  <TextField.Label>{t("mcp.type")}</TextField.Label>
                  <SelectField<FormSelectOption>
                    value={mcpForm.type}
                    options={mcpTypeOptions()}
                    ariaLabel={t("mcp.type")}
                    onChange={(value) => setMcpForm("type", value as any)}
                    optionData={(option) => ({ "data-value": option.value })}
                  />
                </TextField.Root>
                <Show when={mcpForm.type === "remote"}>
                  <TextField.Root>
                    <TextField.Label>{t("mcp.transport")}</TextField.Label>
                    <SelectField<FormSelectOption>
                      value={mcpForm.transport}
                      options={mcpTransportOptions()}
                      ariaLabel={t("mcp.transport")}
                      onChange={(value) => setMcpForm("transport", value as RemoteMcpTransport)}
                      optionData={(option) => ({ "data-value": option.value })}
                    />
                  </TextField.Root>
                  <TextField.Root as="label">
                    <TextField.Label>{t("mcp.remote_url")}</TextField.Label>
                    {/* Fixed remote MCP URL example. */}
                    <TextField.Input
                      type="url"
                      value={mcpForm.url}
                      placeholder="https://example.com/mcp"
                      onInput={(e) => setMcpForm("url", e.currentTarget.value)}
                    />
                  </TextField.Root>
                  <TextField.Root>
                    <TextField.Label>{t("mcp.credential.type")}</TextField.Label>
                    <SelectField<FormSelectOption>
                      value={mcpForm.credentialType}
                      options={mcpCredentialOptions()}
                      ariaLabel={t("mcp.credential.type")}
                      onChange={(value) => setMcpForm("credentialType", value as RemoteMcpCredentialType)}
                      optionData={(option) => ({ "data-value": option.value })}
                    />
                  </TextField.Root>
                  <Show when={mcpForm.credentialType === "query" || mcpForm.credentialType === "header"}>
                    <TextField.Root as="label">
                      <TextField.Label>{t("mcp.credential.name")}</TextField.Label>
                      <TextField.Input
                        type="text"
                        value={mcpForm.credentialName}
                        placeholder={mcpForm.credentialType === "query" ? "token" : "X-API-Key"}
                        onInput={(event) => setMcpForm("credentialName", event.currentTarget.value)}
                      />
                    </TextField.Root>
                  </Show>
                  <Show when={mcpForm.credentialType !== "none"}>
                    <TextField.Root as="label">
                      <TextField.Label>{t("mcp.credential.secret")}</TextField.Label>
                      <TextField.Input
                        type="password"
                        value={mcpForm.credentialSecret}
                        autocomplete="off"
                        placeholder={t("mcp.credential.secret_placeholder")}
                        onInput={(event) => setMcpForm("credentialSecret", event.currentTarget.value)}
                      />
                    </TextField.Root>
                  </Show>
                </Show>
                <Show when={mcpForm.type === "local"}>
                  <TextField.Root as="label">
                    <TextField.Label>{t("mcp.command")}</TextField.Label>
                    {/* Fixed command example. */}
                    <TextField.Input
                      type="text"
                      value={mcpForm.command}
                      placeholder="npx"
                      onInput={(e) => setMcpForm("command", e.currentTarget.value)}
                    />
                  </TextField.Root>
                  <TextField.Root as="label">
                    <TextField.Label>{t("mcp.arguments")}</TextField.Label>
                    {/* Fixed command-line argument example. */}
                    <TextField.Input
                      type="text"
                      value={mcpForm.args}
                      placeholder="-y @modelcontextprotocol/server-filesystem C:\repo"
                      onInput={(e) => setMcpForm("args", e.currentTarget.value)}
                    />
                  </TextField.Root>
                </Show>
                {renderNotice("mcp-add")}
                <div class="dialog-actions compact">
                  <Button type="button" variant="ghost" size="md" tone="neutral" onClick={() => setShowAddMcp(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="solid"
                    size="md"
                    tone="accent"
                    disabled={
                      loading() ||
                      !mcpForm.name.trim() ||
                      (mcpForm.type === "remote"
                        ? !mcpForm.url.trim() ||
                          (mcpForm.credentialType !== "none" &&
                            (!mcpForm.credentialSecret.trim() ||
                              ((mcpForm.credentialType === "query" || mcpForm.credentialType === "header") &&
                                !mcpForm.credentialName.trim())))
                        : !mcpForm.command.trim())
                    }
                  >
                    {t("mcp.add_action")}
                  </Button>
                </div>
              </form>
            </Show>
            <SettingsDetailSection
              class="extension-list"
              title={t("mcp.configured_status")}
              description={t("mcp.configured_status_help")}
              actions={
                <Show when={loading()} fallback={<Show when={mcpStatusCurrent()}><Badge tone="neutral">{mcpEntries().length}</Badge></Show>}>
                  <Badge tone="neutral">{t("common.loading")}</Badge>
                </Show>
              }
            >
              <div id="mcpList">
                <Show
                  when={mcpEntries().length > 0}
                  fallback={
                    <Show when={!loading() && mcpStatusCurrent()}>
                      <div class="empty-hint">{t("mcp.none")}</div>
                    </Show>
                  }
                >
                  <Key each={mcpEntries()} by={(entry) => entry[0]}>
                    {(entry) => {
                      const name = () => entry()[0]
                      const status = () => entry()[1]?.status
                      const label = () => mcpConnectionStatusOrDisabledLabel(status())
                      const detail = () => entry()[1]?.error || ""
                      const controllable = () => ["connected", "disabled", "disconnected", "failed"].includes(status() || "")
                      const action = () => status() === "connected" ? "mcp.disconnect" : "mcp.connect"
                      return (
                        <SettingsRow
                          class="extension-settings-row"
                          title={name()}
                          desc={detail() || undefined}
                          interactive
                          actions={
                            <>
                              <Badge tone={mcpConnectionStatusOrDisabledTone(status())}>{label()}</Badge>
                              <Show when={controllable()}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  tone="neutral"
                                  aria-disabled={loading() || undefined}
                                  aria-busy={loading() || undefined}
                                  aria-label={t(`${action()}_server`, { name: name() })}
                                  onClick={() => void handleMcpConnection(name(), status() === "connected")}
                                >
                                  {t(action())}
                                </Button>
                              </Show>
                            </>
                          }
                        />
                      )
                    }}
                  </Key>
                </Show>
              </div>
            </SettingsDetailSection>
          </div>
        </SettingsGroup>
      </Show>
    </>
  )
}

export function SkillResourceManagementPanel(
  props: { active?: boolean; directory?: DirectoryProp; onResourcesChanged?: () => void } = {},
) {
  return (
    <SharedResourceManagementPanel
      mode="skill"
      active={props.active ?? true}
      directory={props.directory}
      onResourcesChanged={props.onResourcesChanged}
    />
  )
}

export function McpResourceManagementPanel(
  props: { active?: boolean; directory?: DirectoryProp; onResourcesChanged?: () => void } = {},
) {
  return (
    <SharedResourceManagementPanel
      mode="mcp"
      active={props.active ?? true}
      directory={props.directory}
      onResourcesChanged={props.onResourcesChanged}
    />
  )
}
