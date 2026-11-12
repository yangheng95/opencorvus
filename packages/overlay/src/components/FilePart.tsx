import { isDecodableText } from "@opencorvus-ai/util/text-mime"
import {
  DIRECTORY_REFERENCE_MIME,
  DirectoryReferenceManifestSchema,
  LOCAL_DIRECTORY_REFERENCE_MIME,
  SCREENSHOT_BROWSER_THUMBNAIL_VARIANT,
} from "@opencorvus-ai/transport-protocol"
import { createResource, createSignal, Show, Switch, Match, lazy, Suspense, onCleanup } from "solid-js"
import {
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  isApiAuthorityCurrent,
  peekResourceObjectUrl,
  resolveResourceUrl,
} from "../services/api"
import { localeTag, t } from "../utils/i18n"
import { PreviewableImage } from "./ImagePreview"
import { attachmentImagePreviewUrl, isStoredAttachmentUrl } from "../utils/attachment-resource"
import { Disclosure } from "./ui/Disclosure"
import { createResourceTextRead, ResourceTextDownload, ResourceTextPreview } from "./ResourceTextPreview"
import { DownloadLink, OriginalFileDownload } from "./OriginalFileDownload"
import { formatErrorDetails } from "../utils/error-details"
import { Feedback } from "./ui/Feedback"
import { Button } from "./ui/Button"
import { fileEditorReserved, openSourceFileEditor, revealFileExplorerFolder } from "../services/file-workbench"
import { activeDirectory } from "../services/workspace"
import { boardStore, selectedConversationDirectory } from "../store/board"
import { projectDirectoryKey } from "../utils/project-directory"
import { serverFileUrlPath } from "../utils/server-path"

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
//   directory references → project Explorer from user-message history
//   image/*             → <img>
//   video/*             → <video controls>
//   audio/*             → <audio controls>
//   application/pdf     → shared PDF.js preview
//   decodable text     → on-demand text review in user-message history
//   anything else       → filename chip with a download affordance
//
// Failed reads expose the original diagnostic and an explicit retry of the
// same authorized resource. The shared cache continues to own Blob lifetime.

type MediaKind = "image" | "video" | "audio" | "pdf" | "other"

export type MessageFilePart = {
  type: "file"
  id?: string
  messageID?: string
  url?: string
  mime?: string
  mediaType?: string
  filename?: string
  alt?: string
}

export type FilePartPresentation = "content" | "thumbnail" | "composer-thumbnail"
export type FilePartMessageRole = "user" | "assistant"

export function messageAttachmentDisplayLabel(
  part: MessageFilePart,
  parts: readonly { type?: string; id?: string; messageID?: string; filename?: string }[],
): string | undefined {
  if (!part.id || !part.filename) return undefined
  const files = parts.filter((entry) => entry.type === "file" && entry.messageID === part.messageID)
  const position = files.findIndex((entry) => entry.id === part.id)
  if (position < 0 || files.filter((entry) => entry.filename === part.filename).length < 2) return undefined
  return t("chat.attachment.duplicate_label", {
    position: new Intl.NumberFormat(localeTag()).format(position + 1),
    name: part.filename,
  })
}

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

