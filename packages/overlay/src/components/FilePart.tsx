import { SCREENSHOT_BROWSER_THUMBNAIL_VARIANT } from "@opencorvus-ai/transport-protocol"
import { createResource, Show, Switch, Match } from "solid-js"
import { fetchResourceAsObjectUrl, peekResourceObjectUrl, resolveResourceUrl } from "../services/api"
import { t } from "../utils/i18n"
import { PreviewableImage } from "./ImagePreview"

// Render a message "file" part: server-persisted attachments carry a URL that
// is either a server-relative path (/attachment/<projectID>/<sha>.<ext>) or
// an inline data URL (the composer's preview bubble before the task is
// submitted). Dropping server-relative paths into <img src> directly breaks
// under Tauri (wrong origin) and under Basic Auth (<img> cannot carry
// Authorization). This component routes through services/api so the same
// path works for every deployment:
//   - data: / blob: / http(s): URLs → used verbatim for media src attrs
//   - "/..." relative URLs → fetched via fetch() (origin + auth handled
//     centrally), converted to a blob object URL owned by the module-level
//     cache in services/api (see fetchResourceAsObjectUrl)
//
// Renderer dispatch by MIME:
//   image/*             → <img>
//   video/*             → <video controls>
//   audio/*             → <audio controls>
//   application/pdf     → <iframe> (WebView2 has a built-in viewer)
//   anything else       → filename chip with a download affordance
//
// Failures are surfaced, not papered over: a fetch error prints to console
// and replaces the media with a "Failed to load" chip. No fallback to the
// raw URL, since that would mask the underlying origin/auth mistake.

type MediaKind = "image" | "video" | "audio" | "pdf" | "other"

export type MessageFilePart = {
  type: "file"
  url?: string
  mime?: string
  mediaType?: string
  filename?: string
  alt?: string
}

type FilePartPresentation = "content" | "thumbnail"

function mimeOf(part: MessageFilePart): string {
  return (part.mime || part.mediaType || "").toLowerCase()
}

function kindOf(part: MessageFilePart): MediaKind {
  const mime = mimeOf(part)
  const url = part.url || ""
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime === "application/pdf") return "pdf"
  // MIME-less probes on file extension. Kept narrow — unknown extensions
  // fall through to "other" rather than guess wrong and break <video>.
  if (/^data:image\//i.test(url) || /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?|$)/i.test(url)) return "image"
  if (/^data:video\//i.test(url) || /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url)) return "video"
  if (/^data:audio\//i.test(url) || /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(url)) return "audio"
  if (/\.pdf(\?|$)/i.test(url)) return "pdf"
  return "other"
}

export function isImageFilePart(part: unknown): part is MessageFilePart {
  if (!part || typeof part !== "object" || (part as { type?: unknown }).type !== "file") return false
  return kindOf(part as MessageFilePart) === "image" && Boolean((part as MessageFilePart).url)
}

function needsAuthedFetch(url: string): boolean {
  // data: and blob: URLs are already bytes; absolute http(s) URLs owned by
  // third parties shouldn't receive our auth header. Only server-relative
  // paths (those `resolveResourceUrl` rewrites onto our serverUrl) need the
  // fetch → objectURL dance to carry Authorization / cross-origin.
  return url.startsWith("/")
}

function compactFileType(name: string, mime: string): string {
  const extension = name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]
  if (extension) return extension.toUpperCase()
  return mime
}

export function FilePart(props: { part: MessageFilePart; presentation?: FilePartPresentation }) {
  const url = () => props.part.url || ""
  const name = () => props.part.filename || url() || "file"
  const alt = () => props.part.alt || name()
  const kind = () => kindOf(props.part)
  const authed = () => needsAuthedFetch(url())
  const thumbnail = () => props.presentation === "thumbnail"

  return (
    <Switch fallback={<FallbackDownload url={url()} name={name()} mime={mimeOf(props.part)} authed={authed()} />}>
      <Match when={kind() === "image" && url() && authed()}>
        <AuthedImage url={url()} alt={alt()} thumbnail={thumbnail()} />
      </Match>
      <Match when={kind() === "image" && url()}>
        <div class={thumbnail() ? "msg-image-attachment" : "msg-img-wrap"}>
          <PreviewableImage
            src={resolveResourceUrl(url())}
            alt={alt()}
            triggerClass={thumbnail() ? "msg-image-attachment__trigger" : undefined}
            imageClass={thumbnail() ? "msg-image-attachment__image" : undefined}
            imageDataUI={thumbnail() ? "message-image-attachment-thumbnail" : undefined}
          />
        </div>
      </Match>

      <Match when={kind() === "video" && url() && authed()}>
        <AuthedVideo url={url()} name={name()} mime={mimeOf(props.part)} />
      </Match>
      <Match when={kind() === "video" && url()}>
        <div class="msg-video-wrap">
          <video class="md-video" src={resolveResourceUrl(url())} controls preload="metadata" />
        </div>
      </Match>

      <Match when={kind() === "audio" && url() && authed()}>
        <AuthedAudio url={url()} name={name()} mime={mimeOf(props.part)} />
      </Match>
      <Match when={kind() === "audio" && url()}>
        <div class="msg-audio-wrap">
          <audio class="md-audio" src={resolveResourceUrl(url())} controls preload="metadata" />
        </div>
      </Match>

      <Match when={kind() === "pdf" && url() && authed()}>
        <AuthedPdf url={url()} name={name()} />
      </Match>
      <Match when={kind() === "pdf" && url()}>
        <div class="msg-pdf-wrap">
          <iframe class="md-pdf" src={resolveResourceUrl(url())} title={name()} />
        </div>
      </Match>
    </Switch>
  )
}

// ── Auth-proxied media ──
// Blob lifetime is owned by the module-level cache in services/api —
// remounts do not revoke URLs, so these components do not need onCleanup.
// `initialValue` seeds the resource signal from the cache so a cache-hit
// path renders on the first tick without a spinner flash.

function AuthedImage(props: { url: string; alt: string; thumbnail: boolean }) {
  const displayUrl = () =>
    props.thumbnail ? `${props.url}?variant=${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}` : props.url
  const [objectUrl] = createResource(displayUrl, (raw) => fetchResourceAsObjectUrl(raw), {
    initialValue: peekResourceObjectUrl(displayUrl()),
  })

  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.alt} />}>
      <Show when={objectUrl()}>
        {(resolved) => (
          <div class={props.thumbnail ? "msg-image-attachment" : "msg-img-wrap"}>
            <PreviewableImage
              src={resolved()}
              alt={props.alt}
              triggerClass={props.thumbnail ? "msg-image-attachment__trigger" : undefined}
              imageClass={props.thumbnail ? "msg-image-attachment__image" : undefined}
              imageDataUI={props.thumbnail ? "message-image-attachment-thumbnail" : undefined}
              previewLoader={props.thumbnail ? () => fetchResourceAsObjectUrl(props.url) : undefined}
            />
          </div>
        )}
      </Show>
    </Show>
  )
}

