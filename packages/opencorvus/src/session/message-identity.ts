import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { PrimaryAssistantRegistry, type PrimaryAssistantID } from "@/agent/primary-assistant-registry"
import { AgentRoleContract } from "@/agent/role-contract"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { sessionRuntimeFromNativeAgent, type SessionAgentRuntime } from "@/agent/session-agent-runtime"
import type { Config } from "@/config/config"
import type { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import type { SessionKind } from "@/session/session.sql"
import {
  SessionRuntimeContractStore,
  isProjectedSchedulerRuntimeContract,
  isProjectedWorkerRuntimeContract,
  type SessionRuntimeContract,
} from "@/session/runtime-contract"

export type SessionMessageIdentity = {
  agentID: string
  baseRole: string
  runtime: SessionAgentRuntime
  runtimeContract?: SessionRuntimeContract
}

async function requirePrimaryRuntime(agentID: PrimaryAssistantID, config: Config.Info): Promise<SessionAgentRuntime> {
  return sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get(agentID, { config }))
}

async function requireHostRuntime(config: Config.Info): Promise<SessionAgentRuntime> {
  return sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config }))
}

export async function resolveSessionMessageIdentity(input: {
  session: Session.Info
  requestedAgentID?: string
  config: Config.Info
}): Promise<SessionMessageIdentity> {
  const runtimeContract = SessionRuntimeContractStore.get(input.session.id)
  if (runtimeContract) {
    const identity = runtimeContract.identity
    if (!input.requestedAgentID) {
      throw new Error(`Session message runtime contract requires explicit agentID ${identity.agentID}`)
    }
    const validated = SessionLoop.validateSessionRuntimeContractForContinuation({
      sessionID: input.session.id,
      expectedAgentID: input.requestedAgentID,
      expectedSessionKind: input.session.kind,
      requireRuntimeContract: true,
      requireWorkerTurnDescriptor: identity.identityKind === "projected-worker",
    })
    if (!validated) throw new Error(`Session message runtime contract disappeared for ${input.session.id}`)
    const runtime = isProjectedWorkerRuntimeContract(validated)
      ? validated.runtime
      : isProjectedSchedulerRuntimeContract(validated)
        ? await requireHostRuntime(input.config)
        : (() => {
            throw new Error("Unknown session runtime identity kind")
          })()
    return {
      agentID: validated.identity.agentID,
      baseRole: validated.identity.baseRole,
      runtime,
      runtimeContract: validated,
    }
  }

  return resolveNativeSessionMessageIdentity({
    sessionID: input.session.id,
    sessionKind: input.session.kind,
    requestedAgentID: input.requestedAgentID,
    config: input.config,
  })
}

export async function resolveNativeSessionMessageIdentity(input: {
  sessionID: string
  sessionKind: SessionKind
  requestedAgentID?: string
  config: Config.Info
}): Promise<SessionMessageIdentity> {
  if (RuntimeTemplateRegistry.isWorkerSessionKind(input.sessionKind)) {
    throw new Error(`Session message runtime contract missing for ${input.sessionID} (${input.sessionKind})`)
  }
  if (AgentRoleContract.isRoleID(input.sessionKind)) {
    const fixedRole = AgentRoleContract.get(input.sessionKind)
    if (fixedRole.sessionKind === input.sessionKind) {
      if (fixedRole.runtimeContractRequired) {
        throw new Error(`Session message runtime contract missing for ${input.sessionID} (${input.sessionKind})`)
      }
      if (input.requestedAgentID && input.requestedAgentID !== fixedRole.id) {
        throw new Error(
          `Session message agent mismatch for fixed ${input.sessionKind} session: expected ${fixedRole.id}, found ${input.requestedAgentID}`,
        )
      }
      if (!PrimaryAssistantRegistry.isID(fixedRole.id)) {
        throw new Error(`Fixed session ${input.sessionKind} does not resolve to a primary assistant`)
      }
      return {
        agentID: fixedRole.id,
        baseRole: fixedRole.id,
        runtime: await requirePrimaryRuntime(fixedRole.id, input.config),
      }
    }
  }

  const agentID = input.requestedAgentID ?? (await PrimaryAssistantRegistry.defaultID({ config: input.config }))
  if (!PrimaryAssistantRegistry.isID(agentID)) {
    throw new Error(`Session message agent ${agentID} is not a primary assistant`)
  }
  const role = AgentRoleContract.get(agentID)
  if (role.sessionKind !== null && role.sessionKind !== input.sessionKind) {
    throw new Error(`Session message agent ${agentID} requires ${role.sessionKind} session, found ${input.sessionKind}`)
  }
  return {
    agentID,
    baseRole: agentID,
    runtime: await requirePrimaryRuntime(agentID, input.config),
  }
}
