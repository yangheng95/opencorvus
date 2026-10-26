import { Timeline, type DataGroup, type DataItem } from "vis-timeline"
import "vis-timeline/styles/vis-timeline-graph2d.css"
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { createArtifactTimelinePresentation } from "../../services/artifact-timeline"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { localeTag, t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { ArtifactFrame } from "./ArtifactFrame"

type TimelinePayload = Extract<InteractiveArtifactPayload, { renderer: "timeline@1" }>
type TimelineItem = TimelinePayload["items"][number]

function safeTextTemplate(item?: { content?: unknown } | null): HTMLElement {
  const element = document.createElement("span")
  element.textContent = String(item?.content ?? "")
  return element
}

function timelineItemEnd(item: TimelineItem): string | undefined {
  return "end" in item ? item.end : undefined
}

export function TimelineArtifact(props: { payload: TimelinePayload }) {
  let host: HTMLDivElement | undefined
  let timeline: Timeline | undefined
  let resizeObserver: ResizeObserver | undefined
  const [selectedID, setSelectedID] = createSignal<string>()
  const selected = createMemo(() => props.payload.items.find((item) => item.id === selectedID()))
  const presentation = createMemo(() => createArtifactTimelinePresentation(localeTag()))
  createEffect(() => {
    const { moment } = presentation()
    timeline?.setOptions({ moment })
  })
  const fitAll = (animation: boolean) => {
    const timestamps = props.payload.items.flatMap((item) => [
      Date.parse(item.start),
      "end" in item ? Date.parse(item.end) : Date.parse(item.start),
    ])
    const first = Math.min(...timestamps)
    const last = Math.max(...timestamps)
    const span = Math.max(last - first, 86_400_000)
    timeline?.setWindow(new Date(first - span * 0.08), new Date(last + span * 0.18), { animation })
  }

  onMount(() => {
    if (!host) return
    const items: DataItem[] = props.payload.items.map((item) => ({
      id: item.id,
      content: item.content,
      group: item.group,
      start: item.start,
      end: "end" in item ? item.end : undefined,
      type: item.kind === "point" ? "point" : item.kind,
      style: item.color ? `background-color:${item.color};border-color:${item.color}` : undefined,
    }))
    const groups: DataGroup[] = (props.payload.groups ?? []).map((group) => ({
      id: group.id,
      content: group.label,
    }))
    const options = {
      moment: presentation().moment,
      autoResize: false,
      editable: false,
      selectable: true,
      multiselect: false,
      moveable: true,
      zoomable: true,
      stack: true,
      showCurrentTime: false,
      orientation: "both" as const,
      minHeight: 280,
      maxHeight: 520,
      margin: { item: 12, axis: 8 },
      template: safeTextTemplate,
      groupTemplate: safeTextTemplate,
      ...(props.payload.viewport
        ? {
            start: props.payload.viewport.start,
            end: props.payload.viewport.end,
          }
        : {}),
      zoomMin: 60_000,
      zoomMax: 315_576_000_000,
      onInitialDrawComplete: () => {
        if (!props.payload.viewport) fitAll(false)
        if (host) host.dataset.ready = "true"
      },
    }
    timeline = groups.length ? new Timeline(host, items, groups, options) : new Timeline(host, items, options)
    // With resize polling disabled, a settled initial viewport still needs its
    // final layout pass before the library completes its first draw.
    timeline.on("rangechanged", () => timeline?.redraw())
    resizeObserver = new ResizeObserver(() => timeline?.redraw())
    resizeObserver.observe(host)
    timeline.on("select", (properties: { items?: Array<string | number> }) => {
      const id = properties.items?.[0]
      setSelectedID(id == null ? undefined : String(id))
    })
  })

  onCleanup(() => {
    resizeObserver?.disconnect()
    timeline?.destroy()
    timeline = undefined
  })

  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Timeline">
      <div class="msg-artifact-timeline__toolbar">
        <Button variant="ghost" size="sm" tone="neutral" onClick={() => fitAll(true)}>
          {t("artifact.timeline.fit")}
        </Button>
        <Button variant="ghost" size="sm" tone="neutral" onClick={() => timeline?.zoomIn(0.4, { animation: true })}>
          {t("artifact.timeline.zoom_in")}
        </Button>
        <Button variant="ghost" size="sm" tone="neutral" onClick={() => timeline?.zoomOut(0.4, { animation: true })}>
          {t("artifact.timeline.zoom_out")}
        </Button>
      </div>
      <div
        class="msg-artifact-timeline"
        role="application"
        aria-label={props.payload.title}
        ref={(element) => {
          host = element
        }}
      />
      <Show when={selected()}>
        {(item) => (
          <div class="msg-artifact-timeline__detail" role="status">
            <strong>{item().content}</strong>
            <span>
              {presentation().formatDateTime(item().start)}
              {timelineItemEnd(item()) &&
                ` – ${presentation().formatDateTime(timelineItemEnd(item())!)}`}
            </span>
          </div>
        )}
      </Show>
    </ArtifactFrame>
  )
}
