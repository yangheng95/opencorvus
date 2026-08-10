import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { Session } from "../src/session"
import { resolveArtifactSnapshotReadAuthorityFromFacts } from "../src/build/merge-back-publication-authority"
import type { SessionRuntimeContract } from "../src/session/runtime-contract"
import {
  publishTaskArtifactProjectFiles,
  readTaskArtifactRef,
} from "../src/task-artifact/store"
import { createToolExecutionSurface } from "../src/tool/execution-surface"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"
import { hostGit } from "../src/util/git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

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
  test("publishes the exact merge_back commit bytes after the primary worktree advances", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const file = "artifacts/最终 report.md"
        const absolute = path.join(project.path, ...file.split("/"))
        await fs.mkdir(path.dirname(absolute), { recursive: true })
        await fs.writeFile(absolute, "# Exact merged report\n\nVersion one.\n")
        await git(project.path, ["add", "--", file])
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
          metadata: {},
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

        expect({ source, sourceCommit, currentPrimary, published, currentProjectSource, currentPublished }).toEqual({
          source: { kind: "merged_primary_commit", commit: sourceCommit },
          sourceCommit,
          currentPrimary: "# Later primary report\n\nVersion two.\n",
          published: "# Exact merged report\n\nVersion one.\n",
          currentProjectSource: { kind: "current_task_project" },
          currentPublished: "# Later primary report\n\nVersion two.\n",
        })
      },
    })
  })
})
