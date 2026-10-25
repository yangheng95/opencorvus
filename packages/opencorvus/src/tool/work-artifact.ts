import { publishInteractiveArtifact } from "@/interactive-artifact/persist"
import {
  AuthorWorkArtifactInput as AuthorPresentationInput,
  DeliverWorkArtifactInput as DeliverPresentationInput,
  InspectWorkArtifactInput as InspectPresentationInput,
  authorWorkArtifactPresentation,
  defaultWorkArtifactPresentationDependencies,
  inspectWorkArtifactPresentation,
  validateWorkArtifactPresentation,
  type WorkArtifactPresentationDependencies,
} from "@/work-artifact/presentation"
import { Tool } from "./tool"
import {
  prepareAuthorizedOfficeDeliverable,
  prepareAuthorizedWorkArtifactPresentationDeliverable,
} from "@/work-artifact/validation-authority"
import { WorkArtifactProfileRegistry } from "@/work-artifact/profile-registry"
import {
  AuthorOfficeInput,
  DeliverOfficeInput,
  InspectOfficeInput,
  authorOfficeArtifact,
  inspectOfficeArtifact,
  validateOfficeArtifact,
} from "@/work-artifact/office-document"
import z from "zod"

const AuthorWorkArtifactInput = z.union([AuthorPresentationInput, AuthorOfficeInput])
const InspectWorkArtifactInput = z.union([InspectPresentationInput, InspectOfficeInput])
const DeliverWorkArtifactInput = z.union([DeliverPresentationInput, DeliverOfficeInput])
const ValidateWorkArtifactInput = InspectWorkArtifactInput

