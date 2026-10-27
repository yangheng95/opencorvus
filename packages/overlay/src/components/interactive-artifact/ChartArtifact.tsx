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
    data: () => props.payload.data,
    measure: () => {
      const width = Math.floor(host?.clientWidth ?? 0), height = Math.floor(host?.clientHeight ?? 0)
      return { width: width > 0 ? Math.max(240, width - 40) : 0, height: height > 0 ? Math.max(220, height - 36) : 0 }
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
