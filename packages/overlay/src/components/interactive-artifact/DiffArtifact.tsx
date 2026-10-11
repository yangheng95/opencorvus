import { MergeView } from "@codemirror/merge"
import { Compartment } from "@codemirror/state"
import { basicSetup, EditorView } from "codemirror"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { t } from "../../utils/i18n"
import { editorLanguage } from "../ui/code-editor-language"
import { overlayCodeEditorExtensions } from "../ui/code-editor-theme"
import { createCodeEditorLocale } from "../ui/code-editor-locale"
import { codeEditorContent } from "../ui/code-editor-content"
import { Button } from "../ui/Button"
import { ArtifactFrame } from "./ArtifactFrame"
import { artifactCodeFilename } from "./CodeArtifact"

type DiffPayload = Extract<InteractiveArtifactPayload, { renderer: "diff@1" }>

export function DiffArtifact(props: { payload: DiffPayload }) {
  let host: HTMLDivElement | undefined
  let merge: MergeView | undefined
  const localeExtension = createCodeEditorLocale(() => merge ? [merge.a, merge.b] : [])
  const languageCompartment = new Compartment()
  const originalContent = new Compartment()
  const modifiedContent = new Compartment()
  const editorLabel = (side: "original" | "modified") => {
    const kind = t(`artifact.diff.${side}`)
    const authored = side === "original" ? props.payload.originalLabel : props.payload.modifiedLabel
    return authored ? `${kind}: ${authored}` : kind
  }
  const language = () => editorLanguage(artifactCodeFilename(props.payload.language))
  const [languageFailed, setLanguageFailed] = createSignal(false)
  const loadLanguage = () => {
    const current = merge
    const description = language()
    if (!current || !description) return
    setLanguageFailed(false)
    void description.load().then(
      (support) => {
        if (merge !== current) return
        for (const editor of [current.a, current.b])
          editor.dispatch({ effects: languageCompartment.reconfigure(support) })
      },
      () => {
        if (merge === current) setLanguageFailed(true)
      },
    )
  }

  onMount(() => {
    if (!host) return
    const extensions = [
      basicSetup,
      ...overlayCodeEditorExtensions(),
      localeExtension(),
      languageCompartment.of([]),
      EditorView.lineWrapping,
    ]
    merge = new MergeView({
      parent: host,
      a: {
        doc: props.payload.original,
        extensions: [...extensions, originalContent.of(codeEditorContent({ readOnly: true, ariaLabel: editorLabel("original") }))],
      },
      b: {
        doc: props.payload.modified,
        extensions: [...extensions, modifiedContent.of(codeEditorContent({ readOnly: true, ariaLabel: editorLabel("modified") }))],
      },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 6 },
    })
    loadLanguage()
  })

  createEffect(() => {
    const original = editorLabel("original")
    const modified = editorLabel("modified")
    if (!merge) return
    merge.a.dispatch({ effects: originalContent.reconfigure(codeEditorContent({ readOnly: true, ariaLabel: original })) })
    merge.b.dispatch({ effects: modifiedContent.reconfigure(codeEditorContent({ readOnly: true, ariaLabel: modified })) })
  })

  onCleanup(() => {
    merge?.destroy()
    merge = undefined
  })

  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Diff">
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
      <Show when={languageFailed()}>
        <div class="file-editor-language" role="status">
          <span>{t("file_editor.highlight_failed", { language: language()?.name ?? "" })}</span>
          <Button variant="ghost" tone="neutral" size="sm" onClick={loadLanguage}>
            {t("common.retry")}
          </Button>
        </div>
      </Show>
    </ArtifactFrame>
  )
}