export function FilePart(props: {
  part: MessageFilePart
  presentation?: FilePartPresentation
  messageRole?: FilePartMessageRole
  displayLabel?: string
}) {
  const url = () => props.part.url || ""
  const name = () => props.part.filename || url() || "file"
  const label = () => props.displayLabel ?? name()
  const alt = () => props.part.alt || name()
  const kind = () => kindOf(props.part)
  const authed = () => needsAuthedFetch(url())
  const thumbnail = () => props.presentation === "thumbnail" || props.presentation === "composer-thumbnail"
  const composerThumbnail = () => props.presentation === "composer-thumbnail"
  const userHistory = () => props.messageRole === "user"
  const folderReference = () => userHistory() &&
    (mimeOf(props.part) === LOCAL_DIRECTORY_REFERENCE_MIME || mimeOf(props.part) === DIRECTORY_REFERENCE_MIME)
  const historicalText = () => userHistory() && url() && kind() === "other" &&
    isDecodableText(mimeOf(props.part), props.part.filename)

  return (
    <Switch fallback={<FallbackDownload url={url()} name={name()} displayLabel={props.displayLabel} mime={mimeOf(props.part)} />}>
      <Match when={folderReference()}>
        <FolderReference url={url()} name={name()} label={label()} stored={mimeOf(props.part) === DIRECTORY_REFERENCE_MIME} />
      </Match>
      <Match when={historicalText() && /^file:/i.test(url())}>
        <LocalTextReference url={url()} name={name()} label={label()} />
      </Match>
      <Match when={historicalText()}>
        <TextAttachment url={url()} name={name()} displayLabel={props.displayLabel} mime={mimeOf(props.part)} />
      </Match>
      <Match when={kind() === "image" && url() && authed()}>
        <AuthedImage url={url()} name={name()} alt={alt()} displayLabel={props.displayLabel} presentation={props.presentation ?? "content"} />
      </Match>
      <Match when={kind() === "image" && url()}>
        <div class={composerThumbnail() ? "composer-attachment-thumbnail" : thumbnail() ? "msg-image-attachment" : "msg-img-wrap"}>
          <PreviewableImage
            src={resolveResourceUrl(url())}
            alt={alt()}
            displayLabel={props.displayLabel}
            triggerClass={composerThumbnail() ? "composer-attachment-preview-trigger" : thumbnail() ? "msg-image-attachment__trigger" : undefined}
            imageClass={composerThumbnail() ? "chat-attachment-thumb" : thumbnail() ? "msg-image-attachment__image" : undefined}
            imageDataUI={composerThumbnail() ? "composer-image-attachment-thumbnail" : thumbnail() ? "message-image-attachment-thumbnail" : undefined}
          />
        </div>
      </Match>

      <Match when={kind() === "video" && url() && authed()}>
        <AuthedVideo url={url()} name={name()} displayLabel={props.displayLabel} mime={mimeOf(props.part)} />
      </Match>
      <Match when={kind() === "video" && url()}>
        <div class="msg-video-wrap">
          <span class="msg-file-chip__name" title={label()}>{label()}</span>
          <video class="md-video" src={resolveResourceUrl(url())} aria-label={label()} controls preload="metadata" />
        </div>
      </Match>

      <Match when={kind() === "audio" && url() && authed()}>
        <AuthedAudio url={url()} name={name()} displayLabel={props.displayLabel} mime={mimeOf(props.part)} />
      </Match>
      <Match when={kind() === "audio" && url()}>
        <div class="msg-audio-wrap">
          <span class="msg-file-chip__name" title={label()}>{label()}</span>
          <audio class="md-audio" src={resolveResourceUrl(url())} aria-label={label()} controls preload="metadata" />
        </div>
      </Match>

      <Match when={kind() === "pdf" && url()}>
        <PdfAttachment url={url()} name={name()} displayLabel={props.displayLabel} authed={authed()} compact={props.presentation === "thumbnail"} />
      </Match>
    </Switch>
  )
}

