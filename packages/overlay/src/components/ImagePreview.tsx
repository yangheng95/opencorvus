import { createEffect, createMemo, createResource, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { JSX } from "solid-js"
import {
  closeImagePreview,
  imagePreviewState,
  openImagePreview,
} from "../services/image-preview"
import { formatErrorDetails } from "../utils/error-details"
import {
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  isApiAuthorityCurrent,
} from "../services/api"
import {
  calculateImagePreviewFitScale,
  calculateImagePreviewOpenScale,
  calculateImagePreviewWidthScale,
  clampImagePreviewScale,
  type ImagePreviewSize,
} from "../utils/image-preview-scale"
import { imagePreviewTriggerClass, imagePreviewTriggerContract } from "../utils/image-preview-trigger"
import { t } from "../utils/i18n"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { Dialog } from "./ui/Dialog"
import { Button } from "./ui/Button"
import { ContextMenu } from "./ui/ContextMenu"
import { DropdownMenu } from "./ui/DropdownMenu"
import { Icon } from "./ui/Icon"
import { Feedback } from "./ui/Feedback"
import { attachmentImagePreviewUrl } from "../utils/attachment-resource"
import { closeArtifactWorkspace, topLayerPortalMount } from "../utils/top-layer"

const SCALE_STEP = 0.25
const COPY_FEEDBACK_DURATION_MS = 2400
const IMAGE_COPY_SUCCESS_KEY = "image_preview.copy_status.copied"
const IMAGE_COPY_LOADING_KEY = "image_preview.copy_status.loading"
const IMAGE_COPY_CLIPBOARD_UNAVAILABLE_KEY = "image_preview.copy_status.clipboard_unavailable"
const IMAGE_COPY_SOURCE_KEY = "image_preview.copy_status.source_unavailable"
const IMAGE_COPY_FORMAT_KEY = "image_preview.copy_status.png_required"
const IMAGE_COPY_BLOCKED_KEY = "image_preview.copy_status.clipboard_blocked"
const IMAGE_COPY_IMAGE_UNAVAILABLE_KEY = "image_preview.copy_status.image_unavailable"
type ImageCopyFeedbackKey =
  | typeof IMAGE_COPY_SUCCESS_KEY
  | typeof IMAGE_COPY_LOADING_KEY
  | typeof IMAGE_COPY_CLIPBOARD_UNAVAILABLE_KEY
  | typeof IMAGE_COPY_SOURCE_KEY
  | typeof IMAGE_COPY_FORMAT_KEY
  | typeof IMAGE_COPY_BLOCKED_KEY
  | typeof IMAGE_COPY_IMAGE_UNAVAILABLE_KEY

type CopyFeedback = {
  tone: "success" | "error"
  key: ImageCopyFeedbackKey
}

type PreviewableImageAttributes = JSX.ImgHTMLAttributes<HTMLImageElement> &
  Partial<Record<`data-${string}`, string | undefined>>
type ImagePreviewBodyGeometry = {
  left: number
  top: number
  viewportSize: ImagePreviewSize
}

class ImageCopyError extends Error {
  constructor(readonly key: ImageCopyFeedbackKey) {
    super(key)
    this.name = "ImageCopyError"
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

export function PreviewableImage(props: {
  src: string
  alt?: string
  displayLabel?: string
  triggerClass?: string
  imageClass?: string
  imageDataUI?: string
  imageAttributes?: PreviewableImageAttributes
  resourceUrl?: string
  focusOrigin?: HTMLButtonElement
  triggerRef?: (element: HTMLButtonElement) => void
}) {
  let triggerButton: HTMLButtonElement | undefined
  const alt = () => props.alt || ""
  // Display annotations name the trigger; alt retains preview/download identity.
  const trigger = createMemo(() => imagePreviewTriggerContract({ src: props.src, alt: props.displayLabel ?? alt() }))
  const triggerClass = () => imagePreviewTriggerClass(props.triggerClass)
  const imageClass = () => ["md-img", props.imageClass].filter(Boolean).join(" ")
  const imageAttributes = () => props.imageAttributes ?? {}
  const [failedSource, setFailedSource] = createSignal<string | null>(null)
  const failed = () => failedSource() === props.src
  const delegatedPreview = () => !props.resourceUrl

  onMount(() => {
    const origin = props.focusOrigin
    if (!origin || !triggerButton?.isConnected || triggerButton.closest("[inert], [hidden]")) return
    const active = document.activeElement
    if (active === origin || (!origin.isConnected && active === document.body)) triggerButton.focus({ preventScroll: true })
  })

  function handlePreviewOpen(event: MouseEvent): void {
    event.preventDefault()
    event.stopPropagation()
    const resourceUrl = props.resourceUrl ?? (props.src.startsWith("/") ? props.src : undefined)
    openImagePreview(props.src, alt(), resourceUrl)
  }

  return (
    <Button
      ref={(element) => {
        triggerButton = element
        props.triggerRef?.(element)
      }}
      type="button"
      variant={trigger().variant}
      size={trigger().size}
      tone={trigger().tone}
      class={triggerClass()}
      data-ui={trigger().dataUi}
      data-image-preview-trigger={delegatedPreview() ? trigger().triggerFlag : undefined}
      data-image-preview-src={delegatedPreview() ? trigger().src : undefined}
      data-image-preview-alt={delegatedPreview() ? alt() : undefined}
      data-image-failed={failed() ? "true" : undefined}
      title={failed() ? t("image_preview.load_failed") : trigger().label}
      aria-label={trigger().label}
      onClick={handlePreviewOpen}
    >
      <img
        {...imageAttributes()}
        class={imageClass()}
        src={props.src}
        alt={alt()}
        loading="lazy"
        data-ui={props.imageDataUI}
        onError={(event) => {
          if (event.currentTarget.getAttribute("src") === props.src) setFailedSource(props.src)
        }}
        onLoad={(event) => {
          if (event.currentTarget.getAttribute("src") === props.src) setFailedSource(null)
        }}
      />
      <Show when={failed()}>
        <span class="msg-image-failure" role="status">
          <Icon name="file-document" size="compact" />
          <span>{t("image_preview.load_failed")}</span>
        </span>
      </Show>
    </Button>
  )
}

export function ImagePreviewHost() {
  createEffect(() => {
    if (!imagePreviewState().open) return
    for (const workspace of document.querySelectorAll<HTMLElement>("[data-artifact-workspace]:popover-open")) {
      closeArtifactWorkspace(workspace)
    }
  })
  const [resource, { refetch }] = createResource(
    () => {
      const state = imagePreviewState()
      return state.open && state.resourceUrl
        ? { url: attachmentImagePreviewUrl(state.resourceUrl), revision: state.revision, authority: captureApiAuthority() }
        : null
    },
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
  )
  const previewSource = () => {
    const state = imagePreviewState()
    if (!state.open) return ""
    return state.resourceUrl ? (!resource.loading && !resource.error && resource()) || "" : state.src
  }
  const [scale, setScale] = createSignal(1)
  const [imageSize, setImageSize] = createSignal<ImagePreviewSize>({ width: 0, height: 0 })
  const [imageFailed, setImageFailed] = createSignal(false)
  const imageUnavailable = () => imageFailed() || Boolean(imagePreviewState().resourceUrl && resource.error)
  const imageReady = () => !imageUnavailable() && imageSize().width > 0 && imageSize().height > 0
  const [bodyGeometry, setBodyGeometry] = createSignal<ImagePreviewBodyGeometry | null>(null)
  const [copyInFlight, setCopyInFlight] = createSignal(false)
  const [downloadInFlight, setDownloadInFlight] = createSignal(false)
  const [downloadFailure, setDownloadFailure] = createSignal<{ cause: unknown } | null>(null)
  let downloadButtonRef: HTMLButtonElement | undefined
  let downloadRetryRef: HTMLButtonElement | undefined
  let downloadGeneration = 0
  let downloadController: AbortController | undefined
  const [copyFeedback, setCopyFeedback] = createSignal<CopyFeedback | null>(null)
  const [panStart, setPanStart] = createSignal<{
    pointerID: number
    x: number
    y: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  let bodyRef: HTMLDivElement | undefined
  let actionsTriggerRef: HTMLButtonElement | undefined
  let imageRef: HTMLImageElement | undefined
  let resizeObserver: ResizeObserver | undefined
  let pendingWheelScale: { clientX: number; clientY: number; delta: number } | null = null
  let copyGeneration = 0
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined
  const applyOpenScaleOnFrame = createAnimationFrameScheduler(() => {
    readBodyGeometry()
    const openScale = previewOpenScale()
    if (imagePreviewState().open && imageSize().width > 0 && scale() < openScale) setScale(openScale)
  })
  const applyWheelScaleOnFrame = createAnimationFrameScheduler(() => {
    const pending = pendingWheelScale
    if (!pending) return
    pendingWheelScale = null
    const geometry = readBodyGeometry()
    if (!geometry) return
    applyScale(scale() + pending.delta, {
      x: pending.clientX - geometry.left,
      y: pending.clientY - geometry.top,
    })
  })

  createEffect(() => {
    const state = imagePreviewState()
    const src = previewSource()
    copyGeneration += 1
    downloadGeneration += 1
    downloadController?.abort()
    downloadController = undefined
    setDownloadInFlight(false)
    setDownloadFailure(null)
    setCopyInFlight(false)
    clearCopyFeedback()
    setPanStart(null)
    setImageFailed(false)
    if (!state.open) {
      pendingWheelScale = null
      applyWheelScaleOnFrame.cancel()
      return
    }
    setScale(1)
    setImageSize({ width: 0, height: 0 })
    setBodyGeometry(null)
    applyOpenScaleOnFrame.schedule()
    queueMicrotask(() => {
      if (imagePreviewState().revision !== state.revision || previewSource() !== src) return
      if (src && imageRef?.complete && imageRef.getAttribute("src") === src) measureLoadedImage(imageRef)
    })
  })

  createEffect(() => {
    const body = bodyRef
    if (!body) return
    resizeObserver?.disconnect()
    resizeObserver = new ResizeObserver(applyOpenScaleOnFrame.schedule)
    resizeObserver.observe(body)
    applyOpenScaleOnFrame.schedule()
  })

  onCleanup(() => {
    downloadGeneration += 1
    downloadController?.abort()
    bodyRef?.removeEventListener("wheel", handleWheel)
    resizeObserver?.disconnect()
    applyOpenScaleOnFrame.cancel()
    applyWheelScaleOnFrame.cancel()
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
  })

  const renderedSize = createMemo(() => {
    const size = imageSize()
    return {
      width: size.width * scale(),
      height: size.height * scale(),
    }
  })

  const fitScale = () => calculateImagePreviewFitScale(imageSize(), viewportSize())
  const widthScale = () => calculateImagePreviewWidthScale(imageSize(), viewportSize())
  const previewOpenScale = () => calculateImagePreviewOpenScale(imageSize(), viewportSize())
  const scaleLabel = () => `${Math.round(scale() * 100)}%`
  const stageStyle = () => {
    const rendered = renderedSize()
    return rendered.width > 0 && rendered.height > 0
      ? ({
          "--image-preview-rendered-width": `${rendered.width}px`,
          "--image-preview-rendered-height": `${rendered.height}px`,
        } as Record<string, string>)
      : undefined
  }

  function viewportSize(): ImagePreviewSize {
    return bodyGeometry()?.viewportSize ?? { width: 0, height: 0 }
  }

  function readBodyGeometry(): ImagePreviewBodyGeometry | null {
    const body = bodyRef
    if (!body) {
      setBodyGeometry(null)
      return null
    }
    const rect = body.getBoundingClientRect()
    const styles = window.getComputedStyle(body)
    const paddingX = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
    const paddingY = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    const next: ImagePreviewBodyGeometry = {
      left: rect.left,
      top: rect.top,
      viewportSize: {
        width: Math.max(0, body.clientWidth - paddingX),
        height: Math.max(0, body.clientHeight - paddingY),
      },
    }
    setBodyGeometry(next)
    return next
  }

  function bindBody(element: HTMLDivElement): void {
    if (bodyRef === element) return
    bodyRef?.removeEventListener("wheel", handleWheel)
    bodyRef = element
    bodyRef.addEventListener("wheel", handleWheel, { passive: false })
  }

  function measureLoadedImage(image: HTMLImageElement): void {
    const nextSize = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
    if (nextSize.width <= 0 || nextSize.height <= 0) {
      setImageFailed(true)
      setImageSize({ width: 0, height: 0 })
      return
    }
    setImageFailed(false)
    setImageSize(nextSize)
    setScale(calculateImagePreviewOpenScale(nextSize, readBodyGeometry()?.viewportSize ?? viewportSize()))
    requestAnimationFrame(() => {
      if (!bodyRef) return
      bodyRef.scrollLeft = 0
      bodyRef.scrollTop = 0
    })
  }

  function applyScale(nextScale: number, anchor?: { x: number; y: number }): void {
    if (!imageReady()) return
    const body = bodyRef
    const size = imageSize()
    const previousScale = scale()
    const resolvedScale = clampImagePreviewScale(nextScale)
    if (!body || size.width <= 0 || size.height <= 0) {
      setScale(resolvedScale)
      return
    }

    const anchorX = anchor?.x ?? body.clientWidth / 2
    const anchorY = anchor?.y ?? body.clientHeight / 2
    const ratioX = (body.scrollLeft + anchorX) / Math.max(1, size.width * previousScale)
    const ratioY = (body.scrollTop + anchorY) / Math.max(1, size.height * previousScale)

    setScale(resolvedScale)
    requestAnimationFrame(() => {
      body.scrollLeft = ratioX * size.width * resolvedScale - anchorX
      body.scrollTop = ratioY * size.height * resolvedScale - anchorY
    })
  }

  function setFitScale(): void {
    applyScale(fitScale(), { x: 0, y: 0 })
    requestAnimationFrame(() => {
      if (!bodyRef) return
      bodyRef.scrollLeft = 0
      bodyRef.scrollTop = 0
    })
  }

  function setWidthScale(): void {
    applyScale(widthScale(), { x: 0, y: 0 })
    requestAnimationFrame(() => {
      if (!bodyRef) return
      bodyRef.scrollLeft = 0
      bodyRef.scrollTop = 0
    })
  }

  function setOriginalScale(): void {
    applyScale(1, { x: 0, y: 0 })
    requestAnimationFrame(() => {
      if (!bodyRef) return
      bodyRef.scrollLeft = 0
      bodyRef.scrollTop = 0
    })
  }

  function updateScale(delta: number): void {
    applyScale(scale() + delta)
  }

  async function fetchPreviewImageBlob(src: string): Promise<Blob> {
    if (!src) throw new ImageCopyError(IMAGE_COPY_SOURCE_KEY)
    let response: Response
    try {
      response = await fetch(src)
    } catch {
      throw new ImageCopyError(IMAGE_COPY_SOURCE_KEY)
    }
    if (!response.ok) throw new ImageCopyError(IMAGE_COPY_SOURCE_KEY)
    const blob = await response.blob().catch(() => {
      throw new ImageCopyError(IMAGE_COPY_SOURCE_KEY)
    })
    if (blob.type.toLowerCase() !== "image/png") throw new ImageCopyError(IMAGE_COPY_FORMAT_KEY)
    return blob
  }

  function copyErrorKey(error: unknown): ImageCopyFeedbackKey {
    return error instanceof ImageCopyError ? error.key : IMAGE_COPY_BLOCKED_KEY
  }

  function imageCopyStatusText(key: ImageCopyFeedbackKey): string {
    const labels: Record<ImageCopyFeedbackKey, string> = {
      [IMAGE_COPY_SUCCESS_KEY]: t("image_preview.copy_status.copied"),
      [IMAGE_COPY_LOADING_KEY]: t("image_preview.copy_status.loading"),
      [IMAGE_COPY_CLIPBOARD_UNAVAILABLE_KEY]: t("image_preview.copy_status.clipboard_unavailable"),
      [IMAGE_COPY_SOURCE_KEY]: t("image_preview.copy_status.source_unavailable"),
      [IMAGE_COPY_FORMAT_KEY]: t("image_preview.copy_status.png_required"),
      [IMAGE_COPY_BLOCKED_KEY]: t("image_preview.copy_status.clipboard_blocked"),
      [IMAGE_COPY_IMAGE_UNAVAILABLE_KEY]: t("image_preview.copy_status.image_unavailable"),
    }
    return labels[key]
  }

  function clearCopyFeedback(): void {
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = undefined
    setCopyFeedback(null)
  }

  function showCopyFeedback(feedback: CopyFeedback): void {
    clearCopyFeedback()
    setCopyFeedback(feedback)
    copyFeedbackTimer = setTimeout(clearCopyFeedback, COPY_FEEDBACK_DURATION_MS)
  }

  async function copyPreviewImage(): Promise<void> {
    const image = imageRef
    const clipboardWrite = navigator.clipboard?.write
    const preview = imagePreviewState()
    const src = previewSource()
    const authority = preview.resourceUrl ? captureApiAuthority() : undefined
    const operationGeneration = ++copyGeneration
    const ownsOperation = () =>
      operationGeneration === copyGeneration &&
      imagePreviewState().open &&
      imagePreviewState().revision === preview.revision &&
      previewSource() === src &&
      (!authority || isApiAuthorityCurrent(authority))
    clearCopyFeedback()
    if (imageUnavailable()) {
      showCopyFeedback({ tone: "error", key: IMAGE_COPY_IMAGE_UNAVAILABLE_KEY })
      return
    }
    if (!image || !image.complete || imageSize().width <= 0 || imageSize().height <= 0) {
      showCopyFeedback({ tone: "error", key: IMAGE_COPY_LOADING_KEY })
      return
    }
    if (!clipboardWrite || typeof ClipboardItem === "undefined") {
      showCopyFeedback({ tone: "error", key: IMAGE_COPY_CLIPBOARD_UNAVAILABLE_KEY })
      return
    }

    setCopyInFlight(true)
    try {
      const blob = await fetchPreviewImageBlob(src)
      if (!ownsOperation()) return
      await clipboardWrite.call(navigator.clipboard, [new ClipboardItem({ "image/png": blob })])
      if (ownsOperation()) showCopyFeedback({ tone: "success", key: IMAGE_COPY_SUCCESS_KEY })
    } catch (error) {
      if (ownsOperation() && !isAbortError(error)) {
        showCopyFeedback({ tone: "error", key: copyErrorKey(error) })
      }
    } finally {
      if (ownsOperation()) setCopyInFlight(false)
    }
  }

  async function downloadPreviewImage(): Promise<void> {
    if (downloadInFlight()) return
    const preview = imagePreviewState()
    const authority = preview.resourceUrl ? captureApiAuthority() : undefined
    const generation = ++downloadGeneration
    const controller = new AbortController()
    downloadController = controller
    const current = () => generation === downloadGeneration && imagePreviewState().open &&
      imagePreviewState().revision === preview.revision &&
      (!authority || isApiAuthorityCurrent(authority))
    setDownloadInFlight(true)
    try {
      const src = preview.resourceUrl
        ? await fetchResourceAsObjectUrl(preview.resourceUrl, { authority, signal: controller.signal })
        : previewSource()
      if (!src || !current()) return
      const download = document.createElement("a")
      download.href = src
      download.download = preview.alt.split(/[\\/]/).pop()?.trim() || t("image_preview.title")
      download.rel = "noopener noreferrer"
      document.body.append(download)
      download.click()
      download.remove()
      const retryHasFocus = downloadRetryRef === document.activeElement
      setDownloadFailure(null)
      if (retryHasFocus) downloadButtonRef?.focus()
    } catch (error) {
      if (current()) setDownloadFailure({ cause: error })
    } finally {
      if (generation === downloadGeneration) {
        downloadController = undefined
        setDownloadInFlight(false)
      }
    }
  }

  async function retryPreview(event: MouseEvent & { currentTarget: HTMLButtonElement }): Promise<void> {
    const preview = imagePreviewState()
    if (!preview.resourceUrl || resource.loading || !resource.error) return
    const authority = captureApiAuthority()
    const button = event.currentTarget
    const hadFocus = document.activeElement === button
    await refetch()
    if (
      hadFocus && !button.isConnected && document.activeElement === document.body &&
      imagePreviewState().open && imagePreviewState().revision === preview.revision &&
      isApiAuthorityCurrent(authority) && !resource.loading && !resource.error
    ) downloadButtonRef?.focus({ preventScroll: true })
  }

  function handleWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    event.stopPropagation()
    if (!imageReady()) return
    const direction = event.deltaY > 0 ? -1 : 1
    pendingWheelScale = {
      clientX: event.clientX,
      clientY: event.clientY,
      delta: (pendingWheelScale?.delta ?? 0) + direction * SCALE_STEP,
    }
    applyWheelScaleOnFrame.schedule()
  }

  function startPan(event: PointerEvent): void {
    const body = bodyRef
    if (!body || !imageReady() || event.button !== 0 || event.isPrimary === false) return
    event.preventDefault()
    body.setPointerCapture(event.pointerId)
    setPanStart({
      pointerID: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: body.scrollLeft,
      scrollTop: body.scrollTop,
    })
  }

  function movePan(event: PointerEvent): void {
    const body = bodyRef
    const start = panStart()
    if (!body || !start || start.pointerID !== event.pointerId) return
    body.scrollLeft = start.scrollLeft - (event.clientX - start.x)
    body.scrollTop = start.scrollTop - (event.clientY - start.y)
  }

  function stopPan(event: PointerEvent): void {
    const body = bodyRef
    const start = panStart()
    if (!body || !start || start.pointerID !== event.pointerId) return
    body.releasePointerCapture(event.pointerId)
    setPanStart(null)
  }

  function ImageActionItems({ menu }: { menu: Pick<typeof ContextMenu, "Item" | "Separator"> }) {
    return (
      <>
        <menu.Item disabled={copyInFlight()} closeOnSelect onSelect={() => void copyPreviewImage()}>
          <Icon name="copy" size="compact" />
          <span>{t("image_preview.copy_image")}</span>
        </menu.Item>
        <menu.Separator />
        <menu.Item disabled={!imageReady()} closeOnSelect onSelect={setWidthScale}>
          <Icon name="panel-right" size="compact" />
          <span>{t("image_preview.fit_width")}</span>
        </menu.Item>
        <menu.Item disabled={!imageReady()} closeOnSelect onSelect={setFitScale}>
          <Icon name="maximize" size="compact" />
          <span>{t("image_preview.fit_image")}</span>
        </menu.Item>
        <menu.Item disabled={!imageReady()} closeOnSelect onSelect={setOriginalScale}>
          <span class="image-preview-dialog__menu-ratio" aria-hidden="true">1:1</span>
          <span>{t("image_preview.original_size")}</span>
        </menu.Item>
      </>
    )
  }

  return (
    <Dialog
      id="imagePreviewDialog"
      class="image-preview-dialog"
      overlayClass="image-preview-dialog__overlay"
      formClass="image-preview-dialog__form"
      headerClass="image-preview-dialog__header"
      open={imagePreviewState().open}
      title={imagePreviewState().alt || t("image_preview.title")}
      onClose={closeImagePreview}
      wider
      draggable={false}
      headerActions={
        <>
          <DropdownMenu.Root placement="bottom-end">
            <DropdownMenu.Trigger
              as={Button}
              class="image-preview-dialog__header-action"
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="icon-action"
              title={t("image_preview.actions")}
              aria-label={t("image_preview.actions")}
              ref={(element) => { actionsTriggerRef = element }}
            >
              <Icon name="more-horizontal" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal mount={topLayerPortalMount(actionsTriggerRef)}>
              <DropdownMenu.Content class="image-preview-dialog__menu">
                <ImageActionItems menu={DropdownMenu} />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <Button
            class="image-preview-dialog__header-action"
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="icon-action"
            title={t(downloadInFlight() ? "file.downloading" : "file.download")}
            aria-label={t(downloadInFlight() ? "file.downloading" : "file.download")}
            disabled={!previewSource()}
            aria-disabled={downloadInFlight() || undefined}
            ref={(element) => { downloadButtonRef = element }}
            onClick={() => void downloadPreviewImage()}
          >
            <Icon name="download" />
          </Button>
          <Button
            class="image-preview-dialog__header-action"
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="icon-action"
            title={t("common.close")}
            aria-label={t("common.close")}
            onClick={closeImagePreview}
          >
            <Icon name="close" />
          </Button>
        </>
      }
    >
      <Show when={downloadFailure()}>
        {(failure) => (
          <Feedback
            class="image-preview-dialog__download-failure"
            tone="error"
            title={t("file.download_failed")}
            details={formatErrorDetails(failure().cause)}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                aria-disabled={downloadInFlight() || undefined}
                aria-label={`${t("file.retry_download")}: ${imagePreviewState().alt || t("image_preview.title")}`}
                ref={(element) => { downloadRetryRef = element }}
                onClick={() => void downloadPreviewImage()}
              >
                {t(downloadInFlight() ? "common.retrying" : "file.retry_download")}
              </Button>
            }
          >
            {imagePreviewState().alt || t("image_preview.title")}
          </Feedback>
        )}
      </Show>
      <div
        class="image-preview-dialog__body"
        data-panning={panStart() ? "true" : "false"}
        ref={(element) => {
          bindBody(element)
        }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
      >
        <div class="image-preview-dialog__stage" style={stageStyle()}>
          <ContextMenu.Root>
            <ContextMenu.Trigger as="div" class="image-preview-dialog__image-menu-target">
              <Show when={resource.loading && !resource.error}>
                <div role="status">{t("common.loading")}</div>
              </Show>
              <img
                class="image-preview-dialog__image"
                data-unavailable={!previewSource() || imageUnavailable() ? "true" : undefined}
                src={previewSource() || undefined}
                alt={imagePreviewState().alt}
                ref={(element) => {
                  imageRef = element
                }}
                onLoad={(event) => {
                  if (previewSource() && event.currentTarget.getAttribute("src") === previewSource())
                    measureLoadedImage(event.currentTarget)
                }}
                onError={(event) => {
                  if (previewSource() && event.currentTarget.getAttribute("src") === previewSource()) {
                    setImageFailed(true)
                    setImageSize({ width: 0, height: 0 })
                  }
                }}
              />
              <Show when={imageUnavailable()}>
                <Feedback
                  class="image-preview-dialog__failure"
                  tone="error"
                  title={t("image_preview.load_failed")}
                  details={resource.error ? formatErrorDetails(resource.error) : undefined}
                  actions={
                    <Show when={imagePreviewState().resourceUrl && resource.error}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tone="neutral"
                        aria-disabled={resource.loading || undefined}
                        aria-label={`${t("file.retry_preview")}: ${imagePreviewState().alt || t("image_preview.title")}`}
                        onClick={(event) => void retryPreview(event)}
                      >
                        {t(resource.loading ? "common.retrying" : "file.retry_preview")}
                      </Button>
                    </Show>
                  }
                >
                  {t("image_preview.load_failed_hint")}
                </Feedback>
              </Show>
            </ContextMenu.Trigger>
            <ContextMenu.Portal mount={bodyRef}>
              <ContextMenu.Content
                class="image-preview-dialog__menu"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ImageActionItems menu={ContextMenu} />
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </div>
      </div>
      <Show when={copyFeedback()}>
        {(feedback) => (
          <span
            class="image-preview-dialog__copy-status"
            data-ui="image-copy-toast"
            data-status={feedback().tone}
            role={feedback().tone === "error" ? "alert" : "status"}
            aria-live={feedback().tone === "error" ? "assertive" : "polite"}
          >
            {imageCopyStatusText(feedback().key)}
          </span>
        )}
      </Show>
      <Show when={imageReady()}>
      <div class="image-preview-dialog__zoom" role="toolbar" aria-label={t("image_preview.controls")}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="icon-action"
          title={t("image_preview.zoom_out")}
          aria-label={t("image_preview.zoom_out")}
          onClick={() => updateScale(-SCALE_STEP)}
        >
          <Icon name="minimize" />
        </Button>
        <span class="image-preview-dialog__scale" role="status" aria-label={t("image_preview.current_zoom")}>
          {scaleLabel()}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="icon-action"
          title={t("image_preview.zoom_in")}
          aria-label={t("image_preview.zoom_in")}
          onClick={() => updateScale(SCALE_STEP)}
        >
          <Icon name="plus" />
        </Button>
      </div>
      </Show>
    </Dialog>
  )
}
