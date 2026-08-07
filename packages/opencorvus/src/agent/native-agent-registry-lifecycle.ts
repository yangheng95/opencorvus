import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"

/** Cache lifecycle for the three fixed native-agent registries. */
export const NativeAgentRegistryLifecycle = Object.freeze({
  async reset(): Promise<void> {
    await Promise.all([
      PrimaryAssistantRegistry.reset(),
      HelperAgentRegistry.reset(),
      HostAgentRegistry.reset(),
    ])
  },

  async resetAll(): Promise<void> {
    await Promise.all([
      PrimaryAssistantRegistry.resetAll(),
      HelperAgentRegistry.resetAll(),
      HostAgentRegistry.resetAll(),
    ])
  },
})
