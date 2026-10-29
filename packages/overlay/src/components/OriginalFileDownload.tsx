import { Show, createResource } from "solid-js"
import {
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  peekResourceObjectUrl,
  type ApiAuthority,
} from "../services/api"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

/** Download the original bytes through the same authorized resource cache as previews. */
export function OriginalFileDownload(props: { url: string; name: string; authority?: ApiAuthority }) {
  const authed = () => props.url.startsWith("/")
  const [objectUrl, { refetch }] = createResource(
    () => (authed() && props.url ? { url: props.url, authority: props.authority ?? captureApiAuthority() } : null),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    { initialValue: authed() ? peekResourceObjectUrl(props.url) : null },
  )
  const href = () => {
    if (!props.url) return ""
    if (authed()) return (!objectUrl.error && !objectUrl.loading && objectUrl()) || ""
    return props.url
  }

  return (
    <Show
      when={!objectUrl.error}
      fallback={
        <Feedback
          tone="error"
          details={String(objectUrl.error)}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              tone="neutral"
              disabled={objectUrl.loading}
              aria-label={`${t("file.retry_download")}: ${props.name}`}
              onClick={() => void refetch()}
            >
              {t(objectUrl.loading ? "common.retrying" : "file.retry_download")}
            </Button>
          }
        >
          {t("file.download_failed")}
        </Feedback>
      }
    >
      <Show when={href()}>
        <DownloadLink href={href()} name={props.name} />
      </Show>
    </Show>
  )
}

export function DownloadLink(props: { href: string; name: string }) {
  return (
    <a class="msg-file-download" href={props.href} download={props.name} target="_blank" rel="noopener noreferrer">
      {t("file.download")}
    </a>
  )
}
