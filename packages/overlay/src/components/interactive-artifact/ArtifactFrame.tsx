import { createEffect, createSignal, on, onCleanup, onMount, Show, type JSX } from "solid-js"
import type { InteractiveArtifact, InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { artifactCopiesFilename, artifactExports, SpreadsheetExportLimitError, type ArtifactExport } from "../../services/artifact-export"
import { captureApiAuthority } from "../../services/api"
import { boardStore } from "../../store/board"
import { reportError } from "../../services/diagnostics"
import { getLocale, t } from "../../utils/i18n"
import { formatErrorDetails } from "../../utils/error-details"
import { closeArtifactWorkspace, openArtifactWorkspace } from "../../utils/top-layer"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { Feedback } from "../ui/Feedback"
import { ArtifactActions } from "./ArtifactActions"

export function ArtifactFrame(props: {
  title: string
  kind: string
  payload?: InteractiveArtifactPayload
  downloads?: InteractiveArtifact["downloads"]
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
  const [actionError, setActionError] = createSignal<{ cause: unknown }>()
  // Read ownership metadata only; an export supplier may be expensive or fail.
  createEffect(on(
    () => [props.payload, props.downloads, props.title, captureApiAuthority().revision, boardStore.selectEpoch],
    () => setActionError(undefined),
  ))
  const expandable = () => props.expandable !== false
  const files = () => (props.exportFiles ? props.exportFiles() : artifactExports(props.payload!, props.downloads))
  const copiesFilename = () =>
    !props.copyText && props.payload && artifactCopiesFilename(props.payload, props.downloads)

  const syncWorkspace = () => {
    if (!frame) return
    const open = frame.matches(":popover-open")
    setImmersive(open && frame.hasAttribute("data-artifact-workspace"))
    if (!open) closeArtifactWorkspace(frame)
  }
  const immersiveLabel = () =>
    immersive()
      ? t("artifact.workspace.close_label", { title: props.title })
      : t("artifact.workspace.open_label", { title: props.title })
  const toggleImmersive = () => {
    if (!frame) return
    if (frame.matches(":popover-open")) {
      setImmersive(false)
      closeArtifactWorkspace(frame)
      return
    }
    setImmersive(true)
    try {
      openArtifactWorkspace(frame)
    } catch (error) {
      setImmersive(false)
      closeArtifactWorkspace(frame)
      reportError({
        id: "artifact-open",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  onMount(() => frame?.addEventListener("toggle", syncWorkspace))
  onCleanup(() => {
    frame?.removeEventListener("toggle", syncWorkspace)
    if (frame) closeArtifactWorkspace(frame)
  })

  return (
    <div class="msg-artifact-slot">
      <section
        class={props.class ? `msg-artifact ${props.class}` : "msg-artifact"}
        data-artifact-renderer={props.kind}
        data-artifact-id={props.artifactID}
        data-artifact-immersive={immersive() ? "true" : undefined}
        role={immersive() ? "dialog" : undefined}
        aria-label={props.title}
        ref={(element) => {
          frame = element
          props.elementRef?.(element)
        }}
      >
        <header class="msg-artifact__header">
          <div class="msg-artifact__identity">
            <span class="msg-artifact__kind">
              {props.payload ? t(`artifact.kind.${props.payload.renderer}`) : props.kind}
            </span>
            <h3 class="msg-artifact__title oc-section-heading">{props.title}</h3>
          </div>
          <div class="msg-artifact__header-trailing">
            <Show when={props.payload || props.exportFiles}>
              <ArtifactActions
                files={files}
                onActionStart={() => setActionError(undefined)}
                onActionError={(cause) => setActionError({ cause })}
                copyText={props.copyText}
                copyLabel={
                  props.payload?.renderer === "mcp-app@1"
                    ? t("artifact.actions.copy_result")
                    : copiesFilename()
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
                aria-expanded={immersive()}
                title={immersiveLabel()}
                onClick={() => void toggleImmersive()}
              >
                <Icon name={immersive() ? "restore" : "maximize"} size="compact" />
                {immersive() ? t("artifact.workspace.close") : t("artifact.workspace.open")}
              </Button>
            )}
          </div>
          <Show when={actionError()}>
            {(failure) => (
              <Feedback class="msg-artifact__action-feedback" tone="error" title={t("artifact.actions.failed")}
                details={formatErrorDetails(failure().cause)}>
                {failure().cause instanceof SpreadsheetExportLimitError
                  ? t("artifact.spreadsheet.export_too_large", {
                      name: (failure().cause as SpreadsheetExportLimitError).sheetName,
                      cells: new Intl.NumberFormat(getLocale()).format((failure().cause as SpreadsheetExportLimitError).cellCount),
                      limit: new Intl.NumberFormat(getLocale()).format((failure().cause as SpreadsheetExportLimitError).maxCells),
                    })
                  : t("artifact.actions.failure_details")}
              </Feedback>
            )}
          </Show>
        </header>
        <div class="msg-artifact__body">{props.children}</div>
      </section>
    </div>
  )
}
