/**
 * Visual baseline capture for the restyled public surfaces.
 *
 * Usage (dev server must already be running on --base):
 *   bun run ./qa/restyle/shoot.ts --out ./tmp/shots
 *   bun run ./qa/restyle/shoot.ts --out ./tmp/shots --only landing-1440-light-root
 *
 * This is the capture half of the 期 9 regression gate. It writes deterministic filenames so a
 * later diff step can pair them up. It does not diff anything itself.
 *
 * Determinism notes, because a screenshot harness that flickers is worse than none:
 *   - Animations are disabled through the reduced-motion emulation, which our CSS and the hero
 *     shader both honour, so the gradient holds a fixed frame instead of drifting between runs.
 *   - Scroll reveals are forced to their revealed state for the same reason.
 *   - We wait on document.fonts.ready; a screenshot taken mid-swap catches fallback metrics.
 */

import { mkdir, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { chromium, type Browser, type Page } from "playwright"

/**
 * Playwright pins one exact Chromium revision per release and refuses anything else. Developer
 * machines routinely have a neighbouring revision from some other tool, and downloading another
 * 150MB build to take a screenshot is not a reasonable ask. So: honour an explicit override, then
 * fall back to the newest already-installed build, and only then let Playwright's own resolution
 * (and its "run npx playwright install" message) take over.
 */
async function resolveExecutable(): Promise<string | undefined> {
  const override = process.env.OPENCORVUS_CHROMIUM
  if (override) return override

  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local", "ms-playwright")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
        : path.join(os.homedir(), ".cache", "ms-playwright"))
  if (!existsSync(root)) return undefined

  const binary =
    process.platform === "win32"
      ? path.join("chrome-win64", "chrome.exe")
      : process.platform === "darwin"
        ? path.join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium")
        : path.join("chrome-linux", "chrome")

  const candidates = (await readdir(root))
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
    .map((entry) => path.join(root, entry, binary))

  return candidates.find((candidate) => existsSync(candidate))
}

type Theme = "light" | "dark"
type Locale = "root" | "zh-cn"

const WIDTHS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
] as const

/**
 * The three public surfaces, with the width coverage each one earns.
 *
 * 24 baselines total: landing at all three widths, market at two, detail at one — all × 2 themes ×
 * 2 locales. Detail is the most template-driven of the three (one record shape, rendered the same
 * way every time), so a third width buys almost nothing; the landing page carries the bespoke
 * layout and gets full coverage.
 *
 * Detail needs a squad that exists in the catalog. `builtin/advanced` ships embedded, so it is
 * present in every publication rather than depending on what got imported.
 */
const SURFACES = [
  {
    name: "landing",
    widths: ["375", "768", "1440"],
    pathFor: (locale: Locale) => (locale === "root" ? "/" : "/zh-cn/"),
  },
  {
    name: "market",
    widths: ["768", "1440"],
    pathFor: (locale: Locale) => (locale === "root" ? "/market/" : "/zh-cn/market/"),
  },
  {
    name: "detail",
    widths: ["1440"],
    pathFor: (locale: Locale) =>
      locale === "root" ? "/market/builtin/advanced/" : "/zh-cn/market/builtin/advanced/",
  },
] as const

