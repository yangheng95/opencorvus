import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Portal } from "solid-js/web"
import { settingsStore, setSettingsStore, saveSettings } from "../../store/settings"
import { applyLocalePreference } from "../../services/locale-preference"
import { applyThemePreference } from "../../services/theme-preference"
import { openDocumentationEntry } from "../../services/documentation"
import { openConfigDialog } from "../../services/config-dialog-control"
import { applyZoom, sanitizeZoom, toggleDevtools } from "../../services/theme"
import { themeOptionsForCurrentHost } from "../../services/theme-registry"
import { browseDirectory, closeProject, openGlobalChatLauncher } from "../../services/workspace"
import { quitOverlay } from "../../services/window"
import { getHostTransport } from "../../services/host-transport-runtime"
import { installNativeMenuListener, type NativeMenuActionID, usesNativeMacosMenu } from "../../services/native-menu"
import { formatErrorDetails, reportError } from "../../services/diagnostics"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { Menubar } from "../ui/Menubar"
import { Slider } from "../ui/Slider"

type MenuID = "file" | "edit" | "view" | "help"
type FileShortcutID = "new-window" | "new-chat" | "quick-chat" | "open-folder" | "close" | "settings" | "exit"

type MenuDef = {
  id: MenuID
  label: string
  compact: string
  accessKey: string
}

const MENU_IDS: MenuID[] = ["file", "edit", "view", "help"]
const MENU_ACCESS_KEYS: Record<MenuID, string> = {
  file: "f",
  edit: "e",
  view: "v",
  help: "h",
}

interface FileShortcutDefinition {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  display: string
  aria: string
}

const FILE_SHORTCUTS: Record<FileShortcutID, FileShortcutDefinition> = {
  "new-window": { key: "n", ctrl: true, alt: false, shift: true, display: "Ctrl+Shift+N", aria: "Control+Shift+N" },
  "new-chat": { key: "n", ctrl: true, alt: false, shift: false, display: "Ctrl+N", aria: "Control+N" },
  "quick-chat": { key: "n", ctrl: true, alt: true, shift: false, display: "Alt+Ctrl+N", aria: "Alt+Control+N" },
  "open-folder": { key: "o", ctrl: true, alt: false, shift: false, display: "Ctrl+O", aria: "Control+O" },
  close: { key: "w", ctrl: true, alt: false, shift: false, display: "Ctrl+W", aria: "Control+W" },
  settings: { key: ",", ctrl: true, alt: false, shift: false, display: "Ctrl+Comma", aria: "Control+," },
  exit: { key: "q", ctrl: true, alt: false, shift: false, display: "Ctrl+Q", aria: "Control+Q" },
}

/* The macOS build keeps AppKit's application menu, and that menu owns the real
 * accelerators. The in-window menubar mirrors this build's own Ctrl bindings
 * everywhere else, so on macOS it has to quote the Command bindings AppKit
 * actually installs instead. */
const MACOS_FILE_SHORTCUTS: Record<FileShortcutID, { display: string; aria: string }> = {
  "new-window": { display: "⇧⌘N", aria: "Meta+Shift+N" },
  "new-chat": { display: "⌘N", aria: "Meta+N" },
  "quick-chat": { display: "⌥⌘N", aria: "Alt+Meta+N" },
  "open-folder": { display: "⌘O", aria: "Meta+O" },
  close: { display: "⌘W", aria: "Meta+W" },
  settings: { display: "⌘,", aria: "Meta+," },
  exit: { display: "⌘Q", aria: "Meta+Q" },
}

const SEARCH_SHORTCUT = { display: "Ctrl+G", aria: "Control+G" }
const MACOS_SEARCH_SHORTCUT = { display: "⌘G", aria: "Meta+G" }

function fileShortcutIDForEvent(event: KeyboardEvent): FileShortcutID | null {
  const key = event.key.toLowerCase()
  const entry = (Object.entries(FILE_SHORTCUTS) as Array<[FileShortcutID, FileShortcutDefinition]>).find(
    ([, shortcut]) =>
      shortcut.key === key &&
      shortcut.ctrl === event.ctrlKey &&
      shortcut.alt === event.altKey &&
      shortcut.shift === event.shiftKey &&
      !event.metaKey,
  )
  return entry?.[0] ?? null
}

