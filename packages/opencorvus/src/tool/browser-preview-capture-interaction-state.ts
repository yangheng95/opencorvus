import crypto from "node:crypto"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import {
  BrowserPreviewInteractionCaptureRequest,
  persistBrowserPreviewInteractionCapture,
} from "@/browser-preview/interaction-capture"
import { taskBrowserPreviewTarget } from "@/browser-preview/target"
import { readBrowserPreviewEvidenceByID, findBrowserPreviewTargetByID } from "@/browser-preview/persist"
import { browserPreviewTaskEvidenceRoot } from "@/browser-preview/task-evidence-root"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { requireTask } from "@/engine/store"
import type { Message } from "@/session/message"
import { AttachmentStore } from "@/storage/attachment-store"
import { BrowserPreviewCaptureInteractionStateToolID } from "./browser-preview-tool-ids"
import { materializeBrowserPreviewCaptureResult } from "./browser-preview-capture"
import { Tool } from "./tool"

export const BrowserPreviewCaptureInteractionStateToolParameters = BrowserPreviewInteractionCaptureRequest

export function resolveBrowserInteractionScreenshot(input: {
  sessionID: string
  sourceToolPartID: string
  messages: Message.WithParts[]
}): {
  messageID: string
  partID: string
  callID: string
  toolRef: string
  attachmentUrl: string
  attachmentSha: string
  sourceUrl: string
  mime: "image/png"
} {
  const part = input.messages
    .flatMap((message) => message.parts)
    .find((candidate) => candidate.id === input.sourceToolPartID)
  if (
    !part ||
    part.type !== "tool" ||
    part.sessionID !== input.sessionID ||
    part.state.status !== "completed"
  ) {
    throw new Error(`Browser interaction source tool part is not completed in this Session: ${input.sourceToolPartID}`)
  }
  const metadata = part.state.metadata
  const toolRef = typeof metadata.default_mcp_tool_ref === "string" ? metadata.default_mcp_tool_ref : ""
  if (!BrowserMCPBuiltin.ScreenshotEvidenceToolRefs.includes(toolRef)) {
    throw new Error(`Tool part ${part.id} is not a canonical Browser MCP screenshot producer.`)
  }
  const browser = metadata.browser
  const sourceUrl =
    browser && typeof browser === "object" && "url" in browser && typeof browser.url === "string"
      ? browser.url
      : ""
  const screenshot =
    browser && typeof browser === "object" && "screenshot" in browser
      ? (browser.screenshot as Record<string, unknown>)
      : undefined
  const attachmentUrl = typeof screenshot?.attachmentUrl === "string" ? screenshot.attachmentUrl : ""
  const attachmentSha = typeof screenshot?.sha === "string" ? screenshot.sha : ""
  const attachment = part.state.attachments?.find(
    (candidate) => candidate.url === attachmentUrl && candidate.mime === "image/png",
  )
  if (!attachment || !/^[a-f0-9]{64}$/.test(attachmentSha) || !sourceUrl) {
    throw new Error(`Browser MCP tool part ${part.id} has no canonical PNG screenshot attachment.`)
  }
  return {
    messageID: part.messageID,
    partID: part.id,
    callID: part.callID,
    toolRef,
    attachmentUrl,
    attachmentSha,
    sourceUrl,
    mime: "image/png",
  }
}

export const BrowserPreviewCaptureInteractionStateTool = Tool.define(
  BrowserPreviewCaptureInteractionStateToolID,
  {
    description:
      "Promote one exact PNG produced by a completed Browser MCP screenshot or observe tool part in this Visual QA Session into task-scoped Browser Preview evidence for an explicit persisted viewport and interaction state. The source part, canonical Browser URL against the target origin/path boundary, AttachmentStore bytes, SHA-256, viewport dimensions, target, and state identity are strictly validated.",
    parameters: BrowserPreviewCaptureInteractionStateToolParameters,
    async execute(params, ctx: Tool.Context) {
      const taskID = typeof ctx.extra?.taskID === "string" ? ctx.extra.taskID.trim() : ""
      if (!taskID) throw new Error("browser_preview_capture_interaction_state requires a task context.")
      const target = findBrowserPreviewTargetByID({ taskID, targetID: params.targetID })
      if (!target) throw new Error(`Browser preview target not found: ${params.targetID}`)
      const source = resolveBrowserInteractionScreenshot({
        sessionID: ctx.sessionID,
        sourceToolPartID: params.sourceToolPartID,
        messages: ctx.messages,
      })
      const located = AttachmentStore.nameFromUrl(source.attachmentUrl)
      const projectID = requireTask(taskID).project_id
      if (!located || located.projectID !== projectID) {
        throw new Error("Browser MCP screenshot attachment does not belong to the current Task project.")
      }
      const reference = await AttachmentStore.readReference(located.projectID, located.name)
      const screenshotBytes = await AttachmentStore.read(located.projectID, located.name)
      const screenshotSha = crypto.createHash("sha256").update(screenshotBytes).digest("hex")
      if (reference.sha !== source.attachmentSha || screenshotSha !== source.attachmentSha) {
        throw new Error("Browser MCP screenshot attachment metadata and bytes do not match its recorded SHA-256.")
      }
      const persisted = await persistBrowserPreviewInteractionCapture({
        taskID,
        targetID: params.targetID,
        viewportID: params.viewportID,
        stateID: params.stateID,
        summary: params.summary,
        screenshotBytes,
        source: {
          sessionID: ctx.sessionID,
          messageID: source.messageID,
          partID: source.partID,
          callID: source.callID,
          toolRef: source.toolRef,
          attachmentUrl: source.attachmentUrl,
          attachmentSha: source.attachmentSha,
          sourceUrl: source.sourceUrl,
        },
      })
      const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
      const evidence = await readBrowserPreviewEvidenceByID({
        projectRoot,
        taskID,
        evidenceID: persisted.evidenceID,
      })
      if (!evidence) throw new Error(`Persisted interaction evidence is not readable: ${persisted.evidenceID}`)
      const materialized = await materializeBrowserPreviewCaptureResult({
        taskID,
        targetID: params.targetID,
        verification: {
          status: "passed",
          projectRoot,
          target: taskBrowserPreviewTarget({
            id: target.id,
            taskID,
            projectRoot,
            url: target.url,
            viewports: target.viewports,
            diagnostics: [`Using task browser preview target ${target.id}.`],
          }),
          viewports: target.viewports.filter((viewport) => viewport.id === params.viewportID),
          captures: {},
          evidenceIDs: { [params.viewportID]: persisted.evidenceID },
          diagnostics: evidence.evidence.diagnostics,
        },
      })
      return {
        title: "Browser interaction state evidence captured",
        output: JSON.stringify(materialized.output, null, 2),
        attachments: materialized.attachments,
        metadata: {
          status: "passed",
          taskID,
          targetID: params.targetID,
          stateID: params.stateID,
          sourceToolPartID: params.sourceToolPartID,
          evidenceID: persisted.evidenceID,
          evidenceLocator: exactEngineArtifactLocator({
            taskID,
            artifactID: persisted.evidenceID,
          }),
          attachmentCount: materialized.attachments.length,
        },
      }
    },
  },
)
