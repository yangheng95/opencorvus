import path from "node:path"
import { DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT } from "@/browser/webpage/default-viewport"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { AttachmentStore } from "@/storage/attachment-store"
import { Filesystem } from "@/util/filesystem"
import {
  DesignResourceManifestSchema,
  type DesignResourceEntry,
  type DesignResourceManifest,
} from "./design-resource-manifest"

export const RENDERABLE_DESIGN_SOURCE_INTENTS = ["design_source", "interaction_reference"] as const

type RenderHtml = (input: {
  entrypointFile: string
  viewport: { width: number; height: number }
  captureMode: "full_page"
}) => Promise<Buffer>

export function isRenderableDesignSource(entry: DesignResourceEntry): boolean {
  return entry.kind === "html" && (entry.intent === "design_source" || entry.intent === "interaction_reference")
}

function resolveCanonicalHtmlFile(entry: DesignResourceEntry, projectID: string): string {
  const located = AttachmentStore.nameFromUrl(entry.canonical_ref)
  if (!located || located.projectID !== projectID) {
    throw new Error(
      `renderable design source ${entry.id} must use a canonical AttachmentStore ref owned by project ${projectID}`,
    )
  }
  const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)
  if (!absolute) throw new Error(`renderable design source ${entry.id} is missing from AttachmentStore`)
  return absolute
}

/**
 * Project explicitly declared HTML source authority into inspectable raster
 * evidence without creating a second semantic index. The returned Design
 * Resource Manifest remains the sole index: each source row and rendered row
 * links to the other through `related_entries`, while AttachmentStore remains
 * the byte store and the task Frontend Design directory owns comparison files.
 */
export async function projectRenderableDesignSources(input: {
  manifest: DesignResourceManifest
  projectID: string
  projectDir: string
  renderHtml: RenderHtml
  now?: number
}): Promise<DesignResourceManifest> {
  const sources = input.manifest.entries.filter(isRenderableDesignSource)
  if (sources.length === 0) return input.manifest

  const frontendDesignPaths = ProjectRuntimePaths.frontendDesignPaths(input.projectDir, input.manifest.task_id)
  const outputRelativeDir = path.posix.join(frontendDesignPaths.relativeDir, "source-references")
  const outputAbsoluteDir = path.join(frontendDesignPaths.absoluteDir, "source-references")
  const createdAt = input.now ?? Date.now()
  const derived: DesignResourceEntry[] = []
  const renderedIDs = new Map<string, string>()

  for (const source of sources) {
    const renderedID = `${source.id}-rendered-reference`
    const filename = `${source.id}.png`
    const screenshot = await input.renderHtml({
      entrypointFile: resolveCanonicalHtmlFile(source, input.projectID),
      viewport: DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT,
      captureMode: "full_page",
    })
    const relativeArtifactPath = path.posix.join(outputRelativeDir, filename)
    await Filesystem.writeAtomic(path.join(outputAbsoluteDir, filename), screenshot)
    const stored = await AttachmentStore.write(
      input.projectID,
      screenshot,
      "image/png",
      `${source.region ?? source.id}.reference.png`,
    )
    derived.push({
      id: renderedID,
      kind: "image",
      intent: "visual_reference",
      origin: "rendered_design_source",
      mime: stored.mime,
      sha256: stored.sha,
      canonical_ref: stored.url,
      size: stored.size,
      materializer: "node_playwright_static_file",
      related_entries: [source.id],
      artifact_paths: [relativeArtifactPath],
      viewport: `${DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT.width}x${DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT.height} desktop`,
      ...(source.region ? { region: source.region } : {}),
      created_at: createdAt,
    })
    renderedIDs.set(source.id, renderedID)
  }

  return DesignResourceManifestSchema.parse({
    ...input.manifest,
    entries: [
      ...input.manifest.entries.map((entry) => {
        const renderedID = renderedIDs.get(entry.id)
        return renderedID ? { ...entry, related_entries: [...new Set([...entry.related_entries, renderedID])] } : entry
      }),
      ...derived,
    ],
  })
}
