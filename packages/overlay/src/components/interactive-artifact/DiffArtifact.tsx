import { MergeView } from "@codemirror/merge"
import { EditorState } from "@codemirror/state"
import { basicSetup, EditorView } from "codemirror"
import { onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { t } from "../../utils/i18n"
import { editorLanguageExtensions } from "../ui/CodeEditor"
import { ArtifactFrame } from "./ArtifactFrame"
import { artifactCodeFilename } from "./CodeArtifact"

type DiffPayload = Extract<InteractiveArtifactPayload, { renderer: "diff@1" }>

export function DiffArtifact(props: { payload: DiffPayload }) {
  let host: HTMLDivElement | undefined
  let merge: MergeView | undefined

  onMount(() => {
    if (!host) return
    const language = editorLanguageExtensions(artifactCodeFilename(props.payload.language))
    const extensions = [
      basicSetup,
      ...language,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
    ]
    merge = new MergeView({
      parent: host,
      a: { doc: props.payload.original, extensions },
      b: { doc: props.payload.modified, extensions },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 6 },
    })
  })

  onCleanup(() => {
    merge?.destroy()
    merge = undefined
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Diff">
      <div class="msg-artifact-diff__labels">
        <span>{props.payload.originalLabel ?? t("artifact.diff.original")}</span>
        <span>{props.payload.modifiedLabel ?? t("artifact.diff.modified")}</span>
      </div>
      <div
        class="msg-artifact-diff"
        ref={(element) => {
          host = element
        }}
      />
    </ArtifactFrame>
  )
}
