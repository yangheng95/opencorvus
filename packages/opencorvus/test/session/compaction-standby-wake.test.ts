import { afterEach, expect, spyOn, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionControl } from "@/session/control"
import { SessionLoop } from "@/session/loop"
import { Identifier } from "@/id/id"
import { timelineMessageOrderKey } from "@/timeline/order"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { ensureMissionSession } from "@/mission/session"
import { acquireControlLease, releaseControlLease, currentControlLease } from "@/engine/control-lease"
import { Config } from "@/config/config"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { MCP } from "@/mcp"
import { computerRuntimeScopeIdentity } from "@/mcp/computer/runtime-scope"
import { createRuntimeToolOwner } from "@/session/runtime-tool-owner"
import { testRuntimeToolFactories } from "../fixture/runtime-tool-owner"
import { createExactOrchestratorTool } from "@/orchestrator/tools"
import { sendSchedulerMessage } from "@/protocol/scheduler-message"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { SessionCompaction } from "@/session/compaction"
import { persistEstablishedTask } from "../fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("the real standby prune boundary preserves a staged wake armed during maintenance", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = await Config.get()
      const { schedulerCapability, skillProjection } = await PromptProfileResolver.resolveSchedulerTurnProjection({
        projectDirectory: project.path,
        config,
      })
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({ kind: "root", directory: project.path, title: "Staged maintenance Task" })
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now: Date.now(),
        title: "Staged maintenance Task",
        request: "Observe actual staged wake",
        productPillar: "code",
        metadata: { actor: "user" },
        projectID: Instance.project.id,
        packageRevision: schedulerCapability.packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: schedulerCapability.packageRevision.packageDigest,
          timeCreated: Date.now(),
        }),
      })
      const session = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Staged maintenance wake",
      })
      const raw = Object.fromEntries(
        PromptProfileResolver.schedulerRuntimeToolIDs(schedulerCapability).map((toolID) => [
          toolID,
          createExactOrchestratorTool({
            toolID,
            taskID,
            agentSessionID: session.id,
            sendSchedulerMessage,
            dispatchAgents: [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents],
          }),
        ]),
      )
      const mcp = MCP.createScopedConnectionOwner(
        computerRuntimeScopeIdentity({ ownerKind: "orchestrator", taskID, sessionID: session.id }),
      )
      const contract = SessionRuntimeContractStore.set(
        session.id,
        {
          identity: {
            identityKind: "projected-scheduler",
            sessionID: session.id,
            ...schedulerCapability.identity,
            expertSquadID: schedulerCapability.expertSquadID,
            packageRevision: schedulerCapability.packageRevision,
            taskID,
            contractKind: "orchestrator-wake",
            installedAt: Date.now(),
          },
          skillProjection,
          runOnce: true,
          projectDirectory: project.path,
          harnessGrants: PromptProfileResolver.schedulerHarnessGrants({
            taskID,
            capability: schedulerCapability,
            projectedToolIDs: Object.keys(raw),
          }),
          includeMcpTools: false,
          system: [],
          systemMode: "complete",
          resources: {
            mcp,
            tools: createRuntimeToolOwner({
              leaves: testRuntimeToolFactories(raw as any, "projected", { source: "scheduler-projection" }),
            }),
          },
        },
        { armWake: false },
      )
      const observed = SessionRuntimeContractStore.hasPendingWake(session.id) ? contract : undefined
      const phases: string[] = []
      const original = SessionCompaction.prune
      const pruning = spyOn(SessionCompaction, "prune").mockImplementation(async (input) => {
        phases.push("prune")
        SessionRuntimeContractStore.armPendingWake(session.id, contract)
        phases.push("armed")
        await original(input)
      })
      const controller = new AbortController()
      try {
        const standby = await SessionLoop.TestHooks.beginStandby({
          sessionID: session.id,
          abort: controller.signal,
          afterOrderKey: "",
          observedRuntimeContract: observed,
        })
        await Promise.race([
          standby.waitForWake,
          Bun.sleep(1500).then(() => {
            throw Error("The newly armed wake must resume the actual standby")
          }),
        ])
        phases.push("resumed")
        expect({ phases, pending: SessionRuntimeContractStore.hasPendingWake(session.id) }).toEqual({
          phases: ["prune", "armed", "resumed"],
          pending: true,
        })
      } finally {
        pruning.mockRestore()
        controller.abort()
        await SessionRuntimeContractStore.dispose(session.id)
      }
    },
  })
})

for (const kind of ["assistant", "mission", "orchestrator"] as const) {
  for (const status of ["consumed", "failed", "released"] as const) {
    test(`${kind} maintenance wait resumes from the exact ${status} control before its lease deadline`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session =
            kind === "mission"
              ? await ensureMissionSession({
                  missionID: `mission-control-${status}`,
                  defaultCwd: project.path,
                  productPillar: "work",
                  heldExpertSquadIDs: ["base"],
                })
              : await Session.create({ kind, title: "Control settlement wake" })
          const source = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "chat",
            model: { providerID: "test", modelID: "checkpoint" },
            time: { created: Date.now() },
          })
          const control = SessionControl.create({
            sessionID: session.id,
            kind: "compaction_request",
            payload: { source_user_message_id: source.id },
          })
          const acquisition = acquireControlLease({
            target: "session_control",
            targetID: control.id,
            ownerOccurrenceID: `foreign-${kind}-${status}`,
            now: Date.now(),
            leaseMilliseconds: 5000,
          })
          if (!acquisition.acquired) throw Error("The real foreign maintenance lease must be acquired")
          const lease = {
            leaseID: acquisition.lease.id,
            ownerOccurrenceID: acquisition.lease.owner_occurrence_id,
            now: Date.now(),
          }
          const controller = new AbortController()
          const observations = ["pending"]
          const waiting = SessionLoop.TestHooks.waitForUserMessage(
            session.id,
            controller.signal,
            timelineMessageOrderKey({ info: source }),
            {
              ignoredActionableControlID: control.id,
              wakeAt: acquisition.lease.expires_at,
            },
          ).then(() => {
            observations.push("resumed")
            return SessionControl.get(control.id)
          })
          try {
            await Bun.sleep(20)
            if (status === "consumed")
              SessionControl.consume({ id: control.id, sessionID: session.id, lease: { ...lease, now: Date.now() } })
            else if (status === "failed")
              SessionControl.fail({
                id: control.id,
                sessionID: session.id,
                error: "Exact foreign owner failure",
                lease: { ...lease, now: Date.now() },
              })
            else releaseControlLease({ target: "session_control", targetID: control.id, ...lease, now: Date.now() })
            observations.push(status)
            const result = await Promise.race([
              waiting,
              Bun.sleep(1500).then(() => {
                throw Error("The terminal control must resume maintenance on its durable poll")
              }),
            ])
            expect(result).toMatchObject({
              id: control.id,
              sessionID: session.id,
              status: status === "released" ? "pending" : status,
            })
            expect(currentControlLease("session_control", control.id)).toMatchObject({
              id: lease.leaseID,
              expires_at: expect.any(Number),
            })
            expect(currentControlLease("session_control", control.id)!.expires_at).toBeLessThanOrEqual(Date.now())
            expect(observations).toEqual(["pending", status, "resumed"])
          } finally {
            controller.abort()
            await waiting
          }
        },
      })
    })
  }
}
