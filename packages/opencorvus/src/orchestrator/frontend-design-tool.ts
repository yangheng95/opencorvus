import fs from "node:fs/promises"
import path from "node:path"
import { tool } from "ai"
import type z from "zod"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { EngineService } from "@/task-api"
import type { TaskRow } from "@/engine/store"
import {
  createDesignResourceManifest,
  designResourceManifestFileRefs,
  type DesignResourceFileRef,
  type DesignResourceIntent,
  frontendDesignMaterialMime,
  recordDesignResourceManifest,
} from "@/frontend-design/design-resource-manifest"
import { FrontendDesignAgent } from "@/frontend-design/agent"
import { recordPartialFrontendDesignFacts } from "@/frontend-design/partial-artifact"
import { recordFrontendDesignArtifact } from "@/frontend-design/artifact"
import { renderVisualHtmlSkeletonScreenshotForValidation } from "@/frontend-design/output-tools"
import { projectRenderableDesignSources } from "@/frontend-design/renderable-source-projection"
import { Instance } from "@/project/instance"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { AttachmentStore } from "@/storage/attachment-store"
import { Log } from "@/util/log"
import {
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import type { TaskWithRootSession } from "./tool-execution-context"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"

const log = Log.create({ service: "frontend-design-tool" })

type FrontendDesignToolInput = {
  goal_ids: string[]
  mode: "greenfield_original" | "reference_parity"
  reason: string
  attachment_bindings?: Array<{ attachment_url: string; intent: DesignResourceIntent }>
  materials?: Array<{ path: string; intent: DesignResourceIntent }>
}

async function resolveAttachmentBindings(input: {
  task: TaskRow
  bindings: NonNullable<FrontendDesignToolInput["attachment_bindings"]>
}): Promise<DesignResourceFileRef[]> {
  const taskAttachments = Array.isArray(input.task.attachments) ? input.task.attachments : []
  const byURL = new Map(taskAttachments.map((attachment) => [attachment.url, attachment]))
  const resources: DesignResourceFileRef[] = []
  for (const binding of input.bindings) {
    const stored = byURL.get(binding.attachment_url)
    if (!stored) {
      throw new Error(
        `frontend_design attachment binding ${binding.attachment_url} is not attached to task ${input.task.id}`,
      )
    }
    const located = AttachmentStore.nameFromUrl(binding.attachment_url)
    if (!located || located.projectID !== input.task.project_id) {
      throw new Error(
        `frontend_design attachment binding ${binding.attachment_url} does not belong to project ${input.task.project_id}`,
      )
    }
    const canonical = await AttachmentStore.readReference(located.projectID, located.name)
    if (
      canonical.url !== stored.url ||
      canonical.sha !== stored.sha ||
      canonical.mime !== stored.mime ||
      canonical.size !== stored.size ||
      canonical.filename !== stored.filename
    ) {
      throw new Error(`frontend_design attachment binding ${binding.attachment_url} metadata is not canonical`)
    }
    resources.push({ ...canonical, intent: binding.intent, source: "user-upload" })
  }
  return resources
}

type FrontendDesignToolDependencies = {
  inputSchema: z.ZodType<FrontendDesignToolInput>
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
  requireCurrentTaskAndAgentSessionLineage: () => Promise<TaskWithRootSession>
}

export function createFrontendDesignTool(dependencies: FrontendDesignToolDependencies) {
  const taskID = dependencies.taskID
  const input = { agentSessionID: dependencies.parentSessionID, signal: dependencies.signal }
  const requireCurrentTaskAndAgentSessionLineage = dependencies.requireCurrentTaskAndAgentSessionLineage

  return {
    frontend_design: tool({
      description: [
        "Produce one bounded frontend design Artifact with fillable modules, component/material inventories, and visual/data contracts from an explicit design mode and declared resources.",
        "Choose mode=greenfield_original for original design from textual product/system/API/interaction constraints; choose mode=reference_parity when explicitly declared source or visual resources are the authority. Renderable HTML design_source/interaction_reference material is source evidence and receives a linked browser-rendered visual_reference projection before the worker starts.",
        "Each invocation produces one Task-scoped Artifact for the declared visual evidence. The active expert-squad scheduler decides whether that evidence is needed and which projected consumers use it.",
        "This adapter requires frontend/UI implementation evidence from at least one of these inputs:",
        "  - Neutral task uploads are explicitly declared through attachment_bindings",
        "  - The request explicitly asks for layout/frontend design as implementation input",
        "Specialist evidence acquisition order, source-structure prerequisites, and fidelity semantics come from the active expert-squad overlay and projected tools.",
        "",
        "A projected agent using this adapter must review evidence/template completeness and projected implementation feasibility, then record the actual findings before publishing its Artifact.",
        "The strict FrontendDesign artifact is the sole domain source. It records the full design, completeness findings,",
        "and visible Session/final-message references; prompt projections are rebuilt from that artifact.",
        "",
        "This adapter has no applicable design work when the task is purely backend/API/infrastructure or when neither declared textual design resources nor visual reference resources are available.",
      ].join("\n"),
      inputSchema: dependencies.inputSchema,
      execute: async ({ mode, reason, attachment_bindings, materials, goal_ids }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const options = execution.toolOptions
        const task = await requireCurrentTaskAndAgentSessionLineage()
        const frontendDesignAgentName = execution.agentID
        const bindings = attachment_bindings ?? []
        const materialInputs = materials ?? []
        log.info("frontend_design: starting", {
          taskID,
          attachmentBindingCount: bindings.length,
          materialCount: materialInputs.length,
          reason,
        })

        // Every explicit local design resource is written to AttachmentStore
        // and registered as a system artifact. Neutral user uploads enter the
        // manifest only through explicit current-task attachment bindings.
        const formatFrontendDesignMaterializationError = (failure: {
          source: "material"
          target: string
          stage: string
          error: string
        }) =>
          `frontend_design source observation: explicit ${failure.source} source ${failure.target} failed during ${failure.stage}: ${failure.error}`

        const designResources: DesignResourceFileRef[] = await resolveAttachmentBindings({ task, bindings })
        const materializationFindings: string[] = []

        // --- Local material files --------------------------------------------
        // Paths are resolved against the project root and must stay inside
        // it. Each row names exactly one file; directories would create an
        // implicit second resource-discovery source.
        const projectRoot = taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id })
        for (const material of materialInputs) {
          const rawPath = material.path
          const abs = path.isAbsolute(rawPath)
            ? path.normalize(rawPath)
            : path.normalize(path.resolve(projectRoot, rawPath))
          const relativeToProject = path.relative(path.resolve(projectRoot), abs)
          if (relativeToProject.startsWith("..") || path.isAbsolute(relativeToProject)) {
            const failure = {
              source: "material",
              target: rawPath,
              stage: "path",
              error: `resolved path escapes project root: ${abs}`,
            } as const
            log.warn("frontend_design: material path escapes project root", {
              taskID,
              rawPath,
              projectRoot,
            })
            materializationFindings.push(formatFrontendDesignMaterializationError(failure))
            continue
          }
          try {
            const materialInfo = await fs.stat(abs)
            if (!materialInfo.isFile()) {
              throw new Error(
                `path is not a regular file; materials[].path must name one explicit file instead of a directory: ${abs}`,
              )
            }
            const bytes = await fs.readFile(abs)
            const filename = path.basename(abs)
            const mime = frontendDesignMaterialMime(filename)
            const ref = await AttachmentStore.write(task.project_id, bytes, mime, filename)
            const resource = {
              ...ref,
              intent: material.intent,
              source: "material" as const,
            }
            await EngineService.appendTaskSystemArtifact(taskID, resource)
            designResources.push(resource)
            log.info("frontend_design: material materialized", {
              taskID,
              path: rawPath,
              sha: ref.sha,
              size: ref.size,
              mime,
            })
          } catch (matErr) {
            const failure = {
              source: "material",
              target: rawPath,
              stage: "read",
              error: matErr instanceof Error ? matErr.message : String(matErr),
            } as const
            log.warn("frontend_design: material materialization failed", {
              taskID,
              path: rawPath,
              error: matErr instanceof Error ? matErr.message : String(matErr),
            })
            materializationFindings.push(formatFrontendDesignMaterializationError(failure))
          }
        }

        // Refresh once to build the canonical design-resource manifest from
        // the materialized resources. The manifest is an index; AttachmentStore
        // remains the byte store.
        let designResourceManifest: ReturnType<typeof createDesignResourceManifest> | undefined
        if (designResources.length > 0) {
          const indexedManifest = createDesignResourceManifest({
            taskID,
            resources: designResources,
          })
          const manifest =
            mode === "reference_parity"
              ? await projectRenderableDesignSources({
                  manifest: indexedManifest,
                  projectID: task.project_id,
                  projectDir: taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id }),
                  renderHtml: (renderInput) =>
                    renderVisualHtmlSkeletonScreenshotForValidation({
                      ...renderInput,
                      processIdentity: { taskID, cwd: taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id }) },
                    }),
                })
              : indexedManifest
          designResourceManifest = manifest
          recordDesignResourceManifest({ taskID, manifest })
        }

        // Single session per sub-agent (rule 22). FrontendDesignAgent.analyze
        // creates the runner session internally; the orchestrator captures
        // its id via onSessionCreated for downstream emit attribution.
        let completedTurn: { sessionID: string; finalMessageID: string } | undefined
        try {
          const analysis = await FrontendDesignAgent.analyze({
            mode,
            instruction: [
              reason,
              `Exact Delivery Slice revision subjects: ${goal_ids.join(", ") || "(none)"}.`,
              "These immutable subjects scope design evidence only; they do not create execution or lifecycle instances.",
            ].join("\n"),
            agentID: frontendDesignAgentName,
            packageRevision: execution.projectedAgent.packageRevision,
            workScope: execution.workScope,
            newSessionID: execution.newSessionID,
            existingSessionID: execution.existingSessionID,
            continuationPrompt: dispatchAdapterContinuationPrompt(execution),
            dispatchTurn: execution.dispatch.turn,
            taskID,
            attachments: (designResourceManifest ? designResourceManifestFileRefs(designResourceManifest) : []).map(
              ({ sha, url, mime, size, filename }) => ({
                sha,
                url,
                mime,
                size,
                ...(filename ? { filename } : {}),
              }),
            ),
            parentSessionID: input.agentSessionID,
            signal: input.signal,
            onStatus: () => {},
            onSessionCreated: async (id) => {
              execution.dispatch.observeSession(id)
            },
            onDispatchAuthorityCommit: (id, descriptor) => execution.dispatch.commitSession(id, descriptor),
          })

          if (isAgentCoordinationHandoffResult(analysis)) {
            return DispatchOutcome.coordination(analysis)
          }
          completedTurn = {
            sessionID: analysis.sessionID,
            finalMessageID: analysis.finalMessageID,
          }
          const completenessFindings = [...materializationFindings, ...analysis.completenessFindings]
          const provenance = artifactProvenanceForAgentTurn(analysis.sessionID, analysis.finalMessageID)
          if (analysis.outcome === "partial") {
            recordPartialFrontendDesignFacts({
              taskID,
              mode,
              sessionID: analysis.sessionID,
              finalMessageID: analysis.finalMessageID,
              observedArtifactLocators: provenance.observedArtifactLocators,
              sourceArtifactLocators: provenance.sourceArtifactLocators,
              factSnapshot: analysis.factSnapshot,
              visualSpecs: analysis.specs,
              missing: analysis.missing,
              completenessFindings,
            })
            return DispatchOutcome.terminal({
              sessionID: analysis.sessionID,
              finalMessageID: analysis.finalMessageID,
            })
          }

          const countByCategory = analysis.specs.reduce<Record<string, number>>((acc, s) => {
            acc[s.category] = (acc[s.category] ?? 0) + 1
            return acc
          }, {})
          recordFrontendDesignArtifact({
            taskID,
            artifact: {
              status: "complete",
              mode,
              session_id: analysis.sessionID,
              final_message_id: analysis.finalMessageID,
              observed_artifact_locators: provenance.observedArtifactLocators,
              source_artifact_locators: provenance.sourceArtifactLocators,
              design: analysis.artifact,
              visual_specs: analysis.specs,
              completeness_findings: completenessFindings,
            },
          })

          log.info("frontend_design: complete", {
            taskID,
            total: analysis.specs.length,
            byCategory: countByCategory,
          })

          // Card terminal status flows through agent.execution.lifecycle; counts on
          // the Panel come from boardStore. No phase-completed bus event.

          return DispatchOutcome.terminal({
            sessionID: analysis.sessionID,
            finalMessageID: analysis.finalMessageID,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (completedTurn) {
            log.error("frontend_design: post-turn persistence failed", {
              taskID,
              sessionID: completedTurn.sessionID,
              error: msg,
            })
            const infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
              {
                taskID,
                component: "frontend-design",
                operation: "persist-domain-artifact",
                reason: msg,
                errorName: err instanceof Error ? err.name : undefined,
                sessionID: completedTurn.sessionID,
                now: Date.now(),
              },
              {
                onFailure: (observationError) =>
                  log.error("frontend_design persistence observation also failed", {
                    taskID,
                    sessionID: completedTurn?.sessionID,
                    error: observationError instanceof Error ? observationError.message : String(observationError),
                  }),
              },
            )
            return DispatchOutcome.partial({
              sessionID: completedTurn.sessionID,
              finalMessageID: completedTurn.finalMessageID,
              failedOperation: "persist-domain-artifact",
              infrastructureError: infrastructureObservationRef,
            })
          }
          log.error("frontend_design: failed", { taskID, error: msg })
          throw err instanceof Error ? err : new Error(msg)
        }
      },
    }),
  }
}
