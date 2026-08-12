import { For, createEffect, createMemo, createSignal, onCleanup, type Accessor, type JSX } from "solid-js"
import { t } from "../utils/i18n"
import { closeNativeMenuSurface, openNativeMenuSurface } from "../services/native-menu-surface"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { Icon, type IconName } from "./ui/Icon"
import { Button } from "./ui/Button"
import { Tab, TabList, Tabs } from "./ui/Tabs"

export type RightDockPanel =
  | "requirements"
  | "goals"
  | "explorer"
  | "diff"
  | "browser"
  | "screenshots"
  | "subagent"
  | "file"

export interface RightDockPanelMeta {
  id: RightDockPanel
  icon: IconName
  labelKey: string
  tabLabelKey: string
}

export interface RightDockTab {
  id: string
  panel: RightDockPanel
}

// Tools listed in the empty-page chooser and the "+" add menu, in display order.
// "file" is opened programmatically by the editor, so it is not user-addable.
export const RIGHT_DOCK_CATALOG: readonly RightDockPanelMeta[] = [
  { id: "browser", icon: "web-search", labelKey: "right_dock.tool.browser", tabLabelKey: "right_dock.tab.new" },
  { id: "diff", icon: "files", labelKey: "right_dock.tool.review", tabLabelKey: "right_dock.tool.review" },
  { id: "explorer", icon: "folder", labelKey: "right_dock.tool.files", tabLabelKey: "right_dock.tool.files" },
  { id: "screenshots", icon: "screenshots", labelKey: "screenshots.title", tabLabelKey: "screenshots.title" },
  {
    id: "requirements",
    icon: "spec",
    labelKey: "right_dock.tool.requirements",
    tabLabelKey: "right_dock.tool.requirements",
  },
  { id: "goals", icon: "goals", labelKey: "task_scope.goals", tabLabelKey: "task_scope.goals" },
]

const FILE_PANEL_META: RightDockPanelMeta = {
  id: "file",
  icon: "file-document",
  labelKey: "file.title",
  tabLabelKey: "file.title",
}

const SUBAGENT_PANEL_META: RightDockPanelMeta = {
  id: "subagent",
  icon: "config-agent-models",
  labelKey: "right_dock.tool.subagent",
  tabLabelKey: "right_dock.tool.subagent",
}

// Environment Information is the parent launcher for every Right Dock
// feature. Visibility remains data-driven in TaskDirBar; this catalog only
// centralizes identity, order, icon, and labels.
export const RIGHT_DOCK_ENVIRONMENT_TOOL_CATALOG: readonly RightDockPanelMeta[] = [
  ...RIGHT_DOCK_CATALOG,
  FILE_PANEL_META,
]

const ALL_RIGHT_DOCK_PANELS = [
  ...RIGHT_DOCK_CATALOG.map((meta) => meta.id),
  SUBAGENT_PANEL_META.id,
  FILE_PANEL_META.id,
] as const

const FIXED_RIGHT_DOCK_TABS = new Map<RightDockPanel, RightDockTab>(
  ALL_RIGHT_DOCK_PANELS.map((panel) => [panel, { id: panel, panel }]),
)

const META_BY_ID = Object.fromEntries(
  [...RIGHT_DOCK_CATALOG, SUBAGENT_PANEL_META, FILE_PANEL_META].map((meta) => [meta.id, meta]),
) as Record<RightDockPanel, RightDockPanelMeta>

export function rightDockPanelMeta(id: RightDockPanel): RightDockPanelMeta {
  return META_BY_ID[id]
}

export interface RightDockProps {
  /** Open tool tabs, in tab order (active tab is last). */
  tabs: Accessor<RightDockTab[]>
  /** Currently active (visible) tab. */
  active: Accessor<string | null>
  onSelect: (tabID: string) => void
  onOpen: (panel: RightDockPanel) => void
  onNewBrowserTab: (tabID: string) => void
  onClose: (tabID: string) => void
  onCloseDock: () => void
  addMenuOpen: Accessor<boolean>
  onAddMenuOpenChange: (open: boolean) => void
  overflowMenuOpen: Accessor<boolean>
  onOverflowMenuOpenChange: (open: boolean) => void
  titleForTab?: (tab: RightDockTab) => string | undefined
  /** Panel view bodies (kept mounted; Kobalte owns selected visibility). */
  children: JSX.Element
}

