import fs from "node:fs/promises"
import path from "node:path"
import type { AcceptanceSpec } from "@/acceptance/types"
import { BrowserRuntime } from "@/browser/runtime"
import {
  runExplicitBrowserNodeSidecar,
  type BrowserNodeSidecarAuthority,
} from "@/browser/runtime/node-executor"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { RUNTIME_CAPTURE_DEFAULTS } from "@/runtime/capture-contract"
import { executeWalkthrough, type WalkthroughExecutionResult, type WalkthroughPage, type WalkthroughStep } from "./dsl"
import { translateScenarioToSteps, type WalkthroughTranslation } from "./translate"

type Browser = any

export type WalkthroughResult = WalkthroughExecutionResult & {
  specId: string
  scenarioTitle: string
  screenshotPath?: string
  evidence: string[]
}

type BrowserRuntimeLike = {
  launch: (input: { headless: true; args: string[] }) => Promise<Browser>
}

export type RunWalkthroughDependencies = {
  translate: typeof translateScenarioToSteps
  browserRuntime: BrowserRuntimeLike
}

export async function runWalkthrough(input: {
  spec: AcceptanceSpec
  baseUrl: string
  outDir: string
  taskID?: string
  sessionID?: string
  processAuthority: BrowserNodeSidecarAuthority
}): Promise<WalkthroughResult> {
  const translation = await translateScenarioToSteps({
    spec: input.spec,
    taskID: input.taskID,
    sessionID: input.sessionID,
  })
  if (!translation.steps) return walkthroughTranslationObservation({ ...input, translation })
  return runWalkthroughViaNode({ ...input, steps: translation.steps })
}

export async function runWalkthroughWithDependencies(
  input: {
    spec: AcceptanceSpec
    baseUrl: string
    outDir: string
    taskID?: string
    sessionID?: string
    processAuthority: BrowserNodeSidecarAuthority
  },
  dependencies: RunWalkthroughDependencies,
): Promise<WalkthroughResult> {
  const translation = await dependencies.translate({
    spec: input.spec,
    taskID: input.taskID,
    sessionID: input.sessionID,
  })
  if (!translation.steps) return walkthroughTranslationObservation({ ...input, translation })
  const steps = translation.steps
  await fs.mkdir(input.outDir, { recursive: true })
  const browser = await dependencies.browserRuntime.launch({
    headless: true,
    args: BrowserRuntime.defaultLaunchArgs(),
  })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const execution = await executeWalkthrough({
      page: page as unknown as WalkthroughPage,
      baseUrl: input.baseUrl,
      steps,
      browserInactivityTimeoutMs: RUNTIME_CAPTURE_DEFAULTS.wait_timeout_ms,
    })
    const screenshotPath = path.join(input.outDir, `${sanitize(input.spec.id)}.png`)
    await page.screenshot({ path: screenshotPath, type: "png" })
    return {
      ...execution,
      specId: input.spec.id,
      scenarioTitle: input.spec.title,
      screenshotPath,
      evidence: [
        `scenario_id=${input.spec.id}`,
        `steps=${steps.length}`,
        `passed=${execution.passed}`,
        `final_path=${execution.finalPath}`,
        execution.firstFailure
          ? `first_failure=${execution.firstFailure.index}:${execution.firstFailure.message}`
          : undefined,
        execution.pageErrors.length > 0 ? `page_errors=${execution.pageErrors.join("; ")}` : undefined,
        execution.consoleErrors.length > 0 ? `console_errors=${execution.consoleErrors.join("; ")}` : undefined,
        execution.requestFailures.length > 0 ? `request_failures=${execution.requestFailures.join("; ")}` : undefined,
      ].filter((item): item is string => Boolean(item)),
    }
  } finally {
    await browser.close()
  }
}

