import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")

function readOverlayFile(relativePath: string): string {
  return readFileSync(path.join(OVERLAY_ROOT, relativePath), "utf8")
}

function styleSrcDirective(csp: string): string {
  const directive = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("style-src"))
  if (!directive) throw new Error("the overlay CSP no longer declares a style-src directive")
  return directive
}

/**
 * Tauri stamps a nonce onto every inline `<style>` it finds in a shipped HTML
 * entry and then appends that nonce to `style-src`. A nonce in the source list
 * makes `'unsafe-inline'` inert — that is CSP, not a Tauri quirk — so the
 * packaged app silently refuses every stylesheet the app inserts at runtime:
 * CodeMirror's base theme (the editor's gutter stops sitting beside the text
 * and stacks above it), `@codemirror/merge`, and vega-embed. Dev builds are
 * served by Vite, which never goes through Tauri's asset pipeline, so the
 * breakage only ever appears in a packaged build.
 *
 * Listing `style-src` in `dangerousDisableAssetCspModification` keeps the
 * policy exactly as it is written here, and leaves Tauri's `script-src`
 * hardening in place.
 */
test("a CSP that leans on 'unsafe-inline' keeps Tauri out of style-src", () => {
  const config = JSON.parse(readOverlayFile("src-tauri/tauri.conf.json")) as {
    app: { security: { csp?: string; dangerousDisableAssetCspModification?: boolean | string[] } }
  }
  const security = config.app.security
  const csp = security.csp
  expect(csp).toBeString()

  const entriesWithInlineStyles = ["src/index.html", "src/native-menu.html"].filter((entry) =>
    readOverlayFile(entry).includes("<style"),
  )
  // The size contract vite plugin adds one more inline <style> to index.html at
  // build time, so an entry that looks clean in source can still ship one.
  expect(entriesWithInlineStyles).toContain("src/index.html")

  expect(styleSrcDirective(csp!)).toContain("'unsafe-inline'")
  expect(security.dangerousDisableAssetCspModification).toEqual(["style-src"])
})
