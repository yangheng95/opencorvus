import { afterAll, describe, expect, test } from "bun:test"
import { DispatchOutcome } from "../src/agent/dispatch-outcome"
import { Config } from "../src/config/config"
import {
  createDispatchLineageOrigin,
  recordDispatchLineage,
  resolveDispatchOccurrenceAuthority,
} from "../src/engine/dispatch-lineage"
import { describeTask } from "../src/engine/describe"
import { recordDispatchSettlement } from "../src/engine/dispatch-settlement"
import { configureTaskLoopRunner, waitForQueueCompletionHooksForTest } from "../src/engine/queue"
import { requireTask } from "../src/engine/store"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { BrowserMCPBuiltin } from "../src/mcp/browser/builtin"
import { Instance } from "../src/project/instance"
import { EngineService } from "../src/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await waitForQueueCompletionHooksForTest()
  await resetMemoryDatabase()
})

describe("dispatch occurrence recovery authority", () => {
  test("derives initial or exact continuation authority from immutable dispatch lineage", async () => {
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
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: scheduler.packageRevision,
          agentID: "base-developer",
        })
        configureTaskLoopRunner(async () => {})
        const taskID = await EngineService.createTask(
          {
            requestID: "dispatch-occurrence-recovery-authority",
            request: "Prove the immutable authority boundary for dispatch recovery",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
            expectedPackageDigest: scheduler.packageRevision.packageDigest,
            queue: true,
          },
          { actor: "user" },
        )
        await waitForQueueCompletionHooksForTest()

        const dispatchID = Identifier.ascending("artifact")
        const beforeCommit = resolveDispatchOccurrenceAuthority({ taskID, dispatchID })
        expect(
          DispatchOutcome.infrastructureFailure({
            operation: "project_runtime_projection",
            message: "The physical Session was created before dispatch authority committed",
            recoveryAuthority: beforeCommit,
          }),
        ).toMatchObject({
          kind: "infrastructure_failure",
          recovery_authority: { occurrence_status: "occurrence_not_committed" },
        })

        const task = requireTask(taskID)
        const lineage = recordDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: task.session_id!,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: worker.identity.agentID,
            projectedWorkerIdentity: worker.identity,
            workScope: { kind: "task" },
            workflowBinding: selectedWorkflowBinding({
              projection: {
                packageRevision: scheduler.packageRevision,
                virtualWorkflows: scheduler.virtualWorkflows,
              },
              workflowID: null,
            }),
            workflowNodeID: null,
            adapterInput: {},
          }),
          childSessionID: Identifier.ascending("session"),
        })
        const afterCommit = resolveDispatchOccurrenceAuthority({ taskID, dispatchID })
        expect(
          DispatchOutcome.infrastructureFailure({
            operation: "persist_worker_result",
            message: "The committed worker occurrence requires another Turn",
            recoveryAuthority: afterCommit,
          }),
        ).toMatchObject({
          kind: "infrastructure_failure",
          recovery_authority: {
            occurrence_status: "occurrence_committed",
            dispatch_lineage_id: lineage.artifactID,
            dispatch_id: dispatchID,
          },
        })

        const partialOutcome = DispatchOutcome.partial({
          sessionID: lineage.payload.child_session_id,
          finalMessageID: Identifier.ascending("message"),
          failedOperation: "persist_domain_artifact",
        })
        const settlement = recordDispatchSettlement({ taskID, dispatchID, outcome: partialOutcome })
        expect(recordDispatchSettlement({ taskID, dispatchID, outcome: partialOutcome })).toEqual(settlement)

        const snapshot = await describeTask(taskID)
        expect(snapshot.workflow_execution).toMatchObject({
          nodes: [
            {
              node_id: "__direct_task__",
              occurrence_status: "occurrence_committed",
              terminal_success: false,
              dispatches: [
                {
                  artifact_id: lineage.artifactID,
                  dispatch_id: dispatchID,
                  terminal_success: false,
                  settlement: { artifact_id: settlement.artifactID, outcome_kind: "partial" },
                },
              ],
            },
          ],
        })
      },
    })
  }, 20_000)
})
