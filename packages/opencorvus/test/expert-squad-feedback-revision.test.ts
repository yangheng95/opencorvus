import { afterAll, describe, expect, spyOn, test } from "bun:test"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import path from "node:path"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import {
  authorizeEvolutionPackageMutation,
  executeEvolutionPackageMutation,
} from "../src/expert-squad/evolution-mutation"
import {
  evolutionMutationConfirmationText,
  prepareEvolutionPackageMutation,
} from "../src/expert-squad/evolution-mutation-intent"
import {
  nextExpertSquadVersion,
  parseFeedbackRevisionTarget,
  reviseInstalledExpertSquadFromFeedback,
  FeedbackRevisionIdentityConflictError,
  FeedbackRevisionEditError,
} from "../src/expert-squad/feedback-revision"
import { readEvolutionHistory } from "../src/expert-squad/evolution-history"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { Global } from "../src/global"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database, DatabaseUnavailableError } from "../src/storage/db"
import { configureTaskIngressRunner } from "../src/engine/task-root-ingress-delivery"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { publishTaskArtifactProjectFiles } from "../src/task-artifact/store"
import { artifactSnapshotTransport, ArtifactReadTool } from "../src/tool/artifact-catalog"
import { artifactCatalogAuthority, readTaskArtifact } from "../src/artifact-catalog"
import { ArtifactReferenceResolutionError } from "../src/agent/artifact-read-facts"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { createToolExecutionSurface } from "../src/tool/execution-surface"
import type { Tool } from "../src/tool/tool"

const SQUAD_ID = "feedback-revision-squad"
const FEEDBACK = "我希望调研报告尽可能多的图和表，不要干干的全是文字"
const REVISED_PROMPT =
  "# Feedback revision worker\n\nOpen with a summary table, and give every quantitative claim a chart or a table.\n"
const BASELINE_PROMPT = "# Feedback revision worker\n\nbaseline\n"
const PROMPT_PATH = "agents/feedback-revision-worker/system.md"

function exactEdit(path: string, old_text: string, new_text: string) {
  return { path, old_text, new_text, reason: "Change the owning instruction while preserving surrounding working behavior." }
}

function emptyProjectionResources() {
  return { capability_refs: [] as string[] }
}

