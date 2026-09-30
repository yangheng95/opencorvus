import { afterEach, expect, test } from "bun:test"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { Config } from "@/config/config"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import {
  projectSelectedDispatchReportQuotes,
  readAgentMessages,
  TaskEvidenceSourceError,
} from "@/tool/read-agent-message"
import type { EvidenceLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { persistEstablishedTask } from "./fixture/engine-task"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("selected report projection preserves exact cross-Session sources, bounded text and deferred identities", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = Config.Info.parse({
        prompt_profile: { active: "base" },
        mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
      })
      const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
        projectDirectory: project.path,
        config,
      })
      const workerCapability = await PromptProfileResolver.resolveWorkerCapability({
        projectDirectory: project.path,
        config,
        packageRevision: scheduler.packageRevision,
        agentID: "base-tester",
      })
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Report projection",
        metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
      })
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: "Report projection",
        request: "Verify original business obligations.",
        productPillar: "work",
        source: "test",
        metadata: { actor: "user" },
        projectID: Instance.project.id,
        packageRevision: scheduler.packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: scheduler.packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      const locators: EvidenceLocator[] = []
      const finals: Extract<EvidenceLocator, { source: "session_message" }>[] = []
      const originalTexts: string[] = []
      for (let index = 0; index < 9; index++) {
        const worker = await Session.create({ kind: "assistant", parentID: root.id, title: `Reviewer ${index}` })
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          role: "user",
          author: "orchestrator",
          time: { created: now + index * 10 + 1 },
          agent: "base-tester",
          model: { providerID: "test", modelID: "test" },
        })
        const final = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          parentID: input.id,
          role: "assistant",
          author: "base-tester",
          agent: "base-tester",
          providerID: "test",
          modelID: "test",
          time: { created: now + index * 10 + 2 },
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const text = `Source ${index}: observed fields and unresolved interpretation. ${"record ".repeat(index === 8 ? 1 : 1200)}`
        originalTexts.push(text)
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: worker.id,
          messageID: final.id,
          type: "text",
          text,
        })
        await Session.updateMessage({
          ...final,
          time: { ...final.time, completed: now + index * 10 + 3 },
          finish: "stop",
        })
        const lineage = recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            taskID,
            orchestratorSessionID: root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: workerCapability.identity.agentID,
            projectedWorkerIdentity: workerCapability.identity,
            workScope: { kind: "task" },
            adapterInput: {},
            workflowNodeID: null,
            workflowBinding: selectedWorkflowBinding({
              projection: { packageRevision: scheduler.packageRevision, virtualWorkflows: scheduler.virtualWorkflows },
              workflowID: null,
            }),
          }),
          childSessionID: worker.id,
          now: now + index * 10 + 4,
        })
        recordDispatchSettlement({
          taskID,
          dispatchID: lineage.dispatchID,
          outcome: DispatchOutcome.terminal({ sessionID: worker.id, finalMessageID: final.id }),
          now: now + index * 10 + 5,
        })
        const locator = { source: "session_message" as const, session_id: worker.id, message_id: final.id }
        finals.push(locator)
        locators.push(locator)
        if (index === 0) locators.push({ source: "session_message", session_id: worker.id, message_id: input.id })
      }
      const result = (await projectSelectedDispatchReportQuotes(taskID, locators))!
      expect(
        result.reports.map((report) => ({
          source: "session_message",
          session_id: report.session_id,
          message_id: report.message_id,
        })),
      ).toEqual(finals.slice(0, 8))
      expect(new Set(result.reports.map((report) => report.session_id)).size).toBe(8)
      expect(result.reports.reduce((total, report) => total + report.text.content.length, 0)).toBe(30000)
      expect(result.reports.map((report) => report.text.content)).toEqual(
        originalTexts.slice(0, 8).map((text) => text.slice(0, 3750)),
      )
      expect(result.reports.map((report) => report.text.next_offset)).toEqual(Array(8).fill(3750))
      expect(result.deferred_sources).toEqual([{ kind: "dispatch_result", message_id: finals[8]!.message_id }])
      const read = JSON.parse(
        await readAgentMessages(taskID, { sources: [result.reports[0]!.source, ...result.deferred_sources] }),
      )
      expect(read.messages.map((message: { text: string[] }) => message.text)).toEqual([
        [originalTexts[0]],
        [originalTexts[8]],
      ])
      const short = (await projectSelectedDispatchReportQuotes(taskID, [finals[8]!]))!
      expect(short.reports[0]!.text).toMatchObject({
        content: originalTexts[8],
        next_offset: null,
        end: originalTexts[8]!.length,
      })
      const wrongSession = { ...finals[0]!, session_id: result.reports[1]!.session_id } as EvidenceLocator
      const error = await projectSelectedDispatchReportQuotes(taskID, [wrongSession]).catch((error) => error)
      expect(error).toBeInstanceOf(TaskEvidenceSourceError)
      expect(error).toMatchObject({ code: "TASK_EVIDENCE_SOURCE_INVALID" })
    },
  })
})
