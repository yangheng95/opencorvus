import fs from "node:fs/promises"
import path from "node:path"

import { BrowserRuntime } from "@/browser/runtime"
import { runTaskBrowserNodeSidecar } from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"

export interface RuntimeStateViewport {
  width: number
  height: number
}

export interface RuntimeStateCaptureInput {
  processIdentity: Readonly<{ taskID: string; cwd: string }>
  url: string
  outputDir: string
  viewport: RuntimeStateViewport
  signal?: AbortSignal
  onProgress?: (message: string) => void
}

export interface RuntimeStateElement {
  index: number
  selector: string
  tag: string
  role?: string
  text?: string
  href?: string
  aria?: Record<string, string>
  bounds: { x: number; y: number; w: number; h: number }
  documentBounds: { x: number; y: number; w: number; h: number }
  styles: {
    display: string
    position: string
    top: string
    zIndex: string
    backgroundColor: string
    border: string
    boxShadow: string
    color: string
    fontSize: string
    fontWeight: string
  }
  classes: string[]
}

export interface RuntimeStateSnapshot {
  id: string
  label: string
  scrollY: number
  viewport: RuntimeStateViewport
  documentHeight: number
  screenshot: string
  interactiveElements: RuntimeStateElement[]
  persistentElements: RuntimeStateElement[]
  navigationClusters: Array<{
    label: string
    itemCount: number
    texts: string[]
    bounds: { x: number; y: number; w: number; h: number }
    roles: string[]
  }>
}

export interface RuntimeStateObservation {
  kind: "persistent-viewport-position"
  description: string
  elementKey: string
  texts: string[]
  roles: string[]
  scrollYs: number[]
  viewportYRange: { min: number; max: number }
  documentYRange: { min: number; max: number }
  evidenceSnapshotIds: string[]
}

export interface RuntimeStateEvidence {
  version: 1
  purpose: "webpage-runtime-interaction-state-evidence"
  source: {
    url: string
    viewport: RuntimeStateViewport
    captureEngine: "playwright"
  }
  artifacts: {
    screenshotsDir: string
  }
  snapshots: RuntimeStateSnapshot[]
  observations: RuntimeStateObservation[]
}

const STATE_POINTS = [
  { id: "initial", label: "initial viewport", ratio: 0 },
  { id: "scroll-25", label: "scroll 25 percent", ratio: 0.25 },
  { id: "scroll-50", label: "scroll 50 percent", ratio: 0.5 },
  { id: "scroll-75", label: "scroll 75 percent", ratio: 0.75 },
] as const

