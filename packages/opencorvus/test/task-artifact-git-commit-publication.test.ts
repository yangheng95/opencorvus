import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { Session } from "../src/session"
import {
  assertMergedPrimaryCommitToolAuthorityFromFacts,
  resolveArtifactSnapshotReadAuthorityFromFacts,
} from "../src/build/merge-back-publication-authority"
import type { SessionRuntimeContract } from "../src/session/runtime-contract"
import {
  publishTaskArtifactGitCommitSubtree,
  publishTaskArtifactProjectFiles,
  readTaskArtifactRef,
} from "../src/task-artifact/store"
import { createToolExecutionSurface } from "../src/tool/execution-surface"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"
import { hostGit } from "../src/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { ArtifactSnapshotTool } from "../src/tool/artifact-catalog"
import { asSchema } from "ai"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "a".repeat(64),
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory, timeoutProfile: "default" })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim())
  return result.stdout.toString().trim()
}

describe("Task Artifact immutable Git commit publication", () => {
  test("projects snapshot inputs from the frozen current-project or managed-Build authority", async () => {
    const current = await ArtifactSnapshotTool.init({ artifactSnapshotSource: "current_task_project" })
    const managed = await ArtifactSnapshotTool.init({ artifactSnapshotSource: "merged_primary_commit" })
    const currentSchema = asSchema(current.parameters as never).jsonSchema as Record<string, any>
    const managedSchema = asSchema(managed.parameters as never).jsonSchema as Record<string, any>
    const files = [{ path: "artifacts/result.md", media_type: "text/markdown" }]

    expect({
      currentProperties: Object.keys(currentSchema.properties).sort(),
      currentRequired: currentSchema.required,
      currentInput: current.parameters.parse({ files }),
      managedProperties: Object.keys(managedSchema.properties).sort(),
      managedRequired: managedSchema.required,
      managedInput: managed.parameters.parse({ source_commit: "d".repeat(40), files }),
    }).toEqual({
      currentProperties: ["files"],
      currentRequired: ["files"],
      currentInput: { files },
      managedProperties: ["files", "source_commit"],
      managedRequired: ["source_commit", "files"],
      managedInput: { source_commit: "d".repeat(40), files },
    })
  })

  test("publishes exact current-project input bytes from a projected Task scheduler", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const file = "case/input.md"
        const expected = "# Frozen scheduler input\n\nExact Case bytes.\n"
        await fs.mkdir(path.dirname(path.join(project.path, file)), { recursive: true })
        await fs.writeFile(path.join(project.path, file), expected)

        const rootSession = await Session.create({ kind: "root", title: "Scheduler snapshot contract" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: rootSession.id,
          now,
          title: "Scheduler snapshot contract",
          request: "Freeze exact current-project Task inputs before dispatch",
          productPillar: "work",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          queue: false,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const messageID = Identifier.ascending("message")
        const partID = Identifier.ascending("part")
        const callID = Identifier.ascending("tool")
        await Session.updateMessage({
          id: messageID,
          sessionID: rootSession.id,
          role: "assistant",
          author: "orchestrator",
          time: { created: now + 10 },
          parentID: Identifier.ascending("message"),
          modelID: "test",
          providerID: "test",
          agent: "orchestrator",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: partID,
          sessionID: rootSession.id,
          messageID,
          type: "tool",
          callID,
          tool: "artifact_snapshot",
          state: {
            status: "running",
            input: { files: [{ path: file, media_type: "text/markdown" }] },
            time: { start: now + 20 },
          },
        })
        const scope: TaskToolExecutionScope = Object.freeze({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: rootSession.id,
          messageID,
          toolCallID: callID,
          toolPartID: partID,
          executionSurface: createToolExecutionSurface({ toolIDs: ["artifact_snapshot"], permission: [] }),
          owner: Object.freeze({
            kind: "projected-scheduler",
            expertSquadID: "base",
            packageRevision,
            agentID: "orchestrator",
            projectionHash: "d".repeat(64),
          }),
        })
        const contract = {
          identity: {
            identityKind: "projected-scheduler",
            sessionID: rootSession.id,
            taskID,
            agentID: "orchestrator",
          },
          stageTools: {},
          projectedTools: {},
        } as unknown as SessionRuntimeContract
        const source = resolveArtifactSnapshotReadAuthorityFromFacts({
          scope,
          contract,
          messages: await Session.messages({ sessionID: rootSession.id }),
        })
        const publication = await publishTaskArtifactProjectFiles({
          scope,
          source,
          files: [{ path: file, mediaType: "text/markdown" }],
        })
        const published = Buffer.from(
          await readTaskArtifactRef({
            projectID: Instance.project.id,
            projectDirectory: project.path,
            taskID,
            ref: publication.artifacts[0]!,
          }),
        ).toString("utf8")

        expect({
          source,
          published,
          path: publication.artifacts[0]!.path,
          producer: publication.manifest.producer,
        }).toEqual({
          source: { kind: "current_task_project" },
          published: expected,
          path: file,
          producer: expect.objectContaining({
            owner_kind: "projected-scheduler",
            agent_id: "orchestrator",
          }),
        })
      },
    })
  })

  test("publishes the exact merge_back commit bytes after the primary worktree advances", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const file = "artifacts/最终 report.md"
        const absolute = path.join(project.path, ...file.split("/"))
        await fs.mkdir(path.dirname(absolute), { recursive: true })
        await fs.writeFile(absolute, "# Exact merged report\n\nVersion one.\n")
        const packageRoot = "candidate/acme/sample"
        const packageReadme = `${packageRoot}/README.md`
        const packageManifest = `${packageRoot}/expert-squad.jsonc`
        await fs.mkdir(path.dirname(path.join(project.path, packageReadme)), { recursive: true })
        await fs.writeFile(path.join(project.path, packageReadme), "# Candidate package\n")
        await fs.writeFile(path.join(project.path, packageManifest), '{"schema_version":1}\n')
        await git(project.path, ["add", "--", file, packageRoot])
        await git(project.path, ["commit", "-m", "publish exact report version"])
        const sourceCommit = await git(project.path, ["rev-parse", "HEAD"])

        await fs.writeFile(absolute, "# Later primary report\n\nVersion two.\n")
        await git(project.path, ["add", "--", file])
        await git(project.path, ["commit", "-m", "advance primary report version"])
        const currentPrimary = await fs.readFile(absolute, "utf8")

        const rootSession = await Session.create({ kind: "root", title: "Commit publication contract" })
        const workerSession = await Session.createNext({
          kind: "build",
          parentID: rootSession.id,
          directory: project.path,
          title: "Commit publication worker",
        })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: rootSession.id,
          now,
          title: "Commit publication contract",
          request: "Publish exact immutable merge result bytes",
          productPillar: "work",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          queue: false,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const assistantMessageID = Identifier.ascending("message")
        const mergePartID = Identifier.ascending("part")
        const snapshotPartID = Identifier.ascending("part")
        const mergeStarted = now + 10
        const snapshotStarted = now + 30
        await Session.updateMessage({
          id: assistantMessageID,
          sessionID: workerSession.id,
          role: "assistant",
          author: "base-developer",
          time: { created: mergeStarted },
          parentID: Identifier.ascending("message"),
          modelID: "test",
          providerID: "test",
          agent: "base-developer",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: mergePartID,
          sessionID: workerSession.id,
          messageID: assistantMessageID,
          type: "tool",
          callID: Identifier.ascending("tool"),
          tool: "merge_back",
          state: {
            status: "completed",
            input: {},
            output: JSON.stringify({
              status: "merged",
              primary_head: sourceCommit,
              primary_branch: "main",
            }),
            title: "Merged",
            metadata: {},
            time: { start: mergeStarted, end: mergeStarted + 10 },
          },
        })
        await Session.updatePart({
          id: snapshotPartID,
          sessionID: workerSession.id,
          messageID: assistantMessageID,
          type: "tool",
          callID: Identifier.ascending("tool"),
          tool: "artifact_snapshot",
          state: {
            status: "running",
            input: { source_commit: sourceCommit, files: [{ path: file, media_type: "text/markdown" }] },
            time: { start: snapshotStarted },
          },
        })
        const scope: TaskToolExecutionScope = Object.freeze({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: workerSession.id,
          messageID: assistantMessageID,
          toolCallID: Identifier.ascending("tool"),
          toolPartID: snapshotPartID,
          executionSurface: createToolExecutionSurface({
            toolIDs: ["artifact_snapshot"],
            permission: [],
          }),
          owner: Object.freeze({
            kind: "projected-worker",
            expertSquadID: "base",
            packageRevision,
            agentID: "base-developer",
            projectionHash: "b".repeat(64),
            workerTurnDescriptorID: "descriptor-exact-commit",
            workerTurnDescriptorHash: "c".repeat(64),
          }),
        })
        const runtimeContract = {
          identity: {
            identityKind: "projected-worker",
            sessionID: workerSession.id,
            taskID,
            agentID: "base-developer",
            dispatchAdapterID: "build",
          },
          stageTools: { merge_back: {} },
          projectedTools: {},
        } as unknown as SessionRuntimeContract
        const messages = await Session.messages({ sessionID: workerSession.id })
        const source = resolveArtifactSnapshotReadAuthorityFromFacts({
          scope,
          claimedSourceCommit: sourceCommit,
          contract: runtimeContract,
          messages,
        })
        expect(() =>
          assertMergedPrimaryCommitToolAuthorityFromFacts({
            scope,
            claimedSourceCommit: sourceCommit,
            contract: runtimeContract,
            messages,
          }),
        ).not.toThrow()
        const publication = await publishTaskArtifactProjectFiles({
          scope,
          source,
          files: [{ path: file, mediaType: "text/markdown" }],
        })
        const published = Buffer.from(
          await readTaskArtifactRef({
            projectID: Instance.project.id,
            projectDirectory: project.path,
            taskID,
            ref: publication.artifacts[0]!,
          }),
        ).toString("utf8")

        const currentProjectSource = resolveArtifactSnapshotReadAuthorityFromFacts({
          scope,
          contract: { ...runtimeContract, stageTools: {} } as SessionRuntimeContract,
          messages,
        })
        const currentPublication = await publishTaskArtifactProjectFiles({
          scope,
          source: currentProjectSource,
          files: [{ path: file, mediaType: "text/markdown" }],
        })
        const currentPublished = Buffer.from(
          await readTaskArtifactRef({
            projectID: Instance.project.id,
            projectDirectory: project.path,
            taskID,
            ref: currentPublication.artifacts[0]!,
          }),
        ).toString("utf8")
        const committedPackage = await publishTaskArtifactGitCommitSubtree({
          scope,
          sourceCommit,
          sourceRoot: packageRoot,
        })
        const committedPackageFiles = await Promise.all(
          committedPackage.publication.artifacts.map(async (ref) => ({
            path: ref.path,
            text: Buffer.from(
              await readTaskArtifactRef({
                projectID: Instance.project.id,
                projectDirectory: project.path,
                taskID,
                ref,
              }),
            ).toString("utf8"),
          })),
        )

        expect({
          source,
          sourceCommit,
          currentPrimary,
          published,
          publishedPath: publication.artifacts[0]!.path,
          currentProjectSource,
          currentPublished,
          currentPublishedPath: currentPublication.artifacts[0]!.path,
          committedPackageTree: committedPackage.resourceSet.tree,
          committedPackageFiles,
        }).toEqual({
          source: { kind: "merged_primary_commit", commit: sourceCommit },
          sourceCommit,
          currentPrimary: "# Later primary report\n\nVersion two.\n",
          published: "# Exact merged report\n\nVersion one.\n",
          publishedPath: file,
          currentProjectSource: { kind: "current_task_project" },
          currentPublished: "# Later primary report\n\nVersion two.\n",
          currentPublishedPath: file,
          committedPackageTree: "package",
          committedPackageFiles: [
            { path: "README.md", text: "# Candidate package\n" },
            { path: "expert-squad.jsonc", text: '{"schema_version":1}\n' },
          ],
        })
      },
    })
  })
})
