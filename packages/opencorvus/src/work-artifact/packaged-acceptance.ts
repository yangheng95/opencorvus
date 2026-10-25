import { createHash } from "node:crypto"
import { Identifier } from "../id/id"
import { Instance } from "../project/instance"
import { requireRuntimePackage } from "../runtime/package-require"
import { Session } from "../session"
import { AttachmentStore } from "../storage/attachment-store"
import { Tool } from "../tool/tool"
import { createWorkArtifactTools } from "../tool/work-artifact"
import type { WorkArtifactProfileID } from "./profile-registry"
import type { WorkArtifactPresentationDependencies } from "./presentation"

const sharp = requireRuntimePackage<typeof import("sharp", { with: { "resolution-mode": "require" } })>("sharp")

export async function runPackagedWorkArtifactAcceptance(input: {
  profile: WorkArtifactProfileID
  dependencies?: WorkArtifactPresentationDependencies
}): Promise<{
  source_sha: string
  receipt_sha: string
  delivered_sha: string
  display: string | undefined
  content?: unknown
}> {
  const session = await Session.create({ kind: "orchestrator", title: "Packaged Work Artifact acceptance" })
  const authority = {
    kind: "conversation" as const,
    sessionID: session.id,
    projectID: Instance.project.id,
    directory: Instance.project.worktree,
  }
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "user",
    time: { created: Date.now() },
    agent: "orchestrator",
    model: { providerID: "qualification", modelID: "qualification" },
  })
  // The assistant stays in flight for the whole lifecycle, exactly as a real turn does. Its Tool
  // Parts are the Artifact's provenance, and a completed assistant may not receive a new Tool
  // request Part, so completion is the last thing that happens rather than the first.
  const assistant = {
    id: Identifier.ascending("message"),
    sessionID: session.id,
    parentID: user.id,
    role: "assistant" as const,
    author: "orchestrator",
    time: { created: Date.now() },
    agent: "orchestrator",
    providerID: "qualification",
    modelID: "qualification",
    path: { cwd: Instance.project.worktree, root: Instance.project.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  }
  await Session.updateMessage(assistant)
  const tools = createWorkArtifactTools(input.dependencies)
  const context: Tool.Context = {
    sessionID: session.id,
    messageID: assistant.id,
    callID: "call_packaged_work_artifact_acceptance",
    agent: "orchestrator",
    abort: new AbortController().signal,
    messages: [],
    executionAuthority: authority,
    executionSurface: Tool.executionSurface(
      Object.values(tools).map((tool) => tool.id),
      [],
    ),
    extra: { projectID: Instance.project.id },
    metadata() {},
  }
  const picture = await AttachmentStore.write(
    Instance.project.id,
    await sharp({ create: { width: 32, height: 32, channels: 4, background: "#2563EB" } })
      .png()
      .toBuffer(),
    "image/png",
    "qualification-picture.png",
  )
  const authored = await tools.author.init().then((tool) =>
    tool.execute(
      input.profile === "office.document@1"
        ? {
            profile: input.profile,
            filename: "周报资格验证.docx",
            locale: "zh-CN",
            paragraphs: [
              { kind: "title", text: "工时周报" },
              { kind: "heading", text: "本周进展" },
              { kind: "paragraph", text: "四模块进展：设计完成、实现完成、验证进行中、交付待确认。" },
              { kind: "paragraph", text: "计划36小时，实际25小时，差值−11小时。" },
            ],
          }
        : input.profile === "office.spreadsheet@1"
          ? {
              profile: input.profile,
              filename: "工时汇总资格验证.xlsx",
              locale: "zh-CN",
              sheets: [
                {
                  name: "工时汇总",
                  columns: ["模块", "计划", "实际", "差值"],
                  rows: [
                    ["登录与注册", 8, 6, -2],
                    ["实现", 12, 10, -2],
                    ["验证", 10, 5, -5],
                    ["交付", 6, 4, -2],
                    ["合计", 36, 25, -11],
                  ],
                },
                {
                  name: "类型",
                  columns: ["编号", "字面文本", "完成", "空值"],
                  rows: [
                    ["001", "=1+1", true, null],
                    ["002", "工时", false, "正常"],
                  ],
                },
              ],
            }
          : {
              profile: "office.presentation@1",
              filename: "packaged-qualification.pptx",
              locale: "en-US",
              aspect_ratio: "16:9",
              slides: [
                {
                  title: "Packaged qualification",
                  background: "#FFFFFF",
                  elements: [
                    {
                      kind: "chart",
                      x: 2,
                      y: 2,
                      width: 29,
                      height: 14,
                      chart_type: "column",
                      title: "Qualified values",
                      categories: ["A", "B"],
                      series: [{ name: "Value", values: [1, 2] }],
                      colors: ["#2563EB"],
                      legend: "bottom",
                      data_labels: "value",
                    },
                    {
                      kind: "picture",
                      x: 29.5,
                      y: 0.5,
                      width: 2,
                      height: 2,
                      source_url: picture.url,
                      alt: "Qualification blue square",
                    },
                  ],
                },
              ],
            },
      context,
    ),
  )
  const source = JSON.parse(authored.output).source as { url: string; sha: string }
  const inspected = await tools.inspect
    .init()
    .then((tool) => tool.execute({ profile: input.profile, source_url: source.url }, context))
  if (JSON.parse(inspected.output).source.sha !== source.sha)
    throw new Error("Packaged inspect did not bind the authored source")
  const validated = await tools.validate
    .init()
    .then((tool) => tool.execute({ profile: input.profile, source_url: source.url }, context))
  const validation = JSON.parse(validated.output)
  const now = Date.now()
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: assistant.id,
    type: "tool",
    callID: "call_packaged_work_artifact_validate",
    tool: "work_artifact_validate",
    state: {
      status: "completed",
      input: { profile: input.profile, source_url: source.url },
      output: validated.output,
      title: validated.title,
      metadata: { truncated: false },
      time: { start: now, end: now + 1 },
    },
  })
  const deliveryReceipt = {
    title: "Packaged qualification",
    source_url: source.url,
    validation_receipt_url: validation.validation_receipt.url,
    validation_receipt_sha: validation.validation_receipt.sha,
  }
  const delivered = await tools.deliver.init().then((tool) =>
    tool.execute(
      input.profile === "office.presentation@1"
        ? {
            ...deliveryReceipt,
            profile: input.profile,
            slides: [{ slide: 1, title: "Packaged qualification", markdown: "Compiled package acceptance." }],
          }
        : { ...deliveryReceipt, profile: input.profile },
      context,
    ),
  )
  await Session.updateMessage({
    ...assistant,
    time: { ...assistant.time, completed: Date.now() },
    finish: "tool-calls",
  })
  const deliveredSource = JSON.parse(delivered.output).source as { sha: string }
  const receiptDigest = createHash("sha256").update(JSON.stringify(validation.validation_receipt_payload)).digest("hex")
  if (receiptDigest !== validation.validation_receipt.sha || deliveredSource.sha !== source.sha) {
    throw new Error("Packaged delivery did not preserve receipt/source identity")
  }
  return {
    source_sha: source.sha,
    receipt_sha: receiptDigest,
    delivered_sha: deliveredSource.sha,
    display: delivered.display?.[0]?.type,
    content: JSON.parse(inspected.output).content,
  }
}
