import { For, Show, createEffect, createMemo, createSignal, lazy, on, onCleanup } from "solid-js"
import type { JSX } from "solid-js"
// Settings panels are the largest components in the app and none of them render
// until the operator opens this page and selects their tab, so they load on
// that click instead of riding in the startup bundle.
const ExpertSquadPanel = lazy(() => import("./settings/ExpertSquadPanel"))
const ExpertSquadMarketPanel = lazy(() => import("./settings/ExpertSquadMarketPanel"))
const ConversationCapabilityPanel = lazy(() => import("./settings/ConversationCapabilityPanel"))
const McpResourceManagementPanel = lazy(async () => ({
  default: (await import("./settings/SkillMarketPanel")).McpResourceManagementPanel,
}))
const SkillResourceManagementPanel = lazy(async () => ({
  default: (await import("./settings/SkillMarketPanel")).SkillResourceManagementPanel,
}))
const ChannelsPanel = lazy(() => import("./settings/ChannelsPanel"))
const MissionSkillPanel = lazy(() => import("./settings/MissionSkillPanel"))
const ProvidersPanel = lazy(() => import("./settings/ProvidersPanel"))
const GeneralPanel = lazy(() => import("./settings/GeneralPanel"))
const AppearancePanel = lazy(() => import("./settings/AppearancePanel"))
const NetworkPanel = lazy(() => import("./settings/NetworkPanel"))
const ArchivePanel = lazy(() => import("./settings/ArchivePanel"))
const ScheduledAutomationsPanel = lazy(() => import("./settings/ScheduledAutomationsPanel"))
const MemoryContextPanel = lazy(async () => ({
  default: (await import("./settings/MemoryContextPanel")).MemoryContextPanel,
}))
const DesktopUpdatePanel = lazy(() => import("./settings/DesktopUpdatePanel"))
const ReleaseNotesPanel = lazy(() => import("./settings/ReleaseNotesPanel"))
const UsagePanel = lazy(() => import("./settings/UsagePanel"))
import { SettingsEmpty, SettingsPanel, SettingsRow, SettingsSurface } from "./settings/layout"
import { Disclosure } from "./ui/Disclosure"
import { Button } from "./ui/Button"
import { LinkButton } from "./ui/LinkButton"
import { SearchField } from "./ui/SearchField"
import { Tab, TabList, TabPanel, Tabs } from "./ui/Tabs"
import { appStore } from "../store/app"
import { boardStore } from "../store/board"
import { settingsStore } from "../store/settings"
import { closeConfigDialog, setConfigSidebarWidth, switchConfigTab } from "../services/config-dialog-control"
import { activeProjectDirectory } from "../services/project-directory"
import { dialogStore, setDialogStore, CONFIG_SECTIONS, type ConfigDialogTab } from "../store/dialog"
import { getHostTransport } from "../services/host-transport-runtime"
import { t } from "../utils/i18n"
import {
  AUTHOR_EMAIL,
  AUTHOR_GITHUB_URL,
  AUTHOR_HOMEPAGE_URL,
  PROJECT_ISSUES_URL,
  PROJECT_URL,
} from "../utils/project-links"
import { OVERLAY_VERSION } from "../utils/version"
import brandLogoUrl from "../opencorvus-logo-dark.svg"
import { currentUIScale } from "../utils/layout-tokens"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
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

// Per-section icons (and badge anchors) are settings-page chrome and stay local;
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
  changelog: "file-document",
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
    tabs: ["general", "appearance", "network", "usage"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
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
    tabs: ["archive"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!),
  },
]
const PRODUCT_INFO_TABS = ["changelog", "about"].map((id) => CONFIG_TAB_BY_ID.get(id as ConfigDialogTab)!)

