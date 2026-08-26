import { afterAll, describe, expect, test } from "bun:test"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import {
  authorizeEvolutionPackageMutation,
  evolutionMutationConfirmationText,
  executeEvolutionPackageMutation,
  prepareEvolutionPackageMutation,
} from "../src/expert-squad/evolution-mutation"
import {
  nextExpertSquadVersion,
  parseFeedbackRevisionTarget,
  reviseInstalledExpertSquadFromFeedback,
} from "../src/expert-squad/feedback-revision"
import { readEvolutionHistory } from "../src/expert-squad/evolution-history"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { Global } from "../src/global"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { configureTaskIngressRunner } from "../src/engine/task-root-ingress-delivery"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const SQUAD_ID = "feedback-revision-squad"
const FEEDBACK = "我希望调研报告尽可能多的图和表，不要干干的全是文字"
const REVISED_PROMPT =
  "# Feedback revision worker\n\nOpen with a summary table, and give every quantitative claim a chart or a table.\n"

function emptyProjectionResources() {
  return {
    inherit_base_tools: false,
    built_in_tool_ids: [] as string[],
    default_skill_refs: [] as string[],
    package_skill_refs: [] as string[],
    default_tool_refs: [] as string[],
    package_tool_refs: [] as string[],
    default_mcp_server_refs: [] as string[],
    package_mcp_server_refs: [] as string[],
    default_mcp_tool_refs: [] as string[],
    package_mcp_tool_refs: [] as string[],
    default_mcp_prompt_refs: [] as string[],
    package_mcp_prompt_refs: [] as string[],
    default_mcp_resource_refs: [] as string[],
    package_mcp_resource_refs: [] as string[],
  }
}

function packageDefinition(version: string): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 1,
      namespace: "evolution-test",
      id: SQUAD_ID,
      label: "Feedback revision squad",
      description: "Exercises revising an installed squad from operator feedback.",
      version,
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Feedback revision contract package.",
        selection_guidance: "Select only for the feedback revision contract.",
        instructions: "selector.md",
      },
      capability_projection: {
        scheduler: { ...emptyProjectionResources(), base_role: "orchestrator" },
        agents: {
          "feedback-revision-worker": {
            ...emptyProjectionResources(),
            label: "Feedback revision worker",
            description: "Owns the feedback revision contract fixture.",
            base_role: "build",
            prompt: "agents/feedback-revision-worker/system.md",
          },
        },
        virtual_workflows: {},
      },
    },
    files: {
      "README.md": "# Feedback revision squad\n\nbaseline\n",
      "selector.md": "# Feedback revision selector\n",
      "agents/feedback-revision-worker/system.md": "# Feedback revision worker\n\nbaseline\n",
    },
  }
}

