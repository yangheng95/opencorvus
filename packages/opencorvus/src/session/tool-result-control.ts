export const TOOL_RESULT_PARK_METADATA_KEY = "opencorvusParkAfterToolResult"
export const TOOL_RESULT_CONTROL_METADATA_KEY = "opencorvusToolResultControl"

export type ToolResultControl =
  | Readonly<{ kind: "immediate_park" }>
  | Readonly<{
      kind: "handoff_drain"
      request_id: string
      dispatch_lineage_id: string
    }>

export function toolResultControl(metadata: unknown): ToolResultControl | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined
  const value = (metadata as Record<string, unknown>)[TOOL_RESULT_CONTROL_METADATA_KEY]
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (record.kind === "immediate_park" && Object.keys(record).length === 1) return { kind: "immediate_park" }
  if (
    record.kind === "handoff_drain" &&
    typeof record.request_id === "string" &&
    record.request_id.length > 0 &&
    typeof record.dispatch_lineage_id === "string" &&
    record.dispatch_lineage_id.length > 0 &&
    Object.keys(record).length === 3
  ) {
    return {
      kind: "handoff_drain",
      request_id: record.request_id,
      dispatch_lineage_id: record.dispatch_lineage_id,
    }
  }
  throw new Error("Invalid OpenCorvus tool-result control metadata")
}

export function shouldParkAfterToolResult(metadata: unknown): boolean {
  const legacy =
    !!metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>)[TOOL_RESULT_PARK_METADATA_KEY] === true
  const control = toolResultControl(metadata)
  return legacy || control?.kind === "immediate_park"
}
