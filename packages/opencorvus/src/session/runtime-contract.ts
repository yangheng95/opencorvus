import { ProjectedWorkerIdentitySchema, type ProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import type { ProjectedSchedulerIdentity } from "@/agent/projected-scheduler-identity"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { sameExpertSquadPackageRevision } from "@/expert-squad/package-revision"
import type { TextHooks } from "@/llm/api"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import {
  assertFrozenSessionAgentRuntime,
  SessionAgentRuntime,
  type SessionAgentRuntime as SessionAgentRuntimeValue,
} from "@/agent/session-agent-runtime"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import {
  ProjectedAgentWorkScope,
  ProjectedAgentWorkScopeSchema,
  type ProjectedAgentWorkScope as ProjectedAgentWorkScopeValue,
} from "@/agent/projected-agent-work-scope"
import type { MCP } from "@/mcp"
import { harnessGrantedRefs, type HarnessGrantSet } from "@/capability/harness-projection"
import { runtimeToolOwnerIDs, type RuntimeToolOwner } from "./runtime-tool-owner"

export type SessionRuntimeContractKind = "stage-attempt" | "orchestrator-wake"

export type SessionRuntimeSystemProjection = Readonly<{
  parts: readonly string[]
  labels: readonly string[]
}>

export function isSessionRuntimeSystemProjection(
  value: readonly string[] | SessionRuntimeSystemProjection | undefined,
): value is SessionRuntimeSystemProjection {
  return Boolean(value && !Array.isArray(value))
}

interface SessionRuntimeContractIdentityBase {
  sessionID: string
  agentID: string
  baseRole: string
  sessionKind: string
  contractKind: SessionRuntimeContractKind
  workerTurnDescriptorID?: string
  workerTurnDescriptorHash?: string
  attemptID?: string
  installedAt: number
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
}

export type SessionRuntimeContractIdentity =
  | (SessionRuntimeContractIdentityBase &
      ProjectedWorkerIdentity & {
        identityKind: "projected-worker"
        contractKind: "stage-attempt"
        expertSquadID: string
        taskID: string
        workScope: ProjectedAgentWorkScopeValue
        workerTurnDescriptorID: string
        workerTurnDescriptorHash: string
      })
  | (SessionRuntimeContractIdentityBase &
      ProjectedSchedulerIdentity & {
        identityKind: "projected-scheduler"
        contractKind: "orchestrator-wake"
        expertSquadID: string
        taskID: string
        taskIngressID?: string
        taskIngressActivationID?: string
        taskIngressPredecessorID?: string
        inputMessageID?: string
        workerTurnDescriptorID?: never
        workerTurnDescriptorHash?: never
      })

interface SessionRuntimeContractBase {
  systemMode?: "complete"
  runOnce?: boolean
  stream?: TextHooks
  resources: Readonly<{
    mcp: MCP.ScopedConnectionOwner
    tools: RuntimeToolOwner
  }>
  harnessGrants: HarnessGrantSet
}

interface SessionLoopRuntimeOptions {
  includeMcpTools?: boolean
}

type ProjectedWorkerRuntimeContractBase = SessionRuntimeContractBase & {
  system?: readonly string[]
  identity: Extract<SessionRuntimeContractIdentity, { identityKind: "projected-worker" }>
  skillProjection: PromptProfileResolver.ResolvedSkillProjection
  projectDirectory: string
  runtime: SessionAgentRuntimeValue
  permissionContinuation?: Readonly<{ requestID: string; toolName: string }>
}

export type ProjectedWorkerSessionLoopRuntimeContract = ProjectedWorkerRuntimeContractBase &
  SessionLoopRuntimeOptions

export type ProjectedWorkerRuntimeContract = ProjectedWorkerSessionLoopRuntimeContract

export type ProjectedSchedulerRuntimeContract = SessionRuntimeContractBase &
  SessionLoopRuntimeOptions & {
    system?:
      | readonly string[]
      | (() => SessionRuntimeSystemProjection | Promise<SessionRuntimeSystemProjection>)
    identity: Extract<SessionRuntimeContractIdentity, { identityKind: "projected-scheduler" }>
    skillProjection: PromptProfileResolver.ResolvedSkillProjection
    projectDirectory: string
  }

export type SessionRuntimeContract = ProjectedWorkerRuntimeContract | ProjectedSchedulerRuntimeContract

export function artifactPackageRevision(revision: PromptProfileResolver.ResolvedPackageRevision): {
  scope: "built_in" | "project" | "global"
  project_id: string | null
  namespace: string
  id: string
  version: string
  package_digest: string
} {
  return {
    scope: revision.scope,
    project_id: revision.projectID,
    namespace: revision.namespace,
    id: revision.id,
    version: revision.version,
    package_digest: revision.packageDigest,
  }
}

export function isProjectedWorkerRuntimeContract(
  contract: SessionRuntimeContract,
): contract is ProjectedWorkerRuntimeContract {
  return contract.identity.identityKind === "projected-worker"
}

export function isProjectedSchedulerRuntimeContract(
  contract: SessionRuntimeContract,
): contract is ProjectedSchedulerRuntimeContract {
  return contract.identity.identityKind === "projected-scheduler"
}

const contracts = new Map<string, SessionRuntimeContract>()
const wakeWaiters = new Map<string, Set<() => void>>()
type RuntimeContractOwner = {
  operation: string
  token: symbol
}

const runtimeContractOwners = new Map<string, Map<symbol, RuntimeContractOwner>>()
const runtimeWakeSettlementWaiters = new Map<
  string,
  Map<SessionRuntimeContract, Set<{ resolve: () => void; reject: (error: Error) => void }>>
>()
const consumedRuntimeWakes = new Map<string, SessionRuntimeContract>()
const settledRuntimeWakes = new WeakSet<SessionRuntimeContract>()
const failedRuntimeWakes = new WeakMap<SessionRuntimeContract, Error>()
const armedRuntimeWakes = new WeakSet<SessionRuntimeContract>()

function runtimeContractOwnerOperations(sessionID: string): string[] {
  return [...(runtimeContractOwners.get(sessionID)?.values() ?? [])].map((owner) => owner.operation)
}

function pendingWake(contract: SessionRuntimeContract | undefined): boolean {
  return (
    contract?.identity.contractKind === "orchestrator-wake" &&
    contract.runOnce === true &&
    armedRuntimeWakes.has(contract)
  )
}

function orchestratorWake(contract: SessionRuntimeContract | undefined): boolean {
  return contract?.identity.contractKind === "orchestrator-wake" && contract.runOnce === true
}

function sameRuntimeContractOccurrence(
  left: SessionRuntimeContract | undefined,
  right: SessionRuntimeContract,
): boolean {
  return Boolean(left && JSON.stringify(left.identity) === JSON.stringify(right.identity))
}

function sameRuntimeToolOwnerOccurrence(
  left: SessionRuntimeContract | undefined,
  right: SessionRuntimeContract,
): boolean {
  if (!left || left.identity.identityKind !== right.identity.identityKind) return false
  if (left.identity.sessionID !== right.identity.sessionID) return false
  if (left.identity.identityKind === "projected-worker" && right.identity.identityKind === "projected-worker") {
    return (
      left.identity.workerTurnDescriptorID === right.identity.workerTurnDescriptorID &&
      left.identity.workerTurnDescriptorHash === right.identity.workerTurnDescriptorHash
    )
  }
  if (left.identity.identityKind !== "projected-scheduler" || right.identity.identityKind !== "projected-scheduler") {
    return false
  }
  if (left.identity.taskIngressID || right.identity.taskIngressID) {
    return (
      left.identity.taskIngressID === right.identity.taskIngressID &&
      left.identity.taskIngressActivationID === right.identity.taskIngressActivationID &&
      left.identity.taskIngressPredecessorID === right.identity.taskIngressPredecessorID
    )
  }
  return Boolean(
    left.identity.inputMessageID &&
      right.identity.inputMessageID &&
      left.identity.inputMessageID === right.identity.inputMessageID,
  )
}

function notifyWake(sessionID: string): void {
  const waiters = wakeWaiters.get(sessionID)
  if (!waiters) return
  for (const wake of [...waiters]) wake()
}

export namespace SessionRuntimeContractStore {
  export function set(
    sessionID: string,
    contract: SessionRuntimeContract,
    options: { armWake?: boolean; notifyWake?: boolean; consumePendingWake?: boolean } = {},
  ): SessionRuntimeContract {
    const ownerOperations = runtimeContractOwnerOperations(sessionID)
    if (ownerOperations.length > 0) {
      throw new Error(`SessionRuntimeContract cannot change during ${ownerOperations.join(", ")} for ${sessionID}`)
    }
    if (
      Object.hasOwn(contract as object, "tools") ||
      Object.hasOwn(contract as object, "projectedTools") ||
      Object.hasOwn(contract as object, "stageTools")
    ) {
      throw new Error("SessionRuntimeContract Tool records are retired; use the exact resources.tools owner.")
    }
    if (contract.identity.sessionID !== sessionID) {
      throw new Error(
        `SessionRuntimeContract identity mismatch: contract session ${contract.identity.sessionID} cannot be installed on ${sessionID}`,
      )
    }
    // Widen the typed union at this runtime boundary so cast-invalid callers are
    // validated instead of being optimized away as impossible by TypeScript.
    const identity = contract.identity as SessionRuntimeContractIdentityBase & {
      identityKind: string
      dispatchAdapterID?: unknown
      runtimeTemplateABIVersion?: unknown
      dispatchAdapterABIVersion?: unknown
      expertSquadID?: string
      projectionHash?: string
      packageRevision?: unknown
      taskID?: unknown
      workScope?: unknown
    }
    if (identity.identityKind !== "projected-worker" && identity.identityKind !== "projected-scheduler") {
      throw new Error(`Unknown session runtime identity kind ${JSON.stringify(identity.identityKind)}`)
    }
    const packageRevision = WorkerTurnDescriptor.Payload.shape.packageRevision.parse(identity.packageRevision)
    if (packageRevision.id !== identity.expertSquadID) {
      throw new Error(
        `SessionRuntimeContract package revision ${packageRevision.id} does not match expert squad ${identity.expertSquadID}`,
      )
    }
    if (identity.identityKind === "projected-worker") {
      const workerContract = contract as ProjectedWorkerRuntimeContract
      const projectedIdentity = ProjectedWorkerIdentitySchema.parse({
        agentID: identity.agentID,
        baseRole: identity.baseRole,
        sessionKind: identity.sessionKind,
        dispatchAdapterID: identity.dispatchAdapterID,
        runtimeTemplateABIVersion: identity.runtimeTemplateABIVersion,
        dispatchAdapterABIVersion: identity.dispatchAdapterABIVersion,
        projectionHash: identity.projectionHash,
      })
      if (identity.contractKind !== "stage-attempt") {
        throw new Error(`Projected worker ${identity.agentID} cannot install ${identity.contractKind} runtime contract`)
      }
      if (typeof identity.taskID !== "string" || !identity.taskID.trim()) {
        throw new Error(`Projected worker ${identity.agentID} runtime contract requires taskID`)
      }
      const workScope = ProjectedAgentWorkScopeSchema.parse(identity.workScope)
      if (!identity.workerTurnDescriptorID || !identity.workerTurnDescriptorHash) {
        throw new Error(`Projected worker ${identity.agentID} runtime contract requires worker descriptor id/hash`)
      }
      assertHarnessGrants(identity, contract)
      const owner = assertProjectedSkillSurface(
        contract.identity as Extract<SessionRuntimeContractIdentity, { identityKind: "projected-worker" }>,
        contract,
      ) as PromptProfileResolver.ResolvedProjectedAgent
      assertProjectedWorkerToolSurface(projectedIdentity.dispatchAdapterID, owner, workerContract)
      const runtime = SessionAgentRuntime.parse(workerContract.runtime)
      try {
        assertFrozenSessionAgentRuntime(workerContract.runtime)
      } catch (error) {
        throw new Error(`Projected worker ${identity.agentID} runtime must be deeply frozen`, { cause: error })
      }
      if (!runtime.model) {
        throw new Error(`Projected worker ${identity.agentID} session-loop runtime requires a resolved model`)
      }
      const descriptor = WorkerTurnDescriptor.get({
        id: identity.workerTurnDescriptorID,
        sessionID,
      })
      if (!descriptor || descriptor.hash !== identity.workerTurnDescriptorHash) {
        throw new Error(`Projected worker ${identity.agentID} runtime contract references a missing descriptor`)
      }
      if (!sameExpertSquadPackageRevision(descriptor.payload.packageRevision, packageRevision)) {
        throw new Error(`Projected worker ${identity.agentID} runtime package revision does not match its descriptor`)
      }
      if (
        descriptor.payload.lifecycle.taskID !== identity.taskID ||
        !ProjectedAgentWorkScope.equals(descriptor.payload.lifecycle.workScope, workScope)
      ) {
        throw new Error(
          `Projected worker ${identity.agentID} runtime contract work scope does not match its descriptor`,
        )
      }
      if (
        descriptor.payload.model.selection !== "explicit" ||
        descriptor.payload.model.providerID !== runtime.model.providerID ||
        descriptor.payload.model.modelID !== runtime.model.modelID
      ) {
        throw new Error(`Projected worker ${identity.agentID} runtime model does not match its worker descriptor`)
      }
    } else if (identity.identityKind === "projected-scheduler") {
      const schedulerIdentity = identity as Extract<
        SessionRuntimeContractIdentity,
        { identityKind: "projected-scheduler" }
      >
      if (
        identity.agentID !== "orchestrator" ||
        identity.baseRole !== "orchestrator" ||
        identity.sessionKind !== "orchestrator" ||
        identity.contractKind !== "orchestrator-wake"
      ) {
        throw new Error("Projected scheduler runtime identity must use the fixed orchestrator contract")
      }
      if (identity.workerTurnDescriptorID || identity.workerTurnDescriptorHash) {
        throw new Error("Projected scheduler runtime identity cannot carry a worker descriptor")
      }
      if (!identity.expertSquadID?.trim() || !/^[a-f0-9]{64}$/.test(identity.projectionHash ?? "")) {
        throw new Error("Projected scheduler runtime contract requires expert-squad ID and projection hash")
      }
      if (typeof identity.taskID !== "string" || !identity.taskID.trim()) {
        throw new Error("Projected scheduler runtime contract requires taskID")
      }
      const hasIngress = Boolean(schedulerIdentity.taskIngressID)
      if (
        hasIngress !== Boolean(schedulerIdentity.taskIngressActivationID) ||
        hasIngress !== Boolean(schedulerIdentity.taskIngressPredecessorID)
      ) {
        throw new Error("Projected scheduler Task ingress identity requires activation and predecessor identities")
      }
      assertHarnessGrants(identity, contract)
      const owner = assertProjectedSkillSurface(
        schedulerIdentity,
        contract,
      ) as PromptProfileResolver.ResolvedProjectedScheduler
      assertProjectedSchedulerToolSurface(owner, contract)
    }
    const current = contracts.get(sessionID)
    if (orchestratorWake(current) && options.consumePendingWake !== true) {
      throw new Error(`SessionRuntimeContract cannot replace staged or pending Orchestrator wake for ${sessionID}`)
    }
    if (consumedRuntimeWakes.has(sessionID) && options.consumePendingWake !== true) {
      throw new Error(`SessionRuntimeContract cannot replace unsettled Orchestrator Turn for ${sessionID}`)
    }
    const snapshot = snapshotRuntimeContract(contract, packageRevision)
    const currentResources = current?.resources
    if (currentResources?.mcp && currentResources.mcp !== snapshot.resources?.mcp) {
      throw new Error(
        `SessionRuntimeContract cannot replace owned MCP resources for ${sessionID}; dispose the installed contract first`,
      )
    }
    if (
      current &&
      sameRuntimeToolOwnerOccurrence(current, snapshot) &&
      currentResources?.tools.owner_revision !== snapshot.resources.tools.owner_revision
    ) {
      throw new Error(
        `SessionRuntimeContract cannot change the exact Tool materializer owner within occurrence ${sessionID}`,
      )
    }
    contracts.set(sessionID, snapshot)
    if (
      snapshot.identity.contractKind === "orchestrator-wake" &&
      snapshot.runOnce === true &&
      options.armWake !== false
    ) {
      armedRuntimeWakes.add(snapshot)
    }
    if (options.notifyWake !== false && pendingWake(snapshot)) notifyWake(sessionID)
    return snapshot
  }

  function assertHarnessGrants(
    identity: SessionRuntimeContractIdentityBase & {
      identityKind: string
      expertSquadID?: string
      projectionHash?: string
      taskID?: unknown
    },
    contract: SessionRuntimeContract,
  ): void {
    const harnessContext = contract.harnessGrants?.context
    if (!harnessContext) {
      throw new Error(`SessionRuntimeContract ${identity.agentID} requires exact Harness grants.`)
    }
    if (contract.harnessGrants.owner_revision !== identity.projectionHash) {
      throw new Error(
        `SessionRuntimeContract ${identity.agentID} Harness owner revision does not match runtime projection hash.`,
      )
    }
    if (harnessContext.kind === "task_scheduler") {
      if (
        identity.identityKind !== "projected-scheduler" ||
        harnessContext.task_id !== identity.taskID ||
        harnessContext.profile_id !== identity.expertSquadID
      ) {
        throw new Error(`Projected scheduler ${identity.agentID} Harness context does not match runtime identity.`)
      }
      return
    }
    if (harnessContext.kind === "task_agent") {
      if (
        identity.identityKind !== "projected-worker" ||
        harnessContext.task_id !== identity.taskID ||
        harnessContext.profile_id !== identity.expertSquadID ||
        harnessContext.agent_id !== identity.agentID
      ) {
        throw new Error(`Projected worker ${identity.agentID} Harness context does not match runtime identity.`)
      }
      return
    }
    throw new Error(`Projected runtime ${identity.agentID} cannot install ${harnessContext.kind} Harness context.`)
  }

  function assertProjectedSkillSurface(
    identity: Extract<SessionRuntimeContractIdentity, { identityKind: "projected-worker" | "projected-scheduler" }>,
    contract: SessionRuntimeContract,
  ): PromptProfileResolver.ResolvedProjectedAgent | PromptProfileResolver.ResolvedProjectedScheduler {
    if (!contract.projectDirectory?.trim()) {
      throw new Error(`Projected skill owner ${identity.agentID} runtime contract requires a project directory`)
    }
    const skillProjection = contract.skillProjection
    if (!skillProjection) {
      throw new Error(
        `Projected skill owner ${identity.agentID} runtime contract requires a turn-owned skill projection`,
      )
    }
    assertRecursivelyFrozen(skillProjection, `Projected skill owner ${identity.agentID} skill projection`)
    if (skillProjection.expertSquadID !== identity.expertSquadID) {
      throw new Error(
        `Projected skill owner ${identity.agentID} runtime expert squad ${identity.expertSquadID} does not match skill projection ${skillProjection.expertSquadID}`,
      )
    }
    const owner =
      identity.identityKind === "projected-scheduler"
        ? skillProjection.projectedScheduler
        : [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents].find(
            (candidate) => candidate.identity.agentID === identity.agentID,
          )
    if (
      !owner ||
      owner.identity.baseRole !== identity.baseRole ||
      owner.identity.sessionKind !== identity.sessionKind ||
      owner.identity.projectionHash !== identity.projectionHash
    ) {
      throw new Error(`Projected skill owner ${identity.agentID} runtime identity does not match turn-owned projection`)
    }
    const projectedRuntimeToolIDs = new Set(runtimeToolOwnerIDs(runtimeToolOwner(contract), "projected"))
    assertExactStringSet(
      harnessGrantedRefs(contract.harnessGrants, "execute")
        .filter((ref) => ref.kind === "tool" && ref.owner_ref === "tool-registry")
        .map((ref) => ref.local_ref),
      owner.builtInToolIDs.filter((toolID) => !projectedRuntimeToolIDs.has(toolID)),
      `Projected skill owner ${identity.agentID} registry tool IDs`,
    )
    assertExactStringSet(
      harnessGrantedRefs(contract.harnessGrants, "execute")
        .filter((ref) => ref.kind === "tool" && ref.owner_ref === `runtime-projection:${identity.agentID}`)
        .map((ref) => ref.local_ref),
      owner.projectedToolIDs.filter((toolID) => projectedRuntimeToolIDs.has(toolID)),
      `Projected skill owner ${identity.agentID} runtime-projection tool IDs`,
    )
    return owner
  }

  function assertExactStringSet(actual: unknown, expected: readonly string[], context: string): void {
    if (!Array.isArray(actual) || actual.some((item) => typeof item !== "string" || item.trim().length === 0)) {
      throw new Error(`${context} must be an array of non-empty strings`)
    }
    if (new Set(actual).size !== actual.length) throw new Error(`${context} must not contain duplicates`)
    const left = [...actual].sort()
    const right = [...expected].sort()
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error(
        `${context} mismatch: expected ${right.join(",") || "<none>"}, found ${left.join(",") || "<none>"}`,
      )
    }
  }

  function runtimeToolOwner(contract: SessionRuntimeContract): RuntimeToolOwner {
    return contract.resources.tools
  }

  function assertProjectedToolKeys(
    owner: PromptProfileResolver.ResolvedProjectedAgent | PromptProfileResolver.ResolvedProjectedScheduler,
    projectedToolIDs: readonly string[],
    context: string,
  ): void {
    const projected = new Set(owner.projectedToolIDs)
    for (const toolID of projectedToolIDs) {
      if (!projected.has(toolID)) throw new Error(`${context} tool ${JSON.stringify(toolID)} is not projected`)
    }
  }

  function assertProjectedWorkerToolSurface(
    dispatchAdapterID: AgentDispatchAdapterID,
    owner: PromptProfileResolver.ResolvedProjectedAgent,
    contract: ProjectedWorkerRuntimeContract,
  ): void {
    const toolOwner = runtimeToolOwner(contract)
    const projectedToolIDs = runtimeToolOwnerIDs(toolOwner, "projected")
    const stageToolIDs = runtimeToolOwnerIDs(toolOwner, "stage")
    assertProjectedToolKeys(owner, projectedToolIDs, `Projected worker ${owner.identity.agentID}`)
    const eagerlyOwnedToolIDs = harnessGrantedRefs(contract.harnessGrants, "execute")
      .filter(
        (ref) =>
          ref.kind === "tool" &&
          (ref.owner_ref === `runtime-projection:${owner.identity.agentID}` ||
            ref.owner_ref === "default-tool-registry"),
      )
      .map((ref) => ref.local_ref)
    assertExactStringSet(
      projectedToolIDs,
      eagerlyOwnedToolIDs,
      `Projected worker ${owner.identity.agentID} runtime owner tool IDs`,
    )
    const projected = new Set(owner.projectedToolIDs)
    const allowedStage = DispatchAdapterContractRegistry.privateStageToolIDSet(dispatchAdapterID)
    for (const toolID of stageToolIDs) {
      if (projected.has(toolID)) {
        throw new Error(
          `Projected worker ${owner.identity.agentID} stage tool ${JSON.stringify(toolID)} overlaps projected capability`,
        )
      }
      if (!allowedStage.has(toolID)) {
        throw new Error(
          `Projected worker ${owner.identity.agentID} stage tool ${JSON.stringify(toolID)} is not part of the ${dispatchAdapterID} dispatch adapter ABI`,
        )
      }
    }
  }

  function assertProjectedSchedulerToolSurface(
    owner: PromptProfileResolver.ResolvedProjectedScheduler,
    contract: SessionRuntimeContract,
  ): void {
    const toolOwner = runtimeToolOwner(contract)
    const projectedToolIDs = runtimeToolOwnerIDs(toolOwner, "projected")
    assertProjectedToolKeys(owner, projectedToolIDs, "Projected scheduler")
    assertExactStringSet(runtimeToolOwnerIDs(toolOwner, "stage"), [], "Projected scheduler stage Tool IDs")
    assertExactStringSet(
      projectedToolIDs,
      harnessGrantedRefs(contract.harnessGrants, "execute")
        .filter(
          (ref) =>
            ref.kind === "tool" &&
            (ref.owner_ref === `runtime-projection:${owner.identity.agentID}` ||
              ref.owner_ref === "default-tool-registry"),
        )
        .map((ref) => ref.local_ref),
      "Projected scheduler runtime owner tool IDs",
    )
  }

  export function get(sessionID: string): SessionRuntimeContract | undefined {
    return contracts.get(sessionID)
  }

  export function clear(sessionID: string): SessionRuntimeContract["resources"] | undefined {
    const ownerOperations = runtimeContractOwnerOperations(sessionID)
    if (ownerOperations.length > 0) {
      throw new Error(`SessionRuntimeContract cannot clear during ${ownerOperations.join(", ")} for ${sessionID}`)
    }
    const resources = contracts.get(sessionID)?.resources
    contracts.delete(sessionID)
    consumedRuntimeWakes.delete(sessionID)
    const waiters = runtimeWakeSettlementWaiters.get(sessionID)
    runtimeWakeSettlementWaiters.delete(sessionID)
    for (const waiting of waiters?.values() ?? []) {
      for (const waiter of waiting) {
        waiter.reject(
          new Error(`SessionRuntimeContract cleared before pending Orchestrator wake settled for ${sessionID}`),
        )
      }
    }
    return resources
  }

  export async function dispose(sessionID: string): Promise<void> {
    const contract = contracts.get(sessionID)
    if (!contract) return
    using _operation = claimOperation(sessionID, contract, "close runtime resources")
    await contract.resources?.mcp.close()
    if (contracts.get(sessionID) !== contract) {
      throw new Error(`SessionRuntimeContract changed while closing runtime resources for ${sessionID}`)
    }
    contracts.delete(sessionID)
  }

  export function claimOperation(
    sessionID: string,
    expectedContract: SessionRuntimeContract | undefined,
    operation: string,
  ): Disposable {
    const normalizedOperation = operation.trim()
    if (!normalizedOperation) throw new Error("Session runtime contract ownership requires an operation")
    if (contracts.get(sessionID) !== expectedContract) {
      throw new Error(`SessionRuntimeContract changed before ${normalizedOperation} for ${sessionID}`)
    }
    const owner = { operation: normalizedOperation, token: Symbol(sessionID) }
    let owners = runtimeContractOwners.get(sessionID)
    if (!owners) {
      owners = new Map()
      runtimeContractOwners.set(sessionID, owners)
    }
    owners.set(owner.token, owner)
    return {
      [Symbol.dispose]: () => {
        const current = runtimeContractOwners.get(sessionID)
        current?.delete(owner.token)
        if (current?.size === 0) runtimeContractOwners.delete(sessionID)
      },
    }
  }

  export function claimMessageWrite(
    sessionID: string,
    expectedContract: SessionRuntimeContract | undefined,
  ): Disposable {
    return claimOperation(sessionID, expectedContract, "message commit")
  }

  export function setAndClaimMessageWrite(
    sessionID: string,
    contract: SessionRuntimeContract,
  ): { contract: SessionRuntimeContract; claim: Disposable } {
    set(sessionID, contract)
    const installed = contracts.get(sessionID)
    if (!installed) throw new Error(`SessionRuntimeContract installation produced no contract for ${sessionID}`)
    return {
      contract: installed,
      claim: claimMessageWrite(sessionID, installed),
    }
  }

  export function subscribeWake(sessionID: string, wake: () => void): () => void {
    let waiters = wakeWaiters.get(sessionID)
    if (!waiters) {
      waiters = new Set()
      wakeWaiters.set(sessionID, waiters)
    }
    waiters.add(wake)
    return () => {
      const current = wakeWaiters.get(sessionID)
      if (!current) return
      current.delete(wake)
      if (current.size === 0) wakeWaiters.delete(sessionID)
    }
  }

  export function hasPendingWake(sessionID: string): boolean {
    return pendingWake(contracts.get(sessionID))
  }

  export function consumeWake(sessionID: string): void {
    const contract = contracts.get(sessionID)
    if (!contract?.runOnce) return
    set(sessionID, { ...contract, runOnce: false }, { consumePendingWake: true })
    consumedRuntimeWakes.set(sessionID, contract)
  }

  export function settleConsumedWake(sessionID: string): void {
    const contract = consumedRuntimeWakes.get(sessionID)
    if (!contract) return
    consumedRuntimeWakes.delete(sessionID)
    settledRuntimeWakes.add(contract)
    const waiters = runtimeWakeSettlementWaiters.get(sessionID)
    const settled = waiters?.get(contract)
    if (!settled) return
    waiters!.delete(contract)
    if (waiters!.size === 0) runtimeWakeSettlementWaiters.delete(sessionID)
    for (const waiter of settled) waiter.resolve()
  }

  export function failConsumedWake(sessionID: string, error: unknown): void {
    const contract =
      consumedRuntimeWakes.get(sessionID) ??
      (orchestratorWake(contracts.get(sessionID)) ? contracts.get(sessionID) : undefined)
    if (!contract) return
    consumedRuntimeWakes.delete(sessionID)
    const failure = error instanceof Error ? error : new Error(String(error))
    failedRuntimeWakes.set(contract, failure)
    const waiters = runtimeWakeSettlementWaiters.get(sessionID)
    const failed = waiters?.get(contract)
    if (!failed) return
    waiters!.delete(contract)
    if (waiters!.size === 0) runtimeWakeSettlementWaiters.delete(sessionID)
    for (const waiter of failed) waiter.reject(failure)
  }

  export function armPendingWake(sessionID: string, expected: SessionRuntimeContract): void {
    if (
      contracts.get(sessionID) !== expected ||
      expected.identity.contractKind !== "orchestrator-wake" ||
      expected.runOnce !== true
    ) {
      throw new Error(`SessionRuntimeContract pending wake identity changed before notification for ${sessionID}`)
    }
    armedRuntimeWakes.add(expected)
    notifyWake(sessionID)
  }

  export function waitForWakeConsumed(sessionID: string, expected: SessionRuntimeContract): Promise<void> {
    if (settledRuntimeWakes.has(expected)) return Promise.resolve()
    const priorFailure = failedRuntimeWakes.get(expected)
    if (priorFailure) return Promise.reject(priorFailure)
    const current = contracts.get(sessionID)
    if (current !== expected) {
      if (!sameRuntimeContractOccurrence(current, expected) || consumedRuntimeWakes.get(sessionID) !== expected) {
        return Promise.reject(
          new Error(`SessionRuntimeContract changed before Orchestrator wake settled for ${sessionID}`),
        )
      }
    }
    return new Promise<void>((resolve, reject) => {
      let byContract = runtimeWakeSettlementWaiters.get(sessionID)
      if (!byContract) {
        byContract = new Map()
        runtimeWakeSettlementWaiters.set(sessionID, byContract)
      }
      let waiters = byContract.get(expected)
      if (!waiters) {
        waiters = new Set()
        byContract.set(expected, waiters)
      }
      const waiter = { resolve, reject }
      waiters.add(waiter)
      if (
        !settledRuntimeWakes.has(expected) &&
        (contracts.get(sessionID) === expected || consumedRuntimeWakes.get(sessionID) === expected)
      ) {
        return
      }
      waiters.delete(waiter)
      if (waiters.size === 0) byContract.delete(expected)
      if (byContract.size === 0) runtimeWakeSettlementWaiters.delete(sessionID)
      const failure = failedRuntimeWakes.get(expected)
      if (failure) reject(failure)
      else if (settledRuntimeWakes.has(expected)) resolve()
      else
        reject(new Error(`SessionRuntimeContract changed while awaiting Orchestrator wake settlement for ${sessionID}`))
    })
  }
}

