import z from "zod"
const ToolOccurrence = {
  message_id: z.string().min(1).optional(),
  tool_call_id: z.string().min(1).optional(),
  tool_part_id: z.string().min(1).optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
} as const

function exactToolTuple(
  value: { message_id?: string; tool_call_id?: string; tool_part_id?: string; tool_input?: unknown },
  context: z.RefinementCtx,
) {
  const supplied = [value.message_id, value.tool_call_id, value.tool_part_id, value.tool_input]
  if (supplied.some((item) => item !== undefined) && !supplied.every((item) => item !== undefined)) {
    context.addIssue({
      code: "custom",
      message: "Persisted Task creator Tool authority requires message, call, part and input together.",
    })
  }
}

const SessionCreator = z
  .object({
    actor: z.enum(["control_agent", "right_sidebar_conversation", "orchestrator"]),
    session_id: z.string().min(1),
    ...ToolOccurrence,
  })
  .strict()
  .superRefine(exactToolTuple)

const MissionCreator = z
  .object({
    actor: z.literal("mission"),
    session_id: z.string().min(1),
    mission_id: z.string().min(1),
    opened_occurrence: z
      .object({
        event_id: z.string().min(1),
        operation_id: z.string().uuid(),
      })
      .strict(),
    ...ToolOccurrence,
  })
  .strict()
  .superRefine(exactToolTuple)

/** Exact creator authority frozen by the current Task writer. This schema is
 * shared by the producer, durable request parser and transfer validator. */
export const PersistedTaskCreationCreator = z.union([
  z.object({ actor: z.literal("user") }).strict(),
  MissionCreator,
  SessionCreator,
])
export type PersistedTaskCreationCreator = z.infer<typeof PersistedTaskCreationCreator>
