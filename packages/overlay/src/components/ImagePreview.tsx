import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import type { JSX } from "solid-js"
import {
  beginImagePreviewRequest,
  cancelImagePreviewRequest,
  closeImagePreview,
  imagePreviewRequestIsCurrent,
  imagePreviewState,
  openImagePreviewForRequest,
} from "../services/image-preview"
import { formatErrorDetails, reportError } from "../services/diagnostics"
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
import { Icon } from "./ui/Icon"

const SCALE_STEP = 0.25
const COPY_FEEDBACK_DURATION_MS = 2400
const IMAGE_COPY_SUCCESS_KEY = "image_preview.copy_status.copied"
const IMAGE_COPY_LOADING_KEY = "image_preview.copy_status.loading"
const IMAGE_COPY_CLIPBOARD_UNAVAILABLE_KEY = "image_preview.copy_status.clipboard_unavailable"
const IMAGE_COPY_SOURCE_KEY = "image_preview.copy_status.source_unavailable"
const IMAGE_COPY_FORMAT_KEY = "image_preview.copy_status.png_required"
const IMAGE_COPY_BLOCKED_KEY = "image_preview.copy_status.clipboard_blocked"
type ImageCopyFeedbackKey =
  | typeof IMAGE_COPY_SUCCESS_KEY
  | typeof IMAGE_COPY_LOADING_KEY
  | typeof IMAGE_COPY_CLIPBOARD_UNAVAILABLE_KEY
  | typeof IMAGE_COPY_SOURCE_KEY
  | typeof IMAGE_COPY_FORMAT_KEY
  | typeof IMAGE_COPY_BLOCKED_KEY

type CopyFeedback = {
  tone: "success" | "error"
  key: ImageCopyFeedbackKey
}

type PreviewableImageAttributes = JSX.ImgHTMLAttributes<HTMLImageElement> &
  Partial<Record<`data-${string}`, string | undefined>>
type PreviewImageLoader = () => string | Promise<string>
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
  triggerClass?: string
  imageClass?: string
  imageDataUI?: string
  imageAttributes?: PreviewableImageAttributes
  previewLoader?: PreviewImageLoader
}) {
  const alt = () => props.alt || ""
  const trigger = createMemo(() => imagePreviewTriggerContract({ src: props.src, alt: alt() }))
  const triggerClass = () => imagePreviewTriggerClass(props.triggerClass)
  const imageClass = () => ["md-img", props.imageClass].filter(Boolean).join(" ")
  const imageAttributes = () => props.imageAttributes ?? {}
  const delegatedPreview = () => !props.previewLoader
  const loadPreviewSource = async () => (props.previewLoader ? await props.previewLoader() : props.src)
  let pendingRequestRevision: number | null = null

  onCleanup(() => {
    if (pendingRequestRevision !== null) cancelImagePreviewRequest(pendingRequestRevision)
    pendingRequestRevision = null
  })

  async function handlePreviewOpen(event: MouseEvent): Promise<void> {
    event.preventDefault()
    event.stopPropagation()
    if (pendingRequestRevision !== null) cancelImagePreviewRequest(pendingRequestRevision)
    const requestRevision = beginImagePreviewRequest()
    pendingRequestRevision = requestRevision
    try {
      const src = await loadPreviewSource()
      if (pendingRequestRevision !== requestRevision) return
      openImagePreviewForRequest(requestRevision, src, alt())
    } catch (error) {
      if (!imagePreviewRequestIsCurrent(requestRevision)) return
      cancelImagePreviewRequest(requestRevision)
      if (isAbortError(error)) return
      reportError({
        title: t("image_preview.title"),
        message: t("image_preview.copy_status.source_unavailable"),
        details: formatErrorDetails(error),
      })
    } finally {
      if (pendingRequestRevision === requestRevision) pendingRequestRevision = null
    }
  }

  return (
    <Button
      type="button"
      variant={trigger().variant}
      size={trigger().size}
      tone={trigger().tone}
      class={triggerClass()}
      data-ui={trigger().dataUi}
      data-image-preview-trigger={delegatedPreview() ? trigger().triggerFlag : undefined}
      data-image-preview-src={delegatedPreview() ? trigger().src : undefined}
      data-image-preview-alt={delegatedPreview() ? trigger().alt : undefined}
      title={trigger().label}
      aria-label={trigger().label}
      onClick={(event) => void handlePreviewOpen(event)}
    >
      <img
        {...imageAttributes()}
        class={imageClass()}
        src={props.src}
        alt={alt()}
        loading="lazy"
        data-ui={props.imageDataUI}
      />
    </Button>
  )
}

