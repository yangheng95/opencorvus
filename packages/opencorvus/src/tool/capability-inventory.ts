import { compareCanonicalStrings } from "@/util/canonical-digest"
import { coreBuiltInToolIDs } from "@/agent/tool-pool-data"
import { PlatformCapabilitySetRegistry } from "@/agent/platform-capability-sets"

const toolIDs = Object.freeze([...coreBuiltInToolIDs()].sort(compareCanonicalStrings))

export namespace ToolCapabilityInventory {
  export function snapshot(): {
    revision: string
    toolIDs: readonly string[]
    sets: ReturnType<typeof PlatformCapabilitySetRegistry.all>
  } {
    return Object.freeze({
      revision: PlatformCapabilitySetRegistry.sourceRevision(toolIDs),
      toolIDs,
      sets: PlatformCapabilitySetRegistry.all(),
    })
  }
}
