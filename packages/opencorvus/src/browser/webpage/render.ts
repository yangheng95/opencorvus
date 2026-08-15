/**
 * Visual render - capture an explicit browser URL.
 *
 * This is an atomic tool: it navigates to the caller-provided URL and returns
 * the captured screenshot. It does not start servers, infer project shape, or
 * substitute resources.
 */

import z from "zod"

import { BrowserRuntime } from "@/browser/runtime"
import {
  BrowserNodeSidecarError,
  runExplicitBrowserNodeSidecar,
  type BrowserNodeSidecarAuthority,
} from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { RenderError } from "./errors"

/** Injected before capture so screenshots are pixel-identical across runs. */
export const SCREENSHOT_STABILIZATION_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
::-webkit-scrollbar { display: none !important; width: 0 !important; }
html { scrollbar-width: none !important; }
* { caret-color: transparent !important; }
`

export const RenderInputSchema = z.object({
  /** Explicit page URL to capture. */
  url: z.string().url(),
  viewport: z.object({ width: z.number(), height: z.number() }),
  timeout: z.number().optional(),
  fullPage: z.boolean().optional(),
})
export type RenderInput = z.infer<typeof RenderInputSchema>

export const RenderOutputSchema = z.object({
  screenshotDataUrl: z.string(),
  screenshotBuffer: z.instanceof(Buffer),
  viewport: z.object({ width: z.number(), height: z.number() }),
  renderTimeMs: z.number(),
  bodyText: z.string().optional(),
  visibleText: z.string().optional(),
  consoleErrors: z.array(z.string()).optional(),
})
export type RenderOutput = z.infer<typeof RenderOutputSchema>

export interface RenderFilesCtx {
  processAuthority: BrowserNodeSidecarAuthority
  emit?: (event: { phase: "launch-browser" | "load-page" | "screenshot"; detail?: string }) => void
}

/**
 * Render the explicit `url` and return a PNG screenshot.
 *
 * @throws {RenderError} when browser launch fails, navigation times out, or
 * screenshot capture fails.
 */
export async function renderFiles(input: RenderInput, ctx: RenderFilesCtx): Promise<RenderOutput> {
  const parsed = RenderInputSchema.parse(input)
  const startTime = Date.now()
  const timeout = parsed.timeout ?? 30_000
  const fullPage = parsed.fullPage ?? false
  const { url, viewport } = parsed

  ctx?.emit?.({ phase: "launch-browser" })
  const sidecarRuntime = await resolveNodeRenderSidecarRuntime()
  const result = await renderFilesViaNode(ctx.processAuthority, {
    url,
    viewport,
    timeout,
    fullPage,
    executablePath: await BrowserRuntime.findBrowserExecutable(),
    nodeExecutable: sidecarRuntime.nodeExecutable,
    playwrightRequirePath: sidecarRuntime.playwrightRequirePath,
    launchArgs: BrowserRuntime.defaultLaunchArgs({
      extraArgs: [
        "--disable-extensions",
        "--disable-background-networking",
        `--window-size=${viewport.width},${viewport.height}`,
      ],
    }),
    launchTimeoutMs: BrowserRuntime.resolveBrowserLaunchTimeoutMs(),
    stabilizationCss: SCREENSHOT_STABILIZATION_CSS,
  })

  if (!result.ok) {
    throw new RenderError(
      {
        url,
        reason: result.message,
        phase: result.phase,
      },
      { cause: result.stack ? new Error(result.stack) : undefined },
    )
  }

  ctx?.emit?.({ phase: "screenshot" })
  const screenshotBuffer = Buffer.from(result.screenshotBase64, "base64")
  return {
    screenshotDataUrl: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
    screenshotBuffer,
    viewport,
    renderTimeMs: Date.now() - startTime,
    bodyText: result.bodyText,
    visibleText: result.visibleText,
    consoleErrors: result.consoleErrors.length > 0 ? result.consoleErrors : undefined,
  }
}

type NodeRenderInput = {
  url: string
  viewport: { width: number; height: number }
  timeout: number
  fullPage: boolean
  executablePath: string
  nodeExecutable: string
  playwrightRequirePath: string
  launchArgs: string[]
  launchTimeoutMs: number
  stabilizationCss: string
}

type NodeRenderResult =
  | {
      ok: true
      screenshotBase64: string
      bodyText: string
      visibleText: string
      consoleErrors: string[]
    }
  | {
      ok: false
      phase: "launch" | "navigate" | "evaluate" | "screenshot" | "close"
      message: string
      stack?: string
    }

async function renderFilesViaNode(authority: BrowserNodeSidecarAuthority, input: NodeRenderInput): Promise<NodeRenderResult> {
  const inactivityTimeoutMs = input.launchTimeoutMs + input.timeout + 20_000
  try {
    const run = await runExplicitBrowserNodeSidecar<NodeRenderResult>(authority, {
      runtime: {
        nodeExecutable: input.nodeExecutable,
        playwrightRequirePath: input.playwrightRequirePath,
        packaged: false,
      },
      script: NODE_RENDER_SCRIPT,
      payload: input,
      inactivityTimeoutMs,
      label: "Node webpage render",
    })
    if (run.exitCode !== 0 && run.result.ok) {
      return {
        ok: false,
        phase: "evaluate",
        message: `Node webpage render exited with ${run.signal ?? run.exitCode}. stderr=${run.stderr.trim()}`,
      }
    }
    return run.result
  } catch (error) {
    return {
      ok: false,
      phase: error instanceof BrowserNodeSidecarError && error.kind === "invalid_json" ? "evaluate" : "launch",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }
  }
}

export async function resolveNodeRenderSidecarRuntime(
  input: {
    execPath?: string
    platform?: NodeJS.Platform
  } = {},
): Promise<{ nodeExecutable: string; playwrightRequirePath: string }> {
  const runtime = await resolveBrowserNodeSidecarRuntime(input)
  return {
    nodeExecutable: runtime.nodeExecutable,
    playwrightRequirePath: runtime.playwrightRequirePath,
  }
}

const NODE_RENDER_SCRIPT = String.raw`
const { chromium } = require(process.argv[3]);

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
    rejectFailure(new Error(label + " Browser failures before render capture: " + source));
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
  const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));
  let browser;
  let phase = "launch";
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: true,
      timeout: input.launchTimeoutMs,
      args: input.launchArgs,
    });
    const context = await browser.newContext({ viewport: input.viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    const browserFailures = [];
    const assertNoBrowserFailures = (stage) => {
      if (browserFailures.length > 0) {
        throw new Error("Browser failures before render " + stage + ": " + browserFailures.join("; "));
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
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      const message = err && err.message ? err.message : String(err);
      if (opencorvusIsSameOriginPageError(input.url, err)) {
        browserFailures.push("pageerror " + message);
      }
    });

    phase = "navigate";
    await opencorvusWithBrowserInactivity(
      page,
      input.url,
      "navigate " + input.url,
      input.timeout,
      () => page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 0 }),
    );
    await opencorvusWithBrowserInactivity(
      page,
      input.url,
      "networkidle " + input.url,
      Math.min(5000, input.timeout),
      () => page.waitForLoadState("networkidle", { timeout: 0 }),
    ).catch(() => undefined);

    phase = "evaluate";
    await Promise.race([
      page.evaluate(() => document.fonts && document.fonts.ready),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]).catch(() => undefined);
    await Promise.race([
      page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img"));
        return Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        })));
      }),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]).catch(() => undefined);
    assertNoBrowserFailures("capture");
    await page.addStyleTag({ content: input.stabilizationCss });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    assertNoBrowserFailures("stabilization");
    const textSignals = await page.evaluate(() => {
      function isElementVisible(element) {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        if (style.display === "contents") return true;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) return false;
        return true;
      }

      function isTextNodeVisible(node) {
        const parent = node.parentElement;
        if (!parent || !node.textContent || !node.textContent.trim()) return false;
        let element = parent;
        while (element) {
          if (!isElementVisible(element)) return false;
          element = element.parentElement;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        const visible = Array.from(range.getClientRects()).some((rect) =>
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth
        );
        range.detach();
        return visible;
      }

      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
      const visible = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node instanceof Text && isTextNodeVisible(node)) visible.push(node.textContent || "");
      }
      return {
        bodyText: document.body && document.body.innerText ? document.body.innerText : "",
        visibleText: visible.join(" "),
      };
    }).catch(() => ({ bodyText: "", visibleText: "" }));

    phase = "screenshot";
    assertNoBrowserFailures("screenshot");
    const screenshot = Buffer.from(await page.screenshot({ type: "png", fullPage: input.fullPage }));
    assertNoBrowserFailures("artifact");
    process.stdout.write(JSON.stringify({
      ok: true,
      screenshotBase64: screenshot.toString("base64"),
      bodyText: textSignals.bodyText,
      visibleText: textSignals.visibleText,
      consoleErrors,
    }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      phase,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : undefined,
    }));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

main();
`
