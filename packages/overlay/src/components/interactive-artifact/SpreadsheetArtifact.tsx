import { createSignal, onCleanup, onMount, Show } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { getLocale, t } from "../../utils/i18n"
import { ArtifactFrame } from "./ArtifactFrame"
import { mountUniverSpreadsheet } from "./univer-spreadsheet-adapter"

type SpreadsheetPayload = Extract<InteractiveArtifactPayload, { renderer: "spreadsheet@1" }>

export function SpreadsheetArtifact(props: { payload: SpreadsheetPayload }) {
  let host: HTMLDivElement | undefined
  let dispose: (() => void) | undefined
  let stopThemeObserver: (() => void) | undefined
  const [error, setError] = createSignal(false)

  onMount(() => {
    if (!host) return
    try {
      const runtime = mountUniverSpreadsheet(
        host,
        props.payload,
        getLocale(),
        document.documentElement.dataset.theme === "dark",
      )
      dispose = runtime.dispose
      stopThemeObserver = observeAppliedTheme((theme) => runtime.setDarkMode(theme === "dark"))
    } catch {
      setError(true)
    }
  })

  onCleanup(() => {
    stopThemeObserver?.()
    dispose?.()
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Spreadsheet">
      <Show
        when={!error()}
        fallback={
          <div class="msg-artifact-state msg-tool-error" role="alert">
            {t("artifact.spreadsheet.load_failed")}
          </div>
        }
      >
        <div
          class="msg-artifact-spreadsheet"
          role="region"
          aria-label={props.payload.title}
          data-editable={props.payload.editable}
          ref={(element) => {
            host = element
          }}
        />
      </Show>
    </ArtifactFrame>
  )
}