function FolderReference(props: { url: string; name: string; label: string; stored: boolean }) {
  const [opening, setOpening] = createSignal(false)
  const [failure, setFailure] = createSignal<{ kind: "outside-project" } | { kind: "read"; cause: unknown }>()
  let mounted = true
  onCleanup(() => { mounted = false })

  async function open(origin: HTMLButtonElement) {
    const directory = selectedConversationDirectory()
    if (!directory || opening()) return
    const explorerDirectory = activeDirectory().trim()
    const authority = captureApiAuthority()
    const selectionEpoch = boardStore.selectEpoch
    const url = props.url
    const stored = props.stored
    const ownsSource = () => mounted && props.url === url && boardStore.selectEpoch === selectionEpoch &&
      isApiAuthorityCurrent(authority)
    setFailure(undefined)
    if (projectDirectoryKey(explorerDirectory) !== projectDirectoryKey(directory)) {
      setFailure({ kind: "outside-project" })
      return
    }
    setOpening(true)
    try {
      const result = await revealFileExplorerFolder({
        directory: explorerDirectory,
        authority,
        selectionEpoch,
        origin,
      }, async () => {
        if (!stored) return serverFileUrlPath(url, directory)
        if (!isStoredAttachmentUrl(url)) throw new TypeError("Invalid stored folder reference URL")
        const href = await fetchResourceAsObjectUrl(url, { authority })
        const manifest = await (await fetch(href)).json()
        return DirectoryReferenceManifestSchema.parse(manifest).path
      }, () => ownsSource() && projectDirectoryKey(activeDirectory()) === projectDirectoryKey(directory))
      if (ownsSource() && result === "outside-project") setFailure({ kind: result })
    } catch (cause) {
      if (ownsSource()) setFailure({ kind: "read", cause })
    } finally {
      if (mounted) setOpening(false)
    }
  }

  return (
    <>
      <div class="msg-file-chip msg-folder-reference">
        <span class="msg-file-chip__name" title={props.label}>{props.label}</span>
        <div class="msg-folder-reference__actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tone="neutral"
            disabled={!selectedConversationDirectory()}
            aria-busy={opening() || undefined}
            aria-label={t("file.open_folder_named", { name: props.label })}
            onClick={(event) => void open(event.currentTarget)}
          >
            {t("file.open_folder")}
          </Button>
          <Show when={props.stored && isStoredAttachmentUrl(props.url)}>
            <OriginalFileDownload
              url={props.url}
              name={props.name}
              displayLabel={props.label}
              actionLabel={{
                text: t("file.download_folder_reference"),
                accessibleName: t("file.download_folder_reference_named", { name: props.label }),
              }}
            />
          </Show>
        </div>
      </div>
      <Show when={failure()}>
        {(error) => {
          const details = () => {
            const current = error()
            return current.kind === "read" ? formatErrorDetails(current.cause) : undefined
          }
          return (
            <Feedback tone="error" details={details()}>
              {error().kind === "outside-project"
                ? t("file.folder_outside_project")
                : t("file.load_failed", { name: props.label })}
            </Feedback>
          )
        }}
      </Show>
    </>
  )
}

