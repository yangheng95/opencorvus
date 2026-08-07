import z from "zod"
import { isResourceLoadConsoleError } from "@/runtime/browser-noise"

export const WalkthroughStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), path: z.string().min(1) }),
  z.object({ action: z.literal("fill"), selector: z.string().min(1), value: z.string() }),
  z.object({ action: z.literal("click"), selector: z.string().min(1) }),
  z.object({ action: z.literal("assertPath"), path: z.string().min(1) }),
  z.object({ action: z.literal("assertSelector"), selector: z.string().min(1), present: z.boolean().optional() }),
  z.object({ action: z.literal("assertText"), text: z.string().min(1) }),
])
export const WalkthroughStepsSchema = z.array(WalkthroughStepSchema).min(1)
export type WalkthroughStep = z.infer<typeof WalkthroughStepSchema>

export type WalkthroughPage = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
  waitForSelector: (selector: string, options?: Record<string, unknown>) => Promise<unknown>
  waitForFunction: <R, Arg = unknown>(
    fn: ((arg: Arg) => R) | string,
    arg?: Arg,
    options?: Record<string, unknown>,
  ) => Promise<unknown>
  type: (selector: string, value: string) => Promise<unknown>
  click: (selector: string) => Promise<unknown>
  keyboard: {
    down: (key: string) => Promise<unknown>
    up: (key: string) => Promise<unknown>
    press: (key: string) => Promise<unknown>
  }
  $: (selector: string) => Promise<unknown>
  evaluate: <R, Arg = unknown>(fn: ((arg: Arg) => R) | string, arg?: Arg) => Promise<R>
  url: () => string
  on?: (event: string, handler: (...args: unknown[]) => void) => unknown
  off?: (event: string, handler: (...args: unknown[]) => void) => unknown
}

export type WalkthroughExecutionResult = {
  passed: boolean
  steps: WalkthroughStep[]
  finalPath: string
  pageErrors: string[]
  consoleErrors: string[]
  requestFailures: string[]
  firstFailure?: { index: number; step: WalkthroughStep; message: string }
}

type StepHandlerInput = {
  page: WalkthroughPage
  baseUrl: string
  step: WalkthroughStep
  browserInactivityTimeoutMs: number
}
type StepHandler = (input: StepHandlerInput) => Promise<void>

const stepHandlers: { [K in WalkthroughStep["action"]]: StepHandler } = {
  goto: async ({ page, baseUrl, step, browserInactivityTimeoutMs }) => {
    if (step.action !== "goto") return
    const url = new URL(step.path, baseUrl).toString()
    await withWalkthroughBrowserInactivity(page, `goto ${url}`, browserInactivityTimeoutMs, () =>
      page.goto(url, { waitUntil: "networkidle", timeout: 0 }),
    )
  },
  fill: async ({ page, step }) => {
    if (step.action !== "fill") return
    await page.click(step.selector)
    await page.keyboard.down("Control")
    await page.keyboard.press("A")
    await page.keyboard.up("Control")
    await page.keyboard.press("Backspace")
    await page.type(step.selector, step.value)
  },
  click: async ({ page, step }) => {
    if (step.action !== "click") return
    await page.click(step.selector)
  },
  assertPath: async ({ page, step, browserInactivityTimeoutMs }) => {
    if (step.action !== "assertPath") return
    await withWalkthroughBrowserInactivity(page, `assert path ${step.path}`, browserInactivityTimeoutMs, () =>
      page.waitForFunction(
        (expectedPath: string) => window.location.pathname.includes(expectedPath),
        step.path,
        { timeout: 0 },
      ),
    )
  },
  assertSelector: async ({ page, step, browserInactivityTimeoutMs }) => {
    if (step.action !== "assertSelector") return
    const present = step.present ?? true
    await withWalkthroughBrowserInactivity(
      page,
      `${present ? "assert selector" : "assert selector absent"} ${step.selector}`,
      browserInactivityTimeoutMs,
      () => page.waitForSelector(step.selector, { state: present ? "attached" : "detached", timeout: 0 }),
    )
  },
  assertText: async ({ page, step, browserInactivityTimeoutMs }) => {
    if (step.action !== "assertText") return
    await withWalkthroughBrowserInactivity(page, `assert text ${step.text}`, browserInactivityTimeoutMs, () =>
      page.waitForFunction((text: string) => document.body?.textContent?.includes(text) ?? false, step.text, {
        timeout: 0,
      }),
    )
  },
}

