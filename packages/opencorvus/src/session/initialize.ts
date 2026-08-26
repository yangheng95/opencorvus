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
      /** Caller-owned durable facts merged onto the input Message (never part
       *  of the public route schema). */
      extra: z.record(z.string(), z.any()).optional(),
    }),
    async (input) => {
      return SessionPrompt.command({
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: input.providerID + "/" + input.modelID,
        command: Command.Default.INIT,
        arguments: "",
        extra: input.extra,
      })
    },
  )
}
