import fs from "fs/promises"
import path from "path"
import crypto from "node:crypto"
import { renderPage } from "@/runtime/visual-page"
import {
  normalizeRuntimeCaptureRequest,
  normalizeRuntimeCaptureViewport,
  runtimeCaptureFailureSummary,
  runtimeCaptureFailedLayers,
  type RuntimeCaptureInput,
  type RuntimeCaptureResult,
} from "@/runtime/capture-contract"
import { BrowserRuntime } from "@/browser/runtime"

export * from "@/runtime/capture-contract"

export async function captureRuntimePage(input: RuntimeCaptureInput): Promise<RuntimeCaptureResult> {
  const args = normalizeRuntimeCaptureRequest(input)
  const viewport = normalizeRuntimeCaptureViewport({
    width: args.viewport_width,
    height: args.viewport_height,
  })
  await fs.mkdir(input.outDir, { recursive: true })
  try {
    const useReferenceViewport =
      !!input.referenceForViewport && input.viewport_width === undefined && input.viewport_height === undefined
    const rendered = await renderPage({
      processAuthority: input.processAuthority,
      rendered: args.url,
      outDir: input.outDir,
      viewport: useReferenceViewport ? undefined : viewport,
      referenceForViewport: input.referenceForViewport,
      browserExecutable: input.browserExecutable,
      browserLaunchTimeoutMs: BrowserRuntime.resolveBrowserLaunchTimeoutMs(),
      headless: input.headless,
      navigationTimeoutMs: args.wait_timeout_ms,
      settleMs: args.settle_ms,
      waitForSelector: args.wait_for_selector,
      minDomDescendants: args.min_dom_descendants,
      expectSelectors: args.expect_selectors,
      expectTexts: args.expect_texts,
      probeInteractions: input.probeInteractions,
      signal: input.signal,
    })
    const buf = await fs.readFile(rendered.renderedPath)
    const sha = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16)
    const finalPath = input.fileLabel
      ? path.join(input.outDir, `${sanitizeCaptureLabel(input.fileLabel)}-${sha}.png`)
      : rendered.renderedPath
    if (finalPath !== rendered.renderedPath) {
      await fs.rename(rendered.renderedPath, finalPath).catch(async () => {
        await fs.copyFile(rendered.renderedPath, finalPath)
      })
      rendered.capture.layers.pixel.screenshot_path = finalPath
    }
    const failedLayers = runtimeCaptureFailedLayers(rendered.capture.layers)
    const actualViewport = useReferenceViewport
      ? { width: rendered.viewport.width, height: rendered.viewport.height, capped: false }
      : viewport
    return {
      captured: true,
      passed: failedLayers.length === 0,
      url: args.url,
      target_url: rendered.capture.targetUrl,
      path: finalPath,
      sha,
      bytes: buf.length,
      size: rendered.size,
      requested_viewport: { width: args.viewport_width, height: args.viewport_height },
      viewport: actualViewport,
      layers: rendered.capture.layers,
      dom: rendered.dom,
      interaction: rendered.interaction,
      summary:
        failedLayers.length === 0
          ? `all runtime capture layers passed on ${args.url}`
          : runtimeCaptureFailureSummary(rendered.capture.layers),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      captured: false,
      passed: false,
      url: args.url,
      requested_viewport: { width: args.viewport_width, height: args.viewport_height },
      viewport,
      capture_error: { kind: "capture_failed", message },
      summary: `runtime capture failed: ${message}`,
    }
  }
}

function sanitizeCaptureLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) || "capture"
}