export async function executeWalkthrough(input: {
  page: WalkthroughPage
  baseUrl: string
  steps: WalkthroughStep[]
  browserInactivityTimeoutMs: number
}): Promise<WalkthroughExecutionResult> {
  const steps = WalkthroughStepsSchema.parse(input.steps)
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const requestFailures: string[] = []
  input.page.on?.("pageerror", (error) => pageErrors.push(error instanceof Error ? error.message : String(error)))
  input.page.on?.("requestfailed", (payload) => requestFailures.push(activityLabel("requestfailed", payload)))
  input.page.on?.("console", (message) => {
    const item = message as { type?: () => string; text?: () => string }
    if (item.type?.() !== "error") return
    const text = item.text?.() ?? String(message)
    // Browser-mirrored network-load failures are not walkthrough JS faults
    // (single-sourced in the asset layer; same rationale as runtime capture).
    if (isResourceLoadConsoleError(text)) return
    consoleErrors.push(text)
  })
  for (const [index, step] of steps.entries()) {
    try {
      await stepHandlers[step.action]({
        page: input.page,
        baseUrl: input.baseUrl,
        step,
        browserInactivityTimeoutMs: input.browserInactivityTimeoutMs,
      })
    } catch (error) {
      return {
        passed: false,
        steps,
        finalPath: finalPath(input.page),
        pageErrors,
        consoleErrors,
        requestFailures,
        firstFailure: { index, step, message: error instanceof Error ? error.message : String(error) },
      }
    }
  }
  return {
    passed: pageErrors.length === 0 && consoleErrors.length === 0 && requestFailures.length === 0,
    steps,
    finalPath: finalPath(input.page),
    pageErrors,
    consoleErrors,
    requestFailures,
  }
}

function activityLabel(event: string, payload: unknown): string {
  const candidate = payload as {
    url?: () => string
    message?: () => string
    text?: () => string
    failure?: () => { errorText?: string } | null
    errorText?: string
  }
  if (typeof candidate?.url === "function") {
    const failure = typeof candidate.failure === "function" ? candidate.failure()?.errorText : candidate.errorText
    return failure ? `${event} ${candidate.url()} ${failure}` : `${event} ${candidate.url()}`
  }
  if (typeof candidate?.message === "function") return `${event} ${candidate.message()}`
  if (typeof candidate?.text === "function") return `${event} ${candidate.text()}`
  if (typeof candidate?.errorText === "string") return `${event} ${candidate.errorText}`
  return event
}

async function withWalkthroughBrowserInactivity<T>(
  page: WalkthroughPage,
  label: string,
  inactivityTimeoutMs: number,
  action: () => Promise<T>,
): Promise<T> {
  let settled = false
  let lastActivity = "start"
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectInactive: ((error: Error) => void) | undefined
  const listeners: Array<[string, (...args: unknown[]) => void]> = []
  const inactive = new Promise<never>((_, reject) => {
    rejectInactive = reject
  })
  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  const reset = (source: string) => {
    if (settled) return
    lastActivity = source
    clearTimer()
    timer = setTimeout(() => {
      rejectInactive?.(
        new Error(`${label} walkthrough browser inactive for ${inactivityTimeoutMs}ms after ${lastActivity}`),
      )
    }, inactivityTimeoutMs)
  }
  const fail = (source: string) => {
    if (settled) return
    lastActivity = source
    clearTimer()
    rejectInactive?.(new Error(`${label} walkthrough browser failure before completion: ${source}`))
  }
  const on = (event: string, handler: (...args: unknown[]) => void) => {
    inputPageOn(page, event, handler)
    listeners.push([event, handler])
  }
  on("console", (payload) => reset(activityLabel("console", payload)))
  on("response", (payload) => reset(activityLabel("response", payload)))
  on("request", (payload) => reset(activityLabel("request", payload)))
  on("framenavigated", (payload) => reset(activityLabel("framenavigated", payload)))
  on("requestfailed", (payload) => fail(activityLabel("requestfailed", payload)))
  on("pageerror", (payload) => fail(activityLabel("pageerror", payload)))
  reset("start")
  try {
    return await Promise.race([action(), inactive])
  } finally {
    settled = true
    clearTimer()
    for (const [event, handler] of listeners) inputPageOff(page, event, handler)
  }
}

function inputPageOn(page: WalkthroughPage, event: string, handler: (...args: unknown[]) => void) {
  page.on?.(event, handler)
}

function inputPageOff(page: WalkthroughPage, event: string, handler: (...args: unknown[]) => void) {
  page.off?.(event, handler)
}

function finalPath(page: WalkthroughPage) {
  try {
    return new URL(page.url()).pathname
  } catch {
    return page.url()
  }
}
