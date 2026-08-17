import { Provider } from "@/provider/provider"
import type { Config } from "./config"

function collectModelReferences(input: Config.Info, root: string): Array<{ path: string; model: string }> {
  const refs: Array<{ path: string; model: string }> = []
  const add = (path: string, model: string | undefined) => {
    if (model?.trim()) refs.push({ path, model })
  }
  add(`${root}.model`, input.model)
  add(`${root}.small_model`, input.small_model)
  for (const [agentID, agent] of Object.entries(input.agent ?? {})) {
    add(`${root}.agent.${agentID}.model`, "model" in agent ? agent.model : undefined)
  }
  for (const [templateID, runtime] of Object.entries(input.runtime_templates ?? {})) {
    add(`${root}.runtime_templates.${templateID}.model`, runtime?.model)
  }
  for (const [expertSquadID, expertSquad] of Object.entries(input.expert_squads ?? {})) {
    for (const [agentID, projected] of Object.entries(expertSquad.agents)) {
      add(`${root}.expert_squads.${expertSquadID}.agents.${agentID}.runtime.model`, projected.runtime.model)
    }
  }
  for (const [commandID, command] of Object.entries(input.command ?? {})) {
    add(`${root}.command.${commandID}.model`, command.model)
  }
  return refs
}

export async function validateConfigModelReferences(
  input: Config.Info,
  root = "config",
  providerScope: "project" | "global" = "project",
) {
  for (const ref of collectModelReferences(input, root)) {
    const parsed = Provider.parseModel(ref.model)
    const model =
      providerScope === "global"
        ? Provider.getModelGlobal(parsed.providerID, parsed.modelID, input)
        : Provider.getModel(parsed.providerID, parsed.modelID, { config: input })
    await model.catch((error) => {
      if (error instanceof Provider.ModelNotFoundError) {
        error.data.suggestions = error.data.suggestions ?? []
      }
      throw error
    })
  }
}
