import cytoscape, { type Core } from "cytoscape"
import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { SearchField } from "../ui/SearchField"
import { ArtifactFrame } from "./ArtifactFrame"
import { artifactVisualTheme } from "./theme-color"

type NetworkPayload = Extract<InteractiveArtifactPayload, { renderer: "network@1" }>

export function NetworkArtifact(props: { payload: NetworkPayload }) {
  let host: HTMLDivElement | undefined
  let graph: Core | undefined
  let stopThemeObserver: (() => void) | undefined
  let resizeObserver: ResizeObserver | undefined
  const [filter, setFilter] = createSignal("")
  const layoutOptions = () =>
    props.payload.layout === "cose"
      ? {
          name: "cose" as const,
          animate: false,
          fit: true,
          padding: 48,
          nodeDimensionsIncludeLabels: true,
          idealEdgeLength: 130,
          nodeRepulsion: 14_000,
          componentSpacing: 90,
        }
      : { name: props.payload.layout, animate: false, fit: true, padding: 48 }

  const applyTheme = () => {
    if (!graph || !host) return
    const theme = artifactVisualTheme(host)
    const groups = [...new Set(props.payload.nodes.map((node) => node.group ?? ""))].sort()
    const groupColors = new Map(groups.map((group, index) => [group, theme.palette[index % theme.palette.length]]))
    graph.nodes().forEach((node) => {
      node.data("themeColor", groupColors.get(String(node.data("group") ?? "")) ?? theme.accent)
      node.data("themeSize", node.degree(false) > 1 ? 46 : 38)
    })
    graph
      .style()
      .selector("node")
      .style({
        label: "data(label)",
        color: theme.text,
        "background-color": "data(themeColor)",
        "border-color": theme.surface,
        "border-width": "3px",
        width: "data(themeSize)",
        height: "data(themeSize)",
        "text-valign": "bottom",
        "text-margin-y": 9,
        "font-family": theme.font,
        "font-size": 12,
        "font-weight": 500,
        "text-background-color": theme.surface,
        "text-background-opacity": 0.88,
        "text-background-padding": "3px",
        "text-background-shape": "roundrectangle",
        "text-wrap": "wrap",
        "text-max-width": "120px",
      })
      .selector("edge")
      .style({
        label: "data(label)",
        "line-color": theme.muted,
        "target-arrow-color": theme.muted,
        "target-arrow-shape": "none",
        "curve-style": "bezier",
        width: "mapData(weight, 0, 10, 1.2, 3.6)",
        "font-family": theme.font,
        "font-size": 10,
        color: theme.muted,
        "text-background-color": theme.surface,
        "text-background-opacity": 0.92,
        "text-background-padding": "2px",
      })
      .selector("edge[?directed]")
      .style({ "target-arrow-shape": "triangle" })
      .selector(".dimmed")
      .style({ opacity: 0.15 })
      .selector(":selected")
      .style({ "border-width": 4, "border-color": theme.textStrong, opacity: 1 })
      .update()
  }

  onMount(() => {
    if (!host) return
    graph = cytoscape({
      container: host,
      elements: [
        ...props.payload.nodes.map((node) => ({ data: node })),
        ...props.payload.edges.map((edge) => ({
          data: { ...edge, directed: edge.directed ?? true, weight: edge.weight ?? 1 },
        })),
      ],
      layout: { name: "preset" },
      minZoom: 0.1,
      maxZoom: 4,
      boxSelectionEnabled: true,
    })
    applyTheme()
    graph.layout(layoutOptions()).run()
    stopThemeObserver = observeAppliedTheme(applyTheme)
    resizeObserver = new ResizeObserver(() => graph?.resize())
    resizeObserver.observe(host)
    graph.one("layoutstop", () => {
      if (host) host.dataset.ready = "true"
    })
  })

  createEffect(() => {
    const query = filter().trim().toLowerCase()
    if (!graph) return
    graph.stop()
    graph.elements().removeClass("dimmed")
    if (!query) {
      graph.fit(graph.elements(), 28)
      return
    }
    const matches = graph.nodes().filter((node) => {
      const label = String(node.data("label") ?? "").toLowerCase()
      return label.includes(query)
    })
    graph.elements().addClass("dimmed")
    const context = matches.union(matches.connectedEdges()).union(matches.neighborhood("node"))
    context.removeClass("dimmed")
    if (matches.length) graph.animate({ fit: { eles: context, padding: 72 }, duration: 180 })
  })

  onCleanup(() => {
    stopThemeObserver?.()
    resizeObserver?.disconnect()
    graph?.destroy()
    graph = undefined
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Network">
      <div class="msg-artifact-network__toolbar">
        <SearchField
          value={filter()}
          placeholder={t("artifact.network.search")}
          size="sm"
          onValueChange={setFilter}
          onClear={() => setFilter("")}
        />
        <Button
          variant="ghost"
          size="sm"
          tone="neutral"
          onClick={() => {
            graph?.stop()
            graph?.fit(graph.elements(), 28)
          }}
        >
          {t("artifact.network.fit")}
        </Button>
      </div>
      <div
        class="msg-artifact-network"
        role="application"
        aria-label={props.payload.title}
        ref={(element) => {
          host = element
        }}
      />
    </ArtifactFrame>
  )
}
