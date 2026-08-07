import { FitAddon } from "@xterm/addon-fit"
import { SearchAddon } from "@xterm/addon-search"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import { createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { SearchField } from "../ui/SearchField"
import { ArtifactFrame } from "./ArtifactFrame"

type TerminalPayload = Extract<InteractiveArtifactPayload, { renderer: "terminal@1" }>

function plainTerminalOutput(value: string): string {
  return value.replace(/\u001B(?:[@-_][0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g, "")
}

export function TerminalArtifact(props: { payload: TerminalPayload }) {
  let host: HTMLDivElement | undefined
  let terminal: Terminal | undefined
  let fit: FitAddon | undefined
  let search: SearchAddon | undefined
  let resizeObserver: ResizeObserver | undefined
  let stopThemeObserver: (() => void) | undefined
  const [query, setQuery] = createSignal("")
  const plain = plainTerminalOutput(props.payload.output)

  const findNext = () => {
    if (!query()) return
    search?.findNext(query(), {
      decorations: {
        matchOverviewRuler: "#6f7782",
        activeMatchColorOverviewRuler: "#2f7ed8",
        matchBackground: "#3b4654",
        activeMatchBackground: "#2f7ed8",
      },
    })
  }

  const copy = async () => {
    await navigator.clipboard.writeText(terminal?.getSelection() || plain)
  }

  const applyTheme = () => {
    if (!terminal || !host) return
    const style = getComputedStyle(host)
    terminal.options.theme = {
      background: style.getPropertyValue("--surface").trim() || "#ffffff",
      foreground: style.getPropertyValue("--text").trim() || "#242424",
      selectionBackground: style.getPropertyValue("--accent").trim() || "#2f7ed8",
    }
  }

  onMount(() => {
    if (!host) return
    terminal = new Terminal({
      allowProposedApi: true,
      cols: props.payload.columns,
      rows: props.payload.rows,
      disableStdin: true,
      convertEol: true,
      cursorBlink: false,
      screenReaderMode: true,
      scrollback: 20_000,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
    })
    fit = new FitAddon()
    search = new SearchAddon()
    terminal.loadAddon(fit)
    terminal.loadAddon(search)
    terminal.open(host)
    applyTheme()
    stopThemeObserver = observeAppliedTheme(applyTheme)
    terminal.write(props.payload.output)
    fit.fit()
    resizeObserver = new ResizeObserver(() => fit?.fit())
    resizeObserver.observe(host)
    host.dataset.ready = "true"
  })

  onCleanup(() => {
    stopThemeObserver?.()
    resizeObserver?.disconnect()
    terminal?.dispose()
    terminal = undefined
    search = undefined
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Terminal">
      <div class="msg-artifact-terminal__meta">
        <span>{props.payload.workingDirectory}</span>
        <code>{props.payload.command}</code>
        <span data-exit-code={props.payload.exitCode}>
          {props.payload.exitCode === undefined
            ? t("artifact.terminal.exit_unknown")
            : t("artifact.terminal.exit_code", { code: props.payload.exitCode })}
        </span>
      </div>
      <div class="msg-artifact-terminal__toolbar">
        <SearchField
          value={query()}
          placeholder={t("artifact.terminal.search")}
          size="sm"
          onValueChange={(value) => {
            setQuery(value)
            if (value) search?.findNext(value, { incremental: true })
          }}
          onClear={() => {
            setQuery("")
            search?.clearDecorations()
          }}
        />
        <Button variant="ghost" size="sm" tone="neutral" disabled={!query()} onClick={findNext}>
          {t("artifact.terminal.next_match")}
        </Button>
        <Button variant="ghost" size="sm" tone="neutral" onClick={copy}>
          {t("artifact.code.copy")}
        </Button>
      </div>
      <div
        class="msg-artifact-terminal"
        role="log"
        aria-label={props.payload.title}
        ref={(element) => {
          host = element
        }}
      />
    </ArtifactFrame>
  )
}