function walkthroughTranslationObservation(input: {
  spec: AcceptanceSpec
  baseUrl: string
  translation: WalkthroughTranslation
}): WalkthroughResult {
  return {
    passed: false,
    steps: [],
    finalPath: pathFromUrl(input.baseUrl),
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    specId: input.spec.id,
    scenarioTitle: input.spec.title,
    evidence: [
      `scenario_id=${input.spec.id}`,
      `translation_observation=${input.translation.parseObservation ?? "walkthrough steps unavailable"}`,
      input.translation.finalText.trim()
        ? `translation_final_message=${input.translation.finalText.trim()}`
        : undefined,
    ].filter((item): item is string => Boolean(item)),
  }
}

function pathFromUrl(value: string) {
  try {
    return new URL(value).pathname
  } catch {
    return value
  }
}

async function runWalkthroughViaNode(input: {
  spec: AcceptanceSpec
  baseUrl: string
  outDir: string
  steps: WalkthroughStep[]
  processAuthority: BrowserNodeSidecarAuthority
}): Promise<WalkthroughResult> {
  await fs.mkdir(input.outDir, { recursive: true })
  const screenshotPath = path.join(input.outDir, `${sanitize(input.spec.id)}.png`)
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const launchTimeoutMs = BrowserRuntime.resolveBrowserLaunchTimeoutMs()
  const runtime = await resolveBrowserNodeSidecarRuntime()
  const run = await runExplicitBrowserNodeSidecar<
    { ok: true; execution: WalkthroughExecutionResult } | { ok: false; message: string; stack?: string }
  >(input.processAuthority, {
    runtime,
    script: NODE_WALKTHROUGH_SCRIPT,
    payload: {
      baseUrl: input.baseUrl,
      steps: input.steps,
      screenshotPath,
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
      launchTimeoutMs,
      browserInactivityTimeoutMs: RUNTIME_CAPTURE_DEFAULTS.wait_timeout_ms,
    },
    inactivityTimeoutMs:
      launchTimeoutMs + input.steps.length * (RUNTIME_CAPTURE_DEFAULTS.wait_timeout_ms + 5_000) + 30_000,
    label: "Node walkthrough",
  })
  const result = run.result
  if (!result.ok) {
    throw new Error(`walkthrough Node sidecar failed: ${result.message}${result.stack ? `\n${result.stack}` : ""}`)
  }
  return {
    ...result.execution,
    specId: input.spec.id,
    scenarioTitle: input.spec.title,
    screenshotPath,
    evidence: [
      `scenario_id=${input.spec.id}`,
      `steps=${input.steps.length}`,
      `passed=${result.execution.passed}`,
      `final_path=${result.execution.finalPath}`,
      result.execution.firstFailure
        ? `first_failure=${result.execution.firstFailure.index}:${result.execution.firstFailure.message}`
        : undefined,
      result.execution.pageErrors.length > 0 ? `page_errors=${result.execution.pageErrors.join("; ")}` : undefined,
      result.execution.consoleErrors.length > 0
        ? `console_errors=${result.execution.consoleErrors.join("; ")}`
        : undefined,
      result.execution.requestFailures.length > 0
        ? `request_failures=${result.execution.requestFailures.join("; ")}`
        : undefined,
    ].filter((item): item is string => Boolean(item)),
  }
}

