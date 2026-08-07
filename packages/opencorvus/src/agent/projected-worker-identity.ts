import z from "zod"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import { RuntimeTemplateID, type RuntimeTemplateID as RuntimeTemplateIDValue } from "@/agent/runtime-template-id"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import type { SessionKind } from "@/session/session.sql"
import { SESSION_KINDS } from "@/session/session.sql"
import { DynamicAgentIDSchema } from "@/agent/dynamic-agent-id"

const RuntimeTemplateIDSchema = z.custom<RuntimeTemplateIDValue>(
  (value) => typeof value === "string" && RuntimeTemplateID.ids.includes(value as RuntimeTemplateIDValue),
  "unknown runtime template",
)

const SessionKindSchema = z.enum(SESSION_KINDS) satisfies z.ZodType<SessionKind>

const DispatchAdapterIDSchema = z.custom<AgentDispatchAdapterID>(
  (value) => typeof value === "string" && DispatchAdapterContractRegistry.isID(value),
  "unknown dispatch adapter",
)

export const ProjectedWorkerIdentitySchema = z
  .object({
    agentID: DynamicAgentIDSchema,
    baseRole: RuntimeTemplateIDSchema,
    sessionKind: SessionKindSchema,
    dispatchAdapterID: DispatchAdapterIDSchema,
    runtimeTemplateABIVersion: z.literal(1),
    dispatchAdapterABIVersion: z.literal(1),
    projectionHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((identity, ctx) => {
    const contract = RuntimeTemplateRegistry.get(identity.baseRole)
    const adapter = DispatchAdapterContractRegistry.get(contract.dispatchAdapterID)
    if (adapter.sessionKind !== identity.sessionKind) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionKind"],
        message: `base role ${identity.baseRole} requires session kind ${adapter.sessionKind}`,
      })
    }
    if (contract.dispatchAdapterID !== identity.dispatchAdapterID) {
      ctx.addIssue({
        code: "custom",
        path: ["dispatchAdapterID"],
        message: `base role ${identity.baseRole} requires dispatch adapter ${contract.dispatchAdapterID}`,
      })
    }
    if (contract.templateABIVersion !== identity.runtimeTemplateABIVersion) {
      ctx.addIssue({
        code: "custom",
        path: ["runtimeTemplateABIVersion"],
        message: `runtime template ${identity.baseRole} requires ABI ${contract.templateABIVersion}`,
      })
    }
    if (adapter.abiVersion !== identity.dispatchAdapterABIVersion) {
      ctx.addIssue({
        code: "custom",
        path: ["dispatchAdapterABIVersion"],
        message: `dispatch adapter ${identity.dispatchAdapterID} requires ABI ${adapter.abiVersion}`,
      })
    }
  })

export type ProjectedWorkerIdentity = z.output<typeof ProjectedWorkerIdentitySchema>

export function sameProjectedWorkerIdentity(left: ProjectedWorkerIdentity, right: ProjectedWorkerIdentity): boolean {
  return (
    left.agentID === right.agentID &&
    left.baseRole === right.baseRole &&
    left.sessionKind === right.sessionKind &&
    left.dispatchAdapterID === right.dispatchAdapterID &&
    left.runtimeTemplateABIVersion === right.runtimeTemplateABIVersion &&
    left.dispatchAdapterABIVersion === right.dispatchAdapterABIVersion &&
    left.projectionHash === right.projectionHash
  )
}
