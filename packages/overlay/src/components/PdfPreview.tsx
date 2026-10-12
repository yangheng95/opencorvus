import * as pdfjs from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { Show, createEffect, createResource, createSignal, onCleanup } from "solid-js"
import { captureApiAuthority, fetchResourceAsObjectUrl } from "../services/api"
import { t } from "../utils/i18n"
import { formatErrorDetails } from "../utils/error-details"
import { createAnimationFrameScheduler, hasRunningLayoutAnimation } from "../utils/animation-frame"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export function PdfPreview(props: { url: string; label: string; class?: string }) {
  let canvas: HTMLCanvasElement | undefined
  let viewportHost: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | undefined
  const [page, setPage] = createSignal(1)
  const [pageCount, setPageCount] = createSignal(0)
  const [zoom, setZoom] = createSignal(1)
  const [viewportWidth, setViewportWidth] = createSignal(0)
  const [error, setError] = createSignal<unknown>()
  const [currentDocument, setCurrentDocument] = createSignal<pdfjs.PDFDocumentProxy>()
  let sourceGeneration = 0
  let readingPosition = { top: 0, left: 0 }
  let restorePending = false
  let renderedPage = 0
  let paintedWidth = 0
  const restoreReading = createAnimationFrameScheduler(() => {
    const viewport = viewportHost
    if (!restorePending || !viewport?.clientWidth || !viewport.clientHeight || viewport.closest("[inert], [hidden]")) return
    if (hasRunningLayoutAnimation(viewport)) {
      restoreReading.schedule()
      return
    }
    if (!currentDocument() || paintedWidth !== viewportWidth()) return
    viewport.scrollTop = readingPosition.top
    viewport.scrollLeft = readingPosition.left
    restorePending = false
  })

  const rememberReading = () => {
    const viewport = viewportHost
    if (restorePending || !viewport?.clientWidth || !viewport.clientHeight ||
      viewport.closest("[inert], [hidden]") || hasRunningLayoutAnimation(viewport)) return
    readingPosition = { top: viewport.scrollTop, left: viewport.scrollLeft }
  }
  const [source] = createResource(
    () => ({
      url: props.url,
      authority: props.url.startsWith("/") ? captureApiAuthority() : undefined,
    }),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
  )

  function bindViewport(element: HTMLDivElement) {
    resizeObserver?.disconnect()
    viewportHost = element
    resizeObserver = new ResizeObserver(([entry]) => {
      if (entry.target !== viewportHost) return
      if (!entry.contentRect.width || !entry.contentRect.height) {
        restorePending = true
        return
      }
      setViewportWidth(Math.floor(entry.contentRect.width))
      restoreReading.schedule()
    })
    resizeObserver.observe(element)
  }

  onCleanup(() => {
    resizeObserver?.disconnect()
    restoreReading.cancel()
  })

  createEffect(() => {
    const url = source.loading || source.error ? undefined : source()
    const generation = ++sourceGeneration
    readingPosition = { top: 0, left: 0 }
    restorePending = false
    renderedPage = 0
    paintedWidth = 0
    restoreReading.cancel()
    setCurrentDocument(undefined)
    setPage(1)
    setPageCount(0)
    setError(undefined)
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
    if (!url) return
    const loadingTask = pdfjs.getDocument(url)
    let loadedDocument: pdfjs.PDFDocumentProxy | undefined
    void loadingTask.promise
      .then((loaded) => {
        if (generation !== sourceGeneration) {
          void loaded.destroy()
          return
        }
        loadedDocument = loaded
        setCurrentDocument(loaded)
        setPageCount(loaded.numPages)
      })
      .catch((reason: unknown) => {
        if (generation !== sourceGeneration || (reason instanceof Error && reason.name === "AbortException")) return
        setError(() => reason)
      })
    onCleanup(() => {
      if (generation === sourceGeneration) sourceGeneration += 1
      setCurrentDocument((current) => (current === loadedDocument ? undefined : current))
      void loadingTask.destroy()
    })
  })

  createEffect(() => {
    const loaded = currentDocument()
    const target = canvas
    const pageNumber = page()
    const availableWidth = viewportWidth()
    const zoomFactor = zoom()
    if (!loaded || !target || pageCount() === 0 || availableWidth <= 0) return
    paintedWidth = 0
    if (renderedPage !== pageNumber) {
      renderedPage = pageNumber
      readingPosition = { top: 0, left: 0 }
      restorePending = true
    }
    let renderTask: pdfjs.RenderTask | undefined
    let disposed = false
    void loaded
      .getPage(pageNumber)
      .then(async (pdfPage) => {
        if (disposed || currentDocument() !== loaded || page() !== pageNumber) return
        const natural = pdfPage.getViewport({ scale: 1 })
        const contentWidth = Math.max(160, availableWidth - 24)
        const displayScale = (contentWidth / natural.width) * zoomFactor
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = pdfPage.getViewport({ scale: displayScale * outputScale })
        const context = target.getContext("2d")
        if (!context) throw new Error("PDF canvas context is unavailable")
        target.width = Math.ceil(viewport.width)
        target.height = Math.ceil(viewport.height)
        target.style.width = `${Math.ceil(natural.width * displayScale)}px`
        target.style.height = `${Math.ceil(natural.height * displayScale)}px`
        renderTask = pdfPage.render({ canvas: target, canvasContext: context, viewport })
        await renderTask.promise
        if (disposed || currentDocument() !== loaded || page() !== pageNumber) return
        target.dataset.ready = "true"
        paintedWidth = availableWidth
        restoreReading.schedule()
      })
      .catch((reason: unknown) => {
        if (disposed || (reason instanceof Error && reason.name === "RenderingCancelledException")) return
        setError(() => reason)
      })
    onCleanup(() => {
      disposed = true
      renderTask?.cancel()
    })
  })

  return (
    <Show
      when={!source.error && !error()}
      fallback={
        <Feedback class="msg-artifact-render-error" tone="error" title={t("file_editor.load_failed")}
          details={formatErrorDetails(error() ?? source.error) || undefined}>
          {t("file_editor.load_failed_hint")}
        </Feedback>
      }
    >
      <div class={["msg-artifact-file__pdf-preview", props.class].filter(Boolean).join(" ")}>
        <div class="msg-artifact-file__toolbar">
          <div class="msg-artifact-file__page-controls">
            <Button
              variant="ghost"
              size="sm"
              tone="neutral"
              disabled={page() <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              {t("artifact.file.previous")}
            </Button>
            <span>
              {page()} / {pageCount() || "…"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              tone="neutral"
              disabled={!pageCount() || page() >= pageCount()}
              onClick={() => setPage((value) => Math.min(pageCount(), value + 1))}
            >
              {t("artifact.file.next")}
            </Button>
          </div>
          <div class="msg-artifact-file__zoom-controls">
            <Button
              variant="ghost"
              size="sm"
              tone="neutral"
              disabled={zoom() <= 0.5}
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
            >
              {t("artifact.file.zoom_out")}
            </Button>
            <Button variant="ghost" size="sm" tone="neutral" onClick={() => setZoom(1)}>
              {t("artifact.file.fit_width")}
            </Button>
            <span>{Math.round(zoom() * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              tone="neutral"
              disabled={zoom() >= 2.5}
              onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
            >
              {t("artifact.file.zoom_in")}
            </Button>
          </div>
        </div>
        <div
          class="msg-artifact-pdf"
          onScroll={rememberReading}
          ref={(element) => {
            bindViewport(element)
          }}
        >
          <canvas
            role="img"
            aria-label={props.label}
            ref={(element) => {
              canvas = element
            }}
          />
        </div>
      </div>
    </Show>
  )
}
