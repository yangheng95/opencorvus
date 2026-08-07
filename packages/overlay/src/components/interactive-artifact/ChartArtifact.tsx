import vegaEmbed, { type EmbedOptions, type Result as VegaEmbedResult } from "vega-embed"
import { Show, createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { ArtifactFrame } from "./ArtifactFrame"
import { artifactVegaConfig, artifactVisualTheme } from "./theme-color"

type ChartPayload = Extract<InteractiveArtifactPayload, { renderer: "chart@1" }>

const rejectExternalResource = async (uri: string): Promise<never> => {
  throw new Error(`External chart resources are disabled: ${uri}`)
}

const inlineOnlyLoader: NonNullable<EmbedOptions["loader"]> = {
  load: rejectExternalResource,
  sanitize: rejectExternalResource,
  http: rejectExternalResource,
  file: rejectExternalResource,
}

export function ChartArtifact(props: { payload: ChartPayload }) {
  let host: HTMLDivElement | undefined
  let view: VegaEmbedResult | undefined
  let stopThemeObserver: (() => void) | undefined
  let resizeObserver: ResizeObserver | undefined
  let renderGeneration = 0
  let renderedWidth = 0
  let renderedHeight = 0
  let renderFrame: number | undefined
  const [error, setError] = createSignal("")

  const scheduleRender = () => {
    if (renderFrame !== undefined) return
    renderFrame = requestAnimationFrame(() => {
      renderFrame = undefined
      render()
    })
  }

  const render = () => {
    if (!host) return
    const width = Math.floor(host.clientWidth)
    const height = Math.floor(host.clientHeight)
    if (width <= 0 || height <= 0) return
    const generation = ++renderGeneration
    renderedWidth = width
    renderedHeight = height
    view?.finalize()
    view = undefined
    host.replaceChildren()
    setError("")
    const theme = artifactVisualTheme(host)
    const source = props.payload.spec as Record<string, unknown>
    const sourceConfig =
      source.config && typeof source.config === "object" && !Array.isArray(source.config)
        ? (source.config as Record<string, unknown>)
        : {}
    const spec = {
      ...source,
      data: { values: props.payload.data },
      width: source.width ?? Math.max(240, width - 40),
      height: source.height ?? Math.max(220, height - 36),
      background: source.background ?? "transparent",
      config: artifactVegaConfig(theme, sourceConfig),
    }
    void vegaEmbed(host, spec as unknown as Parameters<typeof vegaEmbed>[1], {
      actions: { export: true, source: false, compiled: false, editor: false },
      mode: "vega-lite",
      renderer: "svg",
      tooltip: true,
      loader: inlineOnlyLoader,
    })
      .then((result) => {
        if (generation !== renderGeneration) {
          result.finalize()
          return
        }
        view = result
      })
      .catch((reason: unknown) => {
        if (generation !== renderGeneration) return
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  onMount(() => {
    stopThemeObserver = observeAppliedTheme(render)
    resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)
      if (Math.abs(width - renderedWidth) <= 2 && Math.abs(height - renderedHeight) <= 2) return
      scheduleRender()
    })
    if (host) resizeObserver.observe(host)
  })

  onCleanup(() => {
    renderGeneration += 1
    resizeObserver?.disconnect()
    stopThemeObserver?.()
    if (renderFrame !== undefined) cancelAnimationFrame(renderFrame)
    view?.finalize()
    view = undefined
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Chart">
      <Show when={!error()} fallback={<div class="msg-artifact-render-error">{error()}</div>}>
        <div
          class="msg-artifact-chart msg-artifact-vega msg-artifact-chart--vega"
          ref={(element) => {
            host = element
          }}
        />
      </Show>
    </ArtifactFrame>
  )
}
