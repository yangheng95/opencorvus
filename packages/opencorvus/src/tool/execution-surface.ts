import { CapabilityRules } from "@/capability/rules"
import type { HarnessProjection } from "@/capability/harness-projection"
import type { TurnCapabilityProjectionV2 } from "@/capability/reveal-receipt"

export interface ToolExecutionSurface {
  toolIDs: readonly string[]
  permission: CapabilityRules.Ruleset
  harness_projection?: HarnessProjection
  capability_projection?: TurnCapabilityProjectionV2
  permission_layers?: Readonly<{
    agent: CapabilityRules.Ruleset
    session: CapabilityRules.Ruleset
  }>
}

export function toolSwitchAllows(name: string, switches: Readonly<Record<string, boolean>> | undefined): boolean {
  if (!switches) return true
  if (switches["*"] === false) return switches[name] === true
  return switches[name] !== false
}

export function visibleExecutionToolIDs(input: {
  toolIDs: readonly string[]
  permission: CapabilityRules.Ruleset
  switches?: Readonly<Record<string, boolean>>
}): string[] {
  return input.toolIDs.filter(
    (toolID) =>
      toolSwitchAllows(toolID, input.switches) &&
      CapabilityRules.evaluate(toolID, "*", input.permission).action !== "deny",
  )
}

export function applyToolExecutionPolicy<T>(input: {
  tools: Record<string, T>
  permission: CapabilityRules.Ruleset
  switches?: Readonly<Record<string, boolean>>
  requiredToolIDs?: Iterable<string>
}): void {
  const required = new Set(input.requiredToolIDs ?? [])
  for (const toolID of required) {
    if (!Object.hasOwn(input.tools, toolID)) {
      throw new Error(`Required runtime tool ${JSON.stringify(toolID)} is not materialized`)
    }
  }
  const visible = new Set(
    visibleExecutionToolIDs({
      toolIDs: Object.keys(input.tools),
      permission: input.permission,
      switches: input.switches,
    }),
  )
  for (const toolID of Object.keys(input.tools)) {
    if (!visible.has(toolID) && !required.has(toolID)) delete input.tools[toolID]
  }
}

export function createToolExecutionSurface(input: {
  toolIDs: Iterable<string>
  permission: CapabilityRules.Ruleset
  permissionLayers?: {
    agent?: CapabilityRules.Ruleset
    session?: CapabilityRules.Ruleset
  }
  harnessProjection?: HarnessProjection
  capabilityProjection?: TurnCapabilityProjectionV2
}): ToolExecutionSurface {
  const toolIDs = [...input.toolIDs]
  if (new Set(toolIDs).size !== toolIDs.length) {
    throw new Error("Tool execution surface IDs must be unique")
  }
  const permission = input.permission.map((rule) => Object.freeze({ ...rule }))
  const permissionLayers = input.permissionLayers
    ? Object.freeze({
        agent: Object.freeze(
          (input.permissionLayers.agent ?? []).map((rule) => Object.freeze({ ...rule })),
        ) as CapabilityRules.Ruleset,
        session: Object.freeze(
          (input.permissionLayers.session ?? []).map((rule) => Object.freeze({ ...rule })),
        ) as CapabilityRules.Ruleset,
      })
    : undefined
  return Object.freeze({
    toolIDs: Object.freeze(toolIDs),
    permission: Object.freeze(permission) as CapabilityRules.Ruleset,
    ...(input.harnessProjection ? { harness_projection: input.harnessProjection } : {}),
    ...(input.capabilityProjection ? { capability_projection: input.capabilityProjection } : {}),
    ...(permissionLayers ? { permission_layers: permissionLayers } : {}),
  })
}
