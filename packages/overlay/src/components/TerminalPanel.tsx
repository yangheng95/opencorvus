import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import { Show, createEffect, createSignal, onCleanup, onMount, type Accessor, type JSX } from "solid-js"
import {
  createPtySession,
  listPtySessions,
  listTerminalProfiles,
  openPtyOutput,
  resizePtySession,
  writePtyInput,
  type PtyInfo,
} from "../services/terminal"
import type { StreamHandle } from "../services/host-transport"
import { t } from "../utils/i18n"
import { Icon } from "./ui/Icon"

export interface TerminalPanelProps {
  active: Accessor<boolean>
  directory: Accessor<string>
  onSessionCountChange?: (count: number) => void
}

export function TerminalPanel(props: TerminalPanelProps): JSX.Element {
  let host!: HTMLDivElement
  let terminal: Terminal | undefined
  let fitAddon: FitAddon | undefined
  let resizeObserver: ResizeObserver | undefined
  let themeObserver: MutationObserver | undefined
  let output: StreamHandle | undefined
  let fitFrame: number | undefined
  let disposed = false
  let loadGeneration = 0
  let connectionGeneration = 0
  let lastSize = ""
  let inputWriteTail: Promise<void> = Promise.resolve()

  const [sessions, setSessions] = createSignal<PtyInfo[]>([])
  const [activeID, setActiveID] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [connected, setConnected] = createSignal(false)
  const [error, setError] = createSignal("")
  const [loadedDirectory, setLoadedDirectory] = createSignal("")

  function errorMessage(value: unknown): string {
    return value instanceof Error ? value.message : String(value)
  }

  function closeOutput(): void {
    connectionGeneration += 1
    output?.close("consumer-dispose")
    output = undefined
    setConnected(false)
  }

  function scheduleFit(): void {
    if (!fitAddon || fitFrame !== undefined) return
    fitFrame = requestAnimationFrame(() => {
      fitFrame = undefined
      if (disposed || !fitAddon || !props.active()) return
      fitAddon.fit()
      terminal?.focus()
    })
  }

  function pushSize(cols: number, rows: number): void {
    const id = activeID()
    if (!id || cols < 1 || rows < 1) return
    const key = `${id}:${cols}:${rows}`
    if (lastSize === key) return
    lastSize = key
    void resizePtySession(id, { cols, rows }).catch((value) => {
      if (!disposed) setError(errorMessage(value))
    })
  }

  function syncTheme(): void {
    if (!terminal) return
    const styles = getComputedStyle(host)
    const foreground = styles.color
    terminal.options.theme = {
      background: styles.backgroundColor,
      foreground,
      cursor: foreground,
      selectionBackground: styles.getPropertyValue("--accent-dim").trim(),
    }
  }

  function connect(session: PtyInfo): void {
    closeOutput()
    const generation = connectionGeneration
    setActiveID(session.id)
    setConnected(false)
    setError("")
    terminal?.reset()
    output = openPtyOutput({
      id: session.id,
      directory: props.directory(),
      cursor: 0,
      onOpen: () => {
        if (generation !== connectionGeneration || session.id !== activeID()) return
        setConnected(true)
        scheduleFit()
      },
      onEvent: (event) => {
        if (generation !== connectionGeneration || session.id !== activeID()) return
        if (event.type === "data") terminal?.write(event.data)
        if (event.type === "exit") {
          setConnected(false)
          const remaining = sessions().filter((item) => item.id !== session.id)
          setSessions(remaining)
          const next = remaining.at(-1)
          setActiveID(next?.id ?? "")
          terminal?.reset()
          if (next && props.active()) connect(next)
        }
      },
      onError: (value) => {
        if (generation === connectionGeneration && session.id === activeID()) setError(errorMessage(value))
      },
      onClose: () => {
        if (generation === connectionGeneration && session.id === activeID()) setConnected(false)
      },
    })
  }

  async function createSession(profileID: string): Promise<void> {
    setLoading(true)
    setError("")
    try {
      const session = await createPtySession(profileID)
      if (disposed) return
      setSessions((current) => [...current.filter((item) => item.id !== session.id), session])
      connect(session)
    } catch (value) {
      if (!disposed) setError(errorMessage(value))
    } finally {
      if (!disposed) setLoading(false)
    }
  }

  async function load(directory: string, generation: number): Promise<void> {
    setLoading(true)
    setError("")
    try {
      const [profileList, sessionList] = await Promise.all([listTerminalProfiles(), listPtySessions()])
      if (disposed || generation !== loadGeneration || directory !== props.directory()) return
      setSessions(sessionList)
      setLoadedDirectory(directory)
      const selected = sessionList.find((item) => item.id === activeID()) ?? sessionList.at(-1)
      if (selected) {
        connect(selected)
        return
      }
      setActiveID("")
      terminal?.reset()
      if (profileList.defaultProfileID) await createSession(profileList.defaultProfileID)
    } catch (value) {
      if (!disposed && generation === loadGeneration) setError(errorMessage(value))
    } finally {
      if (!disposed && generation === loadGeneration) setLoading(false)
    }
  }

  onMount(() => {
    terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      convertEol: false,
      fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 15,
      lineHeight: 1.4,
      scrollback: 10_000,
    })
    fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(host)
    syncTheme()
    terminal.onData((data) => {
      const id = activeID()
      if (!id || !connected()) return
      inputWriteTail = inputWriteTail
        .then(async () => {
          await writePtyInput(id, data)
        })
        .catch((value) => {
          if (!disposed) setError(errorMessage(value))
        })
    })
    terminal.onResize(({ cols, rows }) => pushSize(cols, rows))
    resizeObserver = new ResizeObserver(scheduleFit)
    resizeObserver.observe(host)
    themeObserver = new MutationObserver(syncTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] })
    scheduleFit()
  })

  createEffect(() => {
    const directory = props.directory().trim()
    const active = props.active()
    loadGeneration += 1
    const generation = loadGeneration
    closeOutput()
    if (!active || !directory) return
    void load(directory, generation)
  })

  createEffect(() => {
    const directory = props.directory().trim()
    props.onSessionCountChange?.(loadedDirectory() === directory ? sessions().length : 0)
  })

  onCleanup(() => {
    disposed = true
    loadGeneration += 1
    closeOutput()
    if (fitFrame !== undefined) cancelAnimationFrame(fitFrame)
    resizeObserver?.disconnect()
    themeObserver?.disconnect()
    fitAddon?.dispose()
    terminal?.dispose()
  })

  return (
    <section class="terminal-panel" aria-label={t("terminal_panel.title")} data-connected={String(connected())}>
      <div class="terminal-panel__viewport" ref={host} data-ui="embedded-terminal" />

      <Show when={loading() && sessions().length === 0}>
        <div class="terminal-panel__status">{t("common.loading")}</div>
      </Show>
      <Show when={!loading() && sessions().length === 0 && !error()}>
        <div class="terminal-panel__status">{t("terminal_panel.empty")}</div>
      </Show>
      <Show when={error()}>
        <div class="terminal-panel__error" role="status">
          <Icon name="status-failed" />
          <span>{error()}</span>
        </div>
      </Show>
    </section>
  )
}
