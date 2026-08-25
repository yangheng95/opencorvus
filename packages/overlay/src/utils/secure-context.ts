// ── secure-context ──
// Why a capability is missing, in the operator's language.
//
// A browser withholds the clipboard, SubtleCrypto and a few other APIs outside
// a secure context — HTTPS, or localhost. There is no equivalent to reach for:
// on a plain-HTTP LAN or Docker origin they are simply absent. All this module
// can do is replace "点了没反应" with the actual reason and the actual remedy.

import { t } from "./i18n"

/**
 * Whether this page is a secure context. A browser always answers; anything
 * else (a test, a non-browser render) is treated as secure, because claiming
 * an insecure origin without evidence would state a cause that may be false.
 */
export function inSecureContext(): boolean {
  return typeof globalThis.isSecureContext === "boolean" ? globalThis.isSecureContext : true
}

/**
 * Why `subjectKey`'s capability is unavailable here, localised.
 *
 * @param subjectKey i18n key naming what the operator was trying to do.
 */
export function secureContextFailure(subjectKey: string): string {
  const subject = t(subjectKey)
  return inSecureContext()
    ? t("secure_context.unsupported", { subject })
    : t("secure_context.needs_https", { subject })
}
