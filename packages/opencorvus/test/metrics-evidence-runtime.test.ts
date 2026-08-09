import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { writeFile } from "node:fs/promises"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { EngineMetricResultTable } from "../src/metrics/metrics.sql"
import { persistQueuedTask } from "../src/engine/pipeline"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { createTaskArtifactStoreExecution } from "../src/task-artifact/store"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"
import { readTaskArtifact } from "../src/artifact-catalog"
import { exactEngineArtifactLocator } from "../src/artifact-catalog"
import { recordEngineArtifact } from "../src/engine/artifact"
import {
  executeMetrics,
  MetricJudgeInactivityError,
  MetricJudgeInputError,
  MetricJudgeParseError,
  type JudgeRequest,
} from "../src/metrics/executor"
import { computeIterationSnapshot } from "../src/metrics/score"
import { readResultsForIteration, registerBaselineSpec } from "../src/metrics/store"
import { MetricExecutionEvidence } from "../src/metrics/types"
import { canonicalMetricJSON } from "../src/metrics/canonical-json"
import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"
import {
  createMetricJudgeRunnerWithDependencies,
  metricJudgeMessages,
  parseMetricJudgeFinalScore,
  type MetricJudgeRuntimeDependencies,
} from "../src/tool/metric-judge-runner"
import { VISUAL_FEEDBACK_VERIFICATION_ARTIFACT_LABEL } from "../src/acceptance/visual-feedback-verification"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

let project: Awaited<ReturnType<typeof memoryProject>> | undefined

afterAll(async () => {
  if (project) await project[Symbol.asyncDispose]()
  await resetMemoryDatabase()
})

