import { Identifier } from "@/id/id"
import { HostProcessingFaultError } from "@/llm/host-fault"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { materializeToolResultInlineAttachments } from "@/tool/result-attachment-materialization"
import { Session } from "."
import { Message } from "./message"
import { completedToolExecutionResult } from "./tool-outcome-facts"
import { toolResultControl } from "./tool-result-control"
import { normalizeToolResult } from "./tool-result-normalization"

/** Recover the result already produced by this invocation; never execute it. */
export async function recoverCompletedToolResult(part: Message.ToolPart): Promise<Message.ToolPart | undefined> {
  if (part.state.status !== "running") return undefined
  const receipt = Database.use((db) => completedToolExecutionResult(db, part))
  if (!receipt) return undefined
  if (receipt.projectID !== Instance.project.id) {
    throw new HostProcessingFaultError(`Tool ${part.id} result belongs to a different Project`)
  }
  const result = await materializeToolResultInlineAttachments({
    projectID: receipt.projectID, value: normalizeToolResult(receipt.value),
  })
  toolResultControl(result.metadata)
  const binding = () => ({ id: Identifier.ascending("part"), sessionID: part.sessionID, messageID: part.messageID })
  const attachments = Array.isArray(result.attachments)
    ? result.attachments.map((file) => Message.FilePart.parse({ ...file, ...binding() })) : undefined
  const display = Array.isArray(result.display)
    ? result.display.map((value) => Message.InteractiveArtifactPart.parse({ ...value, ...binding() })) : []
  const completed = await Session.persistCompletedToolResult({
    tool: { ...part, state: {
      status: "completed", input: part.state.input, output: result.output, title: result.title,
      metadata: result.metadata, attachments,
      time: { start: part.state.time.start, end: Math.max(receipt.completedAt, part.state.time.start + 1) },
    } },
    display, sources: Array.isArray(result.sources) ? result.sources : [],
    expectedResultAttemptID: receipt.attemptID,
  })
  return completed.tool
}
