import { createAgentContextTools } from "@/agent/context-tools"

export function createReadonlyRetrievalTools(taskWorkDir?: string) {
  return createAgentContextTools(taskWorkDir)
}
