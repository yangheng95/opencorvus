#!/usr/bin/env bun
// Visual+functional audit for the web-calculator deliverable.
// Walks the 16 spec requirements, builds the project, drives it with Playwright,
// and writes screenshots + a JSON verdict to <project>/.scratch/audit-report/.

import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { launchBrowser, type OverlayBrowser, type OverlayPage } from "../../../overlay/test/launch"
import { gotoWithBrowserInactivity, reloadWithBrowserInactivity } from "./browser-inactivity"

const PROJECT_DIR = process.argv[2]
if (!PROJECT_DIR) {
  console.error("usage: bun run script/benchmark/audit-calculator.ts <project-dir>")
  process.exit(2)
}
const ROOT = path.resolve(PROJECT_DIR)
const REPORT_DIR = path.join(ROOT, ".scratch", "audit-report")
await fs.mkdir(REPORT_DIR, { recursive: true })

type Finding = { id: string; req: string; status: "pass" | "fail"; note: string }
const findings: Finding[] = []
function record(id: string, req: string, status: Finding["status"], note: string) {
  findings.push({ id, req, status, note })
  const tag = status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${id} ${req} — ${note}`)
}

function childHasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForChildClose(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (childHasExited(child)) return true
  return await new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.off("close", onClose)
      resolve(value)
    }
    const onClose = () => finish(true)
    const timer = setTimeout(() => finish(childHasExited(child)), timeoutMs)
    child.once("close", onClose)
  })
}

async function terminateChildProcessTree(child: ChildProcess | null, label: string, graceMs = 1_500): Promise<void> {
  const pid = child?.pid
  if (!child || !pid || childHasExited(child)) return
  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true })
    if (result.error) {
      throw new Error(`[audit] ${label} failed to run taskkill for process tree ${pid}: ${result.error.message}`)
    }
    if (result.status !== 0 && !childHasExited(child)) {
      throw new Error(`[audit] ${label} taskkill exited with status ${result.status ?? "null"} for process tree ${pid}`)
    }
    if (!(await waitForChildClose(child, graceMs))) {
      throw new Error(`[audit] ${label} process tree did not exit after taskkill`)
    }
    return
  }
  try {
    process.kill(-pid, "SIGTERM")
  } catch (error) {
    throw new Error(
      `[audit] ${label} failed to signal POSIX process group ${pid}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  if (await waitForChildClose(child, graceMs)) return
  try {
    process.kill(-pid, "SIGKILL")
  } catch (error) {
    throw new Error(
      `[audit] ${label} failed to SIGKILL POSIX process group ${pid}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  if (!(await waitForChildClose(child, graceMs))) {
    throw new Error(`[audit] ${label} process tree did not exit after SIGKILL`)
  }
}

// --- 1. static inspection -------------------------------------------------
async function fileExists(p: string) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}
async function readSafe(p: string) {
  try {
    return await fs.readFile(p, "utf8")
  } catch {
    return ""
  }
}

const pkgPath = path.join(ROOT, "package.json")
const pkg = await readSafe(pkgPath)
const readme = await readSafe(path.join(ROOT, "README.md"))
const indexHtml = await readSafe(path.join(ROOT, "index.html"))

// Scan all source files for evidence of features (so we don't false-fail on UI tests that depend on visible elements).
async function listSrc(dir: string, out: string[] = []): Promise<string[]> {
  const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of ents) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === ".scratch") continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) await listSrc(p, out)
    else if (/\.(ts|tsx|js|jsx|html|css|md|json)$/i.test(e.name)) out.push(p)
  }
  return out
}
const srcFiles = await listSrc(ROOT)
const codeBundle = (await Promise.all(srcFiles.map(readSafe))).join("\n")

// --- 2. build -------------------------------------------------------------
function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; inactivityTimeoutMs?: number } = {},
): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, shell: true, detached: process.platform !== "win32" })
    const inactivityTimeoutMs = opts.inactivityTimeoutMs ?? 600_000
    let out = "",
      err = ""
    let settled = false
    let inactivityTimer: ReturnType<typeof setTimeout> | undefined
    const clearInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      inactivityTimer = undefined
    }
    const finish = (code: number) => {
      if (settled) return
      settled = true
      clearInactivityTimer()
      resolve({ code, out, err })
    }
    const resetInactivityTimer = (source: string) => {
      clearInactivityTimer()
      inactivityTimer = setTimeout(() => {
        err += `\n[audit] ${cmd} inactive for ${inactivityTimeoutMs}ms after ${source}; terminating process`
        void (async () => {
          try {
            await terminateChildProcessTree(child, `${cmd} inactivity`)
          } catch (error) {
            err += `\n[audit] ${cmd} process-tree termination failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          } finally {
            finish(-1)
          }
        })()
      }, inactivityTimeoutMs)
    }
    child.stdout.on("data", (d) => {
      out += d.toString()
      resetInactivityTimer("stdout")
    })
    child.stderr.on("data", (d) => {
      err += d.toString()
      resetInactivityTimer("stderr")
    })
    child.on("spawn", () => resetInactivityTimer("spawn"))
    child.on("error", (error) => {
      err += `\n[audit] ${cmd} failed to start: ${error instanceof Error ? error.message : String(error)}`
      finish(-1)
    })
    child.on("close", (code) => {
      finish(code ?? -1)
    })
  })
}

