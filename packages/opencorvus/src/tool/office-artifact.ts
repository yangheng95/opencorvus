import { publishInteractiveArtifact } from "@/interactive-artifact/persist"
import {
  AuthorOfficeArtifactInput,
  DeliverOfficeArtifactInput,
  InspectOfficeArtifactInput,
  ValidateOfficeArtifactInput,
  authorOfficeArtifact,
  defaultOfficeArtifactDependencies,
  inspectOfficeArtifact,
  prepareOfficeArtifactDeliverable,
  validateOfficeArtifact,
  type OfficeArtifactDependencies,
} from "@/office-artifact/presentation"
import { Tool } from "./tool"
import { taskProcessIdentity } from "./task-files"

export function createOfficeArtifactTools(
  dependencies: OfficeArtifactDependencies = defaultOfficeArtifactDependencies,
) {
  const inspect = Tool.define("office_artifact_inspect", {
    description:
      "Inspect the canonical package and safety structure of one Office artifact without mutating it. Phase one accepts format=presentation and a canonical PPTX attachment URL. This tool does not run raw OfficeCLI commands, XML, shell text, source paths, or remote URLs.",
    parameters: InspectOfficeArtifactInput,
    async execute(args, ctx) {
      const inspected = await inspectOfficeArtifact({ raw: args, extra: ctx.extra })
      return {
        title: `Inspected ${inspected.source.filename ?? "presentation.pptx"}`,
        metadata: {
          format: args.format,
          sourceSha: inspected.source.sha,
          slideCount: inspected.inspection.slideCount,
          entryCount: inspected.inspection.entryCount,
          uncompressedBytes: inspected.inspection.uncompressedBytes,
        },
        output: JSON.stringify({
          format: args.format,
          source: inspected.source,
          inspection: inspected.inspection,
          next: "For a newly authored presentation, call office_artifact_validate on this exact source URL.",
        }),
      }
    },
  })

  const author = Tool.define("office_artifact_author", {
    description:
      "Author one Office artifact from a bounded format-discriminated plan. Phase one accepts format=presentation and creates a new PowerPoint PPTX from typed slides and canonical image attachments. It does not edit an existing file or accept arbitrary OfficeCLI commands, XML, shell text, source paths, or remote URLs. Inspect and validate the returned source URL before delivery.",
    parameters: AuthorOfficeArtifactInput,
    async execute(args, ctx) {
      const processIdentity = taskProcessIdentity(ctx, "Office artifact author")
      const authored = await authorOfficeArtifact({
        raw: args,
        taskID: processIdentity.taskID,
        sessionID: ctx.sessionID,
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
          format: args.format,
          runtime: runtime.label,
        },
        output: JSON.stringify({
          source: authored.reference,
          slides: authored.slideTitles.map((title, index) => ({ slide: index + 1, title })),
          next: "Call office_artifact_inspect and then office_artifact_validate with format=presentation and source.url before delivery.",
        }),
      }
    },
  })

  const validate = Tool.define("office_artifact_validate", {
    description:
      "Independently inspect a canonical PPTX package, run OfficeCLI schema validation and issue inspection, and render every slide to a fresh PNG attachment. Inspect every returned image; command success alone is not visual acceptance. The result is validation evidence, not final delivery.",
    parameters: ValidateOfficeArtifactInput,
    async execute(args, ctx) {
      const processIdentity = taskProcessIdentity(ctx, "Office artifact validator")
      const validated = await validateOfficeArtifact({
        raw: args,
        taskID: processIdentity.taskID,
        sessionID: ctx.sessionID,
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
          format: args.format,
          runtime: runtime.label,
        },
        output: JSON.stringify({
          source: validated.source,
          inspection: validated.inspection,
          validation: validated.validation,
          issues: validated.issues,
          renders: validated.renders,
          next: "Inspect every render. After resolving visual review findings, call office_artifact_deliver with this exact format, source digest, and ordered slide metadata.",
        }),
        attachments: validated.renders.map((render) => ({
          type: "file" as const,
          url: render.url,
          mime: render.mime,
          filename: render.filename,
        })),
      }
    },
  })

  const deliver = Tool.define("office_artifact_deliver", {
    description:
      "Revalidate the exact final PPTX, freshly render every slide, and publish those authoritative results on the current Work assistant message. The source digest and slide count must match the reviewed candidate. This parent-owned tool creates the presentation review Interactive Artifact and returns the downloadable PPTX attachment.",
    parameters: DeliverOfficeArtifactInput,
    async execute(args, ctx) {
      const processIdentity = taskProcessIdentity(ctx, "Office artifact delivery")
      const checked = await prepareOfficeArtifactDeliverable({
        raw: args,
        taskID: processIdentity.taskID,
        sessionID: ctx.sessionID,
        abort: ctx.abort,
        extra: ctx.extra,
        dependencies,
      })
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
      const runtime = await dependencies.runtimeIdentity()
      return {
        title: checked.parsed.title,
        metadata: {
          artifactID: artifact.id,
          renderer: artifact.payload.renderer,
          sourceSha: checked.source.sha,
          slideCount: checked.parsed.slides.length,
          format: args.format,
          runtime: runtime.label,
        },
        output: JSON.stringify({
          artifactID: artifact.id,
          source: checked.source,
          renders: checked.renders,
          fidelity: `${runtime.label} package validation and render evidence; Microsoft PowerPoint pixel fidelity is not claimed.`,
        }),
        attachments: [
          {
            type: "file" as const,
            url: checked.source.url,
            mime: checked.source.mime,
            filename: checked.source.filename,
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

const officeArtifactTools = createOfficeArtifactTools()

export const OfficeArtifactInspectTool = officeArtifactTools.inspect
export const OfficeArtifactAuthorTool = officeArtifactTools.author
export const OfficeArtifactValidateTool = officeArtifactTools.validate
export const OfficeArtifactDeliverTool = officeArtifactTools.deliver
