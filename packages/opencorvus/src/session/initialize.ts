import z from "zod"
import { Command } from "../command"
import { Identifier } from "../id/id"
import { fn } from "@/util/fn"
import { SessionPrompt } from "./prompt"

export namespace SessionInitializer {
  export const initialize = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      modelID: z.string(),
      providerID: z.string(),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      await SessionPrompt.command({
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: input.providerID + "/" + input.modelID,
        command: Command.Default.INIT,
        arguments: "",
      })
    },
  )
}
