import { Config } from "@/config/config"

export type ExecutionCapacityClass = keyof Config.ExecutionCapacity

const DEFAULT_EXECUTION_CAPACITY = 4
let capacityOverrideForTest: Partial<Record<ExecutionCapacityClass, number>> | undefined

/**
 * Read the one global physical-capacity policy. Domain schedulers retain all
 * occurrence, order, retry and settlement authority; this value only bounds
 * how many already-ready effects may execute at once in one runtime.
 */
export async function globalExecutionCapacity(kind: ExecutionCapacityClass): Promise<number> {
  const overridden = capacityOverrideForTest?.[kind]
  if (overridden !== undefined) return overridden
  const configured = (await Config.getGlobal()).execution_capacity?.[kind]
  return configured ?? DEFAULT_EXECUTION_CAPACITY
}

export const ExecutionCapacityTestHooks = {
  install(override: Partial<Record<ExecutionCapacityClass, number>>): Disposable {
    if (capacityOverrideForTest) throw new Error("Execution capacity test override is already installed")
    capacityOverrideForTest = { ...override }
    return {
      [Symbol.dispose]() {
        capacityOverrideForTest = undefined
      },
    }
  },
}
