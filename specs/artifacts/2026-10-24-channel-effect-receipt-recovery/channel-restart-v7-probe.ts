import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"
const [stage = "outer", kind = "question"] = process.argv.slice(2)
assert(["question", "permission", "activity"].includes(kind), "explicit supported domain effect")
const outputRoot =
  process.env.CHANNEL_AUDIT_OUTPUT_DIRECTORY ??
  path.resolve(`.tmp-product-iteration/durable-effect-receipt-audit/channel/v7`)
const destination = path.join(outputRoot, `restart-${kind}.json`)
if (stage === "outer") {
  const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
  const runtime = await bootstrapIsolatedTestRuntime("test")
  // This is a backend delivery probe. No model or provider credential is used.
  for (const key of Object.keys(process.env))
    if (/(?:API_KEY|BEARER_TOKEN|ACCESS_TOKEN|AWS_PROFILE|AWS_REGION)/.test(key)) delete process.env[key]
  for (const childStage of ["create", "reopen"]) {
    const child = Bun.spawn(
      [
        process.execPath,
        `--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`,
        import.meta.path,
        childStage,
        kind,
      ],
      { env: { ...process.env }, stdout: "pipe", stderr: "pipe" },
    )
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    fs.writeFileSync(path.join(outputRoot, `restart-${kind}-${childStage}.log`), stdout + stderr)
    if (code !== (childStage === "create" ? 23 : 0))
      throw new Error(`${childStage} exited ${code}; see exact child log`)
  }
  const evidence = JSON.parse(fs.readFileSync(destination, "utf8"))
  assert.equal(evidence.hardExit, 23)
  assert.equal(evidence.executions, 1)
  assert.equal(evidence.before.accepted.length, 1)
  assert.equal(typeof evidence.before.accepted[0].project_generation, "string")
  assert.equal(evidence.after.outcomes.length, 1)
  assert.equal(evidence.replay.kind, "interaction")
  assert.equal(evidence.replay.task_id, evidence.taskID)
  assert.equal(evidence.replay.message, kind === "permission" ? "Permission granted (once)." : "Answer recorded.")
  for (const field of ["authority", "accepted", "interactions", "interactionOutcomes", "permission", "questionSources"])
    assert(isDeepStrictEqual(evidence.before[field], evidence.after[field]), `original ${field} is preserved exactly`)
  assert(
    isDeepStrictEqual(JSON.parse(evidence.after.outcomes[0].result), evidence.replay),
    "recovered response equals the true terminal receipt",
  )
  const receipt = evidence.after.outcomes[0]
  const leases = evidence.after.effectLeases.filter((lease: any) => lease.target_id === receipt.request_id)
  assert.equal(leases.length, 2)
  assert.equal(leases[1].expires_at, receipt.time_created)
  assert(leases[1].time_activated < leases[0].expires_at, "OS death proof recovers before the old deadline")
  evidence.recoveryVerified = true
  evidence.runtime = runtime
  fs.writeFileSync(destination, JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence))
  process.exit(0)
}
const { Database } = await import("@/storage/db")
const { Instance } = await import("@/project/instance")
const { ChannelIngress } = await import("@/channel/ingress")
const { EngineService } = await import("@/task-api")
const { Bus } = await import("@/bus")
function snapshot() {
  return {
    authority: Database.Identity(),
    accepted: Database.allFinalized("SELECT * FROM channel_ingress_accepted"),
    outcomes: Database.allFinalized("SELECT * FROM channel_ingress_outcome"),
    interactions: Database.allFinalized("SELECT * FROM engine_interaction_request"),
    interactionOutcomes: Database.allFinalized("SELECT * FROM engine_interaction_outcome"),
    permission: Database.allFinalized("SELECT * FROM permission_ledger"),
    questionSources: Database.allFinalized("SELECT * FROM bus_publication_outbox WHERE event_type LIKE 'question.%'"),
    effectLeases: Database.allFinalized("SELECT * FROM engine_control_activation_lease WHERE target='effect'"),
  }
}
if (stage === "create") {
  const { memoryProject } = await import("../../../packages/opencorvus/test/fixture/memory")
  const { Session } = await import("@/session")
  const { Identifier } = await import("@/id/id")
  const { persistEstablishedTask } = await import("../../../packages/opencorvus/test/fixture/engine-task")
  const { prepareTaskProcessBinding } = await import("@/engine/task-execution-capsule-binding")
  const { Config } = await import("@/config/config")
  const { PermissionAuthority } = await import("@/permission/authority")
  const { Question } = await import("@/question")
  const { findInteractionByExternal } = await import("@/engine/store")
  const { withTimeout } = await import("@/util/await-with-timeout")
  const project = await memoryProject(`channel-restart-${kind}`)
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      EngineService.init()
      const revision = {
        scope: "built_in" as const,
        projectID: null,
        namespace: "builtin",
        id: "channel-restart-probe",
        version: "2026.10.24.1",
        packageDigest: "a".repeat(64),
      }
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Channel restart actual interaction",
      })
      const taskID = Identifier.ascending("task"),
        now = Date.now()
      const channel = { platform: "slack" as const, channel: "actual-channel", thread: "actual-thread" }
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: "Channel restart",
        request: "Probe request",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: {},
        channelBinding: channel,
        projectID: Instance.project.id,
        packageRevision: revision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          packageRevisionSHA256: revision.packageDigest,
          timeCreated: now,
        }),
      })
      let requestID: string,
        executions = 0
      if (kind === "question") {
        requestID = Identifier.ascending("question")
        const answer = Question.ask({
          sessionID: root.id,
          requestID,
          questions: [{ header: "Restart", question: "Choose the answer", options: [] }],
        })
        void answer
          .then(() => {
            executions++
          })
          .catch(() => undefined)
        const deadline = Date.now() + 10_000
        while (findInteractionByExternal(requestID)?.status !== "pending") {
          if (Date.now() > deadline) throw new Error("Asked projection timeout")
          await Bun.sleep(10)
        }
      } else if (kind === "activity") {
        const { insertEngineInteractionRequest } = await import("@/engine/interaction-request")
        requestID = "direct-activity-reconciliation-original"
        // Prepare only the direct durable gate, using its production primitive.
        // The real acknowledgement below is not a Provider activity execution.
        Database.immediateTransaction((db) =>
          insertEngineInteractionRequest(db, {
            taskID,
            sessionID: root.id,
            externalID: requestID,
            requestType: "question",
            title: "Direct activity acknowledgement",
            body: "Acknowledge the unknown result",
            payload: {
              activity_reconciliation: {
                ingress_id: "fixture-ingress",
                request_id: "fixture-request",
                assistant_message_id: "fixture-message",
              },
            },
            eventSource: "task-control.activity-reconciliation",
            eventSummary: "Prepared direct acknowledgement gate",
          }),
        )
      } else {
        const asked = Promise.withResolvers<any>()
        Bus.subscribe(PermissionAuthority.Event.Asked, (event) => {
          asked.resolve(event.properties)
        })
        const execution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: Instance.project.id,
            sessionID: root.id,
            messageID: Identifier.ascending("message"),
            toolCallID: Identifier.ascending("part"),
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.invalid/local-effect-probe" },
          },
          async () => {
            executions++
            return "local effect completed"
          },
        )
        void execution.catch(() => undefined)
        requestID = (await withTimeout(asked.promise, 10_000, "Asked callback")).id
      }
      const input = {
        ...channel,
        text: kind === "question" ? "original channel answer" : kind === "activity" ? "acknowledge_unknown" : "allow",
        request_id: `ingress-${kind}-original`,
        allow_create: false,
      }
      using hook = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
        if (kind === "activity")
          executions = Database.allFinalized<any>("SELECT * FROM engine_interaction_outcome").length
        const evidence = {
          kind,
          directory: project.path,
          taskID,
          requestID,
          input,
          executions,
          databasePath: Database.Path(),
          before: snapshot(),
          hardExit: 23,
        }
        fs.writeFileSync(destination, JSON.stringify(evidence, null, 2))
        process.exit(23)
      })
      await ChannelIngress.message(input)
      throw new Error("Actual after-effect cutpoint was not reached")
    },
  })
} else if (stage === "reopen") {
  const evidence = JSON.parse(fs.readFileSync(destination, "utf8"))
  await Instance.provide({
    directory: evidence.directory,
    fn: async () => {
      EngineService.init()
      Bus.resumeDurablePublications()
      try {
        evidence.replay = await ChannelIngress.message(evidence.input)
      } catch (error) {
        evidence.replayError = { name: error?.constructor?.name, message: String(error) }
      }
      evidence.after = snapshot()
    },
  })
  await Instance.disposeAll()
  Database.close()
  fs.writeFileSync(destination, JSON.stringify(evidence, null, 2))
  process.exit(0)
}
