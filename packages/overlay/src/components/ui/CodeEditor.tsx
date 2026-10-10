import { Compartment, EditorSelection, EditorState } from "@codemirror/state"
import { basicSetup, EditorView } from "codemirror"
import { createEffect, createSignal, onCleanup, onMount, Show, splitProps, type JSX } from "solid-js"
import { t } from "../../utils/i18n"
import { Button } from "./Button"
import { editorLanguage } from "./code-editor-language"
import { createAnimationFrameScheduler } from "../../utils/animation-frame"
import {
  overlayCodeEditorExtensions,
  resolveRevealTarget,
  revealHighlightLines,
  revealLinesEffect,
  type CodeEditorLineRange,
} from "./code-editor-theme"

export interface CodeEditorProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "classList" | "onChange"> {
  value: string
  path: string
  ariaLabel: string
  onValueChange: (value: string) => void
  lineRange?: CodeEditorLineRange
  lineRangeRevealRevision?: number
  readOnly?: boolean
  class?: string
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
  let revealedIdentity = ""
  let revealObserver: ResizeObserver | undefined
  const languageCompartment = new Compartment()
  const readOnlyCompartment = new Compartment()
  const readOnlyExtensions = (readOnly: boolean) => [
    EditorView.editable.of(!readOnly),
    EditorState.readOnly.of(readOnly),
    EditorView.contentAttributes.of({
      "aria-readonly": readOnly ? "true" : "false",
      ...(readOnly ? { tabindex: "0" } : {}),
    }),
  ]
  const [languageName, setLanguageName] = createSignal("")
  const [languageStatus, setLanguageStatus] = createSignal<"loading" | "ready" | "failed">("ready")
  const [languageRetry, setLanguageRetry] = createSignal(0)

  const revealIdentity = () => {
    const range = local.lineRange
    return range ? [local.path, range.startLine, range.endLine, local.lineRangeRevealRevision ?? 0].join("\0") : ""
  }

  /**
   * Send the cursor to a cited line and band the cited range.
   *
   * A citation names a location, not a selection. Selecting
   * `startLine`..`endLine` turned the common whole-file citation (a plain
   * `read` cites lines 1..N) into "select the entire document", which is
   * indistinguishable from no jump at all, so the cursor lands on the start
   * line and the range is banded instead.
   *
   * The reveal is recorded as done only once the document actually holds the
   * cited line. Latching earlier is what made jumps vanish: a reveal computed
   * while the file was still loading clamped onto line 1 of an empty document
   * and then refused to run again when the text finally arrived.
   */
  const revealLineRange = () => {
    const editor = view
    if (!editor) return
    const range = local.lineRange
    const target = resolveRevealTarget(editor.state.doc.lines, range)
    if (!range || !target) {
      revealedIdentity = ""
      return
    }
    const identity = revealIdentity()
    if (identity === revealedIdentity) return
    // A retained file view can receive a new citation before its Dock is
    // visible. Keep that request unsettled until real layout can scroll and
    // focus it; the host observer retries this same current request.
    if (!host?.clientWidth || !host.clientHeight || host.closest("[inert], [hidden]")) return
    const anchor = editor.state.doc.line(target.anchorLine).from
    editor.dispatch({
      selection: EditorSelection.cursor(anchor),
      effects: [
        revealLinesEffect(revealHighlightLines(editor.state.doc.lines, target)),
        EditorView.scrollIntoView(anchor, { y: "center" }),
      ],
    })
    // A view mounted in this same frame has not been measured yet, so the
    // scroll effect would otherwise resolve against a zero-height scroller.
    editor.requestMeasure()
    editor.focus()
    if (target.settled) revealedIdentity = identity
  }

