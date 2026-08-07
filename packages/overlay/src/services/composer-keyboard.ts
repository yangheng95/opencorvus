/**
 * Reports whether a keyboard event still belongs to an Input Method Editor
 * (IME) composition instead of the Composer's submit shortcut.
 *
 * macOS WebKit can emit the Enter keydown that accepts a composition after
 * `compositionend`, so `isComposing` is already false. In that documented
 * event sequence, key code 229 identifies the input method's Process event.
 */
export function isComposerImeKeyboardEvent(
  event: Pick<KeyboardEvent, "isComposing" | "keyCode">,
): boolean {
  return event.isComposing || event.keyCode === 229
}
