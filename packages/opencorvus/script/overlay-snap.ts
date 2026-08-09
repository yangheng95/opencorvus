#!/usr/bin/env bun
// One-shot screenshot of the running overlay vite dev server.
// Uses the shared Node-sidecar browser launcher so Bun never connects to Playwright.
//   bun run script/overlay-snap.ts <out.png> [url] [w] [h]

import { launchBrowser } from "../../overlay/test/launch"
import { gotoWithBrowserInactivity } from "./browser-inactivity"
import path from "node:path"

const out = process.argv[2]
if (!out) {
  console.error("usage: bun run script/overlay-snap.ts <out.png> [url] [w] [h]")
  process.exit(2)
}
const url = process.argv[3] ?? "http://localhost:5173/"
const w = Number(process.argv[4] ?? 1400)
const h = Number(process.argv[5] ?? 900)

const browser = await launchBrowser(["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"])
try {
  const page = await browser.newPage()
  await page.setViewportSize({ width: w, height: h })
  await gotoWithBrowserInactivity(page, url, "networkidle", 15_000)
  await new Promise((r) => setTimeout(r, 800))
  const abs = path.resolve(out)
  await page.screenshot({ path: abs as `${string}.png`, fullPage: false })
  console.log(`screenshot → ${abs}`)
} finally {
  await browser.close()
}
