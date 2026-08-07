// ── CommandPalette ──
//
// Cmd+K / Ctrl+K modal that exposes the operator's most-used actions
// (task switching, settings navigation, theme/locale, logs) in a single
// fuzzy-searchable surface. Mounted once at app boot; visibility driven
// by an internal signal flipped by the global keyboard hotkey.
//
// Command sources:
//   * Recent chats and tasks (work ledger → session/task selection)
//   * Settings sections (CONFIG_SECTIONS -> openConfigDialog)
//   * Theme switcher (settingsStore.theme + applyTheme)
//   * Locale switcher
//   * New Task (focus composer)
//
// Filtering: case-insensitive substring on command label + description +
// keywords. The shared Combobox primitive owns active descendant,
// listbox option semantics, and keyboard navigation.

import { Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { applyLocalePreference } from "../services/locale-preference"
import { applyThemePreference } from "../services/theme-preference"
import { themeOptionsForCurrentHost } from "../services/theme-registry"
import { browseDirectory, openGlobalChatLauncher } from "../services/workspace"
import {
  loadWorkLedger,
  type WorkLedgerChatRow,
  type WorkLedgerRow,
  type WorkLedgerTaskRow,
} from "../services/work-ledger"
import { openConfigDialog } from "../services/config-dialog-control"
import { CONFIG_SECTIONS } from "../store/dialog"
import { t } from "../utils/i18n"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { useDisclosure } from "../solid/disclosure"
import { useHotkey } from "../solid/hotkey"
import { Dialog } from "./ui/Dialog"
import { ComboboxControl } from "./ui/ComboboxControl"
import { Icon, type IconName } from "./ui/Icon"

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

// `id` is the canonical theme value (matches `data-theme` and
// settings.theme); `slug` is the underscore-safe i18n key suffix so
// `t(\`cmdk.theme.${slug}\`)` resolves at the call site as a template
// literal the static check-panel-i18n scanner can see (the head
// `cmdk.theme.` prefix-covers every descendant key).
const LOCALES: Array<{ id: string; label: string }> = [
  { id: "en-US", label: "English (US)" },
  { id: "zh-CN", label: "中文 (简体)" },
]

type PaletteLedgerRow = WorkLedgerChatRow | WorkLedgerTaskRow

function paletteLedgerRows(rows: readonly WorkLedgerRow[]): PaletteLedgerRow[] {
  const entries: PaletteLedgerRow[] = []
  for (const row of rows) {
    if (row.kind === "mission") entries.push(...row.tasks)
    if (row.kind === "chat") entries.push(row)
  }
  return entries
}

function rowCommandIcon(row: PaletteLedgerRow): IconName {
  if (row.kind === "task") return "workflow"
  return "avatar-assistant"
}

function rowCommandHint(row: PaletteLedgerRow): string {
  const directory = String(row.directory || "")
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1)
  return directory || row.kind
}

export function CommandPalette(props: {
  onSelectTask: (taskID: string, directory: string) => Promise<void>
  onSelectChat: (sessionID: string, directory: string, experience: "chat" | "work") => Promise<void>
}) {
  const palette = useDisclosure()
  const [ledgerRows, setLedgerRows] = createSignal<PaletteLedgerRow[]>([])
  const [paletteQuery, setPaletteQuery] = createSignal("")
  let inputRef: HTMLInputElement | undefined
  let ledgerController: AbortController | undefined
  // Element that had focus right before the palette opened — restored on
  // close so keyboard users land back where they triggered Cmd+K from
  // (textarea, button, etc.) instead of leaking to <body>.
  let priorFocus: HTMLElement | null = null

  const commands = createMemo<Command[]>(() => {
    const cmds: Command[] = []

    let shortcutIndex = 0
    for (const row of ledgerRows()) {
      shortcutIndex += 1
      cmds.push({
        id: `ledger:${row.kind}:${row.id}`,
        label: row.title || row.id,
        hint: rowCommandHint(row),
        shortcut: shortcutIndex <= 9 ? `Ctrl+${shortcutIndex}` : undefined,
        group: t("cmdk.group.tasks"),
        keywords: `${row.id} ${row.directory} ${row.kind}`,
        icon: rowCommandIcon(row),
        run: async () => {
          if (row.kind === "chat") {
            await props.onSelectChat(row.sessionID, row.directory, row.experience)
            return
          }
          await props.onSelectTask(row.id, row.directory)
        },
      })
    }

    cmds.push({
      id: "task:new",
      label: t("cmdk.suggested.new_task"),
      hint: "",
      shortcut: "Ctrl+N",
      group: t("cmdk.group.suggested"),
      keywords: "new chat quick chat create",
      icon: "edit",
      visibleWhenEmpty: true,
      run: openGlobalChatLauncher,
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

    let previousGroup = ""
    return cmds.map((command) => {
      const groupStart = command.group !== previousGroup
      previousGroup = command.group
      return { ...command, groupStart }
    })
  })

  const visibleCommands = createMemo(() => {
    const all = commands()
    if (paletteQuery().trim()) return all
    return all.filter((command) => command.id.startsWith("ledger:") || command.visibleWhenEmpty)
  })

  createEffect(
    on(
      palette.open,
      (open) => {
        if (!open) {
          setPaletteQuery("")
          ledgerController?.abort()
          ledgerController = undefined
          return
        }
        setPaletteQuery("")
        const controller = new AbortController()
        ledgerController?.abort()
        ledgerController = controller
        void loadWorkLedger({ limit: 12, signal: controller.signal })
          .then((result) => {
            if (ledgerController !== controller) return
            setLedgerRows(paletteLedgerRows(result.rows).slice(0, 9))
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === "AbortError") return
            reportError({
              title: t("common.error"),
              message: t("command_palette.label"),
              details: formatErrorDetails(err),
            })
          })
      },
      { defer: true },
    ),
  )

  onCleanup(() => ledgerController?.abort())

  onMount(() => {
    const openFromChrome = () => {
      if (palette.open()) return
      priorFocus = (document.activeElement as HTMLElement | null) ?? null
      palette.openIt()
    }
    window.addEventListener("oc:open-command-palette", openFromChrome)
    onCleanup(() => window.removeEventListener("oc:open-command-palette", openFromChrome))
  })

  function commandMatches(command: Command, inputValue: string): boolean {
    const q = inputValue.trim().toLowerCase()
    if (!q) return true
    const haystack = `${command.label} ${command.hint || ""} ${command.keywords || ""}`.toLowerCase()
    return haystack.includes(q)
  }

  function close() {
    palette.close()
    // Return focus to whatever the operator was on before the palette
    // grabbed it. Wrap in try because the prior element may have been
    // removed from the DOM during the palette's lifetime (e.g. the
    // operator ran a command that re-rendered the conversation).
    if (priorFocus && document.contains(priorFocus)) {
      try {
        priorFocus.focus()
      } catch {
        /* ignore — best-effort */
      }
    }
    priorFocus = null
  }

  function runCommand(cmd: Command | null) {
    if (!cmd) return
    close()
    try {
      void Promise.resolve(cmd.run()).catch((err) => {
        reportError({
          title: t("common.error"),
          message: `${t("command_palette.label")}: ${cmd.label}`,
          details: formatErrorDetails(err),
        })
      })
    } catch (err) {
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
        const command = commands().filter((item) => item.id.startsWith("ledger:"))[index]
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
      onCloseAutoFocus={(event) => event.preventDefault()}
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
        defaultFilter={commandMatches}
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
        emptyContent={<div class="cmdk-empty">{t("cmdk.empty")}</div>}
      />
    </Dialog>
  )
}
