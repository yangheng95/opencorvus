import { createSignal, onCleanup, onMount, Show, type JSX } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { artifactExports, type ArtifactExport } from "../../services/artifact-export"
import { reportError } from "../../services/diagnostics"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { ArtifactActions } from "./ArtifactActions"

export function ArtifactFrame(props: {
  title: string
  kind: string
  payload?: InteractiveArtifactPayload
  exportFiles?: () => ArtifactExport[]
  copyText?: () => string | Promise<string>
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
      reportError({
        id: "artifact-open",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
      })
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
          <Show when={props.payload || props.exportFiles}>
            <ArtifactActions
              files={() => (props.exportFiles ? props.exportFiles() : artifactExports(props.payload!))}
              copyText={props.copyText}
              copyLabel={
                props.payload?.renderer === "mcp-app@1"
                  ? t("artifact.actions.copy_result")
                  : props.payload &&
                      "source" in props.payload &&
                      typeof props.payload.source === "object" &&
                      !props.payload.source.mime.startsWith("text/") &&
                      props.payload.source.mime !== "application/json"
                    ? t("artifact.actions.copy_name")
                    : undefined
              }
              disabled={props.payload?.renderer === "mcp-app@1" && artifactExports(props.payload).length === 0}
            />
          </Show>
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
              <Icon name={immersive() ? "restore" : "maximize"} size="compact" />
              {immersive() ? t("artifact.workspace.close") : t("artifact.workspace.open")}
            </Button>
          )}
        </div>
      </header>
      <div class="msg-artifact__body">{props.children}</div>
    </section>
  )
}
