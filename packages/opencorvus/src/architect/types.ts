/**
 * Architect Agent types — authoritative goal decomposer.
 *
 * The Architect sits between Requirements and Dispatch. It reads the
 * requirement list + foundational decisions, explores the codebase, and
 * produces a ContractGraph and goal set with requirement-derived acceptance coverage, fidelity coverage,
 * assembly ownership, and cross-goal interface contracts in one Task-scoped occurrence.
 */
import type { GoalContractFields } from "@/pipeline/types"
import type { ParsedRequirement, RequirementsDecision } from "@/requirements/types"
import type { AssemblyOwnerEntry, ReferenceCoverageEntry, SourceCoverageEntry } from "./fidelity"
import type { ArchitectContractGraph } from "./contract-graph"
import type { GoalGraphRemoval } from "@/engine/goal-graph-projection"
import type {
  ArtifactReadLocator,
  EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"

// ---------------------------------------------------------------------------
// Architect Decision Log key categories
// ---------------------------------------------------------------------------

/** Architect graph artifacts are persisted as task-scoped engine artifacts. */
export type ArchitectDecisionKey = "architect_contract_graph"

// ---------------------------------------------------------------------------
// ArchitectContract — one cross-goal consensus entry
// ---------------------------------------------------------------------------

export interface ArchitectContract {
  category: ArchitectDecisionKey
  title: string
  contractGraph: ArchitectContractGraph
}

export interface ArchitectFidelityCoverage {
  sourceCoverage: SourceCoverageEntry[]
  referenceCoverage: ReferenceCoverageEntry[]
  assemblyOwners: AssemblyOwnerEntry[]
}

// ---------------------------------------------------------------------------
// ArchitectArtifact — durable planning facts
// ---------------------------------------------------------------------------

export interface ArchitectArtifact {
  inputFacts: {
    requirementSetArtifactLocator?: EngineArtifactLocator
    priorGoalGraphProjectionArtifactLocator?: EngineArtifactLocator
    sourceArtifactLocators: ArtifactReadLocator[]
    observedArtifactLocators: ArtifactReadLocator[]
  }
  /** Goal facts produced by the Architect. Architecture review is independent
   *  advisory evidence recorded after Build; it does not prescribe a repair
   *  route or re-upsert and mutate this goal set by itself. */
  goals: GoalContractFields[]
  /** Exact prior Goal revisions removed from the next graph membership. */
  removedGoals: GoalGraphRemoval[]
  fidelity: ArchitectFidelityCoverage
  /** Cross-goal interface contracts returned with temporary goal ids; orchestrator remaps before persistence. */
  contractGraph: ArchitectContractGraph
}

// ---------------------------------------------------------------------------
// Re-export primitives the Architect receives from Requirements as input.
// ---------------------------------------------------------------------------

export type { ParsedRequirement, RequirementsDecision } from "@/requirements/types"
