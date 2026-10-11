import { Compartment, EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { createEffect, createMemo } from "solid-js"
import { t } from "../../utils/i18n"

/** The current application catalog owns language; CodeMirror owns its panels and query state. */
export function createCodeEditorLocale(views: () => readonly EditorView[]) {
  const compartment = new Compartment()
  const phrases = createMemo<Record<string, string>>(() => ({
    Find: t("code_editor.find"),
    Replace: t("code_editor.replace"),
    next: t("code_editor.next"),
    previous: t("code_editor.previous"),
    all: t("code_editor.all"),
    "match case": t("code_editor.match_case"),
    regexp: t("code_editor.regexp"),
    "by word": t("code_editor.by_word"),
    replace: t("code_editor.replace"),
    "replace all": t("code_editor.replace_all"),
    close: t("common.close"),
    "Go to line": t("code_editor.go_to_line"),
    go: t("code_editor.go"),
    "current match": t("code_editor.current_match"),
    "on line": t("code_editor.on_line"),
    "replaced match on line $": t("code_editor.replaced_match_line"),
    "replaced $ matches": t("code_editor.replaced_matches"),
    "Folded lines": t("code_editor.folded_lines"),
    "Unfolded lines": t("code_editor.unfolded_lines"),
    to: t("code_editor.to"),
    "folded code": t("code_editor.folded_code"),
    unfold: t("code_editor.unfold"),
    "Fold line": t("code_editor.fold_line"),
    "Unfold line": t("code_editor.unfold_line"),
    Diagnostics: t("code_editor.diagnostics"),
    "No diagnostics": t("code_editor.no_diagnostics"),
    Completions: t("code_editor.completions"),
    "Selection deleted": t("code_editor.selection_deleted"),
    "Control character": t("code_editor.control_character"),
    "$ unchanged lines": t("code_editor.unchanged_lines"),
    "Expand $ unchanged lines": t("code_editor.expand_unchanged_lines"),
  }), undefined, {
    equals: (previous, next) => !!previous && Object.keys(previous).length === Object.keys(next).length &&
      Object.keys(next).every((key) => previous[key] === next[key]),
  })
  const extension = createMemo(() => EditorState.phrases.of(phrases()))
  createEffect(() => {
    const current = extension()
    const updates = views()
      .filter((view) => compartment.get(view.state) !== current)
      .map((view) => ({ view, scroll: view.scrollSnapshot() }))
    for (const { view, scroll } of updates) {
      view.dispatch({ effects: compartment.reconfigure(current) })
      // A phrase change redraws the view before its ordinary effect loop.
      // Restore the same document's reading anchor in the next transaction.
      view.dispatch({ effects: scroll })
    }
  })
  return () => compartment.of(extension())
}
