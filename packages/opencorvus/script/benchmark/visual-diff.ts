#!/usr/bin/env bun

// Visual-diff CLI — thin wrapper around `src/acceptance/checks/visual.ts`.
//
// Usage:
//   --rendered <url>              live page URL to evaluate
//   --rendered-dir <projectDir>   serve dist/, build/, out/, or project root
//   --reference <pngPath>         reference screenshot
//   --viewport <WxH>              Playwright viewport (default: reference image size)
//   --threshold <0..1>            required mean SSIM floor
//   --worst-threshold <0..1>      required worst-5% window SSIM floor
//   --browser-launch-timeout-ms <n> required browser launch timeout
//   --navigation-timeout-ms <n>   required page navigation inactivity timeout
//   --settle-ms <n>               required post-load settle delay
//   --out <dir>                   write rendered.png + diff.json here (default repo .scratch/benchmark-runs/visual-diff-out)
//   --headless                    run Chromium headless
//
// Exit code: 0 = passed, 1 = failed, 2 = input/config error.
//
// Implementation lives in `@/evaluator/visual` so the orchestrator's per-goal
// evaluator can run the same visual check without shelling out.

import path from "node:path"
import { runVisualDiff, summarizeVisualReport } from "../../src/runtime/visual-page"
import { serveRenderedDir } from "./static-render-server"

function flag(name: string): string | undefined {
  const prefix = `${name}=`
  const argvMatch = process.argv.find((item) => item.startsWith(prefix))
  if (argvMatch) return argvMatch.slice(prefix.length)
  const idx = process.argv.indexOf(name)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function required(name: string): string {
  const value = flag(name)
  if (!value) {
    console.error(`[visual-diff] missing required flag: ${name}`)
    process.exit(2)
  }
  return value
}

function requiredNumber(name: string): number {
  const raw = required(name)
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`[visual-diff] ${name} must be a positive number, got ${raw}`)
    process.exit(2)
  }
  return value
}

function parseViewport(value: string): { width: number; height: number } | undefined {
  const match = value.match(/^(\d+)x(\d+)$/)
  if (!match) {
    console.error(`[visual-diff] invalid --viewport (expected WxH): ${value}`)
    process.exit(2)
  }
  return { width: Number(match[1]), height: Number(match[2]) }
}

async function main() {
  const renderedFlag = flag("--rendered")
  const renderedDirFlag = flag("--rendered-dir")
  if (!renderedFlag && !renderedDirFlag) {
    console.error(
      "[visual-diff] must provide --rendered with a live http(s) URL or --rendered-dir with an app directory",
    )
    process.exit(2)
  }
  if (renderedFlag && renderedDirFlag) {
    console.error("[visual-diff] pass only one of --rendered or --rendered-dir")
    process.exit(2)
  }
  if (renderedFlag && !/^https?:\/\//i.test(renderedFlag)) {
    console.error(`[visual-diff] --rendered must be a live http(s) URL: ${renderedFlag}`)
    process.exit(2)
  }
  const reference = required("--reference")
  const threshold = requiredNumber("--threshold")
  const worstThreshold = requiredNumber("--worst-threshold")
  const browserLaunchTimeoutMs = requiredNumber("--browser-launch-timeout-ms")
  const navigationTimeoutMs = requiredNumber("--navigation-timeout-ms")
  const settleMs = requiredNumber("--settle-ms")
  const headless = process.argv.includes("--headless") || process.env.OPENCORVUS_VISUAL_DIFF_HEADLESS === "1"
  const defaultOutDir = path.resolve(import.meta.dir, "../../../..", ".scratch", "benchmark-runs", "visual-diff-out")
  const outDir = path.resolve(flag("--out") ?? defaultOutDir)
  const viewportFlag = flag("--viewport")
  const viewport = viewportFlag ? parseViewport(viewportFlag) : undefined

  const server = renderedDirFlag ? await serveRenderedDir(path.resolve(renderedDirFlag)) : undefined
  let exitCode = 2
  try {
    const renderedResolved = renderedFlag ?? server?.url
    if (!renderedResolved) throw new Error("visual-diff: failed to resolve rendered target")
    console.log(`[visual-diff] rendered=${renderedResolved} reference=${reference}`)

    const report = await runVisualDiff({
      rendered: renderedResolved,
      reference,
      viewport,
      threshold,
      worstThreshold,
      outDir,
      browserLaunchTimeoutMs,
      navigationTimeoutMs,
      settleMs,
      headless,
    })
    const verdict = report.passed ? "PASS" : "FAIL"
    console.log(`[visual-diff] ${verdict} ${summarizeVisualReport(report)} out=${outDir}`)
    exitCode = report.passed ? 0 : 1
  } finally {
    if (server) await server.close()
  }
  process.exit(exitCode)
}

main().catch((err) => {
  console.error(`[visual-diff] error: ${err instanceof Error ? err.stack || err.message : String(err)}`)
  process.exit(2)
})
