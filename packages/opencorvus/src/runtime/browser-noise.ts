/**
 * Browser-implicit network noise classification for runtime page capture.
 *
 * A headless Chromium navigation produces two signals the app never authored:
 *
 *   1. The conventional root `/favicon.ico` request. Every browser issues it
 *      even when the HTML carries no `<link rel="icon">`; Vite / CRA / Next
 *      scaffolds ship no favicon, so the dev server answers 404. That 404 is
 *      a browser convention, not a broken app asset. The overlay server
 *      already special-cases the same path (see `src/server/server.ts`).
 *
 *   2. For every failed sub-resource load, Chromium mirrors the failure into a
 *      synthetic `console.error("Failed to load resource: ...")`. That is the
 *      *same* network failure the asset layer already owns by url+status.
 *      Counting it again as a JS runtime fault double-sources one signal
 *      (rule 8) and, because the console text carries no URL, it cannot be
 *      scoped by origin.
 *
 * Network-load failures stay single-sourced in the asset layer; the JS layer
 * keeps app faults only (uncaught exceptions, unhandled rejections, and
 * app-authored `console.error` calls).
 */

/** Conventional favicon path browsers request with no app `<link rel="icon">`. */
export function isBrowserImplicitAssetRequest(rawUrl: string): boolean {
  let pathname: string
  try {
    pathname = new URL(rawUrl).pathname
  } catch {
    return false
  }
  return pathname === "/favicon.ico"
}

/**
 * Chromium emits this exact prefix for every failed sub-resource load
 * (404 / net::ERR_* / blocked). Stable long-standing message format; it
 * never includes the resource URL, so the asset layer (url + status) is the
 * single source of truth for network-load failures.
 */
export function isResourceLoadConsoleError(text: string): boolean {
  return text.trimStart().startsWith("Failed to load resource:")
}
