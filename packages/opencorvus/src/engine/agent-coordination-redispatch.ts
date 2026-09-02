import z from "zod"
import { Identifier } from "@/id/id"
import { ProjectedWorkerBindingSchema } from "@/agent/projected-worker-binding"
import { SelectedWorkflowBindingSchema } from "./workflow-binding"

export const AgentCoordinationRedispatchBindingSchema = ProjectedWorkerBindingSchema.safeExtend({
  sourceDispatchLineageID: z.string().min(1),
  sourceDispatchID: z.string().min(1),
  workflowBinding: SelectedWorkflowBindingSchema,
  workflowNodeID: z.string().min(1).nullable(),
  workflowOccurrenceID: z.string().min(1),
  deliverySliceRevisionIDs: z.array(Identifier.schema("goal")),
}).strict()

export type AgentCoordinationRedispatchBinding = z.infer<typeof AgentCoordinationRedispatchBindingSchema>
