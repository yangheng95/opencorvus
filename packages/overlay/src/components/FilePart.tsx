import { SCREENSHOT_BROWSER_THUMBNAIL_VARIANT } from "@opencorvus-ai/transport-protocol"
import { createResource, createSignal, Show, Switch, Match, lazy, Suspense } from "solid-js"
import {
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  peekResourceObjectUrl,
  resolveResourceUrl,
} from "../services/api"
import { t } from "../utils/i18n"
import { PreviewableImage } from "./ImagePreview"
import { attachmentImagePreviewUrl } from "../utils/attachment-resource"
import { Disclosure } from "./ui/Disclosure"
import { ResourceTextPreview } from "./ResourceTextPreview"

const LazyPdfPreview = lazy(async () => ({ default: (await import("./PdfPreview")).PdfPreview }))

function PdfContent(props: { url: string; name: string }) {
  return (
    <Suspense fallback={<div role="status">{t("common.loading")}</div>}>
      <LazyPdfPreview url={props.url} label={props.name} />
    </Suspense>
  )
}

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
//   application/pdf     → shared PDF.js preview
//   text/*, JSON        → on-demand text review in user-message history
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

export type FilePartPresentation = "content" | "thumbnail" | "composer-thumbnail"

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
  const thumbnail = () => props.presentation === "thumbnail" || props.presentation === "composer-thumbnail"
  const composerThumbnail = () => props.presentation === "composer-thumbnail"

  return (
    <Switch fallback={<FallbackDownload url={url()} name={name()} mime={mimeOf(props.part)} authed={authed()} />}>
      <Match when={props.presentation === "thumbnail" && url() && (mimeOf(props.part).startsWith("text/") || mimeOf(props.part) === "application/json")}>
        <TextAttachment url={url()} name={name()} mime={mimeOf(props.part)} authed={authed()} />
      </Match>
      <Match when={kind() === "image" && url() && authed()}>
        <AuthedImage url={url()} alt={alt()} presentation={props.presentation ?? "content"} />
      </Match>
      <Match when={kind() === "image" && url()}>
        <div class={composerThumbnail() ? "composer-attachment-thumbnail" : thumbnail() ? "msg-image-attachment" : "msg-img-wrap"}>
          <PreviewableImage
            src={resolveResourceUrl(url())}
            alt={alt()}
            triggerClass={composerThumbnail() ? "composer-attachment-preview-trigger" : thumbnail() ? "msg-image-attachment__trigger" : undefined}
            imageClass={composerThumbnail() ? "chat-attachment-thumb" : thumbnail() ? "msg-image-attachment__image" : undefined}
            imageDataUI={composerThumbnail() ? "composer-image-attachment-thumbnail" : thumbnail() ? "message-image-attachment-thumbnail" : undefined}
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

      <Match when={kind() === "pdf" && url()}>
        <PdfAttachment url={url()} name={name()} authed={authed()} compact={props.presentation === "thumbnail"} />
      </Match>
    </Switch>
  )
}

function TextAttachment(props: { url: string; name: string; mime: string; authed: boolean }) {
  const [expanded, setExpanded] = createSignal(false)
  return (
    <Disclosure.Root class="msg-text-attachment" variant="surface" open={expanded()} onOpenChange={setExpanded}>
      <Disclosure.Trigger
        indicatorPosition="end"
        title={props.name}
        aria-label={t("chat.attachment.preview", { name: props.name })}
      >
        <span class="msg-text-attachment__type">{compactFileType(props.name, props.mime)}</span>
        <span class="msg-text-attachment__name">{props.name}</span>
      </Disclosure.Trigger>
      <Disclosure.Content>
        <Show when={expanded()}>
          <ResourceTextPreview url={props.url} filename={props.name} label={props.name} />
          <div class="msg-text-attachment__actions">
            <OriginalFileDownload url={props.url} name={props.name} authed={props.authed} />
          </div>
        </Show>
      </Disclosure.Content>
    </Disclosure.Root>
  )
}

