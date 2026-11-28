import { Show, createSignal } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { ArtifactFrame } from "./ArtifactFrame"
import { createInlineVegaView } from "./inline-vega-view"

type ChartPayload = Extract<InteractiveArtifactPayload, { renderer: "chart@1" }>

export function ChartArtifact(props: { payload: ChartPayload }) {
  let host: HTMLDivElement | undefined
  const [error, setError] = createSignal("")
  createInlineVegaView({
    host: () => host,
    observed: () => host,
    source: () => props.payload.spec,
    label: () => props.payload.title,
    data: () => props.payload.data,
    measure: () => {
      if (!host) return { width: 0, height: 0 }
      const style = getComputedStyle(host)
      const expanded = host.closest(".msg-artifact")?.matches(":popover-open")
      // Natural inline content must not feed its rendered height back into the
      // default plot size. The workspace has a real available-height boundary.
      const availableHeight = expanded ? host.clientHeight : parseFloat(style.minHeight)
      const width = Math.floor(host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
      const height = Math.floor(availableHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom))
      return { width: width > 0 ? Math.max(240, width) : 0, height: height > 0 ? Math.max(220, height) : 0 }
    },
    error: setError,
  })
  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Chart">
      <div class="msg-artifact-chart msg-artifact-vega msg-artifact-chart--vega" ref={host} hidden={!!error()} />
      <Show when={error()}>{message => <div class="msg-artifact-render-error">{message()}</div>}</Show>
    </ArtifactFrame>
  )
}