export function RightDock(props: RightDockProps): JSX.Element {
  let stripEl!: HTMLDivElement
  let moreBtnEl!: HTMLButtonElement
  let addBtnEl!: HTMLButtonElement
  const [hidden, setHidden] = createSignal<Set<string>>(new Set())
  const addMenuOwner = "right-dock-add"
  const overflowMenuOwner = "right-dock-overflow"

  const openSet = () => new Set(props.tabs().map((tab) => tab.id))

  function reflow(): void {
    const strip = stripEl
    const moreBtn = moreBtnEl
    if (!strip) return
    const tabEls = Array.from(strip.querySelectorAll<HTMLElement>('.right-dock-tab-shell[data-open="true"]'))
    const avail = strip.clientWidth
    if (avail === 0) return
    if (tabEls.length === 0) {
      commitHidden(new Set<string>())
      return
    }

    const stripStyle = getComputedStyle(strip)
    const gap = Number.parseFloat(stripStyle.columnGap)
    const minimumTabWidth = Number.parseFloat(getComputedStyle(tabEls[0]).minWidth)
    const dockGap = Number.parseFloat(getComputedStyle(strip.parentElement!).columnGap)
    const overflowControlWidth = Number.parseFloat(getComputedStyle(moreBtn).width) + dockGap
    const overflowVisible = hidden().size > 0
    // When overflow is already visible, reconstruct the width the strip would
    // regain after removing that control before deciding every tab fits again.
    const fullStripWidth = avail + (overflowVisible ? overflowControlWidth : 0)
    const allTabsMinimumWidth = tabEls.length * minimumTabWidth + Math.max(0, tabEls.length - 1) * gap
    if (allTabsMinimumWidth <= fullStripWidth) {
      commitHidden(new Set<string>())
      return
    }

    const budget = avail - (overflowVisible ? 0 : overflowControlWidth)
    // Capacity follows the stable minimum contract, not the current flexed
    // widths, so hiding one tab cannot make the next reflow hide another.
    const visibleCapacity = Math.max(1, Math.floor((budget + gap) / (minimumTabWidth + gap)))
    const order = props.tabs()
    const activeKey = props.active()
    const lastKey = order[order.length - 1]?.id ?? null
    const visible = new Set<string>()
    const requiredKey = activeKey ?? lastKey
    if (requiredKey) visible.add(requiredKey)

    for (let j = order.length - 1; j >= 0 && visible.size < visibleCapacity; j--) {
      visible.add(order[j].id)
    }

    const nextHidden = new Set<string>()
    for (const el of tabEls) {
      const key = el.dataset.tab
      if (key && !visible.has(key)) nextHidden.add(key)
    }
    commitHidden(nextHidden)
  }

  // Only write the `hidden` signal when the overflow set actually changes.
  // Reflow runs on every tab/active/resize change and previously allocated a
  // fresh Set each time, so identical results still re-rendered the strip —
  // which re-triggered the ResizeObserver and produced a visible tab flicker.
  function commitHidden(next: Set<string>): void {
    const prev = hidden()
    if (prev.size === next.size) {
      let same = true
      for (const key of next) {
        if (!prev.has(key)) {
          same = false
          break
        }
      }
      if (same) return
    }
    setHidden(next)
  }

  let reflowScheduled = false
  function scheduleReflow(): void {
    if (reflowScheduled) return
    reflowScheduled = true
    requestAnimationFrame(() => {
      reflowScheduled = false
      reflow()
    })
  }

  createEffect(() => {
    // re-run when tabs/active change
    props.tabs()
    props.active()
    scheduleReflow()
  })

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => scheduleReflow())
    createEffect(() => {
      if (stripEl) ro.observe(stripEl)
    })
    onCleanup(() => ro.disconnect())
  }

  const hiddenTabs = () => props.tabs().filter((tab) => hidden().has(tab.id))
  const browserTabIdentitySignature = createMemo(() =>
    props
      .tabs()
      .filter((tab) => tab.panel === "browser")
      .map((tab) => tab.id)
      .sort()
      .join("\u0000"),
  )
  const nextBlankBrowserTab = createMemo<RightDockTab>(() => {
    browserTabIdentitySignature()
    return { id: `browser:${crypto.randomUUID()}`, panel: "browser" }
  })
  const tabCollection = () => {
    const open = props.tabs()
    const openIDs = new Set(open.map((tab) => tab.id))
    return [
      ...open.map((tab) => tab.id),
      ...ALL_RIGHT_DOCK_PANELS.filter((panel) => !openIDs.has(panel)),
      nextBlankBrowserTab().id,
    ]
  }
  const tabForID = (tabID: string): RightDockTab => {
    const openTab = props.tabs().find((tab) => tab.id === tabID)
    if (openTab) return openTab
    const fixedTab = FIXED_RIGHT_DOCK_TABS.get(tabID as RightDockPanel)
    if (fixedTab) return fixedTab
    const nextBrowserTab = nextBlankBrowserTab()
    if (nextBrowserTab.id === tabID) return nextBrowserTab
    throw new Error(`Right Dock tab "${tabID}" has no open, fixed, or reserved identity`)
  }
  const tabTitle = (tab: RightDockTab) => props.titleForTab?.(tab) || t(rightDockPanelMeta(tab.panel).tabLabelKey)

  function openTabChooserFromStrip(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return
    void openAddMenu(addBtnEl)
  }

  function addMenuGroups() {
    const items = RIGHT_DOCK_CATALOG.map((meta) => ({
      id: meta.id,
      label: t(meta.labelKey),
      icon: meta.icon,
      enabled: meta.id === "browser" || !props.tabs().some((tab) => tab.panel === meta.id),
    }))
    return [{ items: items.slice(0, 4) }, { items: items.slice(4, 5) }, { items: items.slice(5) }]
  }

  async function openAddMenu(anchor: HTMLElement): Promise<void> {
    props.onOverflowMenuOpenChange(false)
    props.onAddMenuOpenChange(true)
    try {
      await openNativeMenuSurface({
        owner: addMenuOwner,
        anchor,
        groups: addMenuGroups(),
        onDismiss: () => props.onAddMenuOpenChange(false),
        onError: (error) => reportError({
          id: "right-dock:add-menu:close",
          title: t("common.error"),
          message: error instanceof Error ? error.message : String(error),
          details: formatErrorDetails(error),
        }),
        onAction: (itemID) => {
          const meta = RIGHT_DOCK_CATALOG.find((candidate) => candidate.id === itemID)
          if (!meta) throw new Error(`Right Dock add menu item "${itemID}" is not in the catalog`)
          if (meta.id === "browser") {
            props.onNewBrowserTab(nextBlankBrowserTab().id)
            return
          }
          props.onOpen(meta.id)
        },
      })
    } catch (error) {
      props.onAddMenuOpenChange(false)
      reportError({
        id: "right-dock:add-menu:open",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    }
  }

  async function openOverflowMenu(anchor: HTMLElement): Promise<void> {
    if (props.overflowMenuOpen()) {
      await closeNativeMenuSurface(overflowMenuOwner)
      return
    }

    props.onAddMenuOpenChange(false)
    props.onOverflowMenuOpenChange(true)
    try {
      await openNativeMenuSurface({
        owner: overflowMenuOwner,
        anchor,
        groups: [
          {
            items: hiddenTabs().map((tab) => {
              const meta = rightDockPanelMeta(tab.panel)
              return {
                id: tab.id,
                label: tabTitle(tab),
                icon: meta.icon,
                checked: props.active() === tab.id,
              }
            }),
          },
        ],
        onDismiss: () => props.onOverflowMenuOpenChange(false),
        onError: (error) => reportError({
          id: "right-dock:overflow-menu:close",
          title: t("common.error"),
          message: error instanceof Error ? error.message : String(error),
          details: formatErrorDetails(error),
        }),
        onAction: (tabID) => props.onSelect(tabID),
      })
    } catch (error) {
      props.onOverflowMenuOpenChange(false)
      reportError({
        id: "right-dock:overflow-menu:open",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    }
  }

  createEffect(() => {
    if (!props.addMenuOpen()) void closeNativeMenuSurface(addMenuOwner)
  })

  createEffect(() => {
    if (!props.overflowMenuOpen()) void closeNativeMenuSurface(overflowMenuOwner)
  })

  onCleanup(() => {
    void closeNativeMenuSurface(addMenuOwner)
    void closeNativeMenuSurface(overflowMenuOwner)
  })

  return (
    <Tabs class="right-dock-tabs-root" value={props.active() ?? ""} onValueChange={props.onSelect}>
      <div class="right-dock-tabs">
        <TabList
          class="right-dock-tab-strip"
          size="md"
          tone="neutral"
          layout="strip"
          aria-label={t("right_dock.open_tools")}
          ref={stripEl}
          onDblClick={openTabChooserFromStrip}
        >
          <For each={tabCollection()}>
            {(tabID) => {
              const tab = () => tabForID(tabID)
              const meta = () => rightDockPanelMeta(tab().panel)
              const isOpen = () => openSet().has(tabID)
              return (
                <div
                  class="right-dock-tab-shell"
                  data-tab={tabID}
                  data-panel={tab().panel}
                  data-open={String(isOpen())}
                  data-overflowed={String(hidden().has(tabID))}
                  aria-hidden={!isOpen() || hidden().has(tabID)}
                >
                  <Tab
                    value={tabID}
                    size="md"
                    tone="neutral"
                    class="right-dock-tab"
                    data-tab={tabID}
                    data-panel={tab().panel}
                    disabled={!isOpen() || hidden().has(tabID)}
                    aria-label={tabTitle(tab())}
                    title={tabTitle(tab())}
                  >
                    <Icon name={meta().icon} size="medium" />
                    <span class="right-dock-tab__label">{tabTitle(tab())}</span>
                  </Tab>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    tone="neutral"
                    data-chrome="icon-action"
                    class="right-dock-tab__close"
                    aria-label={t("right_dock.close_tab")}
                    title={t("right_dock.close_tab")}
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onClose(tabID)
                    }}
                  >
                    <Icon name="close" size="medium" />
                  </Button>
                </div>
              )
            }}
          </For>
        </TabList>

        <div class="right-dock-more-wrap" data-show={String(hiddenTabs().length > 0)}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="icon-action"
            class="right-dock-more"
            ref={moreBtnEl}
            title={t("right_dock.more")}
            aria-label={t("right_dock.more")}
            aria-haspopup="menu"
            aria-expanded={props.overflowMenuOpen()}
            onClick={() => void openOverflowMenu(moreBtnEl)}
          >
            <Icon name="more-horizontal" size="medium" />
          </Button>
        </div>

        <div class="right-dock-add-wrap">
          <Button
            ref={addBtnEl}
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="icon-action"
            class="right-dock-add"
            title={t("right_dock.add")}
            aria-label={t("right_dock.add")}
            aria-haspopup="menu"
            aria-expanded={props.addMenuOpen()}
            onClick={() => {
              if (props.addMenuOpen()) {
                void closeNativeMenuSurface(addMenuOwner)
                return
              }
              void openAddMenu(addBtnEl)
            }}
          >
            <Icon name="plus" size="medium" />
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="icon-action"
          class="right-dock-close"
          title={t("right_dock.close")}
          aria-label={t("right_dock.close")}
          onClick={() => {
            props.onAddMenuOpenChange(false)
            props.onOverflowMenuOpenChange(false)
            props.onCloseDock()
          }}
        >
          <Icon name="close" size="medium" />
        </Button>
      </div>

      <div class="right-dock-body" id="rightDockBody">
        <div class="right-dock-empty" data-active={String(props.tabs().length === 0)}>
          <div class="right-dock-empty__list" aria-label={t("right_dock.open_tools")}>
            <For each={RIGHT_DOCK_CATALOG}>
              {(meta) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  tone="neutral"
                  class="right-dock-empty__item"
                  data-ui={`right-dock-empty-${meta.id}`}
                  onClick={() =>
                    meta.id === "browser" ? props.onNewBrowserTab(nextBlankBrowserTab().id) : props.onOpen(meta.id)
                  }
                >
                  <Icon name={meta.icon} />
                  <span>{t(meta.labelKey)}</span>
                </Button>
              )}
            </For>
          </div>
        </div>
        {props.children}
      </div>
    </Tabs>
  )
}
