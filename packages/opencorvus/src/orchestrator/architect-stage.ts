import { DispatchOutcome, type DispatchOutcome as DispatchOutcomeResult } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { Event as EngineEvent } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import {
  parseGoalGraphProjectionArtifact,
  parseRequirementSetArtifact,
  resolveGoalMembershipContextForProjectionArtifact,
  type TaskRow,
} from "@/engine/store"
import { requireEngineArtifactByLocator } from "@/artifact-catalog"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import type { GoalGraphProjectionConflict } from "@/engine/goal-graph-projection"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import { artifactReadLocatorKey } from "@opencorvus-ai/plugin/artifact-catalog"
import { ArchitectAgent } from "@/architect/agent"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { researchEvidenceRefsForArtifactLocators } from "@/research/evidence-ref-projection"
import { classifyArchitectReferenceIntegrity } from "@/architect/reference-integrity"

const log = Log.create({ service: "architect-stage" })

type ArchitectStageDependencies = {
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
  coordinateArchitect?: typeof ArchitectAgent.coordinate
}

export type ArchitectRequirementSetProvenance =
  | { status: "selected" }
  | { status: "conflict"; conflict: GoalGraphProjectionConflict }

export function classifyArchitectRequirementSetProvenance(input: {
  requirementSetSelected: boolean
  observedRequirementSetCount: number
}): ArchitectRequirementSetProvenance {
  if (input.requirementSetSelected) return { status: "selected" }
  if (input.observedRequirementSetCount > 0) {
    return {
      status: "conflict",
      conflict: {
        code: "requirement_set_not_selected",
        message:
          `Architect completely read ${input.observedRequirementSetCount} RequirementSet Artifact(s) but did not select exactly one with artifact_select; ` +
          "the candidate is preserved but cannot become the current GoalGraph projection.",
      },
    }
  }
  return {
    status: "conflict",
    conflict: {
      code: "requirement_set_not_read",
      message:
        "Architect completed without completely reading a RequirementSet Artifact; the candidate is preserved but cannot become the current GoalGraph projection.",
    },
  }
}

