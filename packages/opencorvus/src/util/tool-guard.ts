/**
 * Preserve the orchestrator tool-map boundary without intercepting execution.
 *
 * Tool errors are evidence. Host code must not replace repeated failures with
 * generated guidance because that hides the next real tool result.
 */
export function toolGuard<T extends Record<string, any>>(tools: T) {
  return { tools }
}