function menuIDForAccessKey(key: string): MenuID | null {
  const normalized = key.toLowerCase()
  return MENU_IDS.find((id) => MENU_ACCESS_KEYS[id] === normalized) ?? null
}

function menuActionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function runTitlebarMenuAction(label: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => {
      reportError({
        id: `titlebar-menu:${label}`,
        title: t("common.error"),
        message: menuActionErrorMessage(error),
        details: formatErrorDetails(error),
      })
    })
  } catch (error) {
    reportError({
      id: `titlebar-menu:${label}`,
      title: t("common.error"),
      message: menuActionErrorMessage(error),
      details: formatErrorDetails(error),
    })
  }
}

function MenuItem(props: {
  children: any
  onClick: () => void | Promise<void>
  meta?: string
  ariaLabel?: string
  disabled?: boolean
  testid?: string
  ariaKeyShortcuts?: string
}) {
  const childrenTitle = () => (typeof props.children === "string" ? props.children : undefined)
  const accessibleLabel = () => props.ariaLabel || childrenTitle() || props.meta
  return (
    <Menubar.Item
      as="button"
      type="button"
      class="titlebar-menubar-item"
      disabled={props.disabled}
      data-testid={props.testid}
      aria-label={accessibleLabel()}
      aria-keyshortcuts={props.ariaKeyShortcuts}
      onSelect={() => runTitlebarMenuAction(accessibleLabel() || "menu-item", props.onClick)}
    >
      <span class="titlebar-menubar-item-title">{props.children}</span>
      <Show when={props.meta}>
        <span class="titlebar-menubar-item-meta">{props.meta}</span>
      </Show>
    </Menubar.Item>
  )
}

function MenuGroup(props: { title: string; children: any }) {
  return (
    <Menubar.Group class="titlebar-menubar-group">
      <Menubar.GroupLabel class="titlebar-menubar-group-title oc-section-heading">{props.title}</Menubar.GroupLabel>
      {props.children}
    </Menubar.Group>
  )
}

function MenuSeparator() {
  return <Menubar.Separator />
}

function MenuRange(props: {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  disabled?: boolean
  testid?: string
  onChange: (value: number) => void | Promise<void>
}) {
  function commit(value: number | undefined) {
    if (value !== undefined) runTitlebarMenuAction(props.label, () => props.onChange(value))
  }

  return (
    <Slider.Root
      class="oc-menu-item titlebar-menubar-range"
      value={[props.value]}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      disabled={props.disabled}
      onChange={(values) => commit(values[0])}
    >
      <span class="titlebar-menubar-range-copy">
        <Slider.Label class="titlebar-menubar-item-title">{props.label}</Slider.Label>
        <span class="titlebar-menubar-item-meta">{props.description}</span>
      </span>
      <span class="titlebar-menubar-range-control">
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb>
            <Slider.Input aria-label={props.label} data-testid={props.testid} />
          </Slider.Thumb>
        </Slider.Track>
        <span class="titlebar-menubar-range-value" aria-hidden="true">
          {props.value}
          {props.unit || ""}
        </span>
      </span>
    </Slider.Root>
  )
}