  const revealAfterMeasure = createAnimationFrameScheduler(revealLineRange)
  const revealOnLayout = createAnimationFrameScheduler(() => {
    const editor = view
    if (!editor) return
    if (!local.lineRange) {
      revealLineRange()
      return
    }
    if (revealIdentity() === revealedIdentity) return
    editor.requestMeasure({
      key: revealLineRange,
      read: () => {
        if (!host?.clientWidth || !host.clientHeight || host.closest("[inert], [hidden]")) {
          return { visible: false, moving: false }
        }
        for (let element: HTMLElement | null = host; element; element = element.parentElement) {
          if (element.getAnimations().some((animation) =>
            animation.playState === "running" && Number.isFinite(animation.effect?.getComputedTiming().endTime),
          )) return { visible: true, moving: true }
        }
        return { visible: true, moving: false }
      },
      write: ({ visible, moving }) => {
        if (view !== editor || !visible) return
        // CodeMirror is still updating in this callback. Dispatch the reveal
        // in the next frame, after measured wrapping and Dock motion settle.
        if (moving) revealOnLayout.schedule()
        else revealAfterMeasure.schedule()
      },
    })
  })

  onMount(() => {
    if (!host) return
    view = new EditorView({
      doc: local.value,
      parent: host,
      extensions: [
        basicSetup,
        ...overlayCodeEditorExtensions(),
        languageCompartment.of([]),
        EditorView.lineWrapping,
        readOnlyCompartment.of(readOnlyExtensions(!!local.readOnly)),
        EditorView.contentAttributes.of({ "aria-label": local.ariaLabel }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || applyingExternalValue) return
          local.onValueChange(update.state.doc.toString())
        }),
      ],
    })
    revealObserver = new ResizeObserver(revealOnLayout.schedule)
    revealObserver.observe(host)
    revealOnLayout.schedule()
  })

  createEffect(() => {
    const readOnly = !!local.readOnly
    view?.dispatch({ effects: readOnlyCompartment.reconfigure(readOnlyExtensions(readOnly)) })
  })

  createEffect(() => {
    const path = local.path
    void languageRetry()
    const editor = view
    if (!editor) return
    let disposed = false
    onCleanup(() => {
      disposed = true
    })
    const language = editorLanguage(path)
    setLanguageName(language?.name ?? "")
    setLanguageStatus(language ? "loading" : "ready")
    editor.dispatch({ effects: languageCompartment.reconfigure([]) })
    if (!language) return
    void language.load().then(
      (support) => {
        if (disposed || view !== editor) return
        editor.dispatch({ effects: languageCompartment.reconfigure(support) })
        setLanguageStatus("ready")
      },
      () => {
        if (disposed || view !== editor) return
        setLanguageStatus("failed")
      },
    )
  })

  createEffect(() => {
    const next = local.value
    const editor = view
    if (!editor) return
    const nextText = editor.state.toText(next)
    if (editor.state.doc.eq(nextText)) return
    applyingExternalValue = true
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: nextText,
      },
    })
    applyingExternalValue = false
  })

  // Declared after the value effect so a reveal always runs against the text
  // that effect has already applied — tracking `value` is what lets a citation
  // that arrived before its file content still land on the cited line.
  createEffect(() => {
    void local.path
    void local.value
    void local.lineRange?.startLine
    void local.lineRange?.endLine
    void local.lineRangeRevealRevision
    revealOnLayout.schedule()
  })

  onCleanup(() => {
    revealOnLayout.cancel()
    revealAfterMeasure.cancel()
    revealObserver?.disconnect()
    view?.destroy()
    view = undefined
  })

  return (
    <div {...rest} class={local.class ? `file-editor-code ${local.class}` : "file-editor-code"}>
      <div
        class="file-editor-view"
        ref={(node) => {
          host = node
        }}
      />
      <div class="file-editor-language" role="status" aria-live="polite">
        <span>
          {languageStatus() === "failed"
            ? t("file_editor.highlight_failed", { language: languageName() })
            : languageStatus() === "loading"
              ? t("file_editor.highlight_loading", { language: languageName() })
              : languageName() || t("file_editor.plain_text")}
        </span>
        <Show when={languageStatus() === "failed"}>
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => setLanguageRetry((value) => value + 1)}>
            {t("common.retry")}
          </Button>
        </Show>
      </div>
    </div>
  )
}
