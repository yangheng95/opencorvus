import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import {
  ProjectRelativePathSchema,
  TaskArtifactSnapshotManifestSchema,
  readExactArtifact,
  tool,
} from "@opencorvus-ai/plugin"
import { generateWebCloneSourceProject } from "../../../lib/frontend-replica/source-project-generator"
import {
  FrontendReplicaSourceContextLocatorSchema,
  resolveFrontendReplicaSourceContextSnapshot,
} from "../../../lib/frontend-replica/source-context/artifact-set"
import {
  assertDirectoryTreeHasNoLinks,
  assertDisjointPaths,
  assertResolvedTargetUnchanged,
  PublicationRecoveryError,
  publishPreparedDirectory,
  resolveProjectPath,
  resolveReplaceableProjectPath,
} from "../../../lib/frontend-replica/project-path"

const packageName = tool.schema.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "must be one canonical lowercase package name")

export default tool({
  description:
    "Generate the Frontend Replica editable React source project from one exact immutable source-context artifact set. The output path is mandatory and project-relative; this tool does not discover source packages, runtime directories, or defaults.",
  args: {
    source_context_locator: FrontendReplicaSourceContextLocatorSchema.describe(
      "Generic exact Task Artifact snapshot locator returned by prepare-source-context.",
    ),
    output_project_path: ProjectRelativePathSchema.describe(
      "Canonical project-relative output directory for the editable Frontend Replica source project.",
    ),
    package_name: packageName.describe("Canonical generated package name."),
    replace_existing: tool.schema.boolean().describe("Whether to replace an existing non-empty output directory."),
  },
  async execute(args, context) {
    const projectDirectory = path.resolve(context.directory)
    const outputTarget = resolveProjectPath(projectDirectory, args.output_project_path, "output_project_path")
    const resolvedOutputProject = await resolveReplaceableProjectPath(
      projectDirectory,
      outputTarget,
      "output_project_path",
      args.replace_existing,
    )
    const manifestRead = await readExactArtifact(
      context.host.engineArtifacts,
      args.source_context_locator,
    )
    const manifestBytes = manifestRead.bytes
    const sourceContext = resolveFrontendReplicaSourceContextSnapshot({
      snapshot: args.source_context_locator.snapshot,
      manifest: TaskArtifactSnapshotManifestSchema.parse(
        JSON.parse(Buffer.from(manifestBytes).toString("utf8")),
      ),
    })
    await Promise.all(
      sourceContext.resources.map((resource) =>
        readExactArtifact(context.host.engineArtifacts, {
          source: "task_artifact_resource",
          ref: resource,
        }),
      ),
    )
    const sourceMaterialization = await context.host.taskArtifacts.materialize({
      snapshot: args.source_context_locator.snapshot,
      tree: sourceContext.sourceContextManifest.tree,
    })
    const sourcePackage = sourceMaterialization.directory
    const outputProject = resolvedOutputProject.path
    assertDisjointPaths(sourcePackage, "source_context", outputProject, "output_project_path")
    assertDisjointPaths(
      context.host.managedRuntimeDirectory,
      "managed runtime directory",
      outputProject,
      "output_project_path",
    )
    await assertDirectoryTreeHasNoLinks(sourcePackage, "source_context")
    await fs.mkdir(path.dirname(outputProject), { recursive: true })
    const stagingRoot = await fs.mkdtemp(
      path.join(path.dirname(outputProject), `.${path.basename(outputProject)}.generating-`),
    )
    let preserveStaging = false
    try {
      const stagedOutputProject = path.join(stagingRoot, "source-project")
      await generateWebCloneSourceProject({
        webpageEvidenceDir: sourcePackage,
        sourceContextManifest: sourceContext.sourceContextManifest,
        referenceArtifact: sourceContext.referenceImage,
        outputDir: stagedOutputProject,
        packageName: args.package_name,
      })
      const currentOutputProject = await resolveReplaceableProjectPath(
        projectDirectory,
        outputTarget,
        "output_project_path",
        args.replace_existing,
      )
      assertResolvedTargetUnchanged(resolvedOutputProject, currentOutputProject, "output_project_path")
      await publishPreparedDirectory(stagedOutputProject, outputProject, {
        replaceExisting: args.replace_existing,
        expectedTargetExists: resolvedOutputProject.existed,
      })

      const sourceManifestPath = path.join(sourcePackage, "web-clone-source-manifest.json")
      const outputManifestPath = path.join(outputProject, "src", "data", "sourceProjectManifest.json")
      const [sourceManifest, outputManifest] = await Promise.all([
        fs.readFile(sourceManifestPath),
        fs.readFile(outputManifestPath),
      ])
      return JSON.stringify(
        {
          schema_version: 1,
          kind: "frontend-replica-source-project",
          source: {
            locator: args.source_context_locator,
            manifest_sha256: createHash("sha256").update(sourceManifest).digest("hex"),
          },
          output: {
            path: args.output_project_path,
            manifest_path: path.posix.join(args.output_project_path, "src/data/sourceProjectManifest.json"),
            manifest_sha256: createHash("sha256").update(outputManifest).digest("hex"),
          },
        },
        null,
        2,
      )
    } catch (error) {
      preserveStaging = error instanceof PublicationRecoveryError
      throw error
    } finally {
      if (!preserveStaging) await fs.rm(stagingRoot, { recursive: true })
    }
  },
})
