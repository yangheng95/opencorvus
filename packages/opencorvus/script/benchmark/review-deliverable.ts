/**
 * Rule-7 self-review helper for a rendered deliverable.
 *
 * Boots an isolated Playwright browser, screenshots the target URL passed as
 * argv[2], and writes the result to argv[3]/review-rendered.png. Returns a
 * summary string the operator can compare side-by-side with whatever reference
 * image the caller chose.
 */
import path from "node:path"
import fs from "node:fs/promises"
import { launchBrowser } from "../../../overlay/test/launch"
import { gotoWithBrowserInactivity } from "./browser-inactivity"

function requiredArg(index: number, label: string): string {
  const value = process.argv[index]?.trim()
  if (!value) {
    throw new Error(
      `Usage: bun packages/opencorvus/script/benchmark/review-deliverable.ts <target-url> <output-dir>; missing ${label}`,
    )
  }
  return value
}

const TARGET = requiredArg(2, "target URL")
const OUT_DIR = requiredArg(3, "output directory")
const OUT = path.join(OUT_DIR, "review-rendered.png")

const browser = await launchBrowser(["--no-sandbox", "--disable-setuid-sandbox"], { headless: false })
try {
  const page = await browser.newPage()
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`)
  })
  page.on("response", (response) => {
    const status = response.status()
    if (status >= 400) errors.push(`http ${status}: ${response.url()}`)
  })
  page.on("requestfailed", (request) => {
    const failure = request.failure()
    errors.push(`requestfailed: ${request.url()}${failure?.errorText ? ` ${failure.errorText}` : ""}`)
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  console.log(`[review] navigating ${TARGET}`)
  const resp = (await gotoWithBrowserInactivity(page, TARGET, "networkidle", 60_000)) as {
    status?: () => number
  } | null
  const status = resp?.status()
  console.log(`[review] HTTP ${status ?? "?"}`)
  if (!resp || status === undefined || status >= 400) {
    errors.push(`navigation http ${status ?? "missing"}: ${TARGET}`)
  }
  await new Promise((r) => setTimeout(r, 3_000))
  await page.screenshot({ path: OUT, type: "png", fullPage: true })
  const stat = await fs.stat(OUT)
  console.log(`[review] wrote ${OUT} (${Math.round(stat.size / 1024)} KB)`)

  await new Promise((r) => setTimeout(r, 1_500))
  if (errors.length > 0) {
    const message = `[review] ${errors.length} runtime/network error(s):\n${errors.slice(0, 10).join("\n")}`
    console.error(message)
    throw new Error(message)
  }
  console.log(`[review] no runtime errors`)
} finally {
  await browser.close()
}