const ABOUT_LINKS: Array<{ href: string; icon: IconName; label: () => string }> = [
  { href: PROJECT_URL, icon: "github", label: () => t("about.source_code") },
  { href: AUTHOR_HOMEPAGE_URL, icon: "web-search", label: () => t("about.homepage") },
  { href: `mailto:${AUTHOR_EMAIL}`, icon: "mailbox", label: () => t("about.email") },
  { href: PROJECT_ISSUES_URL, icon: "info-circle", label: () => t("about.issues") },
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
    case "changelog":
      return "changelogBody"
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
  const [sidebarElement, setSidebarElement] = createSignal<HTMLElement>()
  const [sidebarGeometry, setSidebarGeometry] = createSignal<{ width?: number; scale: number }>({
    scale: currentUIScale(),
  })
  createEffect(() => {
    const sidebar = sidebarElement()
    if (!dialogStore.config.open || !sidebar) return
    setSidebarGeometry({ scale: currentUIScale() })
    let active = true
    const measureOnFrame = createAnimationFrameScheduler(() => {
      if (!active || !dialogStore.config.open || sidebarElement() !== sidebar || !sidebar.isConnected) return
      const width = sidebar.getBoundingClientRect().width
      if (!Number.isFinite(width) || width <= 0) return
      const scale = currentUIScale()
      setSidebarGeometry((previous) =>
        previous.width === width && previous.scale === scale ? previous : { width, scale },
      )
    })
    const sizeObserver = new ResizeObserver(measureOnFrame.schedule)
    sizeObserver.observe(sidebar, { box: "border-box" })
    const scaleObserver = new MutationObserver(measureOnFrame.schedule)
    scaleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] })
    measureOnFrame.schedule()
    onCleanup(() => {
      active = false
      sizeObserver.disconnect()
      scaleObserver.disconnect()
      measureOnFrame.cancel()
      setSidebarGeometry({ scale: currentUIScale() })
    })
  })
  const resizeBounds = createMemo(() => configSidebarResizeBounds(sidebarGeometry().scale))
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
  const renderedSidebarWidth = () => {
    const width = sidebarGeometry().width
    return width === undefined ? undefined : Math.round(width)
  }

  const aboutTechnicalRows = createMemo(() => {
    const config = appStore.config
    const rows: Array<[string, string]> = [
      [t("about.rt_core"), (config as any)?.version || t("about.rt_unavailable")],
      [t("about.rt_server"), settingsStore.serverUrl || "-"],
      [t("about.rt_pid"), typeof appStore.serverPid === "number" ? String(appStore.serverPid) : "-"],
      [t("about.rt_directory"), settingsStore.directory || "-"],
    ]
    if ((config as any)?.platform) rows.push([t("about.platform"), String((config as any).platform)])
    if ((config as any)?.goVersion) rows.push([t("about.go_version"), String((config as any).goVersion)])
    return rows
  })
  const activeConfigTab = createMemo(() => dialogStore.config.activeTab)
  const settingsSearch = () => dialogStore.config.search
  const setSettingsSearch = (value: string) => setDialogStore("config", "search", value)
  let settingsSearchInput: HTMLInputElement | undefined
  const normalizedSettingsSearch = createMemo(() => settingsSearch().trim().toLowerCase())
  const visibleConfigTabs = createMemo(() => {
    const query = normalizedSettingsSearch()
    if (!query) return CONFIG_TABS
    return CONFIG_TABS.filter((tab) =>
      `${t(tab.labelKey)} ${tab.id} ${(tab.searchTerms ?? []).join(" ")}`.toLowerCase().includes(query),
    )
  })
  const visibleConfigTabIDs = createMemo(
    () => new Set([...visibleConfigTabs().map((tab) => tab.id), activeConfigTab()]),
  )
  const activeConfigTitle = createMemo(() => t(CONFIG_TAB_BY_ID.get(activeConfigTab())!.labelKey))
  const closeSettings = closeConfigDialog
  let page: HTMLElement | undefined
  let returnFocus: HTMLElement | undefined
  createEffect(
    on(
      () => dialogStore.config.open,
      (open, previous) => {
        if (open) {
          returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
          queueMicrotask(() => {
            if (dialogStore.config.open) settingsSearchInput?.focus()
          })
          return
        }
        if (
          previous &&
          returnFocus?.isConnected &&
          (document.activeElement === document.body || page?.contains(document.activeElement))
        ) {
          returnFocus.focus()
        }
        returnFocus = undefined
      },
    ),
  )

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
      case "changelog":
        return <ReleaseNotesPanel />
      case "about":
        return (
          <SettingsPanel class="about-panel">
            <section class="about-hero">
              <div class="about-hero__identity">
                <img class="about-hero__mark" src={brandLogoUrl} alt="" aria-hidden="true" />
                <div class="about-hero__copy">
                  <span class="about-hero__eyebrow">{t("about.product_label")}</span>
                  <strong>OpenCorvus</strong>
                  <span class="about-hero__byline">
                    {t("about.by")}{" "}
                    <a href={AUTHOR_GITHUB_URL} target="_blank" rel="noopener noreferrer">
                      杨恒
                    </a>
                  </span>
                </div>
                <span class="about-hero__version">
                  {t("about.rt_overlay")} · v{OVERLAY_VERSION}
                </span>
              </div>
              <p>{t("about.self_built")}</p>
              <nav class="about-hero__links" aria-label={t("about.links")}>
                <For each={ABOUT_LINKS}>
                  {(link) => (
                    <LinkButton
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name={link.icon} size="compact" />
                      {link.label()}
                    </LinkButton>
                  )}
                </For>
              </nav>
            </section>

            <section class="about-runtime" aria-label={t("about.runtime")}>
              <header class="about-section-heading">{t("about.runtime")}</header>
              <div class="about-runtime__summary">
                <div>
                  <span>{t("about.rt_connection")}</span>
                  <strong data-state={appStore.connectionStatus}>
                    {appStore.connectionStatus === "online"
                      ? t("about.rt_connected")
                      : appStore.connectionStatus === "connecting"
                        ? t("titlebar.connection.connecting")
                        : t("about.rt_disconnected")}
                  </strong>
                </div>
                <div>
                  <span>{t("about.runtime_type")}</span>
                  <strong>{runtimeTypeLabel()}</strong>
                </div>
                <div>
                  <span>{t("about.rt_tasks")}</span>
                  <strong>{String(boardStore.tasks?.length || 0)}</strong>
                </div>
              </div>
              <Disclosure.Root class="about-disclosure">
                <Disclosure.Trigger indicatorPosition="end">{t("about.technical_details")}</Disclosure.Trigger>
                <Disclosure.Content>
                  <SettingsSurface id="aboutRuntimeGrid">
                    <For each={aboutTechnicalRows()}>{(row) => <SettingsRow title={row[0]} value={row[1]} />}</For>
                  </SettingsSurface>
                </Disclosure.Content>
              </Disclosure.Root>
            </section>
            <SettingsSurface>
              <SettingsRow
                title={t("releases.title")}
                desc={t("releases.about_description")}
                actions={
                  <Button variant="outline" size="sm" tone="neutral" onClick={() => switchConfigTab("changelog")}>
                    {t("releases.read")}
                  </Button>
                }
              />
            </SettingsSurface>
            <DesktopUpdatePanel />
            <Disclosure.Root class="about-disclosure about-shortcuts">
              <Disclosure.Trigger indicatorPosition="end">{t("about.shortcuts")}</Disclosure.Trigger>
              <Disclosure.Content>
                <SettingsSurface>
                  <SettingsRow align="center" title={<kbd>F12</kbd>} actions={t("about.shortcut_devtools")} />
                  <SettingsRow align="center" title={<kbd>Ctrl +</kbd>} actions={t("about.shortcut_zoom_in")} />
                  <SettingsRow align="center" title={<kbd>Ctrl -</kbd>} actions={t("about.shortcut_zoom_out")} />
                  <SettingsRow align="center" title={<kbd>Ctrl 0</kbd>} actions={t("about.shortcut_zoom_reset")} />
                  <SettingsRow align="center" title={<kbd>Enter</kbd>} actions={t("about.shortcut_send")} />
                  <SettingsRow align="center" title={<kbd>Shift+Enter</kbd>} actions={t("about.shortcut_newline")} />
                  <SettingsRow align="center" title={<kbd>Esc</kbd>} actions={t("about.shortcut_close")} />
                </SettingsSurface>
              </Disclosure.Content>
            </Disclosure.Root>
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
      const sidebar = sidebarElement()
      if (!sidebar?.isConnected) return false
      resizeHandle = event.currentTarget as HTMLDivElement
      resizeHandle.dataset.active = "true"
      document.body.dataset.resizing = "true"
      event.preventDefault()
      const bounds = configSidebarResizeBounds(currentUIScale())
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
    const sidebar = sidebarElement()
    if (!sidebar?.isConnected) return
    const bounds = configSidebarResizeBounds(currentUIScale())
    const requestedWidth = dialogStore.config.sidebarWidth
    const width =
      requestedWidth == null ? sidebar.getBoundingClientRect().width : clampConfigSidebarWidth(requestedWidth, bounds)
    const next = nextConfigSidebarKeyboardWidth(width, event.key, bounds)
    if (next === undefined) return
    event.preventDefault()
    setConfigSidebarWidth(next)
  }

  return (
    <Show when={dialogStore.config.open}>
      <section
        ref={page}
        id="configDialog"
        class="config-page"
        aria-label={activeConfigTitle()}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.defaultPrevented) return
          event.preventDefault()
          event.stopPropagation()
          void closeSettings()
        }}
      >
        <Tabs
          value={activeConfigTab()}
          onValueChange={switchConfigTab}
          orientation="vertical"
          class="config-dialog-layout"
        >
          <nav ref={setSidebarElement} class="config-sidebar" id="configSidebar" style={sidebarStyle()}>
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
              placeholder={t("common.search")}
              ariaLabel={t("settings.search_placeholder")}
              onValueChange={setSettingsSearch}
              onClear={() => setSettingsSearch("")}
              clearDataUI="config-search-clear"
            />
            <Show when={normalizedSettingsSearch() && visibleConfigTabs().length === 0}>
              <div role="status">
                <SettingsEmpty>{t("settings.search_no_results")}</SettingsEmpty>
              </div>
            </Show>
            <TabList size="md" tone="neutral" layout="rail" data-ui="settings-dialog-tablist">
              <For each={CONFIG_NAV_GROUPS}>
                {(group) => (
                  <Show when={group.tabs.some((tab) => visibleConfigTabIDs().has(tab.id))}>
                    <div class="config-nav-group-title oc-section-heading">{t(group.labelKey)}</div>
                    <For each={group.tabs.filter((tab) => visibleConfigTabIDs().has(tab.id))}>
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
                          <span class="config-nav-label">{t(tab.labelKey)}</span>
                          <Show when={tab.badgeID}>
                            <span class="config-nav-badge" id={tab.badgeID} />
                          </Show>
                        </Tab>
                      )}
                    </For>
                  </Show>
                )}
              </For>
              <For each={PRODUCT_INFO_TABS.filter((tab) => visibleConfigTabIDs().has(tab.id))}>
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
                    <span class="config-nav-label">{t(tab.labelKey)}</span>
                  </Tab>
                )}
              </For>
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
            aria-valuenow={renderedSidebarWidth()}
            tabIndex={0}
            title={t("config.title")}
            onPointerDown={startResize}
            onKeyDown={handleResizeKeyDown}
          />
          <div class="config-content" id="configContent">
            <h1 class="config-page-title">{activeConfigTitle()}</h1>
            <Show when={activeConfigTab()}>
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
      </section>
    </Show>
  )
}