export function createWorkArtifactTools(
  dependencies: WorkArtifactPresentationDependencies = defaultWorkArtifactPresentationDependencies,
) {
  const inspect = Tool.define<typeof InspectWorkArtifactInput, Record<string, unknown>>("work_artifact_inspect", {
    description:
      "Inspect one canonical Work Artifact without mutation. Qualified profiles accept PPTX, DOCX or XLSX canonical attachments and return package structure and safety facts. Raw commands, XML, shell text, filesystem paths, and remote URLs are not accepted.",
    parameters: InspectWorkArtifactInput,
    async execute(args, ctx) {
      if (args.profile !== "office.presentation@1") {
        const inspected = await inspectOfficeArtifact({
          raw: args,
          executionAuthority: Tool.requireExecutionAuthority(ctx),
          abort: ctx.abort,
          extra: ctx.extra,
          dependencies,
        })
        return {
          title: `Inspected ${inspected.source.filename}`,
          metadata: { profile: args.profile, sourceSha: inspected.source.sha, ...inspected.inspection },
          output: JSON.stringify({
            ...inspected,
            profile: args.profile,
            next: "Validate this exact source URL before delivery.",
          }),
        }
      }
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

  const author = Tool.define<typeof AuthorWorkArtifactInput, Record<string, unknown>>("work_artifact_author", {
    description:
      "Author one Work Artifact from a bounded profile-discriminated plan: office.presentation@1 creates PPTX slides; office.document@1 creates DOCX paragraphs; office.spreadsheet@1 creates XLSX literal cells. Does not edit existing files or accept raw commands, formulas, XML, shell text, filesystem paths, or remote URLs. The editable file is the primary deliverable.",
    parameters: AuthorWorkArtifactInput,
    async execute(args, ctx) {
      if (args.profile !== "office.presentation@1") {
        const authored = await authorOfficeArtifact({
          raw: args,
          executionAuthority: Tool.requireExecutionAuthority(ctx),
          abort: ctx.abort,
          extra: ctx.extra,
          dependencies,
        })
        return {
          title: `Authored ${authored.reference.filename}`,
          metadata: { profile: args.profile, sourceSha: authored.reference.sha },
          output: JSON.stringify({
            profile: args.profile,
            source: authored.reference,
            next: "Inspect and validate this exact source URL. Review every returned render before delivery.",
          }),
        }
      }
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

  const validate = Tool.define<typeof ValidateWorkArtifactInput, Record<string, unknown>>("work_artifact_validate", {
    description:
      "Validate one canonical Work Artifact and return a digest-bound receipt. Inspects the Office package, runs OfficeCLI validation and issue inspection, and freshly renders every slide, document page or worksheet to PNG. DOCX/XLSX also return a derived PDF preview. Inspect every render; command success is not visual acceptance.",
    parameters: ValidateWorkArtifactInput,
    async execute(args, ctx) {
      if (args.profile !== "office.presentation@1") {
        const validated = await validateOfficeArtifact({
          raw: args,
          executionAuthority: Tool.requireExecutionAuthority(ctx),
          abort: ctx.abort,
          extra: ctx.extra,
          dependencies,
        })
        return {
          title: `Validated ${validated.source.filename}`,
          metadata: {
            profile: args.profile,
            sourceSha: validated.source.sha,
            pageCount: validated.renders.length,
            receiptSha: validated.receipt.reference.sha,
          },
          output: JSON.stringify({
            source: validated.source,
            inspection: validated.inspection,
            validation: validated.validation,
            issues: validated.issues,
            renders: validated.renders,
            preview: validated.preview,
            resource_usage: validated.resourceUsage,
            validation_receipt: validated.receipt.reference,
            validation_receipt_payload: validated.receipt.payload,
            next: "Inspect every render, then deliver this exact source and receipt.",
          }),
          attachments: [validated.receipt.reference, ...validated.renders].map((reference) => ({
            type: "file" as const,
            url: reference.url,
            mime: reference.mime,
            filename: reference.filename,
          })),
        }
      }
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

  const deliver = Tool.define<typeof DeliverWorkArtifactInput, Record<string, unknown>>("work_artifact_deliver", {
    description:
      "Consume the exact validation receipt from this Session, revalidate and freshly render the final Work Artifact, then publish the actual editable PPTX/DOCX/XLSX attachment on the current authorized Work or Task message. PPTX has a presentation review; DOCX/XLSX have a derived PDF preview. The preview does not replace the source file.",
    parameters: DeliverWorkArtifactInput,
    async execute(args, ctx) {
      const limits = WorkArtifactProfileRegistry.require(args.profile).limits
      const deadline = performance.now() + limits.wallClockMs
      if (args.profile !== "office.presentation@1") {
        const checked = await prepareAuthorizedOfficeDeliverable({
          raw: args,
          sessionID: ctx.sessionID,
          executionAuthority: Tool.requireExecutionAuthority(ctx),
          abort: ctx.abort,
          extra: ctx.extra,
          dependencies,
          deadline,
        })
        const artifact = await publishInteractiveArtifact({
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          payload: {
            schemaVersion: "1",
            renderer: "file-preview@1",
            kind: "pdf",
            title: checked.parsed.title,
            source: checked.preview,
          },
        })
        if (ctx.abort.aborted || performance.now() > deadline)
          throw new Error(`Work Artifact operation exceeded ${limits.wallClockMs}ms`)
        return {
          title: checked.parsed.title,
          metadata: {
            artifactID: artifact.id,
            renderer: artifact.payload.renderer,
            profile: args.profile,
            sourceSha: checked.source.sha,
            pageCount: checked.renders.length,
            validationReceiptSha: checked.receipt.reference.sha,
          },
          output: JSON.stringify({
            artifactID: artifact.id,
            source: checked.source,
            preview: checked.preview,
            renders: checked.renders,
            final_validation_receipt: checked.receipt.reference,
            final_validation_receipt_payload: checked.receipt.payload,
            fidelity:
              "OfficeCLI package validation and local browser-derived review; Microsoft Office pixel fidelity is not claimed.",
          }),
          attachments: [checked.source, checked.preview, checked.receipt.reference, ...checked.renders].map(
            (reference) => ({
              type: "file" as const,
              url: reference.url,
              mime: reference.mime,
              filename: reference.filename,
            }),
          ),
          display: [{ type: "interactive-artifact" as const, artifactID: artifact.id }],
        }
      }
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
