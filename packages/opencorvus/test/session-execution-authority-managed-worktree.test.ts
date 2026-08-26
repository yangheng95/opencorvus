import path from "node:path"
import fs from "node:fs/promises"
import { afterEach, expect, test } from "bun:test"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Config } from "@/config/config"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { resolveSessionExecutionAuthority } from "@/engine/task-session-lineage"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Session } from "@/session"
import { materializeUserMessage, preparedUserMessageFromPreflight } from "@/session/prompt/parts"
import { Tool } from "@/tool/tool"
import { WriteTool } from "@/tool/write"
import { Worktree } from "@/worktree"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("uses the exact managed-worktree Session directory for pending, durable, and file-effect authority", async () => {
  await using project = await memoryProject()
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.09.1",
    packageDigest: "a".repeat(64),
  }
  let worktreeDirectory = ""
  let projectID = ""
  let taskID = ""
  let workerSessionID = ""

  await Instance.provide({
    directory: project.path,
    fn: async () => {
      projectID = Instance.project.id
      taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Managed authority Task root" })
      const orchestrator = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Managed authority Orchestrator",
      })
      const now = Date.now()
      persistTask({
        taskID,
        rootSession: root,
        now,
        title: "Managed Session authority",
        request: "Execute one real file effect in the Task-owned managed worktree",
        productPillar: "code",
        metadata: {},
        projectID,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID,
          rootDirectory: project.path,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: now,
        }),
      })

      workerSessionID = Identifier.descending("session")
      const worktree = await Worktree.create({
        name: `session-authority-${taskID.slice(-8)}`,
        taskID,
        sessionID: workerSessionID,
      })
      worktreeDirectory = await fs.realpath(worktree.directory)
      const pending = await Session.prepareNext({
        id: workerSessionID,
        kind: "build",
        parentID: orchestrator.id,
        directory: worktreeDirectory,
        title: "Managed authority worker",
      })

      const pendingAuthority = await resolveSessionExecutionAuthority({
        sessionID: pending.id,
        projectID,
        expected: { kind: "task", taskID },
        pendingSession: pending,
      })
      expect(pendingAuthority).toEqual({
        kind: "task",
        sessionID: pending.id,
        projectID,
        taskID,
        directory: worktreeDirectory,
      })

      const prompt = {
        sessionID: pending.id,
        messageID: Identifier.ascending("message"),
        author: "orchestrator",
        agent: "coding",
        model: { providerID: "test", modelID: "managed-authority" },
        parts: [{ type: "text" as const, text: "Create the exact worktree-owned file." }],
      }
      const config = await Config.get()
      const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
      const prepared = preparedUserMessageFromPreflight({
        prompt,
        config,
        session: pending,
        identity: { agentID: "coding", baseRole: "coding", runtime },
        modelPreflight: { model: prompt.model },
      })
      const materialized = await materializeUserMessage(prompt, {
        prepared,
        executionAuthorityResolution: {
          expected: { kind: "task", taskID },
          pendingSession: pending,
        },
      })
      expect(materialized).toMatchObject({
        info: { id: prompt.messageID, sessionID: pending.id, role: "user" },
        parts: [{ type: "text", sessionID: pending.id, messageID: prompt.messageID }],
      })

      Session.persistPreparedNext(pending)
      const durableAuthority = await resolveSessionExecutionAuthority({
        sessionID: pending.id,
        projectID,
        expected: { kind: "task", taskID },
      })
      expect(durableAuthority).toEqual(pendingAuthority)
    },
  })

  await Instance.provide({
    directory: worktreeDirectory,
    fn: async () => {
      expect(Instance.project.id).toBe(projectID)
      const authority = await resolveSessionExecutionAuthority({
        sessionID: workerSessionID,
        projectID,
        expected: { kind: "task", taskID },
      })
      const output = path.join(worktreeDirectory, "managed-authority.txt")
      await WriteTool.init().then((tool) =>
        tool.execute(
          { filePath: output, content: "managed-session-authority\n" },
          {
            sessionID: workerSessionID,
            messageID: "message_managed_authority_effect",
            callID: "call_managed_authority_effect",
            agent: "build",
            abort: new AbortController().signal,
            messages: [],
            executionAuthority: authority,
            executionSurface: Tool.executionSurface(["write"], []),
            metadata() {},
            async ask() {},
          },
        ),
      )
      expect(await fs.readFile(output, "utf8")).toBe("managed-session-authority\n")
    },
  })

  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Worktree.releaseManagedWorktreeSessionOwner({
        projectID,
        primaryWorktreeDir: Instance.project.worktree,
        directory: worktreeDirectory,
        sessionID: workerSessionID,
      })
      await Worktree.remove({ directory: worktreeDirectory })
    },
  })
}, 60_000)
