import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import type { Provider } from "../provider/provider"
import type { Message } from "./message"
import { ContextBudget } from "./context-budget"

export namespace CompactionOverflow {
  export async function isOverflow(input: {
    tokens: Message.Assistant["tokens"]
    model: Provider.Model
    sessionID?: string
  }) {
    const config = input.sessionID
      ? await EffectiveConfig.effective({ sessionID: input.sessionID })
      : await Config.get()
    return ContextBudget.isUsageOverflow({ config, tokens: input.tokens, model: input.model })
  }
}
