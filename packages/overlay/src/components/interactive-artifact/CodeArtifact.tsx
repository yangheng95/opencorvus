import { createMemo, createSignal, Show } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { CodeEditor, type CodeEditorNavigation } from "../ui/CodeEditor"
import { Button } from "../ui/Button"
import { ArtifactFrame } from "./ArtifactFrame"
import { t } from "../../utils/i18n"
import { CODE_EXTENSIONS } from "../../services/artifact-export"

type CodePayload = Extract<InteractiveArtifactPayload, { renderer: "code@1" }>
export type ArtifactCodeLanguage = CodePayload["language"]

export function artifactCodeFilename(language: ArtifactCodeLanguage): string {
  return `artifact.${CODE_EXTENSIONS[language]}`
}

export function CodeArtifact(props: { payload: CodePayload }) {
  const [source, setSource] = createSignal(props.payload.source)
  const modified = createMemo(() => source() !== props.payload.source)
  const [navigation, setNavigation] = createSignal<CodeEditorNavigation>()

  return (
    <ArtifactFrame
      payload={{ ...props.payload, source: source() }}
      title={props.payload.title}
      kind="Code"
      headerActions={
        <>
          <Button variant="ghost" size="sm" tone="neutral" disabled={!navigation()}
            title={`${t("code_editor.find")} (Ctrl/Cmd+F)`}
            onClick={() => navigation()?.find()}>
            {t("code_editor.find")}
          </Button>
          <Button variant="ghost" size="sm" tone="neutral" disabled={!navigation()}
            title={`${t("code_editor.go_to_line")} (Ctrl/Cmd+Alt+G)`}
            onClick={() => navigation()?.goToLine()}>
            {t("code_editor.go_to_line")}
          </Button>
        </>
      }
    >
      <div class="msg-artifact-code__toolbar">
        <div class="msg-artifact-code__details">
          <span>{props.payload.filename ?? props.payload.language}</span>
          <Show when={props.payload.editable}>
            <p class="msg-artifact-code__note">{t("artifact.code.local_edits")}</p>
          </Show>
        </div>
        <Show when={props.payload.editable && modified()}>
          <span>{t("artifact.code.modified")}</span>
        </Show>
      </div>
      <CodeEditor
        class="msg-artifact-code"
        data-read-only={!props.payload.editable ? "true" : undefined}
        value={source()}
        path={artifactCodeFilename(props.payload.language)}
        ariaLabel={props.payload.title}
        readOnly={!props.payload.editable}
        onValueChange={setSource}
        onNavigationReady={setNavigation}
      />
    </ArtifactFrame>
  )
}