export async function captureWebpageRuntimeStateEvidence(
  input: RuntimeStateCaptureInput,
): Promise<RuntimeStateEvidence> {
  const stateDir = path.join(input.outputDir, "interaction-states")
  await fs.mkdir(stateDir, { recursive: true })
  await fs.mkdir(path.join(input.outputDir, "source-ir"), { recursive: true })
  input.onProgress?.(`Capturing runtime state evidence: ${input.url}`)

  const snapshots = await captureRuntimeStateSnapshotsViaNode({
    processIdentity: input.processIdentity,
    url: input.url,
    outputDir: input.outputDir,
    viewport: input.viewport,
    signal: input.signal,
  })

  const evidence: RuntimeStateEvidence = {
    version: 1,
    purpose: "webpage-runtime-interaction-state-evidence",
    source: {
      url: input.url,
      viewport: input.viewport,
      captureEngine: "playwright",
    },
    artifacts: {
      screenshotsDir: "interaction-states",
    },
    snapshots,
    observations: deriveRuntimeStateObservations(snapshots),
  }

  await fs.writeFile(
    path.join(input.outputDir, "source-ir", "interaction-state-snapshots.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  )
  return evidence
}

type NodeRuntimeStateInput = {
  url: string
  outputDir: string
  viewport: RuntimeStateViewport
  executablePath: string
  launchArgs: string[]
  launchTimeoutMs: number
  navigationTimeoutMs: number
  captureFunctionSource: string
  statePoints: typeof STATE_POINTS
}

type NodeRuntimeStateResult =
  | {
      ok: true
      snapshots: RuntimeStateSnapshot[]
    }
  | {
      ok: false
      phase: "launch" | "navigate" | "capture" | "close"
      message: string
      stack?: string
    }

async function captureRuntimeStateSnapshotsViaNode(input: {
  processIdentity: Readonly<{ taskID: string; cwd: string }>
  url: string
  outputDir: string
  viewport: RuntimeStateViewport
  signal?: AbortSignal
}): Promise<RuntimeStateSnapshot[]> {
  if (input.signal?.aborted) throw input.signal.reason
  const runtime = await resolveBrowserNodeSidecarRuntime()
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const launchTimeoutMs = BrowserRuntime.resolveBrowserLaunchTimeoutMs()
  const payloadInput: NodeRuntimeStateInput = {
    url: input.url,
    outputDir: input.outputDir,
    viewport: input.viewport,
    executablePath,
    launchArgs: BrowserRuntime.defaultLaunchArgs({
      extraArgs: [
        "--disable-extensions",
        "--disable-background-networking",
        `--window-size=${input.viewport.width},${input.viewport.height}`,
      ],
    }),
    launchTimeoutMs,
    navigationTimeoutMs: 60_000,
    captureFunctionSource: browserCaptureRuntimeState.toString(),
    statePoints: STATE_POINTS,
  }
  const inactivityTimeoutMs = launchTimeoutMs + 60_000 + 30_000
  const run = await runTaskBrowserNodeSidecar<NodeRuntimeStateResult>(input.processIdentity, {
    runtime,
    script: NODE_RUNTIME_STATE_SCRIPT,
    payload: payloadInput,
    inactivityTimeoutMs,
    signal: input.signal,
    label: "Node runtime state capture",
  })
  const { result } = run

  if (!result.ok) {
    throw new Error(`Node runtime state capture failed during ${result.phase}: ${result.message}`, {
      cause: result.stack ? new Error(result.stack) : undefined,
    })
  }
  if (run.exitCode !== 0) {
    throw new Error(`Node runtime state capture exited with ${run.signal ?? run.exitCode}. stderr=${run.stderr.trim()}`)
  }
  return result.snapshots
}

function browserCaptureRuntimeState(args: { id: string; label: string; screenshot: string }): RuntimeStateSnapshot {
  function textOf(el: Element): string | undefined {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim()
    return text ? text.slice(0, 160) : undefined
  }

  function selectorOf(el: Element): string {
    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ""
    const classes =
      typeof el.className === "string"
        ? el.className
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((item) => `.${item}`)
            .join("")
        : ""
    return `${tag}${id}${classes}`
  }

  function ariaOf(el: Element): Record<string, string> | undefined {
    const attrs = Array.from(el.attributes).filter((attr) => attr.name.startsWith("aria-"))
    if (!attrs.length) return undefined
    return Object.fromEntries(attrs.map((attr) => [attr.name, attr.value]))
  }

  function isVisible(el: Element, style: CSSStyleDeclaration): boolean {
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight
  }

  function elementRecord(el: Element, index: number): RuntimeStateElement {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    const href = el instanceof HTMLAnchorElement ? el.href : undefined
    const role = el.getAttribute("role") || undefined
    const classes = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 8) : []
    return {
      index,
      selector: selectorOf(el),
      tag: el.tagName.toLowerCase(),
      role,
      text: textOf(el),
      href,
      aria: ariaOf(el),
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      documentBounds: {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      styles: {
        display: style.display,
        position: style.position,
        top: style.top,
        zIndex: style.zIndex,
        backgroundColor: style.backgroundColor,
        border: style.border,
        boxShadow: style.boxShadow,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      },
      classes,
    }
  }

  const candidates = Array.from(document.querySelectorAll("a,button,input,select,textarea,[role],[tabindex],summary"))
  const interactiveElements = candidates
    .filter((el) => isVisible(el, window.getComputedStyle(el)))
    .slice(0, 160)
    .map(elementRecord)

  const persistentElements = Array.from(document.querySelectorAll("body *"))
    .filter((el) => {
      const style = window.getComputedStyle(el)
      return isVisible(el, style) && (style.position === "sticky" || style.position === "fixed")
    })
    .slice(0, 80)
    .map(elementRecord)

  const navigationClusters = buildNavigationClusters(interactiveElements)
  return {
    id: args.id,
    label: args.label,
    scrollY: Math.round(window.scrollY),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    screenshot: args.screenshot,
    interactiveElements,
    persistentElements,
    navigationClusters,
  }

  function buildNavigationClusters(elements: RuntimeStateElement[]): RuntimeStateSnapshot["navigationClusters"] {
    const rows = new Map<number, RuntimeStateElement[]>()
    for (const element of elements) {
      if (!element.text || element.bounds.w < 12 || element.bounds.h < 12) continue
      const row = Math.round(element.bounds.y / 12) * 12
      const group = rows.get(row) ?? []
      group.push(element)
      rows.set(row, group)
    }
    return Array.from(rows.entries())
      .map(([rowY, items]) => ({ rowY, items: items.sort((a, b) => a.bounds.x - b.bounds.x) }))
      .filter(({ items }) => items.length >= 3)
      .slice(0, 12)
      .map(({ rowY, items }) => {
        const left = Math.min(...items.map((item) => item.bounds.x))
        const top = Math.min(...items.map((item) => item.bounds.y))
        const right = Math.max(...items.map((item) => item.bounds.x + item.bounds.w))
        const bottom = Math.max(...items.map((item) => item.bounds.y + item.bounds.h))
        return {
          label: `interactive row near y=${rowY}`,
          itemCount: items.length,
          texts: items
            .map((item) => item.text)
            .filter((text): text is string => Boolean(text))
            .slice(0, 16),
          roles: Array.from(new Set(items.map((item) => item.role || item.tag))).slice(0, 8),
          bounds: { x: left, y: top, w: right - left, h: bottom - top },
        }
      })
  }
}

const NODE_RUNTIME_STATE_SCRIPT = String.raw`
const path = require("node:path");
const { chromium } = require(process.argv[3] || "playwright");

function opencorvusActivityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

function opencorvusIsBrowserImplicitAssetRequest(rawUrl) {
  try {
    return new URL(rawUrl).pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

function opencorvusRequestUrl(payload) {
  const request = payload && typeof payload.request === "function" ? payload.request() : payload;
  if (request && typeof request.url === "function") return request.url();
  if (payload && typeof payload.url === "function") return payload.url();
  return "";
}

function opencorvusResourceType(payload) {
  const request = payload && typeof payload.request === "function" ? payload.request() : payload;
  return request && typeof request.resourceType === "function" ? request.resourceType() : "";
}

function opencorvusUrlScope(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "file:") return "file:";
    if (parsed.origin && parsed.origin !== "null") return parsed.origin;
    return "";
  } catch {
    return "";
  }
}

function opencorvusIsSameOrigin(pageUrl, rawUrl) {
  const pageScope = opencorvusUrlScope(pageUrl);
  const requestScope = opencorvusUrlScope(rawUrl);
  return Boolean(pageScope && requestScope && pageScope === requestScope);
}

function opencorvusIsPrimaryNavigationRequest(payload) {
  const request = payload && typeof payload.request === "function" ? payload.request() : payload;
  return Boolean(request && typeof request.isNavigationRequest === "function" && request.isNavigationRequest());
}

function opencorvusIsCriticalPageRequestFailure(pageUrl, payload) {
  const url = opencorvusRequestUrl(payload);
  if (opencorvusIsBrowserImplicitAssetRequest(url)) return false;
  if (opencorvusIsPrimaryNavigationRequest(payload)) return true;
  if (!opencorvusIsSameOrigin(pageUrl, url)) return false;
  const type = opencorvusResourceType(payload);
  return (
    type === "document" ||
    type === "script" ||
    type === "stylesheet" ||
    type === "xhr" ||
    type === "fetch" ||
    type === "image" ||
    type === "media" ||
    type === "font"
  );
}

function opencorvusErrorStack(error) {
  if (error && typeof error.stack === "string") return error.stack;
  if (error && typeof error.message === "string") return error.message;
  return String(error || "");
}

function opencorvusIsSameOriginPageError(pageUrl, error) {
  const stack = opencorvusErrorStack(error);
  const scope = opencorvusUrlScope(pageUrl);
  return Boolean(scope && stack.includes(scope));
}

async function opencorvusWithBrowserInactivity(page, pageUrl, label, inactivityTimeoutMs, action) {
  let settled = false;
  let lastActivity = "start";
  let timer;
  let rejectInactive;
  let rejectFailure;
  const listeners = [];
  const inactive = new Promise((_, reject) => {
    rejectInactive = reject;
  });
  const browserFailure = new Promise((_, reject) => {
    rejectFailure = reject;
  });
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const reset = (source) => {
    if (settled) return;
    lastActivity = source;
    clearTimer();
    timer = setTimeout(() => {
      rejectInactive(new Error(label + " browser inactive for " + inactivityTimeoutMs + "ms after " + lastActivity));
    }, inactivityTimeoutMs);
  };
  const fail = (source) => {
    if (settled) return;
    rejectFailure(new Error(label + " Browser failures before runtime-state capture: " + source));
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => {
    reset(opencorvusActivityLabel("console", payload));
  });
  on("response", (payload) => {
    const status = typeof payload.status === "function" ? payload.status() : 0;
    if (
      status >= 400 &&
      status < 600 &&
      !opencorvusIsPrimaryNavigationRequest(payload) &&
      opencorvusIsCriticalPageRequestFailure(pageUrl, payload)
    ) {
      fail(opencorvusActivityLabel("response", payload) + " HTTP " + status);
      return;
    }
    reset(opencorvusActivityLabel("response", payload));
  });
  on("requestfailed", (payload) => {
    if (opencorvusIsCriticalPageRequestFailure(pageUrl, payload)) {
      fail(opencorvusActivityLabel("requestfailed", payload));
      return;
    }
    reset(opencorvusActivityLabel("requestfailed", payload));
  });
  on("pageerror", (payload) => {
    if (opencorvusIsSameOriginPageError(pageUrl, payload)) {
      fail(opencorvusActivityLabel("pageerror", payload));
      return;
    }
    reset(opencorvusActivityLabel("pageerror", payload));
  });
  reset("start");
  try {
    return await Promise.race([action(), inactive, browserFailure]);
  } finally {
    settled = true;
    clearTimer();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

async function main() {
  const input = JSON.parse(Buffer.from(process.argv[2] || "", "base64").toString("utf8"));
  const captureRuntimeState = eval("(" + input.captureFunctionSource + ")");
  let browser;
  let phase = "launch";
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: true,
      timeout: input.launchTimeoutMs,
      args: input.launchArgs,
    });
    const context = await browser.newContext({
      viewport: input.viewport,
      extraHTTPHeaders: { "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
    });
    const page = await context.newPage();
    const browserFailures = [];
    const assertNoBrowserFailures = (stage) => {
      if (browserFailures.length > 0) {
        throw new Error("Browser failures before runtime-state " + stage + ": " + browserFailures.join("; "));
      }
    };
    page.on("response", (res) => {
      const status = res.status();
      if (
        status >= 400 &&
        status < 600 &&
        !opencorvusIsPrimaryNavigationRequest(res) &&
        opencorvusIsCriticalPageRequestFailure(input.url, res)
      ) {
        browserFailures.push("response " + res.url() + " HTTP " + status);
      }
    });
    page.on("requestfailed", (req) => {
      if (opencorvusIsCriticalPageRequestFailure(input.url, req)) {
        browserFailures.push("requestfailed " + req.url() + " " + (req.failure()?.errorText || "request failed"));
      }
    });
    page.on("pageerror", (error) => {
      if (opencorvusIsSameOriginPageError(input.url, error)) {
        browserFailures.push("pageerror " + (error && error.message ? error.message : String(error)));
      }
    });

    phase = "navigate";
    await opencorvusWithBrowserInactivity(
      page,
      input.url,
      "navigate " + input.url,
      input.navigationTimeoutMs,
      () => page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 0 }),
    );
    await opencorvusWithBrowserInactivity(
      page,
      input.url,
      "networkidle " + input.url,
      Math.min(5000, input.navigationTimeoutMs),
      () => page.waitForLoadState("networkidle", { timeout: 0 }),
    ).catch(() => undefined);
    await page.waitForTimeout(1200);
    assertNoBrowserFailures("capture");

    phase = "capture";
    const snapshots = [];
    for (const point of input.statePoints) {
      const documentHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
      const maxScroll = Math.max(0, documentHeight - input.viewport.height);
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), Math.round(maxScroll * point.ratio));
      await page.waitForTimeout(700);
      assertNoBrowserFailures("snapshot");
      const screenshotRelative = path.posix.join("interaction-states", point.id + ".png");
      await page.screenshot({ path: path.join(input.outputDir, screenshotRelative), fullPage: false, type: "png" });
      assertNoBrowserFailures("artifact");
      const snapshot = await page.evaluate(captureRuntimeState, {
        id: point.id,
        label: point.label,
        screenshot: screenshotRelative,
      });
      assertNoBrowserFailures("artifact");
      snapshots.push(snapshot);
    }

    assertNoBrowserFailures("artifact");
    process.stdout.write(JSON.stringify({ ok: true, snapshots }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      phase,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : undefined,
    }));
    process.exitCode = 1;
  } finally {
    phase = "close";
    if (browser) await browser.close().catch(() => {});
  }
}

main();
`

export function deriveRuntimeStateObservations(snapshots: RuntimeStateSnapshot[]): RuntimeStateObservation[] {
  const rows = new Map<string, RuntimeStateElement[]>()
  for (const snapshot of snapshots) {
    for (const element of [...snapshot.persistentElements, ...snapshot.interactiveElements]) {
      const textKey = canonicalTextKey(element.text)
      if (!textKey) continue
      const key = `${element.role || element.tag}:${textKey}`
      const group = rows.get(key) ?? []
      group.push(element)
      rows.set(key, group)
    }
  }

  const observations: RuntimeStateObservation[] = []
  for (const [key, elements] of rows) {
    const uniqueScrolls = Array.from(
      new Set(elements.map((element) => element.documentBounds.y - element.bounds.y)),
    ).sort((a, b) => a - b)
    if (uniqueScrolls.length < 2) continue
    const viewportYs = elements.map((element) => element.bounds.y)
    const documentYs = elements.map((element) => element.documentBounds.y)
    const ySpan = Math.max(...viewportYs) - Math.min(...viewportYs)
    const documentSpan = Math.max(...documentYs) - Math.min(...documentYs)
    if (ySpan > 4 || documentSpan < 80) continue
    observations.push({
      kind: "persistent-viewport-position",
      description: "Element text and viewport Y remain stable while document scroll position changes.",
      elementKey: key,
      texts: Array.from(
        new Set(elements.map((element) => element.text).filter((text): text is string => Boolean(text))),
      ).slice(0, 8),
      roles: Array.from(new Set(elements.map((element) => element.role || element.tag))).slice(0, 8),
      scrollYs: uniqueScrolls,
      viewportYRange: { min: Math.min(...viewportYs), max: Math.max(...viewportYs) },
      documentYRange: { min: Math.min(...documentYs), max: Math.max(...documentYs) },
      evidenceSnapshotIds: snapshots
        .filter((snapshot) =>
          elements.some((element) => snapshot.scrollY === element.documentBounds.y - element.bounds.y),
        )
        .map((snapshot) => snapshot.id),
    })
  }
  return observations.slice(0, 40)
}

function canonicalTextKey(text: string | undefined): string | undefined {
  if (!text) return undefined
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length < 2 || normalized.length > 160) return undefined
  return normalized.toLowerCase()
}