const hasNodeModules = await fileExists(path.join(ROOT, "node_modules"))
if (!hasNodeModules) {
  console.log("[audit] npm install …")
  const r = await run("npm", ["install", "--no-audit", "--no-fund"], { inactivityTimeoutMs: 600_000 })
  if (r.code !== 0) {
    record("BUILD-INSTALL", "npm install", "fail", `exit=${r.code}\n${r.err.slice(-1500)}`)
  } else record("BUILD-INSTALL", "npm install", "pass", "ok")
} else record("BUILD-INSTALL", "npm install", "pass", "node_modules already exists")

const pkgJson = pkg ? JSON.parse(pkg) : {}
const hasBuild = !!pkgJson.scripts?.build
if (hasBuild) {
  console.log("[audit] npm run build …")
  const r = await run("npm", ["run", "build"], { inactivityTimeoutMs: 300_000 })
  if (r.code !== 0) record("BUILD", "npm run build", "fail", `exit=${r.code}\n${(r.err || r.out).slice(-2000)}`)
  else record("BUILD", "npm run build", "pass", "ok")
} else record("BUILD", "npm run build", "fail", "no build script")

// --- 3. boot preview ------------------------------------------------------
let preview: ChildProcess | null = null
let baseURL = ""
async function fetchWithDeadline(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`fetch inactive for ${timeoutMs}ms`)), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function startPreview(): Promise<string> {
  // Vite preview on a deterministic port
  const port = 4173 + Math.floor(Math.random() * 200)
  preview = spawn("npx", ["--yes", "vite", "preview", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  })
  let log = ""
  let previewExit: { code: number | null; signal: NodeJS.Signals | null } | null = null
  preview.stdout?.on("data", (d) => {
    log += d.toString()
    markPreviewActivity("stdout")
  })
  preview.stderr?.on("data", (d) => {
    log += d.toString()
    markPreviewActivity("stderr")
  })
  preview.on("exit", (code, signal) => {
    previewExit = { code, signal }
    log += `\n[audit] preview exited code=${code ?? "null"} signal=${signal ?? "null"}`
    markPreviewActivity("stderr")
  })
  // Wait until "Local:" line shows up (vite logs the URL)
  const url = `http://127.0.0.1:${port}/`
  const previewStartupInactivityTimeoutMs = 30_000
  let lastPreviewActivityAt = Date.now()
  function markPreviewActivity(source: "stdout" | "stderr" | "authoritative-probe"): void {
    lastPreviewActivityAt = Date.now()
    log += `\n[audit] preview activity: ${source}`
  }
  while (Date.now() - lastPreviewActivityAt < previewStartupInactivityTimeoutMs) {
    if (previewExit) {
      throw new Error(
        `vite preview exited before startup code=${previewExit.code ?? "null"} signal=${previewExit.signal ?? "null"}: ${log.slice(-1000)}`,
      )
    }
    try {
      const remaining = previewStartupInactivityTimeoutMs - (Date.now() - lastPreviewActivityAt)
      const resp = await fetchWithDeadline(url, Math.max(100, Math.min(2_000, remaining)))
      if (resp.ok && log.includes(`127.0.0.1:${port}`)) {
        markPreviewActivity("authoritative-probe")
        return url
      }
      if (resp.ok) {
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      throw new Error(`vite preview returned HTTP ${resp.status}`)
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("vite preview returned HTTP ")) throw err
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`vite preview inactive for ${previewStartupInactivityTimeoutMs}ms: ${log.slice(-1000)}`)
}

try {
  baseURL = await startPreview()
  record("BOOT", "vite preview reachable", "pass", baseURL)
} catch (e: any) {
  record("BOOT", "vite preview reachable", "fail", String(e?.message || e))
}

// --- 4. drive UI ----------------------------------------------------------
let browser: OverlayBrowser | null = null
let page: OverlayPage | null = null
const consoleErrors: string[] = []
if (baseURL) {
  browser = await launchBrowser(["--no-sandbox", "--disable-setuid-sandbox"], { headless: false })
  page = await browser.newPage()
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`)
  })
  page.on("response", (response) => {
    const status = response.status()
    if (status >= 400) consoleErrors.push(`http ${status}: ${response.url()}`)
  })
  page.on("requestfailed", (request) => {
    const failure = request.failure()
    consoleErrors.push(`requestfailed: ${request.url()}${failure?.errorText ? ` ${failure.errorText}` : ""}`)
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoWithBrowserInactivity(page, baseURL, "networkidle", 30_000)
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: path.join(REPORT_DIR, "01-desktop-default.png"), fullPage: true })
}

async function shot(name: string) {
  if (!page) return
  await page.screenshot({ path: path.join(REPORT_DIR, name), fullPage: true })
}

async function readDisplay(): Promise<string> {
  if (!page) return ""
  return await page.evaluate(() => {
    const candidates = [
      ".display .result",
      ".display .current",
      ".display-current",
      ".display .value",
      ".display",
      "#display",
      "[data-testid=display]",
      ".screen",
      ".main-display",
      ".result",
      "#result",
      ".calculator__display",
    ]
    for (const sel of candidates) {
      const el = document.querySelector(sel)
      if (el && (el.textContent || "").trim()) return (el.textContent || "").trim()
    }
    throw new Error(`calculator display element not found; checked selectors: ${candidates.join(", ")}`)
  })
}

async function pressKey(key: string) {
  if (!page) return
  await page.keyboard.press(key)
}

async function typeKeys(s: string) {
  if (!page) return
  // page.keyboard.type() simulates per-character typing including shift for ()*+
  // (page.keyboard.press("+") would not generate the "+" without explicit Shift on a US layout).
  await page.keyboard.type(s, { delay: 20 })
}

if (page && baseURL) {
  // R1: arithmetic via keyboard 12+34
  await pressKey("Escape").catch(() => {})
  await typeKeys("12+34")
  await pressKey("Enter")
  await new Promise((r) => setTimeout(r, 300))
  const r1 = await readDisplay()
  record("R1-add", "12+34=46", /\b46\b/.test(r1) ? "pass" : "fail", `display="${r1}"`)
  await shot("02-after-12+34.png")

  // R1b: subtraction with negatives 5-12
  await pressKey("Escape").catch(() => {})
  await typeKeys("5-12")
  await pressKey("Enter")
  await new Promise((r) => setTimeout(r, 300))
  const r1b = await readDisplay()
  record("R1-neg", "5-12=-7", /-\s*7/.test(r1b) ? "pass" : "fail", `display="${r1b}"`)

  // R1c: division by zero -> Error
  await pressKey("Escape").catch(() => {})
  await typeKeys("8/0")
  await pressKey("Enter")
  await new Promise((r) => setTimeout(r, 300))
  const r1c = await readDisplay()
  record("R1-div0", "8/0 -> Error", /Error/i.test(r1c) ? "pass" : "fail", `display="${r1c}"`)
  await shot("03-divide-by-zero.png")

  // R2: parens & precedence (2+3)*4 = 20
  await pressKey("Escape").catch(() => {})
  await typeKeys("(2+3)*4")
  await pressKey("Enter")
  await new Promise((r) => setTimeout(r, 300))
  const r2 = await readDisplay()
  record("R2-parens", "(2+3)*4=20", /\b20\b/.test(r2) ? "pass" : "fail", `display="${r2}"`)
  // not using eval check: scan source for `eval(`
  const usesEval = /\beval\s*\(/.test(codeBundle.replace(/\beval\s*ate[A-Za-z]*\b/g, ""))
  record("R2-no-eval", "no use of eval()", usesEval ? "fail" : "pass", usesEval ? "found eval(" : "not found")

  // R3: %, x², √, 1/x, ± — verify required function keys by visible labels.
  const fnLabels = ["%", "x²", "√", "1/x", "±"]
  const fnPresent = await page.evaluate((labels) => {
    const buttons = Array.from(document.querySelectorAll("button, [role=button]"))
    const texts = new Set(buttons.map((b) => (b.textContent || "").trim()))
    return labels.map((l) => ({ l, present: texts.has(l) }))
  }, fnLabels)
  for (const f of fnPresent) {
    record(
      `R3-${f.l}`,
      `function key ${f.l} present`,
      f.present ? "pass" : "fail",
      f.present ? "" : "no button with that exact label",
    )
  }

  // R4: AC / C / ⌫ buttons present
  const clearLabels = ["AC", "C", "⌫"]
  const clearPresent = await page.evaluate((labels) => {
    const buttons = Array.from(document.querySelectorAll("button, [role=button]"))
    const texts = new Set(buttons.map((b) => (b.textContent || "").trim()))
    return labels.map((l) => ({ l, present: texts.has(l) }))
  }, clearLabels)
  for (const c of clearPresent) {
    record(`R4-${c.l}`, `clear key ${c.l} present`, c.present ? "pass" : "fail", c.present ? "" : "missing")
  }

  // R5: live expression display under main result
  const liveExprSource = /currentExpression|live[-_ ]expression|expression-display|active.*operand|highlight/i.test(
    codeBundle,
  )
  const liveExprRendered = await page.evaluate(() => {
    const selectorEvidence = [
      ".current-expression",
      ".live-expression",
      ".expression-display",
      ".operand-highlight",
      "[data-testid=expression]",
      "[data-testid=live-expression]",
    ].some((selector) => {
      const element = document.querySelector(selector)
      return !!element && !!(element.textContent || "").trim()
    })
    if (selectorEvidence) return true
    return Array.from(document.querySelectorAll("body *")).some((element) => {
      const className = typeof (element as HTMLElement).className === "string" ? (element as HTMLElement).className : ""
      return /expression|operand|highlight/i.test(className) && !!(element.textContent || "").trim()
    })
  })
  record(
    "R5-live-expr",
    "live expression / current operand highlight",
    liveExprRendered ? "pass" : "fail",
    liveExprRendered
      ? "rendered live expression evidence found"
      : liveExprSource
        ? "source references found but no rendered live expression evidence"
        : "no rendered live expression evidence",
  )

  // R6: history panel — rendered cap, clear action, click-to-fill, persistence
  const historyBeforeClick = await page.evaluate(() => {
    function visible(element: HTMLElement): boolean {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
    }
    function historyElements(): HTMLElement[] {
      const semantic = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-testid*=history i], [data-ui*=history i], .history, .history-item, [class*=history i], [id*=history i]",
        ),
      ).filter(visible)
      const scoped = semantic.flatMap((root) =>
        Array.from(root.querySelectorAll<HTMLElement>("button, [role=button], li, [data-testid], [data-ui]")).filter(
          visible,
        ),
      )
      return [...new Set([...semantic, ...scoped])].filter((element) => {
        const text = (element.textContent || "").replace(/\s+/g, " ").trim()
        return /\d/.test(text) && /[+\-*/=]|÷|×|√|%/.test(text)
      })
    }
    function clearControl(): HTMLElement | undefined {
      return Array.from(document.querySelectorAll<HTMLElement>("button, [role=button]")).find((element) => {
        if (!visible(element)) return false
        const text = `${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`
        const meta = `${element.id} ${element.className}`
        return /clear.*history|history.*clear|清空.*历史|历史.*清空/i.test(`${text} ${meta}`)
      })
    }
    const items = historyElements()
    const storage = Object.keys(localStorage)
      .filter((key) => /history/i.test(key))
      .map((key) => ({ key, value: localStorage.getItem(key) || "" }))
    return {
      count: items.length,
      sample: items.slice(0, 5).map((item) => (item.textContent || "").replace(/\s+/g, " ").trim()),
      hasClear: !!clearControl(),
      hasPersistedStorage: storage.some((entry) => entry.value.trim().length > 2),
    }
  })
  const historyFillBack = historyBeforeClick.count
    ? await page.evaluate(() => {
        function visible(element: HTMLElement): boolean {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
        }
        const item = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-testid*=history i] button, [data-ui*=history i] button, .history button, .history-item, [class*=history i] button, [id*=history i] button",
          ),
        ).find((element) => visible(element) && /\d/.test(element.textContent || ""))
        if (!item) return false
        item.click()
        return true
      })
    : false
  await new Promise((r) => setTimeout(r, 200))
  const historyDisplayAfterClick = historyFillBack ? await readDisplay() : ""
  await reloadWithBrowserInactivity(page, "networkidle", 30_000)
  await new Promise((r) => setTimeout(r, 500))
  const historyAfterReload = await page.evaluate(() => {
    function visible(element: HTMLElement): boolean {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
    }
    const historyItems = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid*=history i] button, [data-ui*=history i] button, .history button, .history-item, [class*=history i] button, [id*=history i] button",
      ),
    ).filter((element) => {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim()
      return visible(element) && /\d/.test(text) && /[+\-*/=]|÷|×|√|%/.test(text)
    })
    const item = historyItems[0]
    if (item) item.click()
    return {
      count: historyItems.length,
      sample: historyItems.slice(0, 5).map((element) => (element.textContent || "").replace(/\s+/g, " ").trim()),
      clicked: !!item,
    }
  })
  await new Promise((r) => setTimeout(r, 200))
  const historyDisplayAfterReloadClick = historyAfterReload.clicked ? await readDisplay() : ""
  record(
    "R6-cap20",
    "history cap = 20",
    historyBeforeClick.count > 0 && historyBeforeClick.count <= 20 ? "pass" : "fail",
    JSON.stringify({ count: historyBeforeClick.count, sample: historyBeforeClick.sample }),
  )
  record(
    "R6-clear",
    "clear history present",
    historyBeforeClick.hasClear ? "pass" : "fail",
    historyBeforeClick.hasClear ? "rendered clear-history control found" : "no rendered clear-history control",
  )
  record(
    "R6-fillback",
    "click history to fill back",
    historyFillBack && /\d/.test(historyDisplayAfterClick) ? "pass" : "fail",
    JSON.stringify({ clicked: historyFillBack, display: historyDisplayAfterClick }),
  )
  record(
    "R6-persist",
    "history persisted after reload",
    historyBeforeClick.hasPersistedStorage &&
      historyAfterReload.count > 0 &&
      historyAfterReload.count <= 20 &&
      /\d/.test(historyDisplayAfterReloadClick)
      ? "pass"
      : "fail",
    JSON.stringify({
      storage: historyBeforeClick.hasPersistedStorage,
      afterReload: historyAfterReload,
      display: historyDisplayAfterReloadClick,
    }),
  )

  // R7: keyboard already exercised (R1).  Now confirm Escape clears.
  await pressKey("Escape").catch(() => {})
  await new Promise((r) => setTimeout(r, 200))
  const afterEsc = await readDisplay()
  record("R7-escape", "Escape acts as AC", /^0$|^$/.test(afterEsc) ? "pass" : "fail", `after Esc display="${afterEsc}"`)

  // R7b: backspace
  await typeKeys("123")
  await pressKey("Backspace")
  await new Promise((r) => setTimeout(r, 200))
  const afterBs = await readDisplay()
  record("R7-backspace", "Backspace removes one digit", /^12\b/.test(afterBs) ? "pass" : "fail", `display="${afterBs}"`)

  // R8: pressed-state visual feedback
  const pressedTarget = await page.evaluate(() => {
    function visible(element: HTMLElement): boolean {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
    }
    const button = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button]")).find(
      (element) => visible(element) && /\d|[+\-*/=]|÷|×/.test(element.textContent || ""),
    )
    if (!button) return null
    const rect = button.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })
  const pressedBefore = pressedTarget
    ? await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button]")).find(
          (element) => /\d|[+\-*/=]|÷|×/.test(element.textContent || "") && element.getBoundingClientRect().width > 0,
        )
        if (!button) return ""
        const style = getComputedStyle(button)
        return JSON.stringify({
          className: button.className,
          background: style.backgroundColor,
          color: style.color,
          transform: style.transform,
          boxShadow: style.boxShadow,
          filter: style.filter,
          borderColor: style.borderColor,
        })
      })
    : ""
  if (pressedTarget) {
    await page.mouse.move(pressedTarget.x, pressedTarget.y)
    await page.mouse.down()
    await new Promise((r) => setTimeout(r, 120))
  }
  const pressedAfter = pressedTarget
    ? await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button]")).find(
          (element) => /\d|[+\-*/=]|÷|×/.test(element.textContent || "") && element.getBoundingClientRect().width > 0,
        )
        if (!button) return ""
        const style = getComputedStyle(button)
        return JSON.stringify({
          className: button.className,
          background: style.backgroundColor,
          color: style.color,
          transform: style.transform,
          boxShadow: style.boxShadow,
          filter: style.filter,
          borderColor: style.borderColor,
        })
      })
    : ""
  if (pressedTarget) await page.mouse.up()
  const pressedFeedback = !!pressedTarget && pressedBefore !== pressedAfter
  record(
    "R8-pressed",
    "pressed-state visual feedback",
    pressedFeedback ? "pass" : "fail",
    JSON.stringify({ hasButton: !!pressedTarget, changed: pressedFeedback }),
  )

  // R9: scientific notation > 12 digits
  await pressKey("Escape").catch(() => {})
  await typeKeys("1234567890123*9")
  await pressKey("Enter")
  await new Promise((r) => setTimeout(r, 300))
  const sci = await readDisplay()
  record(
    "R9-sci",
    "result switches to scientific notation when > 12 digits",
    /e\+?\d|E\+?\d/.test(sci) ? "pass" : "fail",
    `display="${sci}"`,
  )

  // R10: dark default + light theme toggle persisted
  const themePage = page
  const readThemeState = () =>
    themePage.evaluate(() => {
      function rgbLuma(value: string): number | null {
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value)
        if (!match) return null
        const r = Number(match[1])
        const g = Number(match[2])
        const b = Number(match[3])
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      function themeControl(): HTMLElement | undefined {
        const selectors = [
          "[data-testid=theme-toggle]",
          "[data-ui=theme-toggle]",
          ".theme-toggle",
          "#theme-toggle",
          "button[aria-label*=theme i]",
          "button[aria-label*=主题 i]",
        ]
        for (const selector of selectors) {
          const element = document.querySelector<HTMLElement>(selector)
          if (element) return element
        }
        const labels = /^(?:☀️|🌙|Light|Dark|浅色|深色)$/i
        return Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], .button, .btn")).find((item) =>
          labels.test((item.textContent || "").trim()),
        )
      }
      const bg = getComputedStyle(document.body).backgroundColor
      const luma = rgbLuma(bg)
      const rootTheme = document.documentElement.getAttribute("data-theme") || ""
      const bodyTheme = document.body.getAttribute("data-theme") || ""
      const classTheme = `${document.documentElement.className} ${document.body.className}`
      const storage = Object.keys(localStorage)
        .filter((key) => /theme/i.test(key))
        .sort()
        .map((key) => ({ key, value: localStorage.getItem(key) || "" }))
      const dark =
        /dark/i.test(`${rootTheme} ${bodyTheme} ${classTheme}`) ||
        (luma !== null && luma < 128 && !/light/i.test(`${rootTheme} ${bodyTheme} ${classTheme}`))
      const control = themeControl()
      return {
        hasToggle: !!control,
        dark,
        luma,
        bg,
        rootTheme,
        bodyTheme,
        classTheme,
        storage,
        signature: JSON.stringify({ rootTheme, bodyTheme, classTheme, bg, storage }),
      }
    })
  const themeBefore = await readThemeState()
  record(
    "R10-toggle",
    "theme toggle exists",
    themeBefore.hasToggle ? "pass" : "fail",
    themeBefore.hasToggle ? "rendered toggle control found" : "no rendered theme toggle control",
  )
  record(
    "R10-dark-default",
    "dark theme as default",
    themeBefore.dark ? "pass" : "fail",
    `theme=${themeBefore.rootTheme || themeBefore.bodyTheme || themeBefore.classTheme || "(none)"} bg=${themeBefore.bg}`,
  )
  const toggled = themeBefore.hasToggle
    ? await themePage.evaluate(() => {
        function themeControl(): HTMLElement | undefined {
          const selectors = [
            "[data-testid=theme-toggle]",
            "[data-ui=theme-toggle]",
            ".theme-toggle",
            "#theme-toggle",
            "button[aria-label*=theme i]",
            "button[aria-label*=主题 i]",
          ]
          for (const selector of selectors) {
            const element = document.querySelector<HTMLElement>(selector)
            if (element) return element
          }
          const labels = /^(?:☀️|🌙|Light|Dark|浅色|深色)$/i
          return Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], .button, .btn")).find(
            (item) => labels.test((item.textContent || "").trim()),
          )
        }
        const control = themeControl()
        if (!control) return false
        control.click()
        return true
      })
    : false
  await new Promise((r) => setTimeout(r, 300))
  const themeAfter = await readThemeState()
  const persistedTheme = themeAfter.storage.some((entry) => entry.value.trim().length > 0)
  record(
    "R10-storage",
    "theme persisted to localStorage",
    toggled && persistedTheme && themeAfter.signature !== themeBefore.signature ? "pass" : "fail",
    JSON.stringify({ toggled, before: themeBefore.storage, after: themeAfter.storage }),
  )
  await shot("04-after-theme-toggle.png")
  await reloadWithBrowserInactivity(themePage, "networkidle", 30_000)
  await new Promise((r) => setTimeout(r, 300))
  const themeAfterReload = await readThemeState()
  record(
    "R10-reload",
    "persisted theme restored after reload",
    toggled && persistedTheme && themeAfterReload.signature === themeAfter.signature ? "pass" : "fail",
    JSON.stringify({ after: themeAfter.storage, afterReload: themeAfterReload.storage, bg: themeAfterReload.bg }),
  )

  // R11: layout sanity — 4 columns, large monospace display, distinct operator color
  const layout = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, [role=button]"))
    const keyPattern =
      /^(?:\d|00|\.|=|\+|−|-|×|x|\*|÷|\/|%|AC|C|CE|DEL|Delete|⌫|Back|sin|cos|tan|log|ln|sqrt|√|\(|\)|π|pi|e|x²|x\^2)$/i
    const keys = buttons
      .map((b) => ({
        text: (b.textContent || "").trim(),
        cs: (() => {
          const r = b.getBoundingClientRect()
          const cs = getComputedStyle(b as Element)
          return {
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            bg: cs.backgroundColor,
            color: cs.color,
            font: cs.fontFamily,
          }
        })(),
      }))
      .filter((button) => button.cs.w > 0 && button.cs.h > 0 && keyPattern.test(button.text))
    const display = document.querySelector(".display, #display, .calculator__display, .screen, .main-display, .result")
    const dcs = display ? getComputedStyle(display as Element) : null
    return {
      buttons: keys,
      display: dcs ? { font: dcs.fontFamily, fontSize: dcs.fontSize, textAlign: dcs.textAlign } : null,
    }
  })
  await fs.writeFile(path.join(REPORT_DIR, "layout.json"), JSON.stringify(layout, null, 2))
  const xs = layout.buttons.map((b) => b.cs.x).filter((n) => Number.isFinite(n))
  const ys = layout.buttons.map((b) => b.cs.y).filter((n) => Number.isFinite(n))
  const cols = new Set(xs.map((x) => Math.round(x / 8)))
  const rows = new Set(ys.map((y) => Math.round(y / 8)))
  const colorKey = (button: (typeof layout.buttons)[number]) => `${button.cs.bg}|${button.cs.color}`
  const numberKeys = layout.buttons.filter((button) => /^(?:\d|00|\.)$/.test(button.text))
  const operatorKeys = layout.buttons.filter((button) =>
    /^(?:=|\+|−|-|×|x|\*|÷|\/|%|AC|C|CE|DEL|Delete|⌫|Back)$/i.test(button.text),
  )
  const functionKeys = layout.buttons.filter((button) =>
    /^(?:sin|cos|tan|log|ln|sqrt|√|\(|\)|π|pi|e|x²|x\^2)$/i.test(button.text),
  )
  const numberColors = new Set(numberKeys.map(colorKey))
  const operatorColors = new Set(operatorKeys.map(colorKey))
  const functionColors = new Set(functionKeys.map(colorKey))
  const colorDistinctFromNumbers = (colors: Set<string>) => [...colors].some((color) => !numberColors.has(color))
  record("R11-grid", "4-column keypad grid", cols.size === 4 ? "pass" : "fail", `unique x-buckets=${cols.size}`)
  record("R11-rows", "5-row keypad grid", rows.size === 5 ? "pass" : "fail", `unique y-buckets=${rows.size}`)
  record(
    "R11-operator-color",
    "operator keys have distinct color",
    numberColors.size > 0 && operatorColors.size > 0 && colorDistinctFromNumbers(operatorColors) ? "pass" : "fail",
    JSON.stringify({ numberColors: [...numberColors], operatorColors: [...operatorColors] }),
  )
  record(
    "R11-function-color",
    "function keys have distinct color",
    numberColors.size > 0 && functionColors.size > 0 && colorDistinctFromNumbers(functionColors) ? "pass" : "fail",
    JSON.stringify({ numberColors: [...numberColors], functionColors: [...functionColors] }),
  )
  record(
    "R11-mono",
    "monospace font on display",
    /mono|courier|consolas|menlo/i.test(layout.display?.font || "") ? "pass" : "fail",
    `font=${layout.display?.font}`,
  )
  record(
    "R11-right-align",
    "display right-aligned",
    /right|end/i.test(layout.display?.textAlign || "") ? "pass" : "fail",
    `textAlign=${layout.display?.textAlign}`,
  )

  // R12: mobile 360px
  await page.setViewportSize({ width: 360, height: 720 })
  await reloadWithBrowserInactivity(page, "networkidle", 30_000)
  await new Promise((r) => setTimeout(r, 800))
  await shot("05-mobile-360.png")
  const mobileCheck = await page.evaluate(() => {
    const root = document.querySelector(
      ".calculator, .calc, .calculator-container, main, body > *",
    ) as HTMLElement | null
    return root
      ? { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, overflow: getComputedStyle(root).overflow }
      : null
  })
  record(
    "R12-mobile",
    "mobile 360px renders without horizontal scroll",
    mobileCheck && mobileCheck.scrollWidth <= 380 ? "pass" : "fail",
    JSON.stringify(mobileCheck),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await reloadWithBrowserInactivity(page, "networkidle", 30_000)
  await new Promise((r) => setTimeout(r, 600))

  // R13: no lorem / no obvious placeholder text
  const visible = (await page.evaluate(() => document.body.innerText || "")) as string
  const placeholderHit = /lorem ipsum|TODO|FIXME|placeholder/i.test(visible)
  record(
    "R13-no-placeholder",
    "no lorem/TODO/placeholder visible",
    placeholderHit ? "fail" : "pass",
    placeholderHit ? "found in DOM" : "",
  )

  // R14/15/16: pure frontend, single entry, README
  const reactsHasBackend = /\b(server|express|koa|fastify|axios|fetch\(['"]https?:)/i.test(codeBundle)
  record(
    "R14-pure-frontend",
    "no backend / no external API",
    !reactsHasBackend || /https?:\/\/(localhost|127\.0\.0\.1)/.test(codeBundle) ? "pass" : "fail",
    "",
  )
  const hasIndexHtml = await fileExists(path.join(ROOT, "index.html"))
  const hasDist = await fileExists(path.join(ROOT, "dist", "index.html"))
  record(
    "R15-single-entry",
    "index.html as entry (or dist after build)",
    hasIndexHtml || hasDist ? "pass" : "fail",
    `index=${hasIndexHtml} dist=${hasDist}`,
  )
  const readmeHasRunInstructions = /(npm\s+(?:install|run\s+(?:dev|build|preview))|bun\s+run|yarn|pnpm)/i.test(readme)
  const readmeHasShortcuts = /(快捷键|shortcuts?|键盘|keyboard)/i.test(readme)
  record("R16-readme-run", "README has run instructions", readmeHasRunInstructions ? "pass" : "fail", "")
  record("R16-readme-shortcuts", "README documents keyboard shortcuts", readmeHasShortcuts ? "pass" : "fail", "")

  // Console errors are a hard fail per the spec.
  record(
    "R13-console",
    "no console errors / red text",
    consoleErrors.length === 0 ? "pass" : "fail",
    consoleErrors.slice(0, 5).join(" | "),
  )
}

// --- 5. tests / typecheck -------------------------------------------------
if (pkgJson.scripts?.["test:run"] || pkgJson.scripts?.test) {
  const r = await run("npm", ["run", pkgJson.scripts?.["test:run"] ? "test:run" : "test", "--", "--reporter=basic"], {
    inactivityTimeoutMs: 180_000,
  })
  record("TESTS", "unit tests", r.code === 0 ? "pass" : "fail", `exit=${r.code}\n${(r.err || r.out).slice(-1500)}`)
} else record("TESTS", "unit tests", "fail", "no test script in package.json")

// --- 6. cleanup -----------------------------------------------------------
const cleanupErrors: string[] = []
async function recordCleanup(label: string, action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    cleanupErrors.push(message)
    record(`CLEANUP-${label}`, `${label} cleanup`, "fail", message)
  }
}

if (browser) await recordCleanup("browser", () => browser.close())
if (preview) await recordCleanup("preview", () => terminateChildProcessTree(preview, "preview cleanup"))

// --- 7. report ------------------------------------------------------------
const passed = findings.filter((f) => f.status === "pass").length
const failed = findings.filter((f) => f.status === "fail").length
const summary = { project: ROOT, baseURL, totals: { passed, failed }, findings, consoleErrors }
await fs.writeFile(path.join(REPORT_DIR, "report.json"), JSON.stringify(summary, null, 2))

console.log(`\n[audit] ${passed} pass / ${failed} fail`)
console.log(`[audit] report → ${REPORT_DIR}`)
process.exit(failed > 0 ? 1 : 0)
