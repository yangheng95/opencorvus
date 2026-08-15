import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import which from "which"
import { runHostBrowserNodeSidecar } from "../src/browser/runtime/node-executor"
import {
  FrontendVisualEvidencePageValidationError,
  frontendVisualEvidencePageValidationFailureResult,
  frontendVisualEvidenceToolchainFailureResult,
  materializeFrontendCaptureVisualEvidenceTool,
} from "../src/frontend-design/output-tools"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe("Frontend visual sidecar contract", () => {
  test("delivers the sole payload and Playwright module authorities through argv", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-frontend-sidecar-"))
    temporaryDirectories.push(directory)
    const playwrightModule = path.join(directory, "playwright.cjs")
    await fs.writeFile(playwrightModule, 'module.exports = { chromium: { authority: "exact-playwright" } }\n')
    const nodeExecutable = which.sync("node")

    const run = await runHostBrowserNodeSidecar<{
      payload: { authority: string }
      playwrightAuthority: string
    }>(directory, {
      runtime: { nodeExecutable, playwrightRequirePath: playwrightModule, packaged: false },
      script: String.raw`
const { chromium } = require(process.argv[3]);
const payload = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));
process.stdout.write(JSON.stringify({ payload, playwrightAuthority: chromium.authority }));
`,
      payload: { authority: "exact-payload" },
      inactivityTimeoutMs: 10_000,
      label: "frontend visual sidecar argv contract",
    })

    expect(run.result).toEqual({
      payload: { authority: "exact-payload" },
      playwrightAuthority: "exact-playwright",
    })
  })

  test("returns one stable bounded-retry infrastructure failure contract", () => {
    const first = JSON.parse(frontendVisualEvidenceToolchainFailureResult(new Error("renderer transport failed")))
    const repeated = JSON.parse(frontendVisualEvidenceToolchainFailureResult(new Error("renderer transport failed")))

    expect(first).toEqual(repeated)
    expect(first).toMatchObject({
      ok: false,
      error: {
        code: "frontend_visual_evidence_toolchain_unavailable",
        message: "renderer transport failed",
        retry: "retry_once_after_concrete_correction",
      },
    })
    expect(first.error.signature).toMatch(/^[0-9a-f]{16}$/)
  })

  test("the production capture Tool exposes renderer failure as the bounded contract", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-frontend-capture-"))
    temporaryDirectories.push(directory)
    const skeletonDirectory = path.join(directory, "visual-html-skeleton")
    await fs.mkdir(skeletonDirectory, { recursive: true })
    await fs.writeFile(path.join(skeletonDirectory, "index.html"), "<!doctype html><title>fixture</title>\n")
    const capture = materializeFrontendCaptureVisualEvidenceTool(
      {
        mode: "greenfield_original",
        artifactRoot: directory,
        workspaceRoot: directory,
        taskID: "task-frontend-capture",
      },
      undefined,
      {
        renderScreenshot: async () => {
          throw new Error("renderer transport failed")
        },
      },
    )

    const result = await capture.execute?.(
      {
        kind: "render_review",
        id: "render-review-fixture",
        rendered_entrypoint: "visual-html-skeleton/index.html",
        screenshot_artifact: "visual-html-skeleton/preview/fixture.png",
        viewport: { width: 1440, height: 900, label: "desktop-1440x900" },
        location_hash: "",
        capture_mode: "full_page",
        review_status: "reviewed_with_blocking_debt",
        review_summary: "Renderer infrastructure is unavailable, so visual review remains blocked.",
      },
      { toolCallId: "capture-fixture", messages: [] } as any,
    )
    const failure = JSON.parse(String(result))

    expect(failure).toMatchObject({
      ok: false,
      error: {
        code: "frontend_visual_evidence_toolchain_unavailable",
        message: "renderer transport failed",
        retry: "retry_once_after_concrete_correction",
      },
    })
  })

  test("the production capture Tool keeps page validation failures actionable", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-frontend-page-validation-"))
    temporaryDirectories.push(directory)
    const skeletonDirectory = path.join(directory, "visual-html-skeleton")
    await fs.mkdir(skeletonDirectory, { recursive: true })
    await fs.writeFile(path.join(skeletonDirectory, "index.html"), "<!doctype html><title>fixture</title>\n")
    const expected = frontendVisualEvidencePageValidationFailureResult(
      new FrontendVisualEvidencePageValidationError("pageerror broken component"),
    )
    const capture = materializeFrontendCaptureVisualEvidenceTool(
      {
        mode: "greenfield_original",
        artifactRoot: directory,
        workspaceRoot: directory,
        taskID: "task-frontend-page-validation",
      },
      undefined,
      {
        renderScreenshot: async () => {
          throw new FrontendVisualEvidencePageValidationError("pageerror broken component")
        },
      },
    )

    const result = await capture.execute?.(
      {
        kind: "render_review",
        id: "render-review-page-validation",
        rendered_entrypoint: "visual-html-skeleton/index.html",
        screenshot_artifact: "visual-html-skeleton/preview/page-validation.png",
        viewport: { width: 1440, height: 900, label: "desktop-1440x900" },
        location_hash: "",
        capture_mode: "full_page",
        review_status: "reviewed_with_blocking_debt",
        review_summary: "Page validation must remain actionable.",
      },
      { toolCallId: "capture-page-validation", messages: [] } as any,
    )

    expect(result).toBe(expected)
    expect(JSON.parse(String(result))).toMatchObject({
      ok: false,
      error: {
        code: "frontend_visual_evidence_page_validation_failed",
        retry: "correct_page_then_retry",
      },
    })
  })
})
