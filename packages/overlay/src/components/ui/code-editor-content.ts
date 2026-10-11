import { EditorState, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

/** Read-only content still exposes the same named keyboard reading surface. */
export function codeEditorContent(input: { readOnly: boolean; ariaLabel: string }): Extension[] {
  return [
    EditorState.readOnly.of(input.readOnly),
    EditorView.editable.of(!input.readOnly),
    EditorView.contentAttributes.of({
      "aria-label": input.ariaLabel,
      "aria-readonly": input.readOnly ? "true" : "false",
      ...(input.readOnly ? { tabindex: "0" } : {}),
    }),
  ]
}
