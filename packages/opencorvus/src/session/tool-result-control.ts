import z from "zod"

export const TOOL_RESULT_CONTROL_METADATA_KEY = "opencorvusToolResultControl"

export const ToolResultControlSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("immediate_park") }).strict(),
  z
    .object({
      kind: z.literal("handoff_drain"),
      request_id: z.string().min(1),
      dispatch_lineage_id: z.string().min(1),
    })
    .strict(),
])

export type ToolResultControl = z.infer<typeof ToolResultControlSchema>
export type ToolResultDisposition = "continue" | "park" | "handoff"

export function toolResultDisposition(control: ToolResultControl | undefined): ToolResultDisposition {
  if (!control) return "continue"
  switch (control.kind) {
    case "immediate_park":
      return "park"
    case "handoff_drain":
      return "handoff"
  }
}

export function assertToolResultControlPreserved(
  expected: ToolResultControl | undefined,
  metadata: unknown,
): void {
  let actual: ToolResultControl | undefined
  try {
    actual = toolResultControl(metadata)
  } catch (cause) {
    if (cause instanceof InvalidToolResultControlError) {
      throw new InvalidToolResultControlError(cause.value, { cause }, expected)
    }
    throw cause
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new InvalidToolResultControlError(metadata, {
      cause: new Error("A Tool execution hook removed or changed host-owned turn control"),
    }, expected)
  }
}

export class InvalidToolResultControlError extends Error {
  constructor(
    readonly value: unknown,
    options?: ErrorOptions,
    readonly committedControl?: ToolResultControl,
  ) {
    super("Invalid OpenCorvus tool-result control metadata", options)
    this.name = "InvalidToolResultControlError"
  }
}

export function toolResultControl(metadata: unknown): ToolResultControl | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined
  const record = metadata as Record<string, unknown>
  if (!(TOOL_RESULT_CONTROL_METADATA_KEY in record)) return undefined
  const parsed = ToolResultControlSchema.safeParse(record[TOOL_RESULT_CONTROL_METADATA_KEY])
  if (!parsed.success) {
    throw new InvalidToolResultControlError(record[TOOL_RESULT_CONTROL_METADATA_KEY], {
      cause: parsed.error,
    })
  }
  return parsed.data
}

function withControl<T extends Readonly<Record<string, unknown>>>(
  metadata: T,
  control: ToolResultControl,
): T & { readonly [TOOL_RESULT_CONTROL_METADATA_KEY]: ToolResultControl } {
  if (TOOL_RESULT_CONTROL_METADATA_KEY in metadata) {
    throw new InvalidToolResultControlError(metadata[TOOL_RESULT_CONTROL_METADATA_KEY])
  }
  return {
    ...metadata,
    [TOOL_RESULT_CONTROL_METADATA_KEY]: ToolResultControlSchema.parse(control),
  }
}

export function withImmediateParkToolResultControl<T extends Readonly<Record<string, unknown>>>(metadata: T) {
  return withControl(metadata, { kind: "immediate_park" })
}

export function withHandoffDrainToolResultControl<T extends Readonly<Record<string, unknown>>>(
  metadata: T,
  input: Readonly<{ requestID: string; dispatchLineageID: string }>,
) {
  return withControl(metadata, {
    kind: "handoff_drain",
    request_id: input.requestID,
    dispatch_lineage_id: input.dispatchLineageID,
  })
}
