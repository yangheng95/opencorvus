import { createHash } from "node:crypto"
import sharp from "sharp"
import { Identifier } from "../id/id"
import { Instance } from "../project/instance"
import { Session } from "../session"
import { AttachmentStore } from "../storage/attachment-store"
import { Tool } from "../tool/tool"
import { createWorkArtifactTools } from "../tool/work-artifact"

export async function runPackagedWorkArtifactAcceptance(): Promise<{
  source_sha: string
  receipt_sha: string
  delivered_sha: string
  display: string | undefined
}> {
  const session = await Session.create({ kind: "root", title: "Packaged Work Artifact acceptance" })
  const authority = {
    kind: "conversation" as const,
    sessionID: session.id,
    projectID: Instance.project.id,
    directory: Instance.project.worktree,
  }
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, parentID: "msg_packaged_work_artifact_acceptance_user",
    role: "assistant", author: "orchestrator", time: { created: Date.now(), completed: Date.now() },
    agent: "orchestrator", providerID: "qualification", modelID: "qualification",
    path: { cwd: Instance.project.worktree, root: Instance.project.worktree }, cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } }, finish: "tool-calls",
  })
  const tools = createWorkArtifactTools()
  const context: Tool.Context = {
    sessionID: session.id, messageID: assistant.id, callID: "call_packaged_work_artifact_acceptance", agent: "orchestrator",
    abort: new AbortController().signal, messages: [], executionAuthority: authority,
    executionSurface: Tool.executionSurface(Object.values(tools).map((tool) => tool.id), []),
    extra: { projectID: Instance.project.id }, metadata() {},
  }
  const picture = await AttachmentStore.write(
    Instance.project.id,
    await sharp({ create: { width: 32, height: 32, channels: 4, background: "#2563EB" } }).png().toBuffer(),
    "image/png",
    "qualification-picture.png",
  )
  const authored = await tools.author.init().then((tool) => tool.execute({
    profile: "office.presentation@1", filename: "packaged-qualification.pptx", locale: "en-US", aspect_ratio: "16:9",
    slides: [{ title: "Packaged qualification", background: "#FFFFFF", elements: [{
      kind: "chart", x: 2, y: 2, width: 29, height: 14, chart_type: "column", title: "Qualified values",
      categories: ["A", "B"], series: [{ name: "Value", values: [1, 2] }], colors: ["#2563EB"],
      legend: "bottom", data_labels: "value",
    }, {
      kind: "picture", x: 29.5, y: 0.5, width: 2, height: 2,
      source_url: picture.url, alt: "Qualification blue square",
    }] }],
  }, context))
  const source = JSON.parse(authored.output).source as { url: string; sha: string }
  const inspected = await tools.inspect.init().then((tool) => tool.execute({ profile: "office.presentation@1", source_url: source.url }, context))
  if (JSON.parse(inspected.output).source.sha !== source.sha) throw new Error("Packaged inspect did not bind the authored source")
  const validated = await tools.validate.init().then((tool) => tool.execute({ profile: "office.presentation@1", source_url: source.url }, context))
  const validation = JSON.parse(validated.output)
  const now = Date.now()
  await Session.updatePart({
    id: Identifier.ascending("part"), sessionID: session.id, messageID: assistant.id, type: "tool",
    callID: "call_packaged_work_artifact_validate", tool: "work_artifact_validate",
    state: { status: "completed", input: { profile: "office.presentation@1", source_url: source.url }, output: validated.output,
      title: validated.title, metadata: { truncated: false }, time: { start: now, end: now + 1 } },
  })
  const delivered = await tools.deliver.init().then((tool) => tool.execute({
    profile: "office.presentation@1", title: "Packaged qualification", source_url: source.url,
    validation_receipt_url: validation.validation_receipt.url,
    validation_receipt_sha: validation.validation_receipt.sha,
    slides: [{ slide: 1, title: "Packaged qualification", markdown: "Compiled package acceptance." }],
  }, context))
  const deliveredSource = JSON.parse(delivered.output).source as { sha: string }
  const receiptDigest = createHash("sha256").update(JSON.stringify(validation.validation_receipt_payload)).digest("hex")
  if (receiptDigest !== validation.validation_receipt.sha || deliveredSource.sha !== source.sha) {
    throw new Error("Packaged delivery did not preserve receipt/source identity")
  }
  return { source_sha: source.sha, receipt_sha: receiptDigest, delivered_sha: deliveredSource.sha, display: delivered.display?.[0]?.type }
}
