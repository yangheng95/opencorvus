import vegaEmbed, { type EmbedOptions, type Result as VegaEmbedResult } from "vega-embed"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { ArtifactFrame } from "./ArtifactFrame"
import { artifactVegaConfig, artifactVisualTheme } from "./theme-color"

type DashboardPayload = Extract<InteractiveArtifactPayload, { renderer: "dashboard@1" }>
type DashboardViewPayload = DashboardPayload["views"][number]
type DashboardRow = DashboardPayload["data"][number]

const rejectExternalResource = async (uri: string): Promise<never> => {
  throw new Error(`External dashboard resources are disabled: ${uri}`)
}

const inlineOnlyLoader: NonNullable<EmbedOptions["loader"]> = {
  load: rejectExternalResource,
  sanitize: rejectExternalResource,
  http: rejectExternalResource,
  file: rejectExternalResource,
}

const MAX_DASHBOARD_WIDTH = 1_600
const MIN_DASHBOARD_PLOT_WIDTH = 240
const VEGA_AXIS_AND_ACTIONS_WIDTH = 128

function DashboardView(props: { view: DashboardViewPayload; data: DashboardRow[] }) {
  let host: HTMLDivElement | undefined
  let result: VegaEmbedResult | undefined
  let stopThemeObserver: (() => void) | undefined
  let resizeObserver: ResizeObserver | undefined
  let intersectionObserver: IntersectionObserver | undefined
  let generation = 0
  let rendering = false
  let renderPending = false
  let renderedWidth = 0
  const [error, setError] = createSignal("")
  const availableWidth = () =>
    Math.min(Math.floor(host?.parentElement?.clientWidth ?? host?.clientWidth ?? 0), MAX_DASHBOARD_WIDTH)

  const render = () => {
    if (!host) return
    const width = availableWidth()
    if (width <= 0) {
      renderPending = true
      return
    }
    if (rendering) {
      renderPending = true
      return
    }
    rendering = true
    const current = ++generation
    const data = props.data
    renderedWidth = width
    result?.finalize()
    result = undefined
    delete host.dataset.ready
    host.replaceChildren()
    setError("")
    const theme = artifactVisualTheme(host)
    const source = props.view.spec as Record<string, unknown>
    const sourceConfig =
      source.config && typeof source.config === "object" && !Array.isArray(source.config)
        ? (source.config as Record<string, unknown>)
        : {}
    void vegaEmbed(
      host,
      {
        ...source,
        data: { values: data },
        width: source.width ?? Math.max(MIN_DASHBOARD_PLOT_WIDTH, width - VEGA_AXIS_AND_ACTIONS_WIDTH),
        height: source.height ?? 260,
        background: source.background ?? "transparent",
        config: artifactVegaConfig(theme, sourceConfig),
      } as unknown as Parameters<typeof vegaEmbed>[1],
      {
        actions: { export: true, source: false, compiled: false, editor: false },
        mode: "vega-lite",
        renderer: "svg",
        tooltip: true,
        loader: inlineOnlyLoader,
      },
    )
      .then((next) => {
        if (generation !== current) {
          next.finalize()
          return
        }
        result = next
        if (host) host.dataset.ready = "true"
      })
      .catch((reason: unknown) => {
        if (generation === current) setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => {
        rendering = false
        if (!renderPending) return
        renderPending = false
        queueMicrotask(render)
      })
  }

  createEffect(() => {
    props.data
    queueMicrotask(render)
  })
  onMount(() => {
    stopThemeObserver = observeAppliedTheme(render)
    resizeObserver = new ResizeObserver(() => {
      if (!host || Math.abs(availableWidth() - renderedWidth) <= 2) return
      queueMicrotask(render)
    })
    if (host?.parentElement) resizeObserver.observe(host.parentElement)
    intersectionObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      queueMicrotask(render)
    })
    if (host) intersectionObserver.observe(host)
  })
  onCleanup(() => {
    generation += 1
    renderPending = false
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    stopThemeObserver?.()
    result?.finalize()
  })

  return (
    <section class="msg-artifact-dashboard__view" data-span={props.view.span} aria-label={props.view.title}>
      <h4>{props.view.title}</h4>
      <Show when={!error()} fallback={<div class="msg-artifact-render-error">{error()}</div>}>
        <div
          class="msg-artifact-dashboard__chart msg-artifact-vega"
          ref={(element) => {
            host = element
          }}
        />
      </Show>
    </section>
  )
}

export function DashboardArtifact(props: { payload: DashboardPayload }) {
  const [filters, setFilters] = createSignal<Record<string, DashboardRow[string] | undefined>>({})
  const filtered = createMemo(() =>
    props.payload.data.filter((row) =>
      props.payload.filters.every((filter) => {
        const selected = filters()[filter.id]
        return selected === undefined || Object.is(row[filter.field], selected)
      }),
    ),
  )

  return (
    <ArtifactFrame title={props.payload.title} kind="Dashboard">
      <div class="msg-artifact-dashboard">
        <Show when={props.payload.metrics.length}>
          <div class="msg-artifact-dashboard__metrics">
            <For each={props.payload.metrics}>
              {(metric) => (
                <div class="msg-artifact-dashboard__metric" data-metric-id={metric.id}>
                  <span>{metric.label}</span>
                  <strong>
                    {metric.value}
                    {metric.unit ? ` ${metric.unit}` : ""}
                  </strong>
                  <Show when={metric.delta !== undefined}>
                    <small data-direction={metric.delta! < 0 ? "down" : "up"}>
                      {metric.delta! > 0 ? "+" : ""}
                      {new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(
                        metric.delta!,
                      )}
                    </small>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={props.payload.filters.length}>
          <div class="msg-artifact-dashboard__filters">
            <For each={props.payload.filters}>
              {(filter) => (
                <label>
                  <span>{filter.label}</span>
                  <select
                    data-filter-id={filter.id}
                    onChange={(event) => {
                      const next = Number(event.currentTarget.value)
                      setFilters((current) => ({
                        ...current,
                        [filter.id]: next < 0 ? undefined : filter.values[next],
                      }))
                    }}
                  >
                    <option value="-1">All</option>
                    <For each={filter.values}>{(value, index) => <option value={index()}>{String(value)}</option>}</For>
                  </select>
                </label>
              )}
            </For>
          </div>
        </Show>
        <div class="msg-artifact-dashboard__views">
          <For each={props.payload.views}>{(view) => <DashboardView view={view} data={filtered()} />}</For>
        </div>
      </div>
    </ArtifactFrame>
  )
}