function packageDefinition(version: string): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 2,
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
      capability_sets: {},
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
  test("startup reports the explicit reset contract for a prior-format feedback candidate", async () => {
    await using project = await memoryProject()
    const sourceDirectory = path.join(project.path, "feedback-source")
    await writeExpertSquadPackage({ directory: sourceDirectory, definition: packageDefinition("2026.08.13.1") })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory,
          installationScope: "project",
        })
        const task = await createTask({
          namespace: "evolution-test", id: SQUAD_ID, version: "2026.08.13.1", packageDigest: installed.after.packageDigest,
        })
        const prefix = `feedback-revision\0${task.taskID}\0`
        const deterministic = Identifier.deterministic
        const legacyIssuer = spyOn(Identifier, "deterministic").mockImplementation((kind, material) =>
          kind === "artifact" && material.startsWith(prefix)
            ? `art_feedback_revision_${createHash("sha256").update(material.slice(prefix.length)).digest("hex")}`
            : deterministic(kind, material),
        )
        let artifactID: string
        try {
          const revision = await reviseInstalledExpertSquadFromFeedback({
            taskID: task.taskID,
            sessionID: task.session.id,
            request: {
              target_squad_id: SQUAD_ID, feedback: FEEDBACK, source_read_refs: [],
              hypothesis: "Use tables and charts to show the requested evidence.",
              edits: [exactEdit(PROMPT_PATH, BASELINE_PROMPT, REVISED_PROMPT)],
            },
          })
          artifactID = revision.locator.artifact_id
        } finally {
          legacyIssuer.mockRestore()
        }
        await Database.awaitEffectIdle(30_000)
        Database.close()
        let observed: unknown
        try {
          Database.Client()
        } catch (error) {
          observed = error
        }
        try {
          expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
            code: "DATA_RESET_REQUIRED",
            operation: "Database.Client.dataIntegrity.compactArtifactIdentity",
            message: expect.stringContaining(artifactID),
          })
        } finally {
          await Database.resetFiles(Database.Path())
          Database.Client()
        }
      },
    })
  }, 60_000)

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

        const revisionInput: Parameters<typeof reviseInstalledExpertSquadFromFeedback>[0] = {
          taskID: task.taskID,
          sessionID: task.session.id,
          request: {
            target_squad_id: SQUAD_ID,
            feedback: FEEDBACK,
            source_read_refs: [],
            hypothesis: "Naming tables and charts in the worker prompt makes reports carry them.",
            edits: [exactEdit(PROMPT_PATH, BASELINE_PROMPT, REVISED_PROMPT)],
          },
        }
        const revision = await reviseInstalledExpertSquadFromFeedback(revisionInput)
        expect(revision.locator.artifact_id.length).toBe(Identifier.MAX_LENGTH)
        expect(revision.candidatePackageDigest).toMatch(/^[a-f0-9]{64}$/)
        const replay = await reviseInstalledExpertSquadFromFeedback(revisionInput)
        expect(replay.locator).toEqual(revision.locator)
        const deterministic = Identifier.deterministic
        const collision = spyOn(Identifier, "deterministic").mockImplementation((kind, material) =>
          kind === "artifact" && material.startsWith("feedback-revision\0")
            ? revision.locator.artifact_id
            : deterministic(kind, material),
        )
        try {
          let observed: unknown
          try {
            await reviseInstalledExpertSquadFromFeedback({
              ...revisionInput,
              request: { ...revisionInput.request, hypothesis: "A distinct evidence interpretation of the same edits." },
            })
          } catch (error) {
            observed = error
          }
          expect(FeedbackRevisionIdentityConflictError.isInstance(observed) ? observed.data : undefined)
            .toEqual({ artifactID: revision.locator.artifact_id })
        } finally {
          collision.mockRestore()
        }
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
          const installedRoot = ExpertSquadRegistry.installedPackageRoot({
            projectDirectory: project.path,
            installationScope: "project",
            namespace: "evolution-test",
            id: SQUAD_ID,
          })
          const oldPrompt = await readFile(path.join(installedRoot, PROMPT_PATH), "utf8")
          const revision = await reviseInstalledExpertSquadFromFeedback({
            taskID: task.taskID,
            sessionID: task.session.id,
            request: {
              target_squad_id: SQUAD_ID,
              feedback: FEEDBACK,
              source_read_refs: [],
              hypothesis,
              edits: [exactEdit(PROMPT_PATH, oldPrompt, prompt)],
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
          return { digest: revision.candidatePackageDigest, version: revision.version }
        }

        const second = await reviseAndInstall(
          "# Feedback revision worker\n\nsecond\n",
          "Naming tables in the worker prompt makes reports carry them.",
        )
        const third = await reviseAndInstall(
          "# Feedback revision worker\n\nthird\n",
          "Naming charts as well makes the tables carry numbers.",
        )
        const secondDigest = second.digest
        const thirdDigest = third.digest

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
          versions: ["2026.08.13.1", second.version, third.version].toSorted(),
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
            source_read_refs: [],
            hypothesis: "Naming the worker for what the operator wants keeps the intent visible in the manifest.",
            edits: [exactEdit("expert-squad.jsonc", baselineManifest, relabelled)],
          },
        })
        const revised = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.candidatePackageDigest)
        const revisedManifest = await readFile(path.join(revised.root, "expert-squad.jsonc"), "utf8")
        expect({
          changed: revision.changedPaths,
          // The Host restamps its own version over whatever the author wrote.
          version: revision.version,
          manifest: JSON.parse(revisedManifest),
        }).toEqual({
          changed: ["expert-squad.jsonc"],
          version: revision.version,
          manifest: { ...JSON.parse(relabelled), version: revision.version },
        })

        // Reaching for a Tool no revision before it declared is the one move
        // that stays refused, whatever the operator asked for.
        const selfWidenedManifest = JSON.parse(baselineManifest)
        selfWidenedManifest.capability_projection.scheduler.capability_refs.push(
          CapabilityRefCodec.encode(
            capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: "bash" }),
          ),
        )
        selfWidenedManifest.capability_projection.scheduler.capability_refs.sort()
        const selfWidened = `${JSON.stringify(selfWidenedManifest, null, 2)}\n`
        await expect(
          reviseInstalledExpertSquadFromFeedback({
            taskID: task.taskID,
            sessionID: task.session.id,
            request: {
              target_squad_id: SQUAD_ID,
              feedback: FEEDBACK,
              source_read_refs: [],
              hypothesis: "Granting a shell would let the worker draw charts itself.",
              edits: [exactEdit("expert-squad.jsonc", baselineManifest, selfWidened)],
            },
          }),
        ).rejects.toThrow(/capability_refs/)
      },
    })
  })

  test("applies exact sequential edits and preserves the remaining parent text", async () => {
    await using project = await memoryProject()
    const sourceDirectory = path.join(project.path, "source")
    await writeExpertSquadPackage({ directory: sourceDirectory, definition: packageDefinition("2026.08.13.1") })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path, sourceDirectory, installationScope: "project",
        })
        const task = await createTask({
          namespace: "evolution-test", id: SQUAD_ID, version: "2026.08.13.1", packageDigest: installed.after.packageDigest,
        })
        const revision = await reviseInstalledExpertSquadFromFeedback({
          taskID: task.taskID, sessionID: task.session.id,
          request: {
            target_squad_id: SQUAD_ID, feedback: FEEDBACK, source_read_refs: [],
            hypothesis: "Put the concrete output requirement in the worker's existing instruction.",
            edits: [
              exactEdit(PROMPT_PATH, "baseline", "Use tables."),
              exactEdit(PROMPT_PATH, "Use tables.", "Use tables and charts."),
            ],
          },
        })
        const snapshot = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.candidatePackageDigest)
        expect(await readFile(path.join(snapshot.root, PROMPT_PATH), "utf8"))
          .toBe("# Feedback revision worker\n\nUse tables and charts.\n")
        expect(await readFile(path.join(snapshot.root, "README.md"), "utf8"))
          .toBe("# Feedback revision squad\n\nbaseline\n")
        expect(revision.changedPaths).toEqual([PROMPT_PATH, "expert-squad.jsonc"])

        const created = await reviseInstalledExpertSquadFromFeedback({
          taskID: task.taskID, sessionID: task.session.id,
          request: {
            target_squad_id: SQUAD_ID, feedback: FEEDBACK, source_read_refs: [],
            hypothesis: "The scheduler owns the handoff carrying the worker's output requirement.",
            edits: [
              exactEdit("expert-squad.jsonc", '"base_role": "orchestrator"',
                '"base_role": "orchestrator", "prompt": "agents/orchestrator/system.md"'),
              exactEdit("agents/orchestrator/system.md", "", "# Scheduler\n\nPreserve the complete output requirement in the handoff.\n"),
            ],
          },
        })
        const createdSnapshot = await ExpertSquadRegistry.loadPackageRevisionSnapshot(created.candidatePackageDigest)
        expect(await readFile(path.join(createdSnapshot.root, "agents/orchestrator/system.md"), "utf8"))
          .toBe("# Scheduler\n\nPreserve the complete output requirement in the handoff.\n")
      },
    })
  })

  test("reports exact edit conflicts at the requested path and index", async () => {
    await using project = await memoryProject()
    const sourceDirectory = path.join(project.path, "source")
    await writeExpertSquadPackage({ directory: sourceDirectory, definition: packageDefinition("2026.08.13.1") })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path, sourceDirectory, installationScope: "project",
        })
        const task = await createTask({
          namespace: "evolution-test", id: SQUAD_ID, version: "2026.08.13.1", packageDigest: installed.after.packageDigest,
        })
        const examples = [
          { edit: exactEdit(PROMPT_PATH, "old wording not in this parent", "Use tables."), code: "source_text_missing" },
          { edit: exactEdit(PROMPT_PATH, "e", "x"), code: "source_text_ambiguous" },
          { edit: exactEdit(PROMPT_PATH, "", "New content"), code: "target_exists" },
          { edit: exactEdit("agents/missing/system.md", "old", "new"), code: "target_missing" },
          { edit: exactEdit(PROMPT_PATH, "baseline", "baseline"), code: "no_change" },
          ...["../escape.md", "/absolute.md", "agents/../../escape.md", " padded.md", ".", "C:/escape.md", "agents/file.md:stream", "agents/CON.md"]
            .map((name) => ({ edit: exactEdit(name, "", "New content"), code: "invalid_path" })),
        ]
        for (const example of examples) {
          let observed: unknown
          try {
            await reviseInstalledExpertSquadFromFeedback({
              taskID: task.taskID, sessionID: task.session.id,
              request: {
                target_squad_id: SQUAD_ID, feedback: FEEDBACK, source_read_refs: [],
                hypothesis: "An unrelated heading change cannot apply a missing instruction replacement.",
                edits: [exactEdit("README.md", "# Feedback revision squad", "# Revised squad"), example.edit],
              },
            })
          } catch (error) {
            observed = error
          }
          expect(FeedbackRevisionEditError.isInstance(observed) ? observed.data : undefined)
            .toEqual({ editIndex: 1, path: example.edit.path, code: example.code })
        }
      },
    })
  })

  test("reads long evidence in exact byte chunks and publishes its verified source provenance", async () => {
    await using project = await memoryProject()
    const sourceDirectory = path.join(project.path, "source")
    await writeExpertSquadPackage({ directory: sourceDirectory, definition: packageDefinition("2026.08.13.1") })
    const evidence = JSON.stringify({
      earlier_events: "x".repeat(6500),
      decisive: { actor: "orchestrator", rule: "Preserve the original interaction constraint." },
      multibyte: "证据🙂".repeat(1200),
    })
    await writeFile(path.join(project.path, "evidence.json"), evidence)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(async () => {})
        const installed = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path, sourceDirectory, installationScope: "project",
        })
        const task = await createTask({
          namespace: "evolution-test", id: SQUAD_ID, version: "2026.08.13.1", packageDigest: installed.after.packageDigest,
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"), sessionID: task.session.id, role: "user", author: "user",
          time: { created: Date.now() }, agent: "orchestrator", model: { providerID: "test", modelID: "test" },
        })
        const session = await Session.create({ kind: "assistant", parentID: task.session.id, title: "Revision evidence contract" })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"), sessionID: session.id, parentID: user.id,
          role: "assistant", author: "orchestrator", agent: "orchestrator", time: { created: Date.now() },
          providerID: "test", modelID: "test", path: { cwd: project.path, root: project.path },
          cost: 0, tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const executionSurface = createToolExecutionSurface({ toolIDs: ["artifact_snapshot", "artifact_read"], permission: [] })
        // Fixture participants exercise the real snapshot/read/publication path;
        // the separate live author probe verifies actual model consumption.
        async function begin(tool: string, input: Record<string, unknown>) {
          await Session.updatePart({
            id: Identifier.ascending("part"), sessionID: session.id, messageID: assistant.id, type: "step-start",
          })
          const id = Identifier.ascending("part")
          const callID = `call_${id}`
          const start = Date.now()
          await Session.updatePart({
            id, sessionID: session.id, messageID: assistant.id, type: "tool", tool, callID,
            state: { status: "running", input, time: { start } },
          })
          return {
            id, callID, start,
            finish: async (result: { output: string; title: string; metadata: Record<string, unknown> }) => {
              await Session.updatePart({
                id, sessionID: session.id, messageID: assistant.id, type: "tool", tool, callID,
                state: { status: "completed", input, ...result, time: { start, end: Date.now() } },
              })
            },
          }
        }
        const snapshotCall = await begin("artifact_snapshot", { files: [{ path: "evidence.json", media_type: "application/json" }] })
        const publication = await publishTaskArtifactProjectFiles({
          scope: {
            kind: "task", projectID: Instance.project.id, projectDirectory: project.path, taskID: task.taskID,
            taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, task.taskID), sessionID: session.id,
            messageID: assistant.id, toolCallID: snapshotCall.callID, toolPartID: snapshotCall.id, executionSurface,
            owner: {
              kind: "projected-scheduler", expertSquadID: SQUAD_ID, agentID: "orchestrator", projectionHash: "d".repeat(64),
              packageRevision: { scope: "project", projectID: Instance.project.id, namespace: "evolution-test", id: SQUAD_ID,
                version: "2026.08.13.1", packageDigest: installed.after.packageDigest },
            },
          },
          files: [{ path: "evidence.json", mediaType: "application/json" }], source: { kind: "current_task_project" },
        })
        const snapshot = artifactSnapshotTransport(publication.snapshot, publication.artifacts)
        await snapshotCall.finish({ output: JSON.stringify(snapshot), title: "Evidence snapshot", metadata: { truncated: false } })
        const resource = snapshot.locators.find((item) => item.role === "resource")!
        const reader = await ArtifactReadTool.init()
        let reads = [{ artifact_transport_version: 2 as const, artifact_locator_ref: resource.artifact_locator_ref,
          byte_offset: 0, max_bytes: 4096, delivery: "inline" as const }]
        const chunks: string[] = []
        let finalReadRef = ""
        while (reads.length) {
          const call = await begin("artifact_read", { reads })
          const ctx: Tool.Context = {
            sessionID: session.id, messageID: assistant.id, agent: "orchestrator", callID: call.callID,
            abort: new AbortController().signal, messages: [], executionSurface, extra: { toolPartID: call.id }, metadata: () => {},
          }
          const result = await reader.execute({ reads }, ctx)
          await call.finish(result)
          const batch = JSON.parse(result.output)
          chunks.push(batch.results[0].value.text)
          finalReadRef = batch.results[0].value.artifact_read_ref
          reads = batch.next_reads
          if (chunks.length === 1) {
            const partialRequest = {
              target_squad_id: SQUAD_ID, feedback: FEEDBACK, hypothesis: "A partial prefix leaves decisive evidence unread.",
              source_read_refs: [finalReadRef], edits: [exactEdit(PROMPT_PATH, "baseline", "Use tables.")],
            }
            const attempt = await begin("evolve_expert_squad_from_feedback", partialRequest)
            let observed: unknown
            try {
              await reviseInstalledExpertSquadFromFeedback({
                taskID: task.taskID, sessionID: session.id, request: partialRequest,
                evidenceScope: { assistantMessageID: assistant.id, toolPartID: attempt.id },
              })
            } catch (error) {
              observed = error
            }
            expect(observed instanceof ArtifactReferenceResolutionError ? observed.code : undefined)
              .toBe("ARTIFACT_REFERENCE_UNRESOLVED")
          }
        }
        expect(chunks.length).toBeGreaterThan(1)
        expect(Buffer.from(chunks.join(""))).toEqual(Buffer.from(evidence))
        expect(JSON.parse(chunks.join("")).decisive)
          .toEqual({ actor: "orchestrator", rule: "Preserve the original interaction constraint." })
        const request = {
          target_squad_id: SQUAD_ID, feedback: FEEDBACK,
          hypothesis: "Change the exact owning instruction using the complete source, not its clipped prefix.",
          source_read_refs: [finalReadRef, finalReadRef], edits: [exactEdit(PROMPT_PATH, "baseline", "Use tables.")],
        }
        const reviseCall = await begin("evolve_expert_squad_from_feedback", request)
        const revision = await reviseInstalledExpertSquadFromFeedback({
          taskID: task.taskID, sessionID: session.id, request,
          evidenceScope: { assistantMessageID: assistant.id, toolPartID: reviseCall.id },
        })
        const persisted = await readTaskArtifact({
          authority: artifactCatalogAuthority(task.taskID),
          read: { locator: revision.locator, byte_offset: 0, max_bytes: 65536, delivery: "inline" },
        })
        const envelope = JSON.parse(persisted.chunk.text!)
        expect(envelope.payload.provenance).toEqual([resource.locator])
        expect(envelope.source_artifact_locators).toEqual([resource.locator])
        expect(envelope.observed_artifact_locators).toEqual([resource.locator])
        const prepared = prepareEvolutionPackageMutation({
          taskID: task.taskID,
          intent: {
            operation: "feedback_revision", candidateRevisionLocator: revision.locator,
            expectedCurrentPackageDigest: revision.expectedCurrentPackageDigest,
          },
        })
        expect(prepared.evidence).toEqual([revision.locator])
      },
    })
  })
})
