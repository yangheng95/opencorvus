import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import type { JSX } from "solid-js"
import ExpertSquadPanel from "./settings/ExpertSquadPanel"
import ExpertSquadMarketPanel from "./settings/ExpertSquadMarketPanel"
import ConversationCapabilityPanel from "./settings/ConversationCapabilityPanel"
import { McpResourceManagementPanel, SkillResourceManagementPanel } from "./settings/SkillMarketPanel"
import ChannelsPanel from "./settings/ChannelsPanel"
import MissionSkillPanel from "./settings/MissionSkillPanel"
import ProvidersPanel from "./settings/ProvidersPanel"
import GeneralPanel from "./settings/GeneralPanel"
import AppearancePanel from "./settings/AppearancePanel"
import NetworkPanel from "./settings/NetworkPanel"
import ArchivePanel from "./settings/ArchivePanel"
import ScheduledAutomationsPanel from "./settings/ScheduledAutomationsPanel"
import { MemoryContextPanel } from "./settings/MemoryContextPanel"
import DesktopUpdatePanel from "./settings/DesktopUpdatePanel"
import UsagePanel from "./settings/UsagePanel"
import { SettingsEmpty, SettingsGroup, SettingsPanel, SettingsRow, SettingsSurface } from "./settings/layout"
import { Dialog } from "./ui/Dialog"
import { Button } from "./ui/Button"
import { LinkButton } from "./ui/LinkButton"
import { SearchField } from "./ui/SearchField"
import { Tab, TabList, TabPanel, Tabs } from "./ui/Tabs"
import { appStore } from "../store/app"
import { boardStore } from "../store/board"
import { settingsStore } from "../store/settings"
import { closeConfigDialog, setConfigSidebarWidth, switchConfigTab } from "../services/config-dialog-control"
import { activeProjectDirectory } from "../services/project-directory"
import { dialogStore, CONFIG_SECTIONS, type ConfigDialogTab } from "../store/dialog"
import { getHostTransport } from "../services/host-transport-runtime"
import { t } from "../utils/i18n"
import { OVERLAY_VERSION } from "../utils/version"
import { currentUIScale } from "../utils/layout-tokens"
import { Icon, type IconName } from "./ui/Icon"
import {
  clampConfigSidebarWidth,
  configSidebarResizeBounds,
  nextConfigSidebarKeyboardWidth,
} from "../utils/config-sidebar-resizer"
import type { AutomationRunSession } from "../services/automations"

interface ConfigTabDef {
  id: ConfigDialogTab
  labelKey: string
  searchTerms?: readonly string[]
  icon: IconName
  badgeID?: string
}

// Per-section icons (and badge anchors) are dialog chrome and stay local;
// the section list, labels, and order come from CONFIG_SECTIONS
// (store/dialog.ts — single source). CONFIG_TABS merges the two.
const SECTION_ICONS: Record<ConfigDialogTab, IconName> = {
  general: "config-general",
  appearance: "config-appearance",
  code: "terminal",
  work: "work",
  "expert-squad-install": "config-expert-squad-install",
  "expert-squad": "config-expert-squad-details",
  channel: "config-channel",
  skill: "config-skill",
  "mission-skill": "workflow",
  mcp: "config-mcp",
  memory: "config-memory",
  network: "config-network",
  providers: "config-providers",
  usage: "usage-metrics",
  scheduled: "scheduled",
  archive: "archive",
  about: "info-circle",
}

const SECTION_BADGES: Partial<Record<ConfigDialogTab, string>> = {
  "expert-squad": "expertSquadBadge",
  memory: "memoryBadge",
}

const CONFIG_TABS: ConfigTabDef[] = CONFIG_SECTIONS.map((section) => ({
  id: section.id,
  labelKey: section.labelKey,
  searchTerms: section.searchTerms,
  icon: SECTION_ICONS[section.id],
  badgeID: SECTION_BADGES[section.id],
}))

