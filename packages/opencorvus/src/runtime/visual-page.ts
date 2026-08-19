/**
 * Live page capture — renders an http(s) target with the Browser Runtime and
 * returns the screenshot plus the DOM, glyph-coverage and interaction probes
 * collected during that render.
 *
 * This module used to also carry a second SSIM comparison engine
 * (`runVisualDiff`/`summarizeVisualReport`) whose only export path was a
 * barrel nothing imported. The live visual verdict is
 * `verification/visual/evaluate.ts`; a second scorer with different math and
 * different thresholds could only ever disagree with it.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { PNG } from "pngjs"
import {
  BrowserNodeSidecarError,
  runExplicitBrowserNodeSidecar,
  type BrowserNodeSidecarAuthority,
} from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { BrowserRuntime } from "@/browser/runtime"
import type { RuntimeCaptureLayers, RuntimeInteractionProbe } from "@/runtime/capture-contract"
import { pngLuminanceVariance } from "@/runtime/png-metrics"

async function decodePNG(filePath: string): Promise<PNG> {
  const buf = await fs.readFile(filePath)
  return new Promise<PNG>((resolve, reject) => {
    const png = new PNG()
    png.parse(buf, (err, parsed) => (err ? reject(err) : resolve(parsed)))
  })
}

export interface RenderPageCapture {
  targetUrl: string
  layers: RuntimeCaptureLayers
}

function requirePositiveRenderNumber(value: unknown, name: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`renderPage: invalid ${name}: ${value}`)
  return parsed
}

/** Pure-render API — renders an HTML/URL target into `<outDir>/rendered.png`
 *  and returns the absolute path. No SSIM / no comparison. Runtime visual
 *  tools use this to hand the LLM (large language model) a screenshot of the actual built
 *  artifact; the LLM then compares it against the reference image via its
 *  vision capability (far more actionable than a single SSIM number).
 *
 *  `referenceForViewport` lets callers match the reference image's native
 *  size when known — otherwise callers must supply an explicit `viewport`.
 *  One of the two MUST be provided; this helper throws otherwise so we
 *  don't silently render at an arbitrary default. */
export async function renderPage(opts: {
  processAuthority: BrowserNodeSidecarAuthority
  rendered: string
  outDir: string
  viewport?: { width: number; height: number }
  referenceForViewport?: string
  browserExecutable?: string
  /** Explicit browser launch timeout. */
  browserLaunchTimeoutMs: number
  /** Run Chromium headless. Default false so visual evidence remains operator-visible. */
  headless?: boolean
  /** Explicit browser page.goto navigation inactivity timeout. */
  navigationTimeoutMs: number
  /** Explicit settle delay after window load. */
  settleMs: number
  /** Optional selector that must appear before assertions are evaluated. */
  waitForSelector?: string
  /** Minimum body descendant count for integrity checks. */
  minDomDescendants?: number
  /** CSS selectors expected to exist after render. */
  expectSelectors?: string[]
  /** Text fragments expected in document.body.textContent after render. */
  expectTexts?: string[]
  /** Run a generic user-interaction probe in the same browser page after first paint. */
  probeInteractions?: boolean
  signal?: AbortSignal
}): Promise<{
  renderedPath: string
  viewport: { width: number; height: number }
  size: { width: number; height: number }
  /** DOM 实证指标：与 screenshot 同一轮 render 采集，避免下游再开一次 browser（rule 22）。 */
  dom: {
    textLength: number
    nodeCount: number
    bodyDescendantCount: number
    hasBodyChildren: boolean
    /** React 根「<div id=\"root\"></div>」空壳（未 hydrate / hydrate 了空 App）。 */
    isEmptyRootShell: boolean
  }
  interaction?: RuntimeInteractionProbe
  capture: RenderPageCapture
}> {
  const browserLaunchTimeoutMs = requirePositiveRenderNumber(opts.browserLaunchTimeoutMs, "browserLaunchTimeoutMs")
  const navigationTimeoutMs = requirePositiveRenderNumber(opts.navigationTimeoutMs, "navigationTimeoutMs")
  const settleMs = requirePositiveRenderNumber(opts.settleMs, "settleMs")
  let viewport = opts.viewport
  if (!viewport) {
    if (!opts.referenceForViewport) {
      throw new Error("renderPage: one of `viewport` or `referenceForViewport` is required")
    }
    await fs.access(opts.referenceForViewport).catch(() => {
      throw new Error(`renderPage: reference image not found: ${opts.referenceForViewport}`)
    })
    const refImg = await decodePNG(opts.referenceForViewport)
    viewport = { width: refImg.width, height: refImg.height }
  }
  await fs.mkdir(opts.outDir, { recursive: true })

  if (!/^https?:\/\//i.test(opts.rendered)) {
    throw new Error(
      `renderPage: runtime rendering is URL-only; start the app yourself, then pass its http(s) URL. Received: ${opts.rendered}`,
    )
  }
  const target = opts.rendered

  const renderedPath = path.join(opts.outDir, "rendered.png")
  const run = await renderPageViaNode({
    processAuthority: opts.processAuthority,
    target,
    renderedPath,
    viewport,
    outDir: opts.outDir,
    browserExecutable: opts.browserExecutable,
    browserLaunchTimeoutMs,
    headless: opts.headless ?? false,
    navigationTimeoutMs,
    settleMs,
    waitForSelector: opts.waitForSelector,
    minDomDescendants: opts.minDomDescendants,
    expectSelectors: opts.expectSelectors,
    expectTexts: opts.expectTexts,
    probeInteractions: opts.probeInteractions,
    signal: opts.signal,
  })
  const rendered = await decodePNG(renderedPath)
  const variance = pngLuminanceVariance(rendered)
  run.capture.layers.pixel = {
    passed: variance >= 25,
    variance: Number(variance.toFixed(2)),
    floor: 25,
    screenshot_path: renderedPath,
  }
  return {
    renderedPath,
    viewport,
    size: { width: rendered.width, height: rendered.height },
    dom: run.dom,
    interaction: run.interaction,
    capture: run.capture,
  }
}

