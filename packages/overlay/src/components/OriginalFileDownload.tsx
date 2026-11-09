import { Show, createResource, onMount } from "solid-js"
import {
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  peekResourceObjectUrl,
  type ApiAuthority,
} from "../services/api"
import { formatErrorDetails } from "../utils/error-details"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

type OriginalSource = { url: string; authority: ApiAuthority }
type OriginalContent = { href: string; focusOrigin?: HTMLButtonElement }

/** Download the original bytes through the same authorized resource cache as previews. */
export function OriginalFileDownload(props: { url: string; name: string; displayLabel?: string; authority?: ApiAuthority }) {
  const authed = () => props.url.startsWith("/")
  const cached = authed() ? peekResourceObjectUrl(props.url) : undefined
  const [original, { refetch }] = createResource<OriginalContent | undefined, OriginalSource, HTMLButtonElement>(
    () => (authed() && props.url ? { url: props.url, authority: props.authority ?? captureApiAuthority() } : null),
    async (source, { refetching }) => {
      const href = await fetchResourceAsObjectUrl(source.url, { authority: source.authority })
      const focusOrigin = typeof refetching !== "boolean" && document.activeElement === refetching ? refetching : undefined
      return { href, focusOrigin }
    },
    { initialValue: cached ? { href: cached } : undefined },
  )
  const href = () => {
    if (!props.url) return ""
    if (authed()) return (!original.error && !original.loading && original()?.href) || ""
    return props.url
  }

  return (
    <Show
      when={!original.error}
      fallback={
        <Feedback
          tone="error"
          details={formatErrorDetails(original.error)}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              tone="neutral"
              aria-disabled={original.loading || undefined}
              aria-busy={original.loading || undefined}
              aria-label={`${t("file.retry_download")}: ${props.displayLabel ?? props.name}`}
              onClick={(event) => {
                if (!original.loading) void refetch(event.currentTarget)
              }}
            >
              {t(original.loading ? "common.retrying" : "file.retry_download")}
            </Button>
          }
        >
          {t("file.download_failed")}
        </Feedback>
      }
    >
      <Show when={href()}>
        <DownloadLink
          href={href()}
          name={props.name}
          displayLabel={props.displayLabel ?? props.name}
          focusOrigin={authed() ? original()?.focusOrigin : undefined}
        />
      </Show>
    </Show>
  )
}

export function DownloadLink(props: { href: string; name: string; displayLabel?: string; focusOrigin?: HTMLButtonElement }) {
  let link: HTMLAnchorElement | undefined
  onMount(() => {
    const origin = props.focusOrigin
    if (!origin || !link?.isConnected || link.closest("[inert], [hidden]")) return
    if (document.activeElement === origin || (!origin.isConnected && document.activeElement === document.body)) link.focus()
  })
  return (
    <a ref={link} class="msg-file-download" href={props.href} download={props.name}
      aria-label={props.displayLabel ? t("file.download_named", { name: props.displayLabel }) : undefined}
      target="_blank" rel="noopener noreferrer">
      {t("file.download")}
    </a>
  )
}
