import { invertedEffects } from "@codemirror/commands"
import { StateEffect, StateField, type EditorState } from "@codemirror/state"
import {
  changeTextLineEndings,
  invertTextLineEndings,
  mapTextLineEndings,
  overrideTextLineEndings,
  readTextLineEndings,
  writeTextLineEndings,
  type LineSeparator,
  type TextLineEnding,
  type TextLineEndings,
} from "../../utils/text-line-endings"

const restoreEndings = StateEffect.define<readonly TextLineEnding[]>({ map: mapTextLineEndings })
const preferredEnding = StateEffect.define<LineSeparator>()

export const codeEditorLineEndings = StateField.define<TextLineEndings>({
  create: () => ({ preferred: "\n", entries: [] }),
  update(value, transaction) {
    let next = changeTextLineEndings(value, transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(restoreEndings)) next = overrideTextLineEndings(next, effect.value)
      if (effect.is(preferredEnding)) next = { ...next, preferred: effect.value }
    }
    return next
  },
})

export function codeEditorLineEndingExtensions(value: string) {
  return [
    codeEditorLineEndings.init(() => readTextLineEndings(value)),
    invertedEffects.of((transaction) => {
      const previous = transaction.startState.field(codeEditorLineEndings)
      const overrides = transaction.effects.flatMap((effect) => effect.is(restoreEndings) ? effect.value : [])
      const restored = invertTextLineEndings(previous, transaction.changes, overrides)
      const effects: StateEffect<unknown>[] = []
      if (restored.length) effects.push(restoreEndings.of(restored))
      if (transaction.effects.some((effect) => effect.is(preferredEnding))) effects.push(preferredEnding.of(previous.preferred))
      return effects
    }),
  ]
}

export function codeEditorLineEndingEffects(value: string) {
  const endings = readTextLineEndings(value)
  return [restoreEndings.of(endings.entries), preferredEnding.of(endings.preferred)]
}

export function codeEditorValue(state: EditorState): string {
  return writeTextLineEndings(state.doc, state.field(codeEditorLineEndings))
}
