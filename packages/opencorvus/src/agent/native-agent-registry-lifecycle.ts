import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"

export type NativeAgentRegistryLifecycleReceipt = Readonly<{
  explicit_entries_detached: number
  default_project_states_detached: number
  registries: readonly Awaited<ReturnType<typeof PrimaryAssistantRegistry.reset>>[]
}>

function aggregate(
  registries: Awaited<ReturnType<typeof PrimaryAssistantRegistry.reset>>[],
): NativeAgentRegistryLifecycleReceipt {
  return {
    explicit_entries_detached: registries.reduce((total, item) => total + item.explicit_entries_detached, 0),
    default_project_states_detached: registries.reduce((total, item) => total + item.default_project_states_detached, 0),
    registries,
  }
}

/** Cache lifecycle for the three fixed native-agent registries. */
export const NativeAgentRegistryLifecycle = Object.freeze({
  async reset(): Promise<NativeAgentRegistryLifecycleReceipt> {
    return aggregate(await Promise.all([
      PrimaryAssistantRegistry.reset(),
      HelperAgentRegistry.reset(),
      HostAgentRegistry.reset(),
    ]))
  },

  async resetAll(): Promise<NativeAgentRegistryLifecycleReceipt> {
    return aggregate(await Promise.all([
      PrimaryAssistantRegistry.resetAll(),
      HelperAgentRegistry.resetAll(),
      HostAgentRegistry.resetAll(),
    ]))
  },
})
