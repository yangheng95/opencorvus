import type { Tool as AITool } from "ai"

export type ExactToolFactories = Readonly<Record<string, () => AITool>>

export function materializeExactTool<Factories extends ExactToolFactories>(
  factories: Factories,
  toolID: string,
  onMaterialize?: (toolID: keyof Factories & string) => void,
): ReturnType<Factories[keyof Factories]> | undefined {
  if (!Object.hasOwn(factories, toolID)) return undefined
  const exactToolID = toolID as keyof Factories & string
  onMaterialize?.(exactToolID)
  return factories[exactToolID]!() as ReturnType<Factories[keyof Factories]>
}
