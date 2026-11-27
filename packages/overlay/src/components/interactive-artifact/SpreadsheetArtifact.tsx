import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { appliedColorScheme, observeAppliedTheme } from "../../services/theme"
import { getLocale, t } from "../../utils/i18n"
import { ArtifactFrame } from "./ArtifactFrame"
import { mountUniverSpreadsheet } from "./univer-spreadsheet-adapter"
import { Button } from "../ui/Button"

type SpreadsheetPayload = Extract<InteractiveArtifactPayload, { renderer: "spreadsheet@1" }>

export function SpreadsheetArtifact(props: { payload: SpreadsheetPayload }) {
  let host: HTMLDivElement | undefined
  let stopThemeObserver: (() => void) | undefined
  const [runtime, setRuntime] = createSignal<ReturnType<typeof mountUniverSpreadsheet>>()
  const [error, setError] = createSignal(false)

  onMount(() => {
    if (!host) return
    try {
      const mounted = mountUniverSpreadsheet(host, props.payload, getLocale(), appliedColorScheme() === "dark")
      setRuntime(mounted)
      stopThemeObserver = observeAppliedTheme(() => mounted.setDarkMode(appliedColorScheme() === "dark"))
      createEffect(() => mounted.setLocale(getLocale()))
    } catch {
      setError(true)
    }
  })

  onCleanup(() => {
    stopThemeObserver?.()
    runtime()?.dispose()
  })

  return (
    <ArtifactFrame
      payload={props.payload}
      exportFiles={() => {
        const mounted = runtime()
        if (!mounted) throw new Error(t("artifact.spreadsheet.load_failed"))
        return mounted.exportFiles()
      }}
      title={props.payload.title}
      kind="Spreadsheet"
      headerActions={
        <Show when={runtime()}>
          {(mounted) => (
            <Button variant="ghost" size="sm" tone="neutral" onClick={() => mounted().fitColumns()}>
              {t("artifact.spreadsheet.fit_columns")}
            </Button>
          )}
        </Show>
      }
    >
      <Show
        when={!error()}
        fallback={
          <div class="msg-artifact-state msg-tool-error" role="alert">
            {t("artifact.spreadsheet.load_failed")}
          </div>
        }
      >
        <div class="msg-artifact-spreadsheet-workspace">
          <Show when={props.payload.editable}>
            <p class="msg-artifact-spreadsheet__note">{t("artifact.spreadsheet.local_edits")}</p>
          </Show>
          <div
            class="msg-artifact-spreadsheet"
            role="region"
            aria-label={props.payload.title}
            data-editable={props.payload.editable}
            ref={(element) => {
              host = element
            }}
          />
        </div>
      </Show>
    </ArtifactFrame>
  )
}
