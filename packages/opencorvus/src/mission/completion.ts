import z from "zod"
import { ArtifactReadLocatorSchema, ArtifactReadReferenceSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"

export const MissionCompletionTaskAcceptanceInput = z
  .object({
    task_id: z.string().min(1).describe("Current child Task accepted by this Mission decision."),
    evidence_read_refs: z
      .array(
        ArtifactReadReferenceSchema.describe(
          "Host-minted reference to one persisted read chunk in this Mission Session for the Task's exact current terminal occurrence.",
        ),
      )
      .min(1)
      .max(64)
      .describe(
        "Complete supplied reference set whose persisted chunks cover every byte of each accepted Artifact in this Task's exact current terminal occurrence.",
      ),
  })
  .strict()

export const MissionCompletionTaskAcceptance = z
  .object({
    task_id: z.string().min(1),
    evidence_locators: z.array(ArtifactReadLocatorSchema).min(1).max(64),
    terminal_lifecycle_reference: TerminalLifecycleReferenceSchema.describe(
      "Exact current completed occurrence bound to every accepted complete Artifact read.",
    ),
  })
  .strict()

export const MissionCompletionInput = z.object({
  summary: z.string().trim().min(1).max(4_000).describe("Concise user-facing summary of the accepted Mission outcome."),
  task_acceptances: z
    .array(MissionCompletionTaskAcceptanceInput)
    .max(128)
    .describe(
      "Complete current Mission child-Task acceptance set. Empty is valid only when Mission completed bounded coordination without child Tasks.",
    ),
})

export const MissionCompletionActionInput = MissionCompletionInput.extend({
  action: z.literal("complete_mission"),
}).strict()

export const MissionCompletionReceipt = z
  .object({
    summary: MissionCompletionInput.shape.summary,
    task_acceptances: z.array(MissionCompletionTaskAcceptance).max(128),
    kind: z.literal("mission_completed"),
    mission_id: z.string().min(1),
    mission_session_id: z.string().min(1),
    assistant_message_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    time_recorded: z.number().nonnegative(),
  })
  .strict()

export const MissionCompletionFact = z.object({
  messageID: z.string().min(1),
  toolCallID: z.string().min(1),
  toolPartID: z.string().min(1),
  summary: z.string().min(1),
  timeRecorded: z.number().nonnegative(),
})

export type MissionCompletionFactValue = z.infer<typeof MissionCompletionFact>

export const MissionBlockTaskReviewInput = z.object({
  task_id: z.string().min(1).describe("Current terminal child Task reviewed before blocking this Mission."),
  evidence_read_refs: MissionCompletionTaskAcceptanceInput.shape.evidence_read_refs,
}).strict()

export const MissionBlockTaskReview = z.object({
  task_id: z.string().min(1),
  evidence_locators: MissionCompletionTaskAcceptance.shape.evidence_locators,
  terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
}).strict()

export const MissionBlockInput = z.object({
  summary: MissionCompletionInput.shape.summary.describe("Truthful user-facing summary of the blocked Mission."),
  unresolved_criteria: z.array(z.string().trim().min(1).max(1_000)).min(1).max(32).describe(
    "Original outcome obligations that remain unmet because of the evidenced external authority or capability boundary.",
  ),
  task_reviews: z.array(MissionBlockTaskReviewInput).min(1).max(128).describe(
    "Complete current child-Task set and exact fully read evidence for each terminal occurrence.",
  ),
}).strict()

export const MissionBlockActionInput = MissionBlockInput.extend({ action: z.literal("block_mission") }).strict()

export const MissionBlockReceipt = z.object({
  kind: z.literal("mission_blocked"),
  mission_id: z.string().min(1),
  mission_session_id: z.string().min(1),
  summary: MissionBlockInput.shape.summary,
  unresolved_criteria: MissionBlockInput.shape.unresolved_criteria,
  task_reviews: z.array(MissionBlockTaskReview).min(1).max(128),
  assistant_message_id: z.string().min(1),
  tool_call_id: z.string().min(1),
  tool_part_id: z.string().min(1),
  time_recorded: z.number().nonnegative(),
}).strict()

export const MissionOutcomeFact = z.discriminatedUnion("kind", [
  MissionCompletionFact.extend({ kind: z.literal("accepted") }),
  MissionCompletionFact.extend({
    kind: z.literal("blocked"),
    unresolvedCriteria: MissionBlockInput.shape.unresolved_criteria,
  }),
])

export type MissionOutcomeFactValue = z.infer<typeof MissionOutcomeFact>