async function renderPageViaNode(input: {
  processAuthority: BrowserNodeSidecarAuthority
  target: string
  renderedPath: string
  viewport: { width: number; height: number }
  outDir: string
  browserExecutable?: string
  browserLaunchTimeoutMs: number
  headless: boolean
  navigationTimeoutMs: number
  settleMs: number
  waitForSelector?: string
  minDomDescendants?: number
  expectSelectors?: string[]
  expectTexts?: string[]
  probeInteractions?: boolean
  signal?: AbortSignal
}): Promise<{
  dom: {
    textLength: number
    nodeCount: number
    bodyDescendantCount: number
    hasBodyChildren: boolean
    isEmptyRootShell: boolean
  }
  interaction?: RuntimeInteractionProbe
  capture: RenderPageCapture
}> {
  const executablePath = await BrowserRuntime.findBrowserExecutable(input.browserExecutable)
  const launchTimeoutMs = BrowserRuntime.resolveBrowserLaunchTimeoutMs(input.browserLaunchTimeoutMs)
  const navigationTimeoutMs = input.navigationTimeoutMs
  const sidecarSafetyTimeoutMs = Math.max(launchTimeoutMs + 30 * 60_000, 30 * 60_000)
  const runtime = await resolveBrowserNodeSidecarRuntime()
  const run = await runExplicitBrowserNodeSidecar<
    | {
        ok: true
        dom: {
          textLength: number
          nodeCount: number
          bodyDescendantCount: number
          hasBodyChildren: boolean
          isEmptyRootShell: boolean
        }
        interaction?: RuntimeInteractionProbe
        capture: RenderPageCapture
      }
    | { ok: false; message: string; stack?: string }
  >(input.processAuthority, {
    runtime,
    script: NODE_VISUAL_RENDER_SCRIPT,
    payload: {
      ...input,
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
      launchTimeoutMs,
      navigationTimeoutMs,
      requiredDomDescendants: input.minDomDescendants ?? 1,
    },
    inactivityTimeoutMs: sidecarSafetyTimeoutMs,
    label: "Node visual render",
    signal: input.signal,
  }).catch((error) => {
    if (error instanceof BrowserNodeSidecarError) throw error
    throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
  })
  const result = run.result
  if (!result.ok) {
    throw new Error(`renderPage: Node sidecar failed: ${result.message}${result.stack ? `\n${result.stack}` : ""}`)
  }
  if (run.exitCode !== 0) {
    throw new Error(`renderPage: Node sidecar exited with ${run.signal ?? run.exitCode}. ${run.stderr.trim()}`)
  }
  return result
}

