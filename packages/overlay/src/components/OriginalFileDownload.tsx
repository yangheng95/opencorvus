import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import {
  captureApiAuthority,
  isApiAuthorityCurrent,
  type ApiAuthority,
} from "../services/api"
import { artifactExportBlob, downloadBlob } from "../services/file-download"
import { boardStore } from "../store/board"
import { formatErrorDetails } from "../utils/error-details"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

type DownloadActionLabel = { text: string; accessibleName: string }

/** Download the original bytes through the same authorized resource cache as previews. */
export function OriginalFileDownload(props: {
  url: string
  name: string
  displayLabel?: string
  authority?: ApiAuthority
  actionLabel?: DownloadActionLabel
}) {
  type Action = {
    url: string
    name: string
    authority: ApiAuthority
    suppliedAuthority?: ApiAuthority
    selection: number
    controller: AbortController
  }
  const authed = () => props.url.startsWith("/")
  const [operation, setOperation] = createSignal<Action>()
  const [failure, setFailure] = createSignal<{ action: Action; cause: unknown }>()
  let disposed = false
  const matchesCurrent = (action: Action) => !disposed && props.url === action.url && props.name === action.name &&
    props.authority === action.suppliedAuthority && boardStore.selectEpoch === action.selection &&
    isApiAuthorityCurrent(action.authority)
  const owns = (action: Action) => operation() === action && !action.controller.signal.aborted && matchesCurrent(action)
  const retire = (action: Action) => {
    action.controller.abort()
    if (operation() === action) setOperation(undefined)
  }
  createEffect(() => {
    const action = operation()
    if (action && !matchesCurrent(action)) retire(action)
    const error = failure()
    if (error && !matchesCurrent(error.action)) setFailure(undefined)
  })
  onCleanup(() => {
    disposed = true
    const action = operation()
    if (action) retire(action)
  })
  async function download() {
    if (operation() || !authed() || !props.url) return
    const action: Action = {
      url: props.url, name: props.name, authority: props.authority ?? captureApiAuthority(),
      suppliedAuthority: props.authority, selection: boardStore.selectEpoch, controller: new AbortController(),
    }
    setOperation(action)
    try {
      const blob = await artifactExportBlob(
        { url: action.url, filename: action.name, mime: "application/octet-stream" },
        { authority: action.authority, signal: action.controller.signal },
      )
      if (!owns(action)) return
      downloadBlob(blob, action.name)
      setFailure(undefined)
    } catch (cause) {
      if (owns(action)) setFailure({ action, cause })
    } finally {
      if (operation() === action) setOperation(undefined)
    }
  }

  return (
    <Show when={props.url}>
      <Show when={authed()} fallback={
        <DownloadLink href={props.url} name={props.name} displayLabel={props.displayLabel ?? props.name}
          actionLabel={props.actionLabel} />
      }>
        <div class="original-file-download" data-failed={Boolean(failure()) || undefined}>
          <Button
            type="button" class="msg-file-download" variant="outline" size="sm" tone="neutral"
            aria-disabled={Boolean(operation()) || undefined}
            aria-busy={Boolean(operation()) || undefined}
            aria-label={failure()
              ? `${t("file.retry_download")}: ${props.displayLabel ?? props.name}`
              : props.actionLabel?.accessibleName ?? t("file.download_named", { name: props.displayLabel ?? props.name })}
            onClick={() => void download()}
          >
            {operation()
              ? t(failure() ? "common.retrying" : "file.downloading")
              : failure() ? t("file.retry_download") : props.actionLabel?.text ?? t("file.download")}
          </Button>
          <Show when={failure()}>
            {(error) => <Feedback tone="error" details={formatErrorDetails(error().cause)}>{t("file.download_failed")}</Feedback>}
          </Show>
        </div>
      </Show>
    </Show>
  )
}

export function DownloadLink(props: {
  href: string
  name: string
  displayLabel?: string
  actionLabel?: DownloadActionLabel
}) {
  return (
    <a class="msg-file-download" href={props.href} download={props.name}
      aria-label={props.actionLabel?.accessibleName ??
        (props.displayLabel ? t("file.download_named", { name: props.displayLabel }) : undefined)}
      target="_blank" rel="noopener noreferrer">
      {props.actionLabel?.text ?? t("file.download")}
    </a>
  )
}
