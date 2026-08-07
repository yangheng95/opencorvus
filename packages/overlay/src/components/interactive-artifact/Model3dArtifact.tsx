import { Show, createEffect, createResource, createSignal, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { fetchResourceAsObjectUrl, peekResourceObjectUrl } from "../../services/api"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { ArtifactFrame } from "./ArtifactFrame"
import { configureModelViewer, createModelViewer, resetModelViewerCamera } from "./model-viewer-adapter"

type Model3dPayload = Extract<InteractiveArtifactPayload, { renderer: "model-3d@1" }>

export function Model3dArtifact(props: { payload: Model3dPayload }) {
  let host: HTMLDivElement | undefined
  const [viewer, setViewer] = createSignal<HTMLElement>()
  const [modelUrl] = createResource(
    () => props.payload.source.url,
    (url) => fetchResourceAsObjectUrl(url),
    { initialValue: peekResourceObjectUrl(props.payload.source.url) },
  )
  const [posterUrl] = createResource(
    () => props.payload.poster?.url,
    (url) => fetchResourceAsObjectUrl(url),
    { initialValue: props.payload.poster ? peekResourceObjectUrl(props.payload.poster.url) : undefined },
  )

  const resetCamera = () => {
    const element = viewer()
    if (!element) return
    resetModelViewerCamera(element, props.payload.cameraOrbit)
  }

  onMount(() => {
    if (!host) return
    const element = createModelViewer()
    element.className = "msg-artifact-model3d"
    const markReady = () => {
      element.dataset.ready = "true"
    }
    element.addEventListener("load", markReady)
    host.append(element)
    setViewer(element)
    onCleanup(() => {
      element.removeEventListener("load", markReady)
      element.remove()
      setViewer(undefined)
    })
  })

  createEffect(() => {
    const element = viewer()
    const source = modelUrl()
    if (!element || !source) return
    configureModelViewer(element, {
      src: source,
      alt: props.payload.alt,
      poster: posterUrl(),
      exposure: props.payload.exposure,
      cameraOrbit: props.payload.cameraOrbit,
      animation: props.payload.animation,
    })
  })

  return (
    <ArtifactFrame
      title={props.payload.title}
      kind="3D model"
      headerActions={
        <Button variant="ghost" size="sm" tone="neutral" onClick={resetCamera}>
          {t("artifact.model3d.reset_camera")}
        </Button>
      }
    >
      <Show
        when={!modelUrl.error && !posterUrl.error}
        fallback={
          <div class="msg-artifact-state msg-tool-error" role="alert">
            {t("artifact.model3d.load_failed")}
          </div>
        }
      >
        <div class="msg-artifact-model3d-host" role="application" aria-label={props.payload.alt}>
          <div
            class="msg-artifact-model3d-canvas"
            ref={(element) => {
              host = element
            }}
          />
          <Show when={!modelUrl()}>
            <div class="msg-artifact-state msg-artifact-model3d-loading" role="status">
              {t("artifact.model3d.loading")}
            </div>
          </Show>
        </div>
      </Show>
    </ArtifactFrame>
  )
}