function LocalTextReference(props: { url: string; name: string; label: string }) {
  const [opening, setOpening] = createSignal(false)
  const [failure, setFailure] = createSignal<{ cause: unknown }>()

  async function open() {
    const directory = selectedConversationDirectory()
    if (!directory || opening() || fileEditorReserved()) return
    const authority = captureApiAuthority()
    const epoch = boardStore.selectEpoch
    const url = props.url
    setFailure(undefined)
    setOpening(true)
    try {
      const path = serverFileUrlPath(url, directory)
      await openSourceFileEditor(path, { directory, authority }, undefined, props.name)
    } catch (cause) {
      if (isApiAuthorityCurrent(authority) && boardStore.selectEpoch === epoch && props.url === url) setFailure({ cause })
    } finally {
      setOpening(false)
    }
  }

  return (
    <>
      <div class="msg-file-chip">
        <span class="msg-file-chip__name" title={props.label}>{props.label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tone="neutral"
          disabled={!selectedConversationDirectory() || fileEditorReserved()}
          aria-busy={opening() || undefined}
          aria-label={`${t("chat.source_open_current_file")}: ${props.label}`}
          onClick={() => void open()}
        >
          {t("chat.source_open_current_file")}
        </Button>
      </div>
      <Show when={failure()}>
        {(error) => (
          <Feedback tone="error" details={formatErrorDetails(error().cause)}>
            {t("file.load_failed", { name: props.label })}
          </Feedback>
        )}
      </Show>
    </>
  )
}

function TextAttachment(props: { url: string; name: string; displayLabel?: string; mime: string }) {
  const [expanded, setExpanded] = createSignal(false)
  const textRead = createResourceTextRead(() => expanded() ? { url: props.url } : undefined)
  return (
    <Disclosure.Root class="msg-text-attachment" variant="surface" open={expanded()} onOpenChange={setExpanded}>
      <Disclosure.Trigger
        indicatorPosition="end"
        title={props.displayLabel ?? props.name}
        aria-label={t("chat.attachment.preview", { name: props.displayLabel ?? props.name })}
      >
        <span class="msg-text-attachment__type">{compactFileType(props.name, props.mime)}</span>
        <span class="msg-text-attachment__name">{props.displayLabel ?? props.name}</span>
      </Disclosure.Trigger>
      <Disclosure.Content>
        <Show when={expanded()}>
          <ResourceTextPreview read={textRead} filename={props.name} label={props.displayLabel ?? props.name} />
          <div class="msg-text-attachment__actions">
            <ResourceTextDownload read={textRead} filename={props.name} label={props.displayLabel} />
          </div>
        </Show>
      </Disclosure.Content>
    </Disclosure.Root>
  )
}

function PdfAttachment(props: { url: string; name: string; displayLabel?: string; authed: boolean; compact: boolean }) {
  const [expanded, setExpanded] = createSignal(false)
  const content = () => (
    <Show when={props.authed} fallback={<div class="msg-pdf-wrap"><PdfContent url={props.url} name={props.displayLabel ?? props.name} /></div>}>
      <AuthedPdf url={props.url} name={props.name} displayLabel={props.displayLabel} />
    </Show>
  )

  return (
    <Show when={props.compact} fallback={content()}>
      <Disclosure.Root class="msg-pdf-attachment" variant="surface" open={expanded()} onOpenChange={setExpanded}>
        <Disclosure.Trigger
          indicatorPosition="end"
          title={props.displayLabel ?? props.name}
          aria-label={t("chat.attachment.preview", { name: props.displayLabel ?? props.name })}
        >
          <span class="msg-pdf-attachment__type">PDF</span>
          <span class="msg-pdf-attachment__name">{props.displayLabel ?? props.name}</span>
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

function AuthedImage(props: { url: string; name: string; alt: string; displayLabel?: string; presentation: FilePartPresentation }) {
  const thumbnail = () => props.presentation !== "content"
  const composerThumbnail = () => props.presentation === "composer-thumbnail"
  const previewUrl = () => attachmentImagePreviewUrl(props.url)
  const displayUrl = () =>
    thumbnail() ? `${props.url}?variant=${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}` : previewUrl()
  const [objectUrl, { refetch }] = createResource(
    () => ({ url: displayUrl(), authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(displayUrl()),
    },
  )

  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.displayLabel ?? props.name} error={objectUrl.error} loading={objectUrl.loading} onRetry={() => void refetch()} />}>
      <Show when={!objectUrl.loading && objectUrl()} fallback={composerThumbnail() ? <span class="chat-attachment-icon">{props.alt.split(".").pop()?.toUpperCase()}</span> : <div role="status">{t("common.loading")}</div>}>
        {(resolved) => (
          <div class={composerThumbnail() ? "composer-attachment-thumbnail" : thumbnail() ? "msg-image-attachment" : "msg-img-wrap"}>
            <PreviewableImage
              src={resolved()}
              resourceUrl={props.url}
              alt={props.alt}
              displayLabel={props.displayLabel}
              triggerClass={composerThumbnail() ? "composer-attachment-preview-trigger" : thumbnail() ? "msg-image-attachment__trigger" : undefined}
              imageClass={composerThumbnail() ? "chat-attachment-thumb" : thumbnail() ? "msg-image-attachment__image" : undefined}
              imageDataUI={composerThumbnail() ? "composer-image-attachment-thumbnail" : thumbnail() ? "message-image-attachment-thumbnail" : undefined}
            />
          </div>
        )}
      </Show>
    </Show>
  )
}

function AuthedVideo(props: { url: string; name: string; displayLabel?: string; mime: string }) {
  const [objectUrl, { refetch }] = createResource(
    () => ({ url: props.url, authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.displayLabel ?? props.name} error={objectUrl.error} loading={objectUrl.loading} onRetry={() => void refetch()} />}>
      <Show when={!objectUrl.loading && objectUrl()} fallback={<div role="status">{t("common.loading")}</div>}>
        {(resolved) => (
          <div class="msg-video-wrap">
            <span class="msg-file-chip__name" title={props.displayLabel ?? props.name}>{props.displayLabel ?? props.name}</span>
            <video class="md-video" src={resolved()} aria-label={props.displayLabel ?? props.name} controls preload="metadata">
              {props.mime ? <source src={resolved()} type={props.mime} /> : null}
            </video>
            <DownloadLink href={resolved()} name={props.name} displayLabel={props.displayLabel} />
          </div>
        )}
      </Show>
    </Show>
  )
}

function AuthedAudio(props: { url: string; name: string; displayLabel?: string; mime: string }) {
  const [objectUrl, { refetch }] = createResource(
    () => ({ url: props.url, authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.displayLabel ?? props.name} error={objectUrl.error} loading={objectUrl.loading} onRetry={() => void refetch()} />}>
      <Show when={!objectUrl.loading && objectUrl()} fallback={<div role="status">{t("common.loading")}</div>}>
        {(resolved) => (
          <div class="msg-audio-wrap">
            <span class="msg-file-chip__name" title={props.displayLabel ?? props.name}>{props.displayLabel ?? props.name}</span>
            <audio class="md-audio" src={resolved()} aria-label={props.displayLabel ?? props.name} controls preload="metadata">
              {props.mime ? <source src={resolved()} type={props.mime} /> : null}
            </audio>
            <DownloadLink href={resolved()} name={props.name} displayLabel={props.displayLabel} />
          </div>
        )}
      </Show>
    </Show>
  )
}

function AuthedPdf(props: { url: string; name: string; displayLabel?: string }) {
  const [objectUrl, { refetch }] = createResource(
    () => ({ url: props.url, authority: captureApiAuthority() }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    {
      initialValue: peekResourceObjectUrl(props.url),
    },
  )
  return (
    <Show when={!objectUrl.error} fallback={<LoadError name={props.displayLabel ?? props.name} error={objectUrl.error} loading={objectUrl.loading} onRetry={() => void refetch()} />}>
      <Show when={!objectUrl.loading && objectUrl()} fallback={<div role="status">{t("common.loading")}</div>}>
        {(resolved) => (
          <div class="msg-pdf-wrap">
            <PdfContent url={resolved()} name={props.displayLabel ?? props.name} />
            <DownloadLink href={resolved()} name={props.name} displayLabel={props.displayLabel} />
          </div>
        )}
      </Show>
    </Show>
  )
}

// ── Fallback + helpers ──

function FallbackDownload(props: { url: string; name: string; displayLabel?: string; mime: string }) {
  return (
    <div class="msg-file-chip">
      <span class="msg-file-chip__name">{props.displayLabel ?? props.name}</span>
      <Show when={props.mime}>
        <span class="msg-file-chip__mime" title={props.mime}>
          {compactFileType(props.name, props.mime)}
        </span>
      </Show>
      <OriginalFileDownload url={props.url} name={props.name} displayLabel={props.displayLabel} />
    </div>
  )
}

function LoadError(props: { name: string; error: unknown; loading: boolean; onRetry: () => void }) {
  return (
    <Feedback
      class="msg-file-error"
      tone="error"
      details={formatErrorDetails(props.error)}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          tone="neutral"
          aria-disabled={props.loading || undefined}
          aria-label={`${t("file.retry_preview")}: ${props.name}`}
          onClick={() => { if (!props.loading) props.onRetry() }}
        >
          {t(props.loading ? "common.retrying" : "file.retry_preview")}
        </Button>
      }
    >
      {t("file.load_failed", { name: props.name })}
    </Feedback>
  )
}
