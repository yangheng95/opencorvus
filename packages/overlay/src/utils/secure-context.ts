// ── secureContextHint ──
// Several browser APIs the overlay depends on exist only in a secure context:
// the clipboard and SubtleCrypto among them. Reached over plain HTTP from
// anything but localhost they are simply absent, and the failure that follows
// names an API rather than a cause.
//
// This turns that into something an operator can act on. It is a *message*
// helper, not a capability gate — callers still fail; they just say why.

/** Whether this page runs somewhere the restricted browser APIs exist. */
export function inSecureContext(): boolean {
  return typeof globalThis.isSecureContext === "boolean" ? globalThis.isSecureContext : true
}

/**
 * Explain why a secure-context API is missing.
 *
 * @param subject what the operator was trying to do, already localised.
 */
export function secureContextFailure(subject: string): string {
  return inSecureContext()
    ? `${subject} is unavailable in this browser`
    : `${subject} needs a secure context: open OpenCorvus over HTTPS, or from localhost`
}
