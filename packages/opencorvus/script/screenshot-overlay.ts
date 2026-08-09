#!/usr/bin/env bun
/**
 * Quick Playwright screenshot helper for the overlay UI.
 *
 * Usage:
 *   bun run script/screenshot-overlay.ts <out.png> [url] [w] [h]
 *
 * Defaults: url=http://localhost:5173/, viewport=1280x800.
 * Requires Chrome / Edge installed (auto-detected).
 */

import { launchBrowser } from "../../overlay/test/launch"
import { gotoWithBrowserInactivity } from "./browser-inactivity"
import path from "node:path"

const out = process.argv[2]
if (!out) {
  console.error("usage: bun run script/screenshot-overlay.ts <out.png> [url] [w] [h]")
  process.exit(2)
}
const url = process.argv[3] ?? "http://localhost:5173/"
const w = Number(process.argv[4] ?? 1280)
const h = Number(process.argv[5] ?? 800)

const browser = await launchBrowser(["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"])
try {
  const page = await browser.newPage()
  await page.setViewportSize({ width: w, height: h })
  await gotoWithBrowserInactivity(page, url, "networkidle", 15_000)
  // Give SolidJS another moment to render after networkidle.
  await new Promise((r) => setTimeout(r, 500))
  const abs = path.resolve(out)
  await page.screenshot({ path: abs as `${string}.png`, fullPage: false })
  console.log(`screenshot → ${abs}`)
} finally {
  await browser.close()
}
