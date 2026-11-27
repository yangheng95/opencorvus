import vegaEmbed, { type Result } from "vega-embed"
import { isEqual, normalize, type TopLevelSpec } from "vega-lite"
import { createEffect, onCleanup, onMount } from "solid-js"
import { observeAppliedTheme } from "../../services/theme"
import { artifactVegaConfig, artifactVisualTheme } from "./theme-color"
import { INLINE_VEGA_EMBED_OPTIONS } from "./vega-embed-policy"
import { localeTag, t } from "../../utils/i18n"

type Size = { width: number; height: number }
type ViewState = ReturnType<Result["view"]["getState"]> & { subcontext?: ViewState[] }

function interactionChanges(state: ViewState, initial: ViewState): ViewState {
  return {
    ...state,
    signals: Object.fromEntries(Object.entries(state.signals ?? {}).filter(([name, value]) => {
      const baseline = initial.signals?.[name]
      // Replaying an unchanged empty gesture object emits a change event;
      // its dependent pan expression may have no anchor yet. Compare shallowly
      // so native runtime objects with cycles are never traversed.
      return !(Object.is(value, baseline) || (
        value && baseline && typeof value === "object" && typeof baseline === "object"
        && ((Array.isArray(value) && Array.isArray(baseline)) || (
          Object.getPrototypeOf(value) === Object.prototype && Object.getPrototypeOf(baseline) === Object.prototype
        )) && isEqual(value as Record<string, unknown>, baseline as Record<string, unknown>)
      ))
    })),
    subcontext: state.subcontext?.map((child, index) => {
      const baseline = initial.subcontext?.[index]
      return baseline ? interactionChanges(child, baseline) : child
    }),
  }
}

function interactionState(result: Result): ViewState {
  // Restored data is not marked modified by Vega; capture all native array
  // inputs declared by the compiled spec, excluding runtime scenegraph data.
  const names = new Set<string>()
  function collect(scope: Pick<Result["vgSpec"], "data" | "marks">) {
    scope.data?.forEach(dataset => names.add(dataset.name))
    scope.marks?.forEach(mark => {
      if (mark.type === "group") collect(mark)
    })
  }
  collect(result.vgSpec)
  const view = result.view
  const state: ViewState = view.getState()
  const inputs: ViewState = view.getState({
    data: (name, dataset) => name !== undefined && names.has(name) && Array.isArray(dataset.input.value),
    recurse: true,
  })
  function merge(signals: ViewState, data: ViewState): ViewState {
    return {
      ...signals,
      data: data.data,
      subcontext: signals.subcontext?.map((child, index) => merge(child, data.subcontext![index]!)),
    }
  }
  return merge(state, inputs)
}

/** One native View owns interaction; layout only updates its existing dataflow. */
export function createInlineVegaView(input: {
  host: () => HTMLDivElement | undefined
  observed: () => Element | undefined
  source: () => Record<string, unknown>
  data: () => Record<string, unknown>[]
  measure: () => Size
  error: (message: string) => void
  ready?: (host: HTMLElement, ready: boolean) => void
}) {
  let current: Result | undefined
  let source: Record<string, unknown> | undefined
  let data: Record<string, unknown>[] | undefined
  let size: Size | undefined
  let disposed = false
  let repaint = true
  let running = false
  let pending = false
  let frame: number | undefined
  let resize: ResizeObserver | undefined
  let intersection: IntersectionObserver | undefined
  let stopTheme: (() => void) | undefined

  function schedule() {
    if (disposed) return
    pending = true
    if (running || frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      void update()
    })
  }

  async function update() {
    if (disposed || running || !pending) return
    pending = false
    const host = input.host()
    if (!host) return
    input.error("")
    const measured = input.measure()
    if (measured.width <= 0 || measured.height <= 0) return
    const nextSource = input.source(), nextData = input.data()
    running = true
    try {
      // Only unit/layer plots support container dimensions. A composed plot's
      // width/height signals can belong to its children (including their brushes).
      const normalized = normalize(nextSource as unknown as TopLevelSpec)
      const containerSized = "mark" in normalized || "layer" in normalized
      if (!current || repaint || source !== nextSource || data !== nextData) {
        const state = current && source === nextSource && data === nextData ? interactionState(current) : undefined
        repaint = false
        current?.finalize()
        current = undefined
        input.ready?.(host, false)
        host.replaceChildren()
        const config = nextSource.config
        const next = await vegaEmbed(host, {
          ...nextSource,
          data: { values: nextData },
          ...(containerSized ? {
            width: nextSource.width ?? measured.width,
            height: nextSource.height ?? measured.height,
          } : {}),
          background: nextSource.background ?? "transparent",
          config: artifactVegaConfig(artifactVisualTheme(host),
            config && typeof config === "object" && !Array.isArray(config) ? config as Record<string, unknown> : {}),
        } as unknown as Parameters<typeof vegaEmbed>[1], {
          ...INLINE_VEGA_EMBED_OPTIONS,
          i18n: {
            CLICK_TO_VIEW_ACTIONS: t("artifact.chart.actions"),
            SVG_ACTION: t("artifact.chart.save_svg"),
            PNG_ACTION: t("artifact.chart.save_png"),
          },
        })
        if (disposed) {
          next.finalize()
          return
        }
        current = next
        source = nextSource
        data = nextData
        if (state) {
          current.view.setState(interactionChanges(state, current.view.getState()))
          await current.view.runAsync()
        }
      }
      // A pending layout may have changed while the renderer was loading.
      size = input.measure()
      if (size.width <= 0 || size.height <= 0) return
      if (containerSized && (nextSource.width === undefined || nextSource.width === "container")) current.view.width(size.width)
      if (containerSized && (nextSource.height === undefined || nextSource.height === "container")) current.view.height(size.height)
      await current.view.resize().runAsync()
      if (!disposed) input.ready?.(host, true)
    } catch (reason) {
      current?.finalize()
      current = undefined
      if (!disposed) input.error(reason instanceof Error ? reason.message : String(reason))
    } finally {
      running = false
      if (pending) schedule()
    }
  }

  createEffect(() => {
    input.source()
    input.data()
    schedule()
  })
  createEffect(() => {
    localeTag()
    repaint = true
    schedule()
  })
  onMount(() => {
    stopTheme = observeAppliedTheme(() => {
      repaint = true
      schedule()
    })
    resize = new ResizeObserver(() => {
      const next = input.measure()
      if (!size || Math.abs(next.width - size.width) > 2 || Math.abs(next.height - size.height) > 2) schedule()
    })
    const observed = input.observed()
    if (observed) resize.observe(observed)
    intersection = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) schedule()
    })
    const host = input.host()
    if (host) intersection.observe(host)
  })
  onCleanup(() => {
    disposed = true
    pending = false
    if (frame !== undefined) cancelAnimationFrame(frame)
    resize?.disconnect()
    intersection?.disconnect()
    stopTheme?.()
    current?.finalize()
    current = undefined
  })
}