function AuthedVideo(props: { url: string; name: string; mime: string }) {
  const [objectUrl] = createResource(
    () => props.url,
    (raw) => fetchResourceAsObjectUrl(raw),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.name} />}>
      <Show when={objectUrl()}>
        {(resolved) => (
          <div class="msg-video-wrap">
            <video class="md-video" src={resolved()} controls preload="metadata">
              {props.mime ? <source src={resolved()} type={props.mime} /> : null}
            </video>
            <DownloadLink href={resolved()} name={props.name} />
          </div>
        )}
      </Show>
    </Show>
  )
}

function AuthedAudio(props: { url: string; name: string; mime: string }) {
  const [objectUrl] = createResource(
    () => props.url,
    (raw) => fetchResourceAsObjectUrl(raw),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.name} />}>
      <Show when={objectUrl()}>
        {(resolved) => (
          <div class="msg-audio-wrap">
            <audio class="md-audio" src={resolved()} controls preload="metadata">
              {props.mime ? <source src={resolved()} type={props.mime} /> : null}
            </audio>
            <DownloadLink href={resolved()} name={props.name} />
          </div>
        )}
      </Show>
    </Show>
  )
}

function AuthedPdf(props: { url: string; name: string }) {
  const [objectUrl] = createResource(
    () => props.url,
    (raw) => fetchResourceAsObjectUrl(raw),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.name} />}>
      <Show when={objectUrl()}>
        {(resolved) => (
          <div class="msg-pdf-wrap">
            <iframe class="md-pdf" src={resolved()} title={props.name} />
            <DownloadLink href={resolved()} name={props.name} />
          </div>
        )}
      </Show>
    </Show>
  )
}

// ── Fallback + helpers ──

function FallbackDownload(props: { url: string; name: string; mime: string; authed: boolean }) {
  // For server-relative URLs we can't put them on <a href> directly (auth
  // header won't propagate on the resulting navigation). Fetch through the
  // authed proxy so the download link points at a blob URL the browser can
  // open inline or save.
  const [objectUrl] = createResource(
    () => (props.authed && props.url ? props.url : null),
    (u: string | null) => (u ? fetchResourceAsObjectUrl(u) : null),
    { initialValue: props.authed ? peekResourceObjectUrl(props.url) : null },
  )
  const href = () => {
    if (!props.url) return ""
    if (props.authed) return objectUrl() || ""
    return props.url
  }

  return (
    <div class="msg-file-chip">
      <span class="msg-file-chip__name">{props.name}</span>
      <Show when={props.mime}>
        <span class="msg-file-chip__mime" title={props.mime}>
          {compactFileType(props.name, props.mime)}
        </span>
      </Show>
      <Show when={href()}>
        <DownloadLink href={href()} name={props.name} />
      </Show>
    </div>
  )
}

function DownloadLink(props: { href: string; name: string }) {
  // `download` attribute asks the browser to save under this filename rather
  // than navigate. Under WebView2 the blob URL flow works; under a browser
  // deployment with Basic Auth the blob URL was already fetched with auth
  // so no credentials are needed at click time.
  return (
    <a class="msg-file-download" href={props.href} download={props.name} target="_blank" rel="noopener noreferrer">
      {t("file.download")}
    </a>
  )
}

function LoadError(props: { name: string }) {
  return <div class="msg-file-error">{t("file.load_failed", { name: props.name })}</div>
}
