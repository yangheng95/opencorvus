import mermaid from "mermaid"
import { Show, createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { ArtifactFrame } from "./ArtifactFrame"

type DiagramPayload = Extract<InteractiveArtifactPayload, { renderer: "diagram@1" }>

export function DiagramArtifact(props: { payload: DiagramPayload }) {
  let host: HTMLDivElement | undefined
  let stopThemeObserver: (() => void) | undefined
  let renderGeneration = 0
  const [error, setError] = createSignal("")

  const render = () => {
    if (!host) return
    const generation = ++renderGeneration
    host.replaceChildren()
    setError("")
    const dark = document.documentElement.dataset.theme !== "light"
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "neutral",
      flowchart: { htmlLabels: false, useMaxWidth: true },
    })
    const id = `artifact-diagram-${crypto.randomUUID().replaceAll("-", "")}`
    void mermaid
      .render(id, props.payload.source, host)
      .then(({ svg, bindFunctions }) => {
        if (!host || generation !== renderGeneration) return
        host.innerHTML = svg
        bindFunctions?.(host)
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
    stopThemeObserver?.()
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Diagram">
      <Show when={!error()} fallback={<div class="msg-artifact-render-error">{error()}</div>}>
        <div
          class="msg-artifact-diagram"
          ref={(element) => {
            host = element
          }}
        />
      </Show>
    </ArtifactFrame>
  )
}
