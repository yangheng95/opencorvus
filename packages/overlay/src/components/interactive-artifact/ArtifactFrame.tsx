import { createSignal, onCleanup, onMount, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"

export function ArtifactFrame(props: {
  title: string
  kind: string
  class?: string
  artifactID?: string
  expandable?: boolean
  elementRef?: (element: HTMLElement) => void
  headerActions?: JSX.Element
  children: JSX.Element
}) {
  let frame: HTMLElement | undefined
  const [immersive, setImmersive] = createSignal(false)
  const expandable = () => props.expandable !== false

  const syncFullscreen = () => setImmersive(document.fullscreenElement === frame)
  const immersiveLabel = () =>
    immersive()
      ? t("artifact.workspace.close_label", { title: props.title })
      : t("artifact.workspace.open_label", { title: props.title })
  const toggleImmersive = async () => {
    if (!frame) return
    if (document.fullscreenElement === frame) {
      setImmersive(false)
      await document.exitFullscreen()
      return
    }
    setImmersive(true)
    try {
      await frame.requestFullscreen()
    } catch (error) {
      setImmersive(false)
      throw error
    }
  }

  onMount(() => document.addEventListener("fullscreenchange", syncFullscreen))
  onCleanup(() => document.removeEventListener("fullscreenchange", syncFullscreen))

  return (
    <section
      class={props.class ? `msg-artifact ${props.class}` : "msg-artifact"}
      data-artifact-renderer={props.kind}
      data-artifact-id={props.artifactID}
      data-artifact-immersive={immersive() ? "true" : undefined}
      aria-label={props.title}
      ref={(element) => {
        frame = element
        props.elementRef?.(element)
      }}
    >
      <header class="msg-artifact__header">
        <div class="msg-artifact__identity">
          <span class="msg-artifact__kind">{props.kind}</span>
          <h3 class="msg-artifact__title oc-section-heading">{props.title}</h3>
        </div>
        <div class="msg-artifact__header-trailing">
          {props.headerActions}
          {expandable() && (
            <Button
              class="msg-artifact__immersive-action"
              variant="ghost"
              size="sm"
              tone="neutral"
              aria-label={immersiveLabel()}
              title={immersiveLabel()}
              onClick={() => void toggleImmersive()}
            >
              {immersive() ? t("artifact.workspace.close") : t("artifact.workspace.open")}
            </Button>
          )}
        </div>
      </header>
      <div class="msg-artifact__body">{props.children}</div>
    </section>
  )
}