async function createTask(revision: { namespace: string; id: string; version: string; packageDigest: string }) {
  const session = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "feedback revision",
    metadata: { configOverlay: { model: "firmware/gpt-5", prompt_profile: { active: revision.id } } },
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  persistTask({
    taskID,
    rootSession: session,
    now,
    title: "feedback revision",
    request: "feedback revision",
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision: { scope: "project", projectID: Instance.project.id, ...revision },
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: revision.packageDigest,
      timeCreated: now,
    }),
  })
  return { session, taskID }
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("revising an installed expert squad from operator feedback", () => {
  test("derives the next daily revision so the author never restates the version", () => {
    const noon = Date.UTC(2026, 7, 18, 12)
    expect(nextExpertSquadVersion({ current: "2026.08.13.1", now: noon })).toBe("2026.08.18.1")
    // A second revision on the same day continues that day's sequence.
    expect(nextExpertSquadVersion({ current: "2026.08.18.1", now: noon })).toBe("2026.08.18.2")
    expect(nextExpertSquadVersion({ current: "2026.08.18.9", now: noon })).toBe("2026.08.18.10")
  })

  test("names the squad the way every other surface does", () => {
    // A live orchestrator reached for the qualified form first, because that is
    // what package refs and the catalog use; refusing it cost a whole turn.
    expect(parseFeedbackRevisionTarget("builtin/deep-research")).toEqual({
      namespace: "builtin",
      id: "deep-research",
    })
    expect(parseFeedbackRevisionTarget("deep-research")).toEqual({ id: "deep-research" })
    expect(() => parseFeedbackRevisionTarget("a/b/c")).toThrow(/"<namespace>/)
  })

  test("writes, installs and undoes one revision authored from what the operator said", async () => {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-feedback-revision-test-")
    await using project = await memoryProject()
    const baselineSource = path.join(sourceRoot, "baseline")
    await writeExpertSquadPackage({ directory: baselineSource, definition: packageDefinition("2026.08.13.1") })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: baselineSource,
          installationScope: "project",
        })
        const baselineDigest = installed.after.packageDigest
        const task = await createTask({
          namespace: "evolution-test",
          id: SQUAD_ID,
          version: "2026.08.13.1",
          packageDigest: baselineDigest,
        })

        const revision = await reviseInstalledExpertSquadFromFeedback({
          taskID: task.taskID,
          sessionID: task.session.id,
          request: {
            target_squad_id: SQUAD_ID,
            feedback: FEEDBACK,
            conflicting_instruction: "rewritten",
            hypothesis: "Naming tables and charts in the worker prompt makes reports carry them.",
            files: [{ path: "agents/feedback-revision-worker/system.md", content: REVISED_PROMPT }],
          },
        })
        expect({
          before: revision.expectedCurrentPackageDigest,
          changed: revision.changedPaths,
          id: revision.id,
        }).toEqual({
          before: baselineDigest,
          // The manifest always changes, because the Host bumps the version.
          changed: ["agents/feedback-revision-worker/system.md", "expert-squad.jsonc"],
          id: SQUAD_ID,
        })

        const staged = await readEvolutionHistory({
          namespace: "evolution-test",
          id: SQUAD_ID,
          installationScope: "project",
          limit: 20,
        })
        const stagedRecord = staged.feedback_revisions[0]!
        expect({
          installed: stagedRecord.installed,
          // Nothing is installed yet, so the only thing the operator can do
          // from the panel is accept it.
          acceptable: stagedRecord.acceptance_intent !== null,
          restorations: stagedRecord.restoration_intents.length,
        }).toEqual({ installed: false, acceptable: true, restorations: 0 })

        const prepared = prepareEvolutionPackageMutation({
          taskID: task.taskID,
          intent: {
            operation: "feedback_revision",
            candidateRevisionLocator: revision.locator,
            expectedCurrentPackageDigest: revision.expectedCurrentPackageDigest,
          },
        })
        const confirmationText = evolutionMutationConfirmationText({
          projectID: Instance.project.id,
          target: prepared.target,
          beforeDigest: prepared.beforeDigest,
          afterDigest: prepared.afterDigest,
          evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
          operation: "feedback_revision",
          feedback: FEEDBACK,
        })
        // What the operator confirms is their own sentence, not a score.
        expect(confirmationText).toContain(FEEDBACK)

        const authorization = await authorizeEvolutionPackageMutation({
          taskID: task.taskID,
          sessionID: task.session.id,
          confirmationText,
          intent: {
            operation: "feedback_revision",
            candidateRevisionLocator: revision.locator,
            expectedCurrentPackageDigest: revision.expectedCurrentPackageDigest,
          },
        })
        const mutation = await executeEvolutionPackageMutation({
          operation: "feedback_revision",
          authorization: authorization.authorization,
          candidateRevisionLocator: revision.locator,
          expectedCurrentPackageDigest: revision.expectedCurrentPackageDigest,
        })
        const installedRoot = ExpertSquadRegistry.installedPackageRoot({
          projectDirectory: project.path,
          installationScope: "project",
          namespace: "evolution-test",
          id: SQUAD_ID,
        })
        expect({
          operation: mutation.receipt.operation,
          managerOperation: mutation.receipt.manager_receipt.operation,
          before: mutation.receipt.before_digest,
          after: mutation.receipt.after_digest,
          promptOnDisk: await readFile(
            path.join(installedRoot, "agents", "feedback-revision-worker", "system.md"),
            "utf8",
          ),
        }).toEqual({
          operation: "feedback_revision",
          managerOperation: "replaced",
          before: baselineDigest,
          after: revision.candidatePackageDigest,
          promptOnDisk: REVISED_PROMPT,
        })

        const history = await readEvolutionHistory({
          namespace: "evolution-test",
          id: SQUAD_ID,
          installationScope: "project",
          limit: 20,
        })
        const record = history.feedback_revisions[0]!
        expect({
          count: history.feedback_revisions.length,
          campaignRecords: history.records.length,
          integrityIssues: history.integrity_issues.length,
          feedback: record.feedback,
          installed: record.installed,
          // Accepting an already-installed revision would compare-and-swap
          // against a digest that has moved, so the offer is gone.
          acceptable: record.acceptance_intent !== null,
          restorations: record.restoration_intents.length,
        }).toEqual({
          count: 1,
          // A feedback revision belongs to no Campaign, and inventing one for it
          // would claim a measurement that never happened.
          campaignRecords: 0,
          integrityIssues: 0,
          feedback: FEEDBACK,
          installed: true,
          acceptable: false,
          restorations: 1,
        })

        const restorationIntent = record.restoration_intents[0]!
        const restorationAuthorization = await authorizeEvolutionPackageMutation({
          taskID: task.taskID,
          sessionID: task.session.id,
          confirmationText: restorationIntent.confirmation_text,
          intent: restorationIntent.request,
        })
        const restoration = await executeEvolutionPackageMutation({
          ...restorationIntent.request,
          authorization: restorationAuthorization.authorization,
        })
        expect({
          operation: restoration.receipt.operation,
          after: restoration.receipt.after_digest,
          promptOnDisk: await readFile(
            path.join(installedRoot, "agents", "feedback-revision-worker", "system.md"),
            "utf8",
          ),
        }).toEqual({
          operation: "restoration",
          after: baselineDigest,
          promptOnDisk: "# Feedback revision worker\n\nbaseline\n",
        })
      },
    })
  })

  /**
   * An operator who revised twice wants the first revision back, not two undos.
   *
   * The receipt is what proves a revision was once installed here; pinning a
   * switch to the single hop that receipt recorded turned a version history
   * into an undo button, and left every revision but the immediately previous
   * one unreachable from the panel.
   */
  test("reaches a revision two hops back without undoing the hop in between", async () => {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-revision-switch-test-")
    await using project = await memoryProject()
    const baselineSource = path.join(sourceRoot, "baseline")
    await writeExpertSquadPackage({ directory: baselineSource, definition: packageDefinition("2026.08.13.1") })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: baselineSource,
          installationScope: "project",
        })
        const baselineDigest = installed.after.packageDigest
        const task = await createTask({
          namespace: "evolution-test",
          id: SQUAD_ID,
          version: "2026.08.13.1",
          packageDigest: baselineDigest,
        })

        async function reviseAndInstall(prompt: string, hypothesis: string) {
          const revision = await reviseInstalledExpertSquadFromFeedback({
            taskID: task.taskID,
            sessionID: task.session.id,
            request: {
              target_squad_id: SQUAD_ID,
              feedback: FEEDBACK,
              conflicting_instruction: "rewritten",
              hypothesis,
              files: [{ path: "agents/feedback-revision-worker/system.md", content: prompt }],
            },
          })
          const intent = {
            operation: "feedback_revision" as const,
            candidateRevisionLocator: revision.locator,
            expectedCurrentPackageDigest: revision.expectedCurrentPackageDigest,
          }
          const prepared = prepareEvolutionPackageMutation({ taskID: task.taskID, intent })
          const authorization = await authorizeEvolutionPackageMutation({
            taskID: task.taskID,
            sessionID: task.session.id,
            confirmationText: evolutionMutationConfirmationText({
              projectID: Instance.project.id,
              target: prepared.target,
              beforeDigest: prepared.beforeDigest,
              afterDigest: prepared.afterDigest,
              evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
              operation: "feedback_revision",
              feedback: FEEDBACK,
            }),
            intent,
          })
          await executeEvolutionPackageMutation({ ...intent, authorization: authorization.authorization })
          return revision.candidatePackageDigest
        }

        const secondDigest = await reviseAndInstall(
          "# Feedback revision worker\n\nsecond\n",
          "Naming tables in the worker prompt makes reports carry them.",
        )
        const thirdDigest = await reviseAndInstall(
          "# Feedback revision worker\n\nthird\n",
          "Naming charts as well makes the tables carry numbers.",
        )

        const history = await readEvolutionHistory({
          namespace: "evolution-test",
          id: SQUAD_ID,
          installationScope: "project",
          limit: 20,
        })
        const choices = new Map(history.revisions.map((choice) => [choice.package_digest, choice]))
        expect({
          revisions: history.revisions.length,
          installed: history.revisions.filter((choice) => choice.installed).map((choice) => choice.package_digest),
          // Every revision this target has had is reachable, not just the last hop.
          switchable: history.revisions
            .filter((choice) => choice.switch_intent !== null)
            .map((choice) => choice.package_digest)
            .toSorted(),
          // The installed one is where we are, so it carries no way in.
          installedIntent: choices.get(thirdDigest)!.switch_intent,
          versions: history.revisions.map((choice) => choice.version).toSorted(),
        }).toEqual({
          revisions: 3,
          installed: [thirdDigest],
          switchable: [baselineDigest, secondDigest].toSorted(),
          installedIntent: null,
          versions: ["2026.08.13.1", "2026.08.18.1", "2026.08.18.2"].toSorted(),
        })

        const jump = choices.get(baselineDigest)!
        const root = jump.authorization_root!
        const jumpAuthorization = await authorizeEvolutionPackageMutation({
          taskID: root.task_id,
          sessionID: root.root_session_id,
          confirmationText: jump.switch_intent!.confirmation_text,
          intent: jump.switch_intent!.request,
        })
        const jumped = await executeEvolutionPackageMutation({
          ...jump.switch_intent!.request,
          authorization: jumpAuthorization.authorization,
        })
        const installedRoot = ExpertSquadRegistry.installedPackageRoot({
          projectDirectory: project.path,
          installationScope: "project",
          namespace: "evolution-test",
          id: SQUAD_ID,
        })
        const afterJump = await readEvolutionHistory({
          namespace: "evolution-test",
          id: SQUAD_ID,
          installationScope: "project",
          limit: 20,
        })
        expect({
          // One move, from the third revision straight to the first.
          before: jumped.receipt.before_digest,
          after: jumped.receipt.after_digest,
          // Every switch receipt stays reachable from the candidate that began
          // the chain; a switch that cites another switch is not an orphan.
          integrityIssues: afterJump.integrity_issues.length,
          switchableFromBaseline: afterJump.revisions
            .filter((choice) => choice.switch_intent !== null)
            .map((choice) => choice.package_digest)
            .toSorted(),
          promptOnDisk: await readFile(
            path.join(installedRoot, "agents", "feedback-revision-worker", "system.md"),
            "utf8",
          ),
        }).toEqual({
          before: thirdDigest,
          after: baselineDigest,
          integrityIssues: 0,
          switchableFromBaseline: [secondDigest, thirdDigest].toSorted(),
          promptOnDisk: "# Feedback revision worker\n\nbaseline\n",
        })

        // Going forward again cites the switch that came back, not the install:
        // this is the hop that used to fall outside the walk.
        const forward = new Map(afterJump.revisions.map((choice) => [choice.package_digest, choice])).get(thirdDigest)!
        const forwardRoot = forward.authorization_root!
        const forwardAuthorization = await authorizeEvolutionPackageMutation({
          taskID: forwardRoot.task_id,
          sessionID: forwardRoot.root_session_id,
          confirmationText: forward.switch_intent!.confirmation_text,
          intent: forward.switch_intent!.request,
        })
        const returned = await executeEvolutionPackageMutation({
          ...forward.switch_intent!.request,
          authorization: forwardAuthorization.authorization,
        })
        const settled = await readEvolutionHistory({
          namespace: "evolution-test",
          id: SQUAD_ID,
          installationScope: "project",
          limit: 20,
        })
        expect({
          citedOperation: (forward.switch_intent!.request as { priorReceiptLocator: { artifact_id: string } })
            .priorReceiptLocator.artifact_id,
          after: returned.receipt.after_digest,
          integrityIssues: settled.integrity_issues.length,
          promptOnDisk: await readFile(
            path.join(installedRoot, "agents", "feedback-revision-worker", "system.md"),
            "utf8",
          ),
        }).toEqual({
          citedOperation: jumped.locator.artifact_id,
          after: thirdDigest,
          integrityIssues: 0,
          promptOnDisk: "# Feedback revision worker\n\nthird\n",
        })
      },
    })
  })

  /**
   * A preference is not always about wording.
   *
   * "Stop asking me to confirm every step" is a Tool grant, "run the check
   * before you report" is a topology edge, and neither lives in a prompt. This
   * path could once change only prose while the Campaign path could change the
   * manifest, so those preferences had nowhere to land. What still may not
   * happen is a revision handing itself reach the Squad never had.
   */
  test("rewrites the manifest but refuses capability the squad never held", async () => {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-manifest-revision-test-")
    await using project = await memoryProject()
    const baselineSource = path.join(sourceRoot, "baseline")
    await writeExpertSquadPackage({ directory: baselineSource, definition: packageDefinition("2026.08.13.1") })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: baselineSource,
          installationScope: "project",
        })
        const task = await createTask({
          namespace: "evolution-test",
          id: SQUAD_ID,
          version: "2026.08.13.1",
          packageDigest: installed.after.packageDigest,
        })
        const manifestPath = path.join(baselineSource, "expert-squad.jsonc")
        const baselineManifest = await readFile(manifestPath, "utf8")

        // The operator wants the worker described differently and the version
        // is not theirs to write, so they leave a stale one in place.
        const relabelled = baselineManifest
          .replace('"label": "Feedback revision worker"', '"label": "Chart-first revision worker"')
          .replace('"version": "2026.08.13.1"', '"version": "1999.01.01.1"')
        const revision = await reviseInstalledExpertSquadFromFeedback({
          taskID: task.taskID,
          sessionID: task.session.id,
          request: {
            target_squad_id: SQUAD_ID,
            feedback: FEEDBACK,
            conflicting_instruction: "rewritten",
            hypothesis: "Naming the worker for what the operator wants keeps the intent visible in the manifest.",
            files: [{ path: "expert-squad.jsonc", content: relabelled }],
          },
        })
        const revised = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.candidatePackageDigest)
        const revisedManifest = await readFile(path.join(revised.root, "expert-squad.jsonc"), "utf8")
        expect({
          changed: revision.changedPaths,
          // The Host restamps its own version over whatever the author wrote.
          version: revision.version,
          staleVersionSurvived: revisedManifest.includes("1999.01.01.1"),
          relabelled: revisedManifest.includes("Chart-first revision worker"),
        }).toEqual({
          changed: ["expert-squad.jsonc"],
          version: revision.version,
          staleVersionSurvived: false,
          relabelled: true,
        })

        // Reaching for a Tool no revision before it declared is the one move
        // that stays refused, whatever the operator asked for.
        const selfWidened = baselineManifest.replace('"built_in_tool_ids": []', '"built_in_tool_ids": ["bash"]')
        expect(selfWidened).not.toBe(baselineManifest)
        await expect(
          reviseInstalledExpertSquadFromFeedback({
            taskID: task.taskID,
            sessionID: task.session.id,
            request: {
              target_squad_id: SQUAD_ID,
              feedback: FEEDBACK,
              conflicting_instruction: "rewritten",
            hypothesis: "Granting a shell would let the worker draw charts itself.",
              files: [{ path: "expert-squad.jsonc", content: selfWidened }],
            },
          }),
        ).rejects.toThrow(/built_in_tool_ids/)
      },
    })
  })

  /**
   * The shape three live revisions in a row actually took.
   *
   * Each appended a hedged sentence to a prompt that already prescribed the
   * opposite shape, changed nothing else, installed cleanly, and behaved
   * exactly like its parent. The Host cannot read the new wording and judge it,
   * but it can hold the author to what they said they did.
   */
  test("refuses a rewrite claim that only appended, and takes the same edit once the claim is honest", async () => {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-append-claim-test-")
    await using project = await memoryProject()
    const baselineSource = path.join(sourceRoot, "baseline")
    await writeExpertSquadPackage({ directory: baselineSource, definition: packageDefinition("2026.08.13.1") })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: baselineSource,
          installationScope: "project",
        })
        const task = await createTask({
          namespace: "evolution-test",
          id: SQUAD_ID,
          version: "2026.08.13.1",
          packageDigest: installed.after.packageDigest,
        })
        const promptPath = "agents/feedback-revision-worker/system.md"
        const baselinePrompt = "# Feedback revision worker\n\nbaseline\n"

        // The observed failure: the parent survives verbatim and a hedged
        // sentence arrives at the end, while the author reports a rewrite.
        const appended = `${baselinePrompt}\nUse charts and tables where the task permits.\n`
        await expect(
          reviseInstalledExpertSquadFromFeedback({
            taskID: task.taskID,
            sessionID: task.session.id,
            request: {
              target_squad_id: SQUAD_ID,
              feedback: FEEDBACK,
              conflicting_instruction: "rewritten",
              hypothesis: "Adding a presentation preference makes reports carry charts.",
              files: [{ path: promptPath, content: appended }],
            },
          }),
        ).rejects.toThrow(/only adds at the end/)

        // The same bytes are accepted the moment the author stops claiming a
        // rewrite: the Host checks the claim, it does not read the prose.
        const additive = await reviseInstalledExpertSquadFromFeedback({
          taskID: task.taskID,
          sessionID: task.session.id,
          request: {
            target_squad_id: SQUAD_ID,
            feedback: FEEDBACK,
            conflicting_instruction: "none",
            hypothesis: "Nothing in this Squad prescribed a shape, so the rule is new rather than competing.",
            files: [{ path: promptPath, content: appended }],
          },
        })

        // And a revision that truly edits what was there passes while claiming it.
        const rewritten = await reviseInstalledExpertSquadFromFeedback({
          taskID: task.taskID,
          sessionID: task.session.id,
          request: {
            target_squad_id: SQUAD_ID,
            feedback: FEEDBACK,
            conflicting_instruction: "rewritten",
            hypothesis: "The line that told the worker to answer in prose is the one the operator is objecting to.",
            files: [{ path: promptPath, content: "# Feedback revision worker\n\nAnswer with tables.\n" }],
          },
        })
        expect({
          additiveChanged: additive.changedPaths,
          rewrittenChanged: rewritten.changedPaths,
        }).toEqual({
          additiveChanged: [promptPath, "expert-squad.jsonc"],
          rewrittenChanged: [promptPath, "expert-squad.jsonc"],
        })
      },
    })
  })

  test("refuses a candidate that names a file the operator may not write", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const badPath of ["expert-squad.jsonc", "../escape.md", "/absolute.md", "agents/../../escape.md"]) {
          await expect(
            reviseInstalledExpertSquadFromFeedback({
              taskID: "tsk_unused",
              sessionID: "ses_unused",
              request: {
                target_squad_id: SQUAD_ID,
                feedback: FEEDBACK,
                conflicting_instruction: "rewritten",
            hypothesis: "unused",
                files: [{ path: badPath, content: "x" }],
              },
            }),
          ).rejects.toThrow()
        }
      },
    })
  })
})
