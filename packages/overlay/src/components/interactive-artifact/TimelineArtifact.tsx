import { Timeline, type DataGroup } from "vis-timeline"
import "vis-timeline/styles/vis-timeline-graph2d.css"
import { Show, createEffect, createMemo, createSignal, createUniqueId, onCleanup, onMount } from "solid-js"
import { artifactTimelineItems, createArtifactTimelinePresentation } from "../../services/artifact-timeline"
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
  const keyboardHintID = createUniqueId()
  const [selectedID, setSelectedID] = createSignal<string>()
  const selected = createMemo(() => props.payload.items.find((item) => item.id === selectedID()))
  const navigableItems = createMemo(() =>
    props.payload.items
      .filter((item) => item.kind === "point" || item.kind === "range")
      .sort((left, right) => Date.parse(left.start) - Date.parse(right.start)),
  )
  const presentation = createMemo(() => createArtifactTimelinePresentation(localeTag()))
  createEffect(() => {
    const { moment } = presentation()
    timeline?.setOptions({ moment })
  })
  const fitAll = (animation: boolean) => {
    timeline?.fit({ animation })
  }
  const syncSelection = () => {
    const id = timeline?.getSelection()[0]
    setSelectedID(id == null ? undefined : String(id))
  }
  const navigate = (event: KeyboardEvent) => {
    if (
      !timeline || event.target !== event.currentTarget || event.defaultPrevented || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    ) return
    const items = navigableItems()
    if (!items.length) return
    const current = items.findIndex((item) => item.id === selectedID())
    let next: number
    switch (event.key) {
      case "ArrowLeft": next = current < 0 ? items.length - 1 : Math.max(0, current - 1); break
      case "ArrowRight": next = Math.min(items.length - 1, current + 1); break
      case "Home": next = 0; break
      case "End": next = items.length - 1; break
      default: return
    }
    event.preventDefault()
    timeline.setSelection([items[next]!.id])
    timeline.focus(items[next]!.id, { animation: true })
    syncSelection()
  }

  onMount(() => {
    if (!host) return
    const items = artifactTimelineItems(props.payload.items)
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
    timeline.on("select", syncSelection)
  })

  onCleanup(() => {
    resizeObserver?.disconnect()
    timeline?.destroy()
    timeline = undefined
  })

  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Timeline">
      <div>
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
        <Show when={navigableItems().length}>
          <p class="msg-artifact-timeline__hint" id={keyboardHintID}>{t("artifact.timeline.keyboard_hint")}</p>
        </Show>
      </div>
      <div
        class="msg-artifact-timeline"
        role={navigableItems().length ? "application" : "region"}
        aria-label={props.payload.title}
        aria-describedby={navigableItems().length ? keyboardHintID : undefined}
        tabIndex={navigableItems().length ? 0 : undefined}
        onKeyDown={navigate}
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
