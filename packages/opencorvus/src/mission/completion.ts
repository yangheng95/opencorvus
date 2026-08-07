import z from "zod"
import { ArtifactReadLocatorSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference"

export const MissionCompletionTaskAcceptance = z
  .object({
    task_id: z.string().min(1).describe("Current child Task accepted by this Mission decision."),
    terminal_lifecycle_reference: TerminalLifecycleReferenceSchema.describe(
      "Exact current completed occurrence reviewed by Mission.",
    ),
    evidence_locators: z
      .array(ArtifactReadLocatorSchema)
      .min(1)
      .max(64)
      .describe("Exact Task Artifact locators completely read earlier in this Mission Turn."),
  })
  .strict()

export const MissionCompletionInput = z.object({
  summary: z.string().trim().min(1).max(4_000).describe("Concise user-facing summary of the accepted Mission outcome."),
  task_acceptances: z
    .array(MissionCompletionTaskAcceptance)
    .max(128)
    .describe(
      "Complete current Mission child-Task acceptance set. Empty is valid only when Mission completed bounded coordination without child Tasks.",
    ),
})

export const MissionCompletionActionInput = MissionCompletionInput.extend({
  action: z.literal("complete_mission"),
}).strict()

export const MissionCompletionReceipt = MissionCompletionInput.extend({
  kind: z.literal("mission_completed"),
  mission_id: z.string().min(1),
  mission_session_id: z.string().min(1),
  assistant_message_id: z.string().min(1),
  tool_call_id: z.string().min(1),
  tool_part_id: z.string().min(1),
  time_recorded: z.number().nonnegative(),
}).strict()

export const MissionCompletionFact = z.object({
  messageID: z.string().min(1),
  toolCallID: z.string().min(1),
  toolPartID: z.string().min(1),
  summary: z.string().min(1),
  timeRecorded: z.number().nonnegative(),
})

export type MissionCompletionFactValue = z.infer<typeof MissionCompletionFact>
