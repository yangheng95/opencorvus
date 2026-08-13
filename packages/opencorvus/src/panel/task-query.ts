import z from "zod"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference"

export const PanelTaskStatus = z.enum(["active", "completed", "failed", "cancelled"])
export const PanelTaskFailureResult = z.object({
  source: z.string().optional(),
  title: z.string().optional(),
  summary: z.string(),
})
export const PanelTaskResult = z.object({
  status: PanelTaskStatus,
  summary: z.string(),
  failure: PanelTaskFailureResult.optional(),
})
export const PanelQueryTaskErrorRow = z.object({
  taskID: z.string(),
  error: z.string(),
})
export const PanelQueryTaskSummaryRow = z.object({
  taskID: z.string(),
  title: z.string(),
  status: PanelTaskStatus,
  created: z.number().optional(),
  started: z.number(),
  completed: z.number().optional(),
  error: z.string().optional(),
  result: PanelTaskResult,
  pendingInteractions: z.number().int().nonnegative().optional(),
  terminal_lifecycle_reference: TerminalLifecycleReferenceSchema.optional(),
})
export const PanelQueryTaskRow = z.union([PanelQueryTaskSummaryRow, PanelQueryTaskErrorRow])
export const PanelQueryTaskOutput = z.object({
  tasks: z.array(PanelQueryTaskRow),
})
