import mermaid from "mermaid"
import { Show, createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { appliedColorScheme, observeAppliedTheme } from "../../services/theme"
import { ArtifactFrame } from "./ArtifactFrame"
import { randomUUID } from "../../utils/random-id"
import { artifactVisualTheme } from "./theme-color"
import { artifactExports, artifactFilename, type ArtifactExport } from "../../services/artifact-export"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"

type DiagramPayload = Extract<InteractiveArtifactPayload, { renderer: "diagram@1" }>

export function DiagramArtifact(props: { payload: DiagramPayload }) {
  let host: HTMLDivElement | undefined
  let stopThemeObserver: (() => void) | undefined
  let renderGeneration = 0
  let viewportFrame: number | undefined
  const [error, setError] = createSignal("")
  const [renderedSVG, setRenderedSVG] = createSignal<SVGSVGElement>()
  const [naturalSize, setNaturalSize] = createSignal(false)
  const dimensions = () => {
    const box = renderedSVG()?.viewBox.baseVal
    if (box && box.width > 0 && box.height > 0) return { width: box.width, height: box.height }
  }

  const toggleSize = () => {
    if (viewportFrame !== undefined) cancelAnimationFrame(viewportFrame)
    const natural = !naturalSize()
    setNaturalSize(natural)
    if (!natural || !host) return
    const target = host
    const generation = renderGeneration
    viewportFrame = requestAnimationFrame(() => {
      viewportFrame = undefined
      if (target !== host || !target.isConnected || generation !== renderGeneration || !naturalSize()) return
      target.scrollTo({ left: Math.max(0, (target.scrollWidth - target.clientWidth) / 2), top: 0 })
    })
  }

  const exportFiles = (): ArtifactExport[] => {
    const files = artifactExports(props.payload)
    const svg = renderedSVG()
    const size = dimensions()
    if (!svg || !size) return files
    const exported = svg.cloneNode(true) as SVGSVGElement
    exported.setAttribute("width", String(size.width))
    exported.setAttribute("height", String(size.height))
    exported.style.removeProperty("max-width")
    const background = getComputedStyle(svg).backgroundColor
    const color = background === "rgba(0, 0, 0, 0)"
      ? getComputedStyle(host!).backgroundColor
      : background
    const box = svg.viewBox.baseVal
    const backdrop = document.createElementNS(svg.namespaceURI, "rect")
    backdrop.setAttribute("x", String(box.x))
    backdrop.setAttribute("y", String(box.y))
    backdrop.setAttribute("width", String(size.width))
    backdrop.setAttribute("height", String(size.height))
    backdrop.setAttribute("style", `fill: ${color}; stroke: none;`)
    exported.style.backgroundColor = "transparent"
    exported.prepend(backdrop)
    files.push({
      filename: `${artifactFilename(props.payload.title)}.svg`,
      mime: "image/svg+xml;charset=utf-8",
      text: new XMLSerializer().serializeToString(exported),
    })
    return files
  }

  const render = () => {
    if (!host) return
    const generation = ++renderGeneration
    setRenderedSVG(undefined)
    host.replaceChildren()
    setError("")
    const dark = appliedColorScheme() === "dark"
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      theme: dark ? "dark" : "neutral",
      fontFamily: artifactVisualTheme(host).font,
      flowchart: { useMaxWidth: true },
    })
    const id = `artifact-diagram-${randomUUID().replaceAll("-", "")}`
    void mermaid
      .render(id, props.payload.source, host)
      .then(({ svg, bindFunctions }) => {
        if (!host || generation !== renderGeneration) return
        host.innerHTML = svg
        bindFunctions?.(host)
        setRenderedSVG(host.querySelector("svg") ?? undefined)
      })
      .catch((reason: unknown) => {
        if (generation !== renderGeneration) return
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  onMount(() => {
    stopThemeObserver = observeAppliedTheme(render)
  })

  onCleanup(() => {
    renderGeneration += 1
    if (viewportFrame !== undefined) cancelAnimationFrame(viewportFrame)
    stopThemeObserver?.()
  })

  return (
    <ArtifactFrame
      payload={props.payload}
      title={props.payload.title}
      kind="Diagram"
      exportFiles={exportFiles}
      copyText={() => props.payload.source}
      headerActions={
        <Show when={dimensions()}>
          <Button variant="ghost" size="sm" tone="neutral" onClick={toggleSize}>
            {naturalSize() ? t("artifact.diagram.fit_view") : t("artifact.diagram.actual_size")}
          </Button>
        </Show>
      }
    >
      <Show when={!error()} fallback={<div class="msg-artifact-render-error">{error()}</div>}>
        <div
          class="msg-artifact-diagram"
          role="region"
          aria-label={props.payload.title}
          tabIndex={0}
          data-natural-size={naturalSize() && dimensions() ? "true" : undefined}
          style={{
            "--diagram-natural-width": dimensions() ? `${dimensions()!.width}px` : undefined,
            "--diagram-natural-height": dimensions() ? `${dimensions()!.height}px` : undefined,
          }}
          ref={(element) => {
            host = element
          }}
        />
      </Show>
    </ArtifactFrame>
  )
}