describe("Metric scorer exact evidence runtime", () => {
  const judgeRequest = (overrides: Partial<JudgeRequest> = {}): JudgeRequest => ({
    spec: {
      id: "metric-production-judge",
      task_id: "task-production-judge",
      scope: "global",
      goal_id: null,
      name: "production-judge",
      description: "Exercise the exact production streaming judge contract",
      unit: "ordinal",
      direction: "higher_better",
      target: 1,
      floor: 0,
      weight: 1,
      observation_class: "quality",
      evaluator_kind: "judge",
      evaluator_config: {
        scorer_revision: "d".repeat(64),
        provider_id: "exact-provider",
        model_id: "exact-model",
        inactivity_timeout_ms: 50,
        max_evidence_bytes: 1_024,
        criteria: "Evaluate the exact selected evidence",
        rubric: [{ score: 1, label: "complete", anchor: "Evidence is complete", passes: true }],
      },
      source: "baseline",
      frozen_at: 1,
      created_by: "architect",
    },
    criteria: "Evaluate the exact selected evidence",
    rubric: [{ score: 1, label: "complete", anchor: "Evidence is complete", passes: true }],
    selectedEvidence: [
      {
        locator: {
          source: "engine_artifact",
          task_id: "task-production-judge",
          artifact_id: "artifact-production-judge",
        },
        mediaType: "application/json",
        bytes: new TextEncoder().encode('{"accepted":true}'),
        sha256: "e".repeat(64),
      },
    ],
    ...overrides,
  })

  test("runs the exact provider, model, messages, and zero-retry production judge dependencies", async () => {
    const calls: Array<{ name: string; input: unknown }> = []
    const config = { marker: "effective-config" } as never
    const model = { marker: "exact-model" } as never
    const language = { marker: "wrapped-language" } as never
    let streamInput: Record<string, unknown> | undefined
    const dependencies: MetricJudgeRuntimeDependencies = {
      effectiveConfig: (async (input) => {
        calls.push({ name: "effectiveConfig", input })
        return config
      }) as MetricJudgeRuntimeDependencies["effectiveConfig"],
      getModel: (async (providerID, modelID, options) => {
        calls.push({ name: "getModel", input: { providerID, modelID, options } })
        return model
      }) as MetricJudgeRuntimeDependencies["getModel"],
      getLanguage: (async (inputModel, options) => {
        calls.push({ name: "getLanguage", input: { model: inputModel, options } })
        return language
      }) as MetricJudgeRuntimeDependencies["getLanguage"],
      wrapModel: ((inputLanguage, inputModel, options) => {
        calls.push({ name: "wrapModel", input: { language: inputLanguage, model: inputModel, options } })
        return language
      }) as MetricJudgeRuntimeDependencies["wrapModel"],
      streamText: ((input: Record<string, unknown>) => {
        streamInput = input
        return {
          textStream: (async function* () {
            yield ""
            yield "The immutable evidence satisfies the criterion.\nFINAL_SCORE=1"
          })(),
        }
      }) as MetricJudgeRuntimeDependencies["streamText"],
    }
    const runner = createMetricJudgeRunnerWithDependencies(
      { taskID: "task-production-judge", sessionID: "session-production-judge" } as TaskToolExecutionScope,
      dependencies,
    )
    const events = []
    for await (const event of runner(judgeRequest())) events.push(event)

    expect(calls).toEqual([
      {
        name: "effectiveConfig",
        input: { taskID: "task-production-judge", sessionID: "session-production-judge" },
      },
      {
        name: "getModel",
        input: { providerID: "exact-provider", modelID: "exact-model", options: { config } },
      },
      { name: "getLanguage", input: { model, options: { config } } },
      { name: "wrapModel", input: { language, model, options: {} } },
    ])
    expect(streamInput).toMatchObject({
      model: language,
      timeoutMs: false,
      retries: 0,
      messages: [{ role: "system" }, { role: "user" }],
    })
    expect(events).toEqual([
      { type: "rationale_delta", text: "The immutable evidence satisfies the criterion.\nFINAL_SCORE=1" },
      { type: "result", score: 1 },
    ])
  })

  test("treats an empty-only production judge stream as real-output inactivity", async () => {
    const language = {} as never
    const dependencies = {
      effectiveConfig: (async () => ({}) as never) as MetricJudgeRuntimeDependencies["effectiveConfig"],
      getModel: (async () => ({}) as never) as MetricJudgeRuntimeDependencies["getModel"],
      getLanguage: (async () => language) as MetricJudgeRuntimeDependencies["getLanguage"],
      wrapModel: (() => language) as MetricJudgeRuntimeDependencies["wrapModel"],
      streamText: (() => ({
        textStream: (async function* () {
          while (true) {
            yield ""
            await Bun.sleep(1)
          }
        })(),
      })) as MetricJudgeRuntimeDependencies["streamText"],
    }
    const runner = createMetricJudgeRunnerWithDependencies(
      { taskID: "task-production-judge", sessionID: "session-production-judge" } as TaskToolExecutionScope,
      dependencies,
    )
    let outcome: unknown
    try {
      for await (const event of runner(
        judgeRequest({
          spec: {
            ...judgeRequest().spec,
            evaluator_config: { ...judgeRequest().spec.evaluator_config, inactivity_timeout_ms: 25 },
          },
        }),
      )) {
        outcome = event
      }
    } catch (error) {
      outcome = error
    }
    expect(outcome).toBeInstanceOf(MetricJudgeInactivityError)
  })

  test("parses one evidence-grounded streaming judge score from the frozen rubric", () => {
    expect(parseMetricJudgeFinalScore("The selected evidence satisfies every criterion.\nFINAL_SCORE=1", [0, 1])).toBe(
      1,
    )
    expect(() => parseMetricJudgeFinalScore("FINAL_SCORE=1", [0, 1])).toThrow(MetricJudgeParseError)
  })

  test("maps unreadable judge media, encoding, and JSON to typed input errors", () => {
    const evidence = judgeRequest().selectedEvidence[0]!
    for (const selectedEvidence of [
      [{ ...evidence, mediaType: "image/png" }],
      [{ ...evidence, mediaType: "text/plain", bytes: new Uint8Array([0xff]) }],
      [{ ...evidence, mediaType: "application/json", bytes: new TextEncoder().encode("not-json") }],
    ]) {
      expect(() => metricJudgeMessages(judgeRequest({ selectedEvidence }))).toThrow(MetricJudgeInputError)
    }
  })

  test("publishes measured and unavailable attempts with inactivity and complete selected evidence", async () => {
    project ??= await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Metric evidence runtime" })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        const metricPackageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "evolution-lab",
          version: "2026.08.06.1",
          packageDigest: "a".repeat(64),
        }
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now: started,
          title: "Metric evidence runtime",
          request: "Measure exact scorer evidence",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          queue: true,
          packageRevision: metricPackageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: metricPackageRevision.packageDigest,
            timeCreated: started,
          }),
        })
        Database.use((db) =>
          db.update(EngineTaskTable).set({ time_started: started }).where(eq(EngineTaskTable.id, taskID)).run(),
        )
        const execution = createTaskArtifactStoreExecution({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: "message-metric-evaluator",
          toolCallID: "call-metric-evaluator",
          toolPartID: "part-metric-evaluator",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "evolution-lab",
            packageRevision: {
              scope: "built_in",
              projectID: null,
              namespace: "builtin",
              id: "evolution-lab",
              version: "2026.08.06.1",
              packageDigest: "a".repeat(64),
            },
            agentID: "evaluator",
            projectionHash: "b".repeat(64),
            workerTurnDescriptorID: "descriptor-metric-evaluator",
            workerTurnDescriptorHash: "c".repeat(64),
          },
        } as unknown as TaskToolExecutionScope)

        const sourceText = `selected evidence:${"证据".repeat(300)}`
        const sourceStage = await execution.stage({ trees: ["judge-input"] })
        await writeFile(path.join(sourceStage.treeDirectories["judge-input"]!, "source.txt"), sourceText)
        const sourcePublication = await execution.publish(sourceStage, {
          snapshot_kind: "catalog",
          files: [{ tree: "judge-input", path: "source.txt", media_type: "text/plain" }],
        })
        const sourceLocator = { source: "task_artifact_resource" as const, ref: sourcePublication.artifacts[0]! }

        const digest = "d".repeat(64)
        const executable = Bun.which("node")!
        const measuredScript = path.join(project.path, "metric-measured.js")
        const parseUnavailableScript = path.join(project.path, "metric-parse-unavailable.js")
        const inactivityScript = path.join(project.path, "metric-inactivity.js")
        await writeFile(
          measuredScript,
          "process.stdout.write('x'.repeat(700));process.stderr.write('y'.repeat(650));let n=0;const t=setInterval(()=>{process.stderr.write('.');if(++n===4){process.stdout.write('7');clearInterval(t)}},40)",
        )
        await writeFile(parseUnavailableScript, "process.stdout.write('not-a-number')")
        await writeFile(inactivityScript, "process.stdout.write('ready');setInterval(()=>{},1000)")
        const common = {
          task_id: taskID,
          scope: "global" as const,
          goal_id: null,
          description: "Frozen scorer observation",
          unit: "ratio",
          direction: "higher_better" as const,
          target: 1,
          floor: 0,
          weight: 1,
          observation_class: "quality" as const,
        }
        const inactivitySpec = registerBaselineSpec({
          ...common,
          name: "inactivity-unavailable",
          evaluator_kind: "shell",
          evaluator_config: {
            scorer_revision: digest,
            workspace_digest: digest,
            executable,
            args: [inactivityScript],
            parse: "exit_code",
            inactivity_timeout_ms: 1_000,
          },
        })
        const measuredSpec = registerBaselineSpec({
          ...common,
          name: "periodic-shell",
          evaluator_kind: "shell",
          evaluator_config: {
            scorer_revision: digest,
            workspace_digest: digest,
            executable,
            args: [measuredScript],
            parse: "stdout_number",
            inactivity_timeout_ms: 3_000,
          },
        })
        const parseUnavailableSpec = registerBaselineSpec({
          ...common,
          name: "parse-unavailable",
          evaluator_kind: "shell",
          evaluator_config: {
            scorer_revision: digest,
            workspace_digest: digest,
            executable,
            args: [parseUnavailableScript],
            parse: "stdout_number",
            inactivity_timeout_ms: 3_000,
          },
        })
        const judgeSpec = registerBaselineSpec({
          ...common,
          name: "streaming-judge",
          evaluator_kind: "judge",
          evaluator_config: {
            scorer_revision: digest,
            provider_id: "test-provider",
            model_id: "test-model",
            inactivity_timeout_ms: 5_000,
            max_evidence_bytes: 65_536,
            criteria: "Score the complete selected evidence",
            rubric: [{ score: 1, label: "complete", anchor: "All evidence is present", passes: true }],
          },
        })
        const invalidJudgeSpec = registerBaselineSpec({
          ...common,
          name: "invalid-streaming-judge",
          evaluator_kind: "judge",
          evaluator_config: {
            scorer_revision: digest,
            provider_id: "test-provider",
            model_id: "test-model",
            inactivity_timeout_ms: 5_000,
            max_evidence_bytes: 65_536,
            criteria: "Reject a non-finite provider response",
            rubric: [{ score: 1, label: "complete", anchor: "All evidence is present", passes: true }],
          },
        })
        const judgeFailureSpec = (name: string) =>
          registerBaselineSpec({
            ...common,
            name,
            evaluator_kind: "judge",
            evaluator_config: {
              scorer_revision: digest,
              provider_id: "test-provider",
              model_id: "test-model",
              inactivity_timeout_ms: 5_000,
              max_evidence_bytes: 65_536,
              criteria: `Record the ${name} typed outcome`,
              rubric: [{ score: 1, label: "complete", anchor: "All evidence is present", passes: true }],
            },
          })
        const inputUnavailableJudgeSpec = judgeFailureSpec("input-unavailable-streaming-judge")
        const inactiveJudgeSpec = judgeFailureSpec("inactive-streaming-judge")
        const providerUnavailableJudgeSpec = judgeFailureSpec("provider-unavailable-streaming-judge")
        const judgeMessages = metricJudgeMessages({
          spec: judgeSpec,
          criteria: "Score the complete selected evidence",
          rubric: [{ score: 1, label: "complete", anchor: "All evidence is present", passes: true }],
          selectedEvidence: [
            {
              locator: sourceLocator,
              mediaType: "text/plain",
              bytes: new TextEncoder().encode(sourceText),
              sha256: sourcePublication.artifacts[0]!.sha256,
            },
          ],
        })
        expect(judgeMessages.map((message) => message.role)).toEqual(["system", "user"])
        expect(JSON.parse(judgeMessages[1]!.content)).toEqual({
          criteria: "Score the complete selected evidence",
          rubric: [{ score: 1, label: "complete", anchor: "All evidence is present", passes: true }],
          selected_evidence: [
            {
              locator: sourceLocator,
              media_type: "text/plain",
              bytes: new TextEncoder().encode(sourceText).byteLength,
              sha256: sourcePublication.artifacts[0]!.sha256,
              content: sourceText,
            },
          ],
        })
        expect(() =>
          metricJudgeMessages({
            spec: { ...judgeSpec, evaluator_config: { ...judgeSpec.evaluator_config, max_evidence_bytes: 1 } },
            criteria: "Score the complete selected evidence",
            rubric: [{ score: 1, label: "complete", anchor: "All evidence is present", passes: true }],
            selectedEvidence: [
              {
                locator: sourceLocator,
                mediaType: "text/plain",
                bytes: new TextEncoder().encode(sourceText),
                sha256: sourcePublication.artifacts[0]!.sha256,
              },
            ],
          }),
        ).toThrow(MetricJudgeInputError)
        const zeroQuerySpec = registerBaselineSpec({
          ...common,
          name: "measured-zero-query",
          evaluator_kind: "query",
          evaluator_config: {
            scorer_revision: digest,
            query: "constant_value",
            value: 0,
          },
        })
        const metricResultQuerySpec = registerBaselineSpec({
          ...common,
          name: "measured-metric-result-query",
          evaluator_kind: "query",
          evaluator_config: {
            scorer_revision: digest,
            query: "metric_result_value",
            metric_spec_id: measuredSpec.id,
            iteration_offset: 0,
            result_column: "raw_value",
          },
        })
        const emptyQuerySpec = registerBaselineSpec({
          ...common,
          name: "unavailable-empty-query",
          evaluator_kind: "query",
          evaluator_config: {
            scorer_revision: digest,
            query: "metric_result_value",
            metric_spec_id: "missing-metric-result",
            iteration_offset: 0,
            result_column: "raw_value",
          },
        })
        const aggregatorSpec = registerBaselineSpec({
          ...common,
          name: "measured-mean-aggregator",
          evaluator_kind: "aggregator",
          evaluator_config: {
            scorer_revision: digest,
            of: [measuredSpec.id, zeroQuerySpec.id],
            op: "mean",
            iteration_offset: 0,
          },
        })

        const dummyVisualReviewID = recordEngineArtifact({
          taskID,
          kind: "expert_output",
          label: "dummy-visual-review-target",
          payload: { seed: true },
        })
        const dummyVisualReviewLocator = exactEngineArtifactLocator({ taskID, artifactID: dummyVisualReviewID })
        const verificationPayload = {
          id: "verification-metric-runtime",
          taskID,
          visualQaSessionID: session.id,
          finalMessageID: "missing-final-message",
          visualReviewLocator: dummyVisualReviewLocator,
          projectRoot: project.path,
          status: "failed" as const,
          summary: "Contract-shaped failed verification",
          requiredReferenceRegions: [],
          referenceComparisonEvidence: [],
          productionBlockerIDs: [],
          contractIssues: ["expected contract issue"],
        }
        const wrongIdentityID = recordEngineArtifact({
          taskID,
          kind: "expert_output",
          label: "same-shaped-visual-payload",
          payload: verificationPayload,
        })
        const wrongIdentityLocator = exactEngineArtifactLocator({ taskID, artifactID: wrongIdentityID })
        const verificationArtifactID = recordEngineArtifact({
          taskID,
          kind: "visual_feedback_verification",
          label: VISUAL_FEEDBACK_VERIFICATION_ARTIFACT_LABEL,
          payload: verificationPayload,
        })
        const verificationLocator = exactEngineArtifactLocator({ taskID, artifactID: verificationArtifactID })
        const prebuiltSpec = registerBaselineSpec({
          ...common,
          name: "exact-prebuilt-identity",
          evaluator_kind: "prebuilt",
          evaluator_config: {
            name: "visual-feedback-verification",
            scorer_revision: digest,
          },
        })

        let judgeSawExactBytes = false
        const outcome = await executeMetrics(
          {
            task_id: taskID,
            iteration: 0,
            selected_evidence_locators: [sourceLocator],
            visual_feedback_verification_artifact_locators: [verificationLocator],
          },
          {
            workDir: project.path,
            taskArtifacts: execution,
            evidenceReader: {
              read: (read) =>
                readTaskArtifact({
                  authority: { projectID: Instance.project.id, projectDirectory: project.path, taskID },
                  read,
                }),
            },
            judge: async function* (request) {
              if (request.spec.id === inputUnavailableJudgeSpec.id)
                throw new MetricJudgeInputError("Selected judge evidence is not readable")
              if (request.spec.id === inactiveJudgeSpec.id)
                throw new MetricJudgeInactivityError("Streaming judge produced no real output")
              if (request.spec.id === providerUnavailableJudgeSpec.id)
                throw new Error("Configured judge provider is unavailable")
              judgeSawExactBytes =
                new TextDecoder("utf-8", { fatal: true }).decode(request.selectedEvidence[0]!.bytes) === sourceText
              yield { type: "rationale_delta", text: "完整证据" }
              yield { type: "rationale_delta", text: "已核验" }
              yield { type: "result", score: request.spec.id === invalidJudgeSpec.id ? Number.NaN : 1 }
            },
          },
        )

        const bySpec = new Map(outcome.results.map((result) => [result.metric_spec_id, result]))
        const measuredAttempt = MetricExecutionEvidence.parse(
          JSON.parse(new TextDecoder().decode(await execution.read(bySpec.get(measuredSpec.id)!.evidence_ref))),
        )
        expect(measuredAttempt).toMatchObject({ status: "measured", raw_value: 7 })
        expect(bySpec.get(measuredSpec.id)).toMatchObject({ raw_value: 7, evidence_fresh: true })
        expect(bySpec.get(parseUnavailableSpec.id)).toMatchObject({
          raw_value: null,
          normalized_value: null,
          met_target: null,
          met_floor: null,
          evidence_fresh: false,
        })
        expect(bySpec.get(inactivitySpec.id)).toMatchObject({ evidence_fresh: false })
        expect(bySpec.get(judgeSpec.id)).toMatchObject({ raw_value: 1, evidence_fresh: true })
        expect(bySpec.get(invalidJudgeSpec.id)).toMatchObject({ raw_value: null, evidence_fresh: false })
        expect(bySpec.get(zeroQuerySpec.id)).toMatchObject({ raw_value: 0, evidence_fresh: true })
        expect(bySpec.get(metricResultQuerySpec.id)).toMatchObject({ raw_value: 7, evidence_fresh: true })
        expect(bySpec.get(emptyQuerySpec.id)).toMatchObject({ raw_value: null, evidence_fresh: false })
        expect(bySpec.get(aggregatorSpec.id)).toMatchObject({ raw_value: 0.5, evidence_fresh: true })
        expect(bySpec.get(prebuiltSpec.id)).toMatchObject({ raw_value: 0, evidence_fresh: true })
        expect(judgeSawExactBytes).toBe(true)
        expect(outcome.unavailable.map((item) => item.reason_code).sort()).toEqual([
          "inactivity_timeout",
          "inactivity_timeout",
          "input_unavailable",
          "input_unavailable",
          "parse_failed",
          "parse_failed",
          "provider_unavailable",
        ])

        const measuredResult = bySpec.get(measuredSpec.id)!
        const measuredEvidence = measuredAttempt
        expect(measuredEvidence).toMatchObject({
          status: "measured",
          raw_value: 7,
          selected_evidence: [{ locator: sourceLocator }],
          execution: {
            stdout: { bytes: 701 },
            stderr: { bytes: 654 },
          },
        })
        const measuredResources = await execution.resources({
          snapshot: measuredResult.evidence_ref.snapshot,
          tree: measuredResult.evidence_ref.tree,
        })
        const stdoutRef = measuredResources.find((resource) => resource.path.endsWith("/stdout.bin"))!
        const stderrRef = measuredResources.find((resource) => resource.path.endsWith("/stderr.bin"))!
        expect(new TextDecoder().decode(await execution.read(stdoutRef))).toBe(`${"x".repeat(700)}7`)
        expect(new TextDecoder().decode(await execution.read(stderrRef))).toBe(`${"y".repeat(650)}....`)

        const unavailableEvidence = await Promise.all(
          outcome.unavailable.map(async (item) =>
            MetricExecutionEvidence.parse(
              JSON.parse(new TextDecoder().decode(await execution.read(item.evidence_ref))),
            ),
          ),
        )
        expect(unavailableEvidence.map((item) => item.status)).toEqual([
          "unavailable",
          "unavailable",
          "unavailable",
          "unavailable",
          "unavailable",
          "unavailable",
          "unavailable",
        ])
        expect(readResultsForIteration(taskID, 0)).toEqual(outcome.results)
        const persistedMeasured = Database.use((db) =>
          db
            .select({ evidence_ref: EngineMetricResultTable.evidence_ref })
            .from(EngineMetricResultTable)
            .where(eq(EngineMetricResultTable.id, measuredResult.id))
            .get(),
        )!
        expect(persistedMeasured.evidence_ref).toBe(canonicalMetricJSON(measuredResult.evidence_ref))

        const snapshot = computeIterationSnapshot({
          task_id: taskID,
          iteration: 0,
          specs: [
            measuredSpec,
            parseUnavailableSpec,
            inactivitySpec,
            judgeSpec,
            invalidJudgeSpec,
            zeroQuerySpec,
            emptyQuerySpec,
          ],
          currentResults: outcome.results,
          previousResults: [],
          previousAggregateScore: null,
        })
        expect(snapshot).toMatchObject({ aggregate_score: null, unmeasured_target_count: 4 })

        const wrongIdentityOutcome = await executeMetrics(
          {
            task_id: taskID,
            iteration: 1,
            selected_evidence_locators: [sourceLocator],
            visual_feedback_verification_artifact_locators: [wrongIdentityLocator],
          },
          {
            workDir: project.path,
            taskArtifacts: execution,
            evidenceReader: {
              read: (read) =>
                readTaskArtifact({
                  authority: { projectID: Instance.project.id, projectDirectory: project.path, taskID },
                  read,
                }),
            },
            judge: async function* () {
              yield { type: "rationale_delta", text: "完整证据已核验" }
              yield { type: "result", score: 1 }
            },
          },
        )
        expect(wrongIdentityOutcome.unavailable.find((item) => item.spec_id === prebuiltSpec.id)?.reason_code).toBe(
          "input_unavailable",
        )

        const corruptSourceLocator = {
          source: "task_artifact_resource" as const,
          ref: { ...sourcePublication.artifacts[0]!, sha256: "e".repeat(64) },
        }
        const corruptSelectionOutcome = await executeMetrics(
          {
            task_id: taskID,
            iteration: 2,
            selected_evidence_locators: [corruptSourceLocator],
            visual_feedback_verification_artifact_locators: [verificationLocator],
          },
          {
            workDir: project.path,
            taskArtifacts: execution,
            evidenceReader: {
              read: (read) =>
                readTaskArtifact({
                  authority: { projectID: Instance.project.id, projectDirectory: project.path, taskID },
                  read,
                }),
            },
            judge: async function* () {
              yield { type: "rationale_delta", text: "不应读取损坏证据" }
              yield { type: "result", score: 1 }
            },
          },
        )
        expect(corruptSelectionOutcome.unavailable.map((item) => item.reason_code)).toEqual(
          corruptSelectionOutcome.results.map(() => "selected_evidence_unavailable"),
        )
        const callbackFailure = await runHostCommandWithInactivity({
          executable,
          args: [inactivityScript],
          cwd: project.path,
          inactivityTimeoutMs: 1_000,
          onStdout: () => {
            throw new Error("observer failed")
          },
        })
        expect(callbackFailure.failure).toEqual({ kind: "output", message: "stdout callback: observer failed" })
        await execution.close()
      },
    })
  }, 30_000)
})