function arg(flag: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

const base = arg("--base", "http://localhost:4321")!.replace(/\/$/, "")
const outDir = path.resolve(arg("--out", "./tmp/shots")!)
const only = arg("--only")
const fullPage = !process.argv.includes("--viewport-only")

async function settle(page: Page) {
  // Reveals are IntersectionObserver-driven; off-screen ones never fire, and a full-page shot would
  // capture them mid-transition or invisible. Pin them.
  await page.addStyleTag({
    content: `
      .oc-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
      .oc-enter { animation: none !important; }
      .oc-caret { animation: none !important; }
    `,
  })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>(".oc-reveal").forEach((element) => {
      element.dataset.revealed = "true"
    })
    // Terminal typing is time-based; jump it to the end so the box is not caught half-typed.
    document.querySelectorAll<HTMLElement>("[data-oc-terminal-pane]").forEach((pane) => {
      const source = pane.querySelector<HTMLElement>("[data-oc-terminal-source]")
      const out = pane.querySelector<HTMLElement>("[data-oc-terminal-out]")
      if (source && out) out.textContent = source.textContent ?? ""
    })
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
}

async function shoot(browser: Browser, surface: string, url: string, width: (typeof WIDTHS)[number], theme: Theme, locale: Locale) {
  const name = `${surface}-${width.name}-${theme}-${locale}`
  if (only && name !== only) return null

  const context = await browser.newContext({
    viewport: { width: width.width, height: width.height },
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: "reduce",
    locale: locale === "zh-cn" ? "zh-CN" : "en-US",
  })
  const page = await context.newPage()

  const failures: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text())
  })

  try {
    // The landing page redirects to /zh-cn/ when the browser prefers Chinese, so pin the theme and
    // locale preferences before any script runs rather than fighting the redirect afterwards.
    await page.addInitScript(
      ([themeValue, localeValue]) => {
        try {
          localStorage.setItem("opencorvus.public-theme", themeValue)
          localStorage.setItem("opencorvus.public-locale", localeValue)
        } catch {
          // Non-fatal: the emulated colour scheme still applies.
        }
      },
      [theme, locale] as const,
    )

    const response = await page.goto(`${base}${url}`, { waitUntil: "load", timeout: 45_000 })
    if (!response || !response.ok()) failures.push(`document ${response?.status() ?? "no response"}`)
    await settle(page)
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage })
    return { name, failures }
  } finally {
    await context.close()
  }
}

await mkdir(outDir, { recursive: true })

/**
 * Try each viable browser in turn.
 *
 * A neighbouring bundled revision can launch its process and then never complete the CDP
 * handshake, which surfaces as a launch timeout rather than a version error — so "the binary
 * exists" is not evidence it will work. Installed stable channels are more reliable than a
 * mismatched bundle, so they go first, and every candidate is actually launched before being
 * believed.
 */
async function launchBrowser(): Promise<{ browser: Browser; via: string }> {
  const executablePath = await resolveExecutable()
  const candidates: { via: string; options: Parameters<typeof chromium.launch>[0] }[] = [
    { via: "channel:chrome", options: { channel: "chrome" } },
    { via: "channel:msedge", options: { channel: "msedge" } },
    ...(executablePath ? [{ via: `bundled:${path.basename(path.dirname(path.dirname(executablePath)))}`, options: { executablePath } }] : []),
    { via: "playwright default", options: {} },
  ]

  const problems: string[] = []
  for (const candidate of candidates) {
    try {
      const browser = await chromium.launch({ ...candidate.options, timeout: 60_000 })
      return { browser, via: candidate.via }
    } catch (error) {
      problems.push(`${candidate.via}: ${(error as Error).message.split("\n")[0]}`)
    }
  }
  throw new Error(`No usable Chromium.\n${problems.map((line) => `  - ${line}`).join("\n")}`)
}

const { browser, via } = await launchBrowser()
console.log(`chromium via ${via}`)
const results: { name: string; failures: string[] }[] = []

try {
  for (const surface of SURFACES) {
    // Each surface declares which widths it earns; see the SURFACES comment.
    const widths = WIDTHS.filter((width) => (surface.widths as readonly string[]).includes(width.name))
    for (const locale of ["root", "zh-cn"] as const) {
      for (const width of widths) {
        for (const theme of ["light", "dark"] as const) {
          const result = await shoot(browser, surface.name, surface.pathFor(locale), width, theme, locale)
          if (result) results.push(result)
        }
      }
    }
  }
} finally {
  await browser.close()
}

for (const result of results) {
  const suffix = result.failures.length ? `  ⚠ ${result.failures.slice(0, 3).join(" | ")}` : ""
  console.log(`${result.failures.length ? "warn" : "ok  "}  ${result.name}${suffix}`)
}
console.log(`\n${results.length} shots → ${outDir}`)
