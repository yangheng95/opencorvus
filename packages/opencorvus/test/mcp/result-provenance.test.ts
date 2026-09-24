import { afterEach, describe, expect, test } from "bun:test"
import { materializeMcpToolResult, materializedMcpAttachmentsToFileParts } from "../../src/mcp/materialize"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { Instance } from "../../src/project/instance"
import type { Message } from "../../src/session/message"
import { resolveBrowserInteractionScreenshot } from "../../src/tool/browser-preview-capture-interaction-state"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("MCP result provenance", () => {
  test("materializes exact Computer identity and ordinary provider output contracts", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const result = {
        content: [{ type: "text" as const, text: "done" }],
        structuredContent: { computer_id: "computer-1", display_id: "display-1" },
      }
      const builtin = await materializeMcpToolResult({ projectID: Instance.project.id, result, serverName: ComputerMCPBuiltin.ServerName })
      expect(builtin.metadata).toEqual({ computer: { computerId: "computer-1", displayId: "display-1" }, mcp_tool_result: { is_error: false } })
      for (const serverName of ["package-observer", undefined]) {
        const generic = await materializeMcpToolResult({ projectID: Instance.project.id, result, serverName })
        expect({ text: generic.text, metadata: generic.metadata }).toEqual({ text: "done", metadata: { mcp_tool_result: { is_error: false } } })
      }
    } })
  })

  test("exposes an exact screenshot request Part which the strict promotion resolver can consume", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      // Image transport payload only; this test neither renders nor evaluates UI.
      const data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII="
      const sessionID = "ses_browser_provenance"
      const messageID = "msg_browser_provenance"
      const partID = "prt_browser_provenance"
      const screenshot = { mimeType: "image/png", width: 1, height: 1, data }
      for (const toolName of ["observe", "screenshot"]) {
        const result = {
          content: [{ type: "image" as const, mimeType: "image/png", data }, { type: "text" as const, text: "observed" }],
          structuredContent: { url: "http://127.0.0.1:1234/", viewport: { width: 1, height: 1 }, ...(toolName === "observe" ? { screenshot } : screenshot) },
        }
        const materialized = await materializeMcpToolResult({ projectID: Instance.project.id, result, serverName: BrowserMCPBuiltin.ServerName, sourceToolPartID: partID })
        const receipt = JSON.parse(materialized.text.split("\n\n")[0]!).browser_screenshot_source
        expect(receipt).toMatchObject({ sourceToolPartID: partID, url: result.structuredContent.url, viewport: { width: 1, height: 1 }, screenshot: { mimeType: "image/png", width: 1, height: 1, attachmentUrl: materialized.attachments[0]!.url, sha: materialized.attachments[0]!.sha } })
        const toolRef = `default/mcp/browser/tool/${toolName}`
        const messages = [{ info: { id: messageID, sessionID }, parts: [{
          id: partID, sessionID, messageID, type: "tool", callID: "call_browser_provenance", tool: toolName,
          state: { status: "completed", metadata: { ...materialized.metadata, default_mcp_tool_ref: toolRef }, attachments: materializedMcpAttachmentsToFileParts({ attachments: materialized.attachments, sessionID, messageID }) },
        }] }] as unknown as Message.WithParts[]
        expect(resolveBrowserInteractionScreenshot({ sessionID, sourceToolPartID: receipt.sourceToolPartID, messages })).toEqual({
          messageID, partID, callID: "call_browser_provenance", toolRef,
          attachmentUrl: materialized.attachments[0]!.url, attachmentSha: materialized.attachments[0]!.sha,
          sourceUrl: result.structuredContent.url, mime: "image/png",
        })
      }
    } })
  })
})