const NODE_VISUAL_RENDER_SCRIPT = String.raw`
const { chromium } = require(process.argv[3]);

function isBrowserImplicitAssetRequest(rawUrl) {
  try {
    return new URL(rawUrl).pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

function isResourceLoadConsoleError(text) {
  return String(text || "").trimStart().startsWith("Failed to load resource:");
}

function visualActivityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

async function withVisualBrowserInactivity(page, label, inactivityTimeoutMs, action) {
  let settled = false;
  let lastActivity = "start";
  let timer;
  let rejectInactive;
  const listeners = [];
  const inactive = new Promise((_, reject) => {
    rejectInactive = reject;
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
      rejectInactive(new Error(label + " visual render browser inactive for " + inactivityTimeoutMs + "ms after " + lastActivity));
    }, inactivityTimeoutMs);
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => reset(visualActivityLabel("console", payload)));
  on("response", (payload) => reset(visualActivityLabel("response", payload)));
  on("requestfailed", (payload) => reset(visualActivityLabel("requestfailed", payload)));
  on("pageerror", (payload) => reset(visualActivityLabel("pageerror", payload)));
  reset("start");
  try {
    return await Promise.race([action(), inactive]);
  } finally {
    settled = true;
    clearTimer();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

async function collectDom(page) {
  return page.evaluate(() => {
    const body = document.body;
    const text = body ? (body.innerText || "").trim() : "";
    const nodeCount = document.querySelectorAll("*").length;
    const bodyDescendantCount = body ? body.getElementsByTagName("*").length : 0;
    const hasBodyChildren = !!body && body.children.length > 0;
    const isEmptyRootShell = (() => {
      if (!body) return true;
      const elementChildren = Array.from(body.children).filter(
        (c) => c.tagName !== "SCRIPT" && c.tagName !== "STYLE" && c.tagName !== "NOSCRIPT",
      );
      if (elementChildren.length !== 1) return false;
      const sole = elementChildren[0];
      if (sole.id !== "root" && sole.id !== "app" && sole.id !== "__next") return false;
      return sole.querySelectorAll("*").length <= 1;
    })();
    return {
      textLength: text.length,
      nodeCount,
      bodyDescendantCount,
      hasBodyChildren,
      isEmptyRootShell,
    };
  });
}

async function collectGlyphCoverage(page) {
  return page.evaluate(() => {
    // CJK means Chinese, Japanese, and Korean unified ideograph coverage.
    const cjkTextPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
    const samples = [];
    const failed = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && samples.length < 24) {
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (!cjkTextPattern.test(text)) continue;
      const parent = node.parentElement;
      if (!parent || !isVisible(parent)) continue;
      const style = getComputedStyle(parent);
      const sampleText = Array.from(text).filter((char) => cjkTextPattern.test(char)).slice(0, 8).join("");
      if (!sampleText) continue;
      const fontSpec = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily]
        .filter(Boolean)
        .join(" ");
      samples.push({
        text: sampleText,
        font_family: style.fontFamily,
        font_spec: fontSpec,
        font_size: style.fontSize,
      });
    }

    for (const sample of samples) {
      const fontReady = typeof document.fonts?.check === "function" ? document.fonts.check(sample.font_spec, sample.text) : false;
      const missingChars = Array.from(new Set(Array.from(sample.text))).filter((char) =>
        glyphMatchesMissingGlyph(char, sample.font_spec, sample.font_size),
      );
      if (!fontReady || missingChars.length > 0) {
        failed.push({
          text: sample.text,
          font_family: sample.font_family,
          font_spec: sample.font_spec,
          reason: !fontReady ? "document.fonts.check failed" : "canvas glyph matched missing-glyph sentinel",
          missing_chars: missingChars,
        });
      }
    }

    return { passed: failed.length === 0, checked: samples.length, failed };

    function isVisible(element) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function glyphMatchesMissingGlyph(char, fontSpec, fontSize) {
      const actual = glyphFingerprint(char, fontSpec, fontSize);
      const missing = glyphFingerprint(String.fromCodePoint(0x10ffff), fontSpec, fontSize);
      return (
        actual.ink > 0 &&
        missing.ink > 0 &&
        actual.hash === missing.hash &&
        actual.minX === missing.minX &&
        actual.minY === missing.minY &&
        actual.maxX === missing.maxX &&
        actual.maxY === missing.maxY
      );
    }

    function glyphFingerprint(char, fontSpec, fontSize) {
      const size = Number.parseFloat(fontSize) || 16;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(48, Math.min(192, Math.ceil(size * 5)));
      canvas.height = Math.max(48, Math.min(192, Math.ceil(size * 5)));
      const ctx = canvas.getContext("2d");
      if (!ctx) return { ink: 0, hash: "0", minX: 0, minY: 0, maxX: 0, maxY: 0 };
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.font = fontSpec;
      ctx.textBaseline = "top";
      ctx.fillText(char, 4, 4);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;
      let hash = 2166136261;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4;
          const alpha = data[i + 3];
          if (alpha <= 8) continue;
          ink += 1;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          hash ^= data[i] + (data[i + 1] << 8) + (data[i + 2] << 16) + (alpha << 24);
          hash = Math.imul(hash, 16777619) >>> 0;
        }
      }
      return {
        ink,
        hash: hash.toString(16),
        minX: ink ? minX : 0,
        minY: ink ? minY : 0,
        maxX: ink ? maxX : 0,
        maxY: ink ? maxY : 0,
      };
    }
  });
}

async function probeRuntimeInteractions(page) {
  const before = await page.evaluate(() => ({
    text: document.body?.innerText || "",
    html: document.body?.innerHTML || "",
  }));
  const seen = new Set();
  const errors = [];
  let attempted = 0;
  let visibleControlCount = 0;
  let textInputCount = 0;
  let fileInputCount = 0;

  for (let round = 0; round < 3; round++) {
    const controls = await page.evaluate(() => {
      window.__opencorvusRuntimeProbeNext ??= 0;
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const elements = Array.from(
        document.querySelectorAll("button,a[href],input,textarea,select,[role='button'],[contenteditable='true']"),
      ).filter((el) => visible(el));
      return elements.map((el) => {
        let id = el.getAttribute("data-opencorvus-runtime-probe-id");
        if (!id) {
          id = String(window.__opencorvusRuntimeProbeNext++);
          el.setAttribute("data-opencorvus-runtime-probe-id", id);
        }
        const isFileInput = el instanceof HTMLInputElement && (el.type || "").toLowerCase() === "file";
        const isTextInput =
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLInputElement &&
            ["email", "password", "search", "text", "url"].includes((el.type || "text").toLowerCase()));
        return { id, selector: '[data-opencorvus-runtime-probe-id="' + id + '"]', isTextInput, isFileInput };
      });
    });
    visibleControlCount = Math.max(visibleControlCount, controls.length);
    const roundTextInputCount = controls.filter((item) => item.isTextInput).length;
    textInputCount = Math.max(textInputCount, roundTextInputCount);
    fileInputCount = Math.max(fileInputCount, controls.filter((item) => item.isFileInput).length);
    for (const item of controls.filter((control) => control.isTextInput).slice(0, 3)) {
      try {
        await page.click(item.selector, { delay: 10 });
        await page.keyboard.down("Control");
        await page.keyboard.press("KeyA");
        await page.keyboard.up("Control");
        await page.keyboard.type("opencorvus runtime probe", { delay: 5 });
        attempted++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    const clickTargets = controls.filter((item) => !item.isFileInput && !seen.has(item.id)).slice(0, 5);
    if (clickTargets.length === 0 && roundTextInputCount === 0) break;
    for (const item of clickTargets) {
      seen.add(item.id);
      try {
        await page.click(item.selector, { delay: 20 });
        attempted++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_200));
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const after = await page.evaluate(() => ({
    text: document.body?.innerText || "",
    html: document.body?.innerHTML || "",
  }));
  return {
    visibleControlCount,
    textInputCount,
    fileInputCount,
    attemptedInteractionCount: attempted,
    textChanged: before.text !== after.text,
    htmlChanged: before.html !== after.html,
    errorCount: errors.length,
    errors: errors.slice(0, 5),
  };
}

async function main() {
  const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: input.headless,
      timeout: input.launchTimeoutMs,
      args: input.launchArgs,
    });
    const context = await browser.newContext({
      viewport: { width: input.viewport.width, height: input.viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const failedRequests = [];
    let totalResponses = 0;
    page.on("response", (res) => {
      totalResponses += 1;
      const status = res.status();
      if (status >= 400 && status < 600 && !isBrowserImplicitAssetRequest(res.url())) {
        failedRequests.push({ url: res.url(), status, reason: res.statusText() || "HTTP " + status });
      }
    });
    page.on("requestfailed", (req) => {
      if (isBrowserImplicitAssetRequest(req.url())) return;
      failedRequests.push({ url: req.url(), status: 0, reason: req.failure()?.errorText || "request failed" });
    });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text().slice(0, 400);
      if (isResourceLoadConsoleError(text)) return;
      consoleErrors.push(text);
    });
    const pageErrors = [];
    page.on("pageerror", (err) => {
      pageErrors.push((err && err.message ? err.message : String(err)).slice(0, 400));
    });
    await page.exposeFunction("__opencorvusCaptureUnhandledRejection", (message) => {
      pageErrors.push(("unhandledrejection: " + message).slice(0, 400));
    });
    await page.addInitScript(() => {
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        const message =
          reason instanceof Error ? reason.message : typeof reason === "string" ? reason : JSON.stringify(reason);
        window.__opencorvusCaptureUnhandledRejection?.(message);
      });
    });
    const response = await withVisualBrowserInactivity(
      page,
      "navigate " + input.target,
      input.navigationTimeoutMs,
      () => page.goto(input.target, { waitUntil: "load", timeout: 0 }),
    );
    const status = response?.status() || 0;
    const contentType = String(response?.headers()["content-type"] || "").toLowerCase();
    const bodyBuf = response ? await response.body().catch(() => Buffer.alloc(0)) : Buffer.alloc(0);
    let httpReason = "";
    if (status < 200 || status >= 300) httpReason = "status=" + status;
    else if (!contentType.includes("text/html")) httpReason = "content-type=" + (contentType || "(missing)") + " - app root must serve text/html";
    else if (bodyBuf.length < 200) httpReason = "body=" + bodyBuf.length + "B - too small to be an app shell";
    let missingWaitSelector;
    if (input.waitForSelector) {
      await withVisualBrowserInactivity(
        page,
        "waitForSelector " + input.waitForSelector,
        input.navigationTimeoutMs,
        () => page.waitForSelector(input.waitForSelector, { timeout: 0 }),
      ).catch((error) => {
        missingWaitSelector = input.waitForSelector;
        pageErrors.push(("waitForSelector: " + (error && error.message ? error.message : String(error))).slice(0, 400));
      });
    }
    await new Promise((resolve) => setTimeout(resolve, input.settleMs));
    let dom = await collectDom(page);
    let interaction;
    if (input.probeInteractions) {
      interaction = await probeRuntimeInteractions(page);
      if (interaction.textChanged || interaction.htmlChanged) dom = await collectDom(page);
    }
    const glyph = await collectGlyphCoverage(page);
    await page.screenshot({
      path: input.renderedPath,
      type: "png",
      clip: { x: 0, y: 0, width: input.viewport.width, height: input.viewport.height },
    });
    const missingSelectors = [];
    for (const sel of input.expectSelectors || []) {
      const found = await page.$(sel).then((e) => !!e).catch(() => false);
      if (!found) missingSelectors.push(sel);
    }
    if (missingWaitSelector && !missingSelectors.includes(missingWaitSelector)) missingSelectors.push(missingWaitSelector);
    const bodyText = await page.evaluate(() => document.body?.textContent || "");
    const missingTexts = (input.expectTexts || []).filter((text) => !bodyText.includes(text));
    process.stdout.write(JSON.stringify({
      ok: true,
      dom,
      interaction,
      capture: {
        targetUrl: input.target,
        layers: {
          http: {
            passed: status >= 200 && status < 300 && contentType.includes("text/html") && bodyBuf.length >= 200,
            status,
            content_type: contentType,
            body_length: bodyBuf.length,
            reason: httpReason,
          },
          asset: { passed: failedRequests.length === 0, total: totalResponses, failed: failedRequests },
          dom: {
            passed: dom.bodyDescendantCount >= input.requiredDomDescendants,
            body_descendants: dom.bodyDescendantCount,
            required: input.requiredDomDescendants,
          },
          js: { passed: consoleErrors.length === 0 && pageErrors.length === 0, console_errors: consoleErrors, page_errors: pageErrors },
          glyph,
          pixel: { passed: false, variance: 0, floor: 25, screenshot_path: input.renderedPath },
          expected: { passed: missingSelectors.length === 0 && missingTexts.length === 0, missing_selectors: missingSelectors, missing_texts: missingTexts },
        },
      },
    }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
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

/** SSIM visual diff — retained for the external benchmark CLI and operator
 *  verification workflows only. The workflow no longer uses SSIM as the final decision:
 *  SSIM: the LLM compares rendered vs reference via vision (see `renderPage`
 *  + integrity acceptance multimodal attachments), which produces actionable
 *  "header is missing N button, sidebar 20px too wide" feedback instead of
 *  a single opaque similarity number. */
