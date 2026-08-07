import { AgentRoleContract } from "@/agent/role-contract"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { SESSION_KINDS, type SessionKind } from "./session.sql"

function contractForSessionKind(kind: SessionKind) {
  return AgentRoleContract.isRoleID(kind) ? AgentRoleContract.get(kind) : undefined
}

function filterSessionKinds(
  predicate: (kind: SessionKind, contract: ReturnType<typeof contractForSessionKind>) => boolean,
): readonly SessionKind[] {
  return SESSION_KINDS.filter((kind) => predicate(kind, contractForSessionKind(kind)))
}

const runtimeTemplateContracts = RuntimeTemplateRegistry.ids.map((id) => {
  const contract = RuntimeTemplateRegistry.get(id)
  return {
    contract,
    sessionKind: DispatchAdapterContractRegistry.get(contract.dispatchAdapterID).sessionKind,
  }
})

function templateSessionKinds(
  predicate: (contract: (typeof runtimeTemplateContracts)[number]["contract"]) => boolean,
): readonly SessionKind[] {
  return [
    ...new Set(
      runtimeTemplateContracts.filter((entry) => predicate(entry.contract)).map((entry) => entry.sessionKind),
    ),
  ]
}

export namespace AgentRuntimeMetadata {
  export const AGENT_OWNED_SESSION_KINDS = [
    ...new Set([
      ...filterSessionKinds((kind, contract) => contract?.sessionKind === kind),
      ...templateSessionKinds(() => true),
    ]),
  ]

  export const RUNTIME_CONTRACT_REQUIRED_AGENT_KINDS = templateSessionKinds(() => true)

  export const EXACT_RUNTIME_CONTRACT_AGENT_KINDS = templateSessionKinds((contract) => contract.exactRuntimeContract)

  export const AGENT_OWNED_SESSION_KIND_SET = new Set<SessionKind>(AGENT_OWNED_SESSION_KINDS)
  export const RUNTIME_CONTRACT_REQUIRED_AGENT_KIND_SET = new Set<SessionKind>(RUNTIME_CONTRACT_REQUIRED_AGENT_KINDS)
  export const EXACT_RUNTIME_CONTRACT_AGENT_KIND_SET = new Set<SessionKind>(EXACT_RUNTIME_CONTRACT_AGENT_KINDS)
}
