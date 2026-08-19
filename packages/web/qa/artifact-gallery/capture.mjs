/**
 * Capture one effect image per Interactive Artifact renderer from the real Overlay UI.
 *
 * This is a capture harness, not a test: it asserts nothing and gates nothing. It opens the running
 * server's Overlay, walks to each Mission session produced by run-missions.mjs, and takes an
 * element-level screenshot of that artifact's frame — the same DOM the product renders for a user.
 *
 *   node packages/web/qa/artifact-gallery/capture.mjs [--only map,network] [--out <dir>]
 */
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { chromium } from "playwright"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../../../..")

const BASE = process.env.GALLERY_BASE ?? "http://127.0.0.1:7893"
const RESULTS = path.join(repoRoot, "tmp/gallery-artifacts.json")

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

/**
 * Playwright pins one Chromium revision and refuses its neighbours; this machine has 1223/1234 from
 * other tooling and downloading another build to take a screenshot is not a reasonable ask.
 */
async function resolveExecutable() {
  if (process.env.OPENCORVUS_CHROMIUM) return process.env.OPENCORVUS_CHROMIUM
  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local", "ms-playwright")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
        : path.join(os.homedir(), ".cache", "ms-playwright"))
  const entries = await fs.readdir(root).catch(() => [])
  const builds = entries
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((left, right) => Number(right.split("-")[1]) - Number(left.split("-")[1]))
  for (const build of builds) {
    const candidate =
      process.platform === "win32"
        ? path.join(root, build, "chrome-win64", "chrome.exe")
        : process.platform === "darwin"
          ? path.join(root, build, "chrome-mac", "Chromium.app", "Contents/MacOS/Chromium")
          : path.join(root, build, "chrome-linux", "chrome")
    if (await fs.stat(candidate).then(() => true, () => false)) return candidate
  }
  return undefined
}

/** Renderers that mount a canvas/WebGL surface need longer than a DOM paint before they are worth a frame. */
const SETTLE_MS = {
  "map@1": 6000,
  "network@1": 7000,
  "model-3d@1": 9000,
  "candlestick@1": 5000,
  "chart@1": 5000,
  "dashboard@1": 6000,
  "diagram@1": 5000,
  "spreadsheet@1": 7000,
  "notebook@1": 3000,
  "presentation@1": 4000,
}

async function openMission(page, title) {
  // `:visible` matters: the Mission Board renders its own off-screen copy of every row title, and
  // an invisible match is what a plain .first() hands back.
  const row = page.locator(".work-row-title:visible").filter({ hasText: title }).first()
  if ((await row.count()) === 0) return false
  try {
    await row.click({ timeout: 15_000 })
  } catch {
    return false
  }
  // The hover card that follows the pointer would sit on top of the artifact in the frame grab.
  await page.mouse.move(20, 20)
  return true
}

async function main() {
  const results = JSON.parse(await fs.readFile(RESULTS, "utf8"))
  const only = (argument("only", "") || "").split(",").filter(Boolean)
  const outDir = path.resolve(argument("out", path.join(repoRoot, "tmp/gallery-shots")))
  await fs.mkdir(outDir, { recursive: true })

  /** Tall enough that most artifact frames fit without stitching; the loop grows it for the rest. */
  const VIEWPORT = { width: 1680, height: 1200 }

  const browser = await chromium.launch({ headless: true, executablePath: await resolveExecutable() })
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/ui/`, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.locator(".work-row-title").first().waitFor({ state: "visible", timeout: 90_000 })
  await page.waitForTimeout(1500)

  const captured = []
  for (const entry of Object.values(results)) {
    if (only.length && !only.includes(entry.id)) continue
    // With a squad holding the Mission, the artifact is published by a sub-agent under a Task, and
    // the Task's conversation only appears in the sidebar once its Mission row is selected — so the
    // Mission is opened first and the Task row second.
    const titles = [...new Set([entry.missionTitle, entry.conversationTitle].filter(Boolean))]
    let opened = false
    for (const title of titles) {
      if (await openMission(page, title)) {
        opened = true
        await page.waitForTimeout(2500)
      }
    }
    if (!opened) {
      console.log(`skip  ${entry.id} — no sidebar entry among ${titles.map((t) => `"${t}"`).join(", ")}`)
      continue
    }
    // `data-artifact-id` is only set when the renderer passes it through, so the frame is addressed
    // by class instead. Each Mission in this gallery publishes exactly one artifact, which makes the
    // first frame in the conversation the right one.
    const frame = page.locator(".msg-artifact").first()
    try {
      await frame.waitFor({ state: "visible", timeout: 60_000 })
    } catch {
      console.log(`skip  ${entry.id} — artifact frame never rendered`)
      continue
    }
    await frame.scrollIntoViewIfNeeded()
    await page.waitForTimeout(SETTLE_MS[entry.renderer] ?? 2500)

    // A frame taller than the viewport is stitched from two scroll positions, and the seam picks up
    // the composer and the card header. Growing the window is cheaper than cropping afterwards.
    const measured = await frame.boundingBox()
    if (measured && measured.height > VIEWPORT.height - 80) {
      await page.setViewportSize({ width: VIEWPORT.width, height: Math.min(Math.ceil(measured.height) + 160, 2400) })
      await frame.scrollIntoViewIfNeeded()
      await page.waitForTimeout(1500)
    }

    // Vega's chart menu opens on hover and would be baked into the frame; the pointer parks in the
    // far corner and Escape closes anything a click left open.
    await page.mouse.move(2, 2)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(600)

    const file = path.join(outDir, `${entry.id}.png`)
    await frame.screenshot({ path: file })
    const box = await frame.boundingBox()
    await page.setViewportSize(VIEWPORT)
    captured.push({ ...entry, file, width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0) })
    console.log(`shot  ${entry.id.padEnd(14)} ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`)
  }

  await fs.writeFile(path.join(outDir, "index.json"), JSON.stringify(captured, null, 2))
  await browser.close()
  console.log(`\n${captured.length} images in ${outDir}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
