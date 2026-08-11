import { css } from "@codemirror/lang-css"
import { html } from "@codemirror/lang-html"
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { markdown } from "@codemirror/lang-markdown"
import { python } from "@codemirror/lang-python"
import { Compartment, EditorSelection, type Extension } from "@codemirror/state"
import { basicSetup, EditorView } from "codemirror"
import { createEffect, onCleanup, onMount, splitProps, type JSX } from "solid-js"

export interface CodeEditorProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "classList" | "onChange"> {
  value: string
  path: string
  ariaLabel: string
  onValueChange: (value: string) => void
  lineRange?: { startLine: number; endLine: number }
  lineRangeRevealRevision?: number
  readOnly?: boolean
  class?: string
}

export function editorLanguageExtensions(path: string): Extension[] {
  const basename = path.split(/[\\/]/).filter(Boolean).at(-1)?.toLowerCase() ?? ""
  const extension = basename.includes(".") ? basename.split(".").at(-1) : ""
  if (extension === "ts" || extension === "mts" || extension === "cts") return [javascript({ typescript: true })]
  if (extension === "tsx") return [javascript({ typescript: true, jsx: true })]
  if (extension === "js" || extension === "mjs" || extension === "cjs") return [javascript()]
  if (extension === "jsx") return [javascript({ jsx: true })]
  if (extension === "html" || extension === "htm") return [html()]
  if (extension === "css") return [css()]
  if (extension === "json") return [json()]
  if (extension === "md" || extension === "markdown") return [markdown()]
  if (extension === "py" || extension === "pyi") return [python()]
  return []
}

export function CodeEditor(props: CodeEditorProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "value",
    "path",
    "ariaLabel",
    "onValueChange",
    "lineRange",
    "lineRangeRevealRevision",
    "readOnly",
    "class",
  ])
  let host: HTMLDivElement | undefined
  let view: EditorView | undefined
  let applyingExternalValue = false
  let appliedLineRangeIdentity = ""
  const languageCompartment = new Compartment()

  const applyLineRange = () => {
    const editor = view
    const range = local.lineRange
    if (!editor || !range) return
    const identity = `${local.path}\u0000${range.startLine}:${range.endLine}\u0000${local.lineRangeRevealRevision ?? 0}`
    if (identity === appliedLineRangeIdentity) return
    const startLine = Math.min(range.startLine, editor.state.doc.lines)
    const endLine = Math.min(range.endLine, editor.state.doc.lines)
    const anchor = editor.state.doc.line(startLine).from
    const head = editor.state.doc.line(endLine).to
    editor.dispatch({
      selection: EditorSelection.single(anchor, head),
      effects: EditorView.scrollIntoView(anchor, { y: "center" }),
    })
    editor.focus()
    appliedLineRangeIdentity = identity
  }

  onMount(() => {
    if (!host) return
    view = new EditorView({
      doc: local.value,
      parent: host,
      extensions: [
        basicSetup,
        languageCompartment.of(editorLanguageExtensions(local.path)),
        EditorView.lineWrapping,
        EditorView.editable.of(!local.readOnly),
        EditorView.contentAttributes.of({ "aria-readonly": local.readOnly ? "true" : "false" }),
        EditorView.contentAttributes.of({ "aria-label": local.ariaLabel }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || applyingExternalValue) return
          local.onValueChange(update.state.doc.toString())
        }),
      ],
    })
    applyLineRange()
  })

  createEffect(() => {
    const editor = view
    if (!editor) return
    editor.dispatch({
      effects: languageCompartment.reconfigure(editorLanguageExtensions(local.path)),
    })
  })

  createEffect(() => {
    const next = local.value
    const editor = view
    if (!editor) return
    const current = editor.state.doc.toString()
    if (next === current) return
    applyingExternalValue = true
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: next,
      },
    })
    applyingExternalValue = false
  })

  createEffect(() => {
    void local.path
    void local.lineRange?.startLine
    void local.lineRange?.endLine
    void local.lineRangeRevealRevision
    applyLineRange()
  })

  onCleanup(() => {
    view?.destroy()
    view = undefined
  })

  return (
    <div
      {...rest}
      class={local.class ? `file-editor-code ${local.class}` : "file-editor-code"}
      ref={(node) => {
        host = node
      }}
    />
  )
}