function PdfAttachment(props: { url: string; name: string; authed: boolean; compact: boolean }) {
  const [expanded, setExpanded] = createSignal(false)
  const content = () => (
    <Show when={props.authed} fallback={<div class="msg-pdf-wrap"><PdfContent url={props.url} name={props.name} /></div>}>
      <AuthedPdf url={props.url} name={props.name} />
    </Show>
  )

  return (
    <Show when={props.compact} fallback={content()}>
      <Disclosure.Root class="msg-pdf-attachment" variant="surface" open={expanded()} onOpenChange={setExpanded}>
        <Disclosure.Trigger
          indicatorPosition="end"
          title={props.name}
          aria-label={t("chat.attachment.preview", { name: props.name })}
        >
          <span class="msg-pdf-attachment__type">PDF</span>
          <span class="msg-pdf-attachment__name">{props.name}</span>
        </Disclosure.Trigger>
        <Disclosure.Content>
          <Show when={expanded()}>{content()}</Show>
        </Disclosure.Content>
      </Disclosure.Root>
    </Show>
  )
}

// ── Auth-proxied media ──
// Blob lifetime is owned by the module-level cache in services/api —
// remounts do not revoke URLs, so these components do not need onCleanup.
// `initialValue` seeds the resource signal from the cache so a cache-hit
// path renders on the first tick without a spinner flash.

function AuthedImage(props: { url: string; alt: string; presentation: FilePartPresentation }) {
  const thumbnail = () => props.presentation !== "content"
  const composerThumbnail = () => props.presentation === "composer-thumbnail"
  const previewUrl = () => attachmentImagePreviewUrl(props.url)
  const displayUrl = () =>
    thumbnail() ? `${props.url}?variant=${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}` : previewUrl()
  const [objectUrl] = createResource(
    () => ({ url: displayUrl(), authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(displayUrl()),
    },
  )

  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.alt} />}>
      <Show when={!objectUrl.loading && objectUrl()} fallback={composerThumbnail() ? <span class="chat-attachment-icon">{props.alt.split(".").pop()?.toUpperCase()}</span> : undefined}>
        {(resolved) => (
          <div class={composerThumbnail() ? "composer-attachment-thumbnail" : thumbnail() ? "msg-image-attachment" : "msg-img-wrap"}>
            <PreviewableImage
              src={resolved()}
              resourceUrl={props.url}
              alt={props.alt}
              triggerClass={composerThumbnail() ? "composer-attachment-preview-trigger" : thumbnail() ? "msg-image-attachment__trigger" : undefined}
              imageClass={composerThumbnail() ? "chat-attachment-thumb" : thumbnail() ? "msg-image-attachment__image" : undefined}
              imageDataUI={composerThumbnail() ? "composer-image-attachment-thumbnail" : thumbnail() ? "message-image-attachment-thumbnail" : undefined}
              previewLoader={thumbnail() ? () => fetchResourceAsObjectUrl(previewUrl()) : undefined}
            />
          </div>
        )}
      </Show>
    </Show>
  )
}

function AuthedVideo(props: { url: string; name: string; mime: string }) {
  const [objectUrl] = createResource(
    () => ({ url: props.url, authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.name} />}>
      <Show when={!objectUrl.loading && objectUrl()}>
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
    () => ({ url: props.url, authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.name} />}>
      <Show when={!objectUrl.loading && objectUrl()}>
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
    () => ({ url: props.url, authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.name} />}>
      <Show when={!objectUrl.loading && objectUrl()}>
        {(resolved) => (
          <div class="msg-pdf-wrap">
            <PdfContent url={resolved()} name={props.name} />
            <DownloadLink href={resolved()} name={props.name} />
          </div>
        )}
      </Show>
    </Show>
  )
}

// ── Fallback + helpers ──

function FallbackDownload(props: { url: string; name: string; mime: string; authed: boolean }) {
  return (
    <div class="msg-file-chip">
      <span class="msg-file-chip__name">{props.name}</span>
      <Show when={props.mime}>
        <span class="msg-file-chip__mime" title={props.mime}>
          {compactFileType(props.name, props.mime)}
        </span>
      </Show>
      <OriginalFileDownload url={props.url} name={props.name} authed={props.authed} />
    </div>
  )
}

function OriginalFileDownload(props: { url: string; name: string; authed: boolean }) {
  // For server-relative URLs we can't put them on <a href> directly (auth
  // header won't propagate on the resulting navigation). Fetch through the
  // authed proxy so the download link points at a blob URL the browser can
  // open inline or save.
  const [objectUrl] = createResource(
    () => (props.authed && props.url ? { url: props.url, authority: captureApiAuthority() } : null),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    { initialValue: props.authed ? peekResourceObjectUrl(props.url) : null },
  )
  const href = () => {
    if (!props.url) return ""
    if (props.authed) return (!objectUrl.loading && objectUrl()) || ""
    return props.url
  }

  return <Show when={href()}><DownloadLink href={href()} name={props.name} /></Show>
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
