import { publishInteractiveArtifact } from "@/interactive-artifact/persist"
import {
  AuthorWorkArtifactInput,
  DeliverWorkArtifactInput,
  InspectWorkArtifactInput,
  ValidateWorkArtifactInput,
  authorWorkArtifactPresentation,
  defaultWorkArtifactPresentationDependencies,
  inspectWorkArtifactPresentation,
  validateWorkArtifactPresentation,
  type WorkArtifactPresentationDependencies,
} from "@/work-artifact/presentation"
import { Tool } from "./tool"
import { prepareAuthorizedWorkArtifactPresentationDeliverable } from "@/work-artifact/validation-authority"
import { WorkArtifactProfileRegistry } from "@/work-artifact/profile-registry"

export function createWorkArtifactTools(
  dependencies: WorkArtifactPresentationDependencies = defaultWorkArtifactPresentationDependencies,
) {
  const inspect = Tool.define("work_artifact_inspect", {
    description:
      "Inspect one canonical Work Artifact without mutation. The qualified office.presentation@1 profile accepts a canonical PPTX attachment URL and returns package structure and safety facts. Raw commands, XML, shell text, filesystem paths, and remote URLs are not accepted.",
    parameters: InspectWorkArtifactInput,
    async execute(args, ctx) {
      const inspected = await inspectWorkArtifactPresentation({ raw: args, abort: ctx.abort, extra: ctx.extra })
      return {
        title: `Inspected ${inspected.source.filename ?? "presentation.pptx"}`,
        metadata: {
          profile: args.profile,
          sourceSha: inspected.source.sha,
          slideCount: inspected.inspection.slideCount,
          entryCount: inspected.inspection.entryCount,
          uncompressedBytes: inspected.inspection.uncompressedBytes,
        },
        output: JSON.stringify({
          profile: args.profile,
          source: inspected.source,
          inspection: inspected.inspection,
          next: "For a newly authored presentation, call work_artifact_validate on this exact source URL.",
        }),
      }
    },
  })

  const author = Tool.define("work_artifact_author", {
    description:
      "Author one Work Artifact from a bounded profile-discriminated plan. The qualified office.presentation@1 profile creates a new PPTX from typed slides and canonical image attachments. It does not edit existing files or accept raw OfficeCLI commands, XML, shell text, filesystem paths, or remote URLs.",
    parameters: AuthorWorkArtifactInput,
    async execute(args, ctx) {
      const authored = await authorWorkArtifactPresentation({
        raw: args,
        executionAuthority: Tool.requireExecutionAuthority(ctx),
        abort: ctx.abort,
        extra: ctx.extra,
        dependencies,
      })
      const runtime = await dependencies.runtimeIdentity()
      return {
        title: `Authored ${authored.reference.filename ?? "presentation.pptx"}`,
        metadata: {
          sourceSha: authored.reference.sha,
          slideCount: authored.slideTitles.length,
          profile: args.profile,
          runtime: runtime.label,
          runtimeLockRevision: runtime.lockRevision,
          runtimePackageSha: runtime.packageSha,
        },
        output: JSON.stringify({
          profile: args.profile,
          source: authored.reference,
          slides: authored.slideTitles.map((title, index) => ({ slide: index + 1, title })),
          next: "Call work_artifact_inspect and then work_artifact_validate on source.url before delivery.",
        }),
      }
    },
  })

  const validate = Tool.define("work_artifact_validate", {
    description:
      "Validate one canonical Work Artifact and return a digest-bound receipt. For office.presentation@1 this inspects the PPTX package, runs OfficeCLI validation and issue inspection, and freshly renders every slide to PNG. Inspect every returned render; command success is not visual acceptance.",
    parameters: ValidateWorkArtifactInput,
    async execute(args, ctx) {
      const validated = await validateWorkArtifactPresentation({
        raw: args,
        executionAuthority: Tool.requireExecutionAuthority(ctx),
        abort: ctx.abort,
        extra: ctx.extra,
        dependencies,
      })
      const runtime = await dependencies.runtimeIdentity()
      return {
        title: `Validated ${validated.source.filename ?? "presentation.pptx"}`,
        metadata: {
          sourceSha: validated.source.sha,
          slideCount: validated.inspection.slideCount,
          entryCount: validated.inspection.entryCount,
          uncompressedBytes: validated.inspection.uncompressedBytes,
          profile: args.profile,
          runtime: runtime.label,
          receiptSha: validated.receipt.reference.sha,
        },
        output: JSON.stringify({
          source: validated.source,
          inspection: validated.inspection,
          validation: validated.validation,
          issues: validated.issues,
          renders: validated.renders,
          resource_usage: validated.resourceUsage,
          validation_receipt: validated.receipt.reference,
          validation_receipt_payload: validated.receipt.payload,
          next: "Inspect every render. After resolving findings, pass this exact receipt to work_artifact_deliver.",
        }),
        attachments: [
          {
            type: "file" as const,
            url: validated.receipt.reference.url,
            mime: validated.receipt.reference.mime,
            filename: validated.receipt.reference.filename,
          },
          ...validated.renders.map((render) => ({
            type: "file" as const,
            url: render.url,
            mime: render.mime,
            filename: render.filename,
          })),
        ],
      }
    },
  })

  const deliver = Tool.define("work_artifact_deliver", {
    description:
      "Consume the exact validation receipt, revalidate and freshly render the final Work Artifact, then publish authoritative results on the current parent Work message. For office.presentation@1 this returns the PPTX attachment and presentation review Interactive Artifact.",
    parameters: DeliverWorkArtifactInput,
    async execute(args, ctx) {
      const limits = WorkArtifactProfileRegistry.require(args.profile).limits
      const deadline = performance.now() + limits.wallClockMs
      const checked = await prepareAuthorizedWorkArtifactPresentationDeliverable({
        raw: args,
        sessionID: ctx.sessionID,
        executionAuthority: Tool.requireExecutionAuthority(ctx),
        abort: ctx.abort,
        extra: ctx.extra,
        dependencies,
        deadline,
      })
      if (ctx.abort.aborted || performance.now() > deadline) {
        throw new Error(`Work Artifact operation exceeded ${limits.wallClockMs}ms`)
      }
      const runtime = await dependencies.runtimeIdentity()
      if (ctx.abort.aborted || performance.now() > deadline) {
        throw new Error(`Work Artifact operation exceeded ${limits.wallClockMs}ms`)
      }
      const artifact = await publishInteractiveArtifact({
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        payload: {
          schemaVersion: "1",
          renderer: "presentation@1",
          title: checked.parsed.title,
          aspectRatio: "16:9",
          slides: checked.parsed.slides.map((slide, index) => ({
            id: `slide-${slide.slide}`,
            title: slide.title,
            markdown: slide.markdown,
            image: checked.renders[index],
            imageAlt: `Rendered slide ${slide.slide}: ${slide.title}`,
          })),
        },
      })
      if (ctx.abort.aborted || performance.now() > deadline) {
        throw new Error(`Work Artifact operation exceeded ${limits.wallClockMs}ms`)
      }
      return {
        title: checked.parsed.title,
        metadata: {
          artifactID: artifact.id,
          renderer: artifact.payload.renderer,
          sourceSha: checked.source.sha,
          slideCount: checked.parsed.slides.length,
          profile: args.profile,
          runtime: runtime.label,
          validationReceiptSha: checked.receipt.reference.sha,
        },
        output: JSON.stringify({
          artifactID: artifact.id,
          source: checked.source,
          renders: checked.renders,
          final_validation_receipt: checked.receipt.reference,
          final_validation_receipt_payload: checked.receipt.payload,
          fidelity: `${runtime.label} package validation and render evidence; Microsoft PowerPoint pixel fidelity is not claimed.`,
        }),
        attachments: [
          {
            type: "file" as const,
            url: checked.source.url,
            mime: checked.source.mime,
            filename: checked.source.filename,
          },
          {
            type: "file" as const,
            url: checked.receipt.reference.url,
            mime: checked.receipt.reference.mime,
            filename: checked.receipt.reference.filename,
          },
          ...checked.renders.map((render) => ({
            type: "file" as const,
            url: render.url,
            mime: render.mime,
            filename: render.filename,
          })),
        ],
        display: [{ type: "interactive-artifact" as const, artifactID: artifact.id }],
      }
    },
  })

  return { inspect, author, validate, deliver }
}

const workArtifactTools = createWorkArtifactTools()

export const WorkArtifactInspectTool = workArtifactTools.inspect
export const WorkArtifactAuthorTool = workArtifactTools.author
export const WorkArtifactValidateTool = workArtifactTools.validate
export const WorkArtifactDeliverTool = workArtifactTools.deliver
