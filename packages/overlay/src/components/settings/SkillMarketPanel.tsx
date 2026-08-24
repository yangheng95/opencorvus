// ── Shared resource management ──
// Solid.js component for managing project Skills and MCP server definitions.
// Displays:
// • Installed custom skills with add/remove/open actions
// • Installed MCP servers with add/remove actions
// All CRUD operations are self-contained — no dependency on static HTML dialogs.

import { createEffect, createSignal, createMemo, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { SkillMountsResponse } from "@opencorvus-ai/sdk"
import { t } from "../../utils/i18n"
import { configure as configureApi } from "../../services/api"
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
  updateSkill,
  importSkillArchive,
  importSkillFile,
  importSkillPackage,
  type SkillImportPackageFile,
  type SkillLoadIssue,
  type SkillUpdateSource,
} from "../../services/extensions"
import { addMcpServer, deleteAllMcp, type RemoteMcpCredentialType, type RemoteMcpTransport } from "../../services/mcp"
import {
  mcpConnectionStatusOrDisabledLabel,
  mcpConnectionStatusOrDisabledTone,
} from "../../utils/settings-status-labels"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { TextField } from "../ui/TextField"
import { Icon } from "../ui/Icon"
import { SelectField, type SelectFieldOption } from "../ui/SelectField"
import { SettingsDetailSection, SettingsGroup, SettingsRow, SettingsState } from "./layout"

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
  const [notice, setNotice] = createSignal("")
  const [noticeStatus, setNoticeStatus] = createSignal<"active" | "error" | "warn">("error")
  const [loading, setLoading] = createSignal(false)
  const [skillDragActive, setSkillDragActive] = createSignal(false)
  const [skillLoadIssues, setSkillLoadIssues] = createSignal<SkillLoadIssue[]>([])

  function setPanelNotice(message: string, status: "active" | "error" | "warn" = "error") {
    setNotice(message)
    setNoticeStatus(status)
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

  const mcpEntries = createMemo(() => Object.entries(mcp()))

  async function refreshMcpStatus(options: { directory?: string } = {}) {
    const directory = options.directory ?? currentDirectory()
    if (!directory) return undefined
    return (await loadProjectMcpStatus({
      directory,
      isCurrentDirectory: sourceMatchesDirectory,
    })) as Record<string, McpItem>
  }

  function notifyResourceChange() {
    props.onResourcesChanged?.()
  }

  async function reloadCurrentPanel(options: { directory?: string } = {}) {
    const directory = options.directory ?? currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }
    setLoading(true)
    setNotice("")
    try {
      if (props.mode === "mcp") {
        await refreshMcpStatus({ directory })
      } else {
        await loadInstalledSkills({ directory, isCurrentDirectory: sourceMatchesDirectory })
        setSkillLoadIssues(await loadSkillIssues({ directory, isCurrentDirectory: sourceMatchesDirectory }))
      }
      if (!sourceMatchesDirectory(directory)) return
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
    } finally {
      if (sourceMatchesDirectory(directory)) setLoading(false)
    }
  }

  async function handleRemoveSkill(source: string, kind: string, name: string) {
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }
    if (!(await nativeConfirm(t("skill.delete_confirm", { name }), { okTone: "danger" }))) return
    try {
      await deleteSkill(source, kind, { directory, isCurrentDirectory: sourceMatchesDirectory })
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleUpdateSkill(item: SkillItem, source: SkillUpdateSource) {
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }
    setLoading(true)
    setNotice("")
    try {
      const result = await updateSkill(item.name, source, {
        directory,
        isCurrentDirectory: sourceMatchesDirectory,
      })
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
      if (sourceMatchesDirectory(directory)) {
        setPanelNotice(
          t("skill.update_success", { name: result.name, version: result.version || t("skill.builtin") }),
          "active",
        )
      }
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
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
        setPanelNotice(t("skill.open_failed", { error: errorDetail(e) }))
      }
      return
    }
    try {
      const outcome = await revealPath(location)
      const notice = pathRevealNoticeKey(outcome)
      if (notice) setPanelNotice(t(notice, { path: location }), "active")
    } catch (e) {
      setPanelNotice(pathRevealFailureText(e))
    }
  }

  async function handleDeleteAllMcp() {
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }
    const names = mcpEntries().map(([name]) => name)
    if (names.length === 0) return
    if (!(await nativeConfirm(t("mcp.delete_all_confirm", { count: names.length }), { okTone: "danger" }))) return
    try {
      await deleteAllMcp({ directory, isCurrentDirectory: sourceMatchesDirectory, names })
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
    }
  }

  // ── Add Skill inline form ──

  const [showAddSkill, setShowAddSkill] = createSignal(false)
  const [skillForm, setSkillForm] = createStore({
    type: "path" as "path" | "url" | "git",
    value: "",
    policy: "allow" as "allow" | "deny",
  })

  async function handleAddSkill() {
    const value = skillForm.value.trim()
    if (!value) return
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
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
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDroppedSkillDrop(event: DragEvent) {
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }
    try {
      const payload = await droppedSkillPayload(event)
      if (!payload) return
      if (!(await nativeConfirm(t("skill.drop_confirm", { name: payload.sourceName })))) return
      setLoading(true)
      setNotice("")
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
      setPanelNotice(t("skill.drop_success", { name: installedNames }), "active")
      await reloadCurrentPanel({ directory })
      notifyResourceChange()
    } catch (e) {
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
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
      setPanelNotice(t("skill.pick_folder_failed", { error: errorDetail(e) }))
    }
  }

  async function handleReloadSkills() {
    await reloadCurrentPanel()
  }

  createEffect(() => {
    if (props.mode !== "skill" || props.active !== true) return
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }

    setNotice("")
    loadInstalledSkills({ directory, isCurrentDirectory: sourceMatchesDirectory }).catch((e) => {
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
    })
  })

  createEffect(() => {
    if (props.mode !== "mcp" || props.active !== true) return
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }

    const refresh = () => {
      refreshMcpStatus({ directory }).catch((e) => {
        if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
      })
    }
    setNotice("")
    const interval = createVisibilityInterval(refresh, MCP_STATUS_REFRESH_INTERVAL_MS, {
      onVisible: refresh,
    })
    refresh()
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
    const directory = currentDirectory()
    if (!directory) {
      setPanelNotice(t("workspace.no_directory"), "warn")
      return
    }
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
      if (!sourceMatchesDirectory(directory)) return
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
      if (sourceMatchesDirectory(directory)) setPanelNotice(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <Show when={loading()}>
        <div class="loading-hint">{t("common.loading")}</div>
      </Show>

      <Show when={notice()}>
        <SettingsState
          tone={noticeStatus() === "error" ? "error" : noticeStatus() === "warn" ? "warning" : "success"}
          data-ui={`${props.mode}-capability-notice`}
          actions={
            <Button
              type="button"
              variant="ghost"
              size="md"
              tone="neutral"
              title={t("common.dismiss")}
              aria-label={t("common.dismiss")}
              onClick={() => setNotice("")}
            >
              {t("common.dismiss")}
            </Button>
          }
        >
          {notice()}
        </SettingsState>
      </Show>

      <For each={skillLoadIssues()}>
        {(issue) => (
          <SettingsState tone="error" data-ui="skill-load-issue">
            {t("skill.load_issue", {
              owner: `${issue.kind} · ${issue.path}`,
              error: issue.message,
            })}
          </SettingsState>
        )}
      </For>

      {/* ── Installed Skills ── */}
      <Show when={skillPanelActive()}>
        <SettingsGroup
          class="extension-settings-group"
          contentInset
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
              <Show when={poolSkills().length > 0} fallback={<div class="empty-hint">{t("skill.none_custom")}</div>}>
                <For each={poolSkills()}>
                  {(item) => (
                    <SettingsRow
                      class="extension-settings-row"
                      title={<span>{item.name}</span>}
                      desc={item.description || ""}
                      meta={<small>{item.location || ""}</small>}
                      interactive
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
                          <Badge tone="ok">{item.builtin ? t("skill.builtin") : t("common.loaded")}</Badge>
                        </div>
                      }
                    />
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
                disabled={mcpEntries().length === 0}
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
              actions={<Badge tone="neutral">{mcpEntries().length}</Badge>}
            >
              <div id="mcpList">
                <Show when={mcpEntries().length > 0} fallback={<div class="empty-hint">{t("mcp.none")}</div>}>
                  <For each={mcpEntries()}>
                    {([name, item]) => {
                      const status = item?.status
                      const label = mcpConnectionStatusOrDisabledLabel(status)
                      const detail = item?.error || ""
                      return (
                        <SettingsRow
                          class="extension-settings-row"
                          title={name}
                          desc={detail ? detail : label}
                          interactive
                          actions={<Badge tone={mcpConnectionStatusOrDisabledTone(status)}>{label}</Badge>}
                        />
                      )
                    }}
                  </For>
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
