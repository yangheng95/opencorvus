import * as pdfjs from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { Match, Show, Switch, createEffect, createResource, createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { fetchResourceAsObjectUrl } from "../../services/api"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { CodeEditor } from "../ui/CodeEditor"
import { ArtifactFrame } from "./ArtifactFrame"

type FilePreviewPayload = Extract<InteractiveArtifactPayload, { renderer: "file-preview@1" }>

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

async function loadText(url: string): Promise<string> {
  const objectUrl = await fetchResourceAsObjectUrl(url)
  const response = await fetch(objectUrl)
  if (!response.ok) throw new Error(`Text preview failed with HTTP ${response.status}`)
  return response.text()
}

function TextPreview(props: { payload: FilePreviewPayload }) {
  const [text] = createResource(() => props.payload.source.url, loadText)
  return (
    <Show when={!text.error} fallback={<div class="msg-artifact-render-error">{String(text.error)}</div>}>
      <Show when={text()} fallback={<div class="msg-artifact-file__loading">{t("artifact.file.loading_text")}</div>}>
        {(source) => (
          <CodeEditor
            class="msg-artifact-code"
            value={source()}
            path={props.payload.source.filename ?? "artifact.txt"}
            ariaLabel={props.payload.title}
            readOnly
            onValueChange={() => undefined}
          />
        )}
      </Show>
    </Show>
  )
}

function PdfPreview(props: { payload: FilePreviewPayload }) {
  let canvas: HTMLCanvasElement | undefined
  let viewportHost: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | undefined
  const [page, setPage] = createSignal(1)
  const [pageCount, setPageCount] = createSignal(0)
  const [zoom, setZoom] = createSignal(1)
  const [viewportWidth, setViewportWidth] = createSignal(0)
  const [error, setError] = createSignal("")
  const [currentDocument, setCurrentDocument] = createSignal<pdfjs.PDFDocumentProxy>()
  let sourceGeneration = 0
  const [source] = createResource(
    () => props.payload.source.url,
    (url) => fetchResourceAsObjectUrl(url),
  )

  onMount(() => {
    if (!viewportHost) return
    resizeObserver = new ResizeObserver(([entry]) => setViewportWidth(Math.floor(entry.contentRect.width)))
    resizeObserver.observe(viewportHost)
  })

  onCleanup(() => resizeObserver?.disconnect())

  createEffect(() => {
    const url = source()
    const generation = ++sourceGeneration
    setCurrentDocument(undefined)
    setPage(1)
    setPageCount(0)
    setError("")
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
        if (generation !== sourceGeneration || reason instanceof Error && reason.name === "AbortException") return
        setError(reason instanceof Error ? reason.message : String(reason))
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
        target.dataset.ready = "true"
      })
      .catch((reason: unknown) => {
        if (disposed || reason instanceof Error && reason.name === "RenderingCancelledException") return
        setError(reason instanceof Error ? reason.message : String(reason))
      })
    onCleanup(() => {
      disposed = true
      renderTask?.cancel()
    })
  })

  return (
    <Show
      when={!source.error && !error()}
      fallback={<div class="msg-artifact-render-error">{error() || String(source.error)}</div>}
    >
      <div class="msg-artifact-file__pdf-preview">
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
          ref={(element) => {
            viewportHost = element
          }}
        >
          <canvas
            ref={(element) => {
              canvas = element
            }}
          />
        </div>
      </div>
    </Show>
  )
}

export function FilePreviewArtifact(props: { payload: FilePreviewPayload }) {
  return (
    <ArtifactFrame title={props.payload.title} kind="File">
      <Switch>
        <Match when={props.payload.kind === "pdf"}>
          <PdfPreview payload={props.payload} />
        </Match>
        <Match when={props.payload.kind === "text"}>
          <TextPreview payload={props.payload} />
        </Match>
      </Switch>
    </ArtifactFrame>
  )
}
