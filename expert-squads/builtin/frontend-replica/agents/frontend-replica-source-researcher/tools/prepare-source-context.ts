import fs from "node:fs/promises"
import path from "node:path"
import {
  CompiledWebpageAssetGraphSchema,
  CompiledWebpageStructureSchema,
  ProjectRelativePathSchema,
  tool,
} from "@opencorvus-ai/plugin"
import {
  FRONTEND_REPLICA_SOURCE_CONTEXT_TREE,
  FrontendReplicaSourceContextLocatorSchema,
  sourceContextPublicationFiles,
} from "../../../lib/frontend-replica/source-context/artifact-set"
import {
  assertDirectoryTreeHasNoLinks,
  resolveExistingProjectPath,
  resolveProjectPath,
} from "../../../lib/frontend-replica/project-path"
import { prepareWebCloneContext } from "../../../lib/frontend-replica/source-context/context"
import { buildWebCloneHandoff, writeWebCloneHandoff } from "../../../lib/frontend-replica/source-context/handoff"
import { writeWebCloneSourceSkeleton } from "../../../lib/frontend-replica/source-context/source-skeleton"
import type { WebCloneSegments } from "../../../lib/frontend-replica/source-context/schema"

function buildVisualSurfaceCandidates(segments: WebCloneSegments) {
  return {
    version: 1,
    purpose: "web-clone-visual-surface-candidates",
    sourceIr: segments.sourceIr,
    assetManifest: segments.assetManifest,
    candidates: segments.segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      rootNodeId: segment.rootNodeId,
      tag: segment.tag,
      strategy: segment.strategy,
      bounds: segment.bounds,
      layout: segment.layout,
      textPreview: segment.textPreview,
      assetIds: segment.assetIds,
      sourceRefs: segment.nodeIds,
    })),
  }
}

export default tool({
  description:
    "Transform one explicit compiled webpage evidence directory into one immutable Frontend Replica source-context TaskArtifact set. The evidence path is mandatory and project-relative; this tool does not capture pages, infer runtime directories, choose source URLs, or publish a mutable source package.",
  args: {
    webpage_evidence_path: ProjectRelativePathSchema.describe(
      "Project-relative directory containing page.ir.json, assets/manifest.json, reference.png, and runtime-state evidence.",
    ),
  },
  async execute(args, context) {
    const projectDirectory = path.resolve(context.directory)
    const evidenceTarget = resolveProjectPath(projectDirectory, args.webpage_evidence_path, "webpage_evidence_path")
    const expectedEvidenceTarget = path.resolve(context.host.managedRuntimeDirectory, "webpage-evidence")
    if (path.relative(expectedEvidenceTarget, evidenceTarget) !== "") {
      throw new Error(
        "webpage_evidence_path must resolve to the current task managed runtime webpage-evidence directory",
      )
    }
    const webpageEvidenceDir = await resolveExistingProjectPath(
      projectDirectory,
      evidenceTarget,
      "webpage_evidence_path",
    )
    await assertDirectoryTreeHasNoLinks(webpageEvidenceDir, "webpage_evidence_path")

    const stage = await context.host.taskArtifacts.stage({ trees: [FRONTEND_REPLICA_SOURCE_CONTEXT_TREE] })
    const sourceContextDir = stage.treeDirectories[FRONTEND_REPLICA_SOURCE_CONTEXT_TREE]!
    const stagedEvidenceDir = path.join(path.dirname(sourceContextDir), ".webpage-evidence")
    const preparedSourceContextDir = path.join(path.dirname(sourceContextDir), ".prepared-source-context")
    await fs.cp(webpageEvidenceDir, stagedEvidenceDir, { recursive: true })
    const [pageStructureText, assetManifestText] = await Promise.all([
      fs.readFile(path.join(stagedEvidenceDir, "page.ir.json"), "utf8"),
      fs.readFile(path.join(stagedEvidenceDir, "assets", "manifest.json"), "utf8"),
    ])
    const pageStructure = CompiledWebpageStructureSchema.parse(JSON.parse(pageStructureText))
    const assetGraph = CompiledWebpageAssetGraphSchema.parse(JSON.parse(assetManifestText))
    const handoff = buildWebCloneHandoff(pageStructure, assetGraph)
    await writeWebCloneHandoff(stagedEvidenceDir, handoff)
    await writeWebCloneSourceSkeleton({
      outputDir: stagedEvidenceDir,
      pageIr: pageStructure,
      assetGraph,
      segments: handoff.segments,
    })
    await fs.writeFile(
      path.join(stagedEvidenceDir, "visual-surface-candidates.json"),
      `${JSON.stringify(buildVisualSurfaceCandidates(handoff.segments), null, 2)}\n`,
      "utf8",
    )
    await prepareWebCloneContext({
      webpageEvidenceDir: stagedEvidenceDir,
      webpageEvidenceRef: args.webpage_evidence_path,
      outputDir: preparedSourceContextDir,
    })
    await fs.cp(preparedSourceContextDir, sourceContextDir, { recursive: true })
    await fs.rm(stagedEvidenceDir, { recursive: true })
    await fs.rm(preparedSourceContextDir, { recursive: true })

    const publication = await context.host.taskArtifacts.publish(stage, {
      snapshot_kind: "catalog",
      files: await sourceContextPublicationFiles(sourceContextDir),
    })
    return JSON.stringify(
      FrontendReplicaSourceContextLocatorSchema.parse({
        source: "task_artifact_snapshot",
        snapshot: publication.snapshot,
      }),
      null,
      2,
    )
  },
})
