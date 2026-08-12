import { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { SessionRuntimeContractMissingError } from "./runtime-contract-error"
import { AgentRuntimeMetadata } from "./agent-runtime-metadata"
import {
  isProjectedWorkerRuntimeContract,
  sessionRuntimeToolRecords,
  SessionRuntimeContractStore,
  type SessionRuntimeContract,
  type SessionRuntimeContractKind,
} from "./runtime-contract"
import type { SessionKind } from "./session.sql"

export function sessionKindRequiresRuntimeContract(sessionKind: string | undefined): boolean {
  return !!sessionKind && AgentRuntimeMetadata.RUNTIME_CONTRACT_REQUIRED_AGENT_KIND_SET.has(sessionKind as SessionKind)
}

export interface SessionRuntimeContractContinuationExpectation {
  sessionID: string
  expectedSessionKind?: string
  expectedAgentID?: string
  expectedTaskID?: string
  expectedContractKind?: SessionRuntimeContractKind
  expectedAttemptID?: string
  expectedWorkerTurnDescriptor?: {
    id: string
    hash: string
  }
  expectedModel?: {
    providerID: string
    modelID: string
  }
  expectedResultMode?: "reply" | "summary"
  requireWorkerTurnDescriptor?: boolean
  requireRuntimeContract?: boolean
}

export function validateSessionRuntimeContractForContinuation(
  input: SessionRuntimeContractContinuationExpectation,
): SessionRuntimeContract | undefined {
  const contract = SessionRuntimeContractStore.get(input.sessionID)
  if (!contract) {
    if (input.requireRuntimeContract) {
      throw new SessionRuntimeContractMissingError({
        message: `SessionRuntimeContract missing for ${input.sessionID}`,
        sessionID: input.sessionID,
        ...(input.expectedAgentID ? { agentID: input.expectedAgentID } : {}),
        ...(input.expectedSessionKind ? { sessionKind: input.expectedSessionKind } : {}),
        reason: "missing",
      })
    }
    return undefined
  }

  const identity = contract.identity
  if (identity.sessionID !== input.sessionID) {
    throw new Error(`SessionRuntimeContract stale for ${input.sessionID}: identity session is ${identity.sessionID}`)
  }

  if (input.expectedAgentID && identity.agentID !== input.expectedAgentID) {
    throw new Error(
      `SessionRuntimeContract agent mismatch for ${input.sessionID}: expected ${input.expectedAgentID}, found ${identity.agentID}`,
    )
  }
  if (input.expectedSessionKind && identity.sessionKind !== input.expectedSessionKind) {
    throw new Error(
      `SessionRuntimeContract session kind mismatch for ${input.sessionID}: expected ${input.expectedSessionKind}, found ${identity.sessionKind}`,
    )
  }
  if (input.expectedTaskID !== undefined && identity.taskID !== input.expectedTaskID) {
    throw new Error(
      `SessionRuntimeContract task mismatch for ${input.sessionID}: expected ${input.expectedTaskID}, found ${identity.taskID}`,
    )
  }
  if (input.expectedContractKind && identity.contractKind !== input.expectedContractKind) {
    throw new Error(
      `SessionRuntimeContract kind mismatch for ${input.sessionID}: expected ${input.expectedContractKind}, found ${identity.contractKind}`,
    )
  }
  if (
    Object.prototype.hasOwnProperty.call(input, "expectedAttemptID") &&
    identity.attemptID !== input.expectedAttemptID
  ) {
    throw new Error(
      `SessionRuntimeContract attempt mismatch for ${input.sessionID}: expected ${input.expectedAttemptID ?? "<unset>"}, found ${identity.attemptID ?? "<unset>"}`,
    )
  }
  const expectedWorkerTurnDescriptor =
    input.expectedWorkerTurnDescriptor ??
    (identity.workerTurnDescriptorID && identity.workerTurnDescriptorHash
      ? { id: identity.workerTurnDescriptorID, hash: identity.workerTurnDescriptorHash }
      : undefined)
  if (
    input.requireWorkerTurnDescriptor &&
    identity.contractKind !== "orchestrator-wake" &&
    !expectedWorkerTurnDescriptor
  ) {
    throw new SessionRuntimeContractMissingError({
      message: `SessionRuntimeContract worker descriptor missing for ${input.sessionID}: runtime-required continuations must carry descriptor id/hash`,
      sessionID: input.sessionID,
      ...(input.expectedAgentID ? { agentID: input.expectedAgentID } : {}),
      ...(input.expectedSessionKind ? { sessionKind: input.expectedSessionKind } : {}),
      reason: "missing",
    })
  }
  if (expectedWorkerTurnDescriptor) {
    if (identity.workerTurnDescriptorID !== expectedWorkerTurnDescriptor.id) {
      throw new Error(
        `SessionRuntimeContract worker descriptor mismatch for ${input.sessionID}: expected ${expectedWorkerTurnDescriptor.id}, found ${identity.workerTurnDescriptorID ?? "<unset>"}`,
      )
    }
    if (identity.workerTurnDescriptorHash !== expectedWorkerTurnDescriptor.hash) {
      throw new Error(
        `SessionRuntimeContract worker descriptor hash mismatch for ${input.sessionID}: expected ${expectedWorkerTurnDescriptor.hash}, found ${identity.workerTurnDescriptorHash ?? "<unset>"}`,
      )
    }
    const descriptor = WorkerTurnDescriptor.get({
      id: expectedWorkerTurnDescriptor.id,
      sessionID: input.sessionID,
    })
    if (!descriptor) {
      throw new SessionRuntimeContractMissingError({
        message: `SessionRuntimeContract worker descriptor missing for ${input.sessionID}: ${expectedWorkerTurnDescriptor.id}`,
        sessionID: input.sessionID,
        ...(input.expectedAgentID ? { agentID: input.expectedAgentID } : {}),
        ...(input.expectedSessionKind ? { sessionKind: input.expectedSessionKind } : {}),
        reason: "missing",
      })
    }
    if (descriptor.hash !== expectedWorkerTurnDescriptor.hash) {
      throw new Error(
        `SessionRuntimeContract worker descriptor stored hash mismatch for ${input.sessionID}: expected ${expectedWorkerTurnDescriptor.hash}, found ${descriptor.hash}`,
      )
    }
    if (identity.identityKind !== "projected-worker") {
      throw new Error(
        `SessionRuntimeContract worker descriptor is attached to native identity ${(identity as { agentID: string }).agentID}`,
      )
    }
    if (descriptor.payload.identity.agentID !== identity.agentID) {
      throw new Error(
        `SessionRuntimeContract worker descriptor agent mismatch for ${input.sessionID}: expected ${identity.agentID}, found ${descriptor.payload.identity.agentID}`,
      )
    }
    if (descriptor.payload.identity.baseRole !== identity.baseRole) {
      throw new Error(
        `SessionRuntimeContract worker descriptor base role mismatch for ${input.sessionID}: expected ${identity.baseRole}, found ${descriptor.payload.identity.baseRole}`,
      )
    }
    if (descriptor.payload.identity.sessionKind !== identity.sessionKind) {
      throw new Error(
        `SessionRuntimeContract worker descriptor session kind mismatch for ${input.sessionID}: expected ${identity.sessionKind}, found ${descriptor.payload.identity.sessionKind}`,
      )
    }
    if (descriptor.payload.identity.dispatchAdapterID !== identity.dispatchAdapterID) {
      throw new Error(
        `SessionRuntimeContract worker descriptor dispatch adapter mismatch for ${input.sessionID}: expected ${identity.dispatchAdapterID}, found ${descriptor.payload.identity.dispatchAdapterID}`,
      )
    }
    if (descriptor.payload.identity.projectionHash !== identity.projectionHash) {
      throw new Error(
        `SessionRuntimeContract worker descriptor projection hash mismatch for ${input.sessionID}: expected ${identity.projectionHash}, found ${descriptor.payload.identity.projectionHash}`,
      )
    }
    if (descriptor.payload.expertSquadID !== identity.expertSquadID) {
      throw new Error(
        `SessionRuntimeContract worker descriptor expert squad mismatch for ${input.sessionID}: expected ${identity.expertSquadID}, found ${descriptor.payload.expertSquadID}`,
      )
    }
    if (
      descriptor.payload.lifecycle.taskID !== identity.taskID ||
      !ProjectedAgentWorkScope.equals(descriptor.payload.lifecycle.workScope, identity.workScope)
    ) {
      throw new Error(`SessionRuntimeContract worker descriptor work scope mismatch for ${input.sessionID}`)
    }
    if (descriptor.payload.lifecycle.attemptID !== identity.attemptID) {
      throw new Error(
        `SessionRuntimeContract worker descriptor attempt mismatch for ${input.sessionID}: expected ${identity.attemptID ?? "<unset>"}, found ${descriptor.payload.lifecycle.attemptID ?? "<unset>"}`,
      )
    }
    if (
      input.expectedModel &&
      (descriptor.payload.model.selection !== "explicit" ||
        descriptor.payload.model.providerID !== input.expectedModel.providerID ||
        descriptor.payload.model.modelID !== input.expectedModel.modelID)
    ) {
      const foundModel =
        descriptor.payload.model.selection === "explicit"
          ? `${descriptor.payload.model.providerID}/${descriptor.payload.model.modelID}`
          : `${descriptor.payload.model.providerID}/<provider-default>`
      throw new Error(
        `SessionRuntimeContract worker descriptor model mismatch for ${input.sessionID}: expected ${input.expectedModel.providerID}/${input.expectedModel.modelID}, found ${foundModel}`,
      )
    }
    if (input.expectedResultMode && descriptor.payload.output.resultMode !== input.expectedResultMode) {
      throw new Error(
        `SessionRuntimeContract worker descriptor result mode mismatch for ${input.sessionID}: expected ${input.expectedResultMode}, found ${descriptor.payload.output.resultMode}`,
      )
    }
    const descriptorTools = [...descriptor.payload.tools.enabled].sort()
    const records = sessionRuntimeToolRecords(contract)
    const contractToolSet = new Set(Object.keys({ ...records.projectedTools, ...records.stageTools }))
    if (isProjectedWorkerRuntimeContract(contract) && contract.permissionContinuation) {
      const requestedStageTool = descriptor.payload.tools.stageOwned.includes(contract.permissionContinuation.toolName)
      if (requestedStageTool && !Object.hasOwn(records.stageTools, contract.permissionContinuation.toolName)) {
        throw new Error(
          `SessionRuntimeContract permission continuation Tool ${contract.permissionContinuation.toolName} is not materialized`,
        )
      }
      for (const stageToolID of descriptor.payload.tools.stageOwned) contractToolSet.add(stageToolID)
    }
    const contractTools = [...contractToolSet].sort()
    if (JSON.stringify(descriptorTools) !== JSON.stringify(contractTools)) {
      throw new Error(
        `SessionRuntimeContract worker descriptor tools mismatch for ${input.sessionID}: expected ${descriptorTools.join(",") || "<none>"}, found ${contractTools.join(",") || "<none>"}`,
      )
    }
  }
  return contract
}
