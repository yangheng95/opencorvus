import { afterAll, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Tool } from "../../src/tool/tool"
import { createWorkArtifactTools } from "../../src/tool/work-artifact"
import { Process } from "../../src/util/process"
import { AttachmentStore } from "../../src/storage/attachment-store"
import sharp from "sharp"
import { prepareWorkArtifactRuntimeEnvironment, type WorkArtifactPresentationDependencies } from "../../src/work-artifact/presentation"
import { WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST, WorkArtifactTargetPackageManifestSchema } from "../../src/work-artifact/runtime/package-manifest"
import { officeCliRuntime, parseWorkArtifactRuntimeLock, WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH } from "../../src/work-artifact/runtime/runtime-lock"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packageRoot = process.env.OPENCORVUS_WORK_ARTIFACT_PACKAGE_ROOT
const packagedTest = packageRoot ? test : test.skip

afterAll(async () => {
  await resetMemoryDatabase()
})

packagedTest("packaged Work Artifact runtime completes the production typed Tool lifecycle", async () => {
  const root = path.resolve(packageRoot!)
  const manifest = WorkArtifactTargetPackageManifestSchema.parse(
    JSON.parse(await fs.readFile(path.join(root, WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST), "utf8")),
  )
  const lock = parseWorkArtifactRuntimeLock(
    JSON.parse(await fs.readFile(path.join(root, ...WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH.split("/")), "utf8")),
  )
  const runtime = officeCliRuntime(lock)
  const executableEntry = manifest.files.find((file) => file.kind === "executable")!
  const executable = path.join(root, ...executableEntry.path.split("/"))
  const dependencies: WorkArtifactPresentationDependencies = {
    async officeCliPath() {
      return executable
    },
    async runtimeIdentity() {
      return {
        id: "officecli",
        label: `OfficeCLI v${runtime.version}`,
        version: runtime.version,
        lockRevision: manifest.runtime_lock_revision,
        packageSha: executableEntry.sha256,
      }
    },
    async runOfficeCli(input) {
      return Process.runHost([executable, ...input.args], {
        cwd: input.cwd,
        abort: input.abort,
        env: { ...(await prepareWorkArtifactRuntimeEnvironment(input.cwd)), ...runtime.execution_policy.environment },
        inactivityTimeoutMs: 45_000,
        inactivityTimeoutMessage: "OfficeCLI was inactive for 45000ms",
        timeoutMs: input.timeoutMs,
        maxOutputBytes: input.maxOutputBytes,
      })
    },
  }
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Packaged Work Artifact lifecycle" })
      const authority = {
        kind: "conversation" as const,
        sessionID: session.id,
        projectID: Instance.project.id,
        directory: project.path,
      }
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"), sessionID: session.id, parentID: "msg_packaged_work_artifact_user",
        role: "assistant", author: "orchestrator", time: { created: Date.now(), completed: Date.now() },
        agent: "orchestrator", providerID: "qualification", modelID: "qualification",
        path: { cwd: project.path, root: project.path }, cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } }, finish: "tool-calls",
      })
      const tools = createWorkArtifactTools(dependencies)
      const context: Tool.Context = {
        sessionID: session.id, messageID: assistant.id, callID: "call_packaged_work_artifact", agent: "orchestrator",
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
        slides: [{
          title: "Packaged qualification",
          background: "#FFFFFF",
          elements: [{
            kind: "chart", x: 2, y: 2, width: 29, height: 14, chart_type: "column",
            title: "Qualified values", categories: ["A", "B"],
            series: [{ name: "Value", values: [1, 2] }], colors: ["#2563EB"],
            legend: "bottom", data_labels: "value",
          }, {
            kind: "picture", x: 29.5, y: 0.5, width: 2, height: 2,
            source_url: picture.url, alt: "Qualification blue square",
          }],
        }],
      }, context))
      const source = JSON.parse(authored.output).source as { url: string; sha: string }
      const inspected = await tools.inspect.init().then((tool) => tool.execute({ profile: "office.presentation@1", source_url: source.url }, context))
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
        slides: [{ slide: 1, title: "Packaged qualification", markdown: "Real packaged runtime evidence." }],
      }, context))
      expect({
        sourceSha: source.sha,
        inspectedSha: JSON.parse(inspected.output).source.sha,
        deliveredSha: JSON.parse(delivered.output).source.sha,
        receiptDigest: createHash("sha256").update(JSON.stringify(validation.validation_receipt_payload)).digest("hex"),
        attachments: delivered.attachments?.length,
        display: delivered.display?.[0]?.type,
      }).toEqual({
        sourceSha: source.sha, inspectedSha: source.sha, deliveredSha: source.sha,
        receiptDigest: validation.validation_receipt.sha, attachments: 3, display: "interactive-artifact",
      })
    },
  })
}, 180_000)
