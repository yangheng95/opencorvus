import { ProjectedAgentWorkScopeSchema, type ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { ProjectedWorkerIdentitySchema, type ProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { EngineArtifactTable, type EngineMetadata } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import type { Database } from "@/storage/db"
import { and, asc, eq, sql } from "drizzle-orm"
import z from "zod"
import { SelectedWorkflowBindingSchema, type SelectedWorkflowBinding } from "./workflow-binding"

export interface DispatchLineagePayload extends EngineMetadata {
  dispatch_id: string
  task_id: string
  orchestrator_session_id: string
  orchestrator_message_id: string
  tool_part_id: string
  tool_call_id: string
  tool_name: "dispatch_agent" | "dispatch_agents"
  collection_member_index?: number
  collection_member_count?: number
  child_session_id: string
  target_agent_id: string
  projected_worker_identity: ProjectedWorkerIdentity
  work_scope: ProjectedAgentWorkScope
  delivery_slice_revision_ids: string[]
  workflow_binding: SelectedWorkflowBinding
  workflow_node_id: string | null
  workflow_occurrence_id: string
  coordination_action_id?: string
  continuation_of_dispatch_id?: string
  delivery_owner: DispatchDeliveryOwner
  adapter_input: Record<string, unknown>
  time_created: number
}

export const DispatchDeliveryOwnerSchema = z
  .object({
    kind: z.literal("runtime_process"),
    process_occurrence_id: z.string().min(1),
  })
  .strict()

export type DispatchDeliveryOwner = z.infer<typeof DispatchDeliveryOwnerSchema>

export interface DispatchLineageRow {
  artifactID: string
  taskID: string
  dispatchID: string
  payload: DispatchLineagePayload
  timeCreated: number
}

const DispatchLineagePayloadSchema = z
  .object({
    dispatch_id: z.string().min(1),
    task_id: z.string().min(1),
    orchestrator_session_id: z.string().min(1),
    orchestrator_message_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_name: z.enum(["dispatch_agent", "dispatch_agents"]),
    collection_member_index: z.number().int().min(0).optional(),
    collection_member_count: z.number().int().min(1).optional(),
    child_session_id: z.string().min(1),
    target_agent_id: z.string().min(1),
    projected_worker_identity: ProjectedWorkerIdentitySchema,
    work_scope: ProjectedAgentWorkScopeSchema,
    delivery_slice_revision_ids: z.array(Identifier.schema("goal")),
    workflow_binding: SelectedWorkflowBindingSchema,
    workflow_node_id: z.string().min(1).nullable(),
    workflow_occurrence_id: z.string().min(1),
    coordination_action_id: z.string().min(1).optional(),
    continuation_of_dispatch_id: z.string().min(1).optional(),
    delivery_owner: DispatchDeliveryOwnerSchema,
    adapter_input: z.record(z.string(), z.unknown()),
    time_created: z.number().positive(),
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.tool_name === "dispatch_agent") {
      if (payload.collection_member_index !== undefined || payload.collection_member_count !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["tool_name"],
          message: "direct dispatch_agent lineage cannot carry collection member identity",
        })
      }
    } else if (payload.collection_member_index === undefined || payload.collection_member_count === undefined) {
      context.addIssue({
        code: "custom",
        path: ["collection_member_index"],
        message: "dispatch_agents lineage requires exact collection member index and count",
      })
    } else if (payload.collection_member_index >= payload.collection_member_count) {
      context.addIssue({
        code: "custom",
        path: ["collection_member_index"],
        message: "collection member index must be smaller than collection member count",
      })
    }
    const hasContinuation = payload.continuation_of_dispatch_id !== undefined
    const hasCoordination = payload.coordination_action_id !== undefined
    if (hasCoordination && !hasContinuation) {
      context.addIssue({
        code: "custom",
        path: ["coordination_action_id"],
        message: "coordination redispatch lineage requires its exact source dispatch",
      })
    }
    if (!hasContinuation && payload.workflow_occurrence_id !== payload.dispatch_id) {
      context.addIssue({
        code: "custom",
        path: ["workflow_occurrence_id"],
        message: "initial dispatch lineage must own its workflow occurrence identity",
      })
    }
    if (payload.workflow_binding.kind === "direct") {
      if (payload.workflow_node_id !== null) {
        context.addIssue({
          code: "custom",
          path: ["workflow_node_id"],
          message: "direct dispatch lineage cannot claim a workflow node",
        })
      }
      return
    }
    const node = payload.workflow_binding.nodes.find((candidate) => candidate.node_id === payload.workflow_node_id)
    if (!node) {
      context.addIssue({
        code: "custom",
        path: ["workflow_node_id"],
        message: "virtual workflow lineage must select one declared node",
      })
    } else if (node.agent_id !== payload.target_agent_id) {
      context.addIssue({
        code: "custom",
        path: ["target_agent_id"],
        message: "virtual workflow lineage target must match the selected node agent",
      })
    }
  })

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return Object.freeze(value)
}

export function freezeDispatchAdapterInput(input: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const parsed = z.record(z.string(), z.unknown()).parse(input)
  return deepFreeze(structuredClone(parsed))
}

export function parseDispatchLineagePayload(payload: unknown, artifactID: string): DispatchLineagePayload {
  const parsed = DispatchLineagePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`Invalid dispatch_lineage artifact ${artifactID}: ${parsed.error.message}`)
  }
  return deepFreeze({
    ...parsed.data,
    adapter_input: freezeDispatchAdapterInput(parsed.data.adapter_input),
  }) as DispatchLineagePayload
}

export function dispatchLineageRow(row: typeof EngineArtifactTable.$inferSelect): DispatchLineageRow {
  const payload = parseDispatchLineagePayload(row.payload, row.id)
  if (payload.task_id !== row.task_id) {
    throw new Error(`Invalid dispatch_lineage artifact ${row.id}: payload Task ${payload.task_id} != ${row.task_id}`)
  }
  return {
    artifactID: row.id,
    taskID: row.task_id,
    dispatchID: payload.dispatch_id,
    payload,
    timeCreated: row.time_created,
  }
}

export function findDispatchLineageByDispatchIDInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  dispatchID: string
}): DispatchLineageRow | undefined {
  const matches = input.db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "dispatch_lineage"),
        sql`json_extract(${EngineArtifactTable.payload}, '$.dispatch_id') = ${input.dispatchID}`,
      ),
    )
    .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
    .all()
    .map(dispatchLineageRow)
  if (matches.length > 1) {
    throw new Error(`Dispatch identity ${input.dispatchID} has ${matches.length} lineages in Task ${input.taskID}`)
  }
  return matches[0]
}
