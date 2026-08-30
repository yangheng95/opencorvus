import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"
import { GLOBAL_TOOL_IDS } from "./tool-id-catalog"

const toolIDs = Object.freeze([...new Set<string>(GLOBAL_TOOL_IDS)].sort(compareCanonicalStrings))

export namespace ToolCapabilityInventory {
  export function snapshot(): { revision: string; toolIDs: readonly string[] } {
    return Object.freeze({
      revision: canonicalDigestSource("tool-registry-capability-inventory-v1", toolIDs).sha256,
      toolIDs,
    })
  }
}
