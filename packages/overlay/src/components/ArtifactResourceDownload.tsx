import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { loadConversationArtifactContent, type ArtifactReadLocator } from "../services/conversation-artifact"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import { boardStore } from "../store/board"
import { reportError } from "../services/diagnostics"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { downloadBlob } from "../services/file-download"

export function ArtifactResourceDownload(props: { taskID: string; locator: ArtifactReadLocator; filename: string }) {
  const sourceKey = createMemo(() => JSON.stringify([props.taskID, props.locator, props.filename]))
  const [operation, setOperation] = createSignal<{
    controller: AbortController
    source: string
    authority: ApiAuthority
    selection: number
  }>()
  const owns = (entry: NonNullable<ReturnType<typeof operation>>) =>
    operation() === entry &&
    sourceKey() === entry.source &&
    boardStore.selectEpoch === entry.selection &&
    isApiAuthorityCurrent(entry.authority) &&
    !entry.controller.signal.aborted
  const retire = (entry: NonNullable<ReturnType<typeof operation>>) => {
    entry.controller.abort()
    if (operation() === entry) setOperation(undefined)
  }
  createEffect(() => {
    const entry = operation()
    if (entry && !owns(entry)) retire(entry)
  })
  onCleanup(() => {
    const entry = operation()
    if (entry) retire(entry)
  })
  async function download() {
    if (operation()) return
    const entry = {
      controller: new AbortController(),
      source: sourceKey(),
      authority: captureApiAuthority(),
      selection: boardStore.selectEpoch,
    }
    setOperation(entry)
    try {
      const [taskID, locator, title] = JSON.parse(entry.source) as [string, ArtifactReadLocator, string]
      const filename = title.split(/[\\/]/).at(-1) || "download"
      const content = await loadConversationArtifactContent({
        taskID, locator, authority: entry.authority, signal: entry.controller.signal,
      })
      if (!owns(entry)) return
      const bytes = content.bytes ?? new TextEncoder().encode(content.text ?? "")
      downloadBlob(new Blob([new Uint8Array(bytes).buffer], { type: content.mediaType }), filename)
    } catch (error) {
      if (!owns(entry)) return
      reportError({
        id: "artifact-download",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (operation() === entry) setOperation(undefined)
    }
  }
  return (
    <Button
      type="button"
      variant="ghost"
      tone="neutral"
      size="icon"
      disabled={Boolean(operation())}
      aria-label={`${t("chat.artifacts.download")}: ${props.filename}`}
      title={t("chat.artifacts.download")}
      onClick={() => void download()}
    >
      <Icon name={operation() ? "refresh" : "download"} size="compact" />
    </Button>
  )
}