export function TitlebarMenubar() {
  const [openMenu, setOpenMenu] = createSignal<MenuID | null>(null)
  const [autoFocusMenu, setAutoFocusMenu] = createSignal(false)
  let rootRef: HTMLDivElement | undefined
  let pointerDriftInProgress = false
  let altPressedOnly = false
  const hostTransport = getHostTransport()
  const hostCapabilities = hostTransport.capabilities
  const nativeCommands = hostCapabilities.nativeCommands
  const nativeMacosMenu = usesNativeMacosMenu(__OPENCORVUS_BUILD_PLATFORM__, hostTransport.kind)

  function shortcut(id: FileShortcutID): { display: string; aria: string } {
    return nativeMacosMenu ? MACOS_FILE_SHORTCUTS[id] : FILE_SHORTCUTS[id]
  }

  function searchShortcut(): { display: string; aria: string } {
    return nativeMacosMenu ? MACOS_SEARCH_SHORTCUT : SEARCH_SHORTCUT
  }

  const menus = createMemo<MenuDef[]>(() => [
    { id: "file", label: t("titlebar.menu.file"), compact: "F", accessKey: MENU_ACCESS_KEYS.file },
    { id: "edit", label: t("titlebar.menu.edit"), compact: "E", accessKey: MENU_ACCESS_KEYS.edit },
    { id: "view", label: t("titlebar.menu.view"), compact: "V", accessKey: MENU_ACCESS_KEYS.view },
    { id: "help", label: t("titlebar.menu.help"), compact: "H", accessKey: MENU_ACCESS_KEYS.help },
  ])

  function closeMenu() {
    setAutoFocusMenu(false)
    setOpenMenu(null)
  }

  // Kobalte moves the menubar to whichever trigger the pointer or the focus lands on as soon as the
  // menubar carries a value, and this menubar stays controlled with `null` — never `undefined` — while
  // closed, so that guard can never turn the drift off on its own. Mark the drift so a closed menubar
  // ignores it: pointing at the titlebar never opens a menu, only an explicit activation does.
  function markPointerDrift(): void {
    pointerDriftInProgress = true
    queueMicrotask(() => {
      pointerDriftInProgress = false
    })
  }

  function handleMenuValueChange(value: string | null | undefined) {
    if (value && MENU_IDS.includes(value as MenuID)) {
      if (openMenu() === null && pointerDriftInProgress) return
      setAutoFocusMenu(true)
      setOpenMenu(value as MenuID)
      return
    }
    closeMenu()
  }

  function menuTrigger(id: MenuID): HTMLButtonElement {
    const trigger = document.querySelector<HTMLButtonElement>(`[data-menu-trigger="${id}"]`)
    if (!trigger) {
      throw new Error(`Missing titlebar menu trigger: ${id}`)
    }
    return trigger
  }

  function focusTrigger(id: MenuID) {
    menuTrigger(id).focus()
  }

  function focusInitialMenuItem(id: MenuID) {
    queueMicrotask(() => {
      const menu = document.getElementById(`titlebar-menu-${id}`)
      if (!menu) {
        throw new Error(`Missing titlebar menu content: ${id}`)
      }
      const checkedRadio = menu.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]:not([aria-disabled="true"])',
      )
      const firstItem =
        checkedRadio ??
        menu.querySelector<HTMLElement>(
          '[role="menuitemradio"]:not([aria-disabled="true"]), [role="menuitem"]:not([aria-disabled="true"])',
        )
      if (!firstItem) {
        throw new Error(`Missing focusable titlebar menu item: ${id}`)
      }
      firstItem.focus()
    })
  }

  function openFromKeyboard(id: MenuID) {
    setAutoFocusMenu(true)
    setOpenMenu(id)
    focusInitialMenuItem(id)
  }

  function openConfig(section: string) {
    openConfigDialog(section)
    closeMenu()
  }

  async function openDocumentation(id: "quickstart" | "sdk") {
    try {
      const opened = await openDocumentationEntry(id, settingsStore.locale)
      if (!opened) throw new Error(`Host did not open documentation entry: ${id}`)
    } catch (error) {
      reportError({
        id: `titlebar:documentation:${id}`,
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    } finally {
      closeMenu()
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('[data-menu-trigger="help"]')?.focus()
      })
    }
  }

  function openLogs() {
    window.dispatchEvent(new CustomEvent("oc:open-logs"))
    closeMenu()
  }

  async function setTheme(value: string) {
    await applyThemePreference(value)
  }

  async function setZoomPercent(value: number) {
    const next = sanitizeZoom(value / 100)
    setSettingsStore("zoom", next)
    applyZoom(next)
    await saveSettings()
  }

  async function resetLayout() {
    setSettingsStore({
      sidebarWidth: null,
      sidebarCollapsed: false,
    })
    try {
      await saveSettings()
    } finally {
      closeMenu()
    }
  }

  async function startNewChat() {
    closeMenu()
    await openGlobalChatLauncher()
  }

  async function openFolder() {
    try {
      await browseDirectory()
    } finally {
      closeMenu()
    }
  }

  async function closeCurrentProject() {
    try {
      await closeProject()
    } finally {
      closeMenu()
    }
  }

  function openNewWindow() {
    window.open(window.location.href, "_blank", "noopener")
    closeMenu()
  }

  function focusSidebarSearch() {
    closeMenu()
    const input = document.querySelector<HTMLInputElement>('[data-ui="work-ledger-search"]')
    if (input) {
      input.focus()
      return
    }
    document.querySelector<HTMLButtonElement>('[data-ui="work-ledger-search-toggle"]')?.click()
  }

  async function exitApp() {
    try {
      await quitOverlay()
    } finally {
      closeMenu()
    }
  }

  const fileShortcutActions: Record<FileShortcutID, () => void | Promise<void>> = {
    "new-window": openNewWindow,
    "new-chat": startNewChat,
    "quick-chat": startNewChat,
    "open-folder": openFolder,
    close: closeCurrentProject,
    settings: () => openConfig("general"),
    exit: exitApp,
  }

  const nativeMenuActions: Record<NativeMenuActionID, () => void | Promise<void>> = {
    "native-menu:settings": () => openConfig("general"),
    "native-menu:quit": exitApp,
    "native-menu:new-window": openNewWindow,
    "native-menu:new-chat": startNewChat,
    "native-menu:quick-chat": startNewChat,
    "native-menu:open-folder": openFolder,
    "native-menu:close-project": closeCurrentProject,
    "native-menu:search": focusSidebarSearch,
    "native-menu:providers": () => openConfig("providers"),
    "native-menu:theme-system": () => setTheme("system"),
    "native-menu:theme-light": () => setTheme("light"),
    "native-menu:theme-dark": () => setTheme("dark"),
    "native-menu:theme-vscode-dark": () => setTheme("vscode-dark"),
    "native-menu:toggle-locale": async () => {
      await applyLocalePreference(settingsStore.locale === "zh-CN" ? "en-US" : "zh-CN")
    },
    "native-menu:zoom-in": () => setZoomPercent(Math.round(settingsStore.zoom * 100) + 5),
    "native-menu:zoom-out": () => setZoomPercent(Math.round(settingsStore.zoom * 100) - 5),
    "native-menu:zoom-reset": () => setZoomPercent(100),
    "native-menu:reset-layout": resetLayout,
    "native-menu:docs": () => openDocumentation("quickstart"),
    "native-menu:sdk": () => openDocumentation("sdk"),
    "native-menu:logs": openLogs,
    "native-menu:devtools": toggleDevtools,
  }

  onMount(() => {
    // macOS renders this menubar in the window titlebar as well, but AppKit's
    // application menu stays the one owner of the accelerators there -- it
    // carries the Command bindings and the Edit items the WebView needs. So
    // the macOS build wires that menu's events and installs none of the Ctrl
    // shortcuts or Alt access keys the Windows and Linux builds depend on.
    if (nativeMacosMenu) {
      let disposed = false
      let unlisten: (() => void) | undefined
      void installNativeMenuListener((action) => runTitlebarMenuAction(action, nativeMenuActions[action]))
        .then((dispose) => {
          if (disposed) dispose()
          else unlisten = dispose
        })
        .catch((error) => {
          reportError({
            id: "native-menu:listener",
            title: t("common.error"),
            message: menuActionErrorMessage(error),
            details: formatErrorDetails(error),
          })
        })
      onCleanup(() => {
        disposed = true
        unlisten?.()
      })
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const shortcutID = fileShortcutIDForEvent(event)
      if (shortcutID) {
        if (shortcutID === "open-folder" && !nativeCommands["workspace.pickDir"]) return
        event.preventDefault()
        altPressedOnly = false
        if (shortcutID === "close" && !settingsStore.directory) return
        runTitlebarMenuAction(FILE_SHORTCUTS[shortcutID].display, fileShortcutActions[shortcutID])
        return
      }
      if (event.key === "Alt" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        altPressedOnly = true
        event.preventDefault()
        return
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const id = menuIDForAccessKey(event.key)
        altPressedOnly = false
        event.preventDefault()
        if (id) {
          openFromKeyboard(id)
          return
        }
        closeMenu()
        return
      } else if (event.key !== "Alt") {
        altPressedOnly = false
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Alt" || !altPressedOnly) return
      altPressedOnly = false
      event.preventDefault()
      const current = openMenu()
      if (current) {
        closeMenu()
        focusTrigger(current)
      } else {
        focusTrigger("file")
      }
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("keyup", onKeyUp)
    onCleanup(() => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("keyup", onKeyUp)
    })
  })

  const zoomPercent = createMemo(() => Math.round(settingsStore.zoom * 100))
  const themeOptions = themeOptionsForCurrentHost()

  return (
    /* OpenCorvus is the visible product brand, so this menubar landmark keeps the literal brand label. */
    <Menubar.Root
      class="titlebar-menubar"
      aria-label="OpenCorvus"
      data-no-drag="true"
      value={openMenu()}
      onValueChange={handleMenuValueChange}
      autoFocusMenu={autoFocusMenu()}
      onAutoFocusMenuChange={setAutoFocusMenu}
      ref={(el) => (rootRef = el)}
    >
      <For each={menus()}>
        {(menu) => (
          <Menubar.Menu value={menu.id} placement="bottom-start" gutter={7} fitViewport slide={false} flip={false}>
            <div class="titlebar-menubar-slot">
              <Menubar.Trigger
                as={Button}
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                data-ui="titlebar-menubar-trigger"
                data-menu-trigger={menu.id}
                data-compact={menu.compact}
                data-access-key={menu.accessKey}
                aria-label={menu.label}
                aria-keyshortcuts={`Alt+${menu.accessKey.toUpperCase()}`}
                onMouseOver={markPointerDrift}
                onFocus={markPointerDrift}
              >
                <span class="titlebar-menu-trigger-label">{menu.label}</span>
                <span class="titlebar-menu-trigger-compact" aria-hidden="true">
                  {menu.compact}
                </span>
              </Menubar.Trigger>
            </div>
            <Portal>
              <Menubar.Content
                id={`titlebar-menu-${menu.id}`}
                class="titlebar-menubar-panel"
                data-menu={menu.id}
                data-testid={`titlebar-menu-${menu.id}`}
              >
                <Show when={menu.id === "file"}>
                  <MenuItem
                    onClick={openNewWindow}
                    meta={shortcut("new-window").display}
                    ariaKeyShortcuts={shortcut("new-window").aria}
                    testid="titlebar-file-new-window"
                  >
                    {t("titlebar.file.new_window")}
                  </MenuItem>
                  <MenuItem
                    onClick={startNewChat}
                    meta={shortcut("new-chat").display}
                    ariaKeyShortcuts={shortcut("new-chat").aria}
                    testid="titlebar-file-new-chat"
                  >
                    {t("titlebar.file.new_chat")}
                  </MenuItem>
                  <MenuItem
                    onClick={startNewChat}
                    meta={shortcut("quick-chat").display}
                    ariaKeyShortcuts={shortcut("quick-chat").aria}
                    testid="titlebar-file-quick-chat"
                  >
                    {t("titlebar.file.quick_chat")}
                  </MenuItem>
                  <Show when={nativeCommands["workspace.pickDir"]}>
                    <MenuItem
                      onClick={openFolder}
                      meta={shortcut("open-folder").display}
                      ariaKeyShortcuts={shortcut("open-folder").aria}
                      testid="titlebar-file-open-folder"
                    >
                      {t("titlebar.file.open_folder")}
                    </MenuItem>
                  </Show>
                  <MenuItem
                    onClick={closeCurrentProject}
                    disabled={!settingsStore.directory}
                    meta={shortcut("close").display}
                    ariaKeyShortcuts={shortcut("close").aria}
                    testid="titlebar-file-close"
                  >
                    {t("titlebar.file.close")}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    onClick={() => openConfig("general")}
                    meta={shortcut("settings").display}
                    ariaKeyShortcuts={shortcut("settings").aria}
                    testid="titlebar-file-settings"
                  >
                    {t("titlebar.file.settings")}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    onClick={exitApp}
                    meta={shortcut("exit").display}
                    ariaKeyShortcuts={shortcut("exit").aria}
                    testid="titlebar-file-exit"
                  >
                    {t("titlebar.file.exit")}
                  </MenuItem>
                </Show>

                <Show when={menu.id === "edit"}>
                  <MenuItem
                    onClick={focusSidebarSearch}
                    meta={searchShortcut().display}
                    ariaKeyShortcuts={searchShortcut().aria}
                    testid="titlebar-edit-search"
                  >
                    {t("titlebar.edit.search")}
                  </MenuItem>
                  <MenuItem onClick={() => openConfig("providers")} testid="titlebar-edit-providers">
                    {t("cmdk.settings.providers")}
                  </MenuItem>
                </Show>

                <Show when={menu.id === "view"}>
                  <MenuGroup title={t("titlebar.menu.view")}>
                    <Menubar.RadioGroup
                      class="titlebar-theme-options titlebar-theme-options-menubar"
                      aria-label={t("settings.theme.label")}
                      value={settingsStore.theme}
                      onChange={setTheme}
                    >
                      <For each={themeOptions}>
                        {(item) => (
                          <Menubar.RadioItem
                            as="button"
                            type="button"
                            class="titlebar-theme-option"
                            value={item.id}
                            textValue={t(`settings.theme.${item.i18nSlug}`)}
                            closeOnSelect={false}
                            data-testid={`titlebar-theme-${item.id}`}
                          >
                            <span class="titlebar-theme-option-swatch" data-theme={item.id} aria-hidden="true" />
                            <span class="titlebar-theme-option-label">{t(`settings.theme.${item.i18nSlug}`)}</span>
                          </Menubar.RadioItem>
                        )}
                      </For>
                    </Menubar.RadioGroup>
                    <MenuItem
                      onClick={async () => {
                        await applyLocalePreference(settingsStore.locale === "zh-CN" ? "en-US" : "zh-CN")
                      }}
                      meta={settingsStore.locale}
                      testid="titlebar-toggle-locale"
                    >
                      {t("settings.language")}
                    </MenuItem>
                    <MenuRange
                      label={t("titlebar.zoom")}
                      description={t("titlebar.zoom_hint")}
                      value={zoomPercent()}
                      min={80}
                      max={160}
                      step={5}
                      unit="%"
                      testid="titlebar-zoom-range"
                      onChange={setZoomPercent}
                    />
                    <MenuItem onClick={resetLayout}>{t("titlebar.reset_layout")}</MenuItem>
                  </MenuGroup>
                </Show>

                <Show when={menu.id === "help"}>
                  <Show when={nativeCommands["open-url"]}>
                    <MenuItem onClick={() => void openDocumentation("quickstart")} testid="titlebar-help-docs">
                      {t("titlebar.docs")}
                    </MenuItem>
                    <MenuItem onClick={() => void openDocumentation("sdk")} testid="titlebar-help-sdk">
                      {t("titlebar.sdk")}
                    </MenuItem>
                    <MenuSeparator />
                  </Show>
                  <MenuItem onClick={openLogs} testid="titlebar-help-logs">
                    {t("titlebar.logs")}
                  </MenuItem>
                  <Show when={nativeCommands["devtools.toggle"]}>
                    <MenuItem
                      onClick={async () => {
                        try {
                          await toggleDevtools()
                        } finally {
                          closeMenu()
                        }
                      }}
                      testid="titlebar-help-devtools"
                    >
                      {t("titlebar.devtools")}
                    </MenuItem>
                  </Show>
                  <MenuSeparator />
                  <MenuItem onClick={() => openConfig("about")} testid="titlebar-help-about">
                    {t("about.title")}
                  </MenuItem>
                </Show>
              </Menubar.Content>
            </Portal>
          </Menubar.Menu>
        )}
      </For>
    </Menubar.Root>
  )
}
