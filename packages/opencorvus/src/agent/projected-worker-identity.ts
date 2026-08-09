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

const CONTINUATION_EXECUTION_IDENTITY_FIELDS = [
  "agentID",
  "baseRole",
  "sessionKind",
  "dispatchAdapterID",
  "runtimeTemplateABIVersion",
  "dispatchAdapterABIVersion",
] as const satisfies readonly (keyof ProjectedWorkerIdentity)[]

export type ProjectedWorkerContinuationIdentityField = (typeof CONTINUATION_EXECUTION_IDENTITY_FIELDS)[number]

export interface ProjectedWorkerContinuationIdentityDifference {
  field: ProjectedWorkerContinuationIdentityField
  previous: ProjectedWorkerIdentity[ProjectedWorkerContinuationIdentityField]
  current: ProjectedWorkerIdentity[ProjectedWorkerContinuationIdentityField]
}

export class ProjectedWorkerContinuationIncompatibleError extends Error {
  override readonly name = "ProjectedWorkerContinuationIncompatibleError"

  constructor(
    readonly subject: string,
    readonly differences: readonly ProjectedWorkerContinuationIdentityDifference[],
  ) {
    super(
      `${subject} is incompatible with the current projected worker execution contract: ${differences
        .map((difference) => `${difference.field}=${difference.previous}->${difference.current}`)
        .join(", ")}`,
    )
  }
}

/**
 * Successor Turns may record a new projection hash, model, and complete system
 * prompt. They can reuse an existing physical worker Session only while its
 * stable worker identity and both execution ABIs remain exact.
 */
export function assertProjectedWorkerContinuationCompatible(input: {
  previous: ProjectedWorkerIdentity
  current: ProjectedWorkerIdentity
  subject: string
}): void {
  const differences = CONTINUATION_EXECUTION_IDENTITY_FIELDS.flatMap((field) =>
    input.previous[field] === input.current[field]
      ? []
      : [
          {
            field,
            previous: input.previous[field],
            current: input.current[field],
          } satisfies ProjectedWorkerContinuationIdentityDifference,
        ],
  )
  if (differences.length > 0) {
    throw new ProjectedWorkerContinuationIncompatibleError(input.subject, differences)
  }
}

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
