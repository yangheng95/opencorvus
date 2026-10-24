import * as pdfjs from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { EventBus, PDFLinkService } from "pdfjs-dist/web/pdf_viewer.mjs"
import { Show, batch, createEffect, createResource, createSignal, onCleanup } from "solid-js"
import { captureApiAuthority, fetchResourceAsObjectUrl } from "../services/api"
import { t } from "../utils/i18n"
import { formatErrorDetails } from "../utils/error-details"
import { createAnimationFrameScheduler, hasRunningLayoutAnimation } from "../utils/animation-frame"
import { externalUrl } from "../utils/external-url"
import { PDF_MIN_ZOOM, PDF_MAX_ZOOM, PdfDestinationError, pdfDestinationView } from "../utils/pdf-destination"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export function PdfPreview(props: { url: string; label: string; class?: string }) {
  let canvas: HTMLCanvasElement | undefined
  let pageHost: HTMLDivElement | undefined
  let textHost: HTMLDivElement | undefined
  let viewportHost: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | undefined
  const [page, setPage] = createSignal(1)
  const [pageCount, setPageCount] = createSignal(0)
  const [zoom, setZoom] = createSignal(1)
  const [viewportWidth, setViewportWidth] = createSignal(0)
  const [error, setError] = createSignal<unknown>()
  const [navigationError, setNavigationError] = createSignal<unknown>()
  const [currentDocument, setCurrentDocument] = createSignal<pdfjs.PDFDocumentProxy>()
  const [navigationRender, setNavigationRender] = createSignal(0)
  let sourceGeneration = 0
  let navigationSequence = 0
  let pendingNavigation: {
    document: pdfjs.PDFDocumentProxy
    sequence: number
    pageNumber: number
    destination: readonly unknown[]
    currentZoom: number
    currentPoint?: [number, number]
    events: EventBus
  } | undefined
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

  function changePage(value: number) {
    navigationSequence += 1
    pendingNavigation = undefined
    setNavigationError(undefined)
    batch(() => {
      setPage(value)
      setNavigationRender(navigationSequence)
    })
  }

  function changeZoom(value: number) {
    navigationSequence += 1
    pendingNavigation = undefined
    setNavigationError(undefined)
    batch(() => {
      setZoom(value)
      setNavigationRender(navigationSequence)
    })
  }

  function pageOffset() {
    const frame = pageHost!.getBoundingClientRect()
    const viewport = viewportHost!.getBoundingClientRect()
    return {
      left: viewportHost!.scrollLeft + frame.left - viewport.left - viewportHost!.clientLeft,
      top: viewportHost!.scrollTop + frame.top - viewport.top - viewportHost!.clientTop,
    }
  }

  function linkServiceFor(loaded: pdfjs.PDFDocumentProxy) {
    const service = new PDFLinkService({ eventBus: new EventBus() })
    service.setDocument(loaded)
    service.goToDestination = async (destination) => {
      const sequence = ++navigationSequence
      pendingNavigation = undefined
      setNavigationError(undefined)
      setNavigationRender(sequence)
      const generation = sourceGeneration
      const ownsNavigation = () => sequence === navigationSequence && generation === sourceGeneration && currentDocument() === loaded
      const events = new EventBus()
      const navigation = new PDFLinkService({ eventBus: events })
      let resolved = false
      // A resolver belongs to one click and one document, including its awaits.
      navigation.setDocument(loaded)
      navigation.setViewer({
        scrollPageIntoView({ pageNumber, destArray }: { pageNumber: number; destArray: readonly unknown[] }) {
          resolved = true
          void loaded.getPage(pageNumber).then((targetPage) => {
            if (!ownsNavigation() || !viewportHost || !pageHost) return
            const natural = targetPage.getViewport({ scale: 1 })
            const fitScale = Math.max(160, viewportWidth() - 24) / natural.width
            const offset = pageOffset()
            const currentPoint = pageNumber === page()
              ? targetPage.getViewport({ scale: fitScale * zoom() }).convertToPdfPoint(
                Math.max(0, viewportHost.scrollLeft - offset.left),
                Math.max(0, viewportHost.scrollTop - offset.top),
              ) as [number, number]
              : undefined
            // Validate before changing the visible page; the paint recomputes
            // geometry if the pane width changes while navigation is pending.
            pdfDestinationView({ destination: destArray, viewport: natural,
              availableWidth: Math.max(160, viewportWidth() - 24), availableHeight: Math.max(1, viewportHost.clientHeight - 24),
              fitScale, currentZoom: zoom(), currentPoint })
            pendingNavigation = { document: loaded, sequence, pageNumber, destination: destArray, currentZoom: zoom(), currentPoint, events }
            setNavigationError(undefined)
            batch(() => {
              setPage(pageNumber)
              setNavigationRender(sequence)
            })
          }).catch((reason) => { if (ownsNavigation()) setNavigationError(() => reason) })
        },
      })
      try {
        await navigation.goToDestination(destination)
        if (ownsNavigation() && !resolved) {
          setNavigationError(new PdfDestinationError("PDF destination could not be resolved"))
        }
      } catch (reason) {
        if (ownsNavigation()) setNavigationError(() => reason)
      }
    }
    return service
  }

  function bindViewport(element: HTMLDivElement) {
    resizeObserver?.disconnect()
    viewportHost = element
    resizeObserver = new ResizeObserver(([entry]) => {
      if (entry.target !== viewportHost) return
      if (!entry.contentRect.width) {
        restorePending = true
        return
      }
      if (!entry.contentRect.height) restorePending = true
      setViewportWidth(Math.floor(entry.contentRect.width))
      restoreReading.schedule()
    })
    resizeObserver.observe(element)
  }

  onCleanup(() => {
    navigationSequence += 1
    resizeObserver?.disconnect()
    restoreReading.cancel()
  })

  createEffect(() => {
    const url = source.loading || source.error ? undefined : source()
    const generation = ++sourceGeneration
    navigationSequence += 1
    pendingNavigation = undefined
    setNavigationError(undefined)
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
    textHost?.replaceChildren()
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
    const frame = pageHost
    const textTarget = textHost
    const pageNumber = page()
    const availableWidth = viewportWidth()
    const zoomFactor = zoom()
    navigationRender()
    const linkLabel = t("artifact.file.open_document_link")
    const navigation = pendingNavigation && pendingNavigation.document === loaded && pendingNavigation.pageNumber === pageNumber
      ? pendingNavigation : undefined
    if (!loaded || !target || !frame || !textTarget || pageCount() === 0 || availableWidth <= 0) return
    paintedWidth = 0
    textTarget.replaceChildren()
    if (renderedPage !== pageNumber) {
      renderedPage = pageNumber
      readingPosition = { top: 0, left: 0 }
      restorePending = true
    }
    let renderTask: pdfjs.RenderTask | undefined
    let textLayer: pdfjs.TextLayer | undefined
    const annotationTarget = document.createElement("div")
    annotationTarget.className = "msg-artifact-pdf__annotations"
    let disposed = false
    const ownsRender = () => !disposed && currentDocument() === loaded && page() === pageNumber
    void loaded
      .getPage(pageNumber)
      .then(async (pdfPage) => {
        if (!ownsRender()) return
        const natural = pdfPage.getViewport({ scale: 1 })
        const contentWidth = Math.max(160, availableWidth - 24)
        const destinationView = navigation && pdfDestinationView({
          destination: navigation.destination, viewport: natural, availableWidth: contentWidth,
          availableHeight: Math.max(1, viewportHost!.clientHeight - 24), fitScale: contentWidth / natural.width,
          currentZoom: navigation.currentZoom, currentPoint: navigation.currentPoint,
        })
        if (destinationView && Math.abs(destinationView.zoom - zoomFactor) > 0.000001) {
          setZoom(destinationView.zoom)
          return
        }
        const displayScale = (contentWidth / natural.width) * zoomFactor
        const displayViewport = pdfPage.getViewport({ scale: displayScale })
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = pdfPage.getViewport({ scale: displayScale * outputScale })
        const context = target.getContext("2d")
        if (!context) throw new Error("PDF canvas context is unavailable")
        target.width = Math.ceil(viewport.width)
        target.height = Math.ceil(viewport.height)
        frame.style.width = target.style.width = `${Math.ceil(displayViewport.width)}px`
        frame.style.height = target.style.height = `${Math.ceil(displayViewport.height)}px`
        textTarget.style.setProperty("--total-scale-factor", String(displayScale * pdfPage.userUnit))
        textLayer = new pdfjs.TextLayer({
          textContentSource: pdfPage.streamTextContent(),
          container: textTarget,
          viewport: displayViewport,
        })
        renderTask = pdfPage.render({ canvas: target, canvasContext: context, viewport })
        const renderLinks = async () => {
          const annotations = await pdfPage.getAnnotations({ intent: "display" })
          if (!ownsRender()) return
          const links = annotations.flatMap((annotation) => {
            if (annotation.annotationType !== pdfjs.AnnotationType.LINK) return []
            if (annotation.url) {
              try { return [{ ...annotation, url: externalUrl(annotation.url).href }] }
              catch { return [] }
            }
            return typeof annotation.dest === "string" || Array.isArray(annotation.dest) ? [annotation] : []
          })
          const linkService = linkServiceFor(loaded)
          const annotationViewport = displayViewport.clone({ dontFlip: true })
          annotationTarget.style.setProperty("--total-scale-factor", String(displayScale * pdfPage.userUnit))
          const layer = new pdfjs.AnnotationLayer({
            div: annotationTarget, page: pdfPage, viewport: annotationViewport, linkService,
            accessibilityManager: null, annotationCanvasMap: null, annotationEditorUIManager: null,
            structTreeLayer: null, commentManager: null, annotationStorage: null,
          })
          await layer.render({ annotations: links, viewport: annotationViewport, div: annotationTarget,
            page: pdfPage, linkService, renderForms: false, enableScripting: false })
          for (const anchor of annotationTarget.querySelectorAll<HTMLAnchorElement>("[data-internal-link] > a")) {
            anchor.setAttribute("aria-label", anchor.title || linkLabel)
          }
        }
        await Promise.all([renderTask.promise, textLayer.render(), renderLinks()])
        if (!ownsRender()) return
        frame.append(annotationTarget)
        target.dataset.ready = "true"
        paintedWidth = availableWidth
        if (navigation && navigation === pendingNavigation && navigation.sequence === navigationSequence) {
          navigation.events.dispatch("textlayerrendered", { pageNumber, source: { textLayer: { div: textTarget } } })
          const rect = destinationView!.rect
          const offset = pageOffset()
          const coordinates = rect && displayViewport.convertToViewportRectangle(rect)
          readingPosition = coordinates ? {
            left: Math.max(0, offset.left + Math.min(coordinates[0], coordinates[2])),
            top: Math.max(0, offset.top + Math.min(coordinates[1], coordinates[3])),
          } : { top: 0, left: 0 }
          restorePending = true
          pendingNavigation = undefined
        }
        restoreReading.schedule()
      })
      .catch((reason: unknown) => {
        if (disposed || (reason instanceof Error && reason.name === "RenderingCancelledException")) return
        renderTask?.cancel()
        textLayer?.cancel()
        setError(() => reason)
      })
    onCleanup(() => {
      disposed = true
      renderTask?.cancel()
      textLayer?.cancel()
      annotationTarget.remove()
      textTarget.replaceChildren()
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
        <div>
          <div class="msg-artifact-file__toolbar">
            <div class="msg-artifact-file__page-controls">
              <Button
                variant="ghost"
                size="sm"
                tone="neutral"
                disabled={page() <= 1}
                onClick={() => changePage(Math.max(1, page() - 1))}
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
                onClick={() => changePage(Math.min(pageCount(), page() + 1))}
              >
                {t("artifact.file.next")}
              </Button>
            </div>
            <div class="msg-artifact-file__zoom-controls">
              <Button
                variant="ghost"
                size="sm"
                tone="neutral"
                disabled={zoom() <= PDF_MIN_ZOOM}
                onClick={() => changeZoom(Math.max(PDF_MIN_ZOOM, zoom() - 0.25))}
              >
                {t("artifact.file.zoom_out")}
              </Button>
              <Button variant="ghost" size="sm" tone="neutral" onClick={() => changeZoom(1)}>
                {t("artifact.file.fit_width")}
              </Button>
              <span>{Math.round(zoom() * 100)}%</span>
              <Button
                variant="ghost"
                size="sm"
                tone="neutral"
                disabled={zoom() >= PDF_MAX_ZOOM}
                onClick={() => changeZoom(Math.min(PDF_MAX_ZOOM, zoom() + 0.25))}
              >
                {t("artifact.file.zoom_in")}
              </Button>
            </div>
          </div>
          <Show when={navigationError()}>
            <Feedback tone="error" details={formatErrorDetails(navigationError())}>
              {t("artifact.file.link_failed")}
            </Feedback>
          </Show>
        </div>
        <div
          class="msg-artifact-pdf"
          onScroll={rememberReading}
          ref={(element) => {
            bindViewport(element)
          }}
        >
          <div
            class="msg-artifact-pdf__page"
            ref={(element) => {
              pageHost = element
            }}
          >
            <canvas
              role="img"
              aria-label={props.label}
              ref={(element) => {
                canvas = element
              }}
            />
            <div
              class="msg-artifact-pdf__text-layer"
              tabIndex={-1}
              aria-label={props.label}
              ref={(element) => {
                textHost = element
              }}
            />
          </div>
        </div>
      </div>
    </Show>
  )
}