const NODE_WALKTHROUGH_SCRIPT = String.raw`
const { chromium } = require(process.argv[3]);

function isResourceLoadConsoleError(text) {
  return String(text || "").trimStart().startsWith("Failed to load resource:");
}

function activityLabel(event, payload) {
  if (payload && typeof payload.url === "function") return event + " " + payload.url();
  if (payload && typeof payload.message === "function") return event + " " + payload.message();
  if (payload && typeof payload.text === "function") return event + " " + payload.text();
  if (payload && typeof payload.errorText === "string") return event + " " + payload.errorText;
  return event;
}

async function withWalkthroughBrowserInactivity(page, label, inactivityTimeoutMs, action) {
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
      rejectInactive(new Error(label + " walkthrough browser inactive for " + inactivityTimeoutMs + "ms after " + lastActivity));
    }, inactivityTimeoutMs);
  };
  const fail = (source) => {
    if (settled) return;
    lastActivity = source;
    clearTimer();
    rejectInactive(new Error(label + " walkthrough browser failure before completion: " + source));
  };
  const on = (event, handler) => {
    page.on(event, handler);
    listeners.push([event, handler]);
  };
  on("console", (payload) => reset(activityLabel("console", payload)));
  on("response", (payload) => reset(activityLabel("response", payload)));
  on("request", (payload) => reset(activityLabel("request", payload)));
  on("framenavigated", (payload) => reset(activityLabel("framenavigated", payload)));
  on("requestfailed", (payload) => fail(activityLabel("requestfailed", payload)));
  on("pageerror", (payload) => fail(activityLabel("pageerror", payload)));
  reset("start");
  try {
    return await Promise.race([action(), inactive]);
  } finally {
    settled = true;
    clearTimer();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

function finalPath(page) {
  try {
    return new URL(page.url()).pathname;
  } catch {
    return page.url();
  }
}

async function executeStep(page, baseUrl, step, browserInactivityTimeoutMs) {
  if (step.action === "goto") {
    const url = new URL(step.path, baseUrl).toString();
    await withWalkthroughBrowserInactivity(page, "goto " + url, browserInactivityTimeoutMs, () =>
      page.goto(url, { waitUntil: "networkidle", timeout: 0 })
    );
    return;
  }
  if (step.action === "fill") {
    await page.click(step.selector);
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type(step.selector, step.value);
    return;
  }
  if (step.action === "click") {
    await page.click(step.selector);
    return;
  }
  if (step.action === "assertPath") {
    await withWalkthroughBrowserInactivity(page, "assert path " + step.path, browserInactivityTimeoutMs, () =>
      page.waitForFunction((expectedPath) => window.location.pathname.includes(expectedPath), step.path, { timeout: 0 })
    );
    return;
  }
  if (step.action === "assertSelector") {
    const present = step.present ?? true;
    await withWalkthroughBrowserInactivity(
      page,
      (present ? "assert selector " : "assert selector absent ") + step.selector,
      browserInactivityTimeoutMs,
      () => page.waitForSelector(step.selector, { state: present ? "attached" : "detached", timeout: 0 })
    );
    return;
  }
  if (step.action === "assertText") {
    await withWalkthroughBrowserInactivity(page, "assert text " + step.text, browserInactivityTimeoutMs, () =>
      page.waitForFunction((text) => document.body?.textContent?.includes(text) ?? false, step.text, { timeout: 0 })
    );
    return;
  }
  throw new Error("unsupported walkthrough action: " + step.action);
}

async function main() {
  const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: true,
      timeout: input.launchTimeoutMs,
      args: input.launchArgs,
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const requestFailures = [];
    page.on("pageerror", (error) => pageErrors.push(error instanceof Error ? error.message : String(error)));
    page.on("requestfailed", (payload) => requestFailures.push(activityLabel("requestfailed", payload)));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (isResourceLoadConsoleError(text)) return;
      consoleErrors.push(text);
    });
    for (const [index, step] of input.steps.entries()) {
      try {
        await executeStep(page, input.baseUrl, step, input.browserInactivityTimeoutMs);
      } catch (error) {
        await page.screenshot({ path: input.screenshotPath, type: "png" }).catch(() => undefined);
        process.stdout.write(JSON.stringify({
          ok: true,
          execution: {
            passed: false,
            steps: input.steps,
            finalPath: finalPath(page),
            pageErrors,
            consoleErrors,
            requestFailures,
            firstFailure: { index, step, message: error instanceof Error ? error.message : String(error) },
          },
        }));
        return;
      }
    }
    await page.screenshot({ path: input.screenshotPath, type: "png" });
    process.stdout.write(JSON.stringify({
      ok: true,
      execution: {
        passed: pageErrors.length === 0 && consoleErrors.length === 0 && requestFailures.length === 0,
        steps: input.steps,
        finalPath: finalPath(page),
        pageErrors,
        consoleErrors,
        requestFailures,
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
    if (browser) await browser.close().catch(() => undefined);
  }
}

main();
`

function sanitize(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80) || "scenario"
}