const CONFIG_TAB_BY_ID = new Map(CONFIG_TABS.map((tab) => [tab.id, tab] as const))
const CONFIG_NAV_GROUPS: Array<{ labelKey: string; tabs: ConfigTabDef[] }> = [
  {
    labelKey: "settings.nav.application",
    tabs: ["general", "appearance", "network"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
  {
    labelKey: "settings.nav.product",
    tabs: ["code", "work"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
  {
    labelKey: "settings.nav.missions_automation",
    tabs: ["mission-skill", "scheduled"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
  {
    labelKey: "expert_squad.title",
    tabs: ["expert-squad-install", "expert-squad"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
  {
    labelKey: "settings.nav.shared_resources",
    tabs: ["providers", "skill", "mcp", "channel"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
  {
    labelKey: "settings.nav.context",
    tabs: ["memory"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
  {
    labelKey: "settings.nav.data",
    tabs: ["usage", "archive"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
]
const ABOUT_CONFIG_TAB = CONFIG_TABS.find((tab) => tab.id === "about") as ConfigTabDef

const ABOUT_LINKS: Array<{ href: string; icon: IconName; label: () => string }> = [
  { href: "https://github.com/yangheng95", icon: "github", label: () => "GitHub" },
  { href: "https://github.com/yangheng95/opencorvus/issues", icon: "info-circle", label: () => t("about.issues") },
]

function activePanelBodyID(tab: ConfigDialogTab): string {
  switch (tab) {
    case "general":
      return "generalBody"
    case "appearance":
      return "appearanceBody"
    case "code":
      return "codeConfigBody"
    case "work":
      return "workConfigBody"
    case "expert-squad-install":
      return "expertSquadInstallBody"
    case "expert-squad":
      return "expertSquadBody"
    case "channel":
      return "channelConfigBody"
    case "skill":
      return "skillConfigBody"
    case "mission-skill":
      return "missionSkillBody"
    case "mcp":
      return "mcpConfigBody"
    case "memory":
      return "memoryBody"
    case "network":
      return "networkBody"
    case "providers":
      return "providersConfigBody"
    case "usage":
      return "usageBody"
    case "scheduled":
      return "scheduledAutomationsBody"
    case "archive":
      return "archiveBody"
    case "about":
      return "aboutBody"
  }
}

function configTabID(tab: ConfigDialogTab): string {
  return `config-tab-${tab}`
}

function configPanelID(tab: ConfigDialogTab): string {
  return tab === "channel" ? "channelSection" : `config-panel-${tab}`
}

function runtimeTypeLabel(): string {
  const hostKind = getHostTransport().kind
  if (hostKind === "tauri") return "Tauri Desktop"
  return "Browser"
}

interface ResizableOptions {
  onStart?: (event: PointerEvent) => boolean | void
  onMove: (dx: number, dy: number, event: PointerEvent) => void
  onEnd?: () => void
}

function useResizable(opts: ResizableOptions) {
  let cleanupSession: (() => void) | undefined
  let pendingMove: { dx: number; dy: number; event: PointerEvent } | undefined
  let moveFrame = 0

  const cancelPendingMove = () => {
    if (moveFrame) {
      cancelAnimationFrame(moveFrame)
      moveFrame = 0
    }
  }

  const flushPendingMove = () => {
    cancelPendingMove()
    const pending = pendingMove
    pendingMove = undefined
    if (pending) opts.onMove(pending.dx, pending.dy, pending.event)
  }

  const schedulePendingMove = () => {
    if (moveFrame) return
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0
      flushPendingMove()
    })
  }

  const clearSession = () => {
    if (!cleanupSession) return
    flushPendingMove()
    cleanupSession()
    cleanupSession = undefined
    opts.onEnd?.()
  }

  const startResize = (event: PointerEvent) => {
    clearSession()
    if (opts.onStart?.(event) === false) return
    const startX = event.clientX
    const startY = event.clientY
    const onMove = (moveEvent: PointerEvent) => {
      pendingMove = {
        dx: moveEvent.clientX - startX,
        dy: moveEvent.clientY - startY,
        event: moveEvent,
      }
      schedulePendingMove()
    }
    const onEnd = () => clearSession()
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onEnd)
    window.addEventListener("pointercancel", onEnd)
    cleanupSession = () => {
      cancelPendingMove()
      pendingMove = undefined
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onEnd)
      window.removeEventListener("pointercancel", onEnd)
    }
  }

  onCleanup(clearSession)
  return startResize
}

export interface ConfigDialogHostProps {
  onOpenAutomationSession: (session: AutomationRunSession) => void | Promise<void>
}

export function ConfigDialogHost(props: ConfigDialogHostProps) {
  const resizeBounds = createMemo(() => configSidebarResizeBounds(currentUIScale()))
  const configuredSidebarWidth = createMemo(() => {
    const width = dialogStore.config.sidebarWidth
    if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return null
    return clampConfigSidebarWidth(width, resizeBounds())
  })
  const sidebarStyle = createMemo<Record<string, string>>(() => {
    const width = configuredSidebarWidth()
    if (width == null) return {}
    return {
      width: `${width}px`,
      "min-width": `${width}px`,
    }
  })
  const currentSidebarWidth = () => {
    const width = configuredSidebarWidth()
    if (width != null) return width
    const rendered = document.getElementById("configSidebar")?.getBoundingClientRect().width
    if (typeof rendered === "number" && Number.isFinite(rendered) && rendered > 0) {
      return clampConfigSidebarWidth(rendered, resizeBounds())
    }
    return resizeBounds().min
  }

  const aboutRows = createMemo(() => {
    const config = appStore.config
    const rows: Array<[string, string]> = [
      [t("about.rt_overlay"), `v${OVERLAY_VERSION}`],
      [t("about.rt_core"), (config as any)?.version || t("about.rt_unavailable")],
      [t("about.rt_server"), settingsStore.serverUrl || "-"],
      [t("about.rt_pid"), typeof appStore.serverPid === "number" ? String(appStore.serverPid) : "-"],
      [t("about.rt_connection"), appStore.config !== null ? t("about.rt_connected") : t("about.rt_disconnected")],
      [t("about.rt_directory"), settingsStore.directory || "-"],
      [t("about.rt_tasks"), String(boardStore.tasks?.length || 0)],
    ]
    if ((config as any)?.platform) rows.push([t("about.platform"), String((config as any).platform)])
    if ((config as any)?.goVersion) rows.push([t("about.go_version"), String((config as any).goVersion)])
    rows.push([t("about.runtime_type"), runtimeTypeLabel()])
    return rows
  })
  const activeConfigTab = createMemo(() => dialogStore.config.activeTab)
  const [settingsSearch, setSettingsSearch] = createSignal("")
  let settingsSearchInput: HTMLInputElement | undefined
  const normalizedSettingsSearch = createMemo(() => settingsSearch().trim().toLowerCase())
  const visibleConfigTabs = createMemo(() => {
    const query = normalizedSettingsSearch()
    if (!query) return CONFIG_TABS
    return CONFIG_TABS.filter((tab) =>
      `${t(tab.labelKey)} ${tab.id} ${(tab.searchTerms ?? []).join(" ")}`.toLowerCase().includes(query),
    )
  })
  const visibleConfigTabIDs = createMemo(() => new Set(visibleConfigTabs().map((tab) => tab.id)))
  const visibleConfigGroups = createMemo(() => {
    return CONFIG_NAV_GROUPS.map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => visibleConfigTabIDs().has(tab.id)),
    })).filter((group) => group.tabs.length > 0)
  })
  const effectiveActiveTab = createMemo<ConfigDialogTab | null>(() => {
    const visible = visibleConfigTabs()
    const active = activeConfigTab()
    return visible.some((tab) => tab.id === active) ? active : (visible[0]?.id ?? null)
  })
  const activeConfigTitle = createMemo(() => {
    const active = effectiveActiveTab()
    return active ? t(CONFIG_TAB_BY_ID.get(active)!.labelKey) : t("config.title")
  })
  const closeSettings = () => {
    setSettingsSearch("")
    return closeConfigDialog()
  }

  const renderActivePanel = (tab: ConfigDialogTab) => {
    switch (tab) {
      case "general":
        return <GeneralPanel />
      case "appearance":
        return <AppearancePanel />
      case "code":
        return <ConversationCapabilityPanel experience="chat" directory={activeProjectDirectory} />
      case "work":
        return <ConversationCapabilityPanel experience="work" directory={activeProjectDirectory} />
      case "expert-squad-install":
        return <ExpertSquadMarketPanel />
      case "expert-squad":
        return <ExpertSquadPanel />
      case "channel":
        return <ChannelsPanel directory={activeProjectDirectory()} />
      case "skill":
        return <SkillResourceManagementPanel directory={activeProjectDirectory} />
      case "mission-skill":
        return <MissionSkillPanel />
      case "mcp":
        return <McpResourceManagementPanel directory={activeProjectDirectory} />
      case "memory":
        return <MemoryContextPanel />
      case "network":
        return <NetworkPanel />
      case "providers":
        return <ProvidersPanel />
      case "usage":
        return <UsagePanel />
      case "scheduled":
        return <ScheduledAutomationsPanel onOpenSession={props.onOpenAutomationSession} />
      case "archive":
        return <ArchivePanel />
      case "about":
        return (
          <SettingsPanel>
            <SettingsGroup title={t("about.author_name")}>
              <SettingsSurface>
                <SettingsRow
                  align="center"
                  leading={<Icon name="avatar-user" size="display" />}
                  title="杨恒@Hithink Research"
                />
              </SettingsSurface>
            </SettingsGroup>
            <SettingsGroup title={t("about.runtime")}>
              <SettingsSurface id="aboutRuntimeGrid">
                <For each={aboutRows()}>
                  {(row) => <SettingsRow align="center" title={row[0]} actions={<span>{row[1]}</span>} />}
                </For>
              </SettingsSurface>
            </SettingsGroup>
            <DesktopUpdatePanel />
            <SettingsGroup title={t("about.links")} contentInset>
              <div class="about-links">
                <For each={ABOUT_LINKS}>
                  {(link) => (
                    <LinkButton
                      variant="outline"
                      size="md"
                      tone="neutral"
                      href={link.href}
                      target="_blank"
                      rel="noopener"
                    >
                      <Icon name={link.icon} />
                      <span>{link.label()}</span>
                    </LinkButton>
                  )}
                </For>
              </div>
            </SettingsGroup>
            <SettingsGroup title={t("about.shortcuts")}>
              <SettingsSurface>
                <SettingsRow align="center" title={<kbd>F12</kbd>} actions={t("about.shortcut_devtools")} />
                <SettingsRow align="center" title={<kbd>Ctrl +</kbd>} actions={t("about.shortcut_zoom_in")} />
                <SettingsRow align="center" title={<kbd>Ctrl -</kbd>} actions={t("about.shortcut_zoom_out")} />
                <SettingsRow align="center" title={<kbd>Ctrl 0</kbd>} actions={t("about.shortcut_zoom_reset")} />
                <SettingsRow align="center" title={<kbd>Enter</kbd>} actions={t("about.shortcut_send")} />
                <SettingsRow align="center" title={<kbd>Shift+Enter</kbd>} actions={t("about.shortcut_newline")} />
                <SettingsRow align="center" title={<kbd>Esc</kbd>} actions={t("about.shortcut_close")} />
              </SettingsSurface>
            </SettingsGroup>
          </SettingsPanel>
        )
    }
  }

  let resizeHandle: HTMLDivElement | undefined
  let resizeStartWidth = 0
  let resizeMin = 0
  let resizeMax = 0
  const startResize = useResizable({
    onStart: (event) => {
      if (event.button !== 0) return false
      const sidebar = document.getElementById("configSidebar")
      if (!sidebar) return false
      resizeHandle = event.currentTarget as HTMLDivElement
      resizeHandle.dataset.active = "true"
      document.body.dataset.resizing = "true"
      event.preventDefault()
      const bounds = resizeBounds()
      resizeStartWidth = sidebar.getBoundingClientRect().width
      resizeMin = bounds.min
      resizeMax = bounds.max
      return true
    },
    onMove: (dx) => {
      const next = clampConfigSidebarWidth(resizeStartWidth + dx, { min: resizeMin, max: resizeMax, step: 1 })
      setConfigSidebarWidth(next)
    },
    onEnd: () => {
      if (resizeHandle) delete resizeHandle.dataset.active
      resizeHandle = undefined
      delete document.body.dataset.resizing
    },
  })
  const handleResizeKeyDown: JSX.EventHandlerUnion<HTMLDivElement, KeyboardEvent> = (event) => {
    const next = nextConfigSidebarKeyboardWidth(currentSidebarWidth(), event.key, resizeBounds())
    if (next === undefined) return
    event.preventDefault()
    setConfigSidebarWidth(next)
  }

  return (
    <Dialog
      id="configDialog"
      open={dialogStore.config.open}
      fullscreen={true}
      modal={false}
      backdropClose={false}
      overlayClass="config-dialog-overlay"
      title={activeConfigTitle()}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        settingsSearchInput?.focus()
      }}
      onClose={closeSettings}
    >
      <Show when={dialogStore.config.open}>
        <Tabs
          value={effectiveActiveTab() ?? activeConfigTab()}
          onValueChange={switchConfigTab}
          orientation="vertical"
          class="config-dialog-layout"
        >
          <nav class="config-sidebar" id="configSidebar" style={sidebarStyle()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tone="neutral"
              class="config-back-button oc-navigation-row"
              data-ui="config-back-to-app"
              onClick={closeSettings}
            >
              <Icon name="nav-back" size="medium" />
              <span>{t("settings.back_to_app")}</span>
            </Button>
            <SearchField
              class="config-search"
              size="md"
              value={settingsSearch()}
              inputRef={(element) => (settingsSearchInput = element)}
              placeholder={t("settings.search_placeholder")}
              onValueChange={setSettingsSearch}
              onClear={() => setSettingsSearch("")}
              clearDataUI="config-search-clear"
            />
            <TabList size="md" tone="neutral" data-ui="settings-dialog-tablist">
              <For each={visibleConfigGroups()}>
                {(group) => (
                  <>
                    <div class="config-nav-group-title oc-section-heading">{t(group.labelKey)}</div>
                    <For each={group.tabs}>
                      {(tab) => (
                        <Tab
                          value={tab.id}
                          size="md"
                          tone="neutral"
                          data-config-tab={tab.id}
                          id={configTabID(tab.id)}
                          aria-controls={configPanelID(tab.id)}
                        >
                          <Icon class="config-nav-icon" name={tab.icon} size="medium" />
                          <span>{t(tab.labelKey)}</span>
                          <Show when={tab.badgeID}>
                            <span class="config-nav-badge" id={tab.badgeID} />
                          </Show>
                        </Tab>
                      )}
                    </For>
                  </>
                )}
              </For>
              <Show when={visibleConfigTabIDs().has("about")}>
                <Tab
                  value="about"
                  size="md"
                  tone="neutral"
                  data-config-tab="about"
                  id={configTabID("about")}
                  aria-controls={configPanelID("about")}
                >
                  <Icon class="config-nav-icon" name={ABOUT_CONFIG_TAB.icon} size="medium" />
                  <span>{t(ABOUT_CONFIG_TAB.labelKey)}</span>
                </Tab>
              </Show>
            </TabList>
          </nav>
          <div
            class="config-resizer"
            id="configResizer"
            role="separator"
            aria-orientation="vertical"
            aria-controls="configSidebar"
            aria-label={t("config.title")}
            aria-valuemin={Math.round(resizeBounds().min)}
            aria-valuemax={Math.round(resizeBounds().max)}
            aria-valuenow={currentSidebarWidth()}
            tabIndex={0}
            title={t("config.title")}
            onPointerDown={startResize}
            onKeyDown={handleResizeKeyDown}
          />
          <div class="config-content" id="configContent">
            <h1 class="config-page-title">{activeConfigTitle()}</h1>
            <Show
              when={effectiveActiveTab()}
              fallback={<SettingsEmpty>{t("settings.search_no_results")}</SettingsEmpty>}
            >
              {(active) => (
                <TabPanel
                  value={active()}
                  class="config-tab-panel"
                  data-config-panel={active()}
                  id={configPanelID(active())}
                  aria-labelledby={configTabID(active())}
                >
                  <div
                    classList={{ "config-section-body": true, "about-body": active() === "about" }}
                    id={activePanelBodyID(active())}
                  >
                    {renderActivePanel(active())}
                  </div>
                </TabPanel>
              )}
            </Show>
          </div>
        </Tabs>
      </Show>
    </Dialog>
  )
}
