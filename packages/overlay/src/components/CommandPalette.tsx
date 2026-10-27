// ── CommandPalette ──
//
// Cmd+K / Ctrl+K modal that exposes the operator's most-used actions
// (task switching, settings navigation, theme/locale, logs) in a single
// fuzzy-searchable surface. Mounted once at app boot; visibility driven
// by an internal signal flipped by the global keyboard hotkey.
//
// Command sources:
//   * Recent items or paginated search (work ledger → session/task selection)
//   * Settings sections (CONFIG_SECTIONS -> openConfigDialog)
//   * Theme switcher (settingsStore.theme + applyTheme)
//   * Locale switcher
//   * New Task (focus composer)
//
// Search uses the existing Work Ledger query and cursor. Local commands use
// case-insensitive substrings. The shared Combobox owns active descendant,
// listbox option semantics, and keyboard navigation.

import { Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { applyLocalePreference } from "../services/locale-preference"
import { applyThemePreference } from "../services/theme-preference"
import { themeOptionsForCurrentHost } from "../services/theme-registry"
import { activeDirectory, browseDirectory, closeProject } from "../services/workspace"
import { matchesSearchParts } from "../services/text-search"
import { conversationExperienceIcon, conversationExperienceLabel } from "../services/conversation-experience"
import {
  loadWorkLedger,
  type WorkLedgerChatRow,
  type WorkLedgerCursor,
  type WorkLedgerMissionRow,
  type WorkLedgerRow,
  type WorkLedgerTaskRow,
} from "../services/work-ledger"
import { openConfigDialog } from "../services/config-dialog-control"
import { CONFIG_SECTIONS } from "../store/dialog"
import { t } from "../utils/i18n"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { ApiAuthorityChangedError, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import { useDisclosure } from "../solid/disclosure"
import { useHotkey } from "../solid/hotkey"
import { Dialog } from "./ui/Dialog"
import { ComboboxControl } from "./ui/ComboboxControl"
import { Icon, type IconName } from "./ui/Icon"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

interface Command {
  id: string
  label: string
  hint?: string
  shortcut?: string
  group: string
  groupStart?: boolean
  keywords?: string
  icon: IconName
  visibleWhenEmpty?: boolean
  run: () => void | Promise<void>
}

const COMMAND_PALETTE_INPUT_ID = "commandPaletteInput"
const COMMAND_PALETTE_LISTBOX_ID = "commandPaletteListbox"
const RECENT_COMMAND_LIMIT = 9
const LEDGER_PAGE_SIZE = 12
const SEARCH_DELAY_MS = 150

// `id` is the canonical theme value (matches `data-theme` and
// settings.theme); `slug` is the underscore-safe suffix used by the
// `cmdk.theme.*` translation family.
const LOCALES: Array<{ id: string; label: string }> = [
  { id: "en-US", label: "English (US)" },
  { id: "zh-CN", label: "中文 (简体)" },
]

type PaletteLedgerRow = WorkLedgerChatRow | WorkLedgerTaskRow | WorkLedgerMissionRow
type LedgerSearch = { query: string; authority: ApiAuthority; controller: AbortController }

function paletteLedgerRows(rows: readonly WorkLedgerRow[], query: string): PaletteLedgerRow[] {
  const entries: PaletteLedgerRow[] = []
  for (const row of rows) {
    if (row.kind === "project") continue
    // Mission results include descendants whose individual relevance is selected here.
    if (row.kind === "mission") {
      if (rowMatches(row, query)) entries.push(row)
      entries.push(...row.tasks.filter((task) => rowMatches(task, query)))
    } else {
      entries.push(row)
    }
  }
  return entries
}

function rowCommandIcon(row: PaletteLedgerRow): IconName {
  if (row.kind === "mission") return "mission"
  if (row.kind === "task") return "workflow"
  return conversationExperienceIcon(row.experience)
}

function rowCommandHint(row: PaletteLedgerRow): string {
  const directory = String(row.directory || "")
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1)
  const kind = row.kind === "chat" ? conversationExperienceLabel(row.experience) : t(`work_ledger.kind.${row.kind}`)
  return directory ? `${kind} · ${directory}` : kind
}

function rowMatches(row: WorkLedgerMissionRow | WorkLedgerTaskRow, query: string): boolean {
  return matchesSearchParts(query, [row.title, row.id, row.directory, row.kind])
}

export function CommandPalette(props: {
  onNewChat: () => Promise<void>
  onSelectMission: (row: WorkLedgerMissionRow) => Promise<void>
  onSelectTask: (taskID: string, directory: string) => Promise<void>
  onSelectChat: (sessionID: string, directory: string, experience: "chat" | "work") => Promise<void>
}) {
  const palette = useDisclosure()
  const [ledgerRows, setLedgerRows] = createSignal<PaletteLedgerRow[]>([])
  const [paletteQuery, setPaletteQuery] = createSignal("")
  const [ledgerCursor, setLedgerCursor] = createSignal<WorkLedgerCursor | null>(null)
  const [ledgerLoading, setLedgerLoading] = createSignal(false)
  const [ledgerError, setLedgerError] = createSignal<string>()
  let inputRef: HTMLInputElement | undefined
  let ledgerSearch: LedgerSearch | undefined
  // Element that had focus right before the palette opened — restored on
  // close so keyboard users land back where they triggered Cmd+K from
  // (textarea, button, etc.) instead of leaking to <body>.
  let priorFocus: HTMLElement | null = null

  const commands = createMemo<Command[]>(() => {
    const cmds: Command[] = []

    for (const row of ledgerRows()) {
      cmds.push({
        id: `ledger:${row.kind}:${row.id}`,
        label: row.title || row.id,
        hint: rowCommandHint(row),
        group: t("cmdk.group.work"),
        icon: rowCommandIcon(row),
        run: async () => {
          if (row.kind === "mission") {
            await props.onSelectMission(row)
            return
          }
          if (row.kind === "chat") {
            await props.onSelectChat(row.sessionID, row.directory, row.experience)
            return
          }
          await props.onSelectTask(row.id, row.directory)
        },
      })
    }

    cmds.push({
      id: "chat:new",
      label: t("work_ledger.new_chat"),
      hint: "",
      shortcut: "Ctrl+N",
      group: t("cmdk.group.suggested"),
      keywords: "new chat quick chat create",
      icon: "edit",
      visibleWhenEmpty: true,
      run: props.onNewChat,
    })

    cmds.push({
      id: "workspace:open-folder",
      label: t("cmdk.suggested.open_folder"),
      shortcut: "Ctrl+O",
      group: t("cmdk.group.suggested"),
      keywords: "open folder project workspace directory",
      icon: "folder-open",
      visibleWhenEmpty: true,
      run: browseDirectory,
    })

    if (activeDirectory().trim()) {
      cmds.push({
        id: "workspace:close-project",
        label: t("titlebar.file.close"),
        group: t("cmdk.group.commands"),
        keywords: "close project folder workspace leave",
        icon: "folder",
        run: closeProject,
      })
    }

    cmds.push({
      id: "settings:general-suggested",
      label: t("cmdk.suggested.settings"),
      shortcut: "Ctrl+,",
      group: t("cmdk.group.suggested"),
      keywords: "settings config preferences general",
      icon: "config-general",
      visibleWhenEmpty: true,
      run: () => openConfigDialog("general"),
    })

    for (const section of CONFIG_SECTIONS) {
      cmds.push({
        id: `settings:${section.id}`,
        label: t(section.labelKey),
        hint: t("config.title"),
        group: t("cmdk.group.commands"),
        keywords: `settings config ${section.id} ${section.id.replace(/-/g, " ")}`,
        icon: "config-general",
        run: () => {
          openConfigDialog(section.id)
        },
      })
    }

    for (const theme of themeOptionsForCurrentHost()) {
      cmds.push({
        id: `theme:${theme.id}`,
        label: `${t("cmdk.theme_prefix")}: ${t(`cmdk.theme.${theme.i18nSlug}`)}`,
        group: t("cmdk.group.commands"),
        keywords: `theme ${theme.id}`,
        icon: "config-appearance",
        run: async () => {
          await applyThemePreference(theme.id)
        },
      })
    }

    for (const loc of LOCALES) {
      cmds.push({
        id: `locale:${loc.id}`,
        label: `${t("cmdk.locale_prefix")}: ${loc.label}`,
        group: t("cmdk.group.commands"),
        keywords: `locale language ${loc.id}`,
        icon: "web-search",
        run: async () => {
          await applyLocalePreference(loc.id)
        },
      })
    }

    cmds.push({
      id: "logs:open",
      label: t("cmdk.open_logs"),
      group: t("cmdk.group.commands"),
      keywords: "logs viewer debug",
      icon: "log-lines",
      run: () => {
        window.dispatchEvent(new CustomEvent("oc:open-logs"))
      },
    })

    return cmds
  })

  const visibleCommands = createMemo(() => {
    const query = paletteQuery().trim()
    const visible = commands().filter((command) => query
      ? command.id.startsWith("ledger:") || commandMatches(command, query)
      : command.id.startsWith("ledger:") || command.visibleWhenEmpty)
    let previousGroup = ""
    let shortcutIndex = 0
    return visible.map((command) => {
      const groupStart = command.group !== previousGroup
      previousGroup = command.group
      const shortcut = command.id.startsWith("ledger:")
        ? (++shortcutIndex <= RECENT_COMMAND_LIMIT ? `Ctrl+${shortcutIndex}` : undefined)
        : command.shortcut
      return { ...command, groupStart, shortcut }
    })
  })

  function ownsSearch(search: LedgerSearch): boolean {
    return ledgerSearch === search && palette.open() && paletteQuery().trim() === search.query &&
      isApiAuthorityCurrent(search.authority)
  }

  async function loadLedger(search: LedgerSearch, append = false): Promise<void> {
    if (!ownsSearch(search)) return
    setLedgerLoading(true)
    setLedgerError(undefined)
    const rows = new Map((append ? ledgerRows() : []).map((row) => [`${row.kind}:${row.id}`, row]))
    let cursor = append ? ledgerCursor() : null
    const priorCount = rows.size
    try {
      do {
        const result = await loadWorkLedger({
          search: search.query,
          limit: LEDGER_PAGE_SIZE,
          cursor,
          signal: search.controller.signal,
          authority: search.authority,
        })
        if (!ownsSearch(search)) return
        for (const row of paletteLedgerRows(result.rows, search.query)) {
          rows.set(`${row.kind}:${row.id}`, row)
        }
        cursor = result.nextCursor
      } while (cursor && (search.query ? rows.size === priorCount : rows.size < RECENT_COMMAND_LIMIT))
      setLedgerRows(search.query ? [...rows.values()] : [...rows.values()].slice(0, RECENT_COMMAND_LIMIT))
      setLedgerCursor(search.query ? cursor : null)
    } catch (error) {
      if (!ownsSearch(search) || error instanceof ApiAuthorityChangedError) return
      if (error instanceof DOMException && error.name === "AbortError") return
      setLedgerError(formatErrorDetails(error))
    } finally {
      if (ownsSearch(search)) setLedgerLoading(false)
    }
  }

  async function loadMore(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    if (!ledgerSearch || ledgerLoading()) return
    const search = ledgerSearch
    const hadFocus = document.activeElement === event.currentTarget
    await loadLedger(search, ledgerRows().length > 0 && ledgerCursor() !== null)
    if (hadFocus && ownsSearch(search) && document.activeElement === document.body) {
      inputRef?.focus({ preventScroll: true })
    }
  }

  createEffect(
    on(
      () => ({ open: palette.open(), query: paletteQuery().trim(), authority: captureApiAuthority() }),
      ({ open, query, authority }) => {
        ledgerSearch?.controller.abort()
        ledgerSearch = undefined
        setLedgerRows([])
        setLedgerCursor(null)
        setLedgerError(undefined)
        setLedgerLoading(open)
        if (!open) {
          setPaletteQuery("")
          return
        }
        const search = { query, authority, controller: new AbortController() }
        ledgerSearch = search
        const timer = setTimeout(() => void loadLedger(search), query ? SEARCH_DELAY_MS : 0)
        onCleanup(() => {
          clearTimeout(timer)
          search.controller.abort()
        })
      },
      { defer: true },
    ),
  )

  onCleanup(() => ledgerSearch?.controller.abort())

  onMount(() => {
    const openFromChrome = () => {
      if (palette.open() || document.querySelector(".dialog")) return
      priorFocus = (document.activeElement as HTMLElement | null) ?? null
      palette.openIt()
    }
    window.addEventListener("oc:open-command-palette", openFromChrome)
    onCleanup(() => window.removeEventListener("oc:open-command-palette", openFromChrome))
  })

  function commandMatches(command: Command, inputValue: string): boolean {
    return matchesSearchParts(inputValue, [`${command.label} ${command.hint || ""} ${command.keywords || ""}`])
  }

  function close() {
    palette.close()
  }

  function runCommand(cmd: Command | null) {
    if (!cmd) return
    const authority = captureApiAuthority()
    close()
    try {
      void Promise.resolve(cmd.run()).catch((err) => {
        if (!isApiAuthorityCurrent(authority) || err instanceof ApiAuthorityChangedError) return
        if (err instanceof DOMException && err.name === "AbortError") return
        reportError({
          title: t("common.error"),
          message: `${t("command_palette.label")}: ${cmd.label}`,
          details: formatErrorDetails(err),
        })
      })
    } catch (err) {
      if (!isApiAuthorityCurrent(authority) || err instanceof ApiAuthorityChangedError) return
      if (err instanceof DOMException && err.name === "AbortError") return
      reportError({
        title: t("common.error"),
        message: `${t("command_palette.label")}: ${cmd.label}`,
        details: formatErrorDetails(err),
      })
    }
  }

  // Global hotkey: Cmd+K (mac) / Ctrl+K (others). Captured in capture
  // phase so we trump an open <textarea> default behavior. Skip when a
  // shared dialog content node is mounted — those modals own Esc/Enter.
  useHotkey({
    key: "k",
    cmdOrCtrl: true,
    target: "window",
    capture: true,
    when: () => palette.open() || !document.querySelector(".dialog"),
    run: (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (palette.open()) {
        close()
        return
      }
      priorFocus = (document.activeElement as HTMLElement | null) ?? null
      palette.openIt()
    },
  })

  useHotkey(
    Array.from({ length: 9 }, (_, index) => ({
      key: String(index + 1),
      ctrl: true,
      alt: false,
      shift: false,
      target: "window" as const,
      capture: true,
      when: () => palette.open(),
      run: (event: KeyboardEvent) => {
        const command = visibleCommands().filter((item) => item.id.startsWith("ledger:"))[index]
        if (!command) return
        event.preventDefault()
        event.stopPropagation()
        runCommand(command)
      },
    })),
  )

  return (
    <Dialog
      id="commandPaletteDialog"
      open={palette.open()}
      title={t("command_palette.label")}
      titleAs="h2"
      class="cmdk-dialog"
      overlayClass="cmdk-backdrop"
      formClass="cmdk-panel"
      headerClass="cmdk-header"
      onClose={() => {
        if (palette.open()) close()
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        inputRef?.focus()
      }}
      onCloseAutoFocus={(event) => {
        const restore = !event.defaultPrevented
        event.preventDefault()
        if (palette.open()) return
        const target = priorFocus
        priorFocus = null
        // Combobox selection focuses its input after onChange. Restore only
        // once that focus scope has retired, preserving a command's new focus.
        if (restore && target?.isConnected && target.getClientRects().length > 0) {
          target.focus({ preventScroll: true })
        }
      }}
    >
      <ComboboxControl<Command>
        class="cmdk-combobox"
        controlClass="cmdk-control"
        inputClass="cmdk-input"
        listboxClass="cmdk-list"
        optionClass="cmdk-item"
        optionPrefixClass="cmdk-item-group"
        optionLabelClass="cmdk-item-label"
        optionDescriptionClass="cmdk-item-hint"
        inputID={COMMAND_PALETTE_INPUT_ID}
        listboxID={COMMAND_PALETTE_LISTBOX_ID}
        inputRef={(el) => {
          inputRef = el
        }}
        ariaLabel={t("cmdk.placeholder")}
        placeholder={t("cmdk.placeholder")}
        options={visibleCommands()}
        optionValue="id"
        optionTextValue={(command) => `${command.label} ${command.hint || ""} ${command.keywords || ""}`}
        optionLabel="label"
        value={null}
        open={palette.open()}
        onOpenChange={(open) => {
          if (!open && palette.open()) close()
        }}
        onInputChange={setPaletteQuery}
        defaultFilter={() => true}
        allowsEmptyCollection
        closeOnSelection
        onChange={runCommand}
        renderOptionPrefix={(command) => (
          <>
            <Show when={command.groupStart}>
              <span class="cmdk-group-label oc-section-heading">{command.group}</span>
            </Show>
            <span class="cmdk-item-icon" aria-hidden="true">
              <Icon name={command.icon} size="medium" />
            </span>
          </>
        )}
        renderOptionLabel={(command) => command.label}
        renderOptionDescription={(command) => (
          <>
            <Show when={command.hint}>
              <span class="cmdk-item-project">{command.hint}</span>
            </Show>
            <Show when={command.shortcut}>
              <span class="cmdk-item-shortcut">{command.shortcut}</span>
            </Show>
          </>
        )}
        optionData={(command) => ({
          "data-command-id": command.id,
          "data-group": command.group,
          "data-group-start": command.groupStart ? "" : undefined,
        })}
        emptyContent={<Show when={!ledgerLoading() && !ledgerError()}><div class="cmdk-empty">{t("cmdk.empty")}</div></Show>}
      />
      <Show when={ledgerLoading() || ledgerError() || ledgerCursor()}>
        <div class="cmdk-footer">
          <Show when={ledgerLoading()}>
            <div role="status" aria-live="polite">{t("common.loading")}</div>
          </Show>
          <Show when={ledgerError()}>
            {(details) => <Feedback tone="error" details={details()} actions={
              <Button type="button" variant="ghost" size="md" tone="neutral" onClick={loadMore}>{t("common.retry")}</Button>
            }>{t("cmdk.search_failed")}</Feedback>}
          </Show>
          <Show when={ledgerCursor() && !ledgerError()}>
            <Button type="button" variant="ghost" size="md" tone="neutral" disabled={ledgerLoading()} onClick={loadMore}>
              {t("work_ledger.load_more")}
            </Button>
          </Show>
        </div>
      </Show>
    </Dialog>
  )
}
