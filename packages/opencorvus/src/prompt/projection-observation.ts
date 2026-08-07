/**
 * Observability for model-visible prompt and tool projections.
 *
 * The target is diagnostic only. It never truncates, rejects, ranks, or
 * changes the projected value.
 */
export namespace PromptProjectionObservation {
  export const CHARACTER_TARGET = 20_000

  export function record(text: string, label: string): void {
    if (text.length <= CHARACTER_TARGET) return
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        `[PromptProjectionObservation] ${label} projected ${text.length} chars ` +
          `(>${CHARACTER_TARGET} target). Prefer exact durable locators over copied payloads.`,
      )
    }
  }
}
