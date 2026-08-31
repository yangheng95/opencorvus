import z from "zod"

export const PanelCreationOperation = z.enum(["wake_mission", "wake_work"])
export type PanelCreationOperation = z.infer<typeof PanelCreationOperation>

export const PanelCreationFact = z
  .object({
    protocol: z.literal("panel-creation-v1"),
    operation: PanelCreationOperation,
    tool_part_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    message_id: z.string().min(1),
    caller_user_message_id: z.string().min(1),
    target_id: z.string().min(1),
    input: z.record(z.string(), z.unknown()),
  })
  .strict()
export type PanelCreationFact = z.infer<typeof PanelCreationFact>

export function panelCreationTargetID(operation: PanelCreationOperation, toolPartID: string): string {
  // Keep the deterministic identity SQL-verifiable. The persisted Tool Part
  // is already a globally unique immutable occurrence; retaining its final
  // 17/19 base62 characters fits the canonical Session/Mission ID limits and
  // lets the INSERT trigger prove the target without a host-only hash UDF.
  return operation === "wake_mission"
    ? `chat-p-${toolPartID.slice(-17).toLowerCase()}`
    : `ses_p${toolPartID.slice(-19).toLowerCase()}`
}

export function buildPanelCreationFact(input: {
  operation: PanelCreationOperation
  toolPartID: string
  toolCallID: string
  messageID: string
  callerUserMessageID: string
  params: unknown
}): PanelCreationFact {
  return PanelCreationFact.parse({
    protocol: "panel-creation-v1",
    operation: input.operation,
    tool_part_id: input.toolPartID,
    tool_call_id: input.toolCallID,
    message_id: input.messageID,
    caller_user_message_id: input.callerUserMessageID,
    target_id: panelCreationTargetID(input.operation, input.toolPartID),
    input: input.params,
  })
}