export function createArchitectStageDispatcher(dependencies: ArchitectStageDependencies) {
  const taskID = dependencies.taskID
  const input = { agentSessionID: dependencies.parentSessionID, signal: dependencies.signal }
  const coordinateArchitect = dependencies.coordinateArchitect ?? ArchitectAgent.coordinate

  return async function dispatchArchitectStage(dispatch: {
    task: TaskRow
    reason?: string
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    attachmentRefs: string[]
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("./dispatch-turn-projection").DispatchTurn
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
  }): Promise<DispatchOutcomeResult> {
    const task = dispatch.task
    let completedTurn: { sessionID: string; finalMessageID: string } | undefined
    try {
      const {
        GoalGraphProjectionConflictError,
        persistArchitectGoalProjection,
        persistArchitectUnprojectableGoalGraphCandidate,
      } = await import("@/engine/persist")

      async function settleArchitectResult(result: ArchitectAgent.CoordinateResult): Promise<DispatchOutcomeResult> {
        const requirementSetArtifactLocator = result.inputFacts.requirementSetArtifactLocator
        const requirementSetArtifact = requirementSetArtifactLocator
          ? parseRequirementSetArtifact(
            requireEngineArtifactByLocator({
              taskID,
              locator: requirementSetArtifactLocator,
            }),
          )
          : undefined
        const priorGoalGraphProjectionArtifactLocator = result.inputFacts.priorGoalGraphProjectionArtifactLocator
        const observedArtifactLocators = result.inputFacts.observedArtifactLocators
        const sourceArtifactLocators = result.inputFacts.sourceArtifactLocators
        const observedRequirementSetCount = observedArtifactLocators.filter(
          (locator) =>
            locator.source === "engine_artifact" &&
            requireEngineArtifactByLocator({ taskID, locator }).kind === "requirement_set",
        ).length
        const requirementSetProvenance = classifyArchitectRequirementSetProvenance({
          requirementSetSelected: requirementSetArtifactLocator !== undefined,
          observedRequirementSetCount,
        })
        let priorGoalGraphProjectionArtifact: ReturnType<typeof parseGoalGraphProjectionArtifact> | undefined
        const priorMembership = priorGoalGraphProjectionArtifactLocator
          ? (() => {
              const priorArtifact = parseGoalGraphProjectionArtifact(
                requireEngineArtifactByLocator({
                  taskID,
                  locator: priorGoalGraphProjectionArtifactLocator,
                }),
              )
              if (priorArtifact.payload.projection === null) {
                throw new Error(
                  `Architect prior GoalGraph projection ${priorArtifact.id} is a non-executable Candidate.`,
                )
              }
              priorGoalGraphProjectionArtifact = priorArtifact
              return resolveGoalMembershipContextForProjectionArtifact({
                taskID,
                projectionArtifactLocator: priorGoalGraphProjectionArtifactLocator,
              })
            })()
          : undefined
        const architectGoals = result.goals.map((goal) => ({
          llmID: goal.id,
          title: goal.title,
          objective: goal.objective,
          acceptance_specs: goal.acceptance_specs,
          owned_paths: goal.owned_paths,
          kind: goal.kind,
          priority: goal.priority,
          source: goal.acceptance_specs.some((spec) => spec.source?.kind === "requirement")
            ? ("spec" as const)
            : ("system" as const),
        }))

        const declaredGoalIDs = new Set(result.goals.map((goal) => goal.id))
        const duplicateGoalIDs = result.goals
          .map((goal) => goal.id)
          .filter((goalID, index, all) => all.indexOf(goalID) !== index)
        const graphGoalIDs = [
          ...result.contractGraph.contracts.flatMap((contract) => [
            contract.producer_goal_id,
            ...contract.consumer_goal_ids,
          ]),
        ]
        const unknownGraphGoalIDs = [...new Set(graphGoalIDs.filter((goalID) => !declaredGoalIDs.has(goalID)))]
        const requiredPriorContractGraphLocator =
          priorGoalGraphProjectionArtifact?.payload.contract_graph_artifact_locator ?? undefined
        const selectedPriorContractGraph =
          requiredPriorContractGraphLocator === undefined ||
          sourceArtifactLocators.some(
            (locator) => artifactReadLocatorKey(locator) === artifactReadLocatorKey(requiredPriorContractGraphLocator),
          )
        const priorGoalIDs = new Set(priorMembership?.goals.map(({ goal }) => goal.id) ?? [])
        const historicalGoalIDs = new Set(priorMembership?.historicalGoals.map((goal) => goal.id) ?? [])
        const removalGoalIDs = result.removedGoals.map((removal) => removal.goal_id)
        const duplicateRemovalGoalIDs = removalGoalIDs.filter((goalID, index, all) => all.indexOf(goalID) !== index)
        const unknownRemovalGoalIDs = removalGoalIDs.filter((goalID) => !priorGoalIDs.has(goalID))
        const returnedAndRemovedGoalIDs = result.goals
          .map((goal) => goal.id)
          .filter((goalID) => removalGoalIDs.includes(goalID))
        const omittedPriorGoalIDs = [...priorGoalIDs].filter(
          (goalID) => !declaredGoalIDs.has(goalID) && !removalGoalIDs.includes(goalID),
        )
        const historicalAliasGoalIDs = result.goals
          .map((goal) => goal.id)
          .filter((goalID) => historicalGoalIDs.has(goalID) && !priorGoalIDs.has(goalID))
        const invalidOwnedPaths = result.goals.flatMap((goal) =>
          ProjectRuntimePaths.internalRuntimeRelativePaths(goal.owned_paths).map(
            (ownedPath) => `${goal.id}:${ownedPath}`,
          ),
        )
        const fidelityGoalIDs = [
          ...result.fidelity.sourceCoverage.flatMap((row) => row.goal_ids),
          ...result.fidelity.referenceCoverage.flatMap((row) => row.goal_ids),
          ...result.fidelity.assemblyOwners.map((row) => row.goal_id),
        ]
        const unknownFidelityGoalIDs = [...new Set(fidelityGoalIDs.filter((goalID) => !declaredGoalIDs.has(goalID)))]
        const referenceIssues = classifyArchitectReferenceIntegrity({
          goals: result.goals,
          graph: result.contractGraph,
          requirementIDs: requirementSetArtifact?.payload.requirements.map((requirement) => requirement.id),
          knownResearchEvidenceRefs: researchEvidenceRefsForArtifactLocators({
            taskID,
            artifactLocators: sourceArtifactLocators,
          }),
        })
        const candidateConflicts: GoalGraphProjectionConflict[] = [
          ...(requirementSetProvenance.status === "conflict" ? [requirementSetProvenance.conflict] : []),
          ...(unknownGraphGoalIDs.length > 0
            ? [
                {
                  code: "unprojectable_contract_graph" as const,
                  message: `Architect candidate ContractGraph references unknown Goal IDs: ${unknownGraphGoalIDs.join(", ")}`,
                },
              ]
            : []),
          ...(!selectedPriorContractGraph
            ? [
                {
                  code: "unprojectable_contract_graph" as const,
                  message:
                    `Architect selected prior GoalGraph ${priorGoalGraphProjectionArtifact?.id} without also selecting its exact linked ContractGraph ` +
                    `${requiredPriorContractGraphLocator?.artifact_id}; the candidate is preserved so prior contracts and fidelity cannot be silently erased.`,
                },
              ]
            : []),
          ...(duplicateGoalIDs.length > 0 ||
          duplicateRemovalGoalIDs.length > 0 ||
          returnedAndRemovedGoalIDs.length > 0 ||
          omittedPriorGoalIDs.length > 0
            ? [
                {
                  code: "invalid_goal_partition" as const,
                  message: [
                    duplicateGoalIDs.length > 0 ? `duplicate goals=${[...new Set(duplicateGoalIDs)].join(",")}` : "",
                    duplicateRemovalGoalIDs.length > 0
                      ? `duplicate removals=${[...new Set(duplicateRemovalGoalIDs)].join(",")}`
                      : "",
                    returnedAndRemovedGoalIDs.length > 0
                      ? `returned and removed=${[...new Set(returnedAndRemovedGoalIDs)].join(",")}`
                      : "",
                    omittedPriorGoalIDs.length > 0 ? `omitted prior goals=${omittedPriorGoalIDs.join(",")}` : "",
                  ]
                    .filter(Boolean)
                    .join("; "),
                },
              ]
            : []),
          ...(unknownRemovalGoalIDs.length > 0 || historicalAliasGoalIDs.length > 0
            ? [
                {
                  code: "non_current_goal_reference" as const,
                  message: [
                    unknownRemovalGoalIDs.length > 0
                      ? `unknown removals=${[...new Set(unknownRemovalGoalIDs)].join(",")}`
                      : "",
                    historicalAliasGoalIDs.length > 0
                      ? `historical aliases=${[...new Set(historicalAliasGoalIDs)].join(",")}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("; "),
                },
              ]
            : []),
          ...(invalidOwnedPaths.length > 0
            ? [
                {
                  code: "unprojectable_goal_contract" as const,
                  message: `Architect candidate Goal owned_paths include OpenCorvus runtime paths: ${invalidOwnedPaths.join(", ")}`,
                },
              ]
            : []),
          ...(unknownFidelityGoalIDs.length > 0
            ? [
                {
                  code: "unprojectable_fidelity" as const,
                  message: `Architect candidate fidelity references unknown Goal IDs: ${unknownFidelityGoalIDs.join(", ")}`,
                },
              ]
            : []),
          ...referenceIssues.map((issue) => ({
            code: issue.code === "unknown_requirement_ids"
              ? "unprojectable_requirement_reference" as const
              : issue.code === "unknown_contract_ids"
                ? "unprojectable_contract_reference" as const
                : "unprojectable_evidence_reference" as const,
            message: issue.message,
          })),
        ]
        try {
          if (candidateConflicts.length > 0) {
            const candidateProjectionArtifactLocator = Database.transaction((db) => {
              const now = Date.now()
              const candidate = persistArchitectUnprojectableGoalGraphCandidate(db, {
                taskID,
                producer: {
                  kind: "architect_turn",
                  session_id: result.sessionID,
                  final_message_id: result.finalMessageID,
                },
                requirementSetArtifactLocator,
                priorGoalGraphProjectionArtifactLocator,
                observedArtifactLocators,
                sourceArtifactLocators,
                architectGoals,
                removals: result.removedGoals,
                graph: result.contractGraph,
                fidelity: result.fidelity,
                conflicts: candidateConflicts,
                now,
              })
              Database.effect(() =>
                EngineProtocol.emit(
                  EngineEvent.TaskUpdated,
                  {
                    taskID,
                    summary: `Projected agent "${dispatch.agentID}" persisted a conflicting ContractGraph fact for Orchestrator judgment`,
                  },
                  { source: "orchestrator.architect" },
                ),
              )
              return candidate.candidateProjectionArtifactLocator
            })
            return DispatchOutcome.domainIncomplete({
              sessionID: result.sessionID,
              finalMessageID: result.finalMessageID,
              domain: "architect_projection",
              domainArtifact: candidateProjectionArtifactLocator,
            })
          }

          try {
            Database.transaction((db) => {
              const now = Date.now()
              persistArchitectGoalProjection(db, {
                taskID,
                producer: {
                  kind: "architect_turn",
                  session_id: result.sessionID,
                  final_message_id: result.finalMessageID,
                },
                requirementSetArtifactLocator,
                priorGoalGraphProjectionArtifactLocator,
                observedArtifactLocators,
                sourceArtifactLocators,
                architectGoals,
                removals: result.removedGoals,
                graph: result.contractGraph,
                fidelity: result.fidelity,
                now,
              })

              Database.effect(() =>
                EngineProtocol.emit(
                  EngineEvent.TaskUpdated,
                  {
                    taskID,
                    summary: `Projected agent "${dispatch.agentID}" persisted a Delivery Slice graph via the architect adapter`,
                  },
                  { source: "orchestrator.architect" },
                ),
              )
            })
          } catch (projectionError) {
            if (!(projectionError instanceof GoalGraphProjectionConflictError)) throw projectionError
            const candidateProjectionArtifactLocator = Database.transaction((db) => {
              const candidate = persistArchitectUnprojectableGoalGraphCandidate(db, {
                taskID,
                producer: {
                  kind: "architect_turn",
                  session_id: result.sessionID,
                  final_message_id: result.finalMessageID,
                },
                requirementSetArtifactLocator,
                priorGoalGraphProjectionArtifactLocator,
                observedArtifactLocators,
                sourceArtifactLocators,
                architectGoals,
                removals: result.removedGoals,
                graph: result.contractGraph,
                fidelity: result.fidelity,
                conflicts: [],
                now: Date.now(),
              })
              return candidate.candidateProjectionArtifactLocator
            })
            return DispatchOutcome.domainIncomplete({
              sessionID: result.sessionID,
              finalMessageID: result.finalMessageID,
              domain: "architect_projection",
              domainArtifact: candidateProjectionArtifactLocator,
            })
          }
        } catch (dbErr) {
          log.error("architect: failed to persist goals to DB", {
            taskID,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            stack: dbErr instanceof Error ? dbErr.stack : undefined,
          })
          throw dbErr
        }

        return DispatchOutcome.terminal({
          sessionID: result.sessionID,
          finalMessageID: result.finalMessageID,
        })
      }

      const result = await coordinateArchitect({
        agentID: dispatch.agentID,
        packageRevision: dispatch.packageRevision,
        workScope: dispatch.workScope,
        newSessionID: dispatch.newSessionID,
        existingSessionID: dispatch.existingSessionID,
        continuationPrompt: dispatch.continuationPrompt,
        dispatchTurn: dispatch.dispatchTurn,
        instruction: dispatch.reason ?? "Produce or reassess the exact selected architecture facts.",
        taskID,
        attachmentRefs: dispatch.attachmentRefs,
        signal: input.signal,
        parentSessionID: input.agentSessionID,
        onStatus: () => {},
        onSessionCreated: async (id) => {
          await dispatch.onSessionCreated?.(id)
        },
        onDispatchAuthorityCommit: dispatch.onDispatchAuthorityCommit,
        onRuntimeReady: dispatch.onRuntimeReady,
        onTurnCompleted: (turn) => {
          completedTurn = turn
        },
      })

      if (isAgentCoordinationHandoffResult(result)) {
        return DispatchOutcome.coordination(result)
      }
      return await settleArchitectResult(result)
    } catch (err) {
      if (completedTurn) {
        const failureReason = err instanceof Error ? err.message : String(err)
        log.error("architect: post-turn persistence failed", {
          taskID,
          sessionID: completedTurn.sessionID,
          error: failureReason,
          stack: err instanceof Error ? err.stack : undefined,
        })
        const infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
          {
            taskID,
            component: "architect",
            operation: "persist-goals-and-contract-graph",
            reason: failureReason,
            errorName: err instanceof Error ? err.name : undefined,
            sessionID: completedTurn.sessionID,
            now: Date.now(),
          },
          {
            onFailure: (observationError) =>
              log.error("architect persistence observation also failed", {
                taskID,
                sessionID: completedTurn?.sessionID,
                error: observationError instanceof Error ? observationError.message : String(observationError),
              }),
          },
        )
        return DispatchOutcome.partial({
          sessionID: completedTurn.sessionID,
          finalMessageID: completedTurn.finalMessageID,
          failedOperation: "persist-goals-and-contract-graph",
          infrastructureError: infrastructureObservationRef,
        })
      }
      const { createDecisionLog } = await import("@/decision-log")
      const failureReason = err instanceof Error ? err.message : String(err)
      createDecisionLog(taskID).append({
        phase: "architect",
        key: "abort_architect_failed",
        value: `Projected agent "${dispatch.agentID}" aborted via the architect adapter: ${failureReason.slice(0, 400)}`,
        reason: "architect_threw",
      })
      throw err
    }
  }
}
