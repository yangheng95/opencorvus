import { createSignal } from "solid-js"
import { loadConversationArtifactContent, type ArtifactReadLocator } from "../services/conversation-artifact"
import { reportError } from "../services/diagnostics"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { downloadBlob } from "../services/file-download"

export function ArtifactResourceDownload(props: { taskID: string; locator: ArtifactReadLocator; filename: string }) {
  const [busy, setBusy] = createSignal(false)
  async function download() {
    if (busy()) return
    setBusy(true)
    const filename = props.filename.split(/[\\/]/).at(-1) || "download"
    try {
      const content = await loadConversationArtifactContent({ taskID: props.taskID, locator: props.locator })
      const bytes = content.bytes ?? new TextEncoder().encode(content.text ?? "")
      downloadBlob(new Blob([new Uint8Array(bytes).buffer], { type: content.mediaType }), filename)
    } catch (error) {
      reportError({
        id: "artifact-download",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      type="button"
      variant="ghost"
      tone="neutral"
      size="icon"
      disabled={busy()}
      aria-label={`${t("chat.artifacts.download")}: ${props.filename}`}
      title={t("chat.artifacts.download")}
      onClick={() => void download()}
    >
      <Icon name={busy() ? "refresh" : "download"} size="compact" />
    </Button>
  )
}
