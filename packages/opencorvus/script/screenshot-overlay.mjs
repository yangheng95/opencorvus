#!/usr/bin/env node
/**
 * Single manual visual-review tool: render a real page in a real browser and
 * write one screenshot for human inspection.
 *
 * Usage:
 *   node packages/opencorvus/script/screenshot-overlay.mjs <out.png> [url] [w] [h]
 *
 * Defaults: url=http://127.0.0.1:7878/ui (the repository serve default),
 * viewport=1440x900.
 *
 * Playwright is launched from Node.js, never from Bun, and drives the system
 * Google Chrome install. Navigation is bounded by
 * a browser-activity inactivity budget instead of a fixed wall-clock timeout, so
 * a slow but progressing page is not cut off while a stalled page still fails.
 */

import path from "node:path"
import { chromium } from "playwright"

const NAVIGATION_INACTIVITY_MS = 15_000
const RENDER_CEILING_MS = 60_000
const POST_IDLE_RENDER_MS = 2_000
/**
 * The document ships a static startup surface inside the application host so a
 * native window is never empty. The renderer replaces it when it mounts, so
 * "the host has a child that is not that surface" is the first moment the real
 * application is on screen.
 */
const MOUNTED_APPLICATION_SELECTOR = "#overlayAppHost > :not(.oc-startup-surface)"

const out = process.argv[2]
if (!out) {
  console.error("usage: node packages/opencorvus/script/screenshot-overlay.mjs <out.png> [url] [w] [h]")
  process.exit(2)
}
const url = process.argv[3] ?? "http://127.0.0.1:7878/ui"
const width = Number(process.argv[4] ?? 1440)
const height = Number(process.argv[5] ?? 900)

function activityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return `${event} ${payload.url()}`
  if (payload && typeof payload.message === "string") return `${event} ${payload.message}`
  if (payload && typeof payload.errorText === "string") return `${event} ${payload.errorText}`
  if (payload && typeof payload.text === "function") return `${event} ${payload.text()}`
  return event
}

/** Run `action` while requiring observable browser activity at least every `inactivityMs`. */
async function withBrowserInactivityTimeout(page, label, inactivityMs, action) {
  let settled = false
  let lastActivity = "start"
  let timer
  let rejectInactive
  const inactive = new Promise((_resolve, reject) => {
    rejectInactive = reject
  })
  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  const reset = (source) => {
    if (settled) return
    lastActivity = source
    clearTimer()
    timer = setTimeout(() => {
      rejectInactive?.(new Error(`${label} browser inactive for ${inactivityMs}ms after ${lastActivity}`))
    }, inactivityMs)
  }
  const fail = (source) => {
    if (settled) return
    lastActivity = source
    clearTimer()
    rejectInactive?.(new Error(`${label} browser error before idle: ${source}`))
  }
  const onConsole = (payload) => reset(activityLabel("console", payload))
  const onResponse = (payload) => {
    // Only the page's own document response decides whether there is anything
    // to review. A missing icon or an optional subresource is noise, and a
    // manual review tool that turns noise into "no evidence produced" is worse
    // than one that captures the page and lets the reviewer see the problem.
    const isDocument = typeof payload?.url === "function" && payload.url() === page.url()
    if (isDocument && typeof payload?.status === "function" && payload.status() >= 400) {
      fail(activityLabel("response", payload))
      return
    }
    reset(activityLabel("response", payload))
  }
  const onRequestFailed = (payload) => fail(activityLabel("requestfailed", payload))
  const onPageError = (payload) => fail(activityLabel("pageerror", payload))
  page.on("console", onConsole)
  page.on("response", onResponse)
  page.on("requestfailed", onRequestFailed)
  page.on("pageerror", onPageError)
  reset("start")
  try {
    return await Promise.race([action(), inactive])
  } finally {
    settled = true
    clearTimer()
    page.off("console", onConsole)
    page.off("response", onResponse)
    page.off("requestfailed", onRequestFailed)
    page.off("pageerror", onPageError)
  }
}

// Drive the system Google Chrome install rather than a Playwright-managed
// build: this is a manual review tool, the reviewer wants the pixels a real
// user sees, and a screenshot must not depend on a browser download. Chrome is
// required; a missing install fails loudly instead of quietly rendering
// somewhere else.
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
})
try {
  const page = await browser.newPage({ viewport: { width, height } })
  // The product page holds a live event stream open for its whole lifetime, so
  // "no in-flight request" is never true and cannot be the wait condition. Wait
  // for the document to load, then for the renderer to actually paint its shell.
  await withBrowserInactivityTimeout(page, `goto ${url}`, NAVIGATION_INACTIVITY_MS, () =>
    page.goto(url, { waitUntil: "load", timeout: 0 }),
  )
  await withBrowserInactivityTimeout(page, "render", NAVIGATION_INACTIVITY_MS, () =>
    page.waitForSelector(MOUNTED_APPLICATION_SELECTOR, { state: "attached", timeout: RENDER_CEILING_MS }),
  )
  await page.waitForTimeout(POST_IDLE_RENDER_MS)
  const absolute = path.resolve(out)
  await page.screenshot({ path: absolute, fullPage: false })
  console.log(`screenshot → ${absolute}`)
} finally {
  await browser.close()
}
