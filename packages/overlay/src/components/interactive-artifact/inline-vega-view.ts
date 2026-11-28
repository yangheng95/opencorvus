import vegaEmbed, { vega, type Result } from "vega-embed"
import { isEqual, normalize, type TopLevelSpec } from "vega-lite"
import { createEffect, createUniqueId, onCleanup, onMount } from "solid-js"
import { observeAppliedTheme } from "../../services/theme"
import { artifactVegaLocale } from "../../services/artifact-vega-locale"
import { artifactVisualTheme, type ArtifactVisualTheme } from "./theme-color"
import { INLINE_VEGA_EMBED_OPTIONS } from "./vega-embed-policy"
import { localeTag, sanitizeLocale, t } from "../../utils/i18n"
import { topLayerPortalMount } from "../../utils/top-layer"

type Size = { width: number; height: number }
type ViewState = ReturnType<Result["view"]["getState"]> & { subcontext?: ViewState[] }

function artifactVegaConfig(
  theme: ArtifactVisualTheme,
  source: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaults = {
    locale: artifactVegaLocale(sanitizeLocale(localeTag())),
    autosize: { type: "fit", contains: "padding" },
    background: theme.surface,
    font: theme.font,
    range: { category: theme.palette },
    axis: {
      domain: false,
      gridColor: theme.border,
      gridOpacity: 0.58,
      labelColor: theme.muted,
      labelFont: theme.font,
      labelFontSize: 11,
      labelPadding: 8,
      tickColor: theme.border,
      tickSize: 4,
      titleColor: theme.muted,
      titleFont: theme.font,
      titleFontSize: 11,
      titleFontWeight: 500,
      titlePadding: 12,
    },
    legend: {
      labelColor: theme.muted,
      labelFont: theme.font,
      labelFontSize: 11,
      symbolSize: 70,
      titleColor: theme.textStrong,
      titleFont: theme.font,
      titleFontSize: 11,
      titleFontWeight: 600,
    },
    line: { strokeWidth: 2.5 },
    point: { filled: true, size: 64 },
    bar: { cornerRadiusTopLeft: 4, cornerRadiusTopRight: 4 },
    text: { color: theme.text },
    title: {
      anchor: "start",
      color: theme.textStrong,
      subtitleColor: theme.muted,
      font: theme.font,
      fontSize: 14,
      fontWeight: 600,
      offset: 14,
    },
    view: { stroke: "transparent" },
  }
  return vega.mergeConfig<Record<string, unknown>>(defaults, source)
}

function interactionChanges(state: ViewState, initial: ViewState, root = true): ViewState {
  return {
    ...state,
    signals: Object.fromEntries(Object.entries(state.signals ?? {}).filter(([name, value]) => {
      // Autosize stores fitted plot dimensions here. The new View's canvas
      // dimensions and background belong to its current spec/container/theme,
      // not the old snapshot.
      if (root && (name === "width" || name === "height" || name === "background")) return false
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
      return baseline ? interactionChanges(child, baseline, false) : child
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
  const tooltipID = `artifact-vega-tooltip-${createUniqueId()}`
  let tooltip: HTMLDivElement | undefined
  let tooltipOwner: Element | null | undefined
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

  function mountTooltip() {
    const host = input.host()
    if (!host || !tooltip) return
    const mount = topLayerPortalMount(host) ?? host.ownerDocument.body
    if (tooltip.parentElement !== mount) mount.appendChild(tooltip)
  }

  function removeTooltip() {
    // A late embed/finalize can recreate this ID after its owner unmounts.
    tooltip?.ownerDocument.getElementById(tooltipID)?.remove()
  }

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
    if (!tooltip) {
      tooltip = host.ownerDocument.createElement("div")
      tooltip.id = tooltipID
      tooltip.className = "vg-tooltip"
      // Native Vega Tooltip uses viewport coordinates. Escape inline layout
      // containment while keeping expanded details in their current top layer.
      tooltipOwner = host.closest(".msg-artifact")
      tooltipOwner?.addEventListener("toggle", mountTooltip)
      mountTooltip()
    }
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
          config: artifactVegaConfig(artifactVisualTheme(host),
            config && typeof config === "object" && !Array.isArray(config) ? config as Record<string, unknown> : {}),
        } as unknown as Parameters<typeof vegaEmbed>[1], {
          ...INLINE_VEGA_EMBED_OPTIONS,
          tooltip: { ...INLINE_VEGA_EMBED_OPTIONS.tooltip, id: tooltipID },
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
      if (disposed) removeTooltip()
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
    tooltipOwner?.removeEventListener("toggle", mountTooltip)
    current?.finalize()
    current = undefined
    removeTooltip()
  })
}
