import z from "zod"
import { Identifier } from "../id/id"
import { Message } from "./message"
import { PrimaryAssistantRegistry } from "../agent/primary-assistant-registry"
import { Provider } from "../provider/provider"
import { resolveAgentModelRef } from "../agent/model"
import { Bus } from "../bus"
import { Plugin } from "../plugin"
import { Command } from "../command"
import { $ } from "bun"
import { ConfigMarkdown } from "../config/markdown"
import { EffectiveConfig } from "../config/effective"
import { NamedError } from "@opencorvus-ai/util/error"
import { Session } from "."
import { SessionPromptState } from "./prompt/state"
import { sessionLifecycleOrderKey } from "./status"
import { resolvePromptParts } from "./prompt/parts"
import type { PromptInput } from "./prompt/schema"
import { ProjectMemory } from "@/memory/project-memory"

export namespace SessionCommand {
  const { log } = SessionPromptState

  export const CommandInput = z.object({
    messageID: Identifier.schema("message").optional(),
    sessionID: Identifier.schema("session"),
    agent: z.string().optional(),
    model: z.string().optional(),
    arguments: z.string(),
    command: z.string(),
    variant: z.string().optional(),
    parts: z
      .array(
        z.discriminatedUnion("type", [
          Message.FilePart.omit({
            messageID: true,
            sessionID: true,
          }).partial({
            id: true,
          }),
        ]),
      )
      .optional(),
  })
  export type CommandInput = z.infer<typeof CommandInput>
  const bashRegex = /!`([^`]+)`/g
  const argsRegex = /(?:\[Image\s+\d+\]|"[^"]*"|'[^']*'|[^\s"']+)/gi
  const placeholderRegex = /\$(\d+)/g
  const quoteTrimRegex = /^["']|["']$/g

  export async function command(
    input: CommandInput,
    prompt: (input: PromptInput) => Promise<Message.WithParts>,
  ) {
    log.info("command", input)
    const cmd = await Command.get(input.command)
    const session = await Session.get(input.sessionID)
    const config = await EffectiveConfig.effective({ sessionID: input.sessionID })
    const requestedAgentID = cmd.agent ?? input.agent ?? (await PrimaryAssistantRegistry.defaultID({ config }))
    if (!PrimaryAssistantRegistry.isID(requestedAgentID)) {
      const error = new NamedError.Unknown({
        message: `Command agent ${JSON.stringify(requestedAgentID)} is not a primary assistant`,
      })
      await Bus.publish(Session.Event.Error, {
        sessionID: input.sessionID,
        orderKey: sessionLifecycleOrderKey(input.sessionID),
        error: error.toObject(),
      })
      throw error
    }
    const agent = await PrimaryAssistantRegistry.get(requestedAgentID, { config })
    const agentName = agent.name

    const raw = input.arguments.match(argsRegex) ?? []
    const args = raw.map((arg) => arg.replace(quoteTrimRegex, ""))

    const templateCommand = await cmd.template

    const placeholders = templateCommand.match(placeholderRegex) ?? []
    let last = 0
    for (const item of placeholders) {
      const value = Number(item.slice(1))
      if (value > last) last = value
    }

    const withArgs = templateCommand.replaceAll(placeholderRegex, (_, index) => {
      const position = Number(index)
      const argIndex = position - 1
      if (argIndex >= args.length) return ""
      if (position === last) return args.slice(argIndex).join(" ")
      return args[argIndex]
    })
    const usesArgumentsPlaceholder = templateCommand.includes("$ARGUMENTS")
    let template = withArgs.replaceAll("$ARGUMENTS", input.arguments)

    if (placeholders.length === 0 && !usesArgumentsPlaceholder && input.arguments.trim()) {
      template = template + "\n\n" + input.arguments
    }

    const shell = ConfigMarkdown.shell(template)
    if (shell.length > 0) {
      const results = await Promise.all(
        shell.map(async ([, cmd]) => {
          try {
            return await $`${{ raw: cmd }}`.quiet().nothrow().text()
          } catch (error) {
            return `Error executing command: ${error instanceof Error ? error.message : String(error)}`
          }
        }),
      )
      let index = 0
      template = template.replace(bashRegex, () => results[index++])
    }
    template = template.trim()

    // Single model resolver (spec §13.1). Deliberately normalizes the old
    // ad-hoc order (cmd.model > cmd.agent.model > input.model > default) to
    // the canonical precedence: per-request explicit (cmd.model, else
    // input.model) > session overlay > base agent.<name>.model > base model.
    // Consolidating the parallel derivation is the rule 8 goal.
    const explicitModel = cmd.model
      ? Provider.parseModel(cmd.model)
      : input.model
        ? Provider.parseModel(input.model)
        : null
    const taskModel = await resolveAgentModelRef(agentName, {
      explicitModel,
      sessionID: input.sessionID,
    })

    try {
      await Provider.getModel(taskModel.providerID, taskModel.modelID, { config })
    } catch (e) {
      if (Provider.ModelNotFoundError.isInstance(e)) {
        const { providerID, modelID, suggestions } = e.data
        const hint = suggestions?.length ? ` Did you mean: ${suggestions.join(", ")}?` : ""
        await Bus.publish(Session.Event.Error, {
          sessionID: input.sessionID,
          orderKey: sessionLifecycleOrderKey(input.sessionID),
          error: new NamedError.Unknown({ message: `Model not found: ${providerID}/${modelID}.${hint}` }).toObject(),
        })
      }
      throw e
    }
    const templateParts = await resolvePromptParts(template, { config })
    const parts = [...templateParts, ...(input.parts ?? [])]

    await Plugin.trigger(
      "command.execute.before",
      {
        command: input.command,
        sessionID: input.sessionID,
        arguments: input.arguments,
      },
      { parts },
    )

    const result = await prompt({
      sessionID: input.sessionID,
      author: "user",
      messageID: input.messageID,
      model: taskModel,
      agent: agentName,
      byteMaterializationProjectID: session.projectID,
      extra: ProjectMemory.userInputExtra({
        surface: "session.command",
        literalText: `/${input.command}${input.arguments ? ` ${input.arguments}` : ""}`,
      }),
      parts,
      variant: input.variant,
    })

    await Bus.publish(Command.Event.Executed, {
      name: input.command,
      sessionID: input.sessionID,
      arguments: input.arguments,
      messageID: result.info.id,
    })

    return result
  }
}