export function ImagePreviewHost() {
  const [scale, setScale] = createSignal(1)
  const [imageSize, setImageSize] = createSignal<ImagePreviewSize>({ width: 0, height: 0 })
  const [bodyGeometry, setBodyGeometry] = createSignal<ImagePreviewBodyGeometry | null>(null)
  const [copyInFlight, setCopyInFlight] = createSignal(false)
  const [copyFeedback, setCopyFeedback] = createSignal<CopyFeedback | null>(null)
  const [panStart, setPanStart] = createSignal<{
    pointerID: number
    x: number
    y: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  let bodyRef: HTMLDivElement | undefined
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
    copyGeneration += 1
    setCopyInFlight(false)
    clearCopyFeedback()
    setPanStart(null)
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
      if (imageRef?.complete) measureLoadedImage(imageRef)
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
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }
    setImageSize(nextSize)
    setScale(calculateImagePreviewOpenScale(nextSize, readBodyGeometry()?.viewportSize ?? viewportSize()))
    requestAnimationFrame(() => {
      if (!bodyRef) return
      bodyRef.scrollLeft = 0
      bodyRef.scrollTop = 0
    })
  }

  function applyScale(nextScale: number, anchor?: { x: number; y: number }): void {
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
    const operationGeneration = ++copyGeneration
    const ownsOperation = () =>
      operationGeneration === copyGeneration &&
      imagePreviewState().open &&
      imagePreviewState().revision === preview.revision
    clearCopyFeedback()
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
      const blob = await fetchPreviewImageBlob(preview.src)
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

  function downloadPreviewImage(): void {
    const preview = imagePreviewState()
    if (!preview.src) return
    const download = document.createElement("a")
    download.href = preview.src
    download.download = preview.alt.split(/[\\/]/).pop()?.trim() || t("image_preview.title")
    download.rel = "noopener noreferrer"
    document.body.append(download)
    download.click()
    download.remove()
  }

  function handleWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    event.stopPropagation()
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
    if (!body || event.button !== 0 || event.isPrimary === false) return
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
      fullscreen
      draggable={false}
      headerActions={
        <>
          <Button
            class="image-preview-dialog__header-action"
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="icon-action"
            title={t("file.download")}
            aria-label={t("file.download")}
            onClick={downloadPreviewImage}
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
              <img
                class="image-preview-dialog__image"
                src={imagePreviewState().src}
                alt={imagePreviewState().alt}
                ref={(element) => {
                  imageRef = element
                }}
                onLoad={(event) => measureLoadedImage(event.currentTarget)}
              />
            </ContextMenu.Trigger>
            <ContextMenu.Portal mount={bodyRef}>
              <ContextMenu.Content
                class="image-preview-dialog__context-menu"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ContextMenu.Item disabled={copyInFlight()} closeOnSelect onSelect={() => void copyPreviewImage()}>
                  <Icon name="copy" size="compact" />
                  <span>{t("image_preview.copy_image")}</span>
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item closeOnSelect onSelect={setWidthScale}>
                  <Icon name="panel-right" size="compact" />
                  <span>{t("image_preview.fit_width")}</span>
                </ContextMenu.Item>
                <ContextMenu.Item closeOnSelect onSelect={setFitScale}>
                  <Icon name="maximize" size="compact" />
                  <span>{t("image_preview.fit_image")}</span>
                </ContextMenu.Item>
                <ContextMenu.Item closeOnSelect onSelect={setOriginalScale}>
                  <span class="image-preview-dialog__context-ratio" aria-hidden="true">
                    1:1
                  </span>
                  <span>{t("image_preview.original_size")}</span>
                </ContextMenu.Item>
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
    </Dialog>
  )
}
