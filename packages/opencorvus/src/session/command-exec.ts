import z from "zod"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { Identifier } from "../id/id"
import { Message } from "./message"
import { PrimaryAssistantRegistry } from "../agent/primary-assistant-registry"
import { Provider } from "../provider/provider"
import { resolveAgentModelRef } from "../agent/model"
import { Bus } from "../bus"
import { Plugin } from "../plugin"
import { Command } from "../command"
import { ConfigMarkdown } from "../config/markdown"
import { EffectiveConfig } from "../config/effective"
import { NamedError } from "@opencorvus-ai/util/error"
import { Session } from "."
import { SessionPromptState } from "./prompt/state"
import { sessionLifecycleOrderKey } from "./status"
import { resolvePromptParts } from "./prompt/parts"
import { PromptInput } from "./prompt/schema"
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
    /** Caller-owned durable facts merged onto the input Message (never part
     *  of the public route schema). */
    extra: z.record(z.string(), z.any()).optional(),
    parts: PromptInput.shape.parts.optional(),
  })
  export type CommandInput = z.infer<typeof CommandInput>
  const argsRegex = /(?:\[Image\s+\d+\]|"[^"]*"|'[^']*'|[^\s"']+)/gi
  const quoteTrimRegex = /^["']|["']$/g

  function renderStaticTemplate(template: string, args: string[], raw: string) {
    const placeholders = [...template.matchAll(Command.templatePlaceholder)]
    let lastPosition = 0
    for (const [, parameter] of placeholders) {
      if (parameter !== "ARGUMENTS") lastPosition = Math.max(lastPosition, Number(parameter))
    }
    const substitute = (value: string) => value.replaceAll(Command.templatePlaceholder, (_, parameter) => {
      if (parameter === "ARGUMENTS") return raw
      const position = Number(parameter)
      if (position === lastPosition) return args.slice(position - 1).join(" ")
      return args[position - 1] ?? ""
    })
    const files = ConfigMarkdown.files(template).map(([, filename]) => substitute(filename)).filter(Boolean)
    const text = placeholders.length === 0 && raw.trim() ? template + "\n\n" + raw : substitute(template)
    return { text, files }
  }

  async function readMcpTemplate(cmd: Command.McpDefinition, args: string[], raw: string) {
    const missing = cmd.arguments.filter((arg, index) => arg.required && index >= args.length).map((arg) => arg.name)
    if (missing.length > 0) {
      throw new Command.ArgumentsError({
        command: cmd.name,
        reason: "missing_required",
        missing,
        message: `Command ${JSON.stringify(cmd.name)} requires ${missing.map((name) => JSON.stringify(name)).join(", ")}.`,
      })
    }
    const values = Object.fromEntries(
      cmd.arguments.slice(0, args.length).map((arg, index) => [
        arg.name,
        index === cmd.arguments.length - 1 ? args.slice(index).join(" ") : args[index],
      ]),
    )
    try {
      const template = await cmd.readTemplate(values)
      return cmd.arguments.length === 0 && raw.trim() ? template + "\n\n" + raw : template
    } catch (error) {
      if (!(error instanceof McpError) || error.code !== ErrorCode.InvalidParams) throw error
      throw new Command.ArgumentsError(
        {
          command: cmd.name,
          reason: "invalid",
          message: `The MCP server rejected the input for command ${JSON.stringify(cmd.name)}.`,
        },
        { cause: error },
      )
    }
  }

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

    const template =
      cmd.source === "mcp"
        ? { text: await readMcpTemplate(cmd, args, input.arguments), files: [] }
        : renderStaticTemplate(cmd.template, args, input.arguments)

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
    const templateParts = await resolvePromptParts(template.text.trim(), template.files)
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
      extra: {
        ...ProjectMemory.userInputExtra({
          surface: "session.command",
          literalText: `/${input.command}${input.arguments ? ` ${input.arguments}` : ""}`,
        }),
        ...input.extra,
      },
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
