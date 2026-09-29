import { createSignal, For, onCleanup } from "solid-js"
import type { ArtifactExport } from "../../services/artifact-export"
import { artifactExportBlob, downloadBlob } from "../../services/file-download"
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
  const [busy, setBusy] = createSignal(false)
  const [copied, setCopied] = createSignal(false)
  const [files, setFiles] = createSignal<ArtifactExport[]>([])
  let reset: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(reset))
  async function run(operation: () => Promise<void>) {
    if (busy()) return
    setBusy(true)
    try {
      await operation()
    } catch (error) {
      reportError({
        id: "artifact-action",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }
  const copy = () =>
    run(async () => {
      const file = props.files()[0]
      const value = props.copyText
        ? await props.copyText()
        : !file
          ? ""
          : "text" in file
            ? file.text
            : file.mime.startsWith("text/") || file.mime === "application/json"
              ? await (await artifactExportBlob(file)).text()
              : file.filename
      await copyText(value)
      setCopied(true)
      clearTimeout(reset)
      reset = setTimeout(() => setCopied(false), 2000)
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
        disabled={busy() || props.disabled}
        title={props.copyLabel || t("artifact.actions.copy")}
        aria-label={props.copyLabel || t("artifact.actions.copy")}
        onClick={() => void copy()}
      >
        <Icon name={copied() ? "check" : "copy"} size="compact" />
      </Button>
      <DropdownMenu.Root onOpenChange={prepareDownloads}>
        <DropdownMenu.Trigger
          as={Button}
          variant="ghost"
          size="sm"
          tone="neutral"
          disabled={busy() || props.disabled}
          title={t("artifact.actions.download")}
          aria-label={t("artifact.actions.download")}
        >
          <Icon name={busy() ? "loading" : "download"} size="compact" />
          <span>{t("artifact.actions.download")}</span>
          <Icon name="chevron-down" size="compact" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal mount={document.fullscreenElement ?? undefined}>
          <DropdownMenu.Content class="msg-artifact__download-menu">
            <For each={files()}>
              {(file) => (
                <DropdownMenu.Item
                  onSelect={() => void run(async () => downloadBlob(await artifactExportBlob(file), file.filename))}
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
        {copied() ? t("artifact.actions.copied") : ""}
      </span>
    </div>
  )
}
