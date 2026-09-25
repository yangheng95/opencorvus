import z from "zod"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference"
import { MissionAcceptanceGapSchema } from "@/mission/acceptance-gap"
import { ArtifactLocatorSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { ActiveTaskExecutionReferenceSchema } from "@/engine/task-artifact-observation"

export const PanelTaskAcceptanceLedger = z
  .object({
    artifact_id: z.string().min(1),
    revision: z.number().int().positive(),
    execution_epoch: z.number().int().positive(),
    previous_revision_artifact_id: z.string().min(1).nullable(),
    gap: MissionAcceptanceGapSchema,
  })
  .strict()

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
export const PanelQueryTaskErrorRow = z
  .object({
    taskID: z.string(),
    error: z.string(),
  })
  .strict()
export const PanelQueryTaskListRow = z
  .object({
    taskID: z.string(),
    title: z.string(),
    status: PanelTaskStatus,
  })
  .strict()
export const PanelQueryTaskSummaryRow = PanelQueryTaskListRow.extend({
  created: z.number().optional(),
  started: z.number(),
  completed: z.number().optional(),
  error: z.string().optional(),
  result: PanelTaskResult,
  pendingInteractions: z.number().int().nonnegative().optional(),
  terminal_lifecycle_reference: TerminalLifecycleReferenceSchema.optional(),
  active_execution_reference: ActiveTaskExecutionReferenceSchema.optional(),
  acceptance_ledger: PanelTaskAcceptanceLedger.optional(),
  board: z.object({ headline: z.string().optional(), summary: z.string().optional() }).optional(),
  plan: z
    .object({
      goals: z.array(
        z.object({
          title: z.string(),
          accepted: z.boolean(),
          activeSessionIDs: z.array(z.string()),
          reviewCount: z.number().int().nonnegative(),
        }),
      ),
      artifacts: z.array(z.object({ kind: z.string(), locator: ArtifactLocatorSchema })),
    })
    .optional(),
})
export const PanelQueryTaskRow = z.union([PanelQueryTaskSummaryRow, PanelQueryTaskErrorRow, PanelQueryTaskListRow])
export const PanelQueryTaskOutput = z.object({
  tasks: z.array(PanelQueryTaskRow),
})
