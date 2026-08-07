import { CONFIG_SECTIONS, type ConfigDialogTab, setDialogStore } from "../store/dialog"
import { clampConfigSidebarWidth, configSidebarResizeBounds } from "../utils/config-sidebar-resizer"
import { currentUIScale } from "../utils/layout-tokens"
import { occludeNativeSurfaces, revealNativeSurfaces } from "./native-surface-occlusion"

const CONFIG_DIALOG_TABS = new Set<ConfigDialogTab>(CONFIG_SECTIONS.map((section) => section.id))
const CONFIG_SECTION_TARGETS: Record<string, { tab: ConfigDialogTab; elementID?: string }> = {
  mcp: { tab: "mcp", elementID: "mcpList" },
}

let configSectionFocusFrame = 0

function normalizeConfigTab(tabName: string): ConfigDialogTab {
  return CONFIG_DIALOG_TABS.has(tabName as ConfigDialogTab) ? (tabName as ConfigDialogTab) : "general"
}

function focusConfigElementAfterDialogFrame(elementID: string, focus: (element: HTMLElement) => void): void {
  if (configSectionFocusFrame) window.cancelAnimationFrame(configSectionFocusFrame)
  configSectionFocusFrame = window.requestAnimationFrame(() => {
    configSectionFocusFrame = window.requestAnimationFrame(() => {
      configSectionFocusFrame = 0
      const element = document.getElementById(elementID)
      if (element instanceof HTMLElement) focus(element)
    })
  })
}

function cancelConfigSectionFocusFrame(): void {
  if (!configSectionFocusFrame) return
  window.cancelAnimationFrame(configSectionFocusFrame)
  configSectionFocusFrame = 0
}

export async function openChannelSettings(_channelID?: string): Promise<void> {
  await openConfigDialog("channel")
}

export function switchConfigTab(tabName: string): void {
  setDialogStore("config", "activeTab", normalizeConfigTab(tabName))
}

export function focusConfigSection(name: string): void {
  if (!name) return
  const target = CONFIG_SECTION_TARGETS[name]
  switchConfigTab(target?.tab ?? name)
  if (name === "channel") {
    focusConfigElementAfterDialogFrame("channelList", (element) => element.scrollTo({ top: 0 }))
  }
  if (target?.elementID) {
    focusConfigElementAfterDialogFrame(target.elementID, (element) => element.scrollIntoView({ block: "start" }))
  }
}

export function openConfigDialog(
  section?: string,
): Promise<void> {
  return occludeNativeSurfaces("config-dialog").then(() => {
    if (section) focusConfigSection(section)
    setDialogStore("config", "open", true)
  })
}

export async function closeConfigDialog(): Promise<void> {
  cancelConfigSectionFocusFrame()
  setDialogStore("config", "open", false)
  await revealNativeSurfaces("config-dialog")
}

export function setConfigSidebarWidth(width: number): void {
  if (!Number.isFinite(width) || width <= 0) return
  setDialogStore("config", "sidebarWidth", clampConfigSidebarWidth(width, configSidebarResizeBounds(currentUIScale())))
}