function assertRecursivelyFrozen(value: unknown, context: string, seen = new WeakSet<object>()): void {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return
  const object = value as object
  if (seen.has(object)) return
  seen.add(object)
  if (!Object.isFrozen(object)) throw new Error(`${context} must be recursively frozen`)
  for (const key of Reflect.ownKeys(object)) {
    assertRecursivelyFrozen((object as Record<PropertyKey, unknown>)[key], context, seen)
  }
}

function snapshotRuntimeContract(
  contract: SessionRuntimeContract,
  packageRevision: PromptProfileResolver.ResolvedPackageRevision,
): SessionRuntimeContract {
  const common = {
    ...contract,
    identity: Object.freeze({
      ...contract.identity,
      packageRevision: Object.freeze({ ...packageRevision }),
    }),
    ...(contract.system
      ? {
          system: typeof contract.system === "function" ? contract.system : Object.freeze([...contract.system]),
        }
      : {}),
    ...(contract.stream ? { stream: Object.freeze({ ...contract.stream }) } : {}),
    resources: Object.freeze({ ...contract.resources }),
  }
  return Object.freeze(common) as SessionRuntimeContract
}

export function sessionRuntimeToolOwner(contract: SessionRuntimeContract | undefined): RuntimeToolOwner | undefined {
  return contract?.resources.tools
}

export function assertSessionLoopRuntimeContract(contract: SessionRuntimeContract | undefined, context: string): void {
  if (contract?.identity.identityKind !== "projected-worker") return
}
