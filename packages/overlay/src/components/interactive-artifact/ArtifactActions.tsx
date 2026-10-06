import { createEffect, createSignal, For, onCleanup } from "solid-js"
import type { ArtifactExport } from "../../services/artifact-export"
import { artifactExportBlob, downloadBlob } from "../../services/file-download"
import { captureResourceAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import { boardStore } from "../../store/board"
import { copyText } from "../../services/clipboard"
import { reportError } from "../../services/diagnostics"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { DropdownMenu } from "../ui/DropdownMenu"

export function ArtifactActions(props: {
  files: () => ArtifactExport[]
  copyText?: () => string | Promise<string>
  copyLabel?: string
  disabled?: boolean
}) {
  type Action = {
    controller: AbortController
    files: ArtifactExport[]
    copyAccessor: typeof props.copyText
    authority?: ApiAuthority
    selection: number
  }
  const [operation, setOperation] = createSignal<Action>()
  const [copied, setCopied] = createSignal<Action>()
  const [files, setFiles] = createSignal<ArtifactExport[]>([])
  let reset: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const matchesCurrent = (entry: Action) => {
    if (disposed || props.copyText !== entry.copyAccessor) return false
    if (entry.authority && (!isApiAuthorityCurrent(entry.authority) || boardStore.selectEpoch !== entry.selection))
      return false
    const current = props.files()
    return current.length === entry.files.length && current.every((file, index) => {
      const original = entry.files[index]!
      return file.filename === original.filename && file.mime === original.mime &&
        ("text" in file && "text" in original ? file.text === original.text :
          "url" in file && "url" in original && file.url === original.url)
    })
  }
  const reportActionError = (error: unknown) => reportError({
    id: "artifact-action", title: t("common.error"),
    message: error instanceof Error ? error.message : String(error),
  })
  const owns = (entry: Action) => operation() === entry && !entry.controller.signal.aborted && matchesCurrent(entry)
  const showsCopied = () => {
    const entry = copied()
    try {
      return Boolean(entry && matchesCurrent(entry))
    } catch {
      return false
    }
  }
  const retire = (entry: Action) => {
    entry.controller.abort()
    if (operation() === entry) setOperation(undefined)
  }
  createEffect(() => {
    const entry = operation()
    if (!entry) return
    try {
      if (!owns(entry)) retire(entry)
    } catch (error) {
      reportActionError(error)
      retire(entry)
    }
  })
  onCleanup(() => {
    disposed = true
    clearTimeout(reset)
    const entry = operation()
    if (entry) retire(entry)
  })
  async function run(action: (entry: Action) => Promise<void>, selected?: ArtifactExport) {
    if (operation()) return
    let entry: Action | undefined
    try {
      const current = props.files().map(file => ({ ...file }))
      const source = selected ?? current[0]
      entry = {
        controller: new AbortController(), files: current, copyAccessor: props.copyText,
        authority: source && "url" in source ? captureResourceAuthority(source.url) : undefined,
        selection: boardStore.selectEpoch,
      }
      if (selected && !current.some(file => file.filename === selected.filename && file.mime === selected.mime &&
        ("text" in file && "text" in selected ? file.text === selected.text :
          "url" in file && "url" in selected && file.url === selected.url))) return
      setOperation(entry)
      await action(entry)
    } catch (error) {
      if (disposed || (entry && (operation() !== entry || entry.controller.signal.aborted))) return
      try {
        if (entry && !matchesCurrent(entry)) return
      } catch (currentError) {
        reportActionError(currentError)
        return
      }
      reportActionError(error)
    } finally {
      if (entry && operation() === entry) setOperation(undefined)
    }
  }
  const copy = () =>
    run(async (entry) => {
      const file = entry.files[0]
      const value = entry.copyAccessor
        ? await entry.copyAccessor()
        : !file
          ? ""
          : "text" in file
            ? file.text
            : file.mime.startsWith("text/") || file.mime === "application/json"
              ? await (await artifactExportBlob(file, { authority: entry.authority, signal: entry.controller.signal })).text()
              : file.filename
      if (!owns(entry)) return
      await copyText(value)
      if (!owns(entry)) return
      setCopied(entry)
      clearTimeout(reset)
      reset = setTimeout(() => {
        if (copied() === entry) setCopied(undefined)
      }, 2000)
    })
  const prepareDownloads = (open: boolean) => {
    if (!open) return
    try {
      setFiles(props.files())
    } catch (error) {
      setFiles([])
      reportError({
        id: "artifact-export",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return (
    <div class="msg-artifact__actions">
      <Button
        variant="ghost"
        size="icon"
        tone="neutral"
        disabled={Boolean(operation()) || props.disabled}
        title={props.copyLabel || t("artifact.actions.copy")}
        aria-label={props.copyLabel || t("artifact.actions.copy")}
        onClick={() => void copy()}
      >
        <Icon name={showsCopied() ? "check" : "copy"} size="compact" />
      </Button>
      <DropdownMenu.Root onOpenChange={prepareDownloads}>
        <DropdownMenu.Trigger
          as={Button}
          variant="ghost"
          size="sm"
          tone="neutral"
          disabled={Boolean(operation()) || props.disabled}
          title={t("artifact.actions.download")}
          aria-label={t("artifact.actions.download")}
        >
          <Icon name={operation() ? "loading" : "download"} size="compact" />
          <span>{t("artifact.actions.download")}</span>
          <Icon name="chevron-down" size="compact" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal mount={document.fullscreenElement ?? undefined}>
          <DropdownMenu.Content class="msg-artifact__download-menu">
            <For each={files()}>
              {(file) => (
                <DropdownMenu.Item
                  onSelect={() => void run(async entry => {
                    const blob = await artifactExportBlob(file, { authority: entry.authority, signal: entry.controller.signal })
                    if (owns(entry)) downloadBlob(blob, file.filename)
                  }, file)}
                >
                  <Icon name="file-document" size="compact" />
                  <span>{file.filename}</span>
                </DropdownMenu.Item>
              )}
            </For>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span class="msg-artifact__action-status" role="status">
        {showsCopied() ? t("artifact.actions.copied") : ""}
      </span>
    </div>
  )
}
